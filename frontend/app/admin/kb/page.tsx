"use client";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Page } from "@/components/Shell";
import { api, CareerCard, KbDoc } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const TYPES = ["Curriculum", "CPL", "RPS", "Graduate profile", "Career profiles", "Industry data", "Competency standard", "Graduate outcomes"];
const FILTERS = ["Curriculum", "CPL", "RPS", "Graduate profile", "Career profiles", "Industry data"];

function StatusBadge({ s }: { s: string }) {
  const cls = s === "Indexed" ? "bg-emerald-50 text-emerald-700" : s === "Processing" ? "bg-amber-50 text-amber-700"
    : s === "Failed" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600";
  const { kb } = useI18n();
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{kb(s)}</span>;
}

export default function KnowledgeBase() {
  const { t, kb } = useI18n();
  const [docs, setDocs] = useState<KbDoc[]>([]);
  const [careers, setCareers] = useState<CareerCard[]>([]);
  const [filter, setFilter] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.kb().then(setDocs).catch(() => setMsg({ ok: false, text: t("api_error") }));
    api.careers().then(setCareers).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData(e.currentTarget);
    fd.set("file", file);
    try { setDocs(await api.kbUpload(fd)); setDrawer(false); setFile(null); setMsg({ ok: true, text: t("kb_uploaded") }); }
    catch { setMsg({ ok: false, text: t("kb_bad") }); }
  }
  async function remove(d: KbDoc) {
    if (!window.confirm(`${t("kb_confirm")}\n${kb(d.title)}`)) return;
    setDocs(await api.kbDelete(d.id)); setMsg({ ok: true, text: t("kb_deleted") });
  }

  const shown = filter ? docs.filter((d) => d.doc_type === filter) : docs;
  const stats: [string, number][] = [
    [t("kb_docs"), docs.length], [t("kb_files"), docs.filter((d) => d.filename).length], [t("kb_chunks"), docs.reduce((s, d) => s + d.chunks, 0)],
  ];

  return (
    <Page heading={t("kb_heading")} sub={t("kb_sub2")} crumbs={[{ label: t("nav_admin") }, { label: t("nav_kb") }]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {["", ...FILTERS].map((f) => (
              <button key={f || "all"} onClick={() => setFilter(f)}
                className={`rounded-full border px-3 py-1.5 text-sm ${filter === f ? "bg-brand-600 border-brand-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-brand-400"}`}>
                {f ? kb(f) : t("kb_all")}
              </button>
            ))}
          </div>
          <button onClick={() => setDrawer(true)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">+ {t("kb_upload_btn")}</button>
        </div>

        {msg && <div className={`rounded-lg border px-4 py-3 text-sm ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-sky-200 bg-sky-50 text-sky-800"}`}>{msg.text}</div>}

        <section className="grid sm:grid-cols-3 gap-4">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-xl bg-white border border-slate-200 p-5"><p className="text-sm text-slate-500">{k}</p><p className="mt-1 text-2xl font-bold text-slate-900">{v}</p></div>
          ))}
        </section>

        <section className="rounded-xl bg-white border border-slate-200 p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3">{t("kb_title")}</th><th className="py-2 pr-3">{t("kb_type")}</th><th className="py-2 pr-3">{t("kb_year")}</th>
                <th className="py-2 pr-3">{t("kb_chunks")}</th><th className="py-2 pr-3">{t("kb_status")}</th><th className="py-2 pr-3">{t("kb_updated")}</th><th className="py-2 text-right">{t("kb_actions")}</th>
              </tr></thead>
              <tbody>
                {shown.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100 align-top">
                    <td className="py-3 pr-3">
                      <p className="font-medium text-slate-800">{kb(d.title)}</p>
                      <p className="text-xs text-slate-400">{d.format} · {d.access === "private" ? t("kb_access_private") : t("kb_access_public")}</p>
                    </td>
                    <td className="py-3 pr-3 text-slate-500">{kb(d.doc_type)}</td>
                    <td className="py-3 pr-3 text-slate-500 whitespace-nowrap">{d.year || "—"}</td>
                    <td className="py-3 pr-3 text-slate-500">{d.chunks || "—"}</td>
                    <td className="py-3 pr-3"><StatusBadge s={d.status} /></td>
                    <td className="py-3 pr-3 text-slate-500 whitespace-nowrap">{d.updated}</td>
                    <td className="py-3 text-right whitespace-nowrap space-x-3">
                      <button onClick={() => setMsg({ ok: false, text: t("kb_view_info") })} className="font-medium text-slate-600 hover:text-brand-700">{t("kb_view")}</button>
                      <button onClick={() => setMsg({ ok: false, text: t("kb_reindex_info") })} className="font-medium text-slate-600 hover:text-brand-700">{t("kb_reindex")}</button>
                      <button onClick={() => remove(d)} className="font-medium text-rose-600 hover:underline">{t("kb_delete")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl bg-white border border-slate-200 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-900">{t("cat_t")}</h3>
              <p className="text-sm text-slate-500 mt-1">{t("cat_d")}</p>
            </div>
            <Link href="/admin/careers" className="shrink-0 text-sm font-medium text-brand-600 hover:underline">{t("see_all")}</Link>
          </div>
          <ul className="mt-4 grid sm:grid-cols-2 gap-2 text-sm">
            {careers.map((c) => (
              <li key={c.slug} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-medium text-slate-800">{c.name}</span>
                <Link href={`/careers/${c.slug}`} className="shrink-0 text-xs font-medium text-brand-600 hover:underline">{t("cat_edit")}</Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-30 flex justify-end bg-slate-900/30" onClick={() => setDrawer(false)}>
          <form onSubmit={upload} onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-md flex-col gap-4 bg-white p-6 shadow-xl text-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">{t("kb_upload_btn")}</h3>
              <button type="button" onClick={() => setDrawer(false)} className="text-slate-400 hover:text-slate-700" aria-label={t("kb_close")}><Icon name="x" className="h-5 w-5" /></button>
            </div>
            <div onClick={() => fileInput.current?.click()} onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); setFile(e.dataTransfer.files[0] ?? null); }}
              className="grid cursor-pointer place-items-center rounded-xl border-2 border-dashed border-slate-300 px-4 py-10 text-center hover:border-brand-400 hover:bg-brand-50/40">
              <p className="font-medium text-slate-700">{file ? file.name : t("kb_drop")}</p>
              <p className="mt-1 text-xs text-slate-400">{t("kb_drop_types")}</p>
              <input ref={fileInput} type="file" accept=".pdf,.docx,.csv,.txt,.md" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <label className="font-medium text-slate-700">{t("kb_title")}<input name="title" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></label>
            <label className="font-medium text-slate-700">{t("kb_type")}<select name="doc_type" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">{TYPES.map((x) => <option key={x} value={x}>{kb(x)}</option>)}</select></label>
            <label className="font-medium text-slate-700">{t("kb_year")}<input name="year" inputMode="numeric" placeholder="2025" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></label>
            <p className="text-xs text-slate-400">{t("kb_reindex_info")}</p>
            <button disabled={!file} className="mt-auto rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{t("kb_upload_index")}</button>
          </form>
        </div>
      )}
    </Page>
  );
}
