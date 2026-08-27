/**
 * Per-request origins (ARCHITECTURE.md §2.8).
 *
 * One deployment serves several domains, so an origin baked in at build time
 * from NEXT_PUBLIC_CANONICAL_HOST is wrong for every host but one: attach a
 * second domain and its pages emit canonicals — and a sitemap — pointing at
 * the first. The Host header is the only thing that knows which door the
 * visitor came through, so every absolute URL is built from it here, the same
 * way middleware.ts already resolves the vertical from it.
 *
 * Two origins, because /propiedad is the one page type whose owning host is
 * not simply the host that served it:
 *   siteOrigin()             — the host that owns this page.
 *   listingCanonicalOrigin() — ...except detail pages, which only some hosts
 *                              own; the rest canonicalise back to primary.
 */
import { headers } from "next/headers";
import { CANONICAL_HOST, VERTICALS } from "@/config/verticals";
import { rawHostFrom } from "./host";

const PRIMARY_ORIGIN = `https://${CANONICAL_HOST}`;

interface HostParts {
  /** As sent, minus a leading www. — keeps the port for local dev. */
  raw: string;
  /** Lowercased, www- and port-free: the form VERTICALS is keyed by. */
  bare: string;
  local: boolean;
}

async function hostParts(): Promise<HostParts | null> {
  const h = await headers();
  // Shared with middleware.ts (src/lib/host.ts): x-forwarded-host wins —
  // Hostinger's proxy sets it, and it may be a list (audit F31).
  const raw = rawHostFrom(h);
  if (!raw) return null;
  const bare = raw.split(":")[0];
  const local =
    bare === "localhost" || bare === "127.0.0.1" || bare.endsWith(".local");
  return { raw, bare, local };
}

/**
 * A host may speak for itself only if we route it: an enabled vertical, or
 * the primary host (which is served even when its vertical row still says
 * `enabled: false` — that mismatch is D2, and canonical URLs must not wait
 * on it). Anything else is a preview deploy or the raw *.hostingersite.com
 * name, and pointing SEO at those is how duplicate content happens.
 */
function isOwnHost(p: HostParts): boolean {
  if (p.bare === CANONICAL_HOST) return true;
  return VERTICALS[p.bare]?.enabled ?? false;
}

/**
 * Origin for every absolute URL on this request: canonical and OG tags, the
 * sitemap, JSON-LD, and the listing link the CRM shows a salesperson.
 */
export async function siteOrigin(): Promise<string> {
  const p = await hostParts();
  if (!p) return PRIMARY_ORIGIN;
  if (p.local) return `http://${p.raw}`;
  return isOwnHost(p) ? `https://${p.bare}` : PRIMARY_ORIGIN;
}

/**
 * Whether /propiedad/{slug} is canonical on the host that served this request.
 * The primary host always owns it (same reasoning as `isOwnHost`); an enabled
 * vertical owns it only if its config says so; everything else — a feeder, a
 * preview deploy, the raw *.hostingersite.com name — points back at primary.
 * Local dev "owns" it so `next dev` doesn't emit production canonicals.
 */
function ownsListingDetail(p: HostParts): boolean {
  if (p.local) return true;
  if (p.bare === CANONICAL_HOST) return true;
  const v = VERTICALS[p.bare];
  return Boolean(v?.enabled && v.ownsListingDetail);
}

/**
 * Origin for /propiedad/{slug} canonicals. Detail pages exist canonically on
 * the primary host and on the EN site (its own translated pages); a feeder
 * domain that renders one canonicalises it back to the primary host rather
 * than competing with it.
 */
export async function listingCanonicalOrigin(): Promise<string> {
  const p = await hostParts();
  if (!p) return PRIMARY_ORIGIN;
  if (p.local) return `http://${p.raw}`;
  return ownsListingDetail(p) ? `https://${p.bare}` : PRIMARY_ORIGIN;
}

/**
 * Same question, as a boolean, for callers that need to decide whether to
 * emit a listing URL at all rather than which origin to put in front of it —
 * i.e. the sitemap. A host must never submit URLs it canonicalises away:
 * Search Console reports those as "submitted URL not selected as canonical",
 * which is a crawl-budget and trust cost for zero indexing benefit. Sharing
 * this one predicate with `listingCanonicalOrigin()` is what keeps the two
 * answers from drifting apart.
 */
export async function hostOwnsListingDetail(): Promise<boolean> {
  const p = await hostParts();
  return p ? ownsListingDetail(p) : true;
}
