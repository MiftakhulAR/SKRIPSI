"""CareerAI API (FastAPI). The Next.js frontend calls these endpoints.

Run:  uvicorn app.main:app --reload --port 8000     Docs: http://localhost:8000/docs

Access:
  public   - /api/meta, /api/careers, /api/auth/*
  student  - own assessments, ratings, /api/ask
  admin    - /api/kb, /api/admin/*
"""
import os
import re
import uuid
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")       # API keys live in backend/.env (git-ignored)

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import assistant, auth, catalog_db, db, extract, llm, rag
from . import profile as prof
from .data import COURSE_CATEGORIES, GRADE_POINTS, SELF_LEVEL, SKILL_KINDS, TIERS, reload, slugify, store
from .scoring import ALPHA, rank, recommend

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
ALLOWED_EXT = {".pdf", ".docx", ".csv", ".txt", ".md"}
MAX_INTERESTS = prof.MAX_INTERESTS
TOP_STORE = 30          # careers kept per assessment (the rest are only ranked; the catalogue has ~900 careers)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

app = FastAPI(title="CareerAI API", version="0.4.0 (P2, flexible catalogue)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("FRONTEND_ORIGINS", "").split(",") if o.strip()],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",   # any local dev port (3000, 3001, ...)
    allow_methods=["GET", "POST", "DELETE"], allow_headers=["*"],
)
db.init()
catalog_db.init()


@app.on_event("startup")
def _warm_kb():
    """Load the knowledge base and the embedding model in the background, so the first explanation is fast."""
    import threading

    def warm():
        kb = rag.get()
        if kb:
            kb.embedder.encode(["warm-up"], kb.cfg["prefix_query"])
            print("[RAG] ready", flush=True)
    threading.Thread(target=warm, daemon=True).start()


# ---------- models ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(max_length=120)
    password: str = Field(min_length=8, max_length=128)
    status: str | None = Field(None, max_length=20)      # student / graduate
    cohort: str | None = Field(None, max_length=10)      # angkatan, e.g. 2022
    consent: bool


class LoginIn(BaseModel):
    email: str
    password: str


class AccountIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(max_length=120)
    status: str | None = Field(None, max_length=20)
    cohort: str | None = Field(None, max_length=10)


class CourseIn(BaseModel):
    id: str | None = Field(None, max_length=40)
    template: str | None = Field(None, max_length=40, description="course template code; null = typed by the student")
    name: str | None = Field(None, max_length=120)
    category: str | None = Field(None, description="university | faculty | program | elective")
    sks: int | None = Field(None, ge=0, le=12)
    semester: int | None = Field(None, ge=1, le=14)
    grade: str | None = None
    skills: list[str] = Field(default_factory=list, max_length=30)


class CustomSkillIn(BaseModel):
    name: str = Field(max_length=60)
    level: str


class TargetIn(BaseModel):
    slug: str | None = None
    name: str | None = Field(None, max_length=80)


class ProfileIn(BaseModel):
    """Filled once and edited on the Profile page; reused by every assessment.
    Each part can be saved on its own: a field left out (null) keeps its saved value."""
    courses: list[CourseIn] | None = None
    self_rated: dict[str, str] | None = Field(None, description="skill -> beginner|intermediate|advanced")
    custom_skills: list[CustomSkillIn] | None = Field(None, max_length=40)
    interests: list[str] | None = Field(None, max_length=10)
    target_career: TargetIn | None = None
    clear_target: bool = False
    education_level: str | None = Field(None, pattern="^(sma|d3|d4s1|s2)$")


class PasswordIn(BaseModel):
    current: str
    new: str = Field(min_length=8, max_length=128)


class AssessmentIn(BaseModel):
    """Filled at every assessment: experience only (the rest comes from the profile)."""
    experience: list[str] = Field(default_factory=list, description="skills used in internship/job/project")
    notes: str = Field("", max_length=extract.MAX_TEXT, description="experience story (FR4)")
    suggested: list[str] = Field(default_factory=list, max_length=200,
                                 description="skills the FR4 extractor suggested from the story (accepted or not)")


class ExtractIn(BaseModel):
    text: str = Field(min_length=1, max_length=extract.MAX_TEXT)


class RatingIn(BaseModel):
    career: str
    value: int = Field(ge=1, le=5)


class ChatTurn(BaseModel):
    role: str = Field(pattern="^(user|ai)$")
    text: str = Field(max_length=4000)


class AskIn(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)
    lang: str = Field("en", pattern="^(en|id)$")


class ExplainIn(BaseModel):
    career: str
    lang: str = Field("en", pattern="^(en|id)$")
    refresh: bool = False
    mode: str = Field("rag", pattern="^(rag|non_rag)$", description="non_rag = comparison condition of Tahap 12")


# "Compare without knowledge base" button on the explanation card. RAG_COMPARE=0 hides it for students
# (e.g. during the user evaluation); admins can always use it.
RAG_COMPARE = os.environ.get("RAG_COMPARE", "1") != "0"
EXPLAIN_VERSION = "v2"       # cache key part: explanations made before patch 11 are not reused


class PreviewIn(BaseModel):
    experience: list[str] = Field(default_factory=list)


# ---------- public ----------
@app.get("/api/health")
def health():
    st = store()
    return {"ok": True, "careers": len(st.careers), "skills": len(st.skills), "courses": len(st.courses)}


@app.get("/api/meta")
def meta():
    st = store()
    by_cat: dict[str, list] = {}
    for s in st.skills:
        by_cat.setdefault(s["category"], []).append(s["skill"])
    courses = sorted(st.courses.values(), key=lambda c: (c["program"] or "", c["semester"] or 99, c["code"]))
    return {"courses": courses, "course_categories": COURSE_CATEGORIES, "grades": list(GRADE_POINTS),
            "grade_points": GRADE_POINTS, "levels": list(SELF_LEVEL), "skills_by_category": by_cat,
            "soft_skills": [s["skill"] for s in st.skills if s["kind"] == "soft"],
            "skill_labels": {s["skill"]: s["name_id"] for s in st.skills if s["name_id"]},
            "skill_sources": {s["skill"]: s["source"] for s in st.skills if s["source"]},
            "interest_areas": st.interest_areas,
            "interest_labels": {r["name"]: r["name_id"] for r in st.interest_rows if r["name_id"]},
            "interest_sources": {r["name"]: r.get("source") or "admin" for r in st.interest_rows},
            "groups": [{"code": g["code"], "name": g["name"], "name_id": g["name_id"]} for g in st.groups.values()],
            "careers": [{"slug": c.slug, "name": c.name, "name_id": c.name_id, "tier": c.tier} for c in st.careers.values()],
            "max_interests": MAX_INTERESTS, "alpha": ALPHA}


def _top_pct(c):
    order = sorted(c.weights, key=lambda s: -(c.demand_pct.get(s) if c.demand_pct.get(s) is not None else c.weights[s] * 100))
    return [{"skill": s, "demand_pct": c.demand_pct.get(s), "w": c.weights[s]} for s in order[:5]]


@app.get("/api/careers")
def careers():
    return [{"slug": c.slug, "name": c.name, "graduate_profile": c.graduate_profile, "interest_areas": c.interest_areas,
             "tier": c.tier, "source": c.source, "name_id": c.name_id, "group_code": c.group_code, "job_zone": c.job_zone,
             "n_ads": c.n_ads, "n_required": len(c.weights), "coverage_pct": c.coverage_pct,
             "top_skills": [s for s, _ in sorted(c.weights.items(), key=lambda x: -x[1])[:5]],
             "top_skill_pct": _top_pct(c), "skills": sorted(c.weights)}
            for c in store().careers.values()]


@app.get("/api/careers/{slug}")
def career_detail(slug: str):
    st = store()
    c = st.careers.get(slug)
    if not c:
        raise HTTPException(404, "career not found")
    req = [{"skill": s, "w": w, "demand_pct": c.demand_pct.get(s),
            "courses": [x["name"] for x in st.courses.values() if s in x["skills"]]}
           for s, w in sorted(c.weights.items(), key=lambda x: -x[1])]
    return {"slug": c.slug, "name": c.name, "graduate_profile": c.graduate_profile, "interest_areas": c.interest_areas,
            "onet_soc": c.onet_soc, "tier": c.tier, "source": c.source, "description": c.description,
            "name_id": c.name_id, "group_code": c.group_code, "job_zone": c.job_zone,
            "n_ads": c.n_ads, "coverage_pct": c.coverage_pct, "required_skills": req}


# ---------- auth ----------
@app.post("/api/auth/register")
def register(r: RegisterIn):
    email = r.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "invalid_email")
    if not r.consent:
        raise HTTPException(422, "consent_required")
    if db.user_by_email(email):
        raise HTTPException(409, "email_taken")
    u = db.create_user(r.name.strip(), email, auth.hash_password(r.password), r.status, r.cohort, auth.admin_emails())
    return {"token": auth.new_session(u["id"]), "user": auth.public_user(u)}


@app.post("/api/auth/login")
def login(r: LoginIn):
    u = db.user_by_email(r.email.strip().lower())
    if not u or not auth.verify_password(r.password, u["password_hash"]):
        raise HTTPException(401, "wrong_credentials")
    return {"token": auth.new_session(u["id"]), "user": auth.public_user(u)}


@app.get("/api/auth/me")
def me(user: dict = Depends(auth.current_user)):
    return auth.public_user(user)


@app.post("/api/auth/logout")
def logout(authorization: str | None = Header(default=None)):
    if authorization and authorization.lower().startswith("bearer "):
        db.delete_session(authorization.split(" ", 1)[1].strip())
    return {"ok": True}


# ---------- profile ----------
def _merge_profile(p: ProfileIn, saved: dict) -> dict:
    new = dict(saved)
    data = p.model_dump(exclude_none=True)
    for k in ("courses", "self_rated", "custom_skills", "interests", "target_career", "education_level"):
        if k in data:
            new[k] = data[k]
    if p.clear_target:
        new["target_career"] = None
    out = prof.normalize(new)
    if len(out["interests"]) > MAX_INTERESTS:
        raise HTTPException(422, {"errors": ["too_many_interests"]})
    return out


@app.get("/api/profile")
def get_profile(user: dict = Depends(auth.current_user)):
    return {"account": auth.public_user(user), "profile": auth.user_profile(user)}


@app.post("/api/profile/account")
def save_account(a: AccountIn, user: dict = Depends(auth.current_user)):
    email = a.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "invalid_email")
    other = db.user_by_email(email)
    if other and other["id"] != user["id"]:
        raise HTTPException(409, "email_taken")
    db.update_user(user["id"], name=a.name.strip(), email=email, status=a.status, cohort=a.cohort)
    return auth.public_user(db.get_user(user["id"]))


@app.post("/api/profile/academic")
def save_academic(p: ProfileIn, user: dict = Depends(auth.current_user)):
    """Saves one or more parts. Completeness is checked only when an assessment starts."""
    profile = _merge_profile(p, auth.user_profile(user))
    db.save_profile(user["id"], profile)
    u = db.get_user(user["id"])
    return {"account": auth.public_user(u), "profile": auth.user_profile(u)}


@app.post("/api/profile/password")
def change_password(p: PasswordIn, user: dict = Depends(auth.current_user)):
    if not auth.verify_password(p.current, user["password_hash"]):
        raise HTTPException(401, "wrong_password")
    db.update_user(user["id"], password_hash=auth.hash_password(p.new))
    return {"ok": True}


# ---------- student ----------
def _own(aid: int, user: dict):
    a = db.get_assessment(aid)
    if not a or (a["user_id"] != user["id"] and user["role"] != "admin"):
        raise HTTPException(404, "Assessment not found")
    return a


def _assessment_data(user: dict, experience: list, notes: str = "", suggested: list | None = None) -> dict:
    if user["role"] == "admin":
        raise HTTPException(403, "admin_no_assessment")
    profile = auth.user_profile(user)
    if not auth.profile_complete(profile):
        raise HTTPException(409, "profile_incomplete")
    st = store()
    # snapshot of the profile at this moment + this assessment's experience
    exp = [st.find_skill(s) for s in dict.fromkeys(experience)]
    return {"courses": profile["courses"], "self_rated": profile["self_rated"], "custom_skills": profile["custom_skills"],
            "interests": profile["interests"], "target_career": profile["target_career"],
            "education_level": profile["education_level"],
            "experience": [s for s in exp if s], "notes": notes.strip(),
            "experience_suggested": [s for s in dict.fromkeys(st.find_skill(x) for x in (suggested or [])) if s]}


@app.post("/api/experience/extract")
def extract_experience(e: ExtractIn, user: dict = Depends(auth.current_user)):
    """FR4: skills mentioned in the experience story. Nothing is saved; the student ticks what applies."""
    found = extract.extract(e.text)
    return {"skills": found, "n": len(found),
            "method": "skill dictionary v4 patterns (as in the job-ad pipeline) + catalogue skill names"}


@app.post("/api/assessments/preview")
def preview(p: PreviewIn, user: dict = Depends(auth.current_user)):
    """Live ranking while the student picks experience (nothing is saved)."""
    ranked, _, _ = rank(_assessment_data(user, p.experience))
    return [{"slug": c.slug, "name": c.name, "fit": round(fit, 1), "K": round(K, 4), "M": M} for c, K, M, fit in ranked[:10]]


@app.post("/api/assessments")
def create_assessment(a: AssessmentIn, user: dict = Depends(auth.current_user)):
    data = _assessment_data(user, a.experience, a.notes, a.suggested)
    data["n_ranked"] = len(rank(data)[0])
    return {"id": db.save_assessment(user["id"], data, recommend(data, top=TOP_STORE))}


@app.get("/api/assessments")
def list_assessments(limit: int = 10, user: dict = Depends(auth.current_user)):
    return db.list_assessments(user["id"], limit)


@app.get("/api/assessments/{aid}")
def get_assessment(aid: int, user: dict = Depends(auth.current_user)):
    a = _own(aid, user)
    return {**a, "ratings": db.get_ratings(aid)}


@app.post("/api/assessments/{aid}/ratings")
def rate(aid: int, r: RatingIn, user: dict = Depends(auth.current_user)):
    a = _own(aid, user)
    if r.career not in {x["slug"] for x in a["results"]}:
        raise HTTPException(400, "Invalid career")
    db.save_rating(aid, r.career, r.value)
    return db.get_ratings(aid)


def _llm_error(e: llm.LLMError):
    raise HTTPException(503 if e.code != "rate_limited" else 429, f"llm_{e.code}")


@app.get("/api/llm/status")
def llm_status(check: bool = False):
    return llm.status(check)


@app.get("/api/rag/status")
def rag_status():
    """Knowledge base and generator configuration (no document text)."""
    P = assistant.prompts()
    return {**rag.status(), "compare_enabled": RAG_COMPARE, "prompt_version": P["prompt_versi"],
            "evaluated_model": P["model"], "evaluated_layer": P.get("mode_retrieval_evaluasi"), "llm": llm.status()}


@app.post("/api/ask")
def ask(q: AskIn, user: dict = Depends(auth.current_user)):
    """Answer from system data (assessment, profile, catalogue, course mapping). Knowledge base added in P3."""
    try:
        out, model = assistant.ask(q.question, [t.model_dump() for t in q.history], db.latest_assessment(user["id"]),
                                   auth.user_profile(user), q.lang)
    except llm.LLMError as e:
        _llm_error(e)
    return {**out, "model": model}


@app.post("/api/assessments/{aid}/explain")
def explain(aid: int, body: ExplainIn, user: dict = Depends(auth.current_user)):
    a = _own(aid, user)
    row = next((r for r in a["results"] if r["slug"] == body.career), None)
    if not row:
        raise HTTPException(404, "career not found")
    if body.mode == "non_rag" and not (RAG_COMPARE or user["role"] == "admin"):
        raise HTTPException(403, "compare_disabled")
    key = f"{body.lang}|{body.mode}|{EXPLAIN_VERSION}"
    if not body.refresh and (cached := db.get_explanation(aid, body.career, key)):
        return cached
    try:
        content = assistant.explain_v2(row, a["input"], body.lang, body.mode)
    except llm.LLMError as e:
        _llm_error(e)
    model = content.pop("model")
    db.save_explanation(aid, body.career, key, content, model)
    return db.get_explanation(aid, body.career, key)


# ---------- admin ----------
@app.get("/api/kb")
def kb_list(admin: dict = Depends(auth.admin_user)):
    return db.list_docs()


@app.post("/api/kb")
async def kb_upload(title: str = Form(...), doc_type: str = Form(...), year: str = Form(""),
                    file: UploadFile = File(...), admin: dict = Depends(auth.admin_user)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, "file_type")
    stored = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / stored).write_bytes(await file.read())
    db.add_doc(title.strip() or file.filename, doc_type, ext[1:].upper(), year.strip() or "—", stored)
    return db.list_docs()


@app.delete("/api/kb/{doc_id}")
def kb_delete(doc_id: int, admin: dict = Depends(auth.admin_user)):
    d = db.get_doc(doc_id)
    if d and d["filename"]:
        (UPLOAD_DIR / d["filename"]).unlink(missing_ok=True)
    db.delete_doc(doc_id)
    return db.list_docs()


@app.post("/api/admin/ask")
def admin_ask(q: AskIn, admin: dict = Depends(auth.admin_user)):
    """Admin chat: answers from usage/feedback statistics, catalogue, course mapping and the knowledge-base document list."""
    try:
        out, model = assistant.ask_admin(q.question, [t.model_dump() for t in q.history], db.feedback_summary(),
                                         db.list_docs(), q.lang)
    except llm.LLMError as e:
        _llm_error(e)
    return {**out, "model": model}


@app.get("/api/admin/feedback")
def feedback(admin: dict = Depends(auth.admin_user)):
    return db.feedback_summary()


# ---------- admin: catalogue (careers, skills, interest areas, course templates) ----------
class CareerSkillIn(BaseModel):
    skill: str
    w: float | None = Field(None, gt=0, le=10, description="weight; default = demand_pct / 100")
    demand_pct: float | None = Field(None, ge=0, le=100, description="% of job ads that ask for the skill")


class CareerIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    tier: str = "reference"
    source: str | None = Field(None, max_length=200)
    onet_soc: str | None = Field(None, max_length=20)
    graduate_profile: bool = False
    interest_areas: list[str] = Field(min_length=1, max_length=6)
    n_ads: int = Field(0, ge=0)
    coverage_pct: float | None = Field(None, ge=0, le=100)
    description: str | None = Field(None, max_length=2000)
    name_id: str | None = Field(None, max_length=120)
    skills: list[CareerSkillIn] = Field(min_length=1, max_length=80)


class SkillIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    category: str = Field(min_length=1, max_length=40)
    kind: str = "hard"
    name_id: str | None = Field(None, max_length=60)


class InterestIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    name_id: str | None = Field(None, max_length=60)


class CourseTemplateIn(BaseModel):
    code: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=2, max_length=120)
    program: str | None = Field(None, max_length=80)
    semester: int | None = Field(None, ge=1, le=14)
    category: str = "program"
    sks: int | None = Field(None, ge=0, le=12)
    skills: list[str] = Field(default_factory=list, max_length=30)


def _catalog():
    st = store()
    d = catalog_db.load()
    used_skill = {}
    for r in d["career_skills"]:
        used_skill.setdefault(r["skill"], []).append(r["career_slug"])
    for c in d["courses"]:
        for s in c["skills"]:
            used_skill.setdefault(s, []).append(c["code"])
    n_skills = {}
    for r in d["career_skills"]:
        n_skills[r["career_slug"]] = n_skills.get(r["career_slug"], 0) + 1
    return {"careers": [{**c, "graduate_profile": bool(c["graduate_profile"]), "scored": c["slug"] in st.careers,
                         "n_skills": n_skills.get(c["slug"], 0)} for c in d["careers"]],
            "groups": d["groups"],
            "skills": [{**s, "used_by": len(used_skill.get(s["name"], []))} for s in d["skills"]],
            "interest_areas": [{**a, "used_by": sum(a["name"] in c["interest_areas"] for c in d["careers"])}
                               for a in d["interest_areas"]],
            "courses": d["courses"], "tiers": TIERS, "skill_kinds": SKILL_KINDS, "course_categories": COURSE_CATEGORIES}


def _changed():
    reload()
    return _catalog()


@app.get("/api/admin/catalog")
def admin_catalog(admin: dict = Depends(auth.admin_user)):
    return _catalog()


@app.get("/api/admin/careers/{slug}")
def admin_career(slug: str, admin: dict = Depends(auth.admin_user)):
    d = catalog_db.load()
    c = next((x for x in d["careers"] if x["slug"] == slug), None)
    if not c:
        raise HTTPException(404, "career not found")
    skills = sorted(({"skill": r["skill"], "w": r["w"], "demand_pct": r["demand_pct"]} for r in d["career_skills"]
                     if r["career_slug"] == slug), key=lambda x: -x["w"])
    return {**c, "graduate_profile": bool(c["graduate_profile"]), "skills": skills}


@app.post("/api/admin/catalog/reset")
def admin_catalog_reset(admin: dict = Depends(auth.admin_user)):
    """Put back the original catalogue from artifacts/ (Colab pipeline output)."""
    catalog_db.seed()
    return _changed()


@app.post("/api/admin/careers")
def admin_save_career(c: CareerIn, slug: str | None = None, admin: dict = Depends(auth.admin_user)):
    st = store()
    if c.tier not in TIERS:
        raise HTTPException(422, "invalid_tier")
    bad_areas = [a for a in c.interest_areas if a not in st.interest_areas]
    skills, bad_skills = [], []
    for x in c.skills:
        s = st.find_skill(x.skill)
        if not s:
            bad_skills.append(x.skill)
        elif s not in {y["skill"] for y in skills}:
            w = x.w if x.w is not None else (x.demand_pct / 100 if x.demand_pct else None)
            if not w:
                raise HTTPException(422, {"errors": ["weight_required"], "skill": s})
            skills.append({"skill": s, "w": round(w, 4), "demand_pct": x.demand_pct})
    if bad_areas or bad_skills:
        raise HTTPException(422, {"errors": ["unknown_items"], "interest_areas": bad_areas, "skills": bad_skills})
    name = c.name.strip()
    existing = {r["slug"] for r in catalog_db.load()["careers"]}
    if slug and slug not in existing:
        raise HTTPException(404, "career not found")
    if not slug and slugify(name) in existing:
        raise HTTPException(409, "career_exists")
    slug = slug or slugify(name)
    if any(r["name"].lower() == name.lower() and r["slug"] != slug for r in catalog_db.load()["careers"]):
        raise HTTPException(409, "career_exists")
    f = c.model_dump()
    f["name"] = name
    catalog_db.upsert_career(slug, f, skills)
    return _changed()


@app.delete("/api/admin/careers/{slug}")
def admin_delete_career(slug: str, admin: dict = Depends(auth.admin_user)):
    catalog_db.delete_career(slug)
    return _changed()


@app.post("/api/admin/skills")
def admin_save_skill(s: SkillIn, admin: dict = Depends(auth.admin_user)):
    if s.kind not in SKILL_KINDS:
        raise HTTPException(422, "invalid_kind")
    st = store()
    name = st.find_skill(s.name) or s.name.strip()       # same name in other letter case = same skill
    catalog_db.upsert_skill(name, s.category.strip(), s.kind, (s.name_id or "").strip() or None)
    return _changed()


@app.delete("/api/admin/skills/{name}")
def admin_delete_skill(name: str, admin: dict = Depends(auth.admin_user)):
    d = catalog_db.load()
    users = sorted({r["career_slug"] for r in d["career_skills"] if r["skill"] == name} |
                   {c["code"] for c in d["courses"] if name in c["skills"]})
    if users:
        raise HTTPException(409, {"errors": ["in_use"], "used_by": users})
    catalog_db.delete_skill(name)
    return _changed()


@app.post("/api/admin/interests")
def admin_save_interest(a: InterestIn, admin: dict = Depends(auth.admin_user)):
    catalog_db.upsert_interest(a.name.strip(), (a.name_id or "").strip() or None)
    return _changed()


@app.delete("/api/admin/interests/{name}")
def admin_delete_interest(name: str, admin: dict = Depends(auth.admin_user)):
    users = [c.slug for c in store().careers.values() if name in c.interest_areas]
    if users:
        raise HTTPException(409, {"errors": ["in_use"], "used_by": users})
    catalog_db.delete_interest(name)
    return _changed()


@app.post("/api/admin/courses")
def admin_save_course(c: CourseTemplateIn, admin: dict = Depends(auth.admin_user)):
    if c.category not in COURSE_CATEGORIES:
        raise HTTPException(422, "invalid_category")
    st = store()
    skills = list(dict.fromkeys(s for s in (st.find_skill(x) for x in c.skills) if s))
    catalog_db.upsert_course(c.code.strip(), {**c.model_dump(), "name": c.name.strip(), "skills": skills})
    return _changed()


@app.delete("/api/admin/courses/{code}")
def admin_delete_course(code: str, admin: dict = Depends(auth.admin_user)):
    catalog_db.delete_course(code)
    return _changed()
