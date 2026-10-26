"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Loading, Page } from "@/components/Shell";
import { FitBadges, Summary } from "@/components/Summary";
import { api, Assessment, Evidence, Meta } from "@/lib/api";
import { categoryCoverage } from "@/lib/coverage";
import { C_K, C_M, Radar, Ring } from "@/components/Charts";
import { AIExplanation } from "@/components/AIExplanation";
import { Key, useI18n } from "@/lib/i18n";

const BADGE = { met: "bg-emerald-50 text-emerald-700", partly: "bg-amber-50 text-amber-700", gap: "bg-rose-50 text-rose-700" };

export default function CareerDetail() {
  const { t, category, skill } = useI18n();
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => { api.meta().then(setMeta).catch(() => {}); }, []);
  const { id, slug } = useParams<{ id: string; slug: string }>();
  const [a, setA] = useState<Assessment | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.get(id).then(setA).catch(() => setErr(t("api_error"))); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const c = a?.results.find((r) => r.slug === slug);
  if (!a || !c) return <Page heading={t("nav_results")}><Loading error={err} /></Page>;

  const ev = (f: Evidence) => f.type === "course" ? `${f.name} (${f.grade})` : f.type === "via" ? t("ev_via", { skill: skill(f.skill) })
    : f.type === "self" ? t("ev_self", { level: t(`lv_full_${f.level}` as Key).toLowerCase() }) : t("ev_exp");
  const todo = c.skills.filter((k) => k.status !== "met").sort((x, y) => y.w - x.w).slice(0, 5);
  const related = [...new Set(c.skills.flatMap((k) => k.courses))];

  return (
    <Page heading={c.name} sub={t("detail_sub", { id: a.id })}>
      <div className="space-y-6">
        <Link href={`/results/${a.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">{t("back_rec")}</Link>

        <section className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <FitBadges c={c} />
              <h2 className="mt-2 text-2xl font-bold text-slate-900">{c.name}</h2>
              <p className="mt-2 text-sm text-slate-600 max-w-2xl leading-relaxed"><Summary c={c} /></p>
            </div>
            <div className="flex shrink-0 items-center gap-5">
              <div className="text-center"><Ring value={c.fit} size={96} stroke={9} label="/100" /><p className="mt-1 text-xs text-slate-500">{t("fit_score")}</p></div>
              <div className="space-y-2 text-xs">
                <div><p className="text-slate-500">{t("k_label")}</p><p className="text-lg font-semibold" style={{ color: C_K }}>{c.breakdown.competency}%</p></div>
                <div><p className="text-slate-500">{t("m_label")}</p><p className="text-lg font-semibold" style={{ color: C_M }}>{c.breakdown.interest}%</p></div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid xl:grid-cols-5 gap-6">
          <section className="xl:col-span-2 rounded-2xl bg-white border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900">{t("res_radar_t")}</h3>
            <p className="mt-1 text-xs text-slate-500">{t("res_radar_d", { career: c.name })}</p>
            {meta && (() => {
              const axes = categoryCoverage(c, meta).map((x) => ({ label: category(x.cat), value: x.value, detail: `${x.have}/${x.n}` }));
              return axes.length >= 3 ? <div className="mt-2"><Radar axes={axes} size={320} valueLabel={t("res_radar_you")} refLabel={t("res_radar_ref")} /></div>
                : <p className="mt-3 text-sm text-slate-400">{t("res_radar_few")}</p>;
            })()}
          </section>
          <div className="xl:col-span-3"><AIExplanation assessmentId={a.id} career={c.slug} /></div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 rounded-xl bg-white border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900">{t("gap_t")}</h3>
            <p className="text-sm text-slate-500 mt-1">{t("gap_d", { career: c.name })}</p>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">{t("col_skill")}</th><th className="py-2 pr-3">{t("col_ads")}</th><th className="py-2 pr-3">{t("col_you")}</th><th className="py-2">{t("col_status")}</th>
                </tr></thead>
                <tbody>
                  {c.skills.map((k) => (
                    <tr key={k.skill} className="border-b border-slate-100">
                      <td className="py-3 pr-3 font-medium text-slate-800" title={k.skill}>{skill(k.skill)}
                        {k.from.length > 0 && <span className="block text-xs font-normal text-slate-400">{k.from.map(ev).join(" · ")}</span>}</td>
                      <td className="py-3 pr-3 whitespace-nowrap"><div className="flex items-center gap-2"><div className="w-16 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-slate-500" style={{ width: `${k.demand_pct ?? 0}%` }} /></div><span className="text-xs text-slate-500">{k.demand_pct != null ? `${Math.round(k.demand_pct)}%` : "—"}</span></div></td>
                      <td className="py-3 pr-3 whitespace-nowrap"><div className="flex items-center gap-2"><div className="w-16 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${k.e * 100}%` }} /></div><span className="text-xs text-slate-500">{k.e.toFixed(2)}</span></div></td>
                      <td className="py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[k.status]}`}>{t(`st_${k.status}` as Key)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mt-8 font-semibold text-slate-900">{t("next_t")}</h3>
            {todo.length ? (
              <>
                <ul className="mt-3 space-y-2 text-sm">
                  {todo.map((k) => (
                    <li key={k.skill} className="flex gap-2"><span className="text-brand-600">→</span><span>
                      {k.status === "partly" ? t("next_strengthen") : t("next_learn")} <b>{skill(k.skill)}</b>{k.demand_pct != null && <> ({t("next_in_ads", { p: Math.round(k.demand_pct) })})</>}
                      {k.courses.length > 0 && <> — {t("next_course")}: {k.courses.join(", ")}</>}.</span></li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-slate-400">{t("next_note")}</p>
              </>
            ) : <p className="mt-3 text-sm text-slate-500">{t("all_met")}</p>}
          </section>

          <aside className="space-y-6">
            <div className="rounded-xl bg-white border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">{t("rel_courses")}</h3>
              {related.length
                ? <ul className="mt-3 space-y-2 text-sm">{related.map((n) => <li key={n} className="rounded-lg bg-slate-50 px-3 py-2">{n}</li>)}</ul>
                : <p className="mt-3 text-sm text-slate-500">{t("no_rel")}</p>}
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">{t("basis")}</h3>
              <ol className="mt-3 space-y-3 text-sm">
                {c.sources.map((s, i) => (
                  <li key={s.key} id={`src-${i + 1}`} className="flex gap-2">
                    <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded bg-brand-50 text-brand-700 text-[11px] font-semibold">{i + 1}</span>
                    <div>
                      <p className="font-medium text-slate-800">{s.key === "ads" ? t("src_ads", { career: c.name, n: s.n_ads! })
                        : s.key === "reference" ? t("src_ref", { career: c.name, src: s.source || "—" })
                        : s.custom ? `${s.name} (${t("src_own_course")})` : `${s.name} (${s.key})`}</p>
                      <p className="text-xs text-slate-500 mt-0.5">“{s.key === "ads" || s.key === "reference" ? t("src_ads_ex", { n: s.n_skills! }) : t("src_course_ex", { list: s.skills!.join(", ") })}”</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-6 text-sm">
              <h3 className="font-semibold text-slate-900">{t("industry")}</h3>
              <dl className="mt-3 space-y-2">
                {c.tier === "reference" ? <p className="text-xs text-amber-700">{t("tier_reference_d")}</p>
                  : <div className="flex justify-between"><dt className="text-slate-500">{t("ind_ads")}</dt><dd className="font-medium">{c.n_ads}</dd></div>}
                <div className="flex justify-between"><dt className="text-slate-500">{t("ind_req")}</dt><dd className="font-medium">{c.skills.length}</dd></div>
                {c.coverage_pct != null && <div className="flex justify-between"><dt className="text-slate-500">{t("ind_cov")}</dt><dd className="font-medium">{c.coverage_pct}%</dd></div>}
              </dl>
              <p className="mt-3 text-xs text-slate-400">{t("ind_src")}</p>
            </div>
          </aside>
        </div>
      </div>
    </Page>
  );
}
