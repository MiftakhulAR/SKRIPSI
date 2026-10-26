"""Prompts for the LLM tasks of the web app.

1. explain(): explanation of one recommended career, 4 sections: basis_of_fit, matched_competencies,
   competencies_to_improve, development_advice.
   - Validated IT careers (15): prompt v1 of notebook Tahap 12 (artifacts/prompts_v1.json) with the same
     SYSTEM DATA fields and, in RAG mode, the passages retrieved by rag.py (same retriever and tau).
     mode "non_rag" sends the same prompt with "(no passages)" - the comparison condition of Tahap 12.
   - Reference careers (O*NET): there are no knowledge-base passages for them, so the explanation is
     written from system data only (EXPLAIN_SYSTEM below).
   Every explanation is checked by claims.py.
2. ask(): chat answer about careers/skills/courses, citing numbered context blocks [n]; knowledge-base
   passages retrieved for the question are added as extra blocks.
3. ask_admin(): the same chat for the admin web, over usage/feedback statistics instead of one student's data.
"""
import json
import re
from functools import lru_cache
from pathlib import Path

from . import claims, llm, rag
from .data import store
from .profile import clean_courses
from .scoring import evidence

PROMPTS_FILE = Path(__file__).resolve().parent.parent / "artifacts" / "prompts_v1.json"
BAGIAN = claims.BAGIAN
LANG_PROMPT = {"en": "English", "id": "Indonesian"}


@lru_cache(maxsize=1)
def prompts() -> dict:
    """Prompt v1 exactly as saved by notebook Tahap 12 (Cell 12)."""
    return json.loads(PROMPTS_FILE.read_text(encoding="utf-8"))

LANG_NAME = {"en": "English", "id": "Bahasa Indonesia (formal, baku)"}


def _career_data(r: dict, profile_input: dict) -> dict:
    st = store()
    matched = [{"skill": s["skill"], "evidence": s["e"], "share_of_job_ads_pct": s["demand_pct"],
                "evidence_from": s["from"]} for s in r["skills"] if s["e"] > 0]
    gaps = [{"skill": s["skill"], "evidence": s["e"], "share_of_job_ads_pct": s["demand_pct"],
             "courses_that_teach_it": s["courses"]} for s in r["skills"] if s["e"] < 1][:5]
    return {
        "career": r["name"], "fit_score_0_100": r["fit"], "competency_match_K_pct": round(100 * r["K"], 1),
        "interest_match": bool(r["M"]), "career_interest_areas": r["interest_areas"],
        "student_interest_areas": profile_input.get("interests", []),
        "job_ads_analysed": r["n_ads"], "required_skills_count": len(r["skills"]),
        "pnj_graduate_profile_career": r["graduate_profile"],
        "career_profile_source": ("Indonesian IT job ads (validated in this research)" if r.get("tier", "validated") == "validated"
                                  else f"reference profile ({st.careers[r['slug']].source if r['slug'] in st.careers else 'reference'}), "
                                       "not validated against Indonesian job ads"),
        "is_student_target_career": bool(r.get("is_target")),
        "student_target_career": (profile_input.get("target_career") or {}).get("name"),
        "competencies_matched": matched, "competencies_to_improve": gaps,
        "student_courses_with_grades": [{"course": c["name"], "grade": c["grade"], "group": c["category"]}
                                        for c in clean_courses(profile_input.get("courses"))],
        "student_skills_not_in_dictionary": profile_input.get("custom_skills", []),
        "student_experience_note": profile_input.get("notes", "")[:500],
    }


EXPLAIN_SYSTEM = """You explain a career recommendation to a student or graduate (the case study is D4 Informatics,
Politeknik Negeri Jakarta, but the user may come from another field).
The ranking was computed by a fixed formula; you do NOT re-rank or judge it.
Use ONLY facts in the DATA block. Do not invent skills, courses, percentages, certifications or companies.
Write in {lang}. Address the student as "you" (EN) or "kamu" (ID). Be specific and concise.
Return a JSON object with exactly these keys, each a list of 1-4 short statements (strings):
  "basis_of_fit", "matched_competencies", "competencies_to_improve", "development_advice".
Mention percentages exactly as given (share of job ads); if share_of_job_ads_pct is null, do not mention any
percentage. If career_profile_source says "reference profile", say once that the required skills come from a
reference profile, not from Indonesian job ads. For development_advice, only name courses listed in
courses_that_teach_it; otherwise give general learning steps without naming a course."""


def explain(result_row: dict, profile_input: dict, lang: str) -> tuple[dict, str]:
    data = _career_data(result_row, profile_input)
    mock = {"basis_of_fit": [f"[mock] {data['career']}: fit {data['fit_score_0_100']}."],
            "matched_competencies": [m["skill"] for m in data["competencies_matched"][:3]] or ["-"],
            "competencies_to_improve": [g["skill"] for g in data["competencies_to_improve"][:3]] or ["-"],
            "development_advice": ["[mock] advice"]}
    out, model = llm.chat_json(EXPLAIN_SYSTEM.format(lang=LANG_NAME[lang]),
                               "DATA:\n" + json.dumps(data, ensure_ascii=False, indent=1), mock)
    keys = ["basis_of_fit", "matched_competencies", "competencies_to_improve", "development_advice"]
    clean = {k: [str(x) for x in (out.get(k) or []) if str(x).strip()][:4] for k in keys}
    if not any(clean.values()):
        raise llm.LLMError("bad_output")
    clean["complete"] = all(clean[k] for k in keys)
    return clean, model


# ---------- explanation v1 (validated careers, RAG / non-RAG) ----------
def _cocok_gap(r: dict) -> tuple[list, list]:
    """Required skills by weight (as in the notebook): matched = evidence e > 0, gap = e < 1.
    A partly evidenced skill (e.g. self-rated beginner) is in both lists."""
    skills = sorted(r["skills"], key=lambda x: -x["w"])
    return [x["skill"] for x in skills if x["e"] > 0], [x["skill"] for x in skills if x["e"] < 1]


def data_sistem(r: dict) -> dict:
    """SYSTEM DATA block - same fields and order as notebook Tahap 12 data_sistem()."""
    st = store()
    c = st.careers[r["slug"]]
    cocok, gap = _cocok_gap(r)
    return {"career": c.name, "graduate_profile_career": bool(c.graduate_profile),
            "fit_score_0_100": r["fit"], "job_ads_analysed_for_career": int(c.n_ads or 0),
            "curriculum_coverage_percent": float(c.coverage_pct) if c.coverage_pct is not None else None,
            "matched_skills": [{"skill": s, "percent_of_ads_requesting": c.demand_pct.get(s)} for s in cocok],
            "skill_gaps": [{"skill": s, "percent_of_ads_requesting": c.demand_pct.get(s),
                            "taught_in_pnj_courses": st.skill_courses.get(s, [])} for s in gap[:5]]}


def pesan(data: dict, passages: list, lang: str) -> str:
    teks_p = "\n".join(f"[{p['chunk_id']}] {p['teks'][:1500]}" for p in passages) if passages else "(no passages)"
    return (f"Language: {LANG_PROMPT[lang]}\n\nSYSTEM DATA:\n{json.dumps(data, ensure_ascii=False, indent=1)}"
            f"\n\nPASSAGES:\n{teks_p}")


def _mock_v1(d: dict, ids: list) -> dict:
    m, g = d["matched_skills"][:2], d["skill_gaps"][:3]
    return {"basis_of_fit": [{"statement": f"[mock] {d['career']} fits with a score of {d['fit_score_0_100']}.", "sources": ["DATA"]}]
            + ([{"statement": "[mock] The occupation standard describes this work.", "sources": ids[:1]}] if ids else []),
            "matched_competencies": [{"statement": f"You already have {x['skill']}.", "sources": ["DATA"]} for x in m],
            "competencies_to_improve": [{"statement": f"Improve {x['skill']}.", "sources": ["DATA"]} for x in g],
            "development_advice": [{"statement": "[mock] Practise with a small project.", "sources": ["DATA"]}]}


def _norm_sections(out: dict) -> dict:
    """[{statement, sources}] (prompt v1) or [str] (system-data prompt) -> [{text, sources}]."""
    res = {}
    for b in BAGIAN:
        items = []
        for it in out.get(b) or []:
            if isinstance(it, dict):
                t, src = str(it.get("statement", "")).strip(), [str(x) for x in (it.get("sources") or [])]
            else:
                t, src = str(it).strip(), ["DATA"]
            if t:
                items.append({"text": t, "sources": src})
        res[b] = items
    return res


def explain_v2(r: dict, profile_input: dict, lang: str, mode: str = "rag") -> dict:
    """Explanation + passages + claim check. mode: rag | non_rag (validated careers); reference careers
    always use system data only."""
    st = store()
    c = st.careers.get(r["slug"])
    if c is None:
        raise llm.LLMError("bad_output")
    kb = rag.get()
    cocok, gap = _cocok_gap(r)
    # S = every skill the student has evidence for (direct evidence, as for validated careers)
    S = set(evidence(profile_input.get("courses"), profile_input.get("self_rated", {}),
                     profile_input.get("experience", []), crosswalk=False)) | {x["skill"] for x in r["skills"] if x["e"] > 0}
    passages, used_mode = [], "system_data"
    if c.tier == "validated":
        P = prompts()
        if mode == "rag" and kb:
            passages = kb.for_career(c.name, cocok, gap)
        used_mode = "rag" if (mode == "rag" and kb) else "non_rag"
        d = data_sistem(r)
        out, model = llm.chat_json(P["sistem_penjelasan"], pesan(d, passages, lang),
                                   _mock_v1(d, [p["chunk_id"] for p in passages]), schema=P["skema_penjelasan"], exact=True)
        prompt_version, evaluated = P["prompt_versi"], model in (P["model"], "mock")
    else:
        out, model = explain(r, profile_input, lang)
        prompt_version, evaluated = "system-data-1", False
    sections = _norm_sections(out)
    if not any(sections.values()):
        raise llm.LLMError("bad_output")
    ids = [p["chunk_id"] for p in passages]
    check = claims.check(sections, ids, c, S, set(cocok), gap, r["fit"], kb)
    num = {cid: i + 1 for i, cid in enumerate(ids)}
    for b in BAGIAN:                                   # passage ids -> [1], [2] ... for the page
        for it, chk in zip(sections[b], check["per_statement"][b]):
            it["cites"] = [num[s] for s in it["sources"] if s in num]
            it["data"] = "DATA" in it["sources"]
            it["unsupported"] = chk["unsupported"]
            it["checked"] = chk["claims"] > 0
    del check["per_statement"]
    return {**sections, "complete": check["complete"], "mode": used_mode, "requested_mode": mode,
            "kb_layer": kb.layer if (kb and used_mode == "rag") else None,
            "kb_ready": bool(kb), "tier": c.tier, "prompt_version": prompt_version, "evaluated_config": evaluated,
            "passages": [rag.public_passage(p, i + 1, lang) for i, p in enumerate(passages)],
            "check": check, "model": model}


ASK_SYSTEM = """You are CareerAI, a career assistant. The case study is D4 Informatics at Politeknik Negeri Jakarta,
but users may come from other fields (e.g. accounting).
Answer the student's question using ONLY the numbered CONTEXT blocks. Cite the blocks you use as [1], [2] ...
right after the sentence they support. If the context does not contain the answer, say so briefly and suggest
what the student can check in the app (Explore Careers, My Recommendations, My Profile). Do not invent courses,
skills, numbers, companies or salaries. Recommendations come from the fixed formula in block [1]; do not change them.
Write in {lang}, 3-8 sentences, plain text (no markdown tables).
Return JSON: {{"answer": "<text with [n] citations>", "sources": [<numbers of blocks cited>]}}"""

BLOCK_TITLES = {
    "en": ["Your latest assessment result", "Your profile", "Career catalogue (required skills)", "Course templates – skill mapping"],
    "id": ["Hasil asesmen terakhirmu", "Profilmu", "Katalog karier (skill yang dibutuhkan)", "Templat mata kuliah – pemetaan skill"],
}


def _ask_context(latest: dict | None, profile: dict) -> list:
    st = store()
    blocks = []
    if latest:
        rows = latest["results"]
        blocks.append({"top_careers": [{"rank": i + 1, "career": r["name"], "fit": r["fit"], "K_pct": round(100 * r["K"], 1),
                                        "interest_match": bool(r["M"]),
                                        "matched": [s["skill"] for s in r["skills"] if s["e"] > 0][:8],
                                        "to_improve": [s["skill"] for s in r["skills"] if s["e"] < 1][:5]}
                                       for i, r in enumerate(rows[:5])],
                       "assessment_date": latest["created_at"]})
    else:
        blocks.append({"note": "The student has not taken an assessment yet."})
    blocks.append({"courses_with_grades": [{"course": c["name"], "grade": c["grade"], "group": c["category"], "sks": c["sks"],
                                            "skills": c["skills"]} for c in clean_courses(profile.get("courses"))],
                   "self_rated_skills": profile.get("self_rated", {}),
                   "skills_not_in_dictionary": profile.get("custom_skills", []),
                   "interests": profile.get("interests", []),
                   "target_career": (profile.get("target_career") or {}).get("name")})
    # only the careers that matter for this student (the catalogue has ~900): validated IT careers,
    # the latest top 10 and the target career
    keep = {c.slug for c in st.careers.values() if c.tier == "validated"}
    keep |= {r["slug"] for r in (latest or {}).get("results", [])[:10]}
    keep |= {(profile.get("target_career") or {}).get("slug")}
    blocks.append([{"career": c.name, "profile_source": "Indonesian job ads" if c.tier == "validated" else (c.source or "reference"),
                    "job_ads": c.n_ads or None, "interest_areas": c.interest_areas,
                    "pnj_graduate_profile": c.graduate_profile, "curriculum_coverage_pct": c.coverage_pct,
                    "top_skills": {s: c.demand_pct.get(s) for s, _ in sorted(c.weights.items(), key=lambda x: -x[1])[:8]}}
                   for c in st.careers.values() if c.slug in keep])
    blocks.append([{"course": v["name"], "code": k, "programme": v["program"], "semester": v["semester"], "skills": v["skills"]}
                   for k, v in st.courses.items()])
    return blocks


KB_NOTE = ("Blocks titled \"Knowledge base\" are passages retrieved from competency standards (SKKNI), the national "
           "occupation map, career profiles from job ads and, on the internal layer, PNJ course documents.")


def _question_careers(question: str, latest: dict | None, profile: dict) -> list[str]:
    """Validated careers the question is about: named in the question, else the latest top 3 + target career."""
    st = store()
    val = [c for c in st.careers.values() if c.tier == "validated"]
    ql = question.lower()
    named = [c.name for c in val if c.name.lower() in ql or any(p.strip().lower() in ql for p in c.name.split("/") if len(p.strip()) > 3)]
    if named:
        return named
    keep = [r["slug"] for r in (latest or {}).get("results", [])[:3]] + [(profile.get("target_career") or {}).get("slug")]
    return [st.careers[s].name for s in keep if s in st.careers and st.careers[s].tier == "validated"]


def _with_passages(blocks: list, titles: list, question: str, careers: list | None) -> tuple[str, list, list]:
    kb = rag.get()
    passages = kb.for_question(question, careers) if kb else []
    ctx = [f"[{i + 1}] {t}\n{json.dumps(b, ensure_ascii=False)}" for i, (t, b) in enumerate(zip(titles, blocks))]
    ctx += [f"[{len(blocks) + j + 1}] Knowledge base: {p['judul']}\n{p['teks'][:1200]}" for j, p in enumerate(passages)]
    return "\n\n".join(ctx), passages, ([KB_NOTE] if passages else [])


def _sources(out: dict, answer: str, titles: list, passages: list, lang: str) -> list:
    n_all = len(titles) + len(passages)
    used = {int(n) for n in out.get("sources", []) if str(n).isdigit() and 1 <= int(n) <= n_all}
    used |= {int(n) for n in re.findall(r"\[(\d+)\]", answer) if 1 <= int(n) <= n_all}
    res = []
    for n in sorted(used):
        if n <= len(titles):
            res.append({"n": n, "title": titles[n - 1], "access": "system", "type": "system"})
        else:
            res.append(rag.public_passage(passages[n - len(titles) - 1], n, lang))
    return res


def ask(question: str, history: list, latest: dict | None, profile: dict, lang: str) -> tuple[dict, str]:
    blocks = _ask_context(latest, profile)
    ctx, passages, note = _with_passages(blocks, BLOCK_TITLES["en"], question, _question_careers(question, latest, profile))
    convo = "".join(f"{m['role'].upper()}: {m['text'][:600]}\n" for m in history[-6:])
    user = f"CONTEXT:\n{ctx}\n\nCONVERSATION SO FAR:\n{convo or '-'}\n\nQUESTION: {question}"
    mock = {"answer": f"[mock] {question} [1] [3]" + (f" [{len(blocks) + 1}]" if passages else ""),
            "sources": [1, 3] + ([len(blocks) + 1] if passages else [])}
    out, model = llm.chat_json(" ".join([ASK_SYSTEM.format(lang=LANG_NAME[lang]), *note]), user, mock)
    answer = str(out.get("answer", "")).strip()
    if not answer:
        raise llm.LLMError("bad_output")
    return {"answer": answer, "sources": _sources(out, answer, BLOCK_TITLES[lang], passages, lang),
            "mode": "rag" if passages else "system_data", "passages_retrieved": len(passages)}, model


ADMIN_ASK_SYSTEM = """You are CareerAI, an assistant for the administrator of the CareerAI app (D4 Informatics,
Politeknik Negeri Jakarta). Answer the admin's question using ONLY the numbered CONTEXT blocks. Cite the blocks you use
as [1], [2] ... right after the sentence they support. If the context does not contain the answer, say so briefly and
suggest which admin page to check (Knowledge Base, Career Catalogue, User Feedback, Settings). Do not invent courses,
skills, numbers, users or documents. Recommendations come from a fixed formula; do not change or re-rank them.
Write in {lang}, 3-8 sentences, plain text (no markdown tables).
Return JSON: {{"answer": "<text with [n] citations>", "sources": [<numbers of blocks cited>]}}"""

ADMIN_BLOCK_TITLES = {
    "en": ["Usage and user feedback statistics", "Validated IT careers (required skills)", "Course templates – skill mapping",
           "Knowledge-base documents"],
    "id": ["Statistik penggunaan dan umpan balik pengguna", "Karier TI tervalidasi (skill yang dibutuhkan)",
           "Templat mata kuliah – pemetaan skill", "Dokumen basis pengetahuan"],
}


def ask_admin(question: str, history: list, feedback: dict, docs: list, lang: str) -> tuple[dict, str]:
    st = store()
    student_blocks = _ask_context(None, {})          # validated careers and course mapping, same as for students
    tiers = [c.tier for c in st.careers.values()]
    blocks = [{k: feedback[k] for k in ("users", "assessments", "ratings", "mean_top3", "n_top3", "per_career")}
              | {"recent_ratings": feedback["recent"][:10], "rating_scale": "1-5",
                 "catalogue_size": {t: tiers.count(t) for t in sorted(set(tiers))}},
              student_blocks[2], student_blocks[3],
              [{k: d.get(k) for k in ("title", "doc_type", "format", "year", "access", "status", "chunks", "updated")} for d in docs]]
    st_val = [c.name for c in st.careers.values() if c.tier == "validated" and c.name.lower() in question.lower()]
    ctx, passages, note = _with_passages(blocks, ADMIN_BLOCK_TITLES["en"], question, st_val or None)
    convo = "".join(f"{m['role'].upper()}: {m['text'][:600]}\n" for m in history[-6:])
    user = f"CONTEXT:\n{ctx}\n\nCONVERSATION SO FAR:\n{convo or '-'}\n\nQUESTION: {question}"
    mock = {"answer": f"[mock] {question} [1] [2]", "sources": [1, 2]}
    out, model = llm.chat_json(" ".join([ADMIN_ASK_SYSTEM.format(lang=LANG_NAME[lang]), *note]), user, mock)
    answer = str(out.get("answer", "")).strip()
    if not answer:
        raise llm.LLMError("bad_output")
    return {"answer": answer, "sources": _sources(out, answer, ADMIN_BLOCK_TITLES[lang], passages, lang),
            "mode": "rag" if passages else "system_data", "passages_retrieved": len(passages)}, model
