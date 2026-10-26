"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

/** Page through a long list; jumps back to page 1 whenever `reset` (e.g. the active filters) changes. */
export function usePaged<T>(items: T[], size: number, reset: string) {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [reset]);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const cur = Math.min(page, pages - 1);
  return { rows: items.slice(cur * size, cur * size + size), page: cur, pages, setPage, total: items.length, size };
}

export function Pager({ page, pages, setPage, total, size }: { page: number; pages: number; setPage: (p: number) => void; total: number; size: number }) {
  const { t } = useI18n();
  if (total === 0) return null;
  // first, last and the pages around the current one; "…" for the gaps
  const nums = [...new Set([0, page - 1, page, page + 1, pages - 1])].filter((p) => p >= 0 && p < pages).sort((a, b) => a - b);
  const cell = "min-w-8 rounded-md px-2 py-1 text-xs font-medium";
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
      <span className="text-xs text-slate-500">{t("pg_showing", { a: page * size + 1, b: Math.min(total, (page + 1) * size), n: total })}</span>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className={`${cell} text-slate-600 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent`}>‹ {t("pg_prev")}</button>
          {nums.map((p, i) => (
            <span key={p} className="flex items-center gap-1">
              {i > 0 && p - nums[i - 1] > 1 && <span className="px-1 text-xs text-slate-400">…</span>}
              <button type="button" onClick={() => setPage(p)} className={`${cell} ${p === page ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{p + 1}</button>
            </span>
          ))}
          <button type="button" disabled={page === pages - 1} onClick={() => setPage(page + 1)} className={`${cell} text-slate-600 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent`}>{t("pg_next")} ›</button>
        </div>
      )}
    </div>
  );
}
