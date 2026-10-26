"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Page, Loading } from "@/components/Shell";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/** "My Recommendations" in the sidebar: open the latest assessment, or the form if none. */
export default function Latest() {
  const { t } = useI18n();
  const router = useRouter();
  useEffect(() => {
    api.history().then((h) => router.replace(h.length ? `/results/${h[0].id}` : "/assessment")).catch(() => router.replace("/assessment"));
  }, [router]);
  return <Page heading={t("nav_results")}><Loading /></Page>;
}
