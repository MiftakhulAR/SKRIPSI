"""In-memory view of the catalogue (careers, skills, interest areas, course templates).

Since patch 8 the catalogue is stored in the database (catalog_db.py) and edited by the admin;
it is seeded from artifacts/ (Colab pipeline, Tahap 8-10). Call reload() after every change.

Only derived, non-sensitive tables are used. Internal texts (RPS, CPL, tracer, private KB chunks)
are not needed for scoring and must not be placed in artifacts/ when the repo is public.
"""
from dataclasses import dataclass, field

from . import catalog_db
from .catalog_db import slugify  # noqa: F401  (re-exported)

# Grade points, Peraturan Pendidikan PNJ 2023/2024 Pasal 10 (letter -> 0..4). e(s) from a course = points / 4.
GRADE_POINTS = {"A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7,
                "C+": 2.3, "C": 2.0, "D": 1.0, "E": 0.0}
# Self-rated level -> e(s) (Bab III, Section 3.5).
SELF_LEVEL = {"advanced": 1.0, "intermediate": 0.67, "beginner": 0.33}
# Course groups used in Indonesian curricula. "university" includes the national compulsory courses
# (MPK at PNJ: religion, Pancasila, civics, Indonesian); "program" = compulsory courses of the study
# programme (MKKU at PNJ); "elective" = pilihan.
COURSE_CATEGORIES = ["university", "faculty", "program", "elective"]
TIERS = ["validated", "reference"]
SKILL_KINDS = ["hard", "soft"]


@dataclass
class Career:
    name: str
    slug: str
    graduate_profile: bool
    interest_areas: list
    onet_soc: str | None
    tier: str = "validated"
    source: str | None = None
    description: str | None = None
    weights: dict = field(default_factory=dict)      # skill -> w(c,s)
    demand_pct: dict = field(default_factory=dict)   # skill -> % of job ads (None for reference careers)
    n_ads: int = 0
    coverage_pct: float | None = None
    updated_at: str | None = None
    job_zone: int | None = None
    group_code: str | None = None
    name_id: str | None = None


class Store:
    def __init__(self):
        d = catalog_db.load()
        self.interest_rows = d["interest_areas"]
        self.interest_areas = [r["name"] for r in d["interest_areas"]]
        self.skills = [{"skill": r["name"], "category": r["category"], "kind": r["kind"], "name_id": r.get("name_id"),
                        "source": r.get("source")} for r in d["skills"]]
        self.skill_names = {s["skill"] for s in self.skills}
        # crosswalk: IT-dictionary skill -> general (O*NET) elements it is evidence for
        self.maps_to = {r["name"]: [e for e in r["maps_to"] if e in self.skill_names] for r in d["skills"] if r["maps_to"]}
        self.groups = {r["code"]: r for r in d["groups"]}
        self.careers: dict[str, Career] = {}
        for r in d["careers"]:
            self.careers[r["slug"]] = Career(
                name=r["name"], slug=r["slug"], graduate_profile=bool(r["graduate_profile"]),
                interest_areas=r["interest_areas"], onet_soc=r["onet_soc"], tier=r["tier"], source=r["source"],
                description=r["description"], n_ads=r["n_ads"], coverage_pct=r["coverage_pct"], updated_at=r["updated_at"],
                job_zone=r.get("job_zone"), group_code=r.get("group_code"), name_id=r.get("name_id"))
        for r in d["career_skills"]:
            c = self.careers.get(r["career_slug"])
            if c:
                c.weights[r["skill"]] = r["w"]
                c.demand_pct[r["skill"]] = r["demand_pct"]
        # a career without required skills cannot be scored (K would divide by 0)
        self.careers = {k: c for k, c in self.careers.items() if sum(c.weights.values()) > 0}
        self.courses: dict[str, dict] = {
            r["code"]: {"code": r["code"], "name": r["name"], "program": r["program"], "semester": r["semester"],
                        "semester_inferred": bool(r["semester_inferred"]), "category": r["category"], "sks": r["sks"],
                        "skills": [s for s in r["skills"] if s in self.skill_names]}
            for r in d["courses"]}
        self.skill_courses: dict[str, list] = {}
        for c in self.courses.values():
            for s in c["skills"]:
                self.skill_courses.setdefault(s, []).append(c["name"])
        self._skill_lc = {}
        for old, new in catalog_db.SKILL_ALIASES.items():      # skills replaced in Tahap 13
            if new in self.skill_names and old not in self.skill_names:
                self._skill_lc[old.lower()] = new
        for s in self.skills:
            self._skill_lc.setdefault(s["skill"].lower(), s["skill"])
            if s["name_id"]:
                self._skill_lc.setdefault(s["name_id"].lower(), s["skill"])

    # case-insensitive lookups used to clean free-text input
    def find_skill(self, text: str) -> str | None:
        return self._skill_lc.get(text.strip().lower())

    def find_interest(self, text: str) -> str | None:
        t = text.strip().lower()
        return next((r["name"] for r in self.interest_rows
                     if r["name"].lower() == t or (r["name_id"] or "").lower() == t), None)

    def find_career(self, text: str) -> str | None:
        t = text.strip().lower()
        exact = next((c.slug for c in self.careers.values()
                      if c.name.lower() == t or c.slug == t or (c.name_id or "").lower() == t), None)
        # "data scientist" also matches "Data Scientist / ML / AI Engineer"
        return exact or next((c.slug for c in self.careers.values()
                              if t in [p.strip().lower() for p in c.name.split("/")]), None)


_store = None


def store() -> Store:
    global _store
    if _store is None:
        _store = Store()
    return _store


def reload():
    global _store
    _store = None
