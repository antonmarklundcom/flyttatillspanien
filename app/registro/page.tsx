import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { svPanel } from "@/i18n/sv";
import { brandName } from "@/lib/brand-server";
import { getSessionUser } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/guards";
import { MIN_PASSWORD_LENGTH } from "@/lib/registration";
import { getUsableInvite } from "@/lib/agency-invites";
import { registerAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: svPanel.registerTitle,
    description: `Annonsera dina bostäder på ${brand}. Gratis konton för mäklarbyråer och fristående mäklare.`,
    // Renders per ?invite= token — keep every variant out of the index (F40).
    robots: { index: false, follow: true },
  };
}

// Session state is per-request; never statically cache the sign-up page.
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  name: svPanel.registerErrorName,
  email: svPanel.registerErrorEmail,
  email_taken: svPanel.registerErrorEmailTaken,
  password: svPanel.registerErrorPassword,
  agency_name: svPanel.registerErrorAgencyName,
  invite: svPanel.registerErrorInvite,
  generic: svPanel.registerErrorGeneric,
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; kind?: string; invite?: string }>;
}) {
  const { error, kind, invite } = await searchParams;

  // Already signed in → straight to the right home, unless they arrived with an
  // invitation: an existing account should be able to *join* that agency rather
  // than be told to create a second login (see /agencia/invite/[token]).
  const user = await getSessionUser();
  if (user) {
    if (invite) redirect(`/agencia/invite/${encodeURIComponent(invite)}`);
    redirect(homeForRole(user));
  }

  // Resolve the invitation before rendering, so the visitor sees *which*
  // inmobiliaria they are joining before they type anything — and so a guessed
  // or expired token simply falls back to the ordinary sign-up form.
  const invitation = invite ? await getUsableInvite(invite) : null;
  const inviteFailed = Boolean(invite) && invitation == null;

  // Keep the chosen account type across a failed submit, so an agency that
  // mistyped its email doesn't come back as an independent agent.
  const isInvite = invitation != null && kind !== "agency" && kind !== "independent";
  const isAgency = !isInvite && kind !== "independent";

  return (
    <main className="site-main">
      <div className="auth-wrap">
        <div className="auth-card">
          <h1 className="auth-card__title">{svPanel.registerTitle}</h1>
          <p className="auth-card__subtitle">{svPanel.registerSubtitle}</p>

          {error ? (
            <p className="auth-error">{ERRORS[error] ?? ERRORS.generic}</p>
          ) : null}

          {inviteFailed ? (
            <p className="auth-error">{svPanel.registerErrorInvite}</p>
          ) : null}

          {invitation ? (
            <p className="auth-note">
              {svPanel.registerInviteNote(
                invitation.agencyName,
                invitation.role === "agency_admin"
                  ? svPanel.teamRoleAdmin
                  : svPanel.teamRoleAgent,
              )}
            </p>
          ) : null}

          <form action={registerAction}>
            {/* The token carries the agency and the role. The form asks for
                neither — same rule as the missing `role` field. */}
            {invitation ? (
              <input type="hidden" name="invite" value={invitation.token} />
            ) : null}

            <fieldset className="auth-choice">
              <legend className="auth-field__label">
                {svPanel.registerKindLabel}
              </legend>
              {invitation ? (
                <label className="auth-choice__option">
                  <input
                    type="radio"
                    name="kind"
                    value="invite"
                    defaultChecked={isInvite}
                  />
                  <span>{svPanel.registerKindInvite(invitation.agencyName)}</span>
                </label>
              ) : null}
              <label className="auth-choice__option">
                <input
                  type="radio"
                  name="kind"
                  value="agency"
                  defaultChecked={isAgency}
                />
                <span>{svPanel.registerKindAgency}</span>
              </label>
              <label className="auth-choice__option">
                <input
                  type="radio"
                  name="kind"
                  value="independent"
                  defaultChecked={!isAgency && !isInvite}
                />
                <span>{svPanel.registerKindIndependent}</span>
              </label>
            </fieldset>

            {/* Always present: an independent agent simply leaves it empty, and
                the server ignores it for that account type. */}
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="agencyName">
                {svPanel.registerAgencyNameLabel}
              </label>
              <input
                className="auth-field__input"
                id="agencyName"
                name="agencyName"
                type="text"
                maxLength={160}
                autoComplete="organization"
              />
            </div>

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="name">
                {svPanel.registerYourNameLabel}
              </label>
              <input
                className="auth-field__input"
                id="name"
                name="name"
                type="text"
                maxLength={140}
                autoComplete="name"
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="email">
                {svPanel.emailLabel}
              </label>
              <input
                className="auth-field__input"
                id="email"
                name="email"
                type="email"
                maxLength={190}
                autoComplete="email"
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="whatsapp">
                {svPanel.registerPhoneLabel}
              </label>
              <input
                className="auth-field__input"
                id="whatsapp"
                name="phone"
                type="tel"
                inputMode="tel"
                placeholder="070 123 45 67"
                maxLength={30}
                autoComplete="tel"
              />
            </div>

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="password">
                {svPanel.registerPasswordLabel}
              </label>
              <input
                className="auth-field__input"
                id="password"
                name="password"
                type="password"
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                required
              />
              <p className="auth-field__hint">{svPanel.registerPasswordHint}</p>
            </div>

            <button className="auth-submit" type="submit">
              {svPanel.registerSubmit}
            </button>
          </form>

          <p className="auth-note">{svPanel.registerPendingNote}</p>
          <p className="auth-alt">
            <Link href="/login">{svPanel.registerToLogin}</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
