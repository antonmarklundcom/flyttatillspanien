"use server";

/**
 * Sign-up action. The form supplies claims; everything that decides what the
 * account *is* — role, verification state, the agency link — is decided here
 * and in lib/registration.ts. A hidden field asking for `role` would be the
 * obvious hole, so no such field exists.
 *
 * On success the new user is logged straight in: making someone sign up and
 * then hunt for the login form is friction with no security value.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, getSessionUser } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/guards";
import { clientIpFrom } from "@/lib/client-ip";
import { allowRequest } from "@/lib/rate-limit";
import {
  registerAccount,
  type AccountKind,
  type RegistrationError,
} from "@/lib/registration";

/**
 * Sign-up is the only unauthenticated write in the app that costs real CPU:
 * `registerAccount` hashes the password with Node scrypt (see
 * lib/auth/password.ts) before it ever reaches the database, so a script
 * looping on this action spends the shared Hostinger Node process rather than
 * its own. The cap has to sit in front of the hash, not behind it.
 *
 * Five per IP per ten minutes: an agency registering its whole team from one
 * office connection is the widest honest burst there is, and it stays well
 * inside that. Same fixed-window helper as /api/leads, so there is one
 * throttling mechanism in the codebase; per process, per rate-limit.ts.
 */
const REGISTER_MAX = 5;
const REGISTER_WINDOW_MS = 10 * 60_000;

function bounce(
  error: RegistrationError | "generic" | "throttled",
  kind: string,
  invite: string,
): never {
  const q = new URLSearchParams({ error, kind });
  // Keep the invitation across a failed submit, or the second attempt would
  // quietly create an unaffiliated account instead of joining the agency.
  if (invite) q.set("invite", invite);
  redirect(`/registro?${q.toString()}`);
}

export async function registerAction(formData: FormData): Promise<void> {
  // An already-signed-in visitor has no business creating a second account
  // from a stale tab.
  const current = await getSessionUser();
  if (current) redirect(homeForRole(current));

  const rawKind = String(formData.get("kind") ?? "");
  const invite = String(formData.get("invite") ?? "").trim();
  // "invite" only counts with a token to back it; registerAccount re-validates
  // that token and refuses the sign-up if it is spent, expired or forged.
  const kind: AccountKind =
    rawKind === "invite" && invite
      ? "invite"
      : rawKind === "agency"
        ? "agency"
        : "independent";

  // Before any hashing or insert: a refused attempt must cost nothing beyond
  // this Map lookup. `clientIpFrom` reads the proxy's own last hop, so the key
  // cannot be rotated by a spoofed x-forwarded-for header.
  const ip = clientIpFrom(await headers());
  if (!allowRequest(`register|${ip}`, REGISTER_MAX, REGISTER_WINDOW_MS)) {
    bounce("throttled", kind, invite);
  }

  const result = await registerAccount({
    kind,
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    phone: String(formData.get("phone") ?? "") || null,
    agencyName: String(formData.get("agencyName") ?? "") || null,
    inviteToken: invite || null,
  });

  if (!result.ok) bounce(result.error, kind, invite);

  await createSession(result.userId);
  redirect("/agencia?msg=welcome");
}
