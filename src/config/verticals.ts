/**
 * Domain routing layer — how one engine serves every door (ARCHITECTURE.md §2.8).
 *
 * Lives in code, not the database: it changes at deploy cadence and wants
 * type safety. Two hosts are enabled today — realestateinparaguay.com (the
 * interim primary) and inmobiliaria.com.py (the Spanish primary in waiting,
 * PLAN.md D6); the remaining feeder domains are pre-declared so routing,
 * canonical URLs, and lead attribution never need a schema change when they
 * switch on.
 */

export type VerticalKey =
  | "terreno"
  | "alquiler"
  | "agents"
  | "devs"
  | "en"
  | "inmobiliaria";

export interface VerticalConfig {
  key: VerticalKey;
  locale: "es" | "en";
  /**
   * The public brand name for this door. The domain IS the brand (founder
   * decision, 2026-08-16) — there is no separate wordmark to keep in sync, so
   * every user-visible name is derived from here rather than from a single
   * global constant. Read it through `src/lib/brand.ts`, never directly:
   * that module is what resolves the current request's host to a name.
   */
  brand: string;
  /** Hard filters applied to every listing query on this domain. */
  filters?: {
    property_type?: string[];
    operation?: string[];
    foreign_exposure?: boolean;
  };
  /** Directory/projects domains render a different shell entirely. */
  mode?: "portal" | "directory" | "projects";
  copy: "ownership" | "land" | "rental" | "foreign" | "directory";
  /** Only enabled verticals are routed; others 302 to CANONICAL_HOST until launch. */
  enabled: boolean;
  /**
   * Whether /propiedad/{slug} is canonical on THIS host (§2.8: detail pages
   * live on the primary host only; the EN site is the translation exception).
   * Feeder domains own category/landing pages and link into the primary host,
   * so their detail pages canonicalise away — see `listingCanonicalOrigin()`.
   */
  ownsListingDetail: boolean;
}

export const VERTICALS: Record<string, VerticalConfig> = {
  "terreno.com.py": {
    key: "terreno",
    brand: "Terreno.com.py",
    locale: "es",
    filters: { property_type: ["terreno"] },
    copy: "land",
    enabled: false,
    ownsListingDetail: false,
  },
  "alquiler.com.py": {
    key: "alquiler",
    brand: "Alquiler.com.py",
    locale: "es",
    filters: { operation: ["alquiler"] },
    copy: "rental", // "tu próximo lugar" — never ownership language
    enabled: false,
    ownsListingDetail: false,
  },
  "inmobiliarios.com.py": {
    key: "agents",
    brand: "Inmobiliarios Paraguay",
    locale: "es",
    mode: "directory",
    copy: "directory",
    enabled: false,
    ownsListingDetail: false,
  },
  "desarrolladores.com.py": {
    key: "devs",
    brand: "Desarrolladores Paraguay",
    locale: "es",
    mode: "projects",
    copy: "directory",
    enabled: false,
    ownsListingDetail: false,
  },
  /**
   * INTERIM: this is the live production host (see CLAUDE.md), and the
   * Spanish site is primary here. When `inmobiliaria.com.py` takes over as
   * the Spanish primary (PLAN.md D6), this entry becomes the English feeder
   * vertical it was originally planned as: `key: "en"`, `locale: "en"`,
   * `filters: { foreign_exposure: true }`, `copy: "foreign"`,
   * `enabled: false`, `ownsListingDetail: true` (its own translated detail
   * pages, hreflang'd against the primary — translation ≠ duplicate).
   */
  "realestateinparaguay.com": {
    key: "en",
    brand: "Real Estate in Paraguay",
    locale: "es",
    copy: "ownership",
    enabled: true,
    ownsListingDetail: true,
  },
  /**
   * SECOND production host (see CLAUDE.md, PLAN.md D6) — same app, same
   * database as realestateinparaguay.com. Owned by the founder, and as of
   * 2026-08-16 this is the **Spanish marketplace primary in waiting**. It
   * was previously earmarked for his own individual agency brand and
   * ruled out of this app entirely — that call was reversed, and the domain
   * now carries both his own inventory and other realtors'/agencies' listings
   * he takes on case-by-case until his EAS/SERPLAID license issues
   * (~Oct 2026).
   *
   * `ownsListingDetail: false` is INTENTIONAL and TEMPORARY, not the final
   * state: this host and realestateinparaguay.com currently serve the exact
   * same Spanish listing rows. If both self-canonicalised /propiedad pages,
   * Google would see two domains publishing identical content — duplicate
   * content, ranking cannibalisation. So for now this host's listing detail
   * pages canonicalise back to the primary (realestateinparaguay.com) same
   * as any other feeder; every other page type here (home, search, guías)
   * is genuinely unique and indexes normally. Flip this to `true` — and
   * simultaneously flip realestateinparaguay.com to
   * `locale: "en", filters: { foreign_exposure: true }, copy: "foreign"` —
   * only once inmobiliaria.com.py becomes the real publishing primary and
   * realestateinparaguay.com's content is genuinely translated, not just a
   * mirrored copy. That flip touches this file, the env var and CLAUDE.md
   * together — do not do it piecemeal; PLAN.md D6 carries the checklist.
   *
   * While it stays `false`, this host's sitemap omits /propiedad URLs
   * (`app/sitemap.ts` via `hostOwnsListingDetail()`), because submitting URLs
   * it canonicalises elsewhere is what earns "submitted URL not selected as
   * canonical" in Search Console.
   */
  "inmobiliaria.com.py": {
    key: "inmobiliaria",
    brand: "Inmobiliaria Paraguay",
    locale: "es",
    copy: "ownership",
    enabled: true,
    ownsListingDetail: false,
  },
} as const;

/**
 * The host this deployment answers to first. Every other host either
 * self-references (if it is an enabled vertical) or points its canonical
 * URLs here — see `src/lib/origin.ts`. Changing it is a D2 decision, not a
 * code decision.
 *
 * INTERIM default: `realestateinparaguay.com`, one of the two hosts actually
 * owned today (see CLAUDE.md). It moves to `inmobiliaria.com.py` on flip day,
 * as one item in the PLAN.md D6 checklist — never on its own, because
 * `DEFAULT` below derives the locale, filters and copy of every request from
 * whatever this names.
 */
export const CANONICAL_HOST =
  process.env.NEXT_PUBLIC_CANONICAL_HOST ?? "realestateinparaguay.com";

// Fallback must be an OWNED host: if CANONICAL_HOST ever names a host with no
// entry, every page would be branded with a domain the founder does not own
// while canonicals still self-reference (audit F41).
const DEFAULT =
  VERTICALS[CANONICAL_HOST] ?? VERTICALS["realestateinparaguay.com"];

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
