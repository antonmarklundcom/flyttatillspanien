/**
 * Email OTP core. Six-digit codes, 10-minute expiry, a resend cooldown and an
 * attempt cap — stored in `otp_codes`, delivered by GHL through the CRM
 * boundary (src/lib/crm.ts). Sweden is email-first (unlike the inherited
 * WhatsApp-first assumption), so `destination` is an email address and
 * `channel` defaults to "email" — the column stays generic (SMS stays
 * possible for a later phone-verification flow) but nothing writes "sms"
 * yet. This module owns the rules; server actions only orchestrate (create →
 * send, verify → publish). Node runtime only (touches MySQL + node:crypto).
 */
import "server-only";
import { randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { otpCodes } from "@/db/schema";

const TTL_MS = 10 * 60 * 1000; // 10-minute code lifetime
const RESEND_COOLDOWN_MS = 60 * 1000; // one code per destination per minute
const MAX_ATTEMPTS = 5; // wrong guesses before a code is burned

/** Canonicalize an email address: trim, lowercase. */
function canonEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** When a code was issued — otp_codes has no created_at, so derive it. */
function issuedAt(expiresAt: Date): number {
  return expiresAt.getTime() - TTL_MS;
}

export type CreateOtpResult =
  | { ok: true; code: string; destination: string }
  | { ok: false; cooldownMs: number };

/**
 * Issue a fresh code for an email address, honoring the resend cooldown.
 * Returns the plaintext code for the caller to hand to crm.sendOtp() — it is
 * never exposed to the client. Older unconsumed codes for the address are
 * left to expire; verifyOtp only ever reads the newest, so they cannot be
 * reused.
 */
export async function createOtp(rawDestination: string): Promise<CreateOtpResult> {
  const destination = canonEmail(rawDestination);
  const now = Date.now();

  const [latest] = await db
    .select({ expiresAt: otpCodes.expiresAt })
    .from(otpCodes)
    .where(and(eq(otpCodes.destination, destination), isNull(otpCodes.consumedAt)))
    .orderBy(desc(otpCodes.expiresAt))
    .limit(1);

  if (latest) {
    const sinceIssued = now - issuedAt(latest.expiresAt);
    if (sinceIssued < RESEND_COOLDOWN_MS) {
      return { ok: false, cooldownMs: RESEND_COOLDOWN_MS - sinceIssued };
    }
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(otpCodes).values({
    destination,
    channel: "email",
    code,
    expiresAt: new Date(now + TTL_MS),
  });
  return { ok: true, code, destination };
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; reason: "expired" | "mismatch" | "too_many" };

/**
 * Verify a code against the newest unconsumed, unexpired code for the
 * destination. A correct code is consumed (single use); a wrong one
 * increments attempts and burns the code once MAX_ATTEMPTS is reached,
 * forcing a resend.
 */
export async function verifyOtp(
  rawDestination: string,
  input: string,
): Promise<VerifyOtpResult> {
  const destination = canonEmail(rawDestination);
  const code = input.replace(/\D/g, "");
  const now = new Date();

  const [row] = await db
    .select({
      id: otpCodes.id,
      code: otpCodes.code,
      attempts: otpCodes.attempts,
      expiresAt: otpCodes.expiresAt,
    })
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.destination, destination),
        isNull(otpCodes.consumedAt),
        gt(otpCodes.expiresAt, now),
      ),
    )
    .orderBy(desc(otpCodes.expiresAt))
    .limit(1);

  if (!row) return { ok: false, reason: "expired" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many" };

  if (row.code !== code) {
    const attempts = row.attempts + 1;
    await db
      .update(otpCodes)
      .set({
        attempts,
        // Burn the code on the final miss so it can't be brute-forced further.
        consumedAt: attempts >= MAX_ATTEMPTS ? now : undefined,
      })
      .where(eq(otpCodes.id, row.id));
    return { ok: false, reason: attempts >= MAX_ATTEMPTS ? "too_many" : "mismatch" };
  }

  await db
    .update(otpCodes)
    .set({ consumedAt: now })
    .where(eq(otpCodes.id, row.id));
  return { ok: true };
}
