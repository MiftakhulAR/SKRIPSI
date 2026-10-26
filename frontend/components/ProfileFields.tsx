"use client";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Course, CourseCategory, CustomSkill, EducationLevel, Meta, ProfileCourse, TargetCareer } from "@/lib/api";
import { Key, useI18n } from "@/lib/i18n";
import { dynamicSkillId } from "@/lib/labels";
import { groupOfCategory, SKILL_GROUPS, SkillGroup } from "@/lib/skillGroups";

export type Academic = {
  courses: ProfileCourse[]; self_rated: Record<string, string>; custom_skills: CustomSkill[];
  interests: string[]; target_career: TargetCareer; education_level: EducationLevel;
};
const matches = (s: string, q: string) => s.toLowerCase().includes(q) || (dynamicSkillId[s] || "").toLowerCase().includes(q);

/* ---------------- education level (hides O*NET careers below the matching Job Zone) ---------------- */
export function EducationPicker({ value, onChange }: { value: EducationLevel; onChange: (v: EducationLevel) => void }) {
  const { t } = useI18n();
  const opts: EducationLevel[] = ["sma", "d3", "d4s1", "s2"];
  return (
    <section className="mb-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-800">{t("edu_t")}</h3>
      <p className="mt-1 text-xs text-slate-500">{t("edu_d")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {opts.map((o) => (
          <button key={o} type="button" onClick={() => onChange(o)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${value === o ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-brand-300"}`}>
            {t(`edu_${o}` as Key)}</button>
        ))}
      </div>
    </section>
  );
}

const LEVELS = ["beginner", "intermediate", "advanced"] as const;
type Level = (typeof LEVELS)[number];
const LEVEL_STYLE: Record<Level, string> = {
  beginner: "bg-sky-50 text-sky-700 border-sky-200",
  intermediate: "bg-violet-50 text-violet-700 border-violet-200",
  advanced: "bg-emerald-50 text-emerald-700 border-emerald-200",
};
const CAT_STYLE: Record<CourseCategory, string> = {
  university: "bg-amber-50 text-amber-700 border-amber-200",
  faculty: "bg-sky-50 text-sky-700 border-sky-200",
  program: "bg-brand-50 text-brand-700 border-brand-200",
  elective: "bg-teal-50 text-teal-700 border-teal-200",
};
const field = "rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300";
const norm = (s: string) => s.trim().toLowerCase();

/* ---------------- reusable: search the skill dictionary ---------------- */
export function SkillSearch({ meta, exclude = [], onPick, placeholder, allowCustom }: {
  meta: Pick<Meta, "skills_by_category">; exclude?: string[]; onPick: (skill: string, custom: boolean) => void; placeholder?: string; allowCustom?: boolean;
}) {
  const { t, skill } = useI18n();
  const [q, setQ] = useState("");
  const all = useMemo(() => Object.values(meta.skills_by_category).flat(), [meta]);
  const hits = q.trim() ? all.filter((s) => matches(s, norm(q)) && !exclude.includes(s)).slice(0, 8) : [];
  const exact = all.find((s) => norm(s) === norm(q) || norm(dynamicSkillId[s] || "") === norm(q));
  const pick = (s: string, custom: boolean) => { onPick(s, custom); setQ(""); };
  return (
    <div className="relative">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder || t("search_skill")}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (exact) pick(exact, false); else if (hits[0]) pick(hits[0], false); else if (allowCustom && q.trim()) pick(q.trim(), true); } }}
        className={`w-full ${field} py-1.5`} />
      {q.trim() && (hits.length > 0 || allowCustom) && (
        <ul className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {hits.map((s) => <li key={s}><button type="button" onClick={() => pick(s, false)} className="w-full px-3 py-1.5 text-left hover:bg-brand-50">{skill(s)}{skill(s) !== s && <span className="ml-1 text-xs text-slate-400">{s}</span>}</button></li>)}
          {allowCustom && !exact && (
            <li className="border-t border-slate-100"><button type="button" onClick={() => pick(q.trim(), true)} className="w-full px-3 py-1.5 text-left text-slate-600 hover:bg-amber-50">
              {t("sk_add_own", { s: q.trim() })}</button></li>
          )}
        </ul>
      )}
    </div>
  );
}

/* ---------------- courses: template list + courses typed by the student ---------------- */
function gpa(courses: ProfileCourse[], points: Record<string, number>) {
  const withSks = courses.filter((c) => c.sks);
  if (withSks.length) {
    const sks = withSks.reduce((a, c) => a + (c.sks || 0), 0);
    return { value: withSks.reduce((a, c) => a + points[c.grade] * (c.sks || 0), 0) / sks, sks };
  }
  return courses.length ? { value: courses.reduce((a, c) => a + points[c.grade], 0) / courses.length, sks: 0 } : null;
}

export function CourseList({ meta, value, onChange }: { meta: Meta; value: ProfileCourse[]; onChange: (v: ProfileCourse[]) => void }) {
  const { t, skill } = useI18n();
  const programs = useMemo(() => [...new Set(meta.courses.map((c) => c.program || "—"))], [meta]);
  const [program, setProgram] = useState(programs[0] || "");
  const [showTpl, setShowTpl] = useState(value.length === 0 || value.some((c) => c.template));
  const [draft, setDraft] = useState({ name: "", category: "program" as CourseCategory, sks: "", grade: "" });
  const byTpl = useMemo(() => Object.fromEntries(value.filter((c) => c.template).map((c) => [c.template!, c])), [value]);
  const custom = value.filter((c) => !c.template);

  const groups = useMemo(() => {
    const m = new Map<number, Course[]>();
    for (const c of meta.courses.filter((c) => (c.program || "—") === program)) { const k = c.semester ?? 99; m.set(k, [...(m.get(k) || []), c]); }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [meta, program]);

  const setTpl = (c: Course, patch: Partial<ProfileCourse> | null) => {
    const cur = byTpl[c.code];
    if (!patch || patch.grade === "") return onChange(value.filter((x) => x.template !== c.code));
    if (cur) return onChange(value.map((x) => (x.template === c.code ? { ...x, ...patch } : x)));
    onChange([...value, { id: c.code, template: c.code, name: c.name, category: c.category || "program", sks: c.sks, semester: c.semester,
      grade: patch.grade || "", skills: c.skills, ...patch }]);
  };
  const setCustom = (id: string, patch: Partial<ProfileCourse> | null) =>
    onChange(patch ? value.map((x) => (x.id === id ? { ...x, ...patch } : x)) : value.filter((x) => x.id !== id));
  const addCustom = () => {
    if (!draft.name.trim() || !draft.grade) return;
    if (value.some((x) => norm(x.name) === norm(draft.name))) return;
    onChange([...value, { id: `c${Date.now().toString(36)}`, template: null, name: draft.name.trim(), category: draft.category,
      sks: draft.sks ? Number(draft.sks) : null, semester: null, grade: draft.grade, skills: [] }]);
    setDraft({ name: "", category: draft.category, sks: "", grade: "" });
  };

  const g = gpa(value, meta.grade_points);
  const perCat = meta.course_categories.map((k) => [k, value.filter((c) => c.category === k).length] as const);
  const catSelect = (v: CourseCategory, on: (c: CourseCategory) => void, small = false) => (
    <select value={v} onChange={(e) => on(e.target.value as CourseCategory)} className={`${field} ${small ? "py-0.5 text-xs" : ""}`}>
      {meta.course_categories.map((k) => <option key={k} value={k}>{t(`cc_${k}` as Key)}</option>)}
    </select>
  );
  const gradeSelect = (v: string, on: (g: string) => void, allowEmpty = true) => (
    <select value={v} onChange={(e) => on(e.target.value)} className={`${field} ${v ? "border-brand-400 font-semibold text-brand-700" : ""}`}>
      {allowEmpty && <option value="">—</option>}
      {meta.grades.map((x) => <option key={x} value={x}>{x}</option>)}
    </select>
  );

  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900">{t("courses_t")}</h2>
      <p className="mt-1 text-sm text-slate-500">{t("courses_d2")}</p>

      {/* summary */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 p-4"><p className="text-2xl font-bold tabular-nums text-slate-900">{value.length}</p><p className="text-xs text-slate-500">{t("cs_courses")}</p></div>
        <div className="rounded-xl border border-slate-200 p-4"><p className="text-2xl font-bold tabular-nums text-slate-900">{g?.sks || "—"}</p><p className="text-xs text-slate-500">{t("cs_sks")}</p></div>
        <div className="rounded-xl border border-slate-200 p-4"><p className="text-2xl font-bold tabular-nums text-slate-900">{g ? g.value.toFixed(2) : "—"}</p><p className="text-xs text-slate-500">{g?.sks ? t("cs_gpa") : t("cs_gpa_plain")}</p></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {perCat.map(([k, n]) => <span key={k} className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${CAT_STYLE[k]}`}>{t(`cc_${k}` as Key)}: {n}</span>)}
      </div>
      <details className="mt-3 rounded-lg bg-slate-50 px-4 py-2 text-xs text-slate-600">
        <summary className="cursor-pointer font-medium text-slate-700">{t("cc_help_t")}</summary>
        <ul className="mt-2 space-y-1">{meta.course_categories.map((k) => <li key={k}><b>{t(`cc_${k}` as Key)}</b> — {t(`cc_${k}_d` as Key)}</li>)}</ul>
        <p className="mt-2 text-slate-400">{t("cc_help_note")}</p>
      </details>

      {/* courses typed by the student */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-slate-800">{t("cs_own_t")}</h3>
        <p className="mt-1 text-xs text-slate-500">{t("cs_own_d")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-brand-300 bg-brand-50/40 p-3">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t("cs_name_ph")}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} className={`${field} min-w-[14rem] flex-1 py-1.5`} />
          {catSelect(draft.category, (c) => setDraft({ ...draft, category: c }))}
          <input value={draft.sks} onChange={(e) => setDraft({ ...draft, sks: e.target.value.replace(/\D/g, "").slice(0, 2) })} placeholder={t("cs_sks_ph")} inputMode="numeric" className={`${field} w-20`} />
          {gradeSelect(draft.grade, (x) => setDraft({ ...draft, grade: x }))}
          <button type="button" onClick={addCustom} disabled={!draft.name.trim() || !draft.grade}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40">{t("cs_add")}</button>
        </div>
        <div className="mt-3 space-y-2">
          {custom.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="mr-auto font-medium text-slate-800">{c.name}</p>
                {catSelect(c.category, (x) => setCustom(c.id, { category: x }), true)}
                <input value={c.sks ?? ""} onChange={(e) => setCustom(c.id, { sks: e.target.value ? Number(e.target.value.replace(/\D/g, "").slice(0, 2)) : null })}
                  placeholder="SKS" inputMode="numeric" className={`${field} w-16 py-0.5 text-xs`} />
                {gradeSelect(c.grade, (x) => setCustom(c.id, { grade: x }), false)}
                <button type="button" onClick={() => setCustom(c.id, null)} title={t("remove")} className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="x" className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-500">{t("cs_skills")}:</span>
                {c.skills.map((s) => (
                  <button key={s} type="button" onClick={() => setCustom(c.id, { skills: c.skills.filter((x) => x !== s) })}
                    className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs text-brand-700">{skill(s)}<Icon name="x" className="h-3 w-3 opacity-50" /></button>
                ))}
                <div className="w-48"><SkillSearch meta={meta} exclude={c.skills} placeholder={t("cs_skill_ph")} onPick={(s) => setCustom(c.id, { skills: [...c.skills, s] })} /></div>
              </div>
              {c.skills.length === 0 && <p className="mt-2 text-xs text-amber-600">{t("cs_no_skill")}</p>}
            </div>
          ))}
          {custom.length === 0 && <p className="text-xs text-slate-400">{t("cs_own_none")}</p>}
        </div>
      </div>

      {/* template courses */}
      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{t("cs_tpl_t")}</h3>
            <p className="mt-1 text-xs text-slate-500">{t("cs_tpl_d")}</p>
          </div>
          <div className="flex items-center gap-2">
            {programs.length > 1 && <select value={program} onChange={(e) => setProgram(e.target.value)} className={field}>{programs.map((p) => <option key={p}>{p}</option>)}</select>}
            <button type="button" onClick={() => setShowTpl(!showTpl)} className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-brand-300">
              {showTpl ? t("cs_tpl_hide") : t("cs_tpl_show", { p: program })}</button>
          </div>
        </div>
        {showTpl && (
          <div className="mt-4 space-y-5">
            {groups.map(([sem, list]) => {
              const filled = list.filter((c) => byTpl[c.code]).length;
              return (
                <div key={sem} className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5">
                    <h4 className="text-sm font-semibold text-slate-800">{sem === 99 ? t("sem_other") : t("sem_n", { n: sem })}</h4>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${filled ? "bg-brand-100 text-brand-700" : "bg-white text-slate-400"}`}>{t("sem_filled", { a: filled, b: list.length })}</span>
                  </div>
                  <table className="w-full text-sm"><tbody>
                    {list.map((c) => {
                      const cur = byTpl[c.code];
                      return (
                        <tr key={c.code} className={`border-t border-slate-100 ${cur ? "bg-brand-50/40" : ""}`}>
                          <td className="py-2.5 pl-4 pr-3">
                            <p className="font-medium text-slate-800">{c.name}{c.semester_inferred && <span title={t("sem_inferred")} className="ml-1 cursor-help text-xs text-amber-500">*</span>}</p>
                            <p className="text-xs text-slate-400">{c.code} · {c.skills.map(skill).join(", ")}</p>
                          </td>
                          <td className="py-2.5 pr-2 text-right whitespace-nowrap">
                            {cur && <span className="inline-flex gap-1.5">
                              {catSelect(cur.category, (x) => setTpl(c, { category: x }), true)}
                              <input value={cur.sks ?? ""} onChange={(e) => setTpl(c, { sks: e.target.value ? Number(e.target.value.replace(/\D/g, "").slice(0, 2)) : null })}
                                placeholder="SKS" inputMode="numeric" className={`${field} w-14 py-0.5 text-xs`} />
                            </span>}
                          </td>
                          <td className="w-24 py-2.5 pr-4 text-right">{gradeSelect(cur?.grade || "", (x) => setTpl(c, x ? { grade: x } : null))}</td>
                        </tr>
                      );
                    })}
                  </tbody></table>
                </div>
              );
            })}
            {meta.courses.some((c) => c.semester_inferred) && <p className="text-xs text-slate-400"><span className="text-amber-500">*</span> {t("sem_inferred")}</p>}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------- skills: category tabs + cards with a level meter + own skills ---------------- */
function LevelMeter({ value, onPick }: { value?: string; onPick: (lv: Level) => void }) {
  const { t } = useI18n();
  const idx = value ? LEVELS.indexOf(value as Level) : -1;
  return (
    <div className="flex items-end gap-1" role="radiogroup">
      {LEVELS.map((lv, i) => (
        <button key={lv} type="button" role="radio" aria-checked={value === lv} title={t(`lvl_${lv}` as Key)} onClick={() => onPick(lv)}
          className={`w-3.5 rounded-sm transition-colors ${i === 0 ? "h-3" : i === 1 ? "h-4" : "h-5"} ${i <= idx ? "bg-brand-600" : "bg-slate-200 hover:bg-brand-300"}`} />
      ))}
    </div>
  );
}

export function SkillLevels({ meta, value, custom, onChange, onCustom }: {
  meta: Meta; value: Record<string, string>; custom: CustomSkill[];
  onChange: (v: Record<string, string>) => void; onCustom: (v: CustomSkill[]) => void;
}) {
  const { t, category, skill } = useI18n();
  const [q, setQ] = useState("");
  const [grp, setGrp] = useState<SkillGroup | "">("it");
  const [cat, setCat] = useState("");
  const [lvl, setLvl] = useState<Level>("intermediate");
  const cats = Object.keys(meta.skills_by_category);
  const groups = SKILL_GROUPS.filter((g) => cats.some((c) => groupOfCategory(c) === g));
  const catsIn = (g: SkillGroup | "") => cats.filter((c) => !g || groupOfCategory(c) === g);
  const ratedIn = (cs: string[]) => cs.reduce((n, c) => n + meta.skills_by_category[c].filter((s) => value[s]).length, 0);
  const list = useMemo(() => {
    const src = (cat ? [cat] : catsIn(grp)).flatMap((c) => meta.skills_by_category[c]);
    return src.filter((s) => matches(s, q.toLowerCase()));
  }, [meta, grp, cat, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickGroup = (g: SkillGroup | "") => { setGrp(g); setCat(""); };
  const tab = (on: boolean, small = false) => `rounded-full border ${small ? "px-2.5 py-1" : "px-3.5 py-1.5"} text-xs font-medium ${on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"}`;
  const badge = (on: boolean, n: number) => n > 0 && <span className={`ml-1.5 rounded-full px-1.5 ${on ? "bg-white/25" : "bg-brand-100 text-brand-700"}`}>{n}</span>;
  const set = (s: string, lv: string) => { const r = { ...value }; if (r[s] === lv) delete r[s]; else r[s] = lv; onChange(r); };
  const rated = Object.entries(value);
  const soft = new Set(meta.soft_skills);

  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900">{t("skills_t2")}</h2>
      <p className="text-sm text-slate-500 mt-1">{t("skills_d2")}</p>

      <div className="mt-5 rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">{t("sk_selected")} <span className="ml-1 rounded-full bg-brand-600 px-2 py-0.5 text-xs text-white">{rated.length + custom.length}</span></h3>
          <div className="hidden sm:flex gap-2 text-[11px]">
            {LEVELS.map((lv) => <span key={lv} className={`rounded-full border px-2 py-0.5 ${LEVEL_STYLE[lv]}`}>{t(`lvl_${lv}` as Key)}</span>)}
          </div>
        </div>
        {rated.length + custom.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {rated.map(([s, lv]) => (
              <button key={s} type="button" onClick={() => set(s, lv)}
                className={`group inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${LEVEL_STYLE[lv as Level]}`}>
                {skill(s)}{soft.has(s) && <span className="rounded bg-white/70 px-1 text-[10px]">soft</span>}<span className="opacity-40 group-hover:opacity-100"><Icon name="x" className="h-3 w-3" /></span>
              </button>
            ))}
            {custom.map((c) => (
              <button key={c.name} type="button" onClick={() => onCustom(custom.filter((x) => x.name !== c.name))} title={t("sk_own_note")}
                className={`group inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium ${LEVEL_STYLE[c.level as Level]}`}>
                {c.name}<span className="rounded bg-white/70 px-1 text-[10px] text-amber-700">{t("sk_own_badge")}</span><span className="opacity-40 group-hover:opacity-100"><Icon name="x" className="h-3 w-3" /></span>
              </button>
            ))}
          </div>
        ) : <p className="mt-2 text-sm text-slate-400">{t("sk_none")}</p>}
      </div>

      {/* add a skill by typing (dictionary or own) */}
      <div className="mt-5 rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-800">{t("sk_type_t")}</h3>
        <p className="mt-1 text-xs text-slate-500">{t("sk_type_d")}</p>
        <div className="mt-3 flex flex-wrap items-start gap-2">
          <div className="w-full sm:w-80"><SkillSearch meta={meta} allowCustom exclude={Object.keys(value)} placeholder={t("sk_type_ph")}
            onPick={(s, own) => {
              if (!own) { onChange({ ...value, [s]: lvl }); return; }
              if (!custom.some((c) => norm(c.name) === norm(s))) onCustom([...custom, { name: s, level: lvl }]);
            }} /></div>
          <div className="flex gap-1">
            {LEVELS.map((l) => <button key={l} type="button" onClick={() => setLvl(l)}
              className={`rounded-md border px-2 py-1 text-xs font-medium ${lvl === l ? LEVEL_STYLE[l] + " ring-1 ring-current" : "border-slate-200 text-slate-500"}`}>{t(`lvl_${l}` as Key)}</button>)}
          </div>
        </div>
      </div>

      {/* level 1: skill group (IT / soft / general); level 2: the categories inside the chosen group */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => pickGroup("")} className={tab(grp === "")}>{t("sk_all")}{badge(grp === "", rated.length)}</button>
        {groups.map((g) => (
          <button key={g} type="button" onClick={() => pickGroup(g)} className={tab(grp === g)}>{t(`skg_${g}` as Key)}{badge(grp === g, ratedIn(catsIn(g)))}</button>
        ))}
      </div>
      {grp && catsIn(grp).length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-50 p-2">
          <button type="button" onClick={() => setCat("")} className={tab(cat === "", true)}>{t("skg_all_in", { g: t(`skg_${grp}` as Key) })}</button>
          {catsIn(grp).map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} className={tab(cat === c, true)}>{category(c)}{badge(cat === c, ratedIn([c]))}</button>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search_skill")}
          className="w-full sm:w-72 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
        <span className="text-xs text-slate-400">{t("sk_levels_hint")}</span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
        {list.map((s) => {
          const lv = value[s] as Level | undefined;
          return (
            <div key={s} className={`rounded-xl border p-3 transition ${lv ? "border-brand-300 bg-brand-50/60 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-medium ${lv ? "text-brand-800" : "text-slate-800"}`} title={s}>{skill(s)}{soft.has(s) && <span className="ml-1.5 rounded bg-teal-50 px-1 text-[10px] font-medium text-teal-700">soft</span>}</span>
                <LevelMeter value={lv} onPick={(l) => set(s, l)} />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1">
                {LEVELS.map((l) => (
                  <button key={l} type="button" onClick={() => set(s, l)} title={t(`lvl_${l}` as Key)}
                    className={`truncate rounded-md border px-1 py-1 text-[11px] font-medium ${lv === l ? LEVEL_STYLE[l] + " ring-1 ring-current" : "border-slate-200 text-slate-500 hover:border-brand-300 hover:text-brand-700"}`}>
                    {t(`lvl_${l}` as Key)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-slate-400">{t("skills_note")} {t("sk_own_note")}</p>
    </section>
  );
}

/* ---------------- interests (suggestions + free text) and target career ---------------- */
export function InterestPicker({ meta, value, onChange }: { meta: Meta; value: string[]; onChange: (v: string[]) => void }) {
  const { t, interest } = useI18n();
  const [q, setQ] = useState("");
  const [find, setFind] = useState("");
  const full = value.length >= meta.max_interests;
  const canonical = (text: string) => meta.interest_areas.find((a) => norm(a) === norm(text) || norm(meta.interest_labels[a] || "") === norm(text)) || text.trim();
  const toggle = (s: string) => {
    if (value.includes(s)) onChange(value.filter((x) => x !== s));
    else if (!full) onChange([...value, s]);
  };
  const addText = () => {
    const s = canonical(q);
    if (!s || full || value.some((v) => norm(v) === norm(s))) return;
    onChange([...value, s.slice(0, 60)]); setQ("");
  };
  const own = value.filter((v) => !meta.interest_areas.includes(v));
  return (
    <section>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t("int_t")}</h2>
          <p className="text-sm text-slate-500 mt-1">{t("int_d2", { n: meta.max_interests })}</p>
        </div>
        <span className="shrink-0 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-700">{value.length}/{meta.max_interests}</span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} disabled={full} placeholder={t("int_ph")}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addText(); } }} className={`${field} w-full py-1.5 sm:w-80`} />
        <button type="button" onClick={addText} disabled={full || !q.trim()} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">{t("cs_add")}</button>
      </div>
      {own.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {own.map((s) => (
            <button key={s} type="button" onClick={() => toggle(s)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
              {s}<Icon name="x" className="h-3 w-3 opacity-50" /></button>
          ))}
          <p className="w-full text-xs text-amber-700">{t("int_own_note")}</p>
        </div>
      )}

      {([["it", "int_group_it"], ["other", "int_group_all"]] as [string, Key][]).map(([grp, label]) => {
        const list = meta.interest_areas.filter((s) => (meta.interest_sources[s] === "it") === (grp === "it"))
          .filter((s) => grp === "it" || !find.trim() || s.toLowerCase().includes(norm(find)) || interest(s).toLowerCase().includes(norm(find)));
        return (
      <div key={grp}>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t(label)}</h3>
        {grp !== "it" && <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder={t("int_find")} className={`${field} w-56 py-1 text-xs`} />}
      </div>
      <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {list.map((s) => {
          const on = value.includes(s), order = value.indexOf(s) + 1;
          return (
            <button key={s} type="button" onClick={() => toggle(s)} disabled={!on && full}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left text-sm transition ${on ? "border-brand-400 bg-brand-50 text-brand-800 shadow-sm" : "border-slate-200 bg-white hover:border-brand-300 disabled:opacity-40"}`}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${on ? "bg-brand-600 text-white" : "border border-slate-300 text-transparent"}`}>{on ? order : "·"}</span>
              <span className="font-medium">{interest(s)}</span>
            </button>
          );
        })}
      </div>
      </div>
        );
      })}
    </section>
  );
}

export function TargetPicker({ meta, value, onChange }: { meta: Meta; value: TargetCareer; onChange: (v: TargetCareer) => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const hits = q.trim() ? meta.careers.filter((c) => c.name.toLowerCase().includes(norm(q)) || (c.name_id || "").toLowerCase().includes(norm(q))).slice(0, 10) : [];
  const exact = meta.careers.find((c) => norm(c.name) === norm(q));
  return (
    <section className="mt-10 border-t border-slate-100 pt-8">
      <h2 className="text-lg font-semibold text-slate-900">{t("tg_t")} <span className="text-sm font-normal text-slate-400">{t("optional")}</span></h2>
      <p className="mt-1 text-sm text-slate-500">{t("tg_d")}</p>
      {value ? (
        <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${value.slug ? "border-brand-300 bg-brand-50" : "border-amber-300 bg-amber-50"}`}>
          <div>
            <p className="font-semibold text-slate-900">{value.name}</p>
            <p className={`text-xs ${value.slug ? "text-brand-700" : "text-amber-700"}`}>{value.slug ? t("tg_in_catalog") : t("tg_not_catalog")}</p>
          </div>
          <button type="button" onClick={() => onChange(null)} className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-rose-300 hover:text-rose-600">{t("tg_clear")}</button>
        </div>
      ) : (
        <div className="relative mt-4 max-w-md">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("tg_ph")} className={`${field} w-full py-1.5`}
            onKeyDown={(e) => { if (e.key === "Enter" && q.trim()) { e.preventDefault(); onChange(exact ? { slug: exact.slug, name: exact.name } : { slug: null, name: q.trim() }); setQ(""); } }} />
          {q.trim() && (
            <ul className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
              {hits.map((c) => <li key={c.slug}><button type="button" onClick={() => { onChange({ slug: c.slug, name: c.name }); setQ(""); }} className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-brand-50">
                {c.name}{c.tier === "reference" && <span className="text-[10px] text-slate-400">{t("tier_reference")}</span>}</button></li>)}
              {!exact && <li className="border-t border-slate-100"><button type="button" onClick={() => { onChange({ slug: null, name: q.trim() }); setQ(""); }} className="w-full px-3 py-1.5 text-left text-slate-600 hover:bg-amber-50">{t("tg_use_text", { s: q.trim() })}</button></li>}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
