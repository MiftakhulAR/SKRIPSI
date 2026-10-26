"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AreaIcon } from "@/components/AreaIcon";
import { Ring } from "@/components/Charts";
import { Loading, Page } from "@/components/Shell";
import { api, CareerCard } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Sort = "default" | "ads" | "name" | "cov";
type TierF = "all" | "validated" | "reference";
const PAGE = 24;

export default function Careers() {
  const { t, interest, lang, group, skill } = useI18n();
  const [list, setList] = useState<CareerCard[] | null>(null);
  const [err, setErr] = useState("");
  const [tier, setTier] = useState<TierF>("all");
  const [grp, setGrp] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("default");
  const [hover, setHover] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    api.careers().then(setList).catch(() => setErr(t("api_error")));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setLimit(PAGE), [tier, grp, q, sort]);

  const shown = useMemo(() => {
    if (!list) return [];
    const s = q.toLowerCase();
    return list
      .filter((c) => tier === "all" || c.tier === tier)
      .filter((c) => !grp || c.group_code === grp)
      .filter((c) => !s || c.name.toLowerCase().includes(s) || (c.name_id || "").toLowerCase().includes(s)
        || c.skills.some((k) => k.toLowerCase().includes(s) || skill(k).toLowerCase().includes(s))
        || c.interest_areas.some((a) => interest(a).toLowerCase().includes(s)))
      .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "cov" ? (b.coverage_pct ?? -1) - (a.coverage_pct ?? -1)
        : sort === "ads" ? b.n_ads - a.n_ads : (a.tier === b.tier ? 0 : a.tier === "validated" ? -1 : 1));
  }, [list, tier, grp, q, sort, skill, interest]);

  if (!list) return <Page heading={t("nav_careers")} sub={t("careers_sub2")}><Loading error={err} /></Page>;
  const validated = list.filter((c) => c.tier === "validated");
  const groups = [...new Set(list.map((c) => c.group_code).filter(Boolean))].sort() as string[];
  const totalAds = validated.reduce((s, c) => s + c.n_ads, 0);
  const maxAds = Math.max(1, ...validated.map((c) => c.n_ads));
  const byAds = [...validated].sort((a, b) => b.n_ads - a.n_ads);
  const fmt = (n: number) => n.toLocaleString(lang === "id" ? "id-ID" : "en-US");
  const tiers: [TierF, string, number][] = [["all", t("ex_tier_all"), list.length], ["validated", t("tier_validated"), validated.length],
    ["reference", t("tier_reference"), list.length - validated.length]];

  return (
    <Page heading={t("nav_careers")} sub={t("careers_sub2")}>
      <div className="space-y-6">
        {/* hero + stat tiles */}
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 p-6 sm:p-8 text-white">
          <h2 className="text-2xl font-bold">{t("ex_hero_t")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-brand-100">{t("ex_hero_d2")}</p>
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {([[t("ex_stat_careers"), fmt(list.length)], [t("ex_stat_fields"), groups.length], [t("ex_stat_validated"), validated.length],
              [t("ex_stat_ads"), fmt(totalAds)]] as [string, string | number][]).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
                <p className="text-2xl font-bold tabular-nums">{v}</p><p className="text-xs text-brand-100">{k}</p>
              </div>
            ))}
          </div>
        </section>

        {/* demand overview: job ads per validated IT career */}
        {tier !== "reference" && !grp && (
        <section className="rounded-2xl bg-white border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900">{t("ex_demand_t")}</h3>
          <p className="text-sm text-slate-500 mt-1">{t("ex_demand_d2")}</p>
          <ul className="mt-5 grid gap-x-8 gap-y-1.5 lg:grid-cols-2">
            {byAds.map((c) => (
              <li key={c.slug}>
                <Link href={`/careers/${c.slug}`} onMouseEnter={() => setHover(c.slug)} onMouseLeave={() => setHover(null)}
                  className="relative grid grid-cols-[minmax(120px,180px)_1fr_48px] items-center gap-3 rounded-md px-1 py-1 hover:bg-slate-50">
                  <span className={`truncate text-sm ${hover === c.slug ? "text-brand-700" : "text-slate-700"}`}>{c.name}</span>
                  <span className="h-3 rounded bg-slate-100">
                    <span className={`block h-full rounded-[4px] ${c.graduate_profile ? "bg-brand-600" : "bg-brand-300"}`} style={{ width: `${Math.max(1.5, (c.n_ads / maxAds) * 100)}%` }} />
                  </span>
                  <span className="text-right text-xs tabular-nums text-slate-500">{fmt(c.n_ads)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-600" />{t("grad_profile")}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-300" />{t("ex_other")}</span>
          </div>
        </section>
        )}

        {/* filters */}
        <div className="flex flex-wrap items-center gap-2">
          {tiers.map(([k, label, n]) => (
            <button key={k} onClick={() => setTier(k)}
              className={`rounded-full border px-3 py-1.5 text-sm ${tier === k ? "bg-brand-600 border-brand-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-brand-400"}`}>
              {label} <span className="opacity-70">({fmt(n)})</span></button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ex_search2")}
              className="w-full sm:w-80 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            <select value={grp} onChange={(e) => setGrp(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
              <option value="">{t("ex_all_fields")}</option>
              {groups.map((g) => <option key={g} value={g}>{group(g) || g}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">{t("ex_sort")}
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-md border border-slate-300 px-2 py-1.5">
              <option value="default">{t("ex_sort_default")}</option><option value="ads">{t("ex_sort_ads")}</option><option value="name">{t("ex_sort_name")}</option><option value="cov">{t("ex_sort_cov")}</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-slate-500">{t("ex_count", { n: fmt(shown.length) })}</p>

        {/* cards */}
        {shown.length === 0 && <p className="text-sm text-slate-500">{t("ex_none")}</p>}
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.slice(0, limit).map((c) => {
            const top = c.top_skill_pct.slice(0, 3);
            return (
              <Link key={c.slug} href={`/careers/${c.slug}`}
                className="group flex flex-col rounded-2xl bg-white border border-slate-200 p-5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 group-hover:bg-brand-600 group-hover:text-white">
                    <AreaIcon area={c.interest_areas[0]} className="w-6 h-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900 group-hover:text-brand-700">{c.name}</h3>
                    <p className="text-xs text-slate-500">{c.tier === "reference" ? `${group(c.group_code)}${c.job_zone ? ` · ${t("job_zone", { z: c.job_zone })}` : ""}` : c.interest_areas.map(interest).join(" · ")}</p>
                  </div>
                  {c.coverage_pct != null && <div className="text-center" title={t("ex_cov")}><Ring value={c.coverage_pct} size={48} stroke={5} color="#0d9488" /><p className="mt-0.5 text-[9px] uppercase tracking-wide text-slate-400">{t("ex_cov_short")}</p></div>}
                </div>
                {c.graduate_profile && <span className="mt-3 w-fit rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{t("grad_profile")}</span>}
                {c.tier === "reference" && <span title={t("tier_reference_d")} className="mt-3 w-fit rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">{t("tier_reference")}</span>}
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{c.tier === "reference" ? t("ex_top3_ref") : t("ex_top3")}</p>
                <ul className="mt-2 space-y-1.5">
                  {top.map((s) => (
                    <li key={s.skill} className="grid grid-cols-[1fr_auto] items-center gap-x-2 text-xs">
                      <span className="truncate text-slate-700">{skill(s.skill)}</span><span className="tabular-nums text-slate-500">{s.demand_pct != null ? `${Math.round(s.demand_pct)}%` : `${Math.round((s.w ?? 0) * 100)}`}</span>
                      <span className="col-span-2 h-1.5 rounded bg-slate-100"><span className={`block h-full rounded-[4px] ${s.demand_pct != null ? "bg-brand-500" : "bg-amber-400"}`} style={{ width: `${s.demand_pct ?? Math.min(100, (s.w ?? 0) * 100)}%` }} /></span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex items-center justify-between pt-4 text-xs text-slate-500">
                  <span>{c.tier === "reference" ? (c.source || t("tier_reference")) : t("careers_ads", { n: fmt(c.n_ads) })} · {t("careers_req", { n: c.n_required })}</span>
                  <span className="font-medium text-brand-600 group-hover:underline">{t("ex_view")} →</span>
                </div>
                {c.coverage_pct != null && <p className="sr-only">{t("ex_cov")}: {c.coverage_pct}%</p>}
              </Link>
            );
          })}
        </div>
        {shown.length > limit && <div className="text-center"><button onClick={() => setLimit(limit + PAGE)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand-300">{t("ex_more", { n: fmt(shown.length - limit) })}</button></div>}
        <p className="text-xs text-slate-400">{t("ex_cov_note")}</p>
        <p className="text-xs text-slate-400">{t("onet_credit")}</p>
      </div>
    </Page>
  );
}
