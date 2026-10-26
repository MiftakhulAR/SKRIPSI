"use client";
import { useEffect, useState } from "react";
import { api, ApiError, errCode, ExplainMode, Explanation, Passage, RagStatus, Statement } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Key, useI18n } from "@/lib/i18n";

const SECTIONS: [keyof Explanation, Key, string][] = [
  ["basis_of_fit", "ai_basis", "M9 12l2 2 4-4M12 3a9 9 0 100 18 9 9 0 000-18z"],
  ["matched_competencies", "ai_matched", "M5 13l4 4L19 7"],
  ["competencies_to_improve", "ai_improve", "M12 19V5M5 12l7-7 7 7"],
  ["development_advice", "ai_advice", "M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5zM4 19.5A2.5 2.5 0 006.5 22H20v-5"],
];
const TYPE_KEY: Record<string, Key> = {
  skkni: "ai_type_skkni", okupasi: "ai_type_okupasi", profil_karier: "ai_type_profil_karier", rps: "ai_type_rps",
  mata_kuliah: "ai_type_mata_kuliah", kurikulum: "ai_type_kurikulum",
};
const asStatement = (x: Statement | string): Statement =>
  typeof x === "string" ? { text: x, sources: ["DATA"], cites: [], data: true, unsupported: [], checked: false } : x;

/** Numbered chip that jumps to the passage in the source list of this card. */
function PassageChip({ n, id }: { n: number; id: string }) {
  return <a href={`#${id}-p${n}`} className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-brand-100 px-1 align-middle text-[11px] font-semibold text-brand-700 hover:bg-brand-200">{n}</a>;
}

function PassageList({ items, id }: { items: Passage[]; id: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t("ai_sources_t")}</h4>
      <ol className="mt-3 space-y-2.5 text-sm">
        {items.map((p) => (
          <li key={p.n} id={`${id}-p${p.n}`} className="flex gap-3 scroll-mt-24">
            <span className="mt-0.5 grid h-5 min-w-5 place-items-center rounded bg-brand-100 px-1 text-[11px] font-semibold text-brand-700">{p.n}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{TYPE_KEY[p.type] ? t(TYPE_KEY[p.type]) : p.type}</span>
                <span className="font-medium text-slate-800">{p.title.replace(/^\[[^\]]+\]\s*/, "")}</span>
                {p.score != null && <span className="text-[11px] tabular-nums text-slate-400">sim {p.score.toFixed(3)}</span>}
              </div>
              {p.source && <p className="mt-0.5 text-xs text-slate-500">{p.source}</p>}
              {p.access === "internal" ? <p className="mt-0.5 text-xs italic text-slate-400">{t("ai_internal_doc")}</p> : p.excerpt && (
                <>
                  <button onClick={() => setOpen(open === p.n ? null : p.n)} className="mt-1 text-xs font-medium text-brand-600 hover:underline">{t("ask_excerpt")}</button>
                  {open === p.n && <p className="mt-1 rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-600">{p.excerpt}</p>}
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** LLM explanation of one career. Validated careers: knowledge base (RAG) by default, with an optional
 *  comparison without it (same prompt and model). Cached on the server per assessment/career/language/mode. */
export function AIExplanation({ assessmentId, career }: { assessmentId: number; career: string }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [mode, setMode] = useState<ExplainMode>("rag");
  const [ex, setEx] = useState<Partial<Record<ExplainMode, Explanation>>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState<RagStatus | null>(null);
  const cur = ex[mode];
  const id = `ai-${career}`;

  useEffect(() => { setEx({}); setErr(""); setMode("rag"); }, [lang, career]);
  useEffect(() => { api.ragStatus().then(setStatus).catch(() => {}); }, []);

  async function run(m: ExplainMode, refresh = false) {
    setMode(m); setErr("");
    if (ex[m] && !refresh) return;
    setBusy(true);
    try {
      const r = await api.explain(assessmentId, career, lang, refresh, m);
      setEx((o) => ({ ...o, [m]: r }));
    } catch (e) {
      const c = errCode(e), st = (e as ApiError).status;
      setErr(c.startsWith("llm_") ? (t(`err_${c}` as Key) || c) : st ? t("err_http", { code: st }) : t("api_error"));
    }
    setBusy(false);
  }

  const canCompare = (status?.compare_enabled || user?.role === "admin") && (ex.rag?.tier ?? "validated") === "validated";
  const shown = cur?.mode ?? mode;
  const badge = shown === "rag" ? t("ai_mode_rag") : shown === "non_rag" ? t("ai_mode_non_rag") : t("ai_mode_system");
  const layer = cur?.kb_layer ? t(cur.kb_layer === "internal" ? "ai_layer_internal" : "ai_layer_public") : "";
  const modeText = !cur ? "" : cur.mode === "rag" ? (cur.passages?.length ? t("ai_mode_rag_d", { n: cur.passages.length, layer, tau: status?.tau ?? 0.8401 }) : t("ai_mode_rag_none"))
    : cur.mode === "non_rag" ? t("ai_mode_non_rag_d") : cur.mode === "system_data" ? t("ai_mode_system_d") : "";
  const chk = cur?.check;

  return (
    <section className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-sm font-bold text-white">AI</span>
          <div>
            <h3 className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
              {t("ai_t")}
              {cur && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${shown === "rag" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"}`}>{badge}</span>}
            </h3>
            <p className="mt-0.5 max-w-xl text-xs text-slate-500">{t("ai_d")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {cur && canCompare && (
            <button onClick={() => run(mode === "rag" ? "non_rag" : "rag")} disabled={busy}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
              {mode === "rag" ? t("ai_compare") : t("ai_compare_back")}
            </button>
          )}
          <button onClick={() => run(mode, !!cur)} disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 ${cur ? "border border-brand-300 text-brand-700 hover:bg-brand-50" : "bg-brand-600 text-white hover:bg-brand-700"}`}>
            {busy ? t("ai_loading") : cur ? t("ai_regen") : t("ai_btn")}
          </button>
        </div>
      </div>
      {err && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{err}</div>}
      {busy && !cur && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div>
      )}
      {cur && (
        <>
          {modeText && <p className="mt-4 text-xs text-slate-500">{modeText}</p>}
          <div className={`mt-3 grid gap-3 sm:grid-cols-2 ${busy ? "opacity-60" : ""}`}>
            {SECTIONS.map(([k, label, icon]) => (
              <div key={k} className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <svg className="h-4 w-4 text-brand-600" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d={icon} /></svg>
                  {t(label)}
                </h4>
                <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-700">
                  {((cur[k] as (Statement | string)[]) || []).map(asStatement).map((x, i) => (
                    <li key={i} className="flex gap-2">
                      <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${x.unsupported?.length ? "bg-amber-500" : "bg-brand-400"}`} />
                      <span>
                        {x.text}
                        {x.cites?.map((n) => <PassageChip key={n} n={n} id={id} />)}
                        {x.data && cur.mode && <span className="ml-1 align-middle text-[10px] font-medium uppercase tracking-wide text-slate-400">{t("ai_src_data")}</span>}
                        {x.unsupported?.length > 0 && (
                          <span className="mt-0.5 block text-[11px] text-amber-700">{t("ai_check_flag", { list: x.unsupported.map((u) => u.split(":").slice(1).join(":")).join(", ") })}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {!!cur.passages?.length && <PassageList items={cur.passages} id={id} />}
          <div className="mt-3 space-y-0.5 text-[11px] text-slate-400">
            {chk && <p title={t("ai_check_note")}>{chk.claims ? t("ai_check", { ok: chk.supported, n: chk.claims }) : t("ai_check_none")}</p>}
            <p>
              {t("ai_model", { m: cur.model, date: cur.created_at })}
              {cur.prompt_version === "v1" && <> · {cur.evaluated_config ? t("ai_eval_cfg", { v: 1 }) : t("ai_not_eval_cfg")}</>}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
