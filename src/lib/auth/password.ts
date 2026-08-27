/**
 * Password hashing (ARCHITECTURE.md §1). Email+password is the first auth pass;
 * WhatsApp OTP via GHL comes later. No bcrypt/argon dependency — Node's built-in
 * scrypt keeps the dependency list lean (the repo avoids libraries it can do
 * without) and is a sound KDF. Stored form: `scrypt$<saltHex>$<hashHex>`.
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
