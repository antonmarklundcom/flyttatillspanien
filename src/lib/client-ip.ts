/**
 * The requesting client's IP, as far as it can be trusted.
 *
 * Hostinger terminates TLS in front of the Node process, so the socket address
 * is always the proxy and `x-forwarded-for` is the only thing that carries the
 * visitor. That header is client-settable in principle — anyone can send
 * `x-forwarded-for: 1.2.3.4` — but the proxy *appends* to it, so the LAST
 * entry is the one the proxy observed and the only one an attacker cannot
 * choose. Reading the first entry (the common mistake) would let an attacker
 * rotate a fake IP per request and walk straight through anything keyed on it.
 *
 * Used for rate-limit keys only (audit F26, F28) — never for authorisation.
 */

const MAX_LEN = 64;

export function clientIpFrom(h: { get(name: string): string | null }): string {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    const last = hops[hops.length - 1];
    if (last) return last.slice(0, MAX_LEN);
  }
  const real = h.get("x-real-ip")?.trim();
  if (real) return real.slice(0, MAX_LEN);
  return "unknown";
}
