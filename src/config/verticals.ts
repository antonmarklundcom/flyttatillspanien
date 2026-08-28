/**
 * Domain routing layer — how one engine serves every door.
 *
 * Lives in code, not the database: it changes at deploy cadence and wants type
 * safety. **Exactly one entry today**, and that is a decision, not a stub.
 *
 * The thing that looks like a second door here is the SUPPLY side, not a
 * second audience: a Spanish agency in Marbella and a Swedish buyer in Uppsala
 * are two roles against the same database, and roles are already served by the
 * panel surfaces (`/agencia`, `/publicar`, `/admin`), which are single-host by
 * design. A `.es` door would mean a second dictionary moving key-for-key with
 * `sv.ts` forever, a listing set duplicated across two hosts (so one of them
 * canonicalises its detail pages away and launches as a non-indexing shell),
 * and a Spanish-language Spanish-property portal fighting Idealista on its own
 * turf. The one real benefit — a Spanish-language "list with us" pitch — is a
 * one-page problem, solved by `/for-maklare` and a future `/es/inmobiliarias`.
 *
 * The second door worth pre-planning is ENGLISH — Norwegian, Danish, Finnish
 * and Dutch buyers of Spanish property read English, and that is a genuine
 * second audience for the same inventory. It is NOT written here until the
 * domain is bought: an unowned domain in the code gets read as a fact and
 * fallback chains get built on it. `resolveVertical`, `hostOwnsListingDetail()`
 * and `languageAlternates()` stay exactly as they are — with one door they are
 * trivially satisfied, and they are what makes adding the second one a
 * mechanical change rather than an SEO incident.
 */

export type VerticalKey = "sv";

export interface VerticalConfig {
  key: VerticalKey;
  /** Widen to `"sv" | "en"` when the English door is bought. */
  locale: "sv";
  /**
   * The public brand name for this door. The domain IS the brand — there is no
   * separate wordmark to keep in sync, so every user-visible name is derived
   * from here rather than from a single global constant. Read it through
   * `src/lib/brand.ts` (or `brand-server.ts` on a public page), never directly.
   */
  brand: string;
  /**
   * Hard filters applied to every listing query on this domain. A door may
   * only ever NARROW what a visitor asked for — the conditions are ANDed,
   * never merged over the visitor's choice. No enabled vertical declares any
   * today; a future `villor.flyttatillspanien.se` would use `property_type`.
   *
   * There is no `foreign_exposure` key, and the column is gone with it: on
   * this portal every listing is for a foreign buyer, so an opt-in flag for
   * foreign exposure has no meaning.
   */
  filters?: {
    property_type?: string[];
    operation?: string[];
  };
  /** Directory domains render a different shell entirely. */
  mode?: "portal" | "directory";
  /**
   * Which voice the marketing copy speaks in. One member is deliberate: the
   * field costs nothing to keep and it is where the English door's "foreign"
   * variant goes on the day it exists.
   */
  copy: "relocation";
  /** Only enabled verticals are routed; others 302 to CANONICAL_HOST. */
  enabled: boolean;
  /**
   * Whether `/bostad/{slug}` is canonical on THIS host. With one door it is
   * always true; the flag exists because a second door serving the same rows
   * must canonicalise its detail pages away — see `listingCanonicalOrigin()`.
   */
  ownsListingDetail: boolean;
}

export const VERTICALS: Record<string, VerticalConfig> = {
  "flyttatillspanien.se": {
    key: "sv",
    brand: "Flytta till Spanien",
    locale: "sv",
    copy: "relocation",
    enabled: true,
    ownsListingDetail: true,
  },
} as const;

/**
 * The host this deployment answers to first. Every other host either
 * self-references (if it is an enabled vertical) or points its canonical URLs
 * here — see `src/lib/origin.ts`.
 */
export const CANONICAL_HOST =
  process.env.NEXT_PUBLIC_CANONICAL_HOST ?? "flyttatillspanien.se";

// Fallback must be an OWNED host: if CANONICAL_HOST ever names a host with no
// entry, every page would be branded with a domain the founder does not own
// while canonicals still self-reference (audit F41).
const DEFAULT = VERTICALS[CANONICAL_HOST] ?? VERTICALS["flyttatillspanien.se"];

/**
 * The vertical key to stamp on a row when no `x-vertical` header reached the
 * handler (direct API call, a request that bypassed middleware). Derived from
 * DEFAULT so it can never name a door that no longer exists.
 */
export const DEFAULT_VERTICAL_KEY: VerticalKey = DEFAULT.key;

/** Resolve a Host header to a vertical. Unknown hosts (localhost, previews) → CANONICAL_HOST's vertical. */
export function resolveVertical(host: string | null): VerticalConfig {
  if (!host) return DEFAULT;
  const bare = host.toLowerCase().replace(/^www\./, "").split(":")[0];
  const v = VERTICALS[bare];
  return v && v.enabled ? v : DEFAULT;
}
