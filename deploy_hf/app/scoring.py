"""Deterministic fit score (Bab III, Section 3.5) - same formula as notebook Tahap 10.

  e(s)  = max(course grade / 4, self-rated level 1 / 0.67 / 0.33, confirmed experience = 1)
  K(c)  = sum_{s in R(c)} w(c,s) * e(s) / sum_{s in R(c)} w(c,s)     (R(c): required skills of career c)
  M(c)  = 1 if one of the student's interests is an interest area of career c, else 0
  Fit   = 100 * [alpha * K + (1 - alpha) * M],  alpha = 0.5

Courses may come from a course template (skills verified from the syllabus) or be typed by the
student with manually chosen skills; both give e(s) = grade points / 4 for their skills.
The same input always gives the same ranking.
"""
from .data import GRADE_POINTS, SELF_LEVEL, store
from .profile import DEFAULT_EDUCATION, EDUCATION_MIN_ZONE, clean_courses

ALPHA = 0.5


def fit_label(score) -> str:
    return "strong" if score >= 70 else "good" if score >= 50 else "developing"


def status(e: float) -> str:
    return "met" if e >= 1 else "partly" if e > 0 else "gap"


def evidence(courses, self_rated: dict, experience: list, crosswalk: bool = True) -> dict:
    """{skill: {"e": float, "from": [...]}} keeping the highest evidence per skill.
    `courses` is the profile course list (an old {code: grade} dict is also accepted)."""
    st = store()
    ev = {}

    def add(skill, value, src):
        if skill in st.skill_names:
            cur = ev.setdefault(skill, {"e": 0.0, "from": []})
            cur["from"].append(src)
            cur["e"] = round(max(cur["e"], value), 4)

    for c in clean_courses(courses):
        for s in c["skills"]:
            add(s, GRADE_POINTS[c["grade"]] / 4, {"type": "course", "code": c["id"], "name": c["name"],
                                                  "grade": c["grade"], "category": c["category"]})
    for s, lvl in self_rated.items():
        if lvl in SELF_LEVEL:
            add(s, SELF_LEVEL[lvl], {"type": "self", "level": lvl})
    for s in experience:
        add(s, 1.0, {"type": "experience"})
    # crosswalk: an IT skill also counts for the general (O*NET) elements it is linked to, with the same value
    # Only used for reference (O*NET) careers; validated IT careers use direct evidence only, exactly as
    # evaluated in the notebook (Tahap 10/13).
    for s, cur in (list(ev.items()) if crosswalk else []):
        for el in st.maps_to.get(s, []):
            add(el, cur["e"], {"type": "via", "skill": s})
    return ev


def _career_result(c, ev, courses, interests, alpha, target_slug):
    st = store()
    total_w = sum(c.weights.values())
    e_of = lambda s: ev.get(s, {"e": 0.0})["e"]
    K = sum(w * e_of(s) for s, w in c.weights.items()) / total_w
    M = 1.0 if set(interests) & set(c.interest_areas) else 0.0
    fit = 100 * (alpha * K + (1 - alpha) * M)

    skills = sorted(({"skill": s, "w": w, "demand_pct": c.demand_pct.get(s), "e": e_of(s), "status": status(e_of(s)),
                      "from": ev.get(s, {}).get("from", []),
                      "courses": st.skill_courses.get(s, [])}
                     for s, w in c.weights.items()), key=lambda x: -x["w"])
    matched = sorted((x for x in skills if x["e"] > 0), key=lambda x: -x["w"] * x["e"])
    gaps = sorted((x for x in skills if x["e"] < 1), key=lambda x: (-x["w"] * (1 - x["e"]), x["skill"]))

    # sources: the career's skill profile + the student's courses that teach a required skill of this career
    used = [x for x in courses if GRADE_POINTS.get(x["grade"], 0) > 0 and any(s in c.weights for s in x["skills"])]
    head = {"key": "ads", "n_ads": c.n_ads, "n_skills": len(c.weights)} if c.tier == "validated" else \
        {"key": "reference", "source": c.source, "onet_soc": c.onet_soc, "n_skills": len(c.weights)}
    sources = [head] + [{"key": x["id"], "name": x["name"], "skills": x["skills"], "custom": x["template"] is None}
                        for x in used]
    best = max(used, key=lambda x: GRADE_POINTS[x["grade"]], default=None)
    score = round(fit)
    summary = {"label": fit_label(score),
               "top_matched": [{"skill": x["skill"], "demand_pct": x["demand_pct"]} for x in matched[:3]],
               "best_course": {"code": best["id"], "name": best["name"], "grade": best["grade"]} if best else None,
               "interest_match": bool(M), "to_improve": [x["skill"] for x in gaps[:3]]}

    return {"slug": c.slug, "name": c.name, "name_id": c.name_id, "score": score, "fit": round(fit, 1),
            "K": round(K, 4), "M": M, "graduate_profile": c.graduate_profile, "tier": c.tier,
            "group_code": c.group_code, "job_zone": c.job_zone,
            "interest_areas": c.interest_areas, "n_ads": c.n_ads, "coverage_pct": c.coverage_pct,
            "is_target": c.slug == target_slug,
            "breakdown": {"competency": round(100 * K), "interest": round(100 * M)},
            "skills": skills, "matched": [x["skill"] for x in matched], "gaps": [x["skill"] for x in gaps[:5]],
            "sources": sources, "summary": summary}


def rank(data: dict, alpha: float = ALPHA, tiers=None):
    """Fast ranking of every career: [(career, K, M, fit)], plus the evidence and cleaned courses."""
    courses = clean_courses(data.get("courses"))
    ev = {"direct": evidence(courses, data.get("self_rated", {}), data.get("experience", []), crosswalk=False),
          "crosswalk": evidence(courses, data.get("self_rated", {}), data.get("experience", []))}
    e_of = {k: {s: v["e"] for s, v in x.items()} for k, x in ev.items()}
    interests = set(data.get("interests", []))
    min_zone = EDUCATION_MIN_ZONE.get(data.get("education_level") or DEFAULT_EDUCATION, 1) if tiers is None else 1
    out = []
    for c in store().careers.values():
        if tiers and c.tier not in tiers:
            continue
        if c.job_zone and c.job_zone < min_zone and c.slug != (data.get("target_career") or {}).get("slug"):
            continue                                 # below the student's education level (O*NET Job Zone)
        e = e_of["direct" if c.tier == "validated" else "crosswalk"]
        K = sum(w * e.get(s, 0.0) for s, w in c.weights.items()) / sum(c.weights.values())
        M = 1.0 if interests & set(c.interest_areas) else 0.0
        out.append((c, K, M, 100 * (alpha * K + (1 - alpha) * M)))
    out.sort(key=lambda x: (-x[3], -x[1], x[0].name))   # exact scores, ties by name (as in notebook Tahap 10/13)
    return out, ev, courses


def recommend(data: dict, alpha: float = ALPHA, tiers=None, top: int | None = None) -> list[dict]:
    """Full result rows, best first. With `top`, only the best `top` careers (+ the target career) are detailed.
    Each row carries its overall rank."""
    ranked, ev, courses = rank(data, alpha, tiers)
    target = (data.get("target_career") or {}).get("slug")
    rows = []
    for i, (c, *_rest) in enumerate(ranked):
        if top is None or i < top or c.slug == target:
            rows.append({**_career_result(c, ev["direct" if c.tier == "validated" else "crosswalk"], courses, data.get("interests", []), alpha, target), "rank": i + 1})
    return rows
