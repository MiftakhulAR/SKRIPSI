"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AskChat } from "@/components/AskChat";
import { Page } from "@/components/Shell";
import { api, HistoryRow } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function AskAI() {
  const { t } = useI18n();
  const [latest, setLatest] = useState<HistoryRow | null | undefined>(undefined);

  useEffect(() => { api.history().then((h) => setLatest(h[0] ?? null)).catch(() => setLatest(null)); }, []);

  const aside = (
    <div className="rounded-xl bg-white border border-slate-200 p-5">
      <h3 className="font-semibold text-slate-900">{t("ask_ctx_t")}</h3>
      {latest === undefined ? <p className="mt-3 text-sm text-slate-500">{t("loading")}</p>
        : latest === null ? <p className="mt-3 text-sm text-slate-500">{t("ask_ctx_none")} <Link href="/assessment" className="font-medium text-brand-600 hover:underline">{t("start")}</Link></p>
        : (
          <>
            <ul className="mt-4 space-y-3">
              {latest.top.map((c, i) => (
                <li key={c.slug}>
                  <div className="flex justify-between text-sm"><span className="font-medium text-slate-800">{i + 1}. {c.name}</span><span className="font-semibold text-brand-700">{c.score}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${c.score}%` }} /></div>
                </li>
              ))}
            </ul>
            <Link href={`/results/${latest.id}`} className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">{t("ask_view_rec")} →</Link>
          </>
        )}
    </div>
  );

  return (
    <Page heading={t("nav_ask")} sub={t("ask_sub")} crumbs={[{ label: t("crumb_dashboard"), href: "/" }, { label: t("nav_ask") }]}>
      <AskChat ask={api.ask} chips={[t("ask_q1"), t("ask_q2"), t("ask_q3")]} emptyText={t("ask_empty_d")} note={t("ask_mode_note")} aside={aside} />
    </Page>
  );
}
