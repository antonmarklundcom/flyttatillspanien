/**
 * The ONE way a request's host is read (audit F31). middleware.ts used to
 * read `host` while origin.ts preferred `x-forwarded-host` (and only it
 * split proxy comma-lists) — when the two disagreed behind Hostinger's
 * proxy, the page rendered one brand while emitting the other's canonical.
 *
 * Pure and edge-safe: callable from middleware (web Headers) and from
 * next/headers' ReadonlyHeaders alike.
 */

/** Lowercased, www-stripped first host of the chain, with port kept. */
export function rawHostFrom(h: {
  get(name: string): string | null;
}): string | null {
  const raw = (h.get("x-forwarded-host") ?? h.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  return raw || null;
}

/** Port-free form — the shape VERTICALS is keyed by. */
export function bareHostFrom(h: {
  get(name: string): string | null;
}): string | null {
  return rawHostFrom(h)?.split(":")[0] ?? null;
}
