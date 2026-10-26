"""Academic profile: filled once by the student and reused by every assessment.

Shape (patch 8, flexible input - nothing is limited to the PNJ IT course list):
  courses        list of {id, template, name, category, sks, semester, grade, skills}
                   template = code of a course template (e.g. PNJ TI) -> skills come from the template;
                   template = null -> a course typed by the student, who picks its skills manually
                   (a course without skills is kept but does not change the score)
  self_rated     {skill: beginner|intermediate|advanced}   skills from the dictionary (hard and soft)
  custom_skills  [{name, level}]   skills not in the dictionary: shown and sent to the AI, not scored
  interests      up to 3 free-text interests; text equal to an interest area (EN or ID name) is
                   stored as that area and counts for M, other text is kept but does not count yet
  target_career  {slug} for a career in the catalogue, {name} for free text, or null
  education_level  sma | d3 | d4s1 | s2 - hides reference (O*NET) careers below the matching O*NET Job Zone
                   (validated IT careers are always shown). Default d4s1.

Profiles saved before patch 8 (courses = {code: grade}) are converted when read.
"""
import re

from .data import COURSE_CATEGORIES, GRADE_POINTS, SELF_LEVEL, store

MAX_COURSES = 100
MAX_COURSE_SKILLS = 15
MAX_CUSTOM = 20
MAX_INTERESTS = 3
EDUCATION_MIN_ZONE = {"sma": 1, "d3": 3, "d4s1": 4, "s2": 4}     # O*NET Job Zone 3 = vocational/associate, 4 = bachelor
DEFAULT_EDUCATION = "d4s1"


def _text(v, n):
    return re.sub(r"\s+", " ", str(v or "")).strip()[:n]


def _int(v, lo, hi):
    try:
        v = int(v)
    except (TypeError, ValueError):
        return None
    return v if lo <= v <= hi else None


def clean_courses(raw) -> list:
    st = store()
    if isinstance(raw, dict):                         # old format {code: grade}
        raw = [{"template": k, "grade": v} for k, v in raw.items()]
    out, seen = [], set()
    for i, c in enumerate(raw or []):
        if not isinstance(c, dict):
            continue
        grade = c.get("grade") if c.get("grade") in GRADE_POINTS else None
        tpl = st.courses.get(c.get("template") or "")
        if tpl:
            key = "t:" + tpl["code"]
            item = {"id": tpl["code"], "template": tpl["code"], "name": tpl["name"],
                    "category": c.get("category") if c.get("category") in COURSE_CATEGORIES else tpl["category"],
                    "sks": _int(c.get("sks"), 0, 12) if c.get("sks") is not None else tpl["sks"],
                    "semester": tpl["semester"], "grade": grade, "skills": list(tpl["skills"])}
        else:
            name = _text(c.get("name"), 120)
            if not name:
                continue
            key = "n:" + name.lower()
            skills = []
            for s in c.get("skills") or []:
                s = st.find_skill(str(s))
                if s and s not in skills:
                    skills.append(s)
            item = {"id": _text(c.get("id"), 40) or f"c{i + 1}", "template": None, "name": name,
                    "category": c.get("category") if c.get("category") in COURSE_CATEGORIES else "elective",
                    "sks": _int(c.get("sks"), 0, 12), "semester": _int(c.get("semester"), 1, 14),
                    "grade": grade, "skills": skills[:MAX_COURSE_SKILLS]}
        if key in seen or not item["grade"]:          # only courses with a grade are kept
            continue
        seen.add(key)
        out.append(item)
    return out[:MAX_COURSES]


def clean_skills(self_rated, custom) -> tuple[dict, list]:
    st = store()
    rated, extra = {}, []
    for k, v in (self_rated or {}).items():
        s = st.find_skill(str(k))
        if s and v in SELF_LEVEL:
            rated[s] = v
    for c in custom or []:
        name, lvl = _text((c or {}).get("name"), 60), (c or {}).get("level")
        if not name or lvl not in SELF_LEVEL:
            continue
        s = st.find_skill(name)
        if s:                                         # typed a dictionary skill -> counts as a normal skill
            rated.setdefault(s, lvl)
        elif name.lower() not in {x["name"].lower() for x in extra}:
            extra.append({"name": name, "level": lvl})
    return rated, extra[:MAX_CUSTOM]


def clean_interests(raw) -> list:
    st = store()
    out = []
    for x in raw or []:
        t = _text(x, 60)
        if not t:
            continue
        t = st.find_interest(t) or t
        if t.lower() not in {o.lower() for o in out}:
            out.append(t)
    return out


def clean_target(raw) -> dict | None:
    if not raw:
        return None
    st = store()
    if isinstance(raw, str):
        raw = {"name": raw}
    slug = raw.get("slug") if raw.get("slug") in st.careers else st.find_career(_text(raw.get("name"), 80))
    if slug:
        return {"slug": slug, "name": st.careers[slug].name}
    name = _text(raw.get("name"), 80)
    return {"slug": None, "name": name} if name else None


def normalize(p: dict) -> dict:
    """Clean a stored or submitted profile against the current catalogue."""
    rated, custom = clean_skills(p.get("self_rated"), p.get("custom_skills"))
    return {"courses": clean_courses(p.get("courses")), "self_rated": rated, "custom_skills": custom,
            "interests": clean_interests(p.get("interests"))[:MAX_INTERESTS + 2],
            "target_career": clean_target(p.get("target_career")),
            "education_level": p.get("education_level") if p.get("education_level") in EDUCATION_MIN_ZONE else DEFAULT_EDUCATION}


def complete(p: dict) -> bool:
    return bool(p.get("courses") or p.get("self_rated")) and 1 <= len(p.get("interests", [])) <= MAX_INTERESTS
