"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Loading, Page } from "@/components/Shell";
import { FitBadges, Summary } from "@/components/Summary";
import { api, API, Assessment, inputCourses, Meta } from "@/lib/api";
import { categoryCoverage } from "@/lib/coverage";
import { FitBars, Radar, Ring } from "@/components/Charts";
import { Key, useI18n } from "@/lib/i18n";

export default function Results() {
  const { t, interest, category, skill } = useI18n();
  const [more, setMore] = useState(false);
  const { id } = useParams<{ id: string }>();
  const [a, setA] = useState<Assessment | null>(null);
  const [err, setErr] = useState("");
  const [courseNames, setCourseNames] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => {
    api.get(id).then(setA).catch(() => setErr(t("api_error")));
    api.meta().then((m) => { setMeta(m); setCourseNames(Object.fromEntries(m.courses.map((c) => [c.code, c.name]))); }).catch(() => {});
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!a) return <Page heading={t("nav_results")}><Loading error={err} /></Page>;

  async function rate(slug: string, value: number) {
    const ratings = await api.rate(a!.id, slug, value);
    setA({ ...a!, ratings });
  }

  return (
    <Page heading={t("nav_results")} sub={t("res_sub", { id: a.id, date: a.created_at, n: a.input.n_ranked ?? a.results.length })}>
      {(() => {
        const top = a.results[0];
        const alpha = meta?.alpha ?? 0.5;
        const axes = meta ? categoryCoverage(top, meta).map((x) => ({ label: category(x.cat), value: x.value, detail: `${x.have}/${x.n}` })) : [];
        return (
          <div className="mb-6 grid xl:grid-cols-5 gap-6">
            <section className="xl:col-span-2 rounded-2xl bg-white border border-slate-200 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{t("res_top_t")}</p>
              <div className="mt-2 flex items-center gap-4">
                <Ring value={top.fit} size={84} label="/100" />
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-slate-900">{top.name}</h2>
                  <FitBadges c={top} />
                </div>
              </div>
              <h3 className="mt-6 text-sm font-semibold text-slate-800">{t("res_radar_t")}</h3>
              <p className="mt-1 text-xs text-slate-500">{t("res_radar_d", { career: top.name })}</p>
              <div className="mt-2">
                {axes.length >= 3 ? <Radar axes={axes} size={320} valueLabel={t("res_radar_you")} refLabel={t("res_radar_ref")} />
                  : <p className="mt-3 text-sm text-slate-400">{t("res_radar_few")}</p>}
              </div>
            </section>
            <section className="xl:col-span-3 rounded-2xl bg-white border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">{t("res_overview_t")}</h3>
              <p className="mt-1 text-xs text-slate-500">{t("res_overview_d")}</p>
              <div className="mt-4">
                <FitBars labels={{ k: t("k_label"), m: t("m_label"), fit: t("fit_score") }}
                  rows={a.results.slice(0, 15).map((r, i) => ({ slug: r.slug, name: r.name, fit: r.fit, kPart: 100 * alpha * r.K, mPart: 100 * (1 - alpha) * r.M,
                    href: `/results/${a.id}/career/${r.slug}`, highlight: i < 3 }))} />
              </div>
            </section>
          </div>
        );
      })()}
      {(() => {
        const tg = a.input.target_career;
        if (!tg) return null;
        const r = a.results.find((x) => x.is_target);
        return (
          <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-4">
              {r && <Ring value={r.fit} size={56} stroke={6} />}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t("tg_t")}</p>
                <p className="font-semibold text-slate-900">{tg.name}</p>
                <p className="text-sm text-slate-500">{r ? t("tg_rank", { rank: r.rank ?? a.results.indexOf(r) + 1, n: a.input.n_ranked ?? a.results.length, gaps: r.summary.to_improve.map(skill).join(", ") || "—" }) : t("tg_not_catalog")}</p>
              </div>
            </div>
            {r && <Link href={`/results/${a.id}/career/${r.slug}`} className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">{t("view_details")}</Link>}
          </section>
        );
      })()}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {a.results.slice(0, more ? a.results.length : 10).map((c, i) => {
            const mine = a.ratings[c.slug] || 0;
            return (
              <article key={c.slug} id={c.slug} className={`rounded-xl bg-white border p-6 ${i === 0 ? "border-brand-300 ring-1 ring-brand-200" : "border-slate-200"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">#{c.rank ?? i + 1}</p>
                    <h3 className="text-lg font-semibold text-slate-900">{c.name}</h3>
                    <FitBadges c={c} />
                  </div>
                  <div className="flex flex-col items-center">
                    <Ring value={c.fit} size={64} stroke={7} />
                    <p className="mt-1 text-[11px] text-slate-400">{t("fit_score")}</p>
                  </div>
                </div>

                <div className="mt-5 grid sm:grid-cols-2 gap-4 text-xs text-slate-500">
                  {([["k_label", c.breakdown.competency], ["m_label", c.breakdown.interest]] as [Key, number][]).map(([label, v]) => (
                    <div key={label}>
                      <div className="flex justify-between mb-1"><span>{t(label)}</span><span className="font-medium text-slate-700">{v}</span></div>
                      <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${v}%` }} /></div>
                    </div>
                  ))}
                </div>

                <p className="mt-5 text-sm leading-relaxed text-slate-700"><Summary c={c} /></p>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span>{t("relevant")}</span>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => rate(c.slug, n)}
                        className={`w-8 h-8 rounded-md border text-xs ${n <= mine ? "bg-brand-600 border-brand-600 text-white" : "border-slate-300 hover:border-brand-400"}`}>{n}</button>
                    ))}
                    {mine > 0 && <span className="text-xs text-emerald-600">{t("saved")}</span>}
                  </div>
                  <Link href={`/results/${a.id}/career/${c.slug}`} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">{t("view_details")}</Link>
                </div>
              </article>
            );
          })}
          {!more && a.results.length > 10 && <button onClick={() => setMore(true)} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand-300">{t("res_more", { n: a.results.length - 10 })}</button>}
          <p className="text-xs text-slate-400">{t("res_stored_note", { n: a.results.length, total: a.input.n_ranked ?? a.results.length })}</p>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl bg-white border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-900">{t("how_score")}</h3>
            <p className="mt-2 text-sm text-slate-500">{t("how_score_d")}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex justify-between"><span>{t("k_label")}</span><span className="font-medium">50%</span></li>
              <li className="flex justify-between"><span>{t("m_label")}</span><span className="font-medium">50%</span></li>
            </ul>
            <p className="mt-3 text-xs text-slate-400 leading-relaxed">{t("how_score_note")}</p>
          </div>

          <div className="rounded-xl bg-white border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-900">{t("your_input")}</h3>
            <dl className="mt-3 space-y-3 text-sm">
              <div><dt className="text-slate-500">{t("in_courses")}</dt>
                <dd className="mt-1 text-slate-800">{inputCourses(a.input.courses, courseNames).map((c) => `${c.name} (${c.grade})`).join(", ") || "—"}</dd></div>
              <div><dt className="text-slate-500">{t("in_skills")}</dt>
                <dd className="mt-1 flex flex-wrap gap-1">{Object.entries(a.input.self_rated).map(([k, v]) => (
                  <span key={k} className="rounded bg-slate-100 px-2 py-0.5 text-xs">{skill(k)}: {t(`lvl_${v}` as Key)}</span>))}
                  {(a.input.custom_skills || []).map((c) => <span key={c.name} className="rounded border border-dashed border-amber-300 px-2 py-0.5 text-xs">{c.name}: {t(`lvl_${c.level}` as Key)}</span>)}
                  {!Object.keys(a.input.self_rated).length && !(a.input.custom_skills || []).length && "—"}</dd></div>
              <div><dt className="text-slate-500">{t("in_exp")}</dt><dd className="mt-1 text-slate-800">{a.input.experience.join(", ") || "—"}</dd></div>
              <div><dt className="text-slate-500">{t("in_int")}</dt><dd className="mt-1 text-slate-800">{a.input.interests.map(interest).join(", ")}</dd></div>
              {a.input.target_career && <div><dt className="text-slate-500">{t("tg_t")}</dt><dd className="mt-1 text-slate-800">{a.input.target_career.name}</dd></div>}
            </dl>
            <a href={`${API}/api/assessments/${a.id}`} target="_blank" className="mt-4 inline-block text-xs font-medium text-brand-600 hover:underline">{t("as_json")}</a>
          </div>
        </aside>
      </div>
    </Page>
  );
}
