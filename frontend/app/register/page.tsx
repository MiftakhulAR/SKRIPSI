"use client";
import { AuthForm } from "@/components/AuthForm";
import { Page } from "@/components/Shell";
import { useI18n } from "@/lib/i18n";

export default function Register() {
  const { t } = useI18n();
  return <Page heading={t("register")}><AuthForm mode="register" /></Page>;
}
