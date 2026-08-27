import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { svPanel } from "@/i18n/sv";
import { brandName } from "@/lib/brand-server";
import { getSessionUser } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/guards";
import { loginAction } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: `Logga in`,
  robots: { index: false, follow: false },
};

// Session state is per-request; never statically cache the login page.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  // Already signed in → straight to the right home.
  const user = await getSessionUser();
  if (user) redirect(homeForRole(user));

  return (
    <main className="site-main">
      <div className="auth-wrap">
        <div className="auth-card">
          <h1 className="auth-card__title">{svPanel.loginTitle}</h1>
          <p className="auth-card__subtitle">{svPanel.loginSubtitle}</p>

          {error === "locked" ? (
            <p className="auth-error">{svPanel.loginLocked}</p>
          ) : error ? (
            <p className="auth-error">{svPanel.loginError}</p>
          ) : null}

          <form action={loginAction}>
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="email">
                {svPanel.emailLabel}
              </label>
              <input
                className="auth-field__input"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </div>
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="password">
                {svPanel.passwordLabel}
              </label>
              <input
                className="auth-field__input"
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <button className="auth-submit" type="submit">
              {svPanel.loginSubmit}
            </button>
          </form>

          <p className="auth-alt">
            <Link href="/registro">{svPanel.loginToRegister}</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
