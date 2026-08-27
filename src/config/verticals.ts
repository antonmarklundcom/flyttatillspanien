/**
 * Domain routing layer — how one engine serves every door (ARCHITECTURE.md §2.8).
 *
 * Lives in code, not the database: it changes at deploy cadence and wants
 * type safety. Exactly one host is enabled — flyttatillspanien.se, locale
 * "sv" — see docs/SPAIN-PORTAL-DESIGN.md §1. Do NOT add a disabled English or
 * `.es` entry: an unowned domain in this file becomes a fallback nobody meant
 * to build (the propia.com.py lesson, CLAUDE.md). Add the English door on the
 * day that domain is actually bought.
 */

export type VerticalKey = "sv";

export interface VerticalConfig {
  key: VerticalKey;
  /** Widen to "sv" | "en" when the English door is bought. */
  locale: "sv";
  /**
   * The public brand name for this door. The domain IS the brand — there is
   * no separate wordmark to keep in sync, so every user-visible name is
   * derived from here rather than from a single global constant. Read it
   * through `src/lib/brand.ts`, never directly: that module is what resolves
   * the current request's host to a name.
   */
  brand: string;
  /** Hard filters applied to every listing query on this domain. */
  filters?: {
    property_type?: string[];
    operation?: string[];
  };
  /** Directory/projects domains render a different shell entirely. */
  mode?: "portal" | "directory";
  copy: "relocation";
  /** Only enabled verticals are routed; others 302 to CANONICAL_HOST until launch. */
  enabled: boolean;
  /**
   * Whether /propiedad/{slug} is canonical on THIS host. There is one door,
   * so this is always true today — the flag stays because the English door
   * will need it set to false or true deliberately, the same way
   * inmobiliaria.com.py needed it on propia.node.
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
 * self-references (if it is an enabled vertical) or points its canonical
 * URLs here — see `src/lib/origin.ts`.
 */
export const CANONICAL_HOST =
  process.env.NEXT_PUBLIC_CANONICAL_HOST ?? "flyttatillspanien.se";

// Fallback must be an OWNED host: if CANONICAL_HOST ever names a host with no
// entry, every page would be branded with a domain the founder does not own
// while canonicals still self-reference (audit F41).
const DEFAULT =
  VERTICALS[CANONICAL_HOST] ?? VERTICALS["flyttatillspanien.se"];

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
