"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Pager, usePaged } from "@/components/Pager";
import { SkillSearch } from "@/components/ProfileFields";
import { Loading, Page } from "@/components/Shell";
import { api, Catalog, CatCareerFull, Course, CourseCategory, Tier } from "@/lib/api";
import { Key, useI18n } from "@/lib/i18n";
import { groupOfCategory, SKILL_GROUPS } from "@/lib/skillGroups";

/** Admin: add, edit and delete the catalogue the system uses (careers, skills, interest areas, course templates). */
type Tab = "careers" | "skills" | "interests" | "courses";
const field = "rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300";
const btn = "rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40";
const btn2 = "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-brand-300";

function errText(e: unknown, t: (k: Key, v?: Record<string, string | number>) => string) {
  const d = (e as { body?: { detail?: unknown } })?.body?.detail;
  if (typeof d === "string") return t(`err_${d}` as Key) || d;
  const o = d as { errors?: string[]; used_by?: string[]; skills?: string[]; interest_areas?: string[] } | undefined;
  if (o?.errors?.[0] === "in_use") return t("ad_in_use", { list: (o.used_by || []).join(", ") });
  if (o?.errors?.[0] === "unknown_items") return t("ad_unknown", { list: [...(o.skills || []), ...(o.interest_areas || [])].join(", ") });
  return t("api_error");
}

function Confirm({ label, onYes, disabled }: { label: string; onYes: () => void; disabled?: boolean }) {
  const { t } = useI18n();
  const [ask, setAsk] = useState(false);
  if (!ask) return <button type="button" disabled={disabled} onClick={() => setAsk(true)} className="text-xs font-medium text-rose-600 hover:underline disabled:text-slate-300 disabled:no-underline">{label}</button>;
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className="text-slate-500">{t("ad_sure")}</span>
      <button type="button" onClick={() => { setAsk(false); onYes(); }} className="font-semibold text-rose-600 hover:underline">{t("ad_yes")}</button>
      <button type="button" onClick={() => setAsk(false)} className="text-slate-500 hover:underline">{t("ad_no")}</button>
    </span>
  );
}

/* ---------------- career editor ---------------- */
type Draft = Omit<CatCareerFull, "scored" | "updated_at"> & { isNew: boolean };
const emptyCareer = (): Draft => ({ isNew: true, slug: "", name: "", name_id: null, tier: "reference", source: "", onet_soc: "", graduate_profile: false,
  interest_areas: [], n_ads: 0, coverage_pct: null, description: "", skills: [], job_zone: null, group_code: null });

function CareerEditor({ cat, draft, onCancel, onSaved }: { cat: Catalog; draft: Draft; onCancel: () => void; onSaved: (c: Catalog) => void }) {
  const { t, interest, skill } = useI18n();
  const [d, setD] = useState<Draft>(draft);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const skillMeta = useMemo(() => ({ skills_by_category: { all: cat.skills.map((s) => s.name) } }), [cat]);
  const set = (p: Partial<Draft>) => setD({ ...d, ...p });
  const setSkill = (i: number, p: Partial<Draft["skills"][number]>) => set({ skills: d.skills.map((s, j) => (j === i ? { ...s, ...p } : s)) });

  async function save() {
    setBusy(true); setErr("");
    try {
      const { isNew, slug, ...body } = d;
      onSaved(await api.saveCareer({ ...body, source: body.source || null, onet_soc: body.onet_soc || null, description: body.description || null }, isNew ? undefined : slug));
    } catch (e) { setErr(errText(e, t)); }
    setBusy(false);
  }
  const ok = d.name.trim().length >= 2 && d.interest_areas.length > 0 && d.skills.length > 0 && d.skills.every((s) => s.w > 0);

  return (
    <section className="rounded-2xl border border-brand-200 bg-white p-6 shadow-sm">
      <h3 className="font-semibold text-slate-900">{d.isNew ? t("ad_car_new") : t("ad_car_edit", { name: draft.name })}</h3>
      {!d.isNew && d.tier === "validated" && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{t("ad_car_validated_warn")}</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm">
        <label className="block font-medium text-slate-700">{t("ad_name")}<input value={d.name} onChange={(e) => set({ name: e.target.value })} className={`mt-1 w-full ${field}`} placeholder="Accountant" /></label>
        <label className="block font-medium text-slate-700">{t("ad_tier")}
          <select value={d.tier} onChange={(e) => set({ tier: e.target.value as Tier })} className={`mt-1 w-full ${field}`}>
            {cat.tiers.map((x) => <option key={x} value={x}>{t(`tier_${x}` as Key)}</option>)}
          </select>
          <span className="mt-1 block text-xs font-normal text-slate-400">{t(`tier_${d.tier}_d` as Key)}</span>
        </label>
        <label className="block font-medium text-slate-700">{t("ad_source")}<input value={d.source || ""} onChange={(e) => set({ source: e.target.value })} className={`mt-1 w-full ${field}`} placeholder="O*NET 30.0 — 13-2011.00" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block font-medium text-slate-700">{t("ad_onet")}<input value={d.onet_soc || ""} onChange={(e) => set({ onet_soc: e.target.value })} className={`mt-1 w-full ${field}`} placeholder="13-2011.00" /></label>
          <label className="block font-medium text-slate-700">{t("ind_ads")}<input value={d.n_ads} onChange={(e) => set({ n_ads: Number(e.target.value.replace(/\D/g, "")) || 0 })} inputMode="numeric" className={`mt-1 w-full ${field}`} /></label>
        </div>
        <label className="block font-medium text-slate-700 md:col-span-2">{t("ad_desc")}<textarea rows={2} value={d.description || ""} onChange={(e) => set({ description: e.target.value })} className={`mt-1 w-full ${field}`} /></label>
        <label className="flex items-center gap-2 text-slate-700"><input type="checkbox" checked={d.graduate_profile} onChange={(e) => set({ graduate_profile: e.target.checked })} className="h-4 w-4 accent-brand-600" />{t("grad_profile")}</label>
      </div>

      <h4 className="mt-6 text-sm font-semibold text-slate-800">{t("ad_areas")}</h4>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {cat.interest_areas.map((a) => {
          const on = d.interest_areas.includes(a.name);
          return <button key={a.name} type="button" onClick={() => set({ interest_areas: on ? d.interest_areas.filter((x) => x !== a.name) : [...d.interest_areas, a.name] })}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-600 hover:border-brand-300"}`}>{interest(a.name)}</button>;
        })}
      </div>

      <h4 className="mt-6 text-sm font-semibold text-slate-800">{t("ad_req_skills")}</h4>
      <p className="mt-1 text-xs text-slate-500">{t("ad_req_skills_d")}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500"><th className="py-2 pr-3">{t("col_skill")}</th><th className="py-2 pr-3">{t("ad_weight")}</th><th className="py-2 pr-3">{t("col_ads")} (%)</th><th /></tr></thead>
          <tbody>
            {d.skills.map((s, i) => (
              <tr key={s.skill} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium text-slate-800">{skill(s.skill)}{skill(s.skill) !== s.skill && <span className="block text-xs font-normal text-slate-400">{s.skill}</span>}</td>
                <td className="py-2 pr-3"><input type="number" step="0.05" min="0" max="10" value={s.w} onChange={(e) => setSkill(i, { w: Number(e.target.value) })} className={`${field} w-24 py-1`} /></td>
                <td className="py-2 pr-3"><input type="number" step="1" min="0" max="100" value={s.demand_pct ?? ""} onChange={(e) => setSkill(i, { demand_pct: e.target.value === "" ? null : Number(e.target.value) })} className={`${field} w-24 py-1`} placeholder="—" /></td>
                <td className="py-2 text-right"><button type="button" onClick={() => set({ skills: d.skills.filter((_, j) => j !== i) })} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="x" className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 w-72"><SkillSearch meta={skillMeta} exclude={d.skills.map((s) => s.skill)} placeholder={t("ad_add_skill")}
        onPick={(s) => set({ skills: [...d.skills, { skill: s, w: 0.5, demand_pct: null }] })} /></div>
      <p className="mt-2 text-xs text-slate-400">{t("ad_skill_missing")}</p>

      {err && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
      <div className="mt-6 flex gap-2"><button type="button" onClick={save} disabled={busy || !ok} className={btn}>{t("ad_save")}</button><button type="button" onClick={onCancel} className={btn2}>{t("ad_cancel")}</button></div>
    </section>
  );
}

/* ---------------- course template editor ---------------- */
type CourseDraft = Omit<Course, "semester_inferred">;
const emptyCourse = (program = ""): CourseDraft => ({ code: "", name: "", program, semester: null, category: "program", sks: null, skills: [] });

export default function CatalogueAdmin() {
  const { t, interest, category, group } = useI18n();
  const [cat, setCat] = useState<Catalog | null>(null);
  const [cq, setCq] = useState("");
  const [ctier, setCtier] = useState("validated");          // the 15 validated careers first; ~900 O*NET references on request
  const [cgrp, setCgrp] = useState("");
  const [skCat, setSkCat] = useState("");
  const [skKind, setSkKind] = useState("");
  const [tab, setTab] = useState<Tab>("careers");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [newSkill, setNewSkill] = useState({ name: "", category: "", kind: "hard" });
  const [newArea, setNewArea] = useState({ name: "", name_id: "" });
  const [course, setCourse] = useState<CourseDraft | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => { api.catalog().then(setCat).catch(() => setErr(t("api_error"))); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cql = cq.trim().toLowerCase();
  const ql = q.trim().toLowerCase();
  const careersShown = useMemo(() => (cat?.careers ?? []).filter((c) => (!ctier || c.tier === ctier) && (!cgrp || c.group_code === cgrp)
    && (!cql || c.name.toLowerCase().includes(cql) || (c.onet_soc || "").includes(cql))), [cat, ctier, cgrp, cql]);
  const skillsShown = useMemo(() => (cat?.skills ?? []).filter((s) => (!skCat || s.category === skCat) && (!skKind || s.kind === skKind)
    && (!ql || s.name.toLowerCase().includes(ql) || (s.name_id || "").toLowerCase().includes(ql))), [cat, skCat, skKind, ql]);
  const coursesShown = useMemo(() => (cat?.courses ?? []).filter((c) => !ql || c.name.toLowerCase().includes(ql) || c.code.toLowerCase().includes(ql)), [cat, ql]);
  const careerPg = usePaged(careersShown, 20, `${ctier}|${cgrp}|${cql}`);
  const skillPg = usePaged(skillsShown, 25, `${skCat}|${skKind}|${ql}`);
  const areaPg = usePaged(cat?.interest_areas ?? [], 25, tab);
  const coursePg = usePaged(coursesShown, 20, ql);

  async function run(p: Promise<Catalog>, okText: Key = "ad_saved") {
    setMsg(null);
    try { setCat(await p); setMsg({ ok: true, text: t(okText) }); return true; }
    catch (e) { setMsg({ ok: false, text: errText(e, t) }); return false; }
  }

  if (!cat) return <Page heading={t("cat_t")}><Loading error={err} /></Page>;
  const categories = [...new Set(cat.skills.map((s) => s.category))];
  const skillMeta = { skills_by_category: { all: cat.skills.map((s) => s.name) } };
  const TABS: [Tab, Key, number][] = [["careers", "ad_tab_careers", cat.careers.length], ["skills", "ad_tab_skills", cat.skills.length],
    ["interests", "ad_tab_interests", cat.interest_areas.length], ["courses", "ad_tab_courses", cat.courses.length]];
  const tierCount = (x: string) => cat.careers.filter((c) => !x || c.tier === x).length;

  return (
    <Page heading={t("cat_t")} sub={t("cat_d2")} crumbs={[{ label: t("nav_admin") }, { label: t("nav_catalogue") }]}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {TABS.map(([k, label, n]) => (
              <button key={k} onClick={() => { setTab(k); setMsg(null); setQ(""); }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                {t(label)} <span className={`ml-1 rounded-full px-1.5 text-xs ${tab === k ? "bg-white/25" : "bg-slate-100"}`}>{n}</span></button>
            ))}
          </div>
          <span className="flex items-center gap-3 text-xs text-slate-500">{t("ad_reset_d")}
            <Confirm label={t("ad_reset")} onYes={() => { setEditing(null); setCourse(null); run(api.catalogReset(), "ad_reset_done"); }} /></span>
        </div>
        {msg && <div className={`rounded-lg border px-4 py-3 text-sm ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{msg.text}</div>}

        {tab === "careers" && (
          <>
            {editing ? <CareerEditor key={editing.slug || "new"} cat={cat} draft={editing} onCancel={() => setEditing(null)}
              onSaved={(c) => { setCat(c); setEditing(null); setMsg({ ok: true, text: t("ad_saved") }); }} />
              : <button onClick={() => setEditing(emptyCareer())} className={btn}>+ {t("ad_car_new")}</button>}
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
                  {[...cat.tiers, ""].map((x) => (
                    <button key={x || "all"} type="button" onClick={() => setCtier(x)}
                      className={`rounded-md px-3 py-1 text-xs font-medium ${ctier === x ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                      {x ? t(`tier_${x}` as Key) : t("ex_tier_all")} <span className="ml-1 text-slate-400">{tierCount(x)}</span></button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input type="search" value={cq} onChange={(e) => setCq(e.target.value)} placeholder={t("ad_car_search")} className={`${field} w-56`} />
                  {ctier !== "validated" && <select value={cgrp} onChange={(e) => setCgrp(e.target.value)} className={`${field} max-w-56`}>
                    <option value="">{t("ex_all_fields")}</option>{cat.groups.map((g) => <option key={g.code} value={g.code}>{group(g.code)}</option>)}</select>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-3">{t("col_career")}</th><th className="py-2 pr-3">{t("ad_tier")}</th><th className="py-2 pr-3">{t("in_int")}</th>
                    <th className="py-2 pr-3">{t("ind_req")}</th><th className="py-2 pr-3">{t("ind_ads")}</th><th className="py-2" />
                  </tr></thead>
                  <tbody>
                    {careerPg.rows.map((c) => (
                      <tr key={c.slug} className="border-b border-slate-100">
                        <td className="py-3 pr-3 font-medium text-slate-800">{c.name}
                          {c.graduate_profile && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{t("grad_profile")}</span>}
                          {c.source && <span className="block text-xs font-normal text-slate-400">{c.source}</span>}</td>
                        <td className="py-3 pr-3"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${c.tier === "validated" ? "bg-brand-50 text-brand-700" : "bg-amber-50 text-amber-700"}`}>{t(`tier_${c.tier}` as Key)}</span></td>
                        <td className="py-3 pr-3 text-xs text-slate-500">{c.tier === "reference" && <span className="block text-slate-400">{group(c.group_code)}</span>}
                          {c.interest_areas.slice(0, 2).map(interest).join(", ")}{c.interest_areas.length > 2 && <span className="ml-1 text-slate-400">{t("ad_more_areas", { n: c.interest_areas.length - 2 })}</span>}</td>
                        <td className="py-3 pr-3 text-slate-600">{c.n_skills}</td>
                        <td className="py-3 pr-3 text-slate-600">{c.tier === "validated" ? c.n_ads : "—"}</td>
                        <td className="py-3 text-right whitespace-nowrap">
                          <Link href={`/careers/${c.slug}`} target="_blank" className="mr-3 text-xs font-medium text-slate-500 hover:underline">{t("ad_view")}</Link>
                          <button onClick={async () => { try { setEditing({ ...(await api.adminCareer(c.slug)), isNew: false }); window.scrollTo({ top: 0, behavior: "smooth" }); } catch { setMsg({ ok: false, text: t("api_error") }); } }} className="mr-3 text-xs font-medium text-brand-600 hover:underline">{t("ad_edit")}</button>
                          <Confirm label={t("ad_delete")} onYes={() => run(api.deleteCareer(c.slug), "ad_deleted")} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {careersShown.length === 0 && <p className="py-6 text-center text-sm text-slate-500">{t("fb_none")}</p>}
              <Pager {...careerPg} />
            </section>
          </>
        )}

        {tab === "skills" && (
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="font-semibold text-slate-900">{t("ad_sk_add")}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <input value={newSkill.name} onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })} placeholder={t("ad_sk_name_ph")} className={`${field} w-56`} />
              <input value={newSkill.category} onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value })} list="skill-cats" placeholder={t("ad_sk_cat_ph")} className={`${field} w-48`} />
              <datalist id="skill-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              <select value={newSkill.kind} onChange={(e) => setNewSkill({ ...newSkill, kind: e.target.value })} className={field}>
                {cat.skill_kinds.map((k) => <option key={k} value={k}>{t(`kind_${k}` as Key)}</option>)}</select>
              <button disabled={!newSkill.name.trim() || !newSkill.category.trim()} className={btn}
                onClick={async () => { if (await run(api.saveSkill(newSkill))) setNewSkill({ name: "", category: newSkill.category, kind: newSkill.kind }); }}>{t("cs_add")}</button>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search_skill")} className={`${field} w-full sm:w-64`} />
              <select value={skCat} onChange={(e) => setSkCat(e.target.value)} className={field}>
                <option value="">{t("ad_all_cats")}</option>
                {SKILL_GROUPS.map((g) => (
                  <optgroup key={g} label={t(`skg_${g}` as Key)}>
                    {categories.filter((c) => groupOfCategory(c) === g).map((c) => <option key={c} value={c}>{category(c)}</option>)}
                  </optgroup>
                ))}
              </select>
              <select value={skKind} onChange={(e) => setSkKind(e.target.value)} className={field}>
                <option value="">{t("ad_all_kinds")}</option>{cat.skill_kinds.map((k) => <option key={k} value={k}>{t(`kind_${k}` as Key)}</option>)}</select>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-slate-500"><th className="py-2 pr-3">{t("col_skill")}</th><th className="py-2 pr-3">{t("ad_sk_cat")}</th><th className="py-2 pr-3">{t("ad_sk_kind")}</th><th className="py-2 pr-3">{t("ad_used_by")}</th><th /></tr></thead>
                <tbody>
                  {skillPg.rows.map((s) => (
                    <tr key={s.name} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium text-slate-800">{s.name}
                        <input defaultValue={s.name_id || ""} placeholder={t("ad_label_id")} onBlur={(e) => { if (e.target.value !== (s.name_id || "")) run(api.saveSkill({ name: s.name, category: s.category, kind: s.kind, name_id: e.target.value || null })); }}
                          className="mt-1 block w-48 rounded border border-transparent px-1 text-xs font-normal text-slate-500 hover:border-slate-200 focus:border-brand-300 focus:outline-none" /></td>
                      <td className="py-2 pr-3"><select value={s.category} onChange={(e) => run(api.saveSkill({ name: s.name, category: e.target.value, kind: s.kind }))} className={`${field} py-0.5 text-xs`}>
                        {categories.map((c) => <option key={c} value={c}>{category(c)}</option>)}</select></td>
                      <td className="py-2 pr-3"><select value={s.kind} onChange={(e) => run(api.saveSkill({ name: s.name, category: s.category, kind: e.target.value }))} className={`${field} py-0.5 text-xs`}>
                        {cat.skill_kinds.map((k) => <option key={k} value={k}>{t(`kind_${k}` as Key)}</option>)}</select></td>
                      <td className="py-2 pr-3 text-slate-500">{s.used_by}</td>
                      <td className="py-2 text-right"><Confirm label={t("ad_delete")} disabled={s.used_by > 0} onYes={() => run(api.deleteSkill(s.name), "ad_deleted")} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager {...skillPg} />
            <p className="mt-3 text-xs text-slate-400">{t("ad_sk_note")}</p>
          </section>
        )}

        {tab === "interests" && (
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="font-semibold text-slate-900">{t("ad_int_add")}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <input value={newArea.name} onChange={(e) => setNewArea({ ...newArea, name: e.target.value })} placeholder={t("ad_int_en_ph")} className={`${field} w-64`} />
              <input value={newArea.name_id} onChange={(e) => setNewArea({ ...newArea, name_id: e.target.value })} placeholder={t("ad_int_id_ph")} className={`${field} w-64`} />
              <button disabled={newArea.name.trim().length < 2} className={btn}
                onClick={async () => { if (await run(api.saveInterest({ name: newArea.name, name_id: newArea.name_id || null }))) setNewArea({ name: "", name_id: "" }); }}>{t("cs_add")}</button>
            </div>
            <table className="mt-6 w-full text-sm">
              <thead><tr className="border-b border-slate-200 text-left text-slate-500"><th className="py-2 pr-3">{t("ad_int_en")}</th><th className="py-2 pr-3">{t("ad_int_id")}</th><th className="py-2 pr-3">{t("ad_used_by")}</th><th /></tr></thead>
              <tbody>
                {areaPg.rows.map((a) => (
                  <tr key={a.name} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-800">{a.name}</td>
                    <td className="py-2 pr-3"><input defaultValue={a.name_id || ""} onBlur={(e) => { if (e.target.value !== (a.name_id || "")) run(api.saveInterest({ name: a.name, name_id: e.target.value || null })); }} className={`${field} w-64 py-1`} /></td>
                    <td className="py-2 pr-3 text-slate-500">{a.used_by}</td>
                    <td className="py-2 text-right"><Confirm label={t("ad_delete")} disabled={a.used_by > 0} onYes={() => run(api.deleteInterest(a.name), "ad_deleted")} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager {...areaPg} />
            <p className="mt-3 text-xs text-slate-400">{t("ad_int_note")}</p>
          </section>
        )}

        {tab === "courses" && (
          <>
            {course ? (
              <section className="rounded-2xl border border-brand-200 bg-white p-6 shadow-sm">
                <h3 className="font-semibold text-slate-900">{cat.courses.some((c) => c.code === course.code) ? t("ad_co_edit") : t("ad_co_new")}</h3>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                  <label className="block font-medium text-slate-700">{t("col_code")}<input value={course.code} onChange={(e) => setCourse({ ...course, code: e.target.value })} className={`mt-1 w-full ${field}`} placeholder="AK2101" /></label>
                  <label className="block font-medium text-slate-700 md:col-span-2">{t("col_course")}<input value={course.name} onChange={(e) => setCourse({ ...course, name: e.target.value })} className={`mt-1 w-full ${field}`} /></label>
                  <label className="block font-medium text-slate-700">{t("ad_co_program")}<input value={course.program || ""} onChange={(e) => setCourse({ ...course, program: e.target.value })} list="programs" className={`mt-1 w-full ${field}`} placeholder="D3 Akuntansi PNJ" /></label>
                  <datalist id="programs">{[...new Set(cat.courses.map((c) => c.program).filter(Boolean))].map((p) => <option key={p!} value={p!} />)}</datalist>
                  <label className="block font-medium text-slate-700">{t("ad_co_cat")}
                    <select value={course.category || "program"} onChange={(e) => setCourse({ ...course, category: e.target.value as CourseCategory })} className={`mt-1 w-full ${field}`}>
                      {cat.course_categories.map((k) => <option key={k} value={k}>{t(`cc_${k}` as Key)}</option>)}</select></label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block font-medium text-slate-700">{t("ad_co_sem")}<input value={course.semester ?? ""} onChange={(e) => setCourse({ ...course, semester: e.target.value ? Number(e.target.value.replace(/\D/g, "").slice(0, 2)) : null })} inputMode="numeric" className={`mt-1 w-full ${field}`} /></label>
                    <label className="block font-medium text-slate-700">SKS<input value={course.sks ?? ""} onChange={(e) => setCourse({ ...course, sks: e.target.value ? Number(e.target.value.replace(/\D/g, "").slice(0, 2)) : null })} inputMode="numeric" className={`mt-1 w-full ${field}`} /></label>
                  </div>
                </div>
                <h4 className="mt-5 text-sm font-semibold text-slate-800">{t("col_teaches")}</h4>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {course.skills.map((s) => <button key={s} type="button" onClick={() => setCourse({ ...course, skills: course.skills.filter((x) => x !== s) })}
                    className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs text-brand-700">{s}<Icon name="x" className="h-3 w-3 opacity-50" /></button>)}
                  <div className="w-56"><SkillSearch meta={skillMeta} exclude={course.skills} onPick={(s) => setCourse({ ...course, skills: [...course.skills, s] })} /></div>
                </div>
                <div className="mt-6 flex gap-2">
                  <button disabled={!course.code.trim() || course.name.trim().length < 2} className={btn}
                    onClick={async () => { if (await run(api.saveCourse(course))) setCourse(null); }}>{t("ad_save")}</button>
                  <button onClick={() => setCourse(null)} className={btn2}>{t("ad_cancel")}</button>
                </div>
              </section>
            ) : <button onClick={() => setCourse(emptyCourse())} className={btn}>+ {t("ad_co_new")}</button>}
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ad_co_search")} className={`${field} w-full sm:w-72`} />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-200 text-left text-slate-500"><th className="py-2 pr-3">{t("col_course")}</th><th className="py-2 pr-3">{t("ad_co_program")}</th><th className="py-2 pr-3">{t("ad_co_sem")}</th><th className="py-2 pr-3">{t("ad_co_cat")}</th><th className="py-2 pr-3">{t("col_teaches")}</th><th /></tr></thead>
                  <tbody>
                    {coursePg.rows.map((c) => (
                      <tr key={c.code} className="border-b border-slate-100 align-top">
                        <td className="py-2 pr-3"><p className="font-medium text-slate-800">{c.name}</p><p className="text-xs text-slate-400">{c.code}{c.sks ? ` · ${c.sks} SKS` : ""}</p></td>
                        <td className="py-2 pr-3 text-xs text-slate-500">{c.program || "—"}</td>
                        <td className="py-2 pr-3 text-slate-600">{c.semester ?? "—"}</td>
                        <td className="py-2 pr-3 text-xs text-slate-600">{c.category ? t(`cc_${c.category}` as Key) : "—"}</td>
                        <td className="py-2 pr-3 text-xs text-slate-500">{c.skills.join(", ") || "—"}</td>
                        <td className="py-2 text-right whitespace-nowrap">
                          <button onClick={() => { setCourse({ code: c.code, name: c.name, program: c.program, semester: c.semester, category: c.category, sks: c.sks, skills: c.skills }); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                            className="mr-3 text-xs font-medium text-brand-600 hover:underline">{t("ad_edit")}</button>
                          <Confirm label={t("ad_delete")} onYes={() => run(api.deleteCourse(c.code), "ad_deleted")} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager {...coursePg} />
              <p className="mt-3 text-xs text-slate-400">{t("ad_co_note")}</p>
            </section>
          </>
        )}
      </div>
    </Page>
  );
}
