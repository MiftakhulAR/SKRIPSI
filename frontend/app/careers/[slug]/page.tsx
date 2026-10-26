"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AreaIcon } from "@/components/AreaIcon";
import { Bars, Ring } from "@/components/Charts";
import { Loading, Page } from "@/components/Shell";
import { api, CareerFull } from "@/lib/api";
import { Key, useI18n } from "@/lib/i18n";

export default function CareerPublic() {
  const { t, interest, skill, group } = useI18n();
  const { slug } = useParams<{ slug: string }>();
  const [c, setC] = useState<CareerFull | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.career(slug).then(setC).catch(() => setErr(t("api_error"))); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) return <Page heading={t("nav_careers")}><Loading error={err} /></Page>;
  const related = [...new Set(c.required_skills.flatMap((s) => s.courses))];

  return (
    <Page heading={c.name} sub={[c.tier === "reference" ? group(c.group_code) : "", ...c.interest_areas.map(interest)].filter(Boolean).join(" · ")} crumbs={[{ label: t("nav_careers"), href: "/careers" }, { label: c.name }]}>
      <div className="space-y-6">
        <Link href="/careers" className="inline-flex text-sm font-medium text-brand-600 hover:underline">{t("careers_back")}</Link>
        <div className="grid lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 rounded-xl bg-white border border-slate-200 p-6">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><AreaIcon area={c.interest_areas[0]} className="w-6 h-6" /></span>
              <div>
                <h3 className="font-semibold text-slate-900">{t("car_chart_t")}</h3>
                <p className="text-sm text-slate-500 mt-1">{t("car_chart_d")}</p>
              </div>
            </div>
            <div className="mt-6">
              {c.tier === "reference" && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{t("tier_reference_bar")}</p>}
              <Bars items={c.required_skills.map((s) => ({ label: skill(s.skill), value: s.demand_pct ?? Math.min(100, s.w * 100), mark: s.courses.length > 0, note: s.courses.join(", ") }))}
                marker={t("car_taught")} />
            </div>
            <p className="mt-4 text-xs text-slate-500"><span className="text-emerald-600">•</span> {t("car_taught")}</p>
          </section>
          <aside className="space-y-6">
            <div className="rounded-xl bg-gradient-to-br from-brand-700 to-brand-500 p-6 text-white">
              <h3 className="font-semibold">{t("careers_cta_t")}</h3>
              <p className="mt-1 text-sm text-brand-100">{t("careers_cta_d")}</p>
              <Link href="/assessment" className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">{t("start")}</Link>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-6 text-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-900">{t("industry")}</h3>
                {c.coverage_pct != null && <Ring value={c.coverage_pct} size={64} stroke={6} color="#0d9488" />}
              </div>
              <dl className="mt-3 space-y-2">
                {c.tier === "reference"
                  ? <div className="flex justify-between gap-3"><dt className="text-slate-500">{t("tier_src")}</dt><dd className="text-right font-medium">{c.source || "—"}</dd></div>
                  : <div className="flex justify-between"><dt className="text-slate-500">{t("ind_ads")}</dt><dd className="font-medium">{c.n_ads}</dd></div>}
                <div className="flex justify-between"><dt className="text-slate-500">{t("ind_req")}</dt><dd className="font-medium">{c.required_skills.length}</dd></div>
                {c.coverage_pct != null && <div className="flex justify-between"><dt className="text-slate-500">{t("ind_cov")}</dt><dd className="font-medium">{c.coverage_pct}%</dd></div>}
              </dl>
              <p className="mt-3 text-xs text-slate-400">{c.tier === "reference" ? t("tier_reference_d") : t("ind_src")}</p>
              {c.description && <p className="mt-3 text-xs text-slate-600">{c.description}</p>}
              {c.job_zone && <p className="mt-2 text-xs text-slate-500">{t("job_zone", { z: c.job_zone })} — {t(`jz_${c.job_zone}` as Key)}</p>}
              {c.tier === "reference" && <p className="mt-3 text-[11px] text-slate-400">{t("onet_credit")}</p>}
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">{t("rel_courses")}</h3>
              {related.length
                ? <ul className="mt-3 space-y-2 text-sm">{related.map((n) => <li key={n} className="rounded-lg bg-slate-50 px-3 py-2">{n}</li>)}</ul>
                : <p className="mt-3 text-sm text-slate-500">{t("no_rel")}</p>}
            </div>
          </aside>
        </div>
      </div>
    </Page>
  );
}
