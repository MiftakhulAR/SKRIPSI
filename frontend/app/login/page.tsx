"use client";
import { AuthForm } from "@/components/AuthForm";
import { Page } from "@/components/Shell";
import { useI18n } from "@/lib/i18n";

export default function Login() {
  const { t } = useI18n();
  return <Page heading={t("login")}><AuthForm mode="login" /></Page>;
}
