"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api, errCode } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Key, useI18n } from "@/lib/i18n";

const nextPath = () => {
  const n = new URLSearchParams(window.location.search).get("next") || "/";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";       // only same-site redirects
};
const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300";

export function AuthForm({ mode, adminOnly = false }: { mode: "login" | "register"; adminOnly?: boolean }) {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", password: "", status: "student", cohort: "", consent: false });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === "register") {
      if (f.name.trim().length < 2) return setErr(t("err_name"));
      if (f.password.length < 8) return setErr(t("err_password"));
      if (!f.consent) return setErr(t("err_consent_required"));
    }
    setBusy(true); setErr("");
    try {
      const r = mode === "login"
        ? await api.login(f.email, f.password)
        : await api.register({ name: f.name, email: f.email, password: f.password, status: f.status, cohort: f.cohort || null, consent: f.consent });
      const next = nextPath();
      if (adminOnly && r.user.role !== "admin") { setErr(t("err_not_admin")); setBusy(false); return; }
      signIn(r.token, r.user);              // stored in the admin or the student session, by role
      if (r.user.role === "admin") { router.replace(next.startsWith("/admin") && next !== "/admin/login" ? next : "/admin/kb"); return; }
      // a new account (or one without a profile) fills the profile once, then continues
      router.replace(r.user.profile_complete ? next : `/profile?welcome=1&next=${encodeURIComponent(next === "/" ? "/assessment" : next)}`);
    } catch (e2) {
      const code = errCode(e2);
      setErr(code ? t(`err_${code}` as Key) || code : t("api_error"));
      setBusy(false);
    }
  }

  const other = mode === "login" ? "/register" : "/login";
  return (
    <div className="max-w-md mx-auto rounded-2xl bg-white border border-slate-200 p-8">
      <h2 className="text-xl font-bold text-slate-900">{adminOnly ? t("admin_login_t") : mode === "login" ? t("login_t") : t("register_t")}</h2>
      <p className="mt-1 text-sm text-slate-500">{adminOnly ? t("admin_login_d") : mode === "login" ? t("login_d") : t("register_d")}</p>
      {err && <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}
      <form onSubmit={submit} className="mt-6 space-y-4 text-sm">
        {mode === "register" && (
          <label className="block font-medium text-slate-700">{t("name")}<input value={f.name} onChange={(e) => set("name", e.target.value)} required className={input} autoComplete="name" /></label>
        )}
        <label className="block font-medium text-slate-700">{t("email")}<input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} required className={input} autoComplete="email" /></label>
        <label className="block font-medium text-slate-700">{t("password")}
          <input type="password" value={f.password} onChange={(e) => set("password", e.target.value)} required minLength={mode === "register" ? 8 : undefined} className={input} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          {mode === "register" && <span className="mt-1 block text-xs font-normal text-slate-400">{t("pw_hint")}</span>}
        </label>
        {mode === "register" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="block font-medium text-slate-700">{t("status")}
                <select value={f.status} onChange={(e) => set("status", e.target.value)} className={input}>
                  <option value="student">{t("status_student")}</option><option value="graduate">{t("status_graduate")}</option>
                </select>
              </label>
              <label className="block font-medium text-slate-700">{t("cohort")} <span className="font-normal text-slate-400">{t("optional")}</span>
                <input value={f.cohort} onChange={(e) => set("cohort", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2022" className={input} inputMode="numeric" />
              </label>
            </div>
            <label className="flex gap-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              <input type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} className="mt-0.5 w-4 h-4 shrink-0 accent-brand-600" />
              <span><b className="block text-slate-800">{t("consent_t")}</b>{t("consent")}</span>
            </label>
          </>
        )}
        <button disabled={busy} className="w-full rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {mode === "login" ? t("login") : t("register")}
        </button>
      </form>
      {!adminOnly && (
      <p className="mt-6 text-center text-sm text-slate-500">
        {mode === "login" ? t("no_account") : t("have_account")}{" "}
        <Link href={other} onClick={(e) => { e.preventDefault(); router.push(other + window.location.search); }} className="font-semibold text-brand-600 hover:underline">
          {mode === "login" ? t("register") : t("login")}
        </Link>
      </p>
      )}
    </div>
  );
}
