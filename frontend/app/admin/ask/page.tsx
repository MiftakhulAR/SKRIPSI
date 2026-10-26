"use client";
import { useEffect, useState } from "react";
import { AskChat } from "@/components/AskChat";
import { Page } from "@/components/Shell";
import { api, Feedback, KbDoc } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function AdminAskAI() {
  const { t } = useI18n();
  const [f, setF] = useState<Feedback | null>(null);
  const [docs, setDocs] = useState<KbDoc[] | null>(null);

  useEffect(() => {
    api.feedback().then(setF).catch(() => {});
    api.kb().then(setDocs).catch(() => {});
  }, []);

  const rows: [string, number | string | undefined][] = [
    [t("fb_users"), f?.users], [t("fb_assess"), f?.assessments], [t("fb_ratings"), f?.ratings], [t("nav_kb"), docs?.length],
  ];
  const aside = (
    <div className="rounded-xl bg-white border border-slate-200 p-5">
      <h3 className="font-semibold text-slate-900">{t("aask_ctx_t")}</h3>
      <ul className="mt-4 space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <li key={k} className="flex justify-between"><span className="text-slate-600">{k}</span><span className="font-semibold text-slate-900">{v ?? "…"}</span></li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-slate-400">{t("aask_mode_note")}</p>
    </div>
  );

  return (
    <Page heading={t("nav_ask")} sub={t("aask_sub")} crumbs={[{ label: t("nav_admin") }, { label: t("nav_ask") }]}>
      <AskChat ask={api.adminAsk} chips={[t("aask_q1"), t("aask_q2"), t("aask_q3")]} emptyText={t("aask_empty_d")} note="" aside={aside} />
    </Page>
  );
}
