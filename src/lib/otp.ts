/**
 * WhatsApp OTP core (ARCHITECTURE.md §2.7). Six-digit codes, 10-minute
 * expiry, a resend cooldown and an attempt cap — stored in `otp_codes`,
 * delivered by GHL through the CRM boundary (src/lib/crm.ts). This module
 * owns the rules; server actions only orchestrate (create → send, verify →
 * publish). Node runtime only (touches MySQL + node:crypto).
 */
import "server-only";
import { randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { otpCodes } from "@/db/schema";
import { canonPhone } from "@/lib/import/normalize";

const TTL_MS = 10 * 60 * 1000; // 10-minute code lifetime
const RESEND_COOLDOWN_MS = 60 * 1000; // one code per number per minute
const MAX_ATTEMPTS = 5; // wrong guesses before a code is burned

/** When a code was issued — otp_codes has no created_at, so derive it. */
function issuedAt(expiresAt: Date): number {
  return expiresAt.getTime() - TTL_MS;
}

export type CreateOtpResult =
  | { ok: true; code: string; whatsapp: string }
  | { ok: false; cooldownMs: number };

/**
 * Issue a fresh code for a number, honoring the resend cooldown. Returns the
 * plaintext code for the caller to hand to crm.sendOtp() — it is never
 * exposed to the client. Older unconsumed codes for the number are left to
 * expire; verifyOtp only ever reads the newest, so they cannot be reused.
 */
export async function createOtp(rawWhatsapp: string): Promise<CreateOtpResult> {
  const whatsapp = canonPhone(rawWhatsapp);
  const now = Date.now();

  const [latest] = await db
    .select({ expiresAt: otpCodes.expiresAt })
    .from(otpCodes)
    .where(and(eq(otpCodes.whatsapp, whatsapp), isNull(otpCodes.consumedAt)))
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
    whatsapp,
    code,
    expiresAt: new Date(now + TTL_MS),
  });
  return { ok: true, code, whatsapp };
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; reason: "expired" | "mismatch" | "too_many" };

/**
 * Verify a code against the newest unconsumed, unexpired code for the number.
 * A correct code is consumed (single use); a wrong one increments attempts and
 * burns the code once MAX_ATTEMPTS is reached, forcing a resend.
 */
export async function verifyOtp(
  rawWhatsapp: string,
  input: string,
): Promise<VerifyOtpResult> {
  const whatsapp = canonPhone(rawWhatsapp);
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
        eq(otpCodes.whatsapp, whatsapp),
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
