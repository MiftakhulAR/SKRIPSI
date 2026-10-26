"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api, Area, areaOf, tokenStore, User } from "./api";
import { useI18n } from "./i18n";

type Ctx = {
  user: User | null; ready: boolean; area: Area;
  signIn: (token: string, user: User) => void; signOut: () => Promise<void>; setUser: (u: User) => void;
};
const Auth = createContext<Ctx>(null as unknown as Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const area = areaOf(usePathname());
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // (re)load the account of the area we are in: student web or admin web
    setReady(false); setUser(null);
    const token = tokenStore.get(area);
    if (!token) { setReady(true); return; }
    api.me().then((u) => {
      if (area === "student" && u.role === "admin") {    // old single-session login: move it to the admin web
        tokenStore.set(null, "student"); tokenStore.set(token, "admin"); setUser(null);
      } else if (area === "admin" && u.role !== "admin") {
        tokenStore.set(null, "admin"); setUser(null);
      } else setUser(u);
    }).catch(() => tokenStore.set(null, area)).finally(() => setReady(true));
  }, [area]);
  const signIn = (token: string, u: User) => {
    const target: Area = u.role === "admin" ? "admin" : "student";
    tokenStore.set(token, target);
    if (target === area) setUser(u);
  };
  const signOut = async () => { try { await api.logout(); } catch {} tokenStore.set(null, area); setUser(null); };
  return <Auth.Provider value={{ user, ready, area, signIn, signOut, setUser }}>{children}</Auth.Provider>;
}
export const useAuth = () => useContext(Auth);

/** Wrap pages that need an account. Visitors see a short prompt with log in / register buttons. */
export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, ready } = useAuth();
  const { t } = useI18n();
  const path = usePathname();
  if (!ready) return <p className="text-sm text-slate-500">{t("loading")}</p>;
  if (!user) {
    const next = encodeURIComponent(path);
    const loginHref = path.startsWith("/admin") ? `/admin/login?next=${next}` : `/login?next=${next}`;
    return (
      <div className="max-w-lg mx-auto rounded-2xl bg-white border border-slate-200 p-8 text-center">
        <span className="mx-auto grid place-items-center w-12 h-12 rounded-full bg-brand-50 text-brand-700">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0110 0v3M5 11h14v10H5z" /></svg>
        </span>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">{t("login_needed_t")}</h2>
        <p className="mt-2 text-sm text-slate-500">{t("login_needed_d")}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href={loginHref} className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">{t("login")}</Link>
          {!path.startsWith("/admin") && <Link href={`/register?next=${next}`} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">{t("register")}</Link>}
        </div>
      </div>
    );
  }
  if (admin && user.role !== "admin")
    return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{t("admin_only")}</div>;
  return <>{children}</>;
}

/** Used in route layouts: the page itself mounts (and loads data) only after login. */
export function Protected({ children, admin = false, heading }: { children: ReactNode; admin?: boolean; heading: ReactNode }) {
  const { user, ready } = useAuth();
  if (ready && user && (!admin || user.role === "admin")) return <>{children}</>;
  return <>{heading}</>;
}
