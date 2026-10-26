import { registerCatalogLabels } from "./labels";

export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type CareerGroup = { code: string; name: string; name_id: string | null };
export type EducationLevel = "sma" | "d3" | "d4s1" | "s2";
export type CourseCategory = "university" | "faculty" | "program" | "elective";
export type Tier = "validated" | "reference";
/** Course template (e.g. the PNJ TI curriculum); skills verified from the syllabus. */
export type Course = {
  code: string; name: string; program: string | null; semester: number | null; semester_inferred: boolean;
  category: CourseCategory | null; sks: number | null; skills: string[];
};
export type Meta = {
  courses: Course[]; course_categories: CourseCategory[]; grades: string[]; grade_points: Record<string, number>;
  levels: string[]; skills_by_category: Record<string, string[]>; soft_skills: string[];
  skill_labels: Record<string, string>; skill_sources: Record<string, string>;
  interest_areas: string[]; interest_labels: Record<string, string>; interest_sources: Record<string, string>;
  groups: CareerGroup[]; careers: { slug: string; name: string; name_id: string | null; tier: Tier }[];
  max_interests: number; alpha: number;
};
/** A course in the student's profile: from a template (template = code) or typed by the student (template = null). */
export type ProfileCourse = {
  id: string; template: string | null; name: string; category: CourseCategory; sks: number | null; semester: number | null;
  grade: string; skills: string[];
};
export type CustomSkill = { name: string; level: string };
export type TargetCareer = { slug: string | null; name: string } | null;
export type Evidence = { type: "course"; code: string; name: string; grade: string; category?: string } | { type: "self"; level: string } | { type: "experience" } | { type: "via"; skill: string };
export type SkillRow = {
  skill: string; w: number; demand_pct: number | null; e: number; status: "met" | "partly" | "gap";
  from: Evidence[]; courses: string[];
};
export type Source = { key: string; n_ads?: number; n_skills?: number; name?: string; skills?: string[]; source?: string | null; onet_soc?: string | null; custom?: boolean };
export type Result = {
  slug: string; name: string; score: number; fit: number; K: number; M: number; graduate_profile: boolean;
  tier?: Tier; is_target?: boolean; rank?: number; name_id?: string | null; group_code?: string | null; job_zone?: number | null;
  interest_areas: string[]; n_ads: number; coverage_pct: number | null;
  breakdown: { competency: number; interest: number }; skills: SkillRow[]; sources: Source[];
  summary: {
    label: "strong" | "good" | "developing"; top_matched: { skill: string; demand_pct: number | null }[];
    best_course: { code: string; name: string; grade: string } | null; interest_match: boolean; to_improve: string[];
  };
};
export type AssessmentInput = {
  courses: ProfileCourse[] | Record<string, string>; self_rated: Record<string, string>; custom_skills?: CustomSkill[];
  experience: string[]; interests: string[]; target_career?: TargetCareer; notes: string;
  n_ranked?: number; education_level?: EducationLevel;
};
/** Assessments saved before patch 8 stored courses as {code: grade}. */
export const inputCourses = (c: AssessmentInput["courses"], names: Record<string, string> = {}): ProfileCourse[] =>
  Array.isArray(c) ? c : Object.entries(c).map(([code, grade]) => ({ id: code, template: code, name: names[code] || code,
    category: "program", sks: null, semester: null, grade, skills: [] }));
export type Assessment = { id: number; created_at: string; input: AssessmentInput; results: Result[]; ratings: Record<string, number> };
export type HistoryRow = { id: number; created_at: string; top: { slug: string; name: string; score: number }[] };
export type KbDoc = {
  id: number; title: string; doc_type: string; format: string; year: string | null; access: "public" | "private";
  filename: string | null; chunks: number; status: string; updated: string;
};
export type User = {
  id: number; name: string; email: string; role: "student" | "admin"; status: string | null; cohort: string | null; profile_complete: boolean;
};
export type AcademicProfile = {
  courses: ProfileCourse[]; self_rated: Record<string, string>; custom_skills: CustomSkill[]; interests: string[];
  target_career: TargetCareer; education_level: EducationLevel; updated_at?: string | null;
};
export type CareerCard = {
  slug: string; name: string; graduate_profile: boolean; interest_areas: string[]; tier: Tier; source: string | null;
  name_id: string | null; group_code: string | null; job_zone: number | null;
  n_ads: number; n_required: number;
  coverage_pct: number | null; top_skills: string[]; top_skill_pct: { skill: string; demand_pct: number | null; w?: number }[]; skills: string[];
};
export type CareerFull = Omit<CareerCard, "top_skills" | "n_required" | "top_skill_pct" | "skills"> & {
  onet_soc: string | null; description: string | null;
  required_skills: { skill: string; w: number; demand_pct: number | null; courses: string[] }[];
};
/* admin catalogue */
export type CatSkill = { name: string; category: string; kind: "hard" | "soft"; used_by: number; name_id: string | null; source: string | null };
export type CatInterest = { name: string; name_id: string | null; used_by: number };
export type CatCareer = {
  slug: string; name: string; tier: Tier; source: string | null; onet_soc: string | null; graduate_profile: boolean;
  interest_areas: string[]; n_ads: number; coverage_pct: number | null; description: string | null; updated_at: string | null;
  name_id: string | null; group_code: string | null; job_zone: number | null;
  scored: boolean; n_skills: number;
};
export type CatCareerFull = Omit<CatCareer, "n_skills"> & { skills: { skill: string; w: number; demand_pct: number | null }[] };
export type Catalog = {
  careers: CatCareer[]; skills: CatSkill[]; interest_areas: CatInterest[]; courses: Course[]; groups: CareerGroup[];
  tiers: Tier[]; skill_kinds: string[]; course_categories: CourseCategory[];
};
export type CareerSave = Omit<CatCareerFull, "slug" | "scored" | "updated_at" | "job_zone" | "group_code">;
/** FR4: a skill found in the experience story; snippet marks the phrase as [[...]]. */
export type ExtractedSkill = { skill: string; kind: string; category: string; method: "dictionary" | "name"; snippet: string };
export type Feedback = {
  users: number; assessments: number; ratings: number; mean_top3: number | null; n_top3: number;
  fr4?: { assessments_with_story: number; suggested: number; accepted: number; accepted_pct: number | null };
  per_career: { slug: string; name: string; n: number; mean: number }[];
  recent: { assessment_id: number; career: string; rank: number | null; value: number; created_at: string }[];
};

/* Two separate sessions in one browser: the student web (/...) and the admin web (/admin/...).
   Logging in to one never replaces the other, so a student tab and an admin tab can be open together. */
export type Area = "student" | "admin";
const TOKEN_KEYS: Record<Area, string> = { student: "careerai_token", admin: "careerai_admin_token" };
export const areaOf = (path: string): Area => (path.startsWith("/admin") ? "admin" : "student");
export const currentArea = (): Area => (typeof window === "undefined" ? "student" : areaOf(window.location.pathname));
export const tokenStore = {
  get: (a: Area = currentArea()) => { try { return localStorage.getItem(TOKEN_KEYS[a]); } catch { return null; } },
  set: (t: string | null, a: Area = currentArea()) => {
    try { if (t) localStorage.setItem(TOKEN_KEYS[a], t); else localStorage.removeItem(TOKEN_KEYS[a]); } catch {}
  },
};

/** One statement of an explanation. Explanations cached before patch 11 are plain strings. */
export type Statement = { text: string; sources: string[]; cites: number[]; data: boolean; unsupported: string[]; checked: boolean };
export type Passage = { n: number; chunk_id: string; type: string; title: string; source?: string; access: "public" | "internal"; score?: number; excerpt?: string };
export type ClaimCheck = { claims: number; supported: number; support: number | null; not_checkable: number; invalid_citations: number;
  complete: boolean; gap_ok: boolean; unsupported: string[] };
export type ExplainMode = "rag" | "non_rag";
export type Explanation = {
  basis_of_fit: (Statement | string)[]; matched_competencies: (Statement | string)[];
  competencies_to_improve: (Statement | string)[]; development_advice: (Statement | string)[];
  complete: boolean; model: string; created_at: string;
  mode?: "rag" | "non_rag" | "system_data"; requested_mode?: ExplainMode; kb_layer?: "public" | "internal" | null; kb_ready?: boolean;
  tier?: string; prompt_version?: string; evaluated_config?: boolean; passages?: Passage[]; check?: ClaimCheck;
};
export type RagStatus = { ready: boolean; error?: string; layer: string; passages?: number; by_type?: Record<string, number>;
  tau?: number; top_k?: number; embedding_model?: string; embedding_mock?: boolean; compare_enabled: boolean;
  prompt_version: string; evaluated_model: string; evaluated_layer?: string; llm: { provider: string; model: string; ready: boolean; mock: boolean } };
export type ApiError = Error & { status: number; body: { detail?: unknown } };
export const errCode = (e: unknown) => {
  const d = (e as ApiError)?.body?.detail;
  return typeof d === "string" ? d : "";
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = tokenStore.get();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // patch 14b: backend on the laptop behind an ngrok tunnel - skip ngrok's browser warning page for API calls
  if (API.includes("ngrok")) headers.set("ngrok-skip-browser-warning", "1");
  const r = await fetch(`${API}${path}`, { cache: "no-store", ...init, headers });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(String(r.status)), { status: r.status, body });
  return body as T;
}
const json = (method: string, data: unknown): RequestInit =>
  ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

export type ChatTurn = { role: "user" | "ai"; text: string };
export type AskSource = { n: number; title: string; access: string; excerpt?: string; type?: string; source?: string };
export type AskReply = { answer: string; model: string; sources: AskSource[]; mode?: "rag" | "system_data"; passages_retrieved?: number };

export const api = {
  meta: () => call<Meta>("/api/meta").then((m) => { registerCatalogLabels(m); return m; }),
  history: () => call<HistoryRow[]>("/api/assessments"),
  get: (id: string | number) => call<Assessment>(`/api/assessments/${id}`),
  create: (a: { experience: string[]; notes: string; suggested?: string[] }) => call<{ id: number }>("/api/assessments", json("POST", a)),
  extractSkills: (text: string) => call<{ skills: ExtractedSkill[]; n: number; method: string }>("/api/experience/extract", json("POST", { text })),
  profile: () => call<{ account: User; profile: AcademicProfile }>("/api/profile"),
  saveAccount: (a: { name: string; email: string; status: string | null; cohort: string | null }) => call<User>("/api/profile/account", json("POST", a)),
  saveAcademic: (p: Partial<AcademicProfile> & { clear_target?: boolean }) => call<{ account: User; profile: AcademicProfile }>("/api/profile/academic", json("POST", p)),
  changePassword: (current: string, next: string) => call<{ ok: boolean }>("/api/profile/password", json("POST", { current, new: next })),
  rate: (id: number, career: string, value: number) => call<Record<string, number>>(`/api/assessments/${id}/ratings`, json("POST", { career, value })),
  careers: () => call<CareerCard[]>("/api/careers"),
  career: (slug: string) => call<CareerFull>(`/api/careers/${slug}`),
  register: (b: { name: string; email: string; password: string; status: string | null; cohort: string | null; consent: boolean }) =>
    call<{ token: string; user: User }>("/api/auth/register", json("POST", b)),
  login: (email: string, password: string) => call<{ token: string; user: User }>("/api/auth/login", json("POST", { email, password })),
  me: () => call<User>("/api/auth/me"),
  logout: () => call<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  ask: (question: string, history: ChatTurn[], lang: string) => call<AskReply>("/api/ask", json("POST", { question, history, lang })),
  adminAsk: (question: string, history: ChatTurn[], lang: string) => call<AskReply>("/api/admin/ask", json("POST", { question, history, lang })),
  explain: (id: number, career: string, lang: string, refresh = false, mode: ExplainMode = "rag") =>
    call<Explanation>(`/api/assessments/${id}/explain`, json("POST", { career, lang, refresh, mode })),
  ragStatus: () => call<RagStatus>("/api/rag/status"),
  preview: (experience: string[]) => call<{ slug: string; name: string; fit: number; K: number; M: number }[]>("/api/assessments/preview", json("POST", { experience })),
  llmStatus: () => call<{ provider: string; model: string; ready: boolean; mock: boolean }>("/api/llm/status"),
  feedback: () => call<Feedback>("/api/admin/feedback"),
  kb: () => call<KbDoc[]>("/api/kb"),
  kbUpload: (f: FormData) => call<KbDoc[]>("/api/kb", { method: "POST", body: f }),
  kbDelete: (id: number) => call<KbDoc[]>(`/api/kb/${id}`, { method: "DELETE" }),
  catalog: () => call<Catalog>("/api/admin/catalog"),
  adminCareer: (slug: string) => call<CatCareerFull>(`/api/admin/careers/${encodeURIComponent(slug)}`),
  catalogReset: () => call<Catalog>("/api/admin/catalog/reset", { method: "POST" }),
  saveCareer: (c: CareerSave, slug?: string) => call<Catalog>(`/api/admin/careers${slug ? `?slug=${encodeURIComponent(slug)}` : ""}`, json("POST", c)),
  deleteCareer: (slug: string) => call<Catalog>(`/api/admin/careers/${encodeURIComponent(slug)}`, { method: "DELETE" }),
  saveSkill: (s: { name: string; category: string; kind: string; name_id?: string | null }) => call<Catalog>("/api/admin/skills", json("POST", s)),
  deleteSkill: (name: string) => call<Catalog>(`/api/admin/skills/${encodeURIComponent(name)}`, { method: "DELETE" }),
  saveInterest: (a: { name: string; name_id: string | null }) => call<Catalog>("/api/admin/interests", json("POST", a)),
  deleteInterest: (name: string) => call<Catalog>(`/api/admin/interests/${encodeURIComponent(name)}`, { method: "DELETE" }),
  saveCourse: (c: Omit<Course, "semester_inferred">) => call<Catalog>("/api/admin/courses", json("POST", c)),
  deleteCourse: (code: string) => call<Catalog>(`/api/admin/courses/${encodeURIComponent(code)}`, { method: "DELETE" }),
};
