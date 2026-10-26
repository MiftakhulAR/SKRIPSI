"use client";
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Cite } from "@/components/Summary";
import { AskReply, AskSource, ApiError, ChatTurn, errCode } from "@/lib/api";
import { Key, useI18n } from "@/lib/i18n";

type Source = AskSource;
type Msg = { role: "user" | "ai"; text: string; sources?: Source[]; notice?: boolean };

/** Renders "[1]" markers in an answer as citation chips. */
function WithCites({ text }: { text: string }) {
  return <>{text.split(/(\[\d+\])/).map((p, i) => /^\[\d+\]$/.test(p) ? <Cite key={i} n={+p.slice(1, -1)} /> : <span key={i}>{p}</span>)}</>;
}

/** Chat panel shared by the student "Ask AI" page and the admin one; `ask` picks the endpoint. */
export function AskChat({ ask, chips, emptyText, note, aside }: {
  ask: (question: string, history: ChatTurn[], lang: string) => Promise<AskReply>;
  chips: string[]; emptyText: string; note: string; aside?: ReactNode;
}) {
  const { t, lang } = useI18n();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history = msgs.filter((m) => !m.notice).map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setQ(""); setBusy(true);
    try {
      const r = await ask(question, history, lang);
      setMsgs((m) => [...m, { role: "ai", text: r.answer, sources: r.sources }]);
    } catch (e) {
      const code = errCode(e);
      const status = (e as ApiError).status;
      const text = code.startsWith("llm_") ? (t(`err_${code}` as Key) || code) : status ? t("err_http", { code: status }) : t("api_error");
      setMsgs((m) => [...m, { role: "ai", text, notice: true }]);
    } finally { setBusy(false); }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); send(q); };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <section className={`${aside ? "lg:col-span-2" : "lg:col-span-3"} flex flex-col rounded-2xl bg-white border border-slate-200 min-h-[560px]`}>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
          {chips.map((c) => (
            <button key={c} onClick={() => send(c)} disabled={busy}
              className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-left text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60">{c}</button>
          ))}
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {msgs.length === 0 && (
            <div className="grid place-items-center py-16 text-center">
              <span className="grid place-items-center w-12 h-12 rounded-full bg-brand-50 text-brand-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" /></svg>
              </span>
              <h3 className="mt-3 font-semibold text-slate-900">{t("ask_empty_t")}</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">{emptyText}</p>
            </div>
          )}
          {msgs.map((m, i) => m.role === "user" ? (
            <div key={i} className="flex justify-end"><p className="max-w-[80%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm text-white">{m.text}</p></div>
          ) : (
            <div key={i} className="flex gap-3">
              <span className="grid place-items-center w-8 h-8 shrink-0 rounded-full bg-brand-100 text-brand-700 text-xs font-bold">AI</span>
              <div className={`max-w-[85%] rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-relaxed ${m.notice ? "border border-amber-200 bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-700"}`}>
                <WithCites text={m.text} />
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t("ask_sources")}</p>
                    <ol className="mt-2 space-y-1.5 text-xs">
                      {m.sources.map((s) => (
                        <li key={s.n} id={`src-${s.n}`}>
                          <span className="font-semibold text-brand-700">[{s.n}]</span>{" "}
                          {s.type && s.type !== "system" && <span className="mr-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">{t("ask_src_kb")}</span>}
                          {s.title.replace(/^\[[^\]]+\]\s*/, "")}
                          {s.access === "internal" && <span className="ml-1 italic text-slate-400">({t("ai_internal_doc")})</span>}
                          {s.access === "public" && s.excerpt && (
                            <button onClick={() => setOpen(open === `${i}-${s.n}` ? null : `${i}-${s.n}`)} className="ml-2 font-medium text-brand-600 hover:underline">{t("ask_excerpt")}</button>
                          )}
                          {open === `${i}-${s.n}` && <p className="mt-1 rounded-lg bg-white p-2 text-slate-500">“{s.excerpt}”</p>}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <p className="pl-11 text-sm text-slate-400 animate-pulse">…</p>}
          <div ref={end} />
        </div>

        <form onSubmit={submit} className="border-t border-slate-100 p-4">
          <div className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} placeholder={t("ask_ph")}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            <button disabled={busy || q.trim().length < 3} className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{t("ask_send")}</button>
          </div>
          <p className="mt-2 text-xs text-slate-400">{t("ask_helper")} {note}</p>
        </form>
      </section>

      {aside && <aside className="space-y-4">{aside}</aside>}
    </div>
  );
}
