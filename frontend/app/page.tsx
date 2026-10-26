"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Page } from "@/components/Shell";
import { api, HistoryRow } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export default function Dashboard() {
  const { t } = useI18n();
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [err, setErr] = useState("");
  const { user, ready } = useAuth();
  useEffect(() => {
    if (!ready) return;
    if (!user) { setHistory([]); return; }
    api.history().then(setHistory).catch(() => setErr("api"));
  }, [user, ready]);
  const latest = history[0];

  return (
    <Page heading={t("nav_dashboard")} sub={t("dash_sub")}>
      <div className="space-y-8">
        {err && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{t("api_error")}</div>}
        <section className="rounded-2xl bg-gradient-to-br from-brand-700 to-brand-500 text-white p-8 sm:p-10">
          <p className="text-sm font-medium text-brand-100">{user ? t("hi", { name: user.name.split(" ")[0] }) : "CareerAI"}</p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-bold max-w-2xl">{t("hero_title")}</h2>
          <p className="mt-3 text-brand-100 max-w-2xl">{t("hero_body")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {user?.role === "admin"
              ? <Link href="/admin/kb" className="rounded-lg bg-white text-brand-700 px-5 py-2.5 text-sm font-semibold hover:bg-brand-50">{t("nav_kb")}</Link>
              : <Link href="/assessment" className="rounded-lg bg-white text-brand-700 px-5 py-2.5 text-sm font-semibold hover:bg-brand-50">{t("start")}</Link>}
            {latest
              ? <Link href={`/results/${latest.id}`} className="rounded-lg border border-white/40 px-5 py-2.5 text-sm font-semibold hover:bg-white/10">{t("view_last")}</Link>
              : <Link href="/careers" className="rounded-lg border border-white/40 px-5 py-2.5 text-sm font-semibold hover:bg-white/10">{t("explore")}</Link>}
          </div>
        </section>

        <section>
          <h3 className="text-base font-semibold text-slate-900 mb-4">{t("how_it_works")}</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {([["how1_t", "how1_d"], ["how2_t", "how2_d"], ["how3_t", "how3_d"]] as const).map(([a, b], i) => (
              <div key={a} className="rounded-xl bg-white border border-slate-200 p-5">
                <span className="text-xs font-semibold text-brand-600">{t("step")} {i + 1}</span>
                <h4 className="mt-1 font-semibold text-slate-900">{t(a)}</h4>
                <p className="mt-1 text-sm text-slate-500">{t(b)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl bg-white border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">{t("latest_rec")}</h3>
              {latest && <Link href={`/results/${latest.id}`} className="text-sm font-medium text-brand-600 hover:underline">{t("see_all")}</Link>}
            </div>
            {latest ? (
              <div className="mt-4 space-y-2">
                {latest.top.map((c) => (
                  <Link key={c.slug} href={`/results/${latest.id}/career/${c.slug}`} className="flex items-center gap-4 rounded-lg p-3 hover:bg-slate-50">
                    <div className="w-44 shrink-0 font-medium text-slate-900">{c.name}</div>
                    <div className="flex-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${c.score}%` }} /></div>
                    <div className="w-20 text-right font-semibold text-brand-700">{c.score}/100</div>
                  </Link>
                ))}
              </div>
            ) : <p className="mt-4 text-sm text-slate-500">{user || !ready ? t("no_assessment") : <>{t("latest_login")} <Link href="/login" className="font-medium text-brand-600 hover:underline">{t("login")}</Link></>}</p>}
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900">{t("history")}</h3>
            {history.length ? (
              <ul className="mt-4 divide-y divide-slate-100 text-sm">
                {history.map((h) => (
                  <li key={h.id}><Link href={`/results/${h.id}`} className="py-3 flex justify-between gap-2 hover:text-brand-700">
                    <span>{h.created_at}</span><span className="text-slate-500 truncate">{h.top[0]?.name} · {h.top[0]?.score}</span></Link></li>
                ))}
              </ul>
            ) : <p className="mt-4 text-sm text-slate-500">{t("empty")}</p>}
          </div>
        </section>
      </div>
    </Page>
  );
}
