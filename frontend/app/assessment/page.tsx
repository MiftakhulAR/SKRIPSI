"use client";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FitBars, LevelStack } from "@/components/Charts";
import { Loading, Page } from "@/components/Shell";
import { AcademicProfile, api, ExtractedSkill, Meta } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Key, useI18n } from "@/lib/i18n";

type Preview = { slug: string; name: string; fit: number; K: number; M: number }[];

/* FR4: worked examples so the student knows what to write and which skills to tick (IT and non-IT).
   Patch 12: Komunikasi / Kerja tim / Problem solving were replaced by O*NET names in Tahap 13. */
const EXAMPLES: { key: "ex1" | "ex2" | "ex3"; skills: string[] }[] = [
  { key: "ex1", skills: ["Laravel", "MySQL", "REST API", "Git"] },
  { key: "ex2", skills: ["Excel", "Microsoft Office", "Speaking"] },
  { key: "ex3", skills: ["Cooperation", "Speaking", "Complex Problem Solving", "Project Management"] },
];

/** "…text [[phrase]] text…" -> the phrase in bold */
function Snippet({ text }: { text: string }) {
  const parts = text.split(/\[\[|\]\]/);
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i} className="rounded bg-amber-100 px-0.5 text-slate-900">{p}</mark> : <span key={i}>{p}</span>))}</>;
}

/** Each assessment asks only for experience; courses, skills and interests come from the profile. */
export default function Assessment() {
  const { t, interest, category, skill } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [profile, setProfile] = useState<AcademicProfile | null>(null);
  const [exp, setExp] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  // FR4: suggestions from the experience story; nothing counts until ticked and added
  const [found, setFound] = useState<ExtractedSkill[] | null>(null);
  const [foundFor, setFoundFor] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!user || isAdmin) return;
    if (!user.profile_complete) { router.replace("/profile?welcome=1&next=/assessment"); return; }
    Promise.all([api.meta(), api.profile()]).then(([m, p]) => { setMeta(m); setProfile(p.profile); }).catch(() => setErr(t("api_error")));
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // live preview, debounced
  useEffect(() => {
    if (!profile || isAdmin) return;
    const id = setTimeout(() => { api.preview(exp).then(setPreview).catch(() => {}); }, 250);
    return () => clearTimeout(id);
  }, [exp, profile, isAdmin]);

  const allSkills = useMemo(() => meta ? Object.values(meta.skills_by_category).flat() : [], [meta]);
  const levelRows = useMemo(() => {
    if (!meta || !profile) return [];
    return Object.entries(meta.skills_by_category).map(([cat, list]) => {
      const r = { label: category(cat), beginner: 0, intermediate: 0, advanced: 0 };
      list.forEach((s) => { const lv = profile.self_rated[s] as keyof typeof r | undefined; if (lv && lv !== "label") (r[lv] as number)++; });
      return r;
    }).filter((r) => r.beginner + r.intermediate + r.advanced > 0).sort((a, b) => (b.beginner + b.intermediate + b.advanced) - (a.beginner + a.intermediate + a.advanced));
  }, [meta, profile, category]);

  if (isAdmin) return (
    <Page heading={t("nav_assessment")}>
      <div className="max-w-lg rounded-2xl bg-white border border-slate-200 p-8 text-sm text-slate-600">{t("admin_no_assess")}
        <Link href="/admin/kb" className="mt-4 block font-medium text-brand-600 hover:underline">{t("nav_kb")} →</Link></div>
    </Page>
  );
  if (!meta || !profile) return <Page heading={t("nav_assessment")} sub={t("assess_sub2")}><Loading error={err} /></Page>;

  const profileSkills = Object.keys(profile.self_rated);
  const extra = exp.filter((s) => !profileSkills.includes(s));
  const matches = q.trim().length >= 1 ? allSkills.filter((s) => (s.toLowerCase().includes(q.toLowerCase()) || skill(s).toLowerCase().includes(q.toLowerCase())) && !exp.includes(s)).slice(0, 8) : [];
  const toggle = (s: string) => setExp((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const alpha = meta.alpha;
  const applyExample = (ex: (typeof EXAMPLES)[number]) => {
    setNotes(t(`as_${ex.key}_text` as Key));
    setExp((p) => [...new Set([...p, ...ex.skills.filter((s) => allSkills.includes(s))])]);
  };
  async function findSkills() {
    if (!notes.trim()) return;
    setExtracting(true); setErr("");
    try {
      const r = await api.extractSkills(notes);
      setFound(r.skills); setFoundFor(notes);
      setSuggested((p) => [...new Set([...p, ...r.skills.map((x) => x.skill)])]);
      setPicked(r.skills.map((x) => x.skill).filter((s) => !exp.includes(s)));
    } catch { setErr(t("api_error")); }
    setExtracting(false);
  }
  const togglePick = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const addPicked = () => { setExp((p) => [...new Set([...p, ...picked])]); setPicked([]); };

  async function submit() {
    setBusy(true); setErr("");
    try { const { id } = await api.create({ experience: exp, notes, suggested }); router.push(`/analyzing/${id}`); }
    catch { setErr(t("api_error")); setBusy(false); }
  }
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm transition ${on ? "bg-brand-600 border-brand-600 text-white shadow-sm" : "border-slate-300 bg-white text-slate-600 hover:border-brand-400"}`;
  const kpis: [Key, number][] = [["as_kpi_courses", profile.courses.length], ["as_kpi_skills", profileSkills.length + profile.custom_skills.length], ["as_kpi_exp", exp.length]];

  return (
    <Page heading={t("nav_assessment")} sub={t("assess_sub2")}>
      <div className="space-y-6">
        <section className="rounded-2xl bg-gradient-to-br from-brand-700 to-brand-500 p-6 sm:p-8 text-white">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <h2 className="text-2xl font-bold">{t("as_hero_t")}</h2>
              <p className="mt-2 text-sm text-brand-100">{t("as_hero_d")}</p>
            </div>
            <div className="flex gap-3">
              {kpis.map(([k, v]) => (
                <div key={k} className="min-w-24 rounded-xl bg-white/10 px-4 py-3 text-center ring-1 ring-white/15">
                  <p className="text-2xl font-bold tabular-nums">{v}</p><p className="text-[11px] text-brand-100">{t(k)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid lg:grid-cols-5 gap-6">
          <section className="lg:col-span-3 rounded-2xl bg-white border border-slate-200 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900">{t("as_exp_t")}</h2>
            <p className="text-sm text-slate-500 mt-1">{t("as_exp_d")}</p>

            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-400">{t("as_from_profile")}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {profileSkills.length ? profileSkills.map((s) => <button key={s} type="button" onClick={() => toggle(s)} className={chip(exp.includes(s))}>{skill(s)}</button>)
                : <span className="text-sm text-slate-400">{t("as_none")}</span>}
            </div>

            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-400">{t("as_other")}</h3>
            <div className="relative mt-2 max-w-sm">
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("as_other_ph")}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              {matches.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-sm">
                  {matches.map((s) => <li key={s}><button type="button" onClick={() => { toggle(s); setQ(""); }} className="w-full px-3 py-1.5 text-left hover:bg-brand-50">{skill(s)}</button></li>)}
                </ul>
              )}
            </div>
            {extra.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{extra.map((s) => <button key={s} type="button" onClick={() => toggle(s)} className={chip(true)}><span className="inline-flex items-center gap-1">{skill(s)}<Icon name="x" className="h-3 w-3" /></span></button>)}</div>}
            {exp.length === 0 && <p className="mt-4 text-xs text-slate-400">{t("as_none_selected")}</p>}

            <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-800">{t("as_ex_t")}</h3>
              <p className="mt-1 text-xs text-slate-500">{t("as_ex_d")}</p>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {EXAMPLES.map((ex) => (
                  <div key={ex.key} className="flex flex-col rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold text-brand-700">{t(`as_${ex.key}_t` as Key)}</p>
                    <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-600">{t(`as_${ex.key}_text` as Key)}</p>
                    <div className="mt-2 flex flex-wrap gap-1">{ex.skills.map((s) => <span key={s} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{s}</span>)}</div>
                    <button type="button" onClick={() => applyExample(ex)} className="mt-3 self-start text-xs font-medium text-brand-600 hover:underline">{t("as_ex_use")}</button>
                  </div>
                ))}
              </div>
            </div>

            <h3 className="mt-8 text-sm font-semibold text-slate-700">{t("exp_text")} <span className="font-normal text-slate-400">{t("optional")}</span></h3>
            <textarea rows={4} maxLength={3000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("exp_ph")}
              className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-400">{t("exp_text_note")}</p>
              <button type="button" onClick={findSkills} disabled={extracting || !notes.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-600 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50">
                <Icon name="search" className="h-4 w-4" />{extracting ? t("fr4_busy") : t("fr4_btn")}
              </button>
            </div>

            {found && (
              <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{t("fr4_t")}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">{t("fr4_d")}</p>
                  </div>
                  {found.some((x) => !exp.includes(x.skill)) && (
                    <div className="flex gap-3 text-xs font-medium">
                      <button type="button" className="text-brand-600 hover:underline" onClick={() => setPicked(found.map((x) => x.skill).filter((s) => !exp.includes(s)))}>{t("fr4_all")}</button>
                      <button type="button" className="text-slate-500 hover:underline" onClick={() => setPicked([])}>{t("fr4_clear")}</button>
                    </div>
                  )}
                </div>
                {foundFor !== notes && <p className="mt-2 text-xs text-amber-700">{t("fr4_stale")}</p>}
                {found.length === 0 ? <p className="mt-3 text-sm text-slate-500">{t("fr4_none")}</p> : (
                  <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                    {found.map((x) => {
                      const added = exp.includes(x.skill);
                      return (
                        <li key={x.skill} className="flex items-start gap-3 px-3 py-2">
                          <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" disabled={added}
                            checked={added || picked.includes(x.skill)} onChange={() => togglePick(x.skill)} aria-label={skill(x.skill)} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800">{skill(x.skill)}
                              <span className="ml-2 text-[11px] font-normal text-slate-400">{category(x.category)} · {t(x.method === "dictionary" ? "fr4_method_dictionary" : "fr4_method_name")}</span>
                              {added && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-normal text-emerald-700">{t("fr4_added")}</span>}
                            </p>
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-500"><Snippet text={x.snippet} /></p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-400">{t("fr4_how")}</p>
                  {picked.length > 0 && (
                    <button type="button" onClick={addPicked} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">
                      {t("fr4_add", { n: picked.length })}
                    </button>
                  )}
                </div>
              </div>
            )}

            {err && <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}
            <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-100 pt-6">
              <Link href="/profile?next=/assessment" className="text-sm font-medium text-brand-600 hover:underline">{t("as_edit_profile")}</Link>
              <button type="button" onClick={submit} disabled={busy}
                className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{t("get_rec")}</button>
            </div>
          </section>

          <aside className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl bg-white border border-slate-200 p-5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
                <h3 className="font-semibold text-slate-900">{t("as_live_t")}</h3>
              </div>
              <p className="mt-1 text-xs text-slate-500">{t("as_live_d")}</p>
              <div className="mt-4">
                {preview ? (
                  <FitBars labels={{ k: t("k_label"), m: t("m_label"), fit: t("fit_score") }}
                    rows={preview.slice(0, 5).map((r, i) => ({ slug: r.slug, name: r.name, fit: r.fit, kPart: 100 * alpha * r.K, mPart: 100 * (1 - alpha) * r.M, highlight: i === 0 }))} />
                ) : <p className="text-sm text-slate-400">{t("loading")}</p>}
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900">{t("as_strength_t")}</h3>
              <p className="mt-1 text-xs text-slate-500">{t("as_strength_d")}</p>
              <div className="mt-4">
                {levelRows.length ? <LevelStack rows={levelRows} labels={{ beginner: t("lvl_beginner"), intermediate: t("lvl_intermediate"), advanced: t("lvl_advanced") }} />
                  : <p className="text-sm text-slate-400">{t("sk_none")}</p>}
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{t("as_profile_t")}</h3>
                <Link href="/profile?next=/assessment" className="shrink-0 text-xs font-medium text-brand-600 hover:underline">{t("as_edit_profile")}</Link>
              </div>
              <dl className="mt-3 space-y-3 text-sm">
                <div><dt className="text-slate-500">{t("in_courses")}</dt>
                  <dd className="mt-1 text-slate-800">{profile.courses.map((c) => `${c.name} (${c.grade})`).join(", ") || t("as_none")}</dd></div>
                <div><dt className="text-slate-500">{t("in_int")}</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">{profile.interests.map((i) => <span key={i} className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700">{interest(i)}</span>)}</dd></div>
                {profile.target_career && <div><dt className="text-slate-500">{t("tg_t")}</dt><dd className="mt-1 font-medium text-slate-800">{profile.target_career.name}</dd></div>}
              </dl>
              {profile.updated_at && <p className="mt-3 text-xs text-slate-400">{t("prof_updated", { date: profile.updated_at })}</p>}
            </div>
          </aside>
        </div>
      </div>
    </Page>
  );
}
