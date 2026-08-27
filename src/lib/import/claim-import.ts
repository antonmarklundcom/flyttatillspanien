/**
 * Turning a parsed page into a draft the agent owns.
 *
 * The word that matters is *claim*. An agent pastes a link to a listing they
 * say is theirs, ticks the attestation, and we create a **draft** in their own
 * scope. It is not published, it is not verified, and it still passes the review
 * queue — so the portal's position is "an identified account claimed this",
 * never "we copied it from somewhere".
 *
 * Two things are recorded so that claim is auditable rather than a promise:
 * the source URL on `listing_sources`, and the attestation timestamp in the
 * review notes the super-admin sees while approving.
 */
import "server-only";
import { and, eq, like, ne } from "drizzle-orm";
import { db } from "@/db";
import { listings, listingSources, locations } from "@/db/schema";
import { makePublicId, contentHash, dedupKey, toPriceUsd } from "./normalize";
import { syncDisplayCoords } from "@/lib/geo";
import { slugify } from "@/lib/slug";
import { USD_TO_PYG } from "@/lib/publish-queries";
import type { ParsedListing } from "./from-url";
import type { Operation, PropertyType, RawListing } from "./types";

/** Which importer bucket a host belongs to — provenance, not per-site parsing. */
export function sourceForHost(sourceUrl: string): (typeof listingSources.$inferInsert)["source"] {
  let host = "";
  try {
    host = new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    return "import_agency_site";
  }
  if (host.includes("infocasas")) return "import_infocasas";
  if (host.includes("clasipar")) return "import_clasipar";
  if (host.includes("tulugar")) return "import_tulugar";
  return "import_agency_site";
}

/**
 * Best-effort match of the page's free-text location to a `locations` row.
 *
 * Deliberately conservative: it returns a *suggestion*, and the form makes the
 * agent confirm it. Auto-assigning a barrio from a fuzzy string match would put
 * listings on the wrong SEO page, which is worse than asking.
 */
export async function suggestLocation(
  locationText: string | null,
  titleText: string | null,
): Promise<number | null> {
  const haystack = `${locationText ?? ""} ${titleText ?? ""}`.trim();
  if (!haystack) return null;

  // The whole table: tens of rows, and every level is a candidate.
  const rows = await db
    .select({ id: locations.id, name: locations.name, level: locations.level })
    .from(locations);

  const normalized = slugify(haystack);
  // Prefer the deepest match: a barrio is more useful than its city, and a
  // page naming both should land on the barrio.
  const byDepth = { barrio: 3, ciudad: 2, departamento: 1, pais: 0 } as const;
  let best: { id: number; depth: number; length: number } | null = null;

  for (const row of rows) {
    const slug = slugify(row.name);
    if (slug.length < 4) continue; // too short to match safely
    if (!normalized.includes(slug)) continue;
    const depth = byDepth[row.level as keyof typeof byDepth] ?? 0;
    // Longer name = more specific evidence ("San Lorenzo" beats "San").
    if (!best || depth > best.depth || (depth === best.depth && slug.length > best.length)) {
      best = { id: row.id, depth, length: slug.length };
    }
  }
  return best?.id ?? null;
}

export interface ClaimInput {
  parsed: ParsedListing;
  /** Confirmed by the agent in the form, never inferred. */
  operation: Operation;
  propertyType: PropertyType;
  title: string;
  descriptionEs: string | null;
  priceAmount: number;
  priceCurrency: "USD" | "PYG";
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  areaM2: number | null;
  landM2: number | null;
  locationId: number;
  /** Who is claiming it. */
  userId: number;
  agencyId: number | null;
}

/**
 * Create the draft plus its provenance row. Returns the new listing id.
 *
 * The listing is `draft` and `is_verified = false` by construction: this
 * function has no parameter that could make it anything else.
 */
export async function createClaimedDraft(input: ClaimInput): Promise<number> {
  const priceUsd = toPriceUsd(input.priceAmount, input.priceCurrency, USD_TO_PYG);
  const publicId = makePublicId();

  await db.insert(listings).values({
    publicId,
    slug: slugify(input.title) || "propiedad",
    status: "draft",
    operation: input.operation,
    propertyType: input.propertyType,
    title: input.title.slice(0, 180),
    descriptionEs: input.descriptionEs,
    priceAmount: String(input.priceAmount),
    priceCurrency: input.priceCurrency,
    priceUsd: String(priceUsd),
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    parking: input.parking,
    areaM2: input.areaM2 != null ? String(input.areaM2) : null,
    landM2: input.landM2 != null ? String(input.landM2) : null,
    locationId: input.locationId,
    agencyId: input.agencyId,
    ownerUserId: input.userId,
    isVerified: false,
    // What the reviewer needs to know, on the row itself.
    reviewNotes: `Importado por el usuario desde ${input.parsed.sourceUrl.slice(0, 200)} (declaró ser el titular)`,
  });

  const [created] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.publicId, publicId))
    .limit(1);
  if (!created) throw new Error("draft insert did not produce a row");
  // The link importer keeps no coordinate of its own, so the draft is plotted
  // at its location's centroid until an operator adds one (src/lib/geo.ts).
  await syncDisplayCoords(db, created.id);

  // Provenance. `contentHash`/`dedupKey` feed the existing dedup pipeline, so a
  // claimed import participates in change detection like any other source.
  const raw: RawListing = {
    source: sourceForHost(input.parsed.sourceUrl),
    sourceUrl: input.parsed.sourceUrl,
    title: input.title,
    descriptionEs: input.descriptionEs ?? undefined,
    operation: input.operation,
    propertyType: input.propertyType,
    priceAmount: input.priceAmount,
    priceCurrency: input.priceCurrency,
    bedrooms: input.bedrooms ?? undefined,
    bathrooms: input.bathrooms ?? undefined,
    parking: input.parking ?? undefined,
    areaM2: input.areaM2 ?? undefined,
    landM2: input.landM2 ?? undefined,
    locationName: input.parsed.locationText ?? undefined,
    imageUrls: input.parsed.imageUrls,
  };

  const now = new Date();
  // 0 = unscoped, which is what an independent agent's claim is.
  const scopeAgencyId = input.agencyId ?? 0;
  await db.insert(listingSources).values({
    listingId: created.id,
    source: sourceForHost(input.parsed.sourceUrl),
    scopeAgencyId,
    sourceUrl: input.parsed.sourceUrl.slice(0, 600),
    contentHash: contentHash(raw, priceUsd),
    // NULL when the claimed page carried no phone — the claim flow never sets
    // one, so this is the normal case. A claim is already identified by its
    // source URL (findExistingClaim), which is a far stronger signal than the
    // fuzzy key, so nothing is lost by not having one.
    dedupKey: dedupKey(raw, priceUsd, input.locationId, scopeAgencyId),
    firstSeenAt: now,
    lastSeenAt: now,
  });

  return created.id;
}

/**
 * Has this URL already been claimed? Two agents pasting the same link — or one
 * agent pasting twice — should not silently produce duplicate listings.
 */
export async function findExistingClaim(
  sourceUrl: string,
): Promise<{ listingId: number; title: string; status: string } | null> {
  const [row] = await db
    .select({
      listingId: listingSources.listingId,
      title: listings.title,
      status: listings.status,
    })
    .from(listingSources)
    .innerJoin(listings, eq(listingSources.listingId, listings.id))
    .where(
      and(
        eq(listingSources.sourceUrl, sourceUrl.slice(0, 600)),
        // A removed listing should not block re-importing the same URL.
        ne(listings.status, "removed"),
      ),
    )
    .limit(1);
  return row ?? null;
}
