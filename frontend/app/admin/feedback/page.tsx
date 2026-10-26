"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Loading, Page } from "@/components/Shell";
import { api, Feedback } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function UserFeedback() {
  const { t } = useI18n();
  const [f, setF] = useState<Feedback | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.feedback().then(setF).catch(() => setErr(t("api_error"))); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Page heading={t("fb_t")} sub={t("fb_sub")} crumbs={[{ label: t("nav_admin") }, { label: t("nav_feedback") }]}>
      {!f ? <Loading error={err} /> : (
        <div className="space-y-6">
          <section className="grid sm:grid-cols-4 gap-4">
            {([[t("fb_users"), f.users], [t("fb_assess"), f.assessments], [t("fb_ratings"), f.ratings]] as [string, number][]).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-white border border-slate-200 p-5"><p className="text-sm text-slate-500">{k}</p><p className="mt-1 text-2xl font-bold text-slate-900">{v}</p></div>
            ))}
            <div className="rounded-xl bg-white border border-slate-200 p-5">
              <p className="text-sm text-slate-500">{t("fb_mean")}</p>
              <p className={`mt-1 text-2xl font-bold ${f.mean_top3 == null ? "text-slate-400" : f.mean_top3 >= 3.5 ? "text-emerald-600" : "text-amber-600"}`}>{f.mean_top3 ?? "—"}</p>
              <p className="text-xs text-slate-400">{t("fb_target")} · n = {f.n_top3}</p>
            </div>
          </section>
          {f.fr4 && (
            <section className="rounded-xl bg-white border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">{t("fb_fr4_t")}</h3>
              <p className="mt-1 text-xs text-slate-500">{t("fb_fr4_d")}</p>
              <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                {([[t("fb_fr4_n"), f.fr4.assessments_with_story], [t("fb_fr4_sug"), f.fr4.suggested], [t("fb_fr4_acc"), f.fr4.accepted],
                  ["%", f.fr4.accepted_pct ?? "—"]] as [string, number | string][]).map(([k, v]) => (
                  <div key={k}><dt className="text-slate-500">{k}</dt><dd className="mt-1 text-xl font-bold text-slate-900">{v}</dd></div>
                ))}
              </dl>
            </section>
          )}
          <div className="grid lg:grid-cols-2 gap-6">
            <section className="rounded-xl bg-white border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">{t("fb_per_career")}</h3>
              {f.per_career.length === 0 ? <p className="mt-3 text-sm text-slate-500">{t("fb_none")}</p> : (
                <table className="mt-4 w-full text-sm">
                  <thead><tr className="text-left text-slate-500 border-b border-slate-200"><th className="py-2 pr-3">{t("col_career")}</th><th className="py-2 pr-3">{t("fb_n")}</th><th className="py-2">{t("fb_avg")}</th></tr></thead>
                  <tbody>{f.per_career.map((c) => (
                    <tr key={c.slug} className="border-b border-slate-100"><td className="py-2.5 pr-3 font-medium text-slate-800">{c.name}</td><td className="py-2.5 pr-3 text-slate-600">{c.n}</td>
                      <td className="py-2.5"><div className="flex items-center gap-2"><div className="w-20 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${(c.mean / 5) * 100}%` }} /></div><span className="text-xs text-slate-600">{c.mean}</span></div></td></tr>
                  ))}</tbody>
                </table>
              )}
            </section>
            <section className="rounded-xl bg-white border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">{t("fb_recent")}</h3>
              {f.recent.length === 0 ? <p className="mt-3 text-sm text-slate-500">{t("fb_none")}</p> : (
                <ul className="mt-4 divide-y divide-slate-100 text-sm">
                  {f.recent.map((r, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                      <span><span className="font-medium text-slate-800">{r.career}</span> <span className="text-xs text-slate-400">· #{r.assessment_id} · {t("fb_rank")} {r.rank ?? "—"}</span></span>
                      <span className="whitespace-nowrap text-xs text-slate-500"><span className="inline-flex align-middle">{[1, 2, 3, 4, 5].map((n) => <Icon key={n} name="star" filled className={`h-3.5 w-3.5 ${n <= r.value ? "text-amber-400" : "text-slate-200"}`} />)}</span> · {r.created_at}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </Page>
  );
}
