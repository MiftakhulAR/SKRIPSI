"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Key, useI18n } from "@/lib/i18n";

type NavItem = { key: string; label: Key; href: string; icon: string; group?: Key; adminOnly?: boolean; studentOnly?: boolean };

const I = {
  home: "M3 12l9-9 9 9M5 10v10h14V10",
  compass: "M12 21a9 9 0 100-18 9 9 0 000 18zm3.5-12.5l-2 5-5 2 2-5z",
  clipboard: "M9 5h6M9 3h6v4H9zM7 5H5v16h14V5h-2M9 12h6M9 16h4",
  star: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0",
  chat: "M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z",
  db: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zm0 0v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  thumb: "M7 10v11H3V10zm0 0l4-8a3 3 0 013 3v3h6a2 2 0 012 2.3l-1.4 8A2 2 0 0118.6 21H7",
  gear: "M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.3l2-1.6-2-3.4-2.4 1a7.3 7.3 0 00-2.2-1.3L14.4 3h-4l-.4 2.6a7.3 7.3 0 00-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 000 2.6l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 002.2 1.3l.4 2.6h4l.4-2.6a7.3 7.3 0 002.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3z",
};

const STUDENT_NAV: NavItem[] = [
  { key: "dashboard", label: "nav_dashboard", href: "/", icon: I.home },
  { key: "careers", label: "nav_careers", href: "/careers", icon: I.compass },
  { key: "assessment", label: "nav_assessment", href: "/assessment", icon: I.clipboard, studentOnly: true },
  { key: "results", label: "nav_results", href: "/results", icon: I.star, studentOnly: true },
  { key: "ask", label: "nav_ask", href: "/ask", icon: I.chat },
  { key: "profile", label: "nav_profile", href: "/profile", icon: I.user },
];
const ADMIN_NAV: NavItem[] = [
  { key: "admin-kb", label: "nav_kb", href: "/admin/kb", icon: I.db },
  { key: "admin-careers", label: "nav_catalogue", href: "/admin/careers", icon: I.list },
  { key: "admin-feedback", label: "nav_feedback", href: "/admin/feedback", icon: I.thumb },
  { key: "admin-ask", label: "nav_ask", href: "/admin/ask", icon: I.chat },
  { key: "admin-settings", label: "nav_settings", href: "/admin/settings", icon: I.gear },
];

function activeKey(path: string) {
  if (path.startsWith("/admin/")) return "admin-" + path.split("/")[2];
  if (path === "/admin") return "admin-kb";
  if (path.startsWith("/assessment") || path.startsWith("/analyzing")) return "assessment";
  if (path.startsWith("/results")) return "results";
  if (path.startsWith("/careers")) return "careers";
  if (path.startsWith("/ask")) return "ask";
  if (path.startsWith("/profile")) return "profile";
  return "dashboard";
}

function useNav() {
  const { user } = useAuth();
  const path = usePathname();
  const isAdminArea = path.startsWith("/admin");
  const items = isAdminArea ? ADMIN_NAV : STUDENT_NAV.filter((n) => (!n.adminOnly || user?.role === "admin") && (!n.studentOnly || user?.role !== "admin"));
  return { items, active: activeKey(path), isAdminArea };
}

const Icon = ({ d }: { d: string }) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d={d} /></svg>
);

export function Shell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { items, active, isAdminArea } = useNav();
  return (
    <div className="flex min-h-screen">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6 fixed inset-y-0">
        <Link href="/" className="flex items-center gap-2 px-3 mb-8">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-brand-600 text-white font-bold">C</span>
          <span className="text-lg font-bold text-slate-900">CareerAI</span>
          {isAdminArea && <span className="ml-1 rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">Admin</span>}
        </Link>
        <nav className="flex flex-col gap-1">
          {items.map((n) => (
            <div key={n.key}>
              {n.group && <p className="px-3 pt-6 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t(n.group)}</p>}
              <Link href={n.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${active === n.key ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`}>
                <Icon d={n.icon} />{t(n.label)}
              </Link>
            </div>
          ))}
          {isAdminArea && <Link href="/" className="mt-6 px-3 py-2 text-sm font-medium text-slate-500 hover:text-brand-700">{t("nav_student_view")}</Link>}
        </nav>
        <div className="mt-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-500 leading-relaxed">{t("sidebar_note")}</div>
      </aside>
      <div className="flex-1 lg:ml-64 min-w-0">{children}</div>
    </div>
  );
}

function UserMenu() {
  const { user, ready, signOut } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const path = usePathname();
  if (!ready) return <span className="w-9 h-9" />;
  if (!user) {
    if (path === "/login" || path === "/register") return null;
    if (path === "/admin/login") return null;
    return <Link href={path.startsWith("/admin") ? `/admin/login?next=${encodeURIComponent(path)}` : `/login?next=${encodeURIComponent(path)}`} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">{t("login")}</Link>;
  }
  const initials = user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <details className="relative">
      <summary className="list-none cursor-pointer grid place-items-center w-9 h-9 rounded-full bg-brand-100 text-brand-700 text-sm font-semibold" title={user.email}>{initials}</summary>
      <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg text-sm">
        <p className="px-3 py-2 font-medium text-slate-900 truncate">{user.name}</p>
        <p className="px-3 pb-2 text-xs text-slate-500 truncate">{user.email}{user.role === "admin" ? " · admin" : ""}</p>
        <Link href={path.startsWith("/admin") ? "/admin/account" : "/profile"} className="block rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50">{t(path.startsWith("/admin") ? "prof_tab_account" : "nav_profile")}</Link>
        <button onClick={async () => { await signOut(); router.push("/"); }} className="w-full rounded-lg px-3 py-2 text-left text-rose-600 hover:bg-rose-50">{t("logout")}</button>
      </div>
    </details>
  );
}

export function Page({ heading, sub, crumbs, children }: { heading: string; sub?: string; crumbs?: { label: string; href?: string }[]; children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const { items, active } = useNav();
  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="flex items-center justify-between gap-4 px-4 sm:px-8 py-4">
          <div className="min-w-0">
            {crumbs && (
              <p className="text-xs text-slate-400 mb-0.5">
                {crumbs.map((c, i) => (
                  <span key={i}>{i > 0 && <span className="mx-1.5">›</span>}{c.href ? <Link href={c.href} className="hover:text-brand-700">{c.label}</Link> : <span className="text-slate-600">{c.label}</span>}</span>
                ))}
              </p>
            )}
            <h1 className="text-xl font-bold text-slate-900 truncate">{heading}</h1>
            {sub && <p className="text-sm text-slate-500 truncate">{sub}</p>}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden xl:inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 text-xs font-medium">{t("badge_version")}</span>
            <div className="flex rounded-full border border-slate-200 p-0.5 text-xs font-semibold">
              {(["en", "id"] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)} className={`rounded-full px-2.5 py-1 ${lang === l ? "bg-brand-600 text-white" : "text-slate-500 hover:text-slate-800"}`}>{l.toUpperCase()}</button>
              ))}
            </div>
            <UserMenu />
          </div>
        </div>
        <nav className="lg:hidden flex gap-1 overflow-x-auto px-4 pb-3 text-sm">
          {items.map((n) => (
            <Link key={n.key} href={n.href} className={`whitespace-nowrap rounded-lg px-3 py-1.5 ${active === n.key ? "bg-brand-50 text-brand-700" : "text-slate-600"}`}>{t(n.label)}</Link>
          ))}
        </nav>
      </header>
      <main className="px-4 sm:px-8 py-8 max-w-6xl">{children}</main>
    </>
  );
}

export function Loading({ error }: { error?: string }) {
  const { t } = useI18n();
  return error
    ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
    : <p className="text-sm text-slate-500">{t("loading")}</p>;
}
