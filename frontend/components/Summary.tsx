"use client";
import { Result } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/** Numbered citation chip, linked to the source list on the detail page. */
export function Cite({ n }: { n: number }) {
  return <a href={`#src-${n}`} className="inline-flex items-center justify-center min-w-5 h-5 px-1 mx-0.5 rounded bg-brand-50 text-brand-700 text-[11px] font-semibold align-middle">{n}</a>;
}

/** Template explanation (P2). In P3 this is replaced by the LLM explanation + sources. */
export function Summary({ c }: { c: Result }) {
  const { t, skill } = useI18n();
  const s = c.summary;
  const courseIdx = s.best_course ? c.sources.findIndex((x) => x.key === s.best_course!.code) + 1 : 0;
  return (
    <>
      {t("sum_fit", { label: t(`fit_${s.label}`), career: c.name })}{" "}
      {s.top_matched.length > 0 && <>{t("sum_have", { list: s.top_matched.map((m) => m.demand_pct != null ? `${skill(m.skill)} (${Math.round(m.demand_pct)}% ${t("sum_of_ads")})` : skill(m.skill)).join(", ") })}<Cite n={1} />. </>}
      {s.best_course && <>{t("sum_grade", { grade: s.best_course.grade, course: s.best_course.name })}<Cite n={courseIdx} />. </>}
      {s.interest_match ? t("sum_int_yes") : t("sum_int_no")}{" "}
      {s.to_improve.length > 0 && t("sum_improve", { list: s.to_improve.map(skill).join(", ") })}
    </>
  );
}

export function FitBadges({ c }: { c: Result }) {
  const { t } = useI18n();
  return (
    <>
      <span className="inline-block mt-1 rounded-full bg-brand-50 text-brand-700 px-2.5 py-0.5 text-xs font-medium">{t(`fit_${c.summary.label}`)}</span>
      {c.graduate_profile && <span className="inline-block mt-1 ml-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-xs font-medium">{t("grad_profile")}</span>}
      {c.tier === "reference" && <span title={t("tier_reference_d")} className="inline-block mt-1 ml-1 rounded-full bg-amber-50 text-amber-700 px-2.5 py-0.5 text-xs font-medium">{t("tier_reference")}</span>}
      {c.is_target && <span className="inline-block mt-1 ml-1 rounded-full bg-slate-900 text-white px-2.5 py-0.5 text-xs font-medium">{t("tg_badge")}</span>}
    </>
  );
}
