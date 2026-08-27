import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { esPanel } from "@/i18n/es";
import { brandName } from "@/lib/brand-server";
import { getSessionUser } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/guards";
import { loginAction } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: `Ingresar`,
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
          <h1 className="auth-card__title">{esPanel.loginTitle}</h1>
          <p className="auth-card__subtitle">{esPanel.loginSubtitle}</p>

          {error === "locked" ? (
            <p className="auth-error">{esPanel.loginLocked}</p>
          ) : error ? (
            <p className="auth-error">{esPanel.loginError}</p>
          ) : null}

          <form action={loginAction}>
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="email">
                {esPanel.emailLabel}
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
                {esPanel.passwordLabel}
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
              {esPanel.loginSubmit}
            </button>
          </form>

          <p className="auth-alt">
            <Link href="/registro">{esPanel.loginToRegister}</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
