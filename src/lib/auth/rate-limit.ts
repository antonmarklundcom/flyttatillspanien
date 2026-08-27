/**
 * In-memory login throttle. loginAction() had nothing between a wrong
 * password and the next attempt — scrypt's cost factor slows a single guess
 * but nothing capped how many guesses an attacker got against one account.
 *
 * Per-process Map, not a DB table: this app runs as a single Node process on
 * shared hosting (no horizontal scaling to split state across), so it's a
 * real defense without a schema migration. It resets on deploy/restart,
 * which is an acceptable trade for a pre-launch site — revisit if the app
 * ever runs multiple instances.
 *
 * **Three counters, not one** (audit F26). Keying only on the email made the
 * lockout itself the attack: anyone who knew the founder's address — the sole
 * admin — could keep it locked out permanently with five wrong guesses every
 * fifteen minutes, while spraying one guess each across a thousand addresses
 * went entirely unthrottled. So:
 *
 *   `${email}|${ip}`  5 / 15 min — the real brute-force bound. Locking the
 *                     *pair* means the owner can still sign in from their own
 *                     connection while an attacker's is shut out.
 *   `ip|${ip}`       20 / 15 min — the spray bound: one source, many accounts.
 *   `email|${email}` 50 / 60 min — the distributed backstop. Deliberately far
 *                     above anything a person does by hand, so reaching it
 *                     means a botnet is on one account and a lockout is the
 *                     lesser harm.
 *
 * An already-locked key is never counted again, so retrying during a lockout
 * cannot extend it (audit F26) — the window is fifteen minutes from the fifth
 * failure, not from the last one.
 */
import "server-only";

interface Rule {
  max: number;
  windowMs: number;
  lockoutMs: number;
}

const PAIR: Rule = { max: 5, windowMs: 15 * 60_000, lockoutMs: 15 * 60_000 };
const PER_IP: Rule = { max: 20, windowMs: 15 * 60_000, lockoutMs: 15 * 60_000 };
const PER_EMAIL: Rule = { max: 50, windowMs: 60 * 60_000, lockoutMs: 30 * 60_000 };

interface Entry {
  count: number;
  windowStart: number;
  lockedUntil: number | null;
}

const attempts = new Map<string, Entry>();
const LONGEST_WINDOW = Math.max(PAIR.windowMs, PER_IP.windowMs, PER_EMAIL.windowMs);

// The map is unbounded otherwise: every distinct email ever tried (including
// ones that don't exist) leaves an entry forever. Sweep opportunistically.
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < PAIR.windowMs) return;
  lastSweep = now;
  for (const [key, e] of attempts) {
    const stale =
      (e.lockedUntil ?? 0) < now && now - e.windowStart > LONGEST_WINDOW;
    if (stale) attempts.delete(key);
  }
}

/** The IP is normalised to a string once, here, so "unknown" is a single key. */
function keysFor(email: string, ip: string): [string, Rule][] {
  const addr = ip || "unknown";
  return [
    [`pair|${email}|${addr}`, PAIR],
    [`ip|${addr}`, PER_IP],
    [`email|${email}`, PER_EMAIL],
  ];
}

/** Checked before verifying a password. True if any counter is locked out. */
export function isLoginLocked(email: string, ip: string): boolean {
  const now = Date.now();
  sweep(now);
  return keysFor(email, ip).some(([key]) => {
    const e = attempts.get(key);
    return e?.lockedUntil != null && e.lockedUntil > now;
  });
}

/** Call after a failed password check. */
export function recordLoginFailure(email: string, ip: string): void {
  const now = Date.now();
  for (const [key, rule] of keysFor(email, ip)) {
    const e = attempts.get(key);
    if (!e || now - e.windowStart > rule.windowMs) {
      attempts.set(key, { count: 1, windowStart: now, lockedUntil: null });
      continue;
    }
    // Already locked: don't count, don't push the expiry out. A lockout that
    // renews on every retry is an indefinite lockout.
    if (e.lockedUntil != null && e.lockedUntil > now) continue;
    e.count += 1;
    if (e.count >= rule.max) e.lockedUntil = now + rule.lockoutMs;
  }
}

/**
 * Call after a successful login — a legitimate owner shouldn't stay throttled.
 * Only the keys that person's own attempt built are cleared; the per-email
 * backstop is left alone, so a successful login somewhere else on the internet
 * cannot reset the counter a distributed attack is filling.
 */
export function clearLoginAttempts(email: string, ip: string): void {
  const addr = ip || "unknown";
  attempts.delete(`pair|${email}|${addr}`);
  attempts.delete(`ip|${addr}`);
}
