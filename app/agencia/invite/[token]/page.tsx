import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { esPanel } from "@/i18n/es";
import { getSessionUser } from "@/lib/auth/session";
import { getUsableInvite } from "@/lib/agency-invites";
import { joinPreflight } from "@/lib/team-queries";
import { acceptInviteAction } from "./actions";

export const metadata: Metadata = {
  title: `Invitación`,
  robots: { index: false, follow: false },
};

// The invitation state is per-request and per-account; never cache it.
export const dynamic = "force-dynamic";

/** Why an otherwise valid link can't be accepted by *this* account. */
const BLOCKED: Record<string, string> = {
  invalid: esPanel.inviteInvalid,
  already_in_agency: esPanel.inviteAlreadyInAgency,
  protected: esPanel.inviteNotForAdmin,
  no_profile: esPanel.inviteNoProfile,
};

/**
 * Accepting an invitation as an existing user (the counterpart to
 * /registro?invite=…, which creates a new account from the same token).
 *
 * A logged-out visitor is sent to the sign-up form with the token intact, so
 * one link works for both "I'm new here" and "I already have a login".
 */
export default async function AgencyInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const [{ token }, { msg }] = await Promise.all([params, searchParams]);

  const user = await getSessionUser();
  if (!user) redirect(`/registro?invite=${encodeURIComponent(token)}`);

  const invite = await getUsableInvite(token);
  // Whether *this* account may accept — checked here for the message and again
  // in the action, which is the authority.
  const preflight = invite ? await joinPreflight(user.id) : "invalid";
  const blocked = invite == null ? "invalid" : preflight !== "ok" ? preflight : null;
  const flash = msg ? (BLOCKED[msg] ?? esPanel.inviteInvalid) : null;

  return (
    <main className="site-main">
      <div className="auth-wrap">
        <div className="auth-card">
          <h1 className="auth-card__title">{esPanel.inviteTitle}</h1>

          {flash ? <p className="auth-error">{flash}</p> : null}

          {invite == null || blocked ? (
            <>
              <p className="auth-card__subtitle">
                {BLOCKED[blocked ?? "invalid"] ?? esPanel.inviteInvalid}
              </p>
              <p className="auth-alt">
                <Link href="/agencia">{esPanel.inviteBackToPanel}</Link>
              </p>
            </>
          ) : (
            <>
              <p className="auth-card__subtitle">
                {esPanel.inviteJoinBody(
                  invite.agencyName,
                  invite.role === "agency_admin"
                    ? esPanel.teamRoleAdmin
                    : esPanel.teamRoleAgent,
                )}
              </p>
              <p className="auth-note">{esPanel.inviteJoinNote}</p>

              <form action={acceptInviteAction}>
                <input type="hidden" name="token" value={invite.token} />
                <button className="auth-submit" type="submit">
                  {esPanel.inviteJoinSubmit(invite.agencyName)}
                </button>
              </form>

              <p className="auth-alt">
                <Link href="/agencia">{esPanel.inviteBackToPanel}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
