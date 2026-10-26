"use client";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Academic, CourseList, EducationPicker, InterestPicker, SkillLevels, TargetPicker } from "@/components/ProfileFields";
import { Loading, Page } from "@/components/Shell";
import { api, errCode, Meta, User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Key, useI18n } from "@/lib/i18n";

const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300";
type Tab = "account" | "academic" | "password";
type Sub = "courses" | "skills" | "interests";

function Notice({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return <div className={`rounded-lg border px-4 py-3 text-sm ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{msg.text}</div>;
}

export default function Profile() {
  const { t } = useI18n();
  const router = useRouter();
  const { setUser } = useAuth();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [account, setAccount] = useState<User | null>(null);
  const EMPTY: Academic = { courses: [], self_rated: {}, custom_skills: [], interests: [], target_career: null, education_level: "d4s1" };
  const [acad, setAcad] = useState<Academic>(EMPTY);
  const [saved, setSaved] = useState<Academic>(EMPTY);
  const [updated, setUpdated] = useState<string | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState<Tab>("academic");
  useEffect(() => { if (isAdmin) setTab("account"); }, [isAdmin]);
  const [sub, setSub] = useState<Sub>("courses");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [params, setParams] = useState<{ welcome: boolean; next: string | null }>({ welcome: false, next: null });

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const next = sp.get("next");
    setParams({ welcome: sp.get("welcome") === "1" || !!next, next: next && next.startsWith("/") && !next.startsWith("//") ? next : null });
    Promise.all([api.meta(), api.profile()]).then(([m, p]) => {
      setMeta(m); setAccount(p.account); setUpdated(p.profile.updated_at ?? null);
      const a: Academic = { courses: p.profile.courses, self_rated: p.profile.self_rated, custom_skills: p.profile.custom_skills,
        interests: p.profile.interests, target_career: p.profile.target_career, education_level: p.profile.education_level };
      setAcad(a); setSaved(a);
    }).catch(() => setErr(t("api_error")));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!meta || !account) return <Page heading={t("nav_profile")} sub={t("prof_sub")}><Loading error={err} /></Page>;

  // each tab is saved on its own; unsaved edits in other tabs stay as drafts
  const FIELDS: Record<Sub, (keyof Academic)[]> = { courses: ["education_level", "courses"], skills: ["self_rated", "custom_skills"], interests: ["interests", "target_career"] };
  const pick = (a: Academic, k: Sub) => Object.fromEntries(FIELDS[k].map((f) => [f, a[f]]));
  const dirty = (k: Sub) => JSON.stringify(pick(acad, k)) !== JSON.stringify(pick(saved, k));
  async function savePart(k: Sub) {
    setBusy(true); setMsg(null);
    try {
      const body = { ...pick(acad, k), ...(k === "interests" && !acad.target_career ? { clear_target: true } : {}) };
      const r = await api.saveAcademic(body);
      setUser(r.account); setAccount(r.account); setUpdated(r.profile.updated_at ?? null);
      const fresh = pick(r.profile as unknown as Academic, k);
      setSaved((p) => ({ ...p, ...fresh })); setAcad((p) => ({ ...p, ...fresh }));
      setMsg({ ok: true, text: t("saved_part") });
    } catch { setMsg({ ok: false, text: t("api_error") }); }
    setBusy(false);
  }
  async function saveAccount(e: FormEvent) {
    e.preventDefault(); setMsg(null);
    try {
      const u = await api.saveAccount({ name: account!.name, email: account!.email, status: account!.status, cohort: account!.cohort });
      setUser(u); setAccount(u); setMsg({ ok: true, text: t("acc_saved") });
    } catch (e2) { const c = errCode(e2); setMsg({ ok: false, text: c ? t(`err_${c}` as Key) || c : t("api_error") }); }
  }
  async function savePassword(e: FormEvent) {
    e.preventDefault(); setMsg(null);
    if (pw.next.length < 8) return setMsg({ ok: false, text: t("err_password") });
    try { await api.changePassword(pw.current, pw.next); setPw({ current: "", next: "" }); setMsg({ ok: true, text: t("pw_saved") }); }
    catch (e2) { const c = errCode(e2); setMsg({ ok: false, text: c ? t(`err_${c}` as Key) || c : t("api_error") }); }
  }

  const counts = { c: acad.courses.length, s: Object.keys(acad.self_rated).length + acad.custom_skills.length, i: acad.interests.length };
  const initials = account.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const TABS: [Tab, Key][] = ([["academic", "prof_tab_academic"], ["account", "prof_tab_account"], ["password", "prof_tab_password"]] as [Tab, Key][])
    .filter(([k]) => !(isAdmin && k === "academic"));
  const SUBS: [Sub, Key, number][] = [["courses", "st_courses", counts.c], ["skills", "st_skills", counts.s], ["interests", "st_interests", counts.i]];

  return (
    <Page heading={t("nav_profile")} sub={t("prof_sub")}>
      <div className="space-y-6">
        {params.welcome && !account.profile_complete && !isAdmin && (
          <section className="rounded-2xl bg-gradient-to-br from-brand-700 to-brand-500 p-6 text-white">
            <h2 className="text-lg font-semibold">{t("prof_welcome_t")}</h2>
            <p className="mt-1 max-w-2xl text-sm text-brand-100">{t("prof_welcome_d")}</p>
          </section>
        )}

        <div className="grid lg:grid-cols-4 gap-6">
          <aside className="space-y-4">
            <div className="rounded-xl bg-white border border-slate-200 p-5 text-center">
              <span className="mx-auto grid place-items-center w-14 h-14 rounded-full bg-brand-100 text-brand-700 text-lg font-bold">{initials}</span>
              <p className="mt-3 font-semibold text-slate-900">{account.name}</p>
              <p className="text-xs text-slate-500 truncate" title={account.email}>{account.email}</p>
              <p className="mt-2 text-xs text-slate-500">{account.status === "graduate" ? t("status_graduate") : t("status_student")}{account.cohort ? ` · ${account.cohort}` : ""}</p>
              {!isAdmin && <p className="mt-3 text-xs font-medium text-brand-700">{t("st_summary", counts)}</p>}
            </div>
            <nav className="rounded-xl bg-white border border-slate-200 p-2">
              {TABS.map(([k, label]) => (
                <button key={k} onClick={() => { setTab(k); setMsg(null); }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${tab === k ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"}`}>{t(label)}</button>
              ))}
            </nav>
          </aside>

          <div className="lg:col-span-3 space-y-4">
            <Notice msg={msg} />

            {tab === "academic" && (
              <div className="rounded-2xl bg-white border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 pt-4">
                  <div className="flex gap-1">
                    {SUBS.map(([k, label, n]) => (
                      <button key={k} onClick={() => { setSub(k); setMsg(null); }}
                        className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium ${sub === k ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                        {t(label)} <span className="ml-1 rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{n}</span>
                        {dirty(k) && <span title={t("unsaved")} className="ml-1 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" />}
                      </button>
                    ))}
                  </div>
                  {updated && <span className="pb-2 text-xs text-slate-400">{t("prof_updated", { date: updated })}</span>}
                </div>
                <div className="p-6 sm:p-8">
                  {sub === "courses" && <>
                    <EducationPicker value={acad.education_level} onChange={(education_level) => setAcad({ ...acad, education_level })} />
                    <CourseList meta={meta} value={acad.courses} onChange={(courses) => setAcad({ ...acad, courses })} />
                  </>}
                  {sub === "skills" && <SkillLevels meta={meta} value={acad.self_rated} custom={acad.custom_skills}
                    onChange={(self_rated) => setAcad({ ...acad, self_rated })} onCustom={(custom_skills) => setAcad({ ...acad, custom_skills })} />}
                  {sub === "interests" && <>
                    <InterestPicker meta={meta} value={acad.interests} onChange={(interests) => setAcad({ ...acad, interests })} />
                    <TargetPicker meta={meta} value={acad.target_career} onChange={(target_career) => setAcad({ ...acad, target_career })} />
                  </>}
                </div>
                <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-slate-100 bg-white/95 px-6 py-4">
                  <span className="text-xs text-slate-500">
                    {dirty(sub) ? <span className="font-medium text-amber-600">● {t("unsaved")}</span>
                      : account.profile_complete ? t("st_summary", { c: saved.courses.length, s: Object.keys(saved.self_rated).length + saved.custom_skills.length, i: saved.interests.length })
                      : t("prof_need")}
                  </span>
                  <div className="flex gap-2">
                    {account.profile_complete && !dirty(sub) && (
                      <button onClick={() => router.push(params.next || "/assessment")} className="rounded-lg border border-brand-300 px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50">{t("go_assessment")}</button>
                    )}
                    <button onClick={() => savePart(sub)} disabled={busy || !dirty(sub)}
                      className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40">
                      {t(sub === "courses" ? "save_courses" : sub === "skills" ? "save_skills" : "save_interests")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === "account" && (
              <form onSubmit={saveAccount} className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 space-y-4 text-sm max-w-xl">
                <label className="block font-medium text-slate-700">{t("name")}<input value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} required minLength={2} className={input} /></label>
                <label className="block font-medium text-slate-700">{t("email")}<input type="email" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} required className={input} /></label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block font-medium text-slate-700">{t("status")}
                    <select value={account.status || "student"} onChange={(e) => setAccount({ ...account, status: e.target.value })} className={input}>
                      <option value="student">{t("status_student")}</option><option value="graduate">{t("status_graduate")}</option>
                    </select>
                  </label>
                  <label className="block font-medium text-slate-700">{t("cohort")}
                    <input value={account.cohort || ""} onChange={(e) => setAccount({ ...account, cohort: e.target.value.replace(/\D/g, "").slice(0, 4) || null })} placeholder="2023" inputMode="numeric" className={input} />
                  </label>
                </div>
                <button className="rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700">{t("acc_save")}</button>
              </form>
            )}

            {tab === "password" && (
              <form onSubmit={savePassword} className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 space-y-4 text-sm max-w-xl">
                <label className="block font-medium text-slate-700">{t("pw_current")}<input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required autoComplete="current-password" className={input} /></label>
                <label className="block font-medium text-slate-700">{t("pw_new")}<input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required minLength={8} autoComplete="new-password" className={input} />
                  <span className="mt-1 block text-xs font-normal text-slate-400">{t("pw_hint")}</span></label>
                <button className="rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700">{t("pw_save")}</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}
