import { CANONICAL_HOST, VERTICALS, resolveVertical } from "@/config/verticals";

/**
 * Brand naming, client-safe half. **The domain is the brand** — there is no
 * separate wordmark, so the name is per-host config in `verticals.ts` rather
 * than one global string.
 *
 * This module must never import `next/headers`, directly or transitively:
 * `src/i18n/sv.ts` imports it, and six client components import that. The
 * request-scoped resolver therefore lives in `brand-server.ts`.
 *
 * Two ways in, and picking the wrong one is the mistake to avoid:
 *
 * - `brandName()` from `@/lib/brand-server` — async, request-scoped, correct
 *   on every public page. Use it anywhere a visitor sees the result.
 * - `BRAND_NAME` below — the CANONICAL_HOST's brand, resolved once at module
 *   load. Only correct where the host cannot vary or does not matter: /admin
 *   and /agencia (staff surfaces reached on one host), client components, and
 *   scripts. On a public page it pins that page to one domain's name no
 *   matter which domain the visitor actually typed.
 */

/**
 * Static fallback: the brand of CANONICAL_HOST. Not a neutral default — it is
 * one specific domain's name, which is exactly why it must not leak onto a
 * page another domain also serves.
 */
export const BRAND_NAME: string =
  (VERTICALS[CANONICAL_HOST] ?? resolveVertical(null)).brand;

/**
 * The small uppercase line under the wordmark in the header lockup (the
 * design system's two-line brand mark). Deliberately not a name — it stays
 * true on every door, which is the point now that the wordmark itself varies.
 */
export const BRAND_KICKER = "Spanien";

/** Homepage/OG tagline. Follows the vertical's language, not its wordmark. */
export function brandTaglineFor(locale: "sv"): string {
  void locale; // single served locale today; widens when English is added
  return "Hitta din bostad i Spanien";
}
