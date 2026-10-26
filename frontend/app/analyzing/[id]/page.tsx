"use client";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useEffect, useState } from "react";
import { Page } from "@/components/Shell";
import { useI18n } from "@/lib/i18n";

const STAGES = [["an1_t", "an1_d"], ["an2_t", "an2_d"], ["an3_t", "an3_d"], ["an4_t", "an4_d"]] as const;

export default function Analyzing() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [cur, setCur] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setCur((c) => c + 1), 700);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (cur === STAGES.length) { const x = setTimeout(() => router.push(`/results/${id}`), 600); return () => clearTimeout(x); }
  }, [cur, id, router]);

  return (
    <Page heading={t("nav_assessment")} sub={t("an_sub")}>
      <div className="max-w-2xl mx-auto rounded-2xl bg-white border border-slate-200 p-8">
        <h2 className="text-lg font-semibold text-slate-900">{t("an_title")}</h2>
        <p className="text-sm text-slate-500 mt-1">{t("an_body")}</p>
        <ol className="mt-8 space-y-5">
          {STAGES.map(([a, b], i) => {
            const done = i < cur, on = i === cur;
            return (
              <li key={a} className="flex gap-4">
                {done ? <span className="grid place-items-center w-8 h-8 rounded-full bg-brand-600 text-white text-sm"><Icon name="check" className="h-4 w-4" /></span>
                  : on ? <span className="grid place-items-center w-8 h-8 rounded-full border-2 border-brand-500"><span className="w-3 h-3 rounded-full bg-brand-500 animate-pulse" /></span>
                  : <span className="w-8 h-8 rounded-full border-2 border-slate-200" />}
                <div>
                  <p className={`font-medium ${done || on ? "text-slate-900" : "text-slate-400"}`}>{t(a)}</p>
                  <p className={`text-sm ${done || on ? "text-slate-500" : "text-slate-300"}`}>{t(b)}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-8 text-xs text-slate-400">{t("an_note")}</p>
      </div>
    </Page>
  );
}
