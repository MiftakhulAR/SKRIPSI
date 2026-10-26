"""Automatic claim checker for an explanation - port of notebook Tahap 12, Cell 9 (corrected version, 19 Okt 2026).

Checked claims per statement: (a) skill status, (b) percentages / number of job ads, (c) PNJ courses,
(d) SKKNI numbers and unit codes, (e) passage citations. A statement with none of these is "not checkable".
Claims are compared with the SYSTEM DATA of the web (scores, required skills, course mapping) - not with
the passage text, the same limitation as in the notebook.

Differences from the notebook, written in Bab III/IV:
- skill patterns come from the skill dictionary v4 (Tahap 13, = v3 + soft skills); the notebook used v3;
- the student's skills S = skills with evidence e > 0 (course grade, self-rating or experience); in the notebook
  S came from a job ad (e = 0 or 1);
- course names = course templates in the web catalogue.
"""
import csv
import re
from functools import lru_cache
from pathlib import Path

from .data import store

BAGIAN = ["basis_of_fit", "matched_competencies", "competencies_to_improve", "development_advice"]
KODE_UNIT = re.compile(r"\b(J\.\d{6}\.\d{3}\.\d{2}|[JK]\.\d{2}[A-Z0-9]{3}\d{2}\.\d{2,3}\.\d|ICA[A-Z]{3}\d{3}[A-Z]?|ICT[A-Z]{3}\d{3}[A-Z]?|TIK\.[A-Z]{3}\d{4}|\d{6}(?= -))")
SKKNI_NO = re.compile(r"SKKNI\s*(?:No\.?\s*|Number\s*)?(\d{1,3})\s*/\s*(\d{4})", re.I)
PERSEN_RE = re.compile(r"(\d{1,3}(?:[.,]\d)?)\s?%")
JUMLAH_IKLAN = re.compile(r"(\d[\d,.]*)\s+(?:job\s+)?(?:advertisements|ads|iklan|lowongan)", re.I)
MK_SEBUT = re.compile(r"(?:course|courses|mata kuliah)\s+(?:on |in |called |titled )?[\"'“‘]?([A-Z][A-Za-z&/+\- ]{3,50})", re.U)
ARTIFACTS = Path(__file__).resolve().parent.parent / "artifacts"


@lru_cache(maxsize=1)
def _patterns() -> dict:
    out = {}
    for f in ("kamus_skill_v4.csv", "kamus_skill_v3.csv"):
        p = ARTIFACTS / f
        if p.exists():
            for r in csv.DictReader(open(p, encoding="utf-8")):
                if r.get("pola"):
                    out.setdefault(r["skill"], re.compile(r["pola"], re.I))
    return out


class _Lexicon:
    """Skill / career / course names of the current catalogue (rebuilt when the catalogue changes)."""

    def __init__(self, st):
        self.skills = [s["skill"] for s in st.skills]
        self.soft = {s["skill"] for s in st.skills if s["kind"] == "soft"}
        pol = _patterns()
        self.pola = {s: pol.get(s) for s in self.skills}
        self.nama = {s: re.compile(r"(?<![A-Za-z0-9])" + re.escape(s) + r"(?![A-Za-z0-9])", 0 if len(s) <= 3 else re.I)
                     for s in self.skills}
        self.order = sorted(self.skills, key=len, reverse=True)
        self.careers = [c.name for c in st.careers.values() if c.tier == "validated"]
        self.mk_norm = {v["name"].lower(): v["name"] for v in st.courses.values()}
        self.mk_skill: dict[str, set] = {}
        for v in st.courses.values():
            self.mk_skill.setdefault(v["name"], set()).update(v["skills"])


_lex: tuple | None = None


def _lexicon() -> _Lexicon:
    global _lex
    st = store()
    if _lex is None or _lex[0] is not st:
        _lex = (st, _Lexicon(st))
    return _lex[1]


def skill_disebut(teks: str) -> list[str]:
    L = _lexicon()
    for c in L.careers:                               # a career name is not a skill claim
        teks = re.sub(re.escape(c).replace(r"\ /\ ", r"\s*/\s*"), " ", teks, flags=re.I)
    terpakai, hasil = [], set()                       # longer skill names first ("React Native" before "React")
    for s in L.order:
        ms = list(L.pola[s].finditer(teks)) if L.pola[s] else []
        for m in [*ms, *L.nama[s].finditer(teks)]:
            if not any(a <= m.start() and m.end() <= b for a, b in terpakai):
                terpakai.append((m.start(), m.end()))
                hasil.add(s)
                break
    return [s for s in L.skills if s in hasil]


def check(sections: dict, passage_ids: list, career, S: set, cocok: set, gap: list, fit: float, kb=None) -> dict:
    """sections: {bagian: [{"text", "sources"}]}. Returns totals and, per statement, the unsupported claims."""
    L = _lexicon()
    W = career.weights
    gap_set = set(gap)
    nilai_ok = {round(v, 1) for v in career.demand_pct.values() if v is not None} | {float(fit)}
    if career.coverage_pct is not None:
        nilai_ok.add(float(career.coverage_pct))
    units = kb.unit_codes if kb else set()
    skkni = kb.skkni_numbers if kb else set()
    klaim, tak, sitasi_salah, per = [], 0, 0, {}
    for bag in BAGIAN:
        per[bag] = []
        for it in sections.get(bag, []):
            t, n0 = it.get("text", ""), len(klaim)
            bad_src = [s for s in it.get("sources", []) if s != "DATA" and s not in passage_ids]
            sitasi_salah += len(bad_src)
            sk = skill_disebut(t)
            for s in sk:                                                         # (a) skill status
                ok = (s in cocok or s in S) if bag == "matched_competencies" else \
                     (s in gap_set) if bag == "competencies_to_improve" else (s in S or s in W or s in L.soft)
                klaim.append(("skill", bag, s, ok))
            for x in PERSEN_RE.findall(t):                                       # (b) percentages
                v = float(x.replace(",", "."))
                klaim.append(("angka", bag, f"{v}%", any(abs(v - o) <= 0.6 for o in nilai_ok)))
            for x in JUMLAH_IKLAN.findall(t):
                v = int(re.sub(r"[,.]", "", x) or 0)
                klaim.append(("angka", bag, f"{v} ads", abs(v - int(career.n_ads or -9)) <= 1))
            for x in MK_SEBUT.findall(t):                                        # (c) courses
                nama = next((L.mk_norm[m] for m in L.mk_norm if x.lower().startswith(m)), None)
                ok = nama is not None and (not sk or bool(L.mk_skill.get(nama, set()) & set(sk)))
                klaim.append(("course", bag, x.strip(), ok))
            for m in L.mk_norm:                                                  # course named without "course"
                if m in t.lower() and not any(k[0] == "course" and k[2].lower().startswith(m) for k in klaim[n0:]):
                    klaim.append(("course", bag, L.mk_norm[m], not sk or bool(L.mk_skill.get(L.mk_norm[m], set()) & set(sk))))
            for a, b in SKKNI_NO.findall(t):                                     # (d) standards and units
                klaim.append(("standard", bag, f"SKKNI {a}/{b}", (int(a), b) in skkni))
            for kd in KODE_UNIT.findall(t):
                klaim.append(("standard", bag, kd, kd in units))
            mine = klaim[n0:]
            if not mine:
                tak += 1
            per[bag].append({"claims": len(mine), "unsupported": [f"{k[0]}:{k[2]}" for k in mine if not k[3]],
                             "invalid_sources": bad_src})
    n = len(klaim)
    ok = sum(k[3] for k in klaim)
    tulis_gap = {k[2] for k in klaim if k[0] == "skill" and k[1] == "competencies_to_improve"}
    return {"claims": n, "supported": ok, "support": round(ok / n, 3) if n else None, "not_checkable": tak,
            "invalid_citations": sitasi_salah, "complete": all(sections.get(b) for b in BAGIAN),
            "gap_ok": tulis_gap <= gap_set and set(gap[:3]) <= tulis_gap,
            "unsupported": [f"{k[0]}:{k[2]}" for k in klaim if not k[3]], "per_statement": per}
