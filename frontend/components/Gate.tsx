"use client";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { Page } from "@/components/Shell";
import { Protected, RequireAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

/** Layout guard: visitors can browse public pages; these routes need an account (or admin role). */
export function Gate({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { t } = useI18n();
  if (usePathname() === "/admin/login") return <>{children}</>;   // the admin login page itself is public
  return (
    <Protected admin={admin} heading={<Page heading={t("login_needed_t")}><RequireAuth admin={admin}>{null}</RequireAuth></Page>}>
      {children}
    </Protected>
  );
}
