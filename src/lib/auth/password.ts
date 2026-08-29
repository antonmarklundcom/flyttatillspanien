/**
 * Password hashing (ARCHITECTURE.md §1).
 *
 * Email+password is one of two ways in and both end at the same address: the
 * emailed one-time code (src/lib/otp.ts) verifies the inbox that
 * `users.email` names, and `password_hash` is NULL on an account that only
 * ever uses codes. Neither is a fallback for the other.
 *
 * No bcrypt/argon dependency — Node's built-in scrypt keeps the dependency
 * list lean (the repo avoids libraries it can do without) and is a sound KDF.
 * Stored form: `scrypt$<saltHex>$<hashHex>`.
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/** Constant-time verify. Returns false for any malformed/legacy stored value. */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const derived = (await scryptAsync(
    password,
    Buffer.from(saltHex, "hex"),
    expected.length,
  )) as Buffer;
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
