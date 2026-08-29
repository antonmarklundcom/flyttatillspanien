/**
 * Opaque cookie sessions (ARCHITECTURE.md §1). A random token lives in an
 * httpOnly cookie; the database stores only sha256(token) as the row id, so a
 * DB leak can't be replayed as a cookie and every read is a primary-key hit.
 *
 * Session validation touches MySQL, so it only runs in the Node runtime
 * (server components / server actions / route handlers) — never in Edge
 * middleware. Guards in ./guards.ts build on this.
 */
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import type { UserRole } from "./roles";

const COOKIE_NAME = "ftse_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionUser {
  id: number;
  name: string | null;
  /**
   * NOT NULL since the email-first flip (§3.7): it is the account identity,
   * the login, and where a one-time code is sent. Callers may rely on it
   * being present rather than guarding every use.
   */
  email: string;
  role: UserRole;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Issue a session for a user and set the cookie. Call after a verified login. */
export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
  });
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Clear the current session (logout): delete the row and drop the cookie. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }
  jar.delete(COOKIE_NAME);
}

/**
 * Resolve the logged-in user from the session cookie, or null. Expired rows are
 * treated as no session (and swept). One indexed join, safe to call per request.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const sessionId = hashToken(token);
  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

/** Best-effort cleanup of expired sessions — safe to call from a cron later. */
export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export { COOKIE_NAME };
