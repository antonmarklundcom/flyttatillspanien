"use server";

/**
 * Auth server actions (login / logout). These run in the Node runtime and are
 * the trust boundary — the form only supplies credentials; lookup, password
 * verification and session issue all happen here.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/guards";
import { clientIpFrom } from "@/lib/client-ip";
import {
  clearLoginAttempts,
  isLoginLocked,
  recordLoginFailure,
} from "@/lib/auth/rate-limit";

/**
 * Only same-origin relative paths are honored as post-login targets.
 *
 * `//evil.com` is the obvious protocol-relative case; `/\evil.com` is the one
 * that used to get through (audit F35), because browsers normalise a backslash
 * to a forward slash in the authority position and follow it off-site. Control
 * characters are rejected for the same reason — a stripped newline or tab can
 * re-form into `//` after the check has already passed.
 */
function safeNext(next: string): string | null {
  if (!next.startsWith("/")) return null;
  if (/^\/[/\\]/.test(next)) return null;
  if (/[\u0000-\u001f\u007f]/.test(next)) return null;
  return next;
}

/**
 * A fixed, valid `scrypt$salt$hash` record verified against when no user
 * matches (audit F34). Its plaintext is unknown and irrelevant — it exists so
 * the failure path does the same scrypt work as the success path, instead of
 * answering in ~1ms and telling an attacker which addresses are real.
 */
const DUMMY_HASH = `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));
  const ip = clientIpFrom(await headers());

  const bounce = (error: "1" | "locked" = "1") =>
    redirect(`/login?error=${error}${next ? `&next=${encodeURIComponent(next)}` : ""}`);

  if (!email || !password) bounce();

  // Checked before touching the DB or scrypt: an attacker retrying the same
  // email doesn't get to burn a verify cycle once locked. Failures are
  // recorded identically below whether or not the account exists, so a
  // lockout response never discloses which emails are real.
  if (isLoginLocked(email, ip)) bounce("locked");

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !ok) {
    recordLoginFailure(email, ip);
    bounce();
  }

  clearLoginAttempts(email, ip);
  await createSession(user.id);
  redirect(
    next ??
      homeForRole({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }),
  );
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
