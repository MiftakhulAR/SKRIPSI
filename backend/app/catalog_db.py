"""Catalogue tables: careers, required skills, skill dictionary, interest areas, course templates.

Before patch 8 these lists were read from fixed CSV files. They now live in the database so the
admin can add, edit and delete them from the admin web (no hard-coded lists in the code).
On the first start the tables are filled from artifacts/ (the Colab pipeline output, Tahap 8-10);
POST /api/admin/catalog/reset puts that original data back.

Tiers of careers:
  validated  - skill profile built from Indonesian job ads (Colab pipeline); used in the evaluation
  reference  - skill profile from a reference source, not validated against Indonesian ads.
               The O*NET 31.0 pack (tools/build_onet_pack.py) adds ~900 occupations of all fields, so
               students outside IT also get recommendations.
"""
import csv
import json
import os
from pathlib import Path

from .db import _add_column, conn, now

ARTIFACT_DIR = Path(os.environ.get("ARTIFACT_DIR", Path(__file__).resolve().parent.parent / "artifacts"))

# Indonesian labels of the seed interest areas (admin can edit or add more)
SEED_INTEREST_ID = {
    "Software development": "Pengembangan perangkat lunak", "Systems analysis": "Analisis sistem",
    "Databases and data management": "Basis data dan manajemen data", "Quality assurance": "Penjaminan mutu (QA)",
    "UI/UX design": "Desain UI/UX", "Data science and AI": "Sains data dan AI",
    "Infrastructure and cloud": "Infrastruktur dan cloud", "Security": "Keamanan siber",
    "IT service and management": "Layanan dan manajemen TI",
}
SEED_PROGRAM = "D4 Teknik Informatika PNJ"
ONET_SOURCE = "O*NET 31.0 (USDOL/ETA, CC BY 4.0)"
# Version of the Colab job-ad pipeline the validated careers come from. Tahap 13 added 28 soft skills
# (named after O*NET elements) to the skill dictionary and recomputed the weights.
# Patch 12: "tahap13_v2b" = final soft-skill patterns of Tahap 13 (v2b, 20 Okt 2026): 29 O*NET soft skills incl.
# Social Perceptiveness; 293 career-skill rows (was 296 in v1b). Same files as Drive 05_artifacts/web.
PIPELINE_VERSION = "tahap13_v2b"
PIPELINE_SOURCE = "Indonesian IT job ads (Colab Tahap 8; soft skills Tahap 13)"
# Version of the Indonesian O*NET labels (tools/onet_labels_id.csv, checked by AR 20 Okt 2026).
# A database with an older version gets the new labels/kinds for O*NET skills (admin edits are kept).
ONET_LABELS_VERSION = "cek_ar_20okt2026"
# skills removed from the dictionary in Tahap 13 -> the O*NET element that replaces them
SKILL_ALIASES = {"Komunikasi": "Speaking", "Kerja tim": "Cooperation", "Problem solving": "Complex Problem Solving"}


def init():
    with conn() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS interest_areas (
            name TEXT PRIMARY KEY, name_id TEXT, sort INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS skills (
            name TEXT PRIMARY KEY, category TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'hard', sort INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS careers (
            slug TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, tier TEXT NOT NULL DEFAULT 'validated',
            source TEXT, onet_soc TEXT, graduate_profile INTEGER NOT NULL DEFAULT 0,
            interest_areas TEXT NOT NULL DEFAULT '[]', n_ads INTEGER NOT NULL DEFAULT 0, coverage_pct REAL,
            description TEXT, sort INTEGER NOT NULL DEFAULT 0, updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS career_skills (
            career_slug TEXT NOT NULL, skill TEXT NOT NULL, w REAL NOT NULL, demand_pct REAL,
            PRIMARY KEY (career_slug, skill)
        );
        CREATE TABLE IF NOT EXISTS course_templates (
            code TEXT PRIMARY KEY, name TEXT NOT NULL, program TEXT, semester INTEGER,
            semester_inferred INTEGER NOT NULL DEFAULT 0, category TEXT, sks INTEGER,
            skills TEXT NOT NULL DEFAULT '[]', sort INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS career_groups (code TEXT PRIMARY KEY, name TEXT NOT NULL, name_id TEXT);
        CREATE TABLE IF NOT EXISTS catalog_meta (key TEXT PRIMARY KEY, value TEXT);
        """)
        _add_column(c, "careers", "job_zone", "job_zone INTEGER")
        _add_column(c, "careers", "group_code", "group_code TEXT")
        _add_column(c, "careers", "name_id", "name_id TEXT")
        _add_column(c, "skills", "name_id", "name_id TEXT")
        _add_column(c, "skills", "maps_to", "maps_to TEXT NOT NULL DEFAULT '[]'")
        _add_column(c, "skills", "source", "source TEXT")
        _add_column(c, "interest_areas", "source", "source TEXT")
        empty = c.execute("SELECT COUNT(*) FROM careers").fetchone()[0] == 0
        onet_done = c.execute("SELECT 1 FROM catalog_meta WHERE key='onet_loaded'").fetchone()
        pipe = c.execute("SELECT value FROM catalog_meta WHERE key='pipeline_version'").fetchone()
    if empty:
        seed()
        return
    if not onet_done:            # database from patch 8: add the all-fields pack once, keep admin changes
        seed_onet()
    if not pipe or pipe[0] != PIPELINE_VERSION:      # database from an older patch: new weights, keep admin changes
        with conn() as c:
            _apply_pipeline(c)
        seed_onet()
    _apply_onet_labels()


# ---------- seed from the Colab artifacts ----------
def _read(name):
    with open(ARTIFACT_DIR / name, newline="", encoding="utf-8") as fp:
        return list(csv.DictReader(fp))


def slugify(name: str) -> str:
    out = "".join(ch.lower() if ch.isalnum() else "-" for ch in name)
    while "--" in out:
        out = out.replace("--", "-")
    return out.strip("-")


def _dictionary():
    f = "kamus_skill_v4.csv" if (ARTIFACT_DIR / "kamus_skill_v4.csv").exists() else "kamus_skill_v3.csv"
    return [{"skill": r["skill"], "category": r["kategori"],
             "kind": r.get("jenis") or ("soft" if r["kategori"].lower().startswith("soft") else "hard")} for r in _read(f)]


def _apply_pipeline(c):
    """Skill dictionary + weights of the validated careers from the Colab pipeline (artifacts/).
    Used by seed() and to upgrade an existing database; careers and skills added by the admin are kept."""
    weights = _read("bobot_skill_karier.csv")
    dic = _dictionary()
    names = {r["skill"] for r in dic}
    have = {r[0]: r[1] for r in c.execute("SELECT name, source FROM skills")}
    sort = (c.execute("SELECT COALESCE(MAX(sort), -1) FROM skills").fetchone()[0] or 0) + 1
    for i, r in enumerate(dic):
        if r["skill"] in have:
            c.execute("UPDATE skills SET category=?, kind=? WHERE name=? AND source IN ('pipeline', 'onet')",
                      (r["category"], r["kind"], r["skill"]))
        else:
            c.execute("INSERT INTO skills (name, category, kind, sort, source) VALUES (?,?,?,?,'pipeline')",
                      (r["skill"], r["category"], r["kind"], sort + i))
    # old pipeline skills that left the dictionary (replaced by O*NET elements), if nothing else uses them
    for name, src in have.items():
        if src == "pipeline" and name not in names:
            used = c.execute("SELECT 1 FROM career_skills cs JOIN careers k ON k.slug = cs.career_slug "
                             "WHERE cs.skill=? AND k.source NOT LIKE 'Indonesian IT job ads%'", (name,)).fetchone()
            in_course = any(name in json.loads(r[0]) for r in c.execute("SELECT skills FROM course_templates"))
            if not used and not in_course:
                c.execute("DELETE FROM skills WHERE name=?", (name,))
    # weights, number of ads and curriculum coverage (share of demand d taught by verified courses)
    taught = set()
    for r in c.execute("SELECT skills FROM course_templates WHERE program=?", (SEED_PROGRAM,)):
        taught |= set(json.loads(r[0]))
    by = {}
    for r in weights:
        by.setdefault(r["karier"], []).append(r)
    for name, rows in by.items():
        k = c.execute("SELECT slug FROM careers WHERE name=? AND source LIKE 'Indonesian IT job ads%'", (name,)).fetchone()
        if not k:
            continue
        # coverage counts technical skills only (the course-skill mapping verified from the RPS has no soft
        # or language skills), so it keeps the meaning and values of Tahap 8 (cakupan_kurikulum_karier_v2)
        tech = [r for r in rows if r.get("kategori") not in ("Soft skill", "Bahasa")]
        d_all = sum(float(r["d"]) for r in tech)
        cov = round(100 * sum(float(r["d"]) for r in tech if r["skill"] in taught) / d_all, 1) if d_all else None
        c.execute("UPDATE careers SET n_ads=?, coverage_pct=?, source=?, updated_at=? WHERE slug=?",
                  (int(rows[0]["n_total"]), cov, PIPELINE_SOURCE, now(), k[0]))
        c.execute("DELETE FROM career_skills WHERE career_slug=?", (k[0],))
        c.executemany("INSERT INTO career_skills VALUES (?,?,?,?)",
                      [(k[0], r["skill"], float(r["w"]), float(r["persen"])) for r in rows])
    c.execute("INSERT INTO catalog_meta VALUES ('pipeline_version', ?) ON CONFLICT (key) DO UPDATE SET value=excluded.value", (PIPELINE_VERSION,))


def _apply_onet_labels():
    """Indonesian label and kind of O*NET skills from onet_elements.csv, once per ONET_LABELS_VERSION.
    Only rows still owned by the pack (source 'onet') or by the pipeline are changed; admin rows are kept."""
    if not (ARTIFACT_DIR / "onet_elements.csv").exists():
        return
    with conn() as c:
        v = c.execute("SELECT value FROM catalog_meta WHERE key='onet_labels_version'").fetchone()
        if v and v[0] == ONET_LABELS_VERSION:
            return
        for r in _read("onet_elements.csv"):
            c.execute("UPDATE skills SET name_id=? WHERE name=? AND source IN ('onet', 'pipeline')", (r["name_id"], r["name"]))
            c.execute("UPDATE skills SET kind=? WHERE name=? AND source='onet'", (r["kind"], r["name"]))
        c.execute("INSERT INTO catalog_meta VALUES ('onet_labels_version', ?) ON CONFLICT (key) DO UPDATE SET value=excluded.value", (ONET_LABELS_VERSION,))


def seed():
    """(Re)fill every catalogue table from artifacts/. Existing catalogue rows are replaced."""
    careers = _read("katalog_karier.csv")
    areas = []
    for r in careers:
        for a in r["area_minat"].split(";"):
            if a.strip() and a.strip() not in areas:
                areas.append(a.strip())
    areas = sorted(areas, key=lambda a: list(SEED_INTEREST_ID).index(a) if a in SEED_INTEREST_ID else 99)
    courses = {}
    for r in _read("mk_skill_web.csv"):
        sem = r.get("semester") or ""
        c = courses.setdefault(r["kode"], {"name": r["nama_mata_kuliah"], "semester": int(sem) if sem.isdigit() else None,
                                           "inferred": r.get("semester_source") == "inferred", "skills": []})
        if r["skill"] not in c["skills"]:
            c["skills"].append(r["skill"])

    with conn() as c:
        for t in ("interest_areas", "skills", "careers", "career_skills", "course_templates"):
            c.execute(f"DELETE FROM {t}")
        c.execute("DELETE FROM career_groups")
        c.execute("DELETE FROM catalog_meta WHERE key='onet_loaded'")
        c.executemany("INSERT INTO interest_areas (name, name_id, sort, source) VALUES (?,?,?,'it')",
                      [(a, SEED_INTEREST_ID.get(a), i) for i, a in enumerate(areas)])
        for i, r in enumerate(careers):
            slug = slugify(r["karier"])
            c.execute("INSERT INTO careers (slug, name, tier, source, onet_soc, graduate_profile, interest_areas, n_ads, "
                      "coverage_pct, description, sort, updated_at, group_code) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                      (slug, r["karier"], "validated", PIPELINE_SOURCE, r["onet_soc"],
                       int(r["profil_lulusan"] == "1"),
                       json.dumps([a.strip() for a in r["area_minat"].split(";") if a.strip()]),
                       0, None, None, i, now(), r["onet_soc"][:2]))
        c.executemany("INSERT INTO course_templates VALUES (?,?,?,?,?,?,?,?,?)",
                      [(code, v["name"], SEED_PROGRAM, v["semester"], int(v["inferred"]), "program", None,
                        json.dumps(v["skills"]), i) for i, (code, v) in enumerate(courses.items())])
        _apply_pipeline(c)
        c.execute("DELETE FROM catalog_meta WHERE key='onet_labels_version'")
    seed_onet()
    _apply_onet_labels()


def seed_onet():
    """Add the O*NET all-fields pack (reference careers, general skills, interest areas, IT-skill crosswalk).
    Items already in the catalogue are kept. Skipped when the pack files are not in artifacts/."""
    if not (ARTIFACT_DIR / "onet_occupations.csv").exists():
        return
    occ = _read("onet_occupations.csv")
    req = _read("onet_requirements.csv")
    with conn() as c:
        have_skill = {r[0] for r in c.execute("SELECT name FROM skills")}
        have_area = {r[0] for r in c.execute("SELECT name FROM interest_areas")}
        have_slug = {r[0] for r in c.execute("SELECT slug FROM careers")}
        have_soc = {r[0] for r in c.execute("SELECT onet_soc FROM careers WHERE onet_soc IS NOT NULL")}
        sort = c.execute("SELECT COALESCE(MAX(sort), 0) FROM skills").fetchone()[0] + 1
        c.executemany("INSERT INTO skills (name, category, kind, sort, source, name_id) VALUES (?,?,?,?,'onet',?)",
                      [(r["name"], r["category"], r["kind"], sort + i, r["name_id"])
                       for i, r in enumerate(_read("onet_elements.csv")) if r["name"] not in have_skill])
        # soft skills of the job-ad dictionary carry O*NET names: give them the Indonesian label too
        c.executemany("UPDATE skills SET name_id=? WHERE name=? AND name_id IS NULL",
                      [(r["name_id"], r["name"]) for r in _read("onet_elements.csv")])
        links = {}
        for r in _read("skill_crosswalk.csv"):
            links.setdefault(r["skill"], []).append(r["element"])
        for skill, els in links.items():
            c.execute("UPDATE skills SET maps_to=? WHERE name=? AND maps_to='[]'", (json.dumps(els), skill))
        sort = c.execute("SELECT COALESCE(MAX(sort), 0) FROM interest_areas").fetchone()[0] + 1
        c.executemany("INSERT INTO interest_areas (name, name_id, sort, source) VALUES (?,?,?,'onet')",
                      [(r["name"], r["name_id"], sort + i) for i, r in enumerate(_read("onet_interests.csv")) if r["name"] not in have_area])
        c.executemany("INSERT INTO career_groups VALUES (?,?,?) ON CONFLICT (code) DO UPDATE SET name=excluded.name, name_id=excluded.name_id",
                      [(r["code"], r["name"], r["name_id"]) for r in _read("onet_groups.csv")])
        sort = c.execute("SELECT COALESCE(MAX(sort), 0) FROM careers").fetchone()[0] + 1
        new = {}
        for i, r in enumerate(occ):
            slug = slugify(r["title"])
            if r["soc"] in have_soc:
                continue
            if slug in have_slug or slug in new.values():
                slug = f"{slug}-{r['soc'].replace('.', '-')}"
            new[r["soc"]] = slug
            c.execute("INSERT INTO careers (slug, name, tier, source, onet_soc, graduate_profile, interest_areas, n_ads, "
                      "coverage_pct, description, sort, updated_at, job_zone, group_code) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                      (slug, r["title"], "reference", ONET_SOURCE, r["soc"], 0,
                       json.dumps([a for a in r["interest_areas"].split(";") if a]), 0, None, r["description"],
                       sort + i, now(), int(float(r["job_zone"])) if r["job_zone"] else None, r["group_code"]))
        c.executemany("INSERT INTO career_skills VALUES (?,?,?,?)",
                      [(new[r["soc"]], r["element"], float(r["w"]), None) for r in req if r["soc"] in new])
        c.execute("INSERT INTO catalog_meta VALUES ('onet_loaded', ?) ON CONFLICT (key) DO UPDATE SET value=excluded.value", (now(),))


# ---------- read ----------
def load() -> dict:
    with conn() as c:
        return {
            "interest_areas": [dict(r) for r in c.execute("SELECT * FROM interest_areas ORDER BY sort, name")],
            "skills": [{**dict(r), "maps_to": json.loads(r["maps_to"] or "[]")}
                       for r in c.execute("SELECT * FROM skills ORDER BY sort, name")],
            "careers": [{**dict(r), "interest_areas": json.loads(r["interest_areas"])}
                        for r in c.execute("SELECT * FROM careers ORDER BY sort, name")],
            "career_skills": [dict(r) for r in c.execute("SELECT * FROM career_skills")],
            "courses": [{**dict(r), "skills": json.loads(r["skills"])}
                        for r in c.execute("SELECT * FROM course_templates ORDER BY sort, code")],
            "groups": [dict(r) for r in c.execute("SELECT * FROM career_groups ORDER BY code")],
        }


def _next_sort(c, table):
    return (c.execute(f"SELECT COALESCE(MAX(sort), -1) FROM {table}").fetchone()[0] or 0) + 1


# ---------- write (admin) ----------
def upsert_interest(name, name_id):
    with conn() as c:
        if c.execute("SELECT 1 FROM interest_areas WHERE name=?", (name,)).fetchone():
            c.execute("UPDATE interest_areas SET name_id=? WHERE name=?", (name_id, name))
        else:
            c.execute("INSERT INTO interest_areas (name, name_id, sort, source) VALUES (?,?,?,'admin')",
                      (name, name_id, _next_sort(c, "interest_areas")))


def delete_interest(name):
    with conn() as c:
        c.execute("DELETE FROM interest_areas WHERE name=?", (name,))


def upsert_skill(name, category, kind, name_id=None):
    with conn() as c:
        if c.execute("SELECT 1 FROM skills WHERE name=?", (name,)).fetchone():
            c.execute("UPDATE skills SET category=?, kind=?, name_id=COALESCE(?, name_id) WHERE name=?", (category, kind, name_id, name))
        else:
            c.execute("INSERT INTO skills (name, category, kind, sort, source, name_id) VALUES (?,?,?,?,'admin',?)",
                      (name, category, kind, _next_sort(c, "skills"), name_id))


def delete_skill(name):
    with conn() as c:
        c.execute("DELETE FROM skills WHERE name=?", (name,))


def upsert_career(slug, f: dict, skills: list):
    with conn() as c:
        exists = c.execute("SELECT sort FROM careers WHERE slug=?", (slug,)).fetchone()
        vals = (f["name"], f["tier"], f.get("source"), f.get("onet_soc"), int(bool(f.get("graduate_profile"))),
                json.dumps(f["interest_areas"]), int(f.get("n_ads") or 0), f.get("coverage_pct"), f.get("description"))
        if exists:
            c.execute("UPDATE careers SET name=?, tier=?, source=?, onet_soc=?, graduate_profile=?, interest_areas=?, "
                      "n_ads=?, coverage_pct=?, description=?, updated_at=?, name_id=? WHERE slug=?",
                      (*vals, now(), f.get("name_id"), slug))
        else:
            c.execute("INSERT INTO careers (slug, name, tier, source, onet_soc, graduate_profile, interest_areas, n_ads, "
                      "coverage_pct, description, sort, updated_at, name_id, group_code) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                      (slug, *vals, _next_sort(c, "careers"), now(), f.get("name_id"),
                       (f.get("onet_soc") or "")[:2] or None))
        c.execute("DELETE FROM career_skills WHERE career_slug=?", (slug,))
        c.executemany("INSERT INTO career_skills VALUES (?,?,?,?)",
                      [(slug, s["skill"], s["w"], s.get("demand_pct")) for s in skills])


def delete_career(slug):
    with conn() as c:
        c.execute("DELETE FROM career_skills WHERE career_slug=?", (slug,))
        c.execute("DELETE FROM careers WHERE slug=?", (slug,))


def upsert_course(code, f: dict):
    with conn() as c:
        exists = c.execute("SELECT 1 FROM course_templates WHERE code=?", (code,)).fetchone()
        vals = (f["name"], f.get("program"), f.get("semester"), f.get("category"), f.get("sks"), json.dumps(f["skills"]))
        if exists:
            c.execute("UPDATE course_templates SET name=?, program=?, semester=?, category=?, sks=?, skills=?, "
                      "semester_inferred=0 WHERE code=?", (*vals, code))
        else:
            c.execute("INSERT INTO course_templates (code, name, program, semester, category, sks, skills, sort) "
                      "VALUES (?,?,?,?,?,?,?,?)", (code, *vals, _next_sort(c, "course_templates")))


def delete_course(code):
    with conn() as c:
        c.execute("DELETE FROM course_templates WHERE code=?", (code,))
