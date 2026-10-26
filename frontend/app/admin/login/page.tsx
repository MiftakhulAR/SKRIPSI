"use client";
import { AuthForm } from "@/components/AuthForm";
import { Page } from "@/components/Shell";
import { useI18n } from "@/lib/i18n";

/** Separate login for the admin web. Student accounts are refused here. */
export default function AdminLogin() {
  const { t } = useI18n();
  return <Page heading={t("admin_login_t")}><AuthForm mode="login" adminOnly /></Page>;
}
