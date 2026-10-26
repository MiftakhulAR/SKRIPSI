"use client";
import { useEffect, useState } from "react";
import { Loading, Page } from "@/components/Shell";
import { api, Meta, RagStatus } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function Settings() {
  const { t } = useI18n();
  const [m, setM] = useState<Meta | null>(null);
  const [n, setN] = useState(0);
  const [err, setErr] = useState("");
  const [rag, setRag] = useState<RagStatus | null>(null);
  useEffect(() => {
    api.ragStatus().then(setRag).catch(() => {});
    api.meta().then(setM).catch(() => setErr(t("api_error")));
    api.careers().then((c) => setN(c.length)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rows: [string, string][] = m ? [
    [t("set_alpha"), `${m.alpha} (K ${m.alpha * 100}% · M ${(1 - m.alpha) * 100}%)`],
    [t("set_threshold"), t("set_threshold_v")],
    [t("set_careers"), String(n)],
    [t("set_skills"), String(Object.values(m.skills_by_category).flat().length)],
    [t("set_courses"), String(m.courses.length)],
  ] : [];
  const ragRows: [string, string][] = !rag ? [] : !rag.ready ? [[t("set_rag_t"), t("set_rag_off", { e: rag.error || "-" })]] : [
    [t("set_rag_layer"), `${rag.layer}${rag.evaluated_layer ? ` (Tahap 12: ${rag.evaluated_layer})` : ""}`],
    [t("set_rag_passages"), `${rag.passages} · ${Object.entries(rag.by_type || {}).map(([k, v]) => `${k} ${v}`).join(", ")}`],
    [t("set_rag_tau"), `${rag.tau} / ${rag.top_k}`],
    [t("set_rag_embed"), `${rag.embedding_model}${rag.embedding_mock ? " (mock)" : ""}`],
    [t("set_rag_model"), `${rag.evaluated_model} · prompt ${rag.prompt_version}`],
    [t("set_rag_llm"), `${rag.llm.provider} · ${rag.llm.model}${rag.llm.mock ? " (mock)" : ""}`],
    [t("set_rag_compare"), rag.compare_enabled ? t("set_yes") : t("set_no")],
  ];

  return (
    <Page heading={t("set_t")} sub={t("set_sub")} crumbs={[{ label: t("nav_admin") }, { label: t("nav_settings") }]}>
      {!m ? <Loading error={err} /> : (
        <section className="max-w-2xl rounded-xl bg-white border border-slate-200 p-6">
          <dl className="divide-y divide-slate-100 text-sm">
            {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-3"><dt className="text-slate-500">{k}</dt><dd className="font-medium text-slate-900 text-right">{v}</dd></div>)}
          </dl>
          <p className="mt-4 text-xs text-slate-400">{t("set_note")}</p>
          {ragRows.length > 0 && (
            <>
              <h3 className="mt-8 text-sm font-semibold text-slate-900">{t("set_rag_t")}</h3>
              <dl className="mt-2 divide-y divide-slate-100 text-sm">
                {ragRows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-3"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium text-slate-900">{v}</dd></div>)}
              </dl>
            </>
          )}
        </section>
      )}
    </Page>
  );
}
