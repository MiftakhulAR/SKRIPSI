"use client";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { enExtra, idExtra } from "./i18n_extra";
import { enExtra2, idExtra2 } from "./i18n_extra2";
import { enExtra3, idExtra3 } from "./i18n_extra3";
import { enExtra4, idExtra4 } from "./i18n_extra4";
import { enExtra5, idExtra5 } from "./i18n_extra5";
import { usePathname } from "next/navigation";
import { api, areaOf } from "./api";
import { dynamicInterestId, dynamicSkillId, groupNames } from "./labels";

export type Lang = "en" | "id";

const enBase = {
  nav_dashboard: "Dashboard", nav_assessment: "Career Assessment", nav_results: "My Recommendations", nav_kb: "Knowledge Base", nav_admin: "Admin",
  sidebar_note: "For D4 Teknik Informatika students, Politeknik Negeri Jakarta. Recommendations are a starting point, not a final decision.",
  badge_version: "Prototype P2 · scoring per Chapter III",
  loading: "Loading…", api_error: "Cannot reach the server. Is the backend running?",
  // dashboard
  dash_sub: "Career recommendation for D4 Teknik Informatika, PNJ", hi: "Hi, {name}",
  hero_title: "Find IT careers that match your courses, skills and interests.",
  hero_body: "Your fit score is calculated from your input and the skills requested in Indonesian IT job ads, and every explanation shows its sources.",
  start: "Start career assessment", view_last: "View last result", how_it_works: "How it works", step: "STEP",
  how1_t: "Fill in your profile once", how1_d: "Courses and grades, technical skills and up to 3 areas of interest. Each assessment then only asks about your experience.",
  how2_t: "System calculates fit", how2_d: "Your skills are matched against what Indonesian IT job ads require for 15 careers.",
  how3_t: "Read the explanation", how3_d: "See why a career fits, your competency gaps, and the sources behind it.",
  latest_rec: "Latest recommendation", see_all: "See all", no_assessment: "No assessment yet. Start one to see your recommendations here.",
  history: "Assessment history", empty: "Empty.",
  // assessment
  assess_sub: "Four short steps, about 5 minutes",
  st_courses: "Courses", st_skills: "Skills", st_exp: "Experience", st_interests: "Interests",
  courses_t: "Courses taken", courses_d: "Choose your grade for each course you have completed. Leave \"—\" for courses not taken yet. Only courses whose skills were verified from the syllabus are listed.",
  col_course: "Course", col_code: "Code", col_teaches: "Skills it teaches", col_grade: "Grade",
  skills_t: "Technical skills", skills_d: "Rate only the skills you have actually used. Leave the rest empty.",
  search_skill: "Search skill…", lv_beginner: "Beg", lv_intermediate: "Int", lv_advanced: "Adv",
  lv_full_beginner: "Beginner", lv_full_intermediate: "Intermediate", lv_full_advanced: "Advanced",
  skills_note: "Beginner = 0.33, Intermediate = 0.67, Advanced = 1 (evidence value used in the score). Click a selected level again to clear it.",
  exp_t: "Experience", exp_d: "Which of your skills did you use in an internship, job or real project? These count as full evidence.",
  exp_empty: "Rate at least one skill in step 2 first, or skip this step.",
  exp_text: "Describe your experience", optional: "(optional)", exp_ph: "e.g. internship as web developer using Laravel and MySQL",
  exp_text_note: "Saved for the next version, where skills will be extracted from this text and confirmed by you.",
  int_t: "Areas of interest", int_d: "Choose 1 to {n} IT areas you would like to work in.",
  back: "Back", next: "Next", get_rec: "Get recommendations",
  err_competency: "Enter at least one course grade (step 1) or rate at least one skill.", err_interest: "Choose 1 to {n} areas of interest.",
  // analyzing
  an_title: "Preparing your recommendations", an_sub: "Analyzing your profile", an_body: "Your input is saved. The system works in four stages.",
  an1_t: "Reading your profile", an1_d: "Courses, grades, technical skills, experience and interests.",
  an2_t: "Calculating fit scores", an2_d: "Matching your skills to the skills required by IT job ads for 15 careers (fixed formula).",
  an3_t: "Retrieving documents", an3_d: "Finding relevant passages in competency standards, curriculum and career profiles.",
  an4_t: "Writing explanations", an4_d: "Explaining each result using only the retrieved passages.",
  an_note: "Prototype P2: stages 1–2 run on the server; stages 3–4 (retrieval and LLM) are connected in P3.",
  // results
  res_sub: "Assessment #{id} · {date} · {n} careers ranked", fit_score: "Fit score",
  fit_strong: "Strong fit", fit_good: "Good fit", fit_developing: "Developing fit", grad_profile: "PNJ graduate profile",
  k_label: "Competency match (K)", m_label: "Interest match (M)", relevant: "Is this relevant?", saved: "Saved", view_details: "View details",
  how_score: "How the fit score works", how_score_d: "Calculated by the system with a fixed formula, not by an AI model:",
  how_score_note: "K compares your evidence for each skill (course grade, self-rating or experience) with the skills required by IT job ads for that career, weighted by how often and how specifically each skill is requested.",
  your_input: "Your input", in_courses: "Courses", in_skills: "Technical skills", in_exp: "Experience", in_int: "Interests", as_json: "View as JSON (API)",
  sum_fit: "{label} for {career}.", sum_have: "You already have {list}", sum_of_ads: "of ads",
  sum_grade: "Your grade {grade} in {course} counts as evidence", sum_int_yes: "Your interest matches this career.",
  sum_int_no: "This career is outside the interest areas you chose.", sum_improve: "To improve: {list}.",
  // detail
  back_rec: "← Back to recommendations", detail_sub: "Career detail · assessment #{id}", fit_score_100: "Fit score / 100",
  gap_t: "Competency gap", gap_d: "Skills requested in at least 10% of {career} job ads, compared with your evidence (0–1).",
  col_skill: "Skill", col_ads: "In ads", col_you: "You", col_status: "Status",
  st_met: "Met", st_partly: "Partly met", st_gap: "Gap",
  ev_self: "self-rated {level}", ev_exp: "experience",
  next_t: "Suggested next steps", next_learn: "Learn", next_strengthen: "Strengthen", next_in_ads: "in {p}% of ads", next_course: "related course",
  next_note: "Personalised advice with sources will be written by the LLM in the next version.", all_met: "All required skills are met.",
  rel_courses: "Related PNJ courses", no_rel: "No verified course teaches the required skills.",
  basis: "Basis of this recommendation", src_ads: "Indonesian IT job ads — {career} ({n} ads)", src_ads_ex: "{n} technical skills appear in at least 10% of these ads.",
  src_course_ex: "Verified course–skill mapping: {list}.",
  industry: "Industry requirements", ind_ads: "Job ads analysed", ind_req: "Required skills (≥ 10% of ads)", ind_cov: "Covered by curriculum",
  ind_src: "Source: four public Indonesian IT job-ad datasets (build split).",
  // kb
  kb_sub: "Admin · manage the documents used for retrieval", kb_docs: "Documents", kb_files: "Uploaded files", kb_chunks: "Indexed chunks",
  kb_upload_t: "Upload document", kb_upload_d: "PDF, DOCX, CSV, TXT or MD. Indexing (chunking + embedding) is done in the Colab pipeline.",
  kb_title: "Title", kb_type: "Type", kb_file: "File", kb_upload: "Upload", kb_list: "Source documents",
  kb_format: "Format", kb_updated: "Updated", kb_status: "Status", kb_delete: "Delete", kb_confirm: "Delete this document?",
  kb_uploaded: "Document uploaded", kb_deleted: "Document deleted", kb_bad: "File type not allowed",
};
const en = { ...enBase, ...enExtra, ...enExtra2, ...enExtra3, ...enExtra4, ...enExtra5 };
type Dict = typeof en;

const idBase: typeof enBase = {
  nav_dashboard: "Dasbor", nav_assessment: "Asesmen Karier", nav_results: "Rekomendasi Saya", nav_kb: "Basis Pengetahuan", nav_admin: "Admin",
  sidebar_note: "Untuk mahasiswa D4 Teknik Informatika, Politeknik Negeri Jakarta. Rekomendasi adalah titik awal, bukan keputusan akhir.",
  badge_version: "Prototipe P2 · skor sesuai Bab III",
  loading: "Memuat…", api_error: "Server tidak dapat dihubungi. Apakah backend sudah berjalan?",
  dash_sub: "Rekomendasi karier untuk D4 Teknik Informatika, PNJ", hi: "Halo, {name}",
  hero_title: "Temukan karier TI yang sesuai dengan mata kuliah, skill, dan minatmu.",
  hero_body: "Skor kecocokan dihitung dari input-mu dan skill yang diminta lowongan kerja TI di Indonesia, dan setiap penjelasan menampilkan sumbernya.",
  start: "Mulai asesmen karier", view_last: "Lihat hasil terakhir", how_it_works: "Cara kerja", step: "LANGKAH",
  how1_t: "Isi profil sekali", how1_d: "Mata kuliah dan nilai, skill teknis, dan maksimal 3 bidang minat. Setiap asesmen lalu hanya menanyakan pengalamanmu.",
  how2_t: "Sistem menghitung kecocokan", how2_d: "Skill-mu dicocokkan dengan kebutuhan lowongan kerja TI di Indonesia untuk 15 karier.",
  how3_t: "Baca penjelasannya", how3_d: "Lihat alasan karier cocok, kesenjangan kompetensi, dan sumbernya.",
  latest_rec: "Rekomendasi terakhir", see_all: "Lihat semua", no_assessment: "Belum ada asesmen. Mulai asesmen untuk melihat rekomendasi di sini.",
  history: "Riwayat asesmen", empty: "Kosong.",
  assess_sub: "Empat langkah singkat, sekitar 5 menit",
  st_courses: "Mata kuliah", st_skills: "Skill", st_exp: "Pengalaman", st_interests: "Minat",
  courses_t: "Mata kuliah yang sudah diambil", courses_d: "Pilih nilai untuk setiap mata kuliah yang sudah lulus. Biarkan \"—\" untuk yang belum diambil. Hanya mata kuliah yang skill-nya terverifikasi dari RPS yang ditampilkan.",
  col_course: "Mata kuliah", col_code: "Kode", col_teaches: "Skill yang diajarkan", col_grade: "Nilai",
  skills_t: "Skill teknis", skills_d: "Nilai hanya skill yang benar-benar pernah kamu gunakan. Biarkan sisanya kosong.",
  search_skill: "Cari skill…", lv_beginner: "Pem", lv_intermediate: "Men", lv_advanced: "Mah",
  lv_full_beginner: "Pemula", lv_full_intermediate: "Menengah", lv_full_advanced: "Mahir",
  skills_note: "Pemula = 0,33, Menengah = 0,67, Mahir = 1 (nilai bukti dalam skor). Klik lagi level yang dipilih untuk menghapusnya.",
  exp_t: "Pengalaman", exp_d: "Skill mana yang pernah kamu pakai saat magang, kerja, atau proyek nyata? Skill ini dihitung sebagai bukti penuh.",
  exp_empty: "Nilai minimal satu skill di langkah 2 terlebih dahulu, atau lewati langkah ini.",
  exp_text: "Ceritakan pengalamanmu", optional: "(opsional)", exp_ph: "mis. magang sebagai web developer memakai Laravel dan MySQL",
  exp_text_note: "Disimpan untuk versi berikutnya, saat skill diekstraksi dari teks ini lalu kamu konfirmasi.",
  int_t: "Bidang minat", int_d: "Pilih 1 sampai {n} bidang TI yang ingin kamu tekuni.",
  back: "Kembali", next: "Lanjut", get_rec: "Lihat rekomendasi",
  err_competency: "Isi minimal satu nilai mata kuliah (langkah 1) atau nilai minimal satu skill.", err_interest: "Pilih 1 sampai {n} bidang minat.",
  an_title: "Menyiapkan rekomendasimu", an_sub: "Menganalisis profilmu", an_body: "Input-mu sudah tersimpan. Sistem bekerja dalam empat tahap.",
  an1_t: "Membaca profil", an1_d: "Mata kuliah, nilai, skill teknis, pengalaman, dan minat.",
  an2_t: "Menghitung skor kecocokan", an2_d: "Mencocokkan skill-mu dengan skill yang dibutuhkan lowongan TI untuk 15 karier (rumus tetap).",
  an3_t: "Mengambil dokumen", an3_d: "Mencari bagian relevan pada standar kompetensi, kurikulum, dan profil karier.",
  an4_t: "Menulis penjelasan", an4_d: "Menjelaskan setiap hasil hanya dari bagian dokumen yang diambil.",
  an_note: "Prototipe P2: tahap 1–2 berjalan di server; tahap 3–4 (retrieval dan LLM) dihubungkan pada P3.",
  res_sub: "Asesmen #{id} · {date} · {n} karier diperingkat", fit_score: "Skor kecocokan",
  fit_strong: "Sangat cocok", fit_good: "Cocok", fit_developing: "Perlu dikembangkan", grad_profile: "Profil lulusan PNJ",
  k_label: "Kecocokan kompetensi (K)", m_label: "Kecocokan minat (M)", relevant: "Apakah relevan?", saved: "Tersimpan", view_details: "Lihat detail",
  how_score: "Cara skor dihitung", how_score_d: "Dihitung sistem dengan rumus tetap, bukan oleh model AI:",
  how_score_note: "K membandingkan bukti setiap skill-mu (nilai mata kuliah, penilaian diri, atau pengalaman) dengan skill yang dibutuhkan lowongan TI untuk karier tersebut, diberi bobot menurut seberapa sering dan seberapa khas skill itu diminta.",
  your_input: "Input-mu", in_courses: "Mata kuliah", in_skills: "Skill teknis", in_exp: "Pengalaman", in_int: "Minat", as_json: "Lihat sebagai JSON (API)",
  sum_fit: "{label} untuk {career}.", sum_have: "Kamu sudah memiliki {list}", sum_of_ads: "dari lowongan",
  sum_grade: "Nilai {grade} pada {course} dihitung sebagai bukti", sum_int_yes: "Minatmu sesuai dengan karier ini.",
  sum_int_no: "Karier ini di luar bidang minat yang kamu pilih.", sum_improve: "Perlu ditingkatkan: {list}.",
  back_rec: "← Kembali ke rekomendasi", detail_sub: "Detail karier · asesmen #{id}", fit_score_100: "Skor kecocokan / 100",
  gap_t: "Kesenjangan kompetensi", gap_d: "Skill yang diminta minimal 10% lowongan {career}, dibandingkan dengan buktimu (0–1).",
  col_skill: "Skill", col_ads: "Di lowongan", col_you: "Kamu", col_status: "Status",
  st_met: "Terpenuhi", st_partly: "Sebagian", st_gap: "Belum",
  ev_self: "penilaian diri: {level}", ev_exp: "pengalaman",
  next_t: "Langkah berikutnya", next_learn: "Pelajari", next_strengthen: "Perkuat", next_in_ads: "di {p}% lowongan", next_course: "mata kuliah terkait",
  next_note: "Saran personal beserta sumber akan ditulis oleh LLM pada versi berikutnya.", all_met: "Semua skill yang dibutuhkan sudah terpenuhi.",
  rel_courses: "Mata kuliah PNJ terkait", no_rel: "Belum ada mata kuliah terverifikasi yang mengajarkan skill ini.",
  basis: "Dasar rekomendasi", src_ads: "Lowongan kerja TI Indonesia — {career} ({n} lowongan)", src_ads_ex: "{n} skill teknis muncul di minimal 10% lowongan ini.",
  src_course_ex: "Pemetaan mata kuliah–skill terverifikasi: {list}.",
  industry: "Kebutuhan industri", ind_ads: "Lowongan dianalisis", ind_req: "Skill wajib (≥ 10% lowongan)", ind_cov: "Dicakup kurikulum",
  ind_src: "Sumber: empat dataset publik lowongan kerja TI Indonesia (split pembangunan).",
  kb_sub: "Admin · kelola dokumen untuk retrieval", kb_docs: "Dokumen", kb_files: "File diunggah", kb_chunks: "Chunk terindeks",
  kb_upload_t: "Unggah dokumen", kb_upload_d: "PDF, DOCX, CSV, TXT, atau MD. Pengindeksan (chunking + embedding) dilakukan di pipeline Colab.",
  kb_title: "Judul", kb_type: "Jenis", kb_file: "File", kb_upload: "Unggah", kb_list: "Dokumen sumber",
  kb_format: "Format", kb_updated: "Diperbarui", kb_status: "Status", kb_delete: "Hapus", kb_confirm: "Hapus dokumen ini?",
  kb_uploaded: "Dokumen diunggah", kb_deleted: "Dokumen dihapus", kb_bad: "Jenis file tidak diizinkan",
};

const id: Dict = { ...idBase, ...idExtra, ...idExtra2, ...idExtra3, ...idExtra4, ...idExtra5 };

// labels that come from the data files
const INTEREST_ID: Record<string, string> = {
  "Software development": "Pengembangan perangkat lunak", "Systems analysis": "Analisis sistem",
  "Databases and data management": "Basis data dan manajemen data", "Quality assurance": "Penjaminan mutu (QA)",
  "UI/UX design": "Desain UI/UX", "Data science and AI": "Sains data dan AI", "Infrastructure and cloud": "Infrastruktur dan cloud",
  "Security": "Keamanan siber", "IT service and management": "Layanan dan manajemen TI",
};
const CATEGORY_EN: Record<string, string> = {
  "Bahasa pemrograman": "Programming languages", "Web": "Web", "Mobile": "Mobile", "Basis data": "Databases",
  "Data & AI": "Data & AI", "Cloud": "Cloud", "Tools & DevOps": "Tools & DevOps", "Jaringan": "Networking",
  "Keamanan": "Security", "Testing": "Testing", "Desain": "Design", "Analisis sistem": "Systems analysis",
  "Metodologi": "Methodology", "IT Support": "IT support", "Soft skill": "Soft skills", "Bahasa": "Languages",
  "Skill umum": "General skills (O*NET)", "Pengetahuan": "Knowledge (O*NET)", "Gaya kerja": "Work styles (O*NET)",
};

// knowledge-base labels stored in the database (types, statuses and seed titles): [EN, ID]
const KB_TEXT: Record<string, [string, string]> = {
  "Curriculum": ["Curriculum", "Kurikulum"], "CPL": ["Learning outcomes (CPL)", "CPL"], "RPS": ["Course syllabus (RPS)", "RPS"],
  "Graduate profile": ["Graduate profile", "Profil lulusan"], "Career profiles": ["Career profiles", "Profil karier"],
  "Industry data": ["Industry data", "Data industri"], "Competency standard": ["Competency standard", "Standar kompetensi"],
  "Graduate outcomes": ["Graduate outcomes", "Luaran lulusan"],
  "Indexed": ["Indexed", "Terindeks"], "Processing": ["Processing", "Diproses"], "Failed": ["Failed", "Gagal"], "Uploaded": ["Uploaded", "Diunggah"],
  "Used for scoring": ["Used for scoring", "Dipakai untuk skor"], "Triangulation only": ["Triangulation only", "Hanya triangulasi"],
  "Aggregate figures only": ["Aggregate figures only", "Hanya angka agregat"],
  "Kurikulum D4 Teknik Informatika": ["D4 Informatics Engineering curriculum", "Kurikulum D4 Teknik Informatika"],
  "Capaian Pembelajaran Lulusan (CPL) Prodi TI": ["Graduate learning outcomes (CPL), Informatics", "Capaian Pembelajaran Lulusan (CPL) Prodi TI"],
  "RPS mata kuliah Prodi TI (collection)": ["Course syllabi (RPS), Informatics (collection)", "RPS mata kuliah Prodi TI (kumpulan)"],
  "Profil & kompetensi lulusan D4 TI": ["D4 Informatics graduate profile and competencies", "Profil & kompetensi lulusan D4 TI"],
  "Career profiles — 15 careers (industry needs; curriculum & standards)": ["Career profiles — 15 careers (industry needs; curriculum & standards)", "Profil karier — 15 karier (kebutuhan industri; kurikulum & standar)"],
  "SKKNI / KKNI occupational standards (ICT)": ["SKKNI / KKNI occupational standards (ICT)", "Standar okupasi SKKNI / KKNI (TIK)"],
  "Indonesian IT job ads — 4 public datasets": ["Indonesian IT job ads — 4 public datasets", "Lowongan kerja TI Indonesia — 4 dataset publik"],
  "O*NET occupation profiles": ["O*NET occupation profiles", "Profil okupasi O*NET"],
  "Tracer study CDC PNJ": ["CDC PNJ tracer study", "Tracer study CDC PNJ"],
};

export type Key = keyof Dict;
const DICTS = { en, id };

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: Key, v?: Record<string, string | number>) => string;
  interest: (s: string) => string; category: (s: string) => string; kb: (s: string) => string;
  skill: (s: string) => string; group: (code: string | null | undefined) => string };
const I18n = createContext<Ctx>(null as unknown as Ctx);

export function I18nProvider({ children }: { children: ReactNode }) {
  // the admin web and the student web keep their own language, like their own login
  const area = areaOf(usePathname());
  const langKey = `lang:${area}`;
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    try { const s = localStorage.getItem(langKey) ?? localStorage.getItem("lang"); setLangState(s === "id" ? "id" : "en"); } catch {}
  }, [langKey]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  // catalogue labels (skills, interest areas, career fields) come from the API; re-render once they arrive
  const [, setLabelsVer] = useState(0);
  useEffect(() => { api.meta().then(() => setLabelsVer((v) => v + 1)).catch(() => {}); }, []);
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem(langKey, l); } catch {} };
  const t: Ctx["t"] = (k, v) => {
    let s = DICTS[lang][k];
    if (v) for (const [a, b] of Object.entries(v)) s = s.replaceAll(`{${a}}`, String(b));
    return s;
  };
  const interest = (s: string) => (lang === "id" ? INTEREST_ID[s] || dynamicInterestId[s] || s : s);
  const category = (s: string) => (lang === "en" ? CATEGORY_EN[s] || s : s);
  const kb = (s: string) => (KB_TEXT[s] ? KB_TEXT[s][lang === "en" ? 0 : 1] : s);
  const skill = (s: string) => (lang === "id" ? dynamicSkillId[s] || s : s);
  const group = (code: string | null | undefined) => {
    const g = code ? groupNames[code] : undefined;
    return g ? (lang === "id" ? g.name_id || g.name : g.name) : "";
  };
  return <I18n.Provider value={{ lang, setLang, t, interest, category, kb, skill, group }}>{children}</I18n.Provider>;
}
export const useI18n = () => useContext(I18n);
