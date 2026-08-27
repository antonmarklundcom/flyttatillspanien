/**
 * A plain fixed-window counter for public endpoints.
 *
 * Separate from `lib/auth/rate-limit.ts` on purpose: that one has lockout
 * semantics (a failure streak locks a key for a while, and a success clears
 * it), which is the right shape for a login and the wrong shape for a lead
 * form, where every request counts and there is no "success" to forgive.
 *
 * Same trade as the auth limiter: per-process Map, no schema, resets on
 * deploy. One Node process on shared hosting, so per-process is per-app.
 */
import "server-only";

interface Window {
  count: number;
  start: number;
}

const buckets = new Map<string, Window>();

let lastSweep = Date.now();
function sweep(now: number, windowMs: number) {
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [key, w] of buckets) {
    if (now - w.start > windowMs) buckets.delete(key);
  }
}

/**
 * Count one hit against `key`. Returns false once the window is full — the
 * caller decides what that means (a 429 here, a silent drop elsewhere).
 */
export function allowRequest(
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  sweep(now, windowMs);
  const w = buckets.get(key);
  if (!w || now - w.start > windowMs) {
    buckets.set(key, { count: 1, start: now });
    return true;
  }
  w.count += 1;
  return w.count <= max;
}
