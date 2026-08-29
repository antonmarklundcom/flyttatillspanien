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
import {
  makePublicId,
  contentHash,
  dedupKey,
  normalizeCatastral,
  toPriceEur,
} from "./normalize";
import { syncDisplayCoords } from "@/lib/geo";
import { slugify } from "@/lib/slug";
import type { ParsedListing } from "./from-url";
import type {
  ChargesStatus,
  EnergyRating,
  LegalStatus,
  Operation,
  PropertyType,
  RawListing,
} from "./types";

/** Which importer bucket a host belongs to — provenance, not per-site parsing. */
export function sourceForHost(sourceUrl: string): (typeof listingSources.$inferInsert)["source"] {
  let host = "";
  try {
    host = new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    return "import_agency_site";
  }
  if (host.includes("idealista")) return "import_idealista";
  if (host.includes("fotocasa")) return "import_fotocasa";
  if (host.includes("kyero")) return "import_kyero";
  return "import_agency_site";
}

/**
 * Best-effort match of the page's free-text location to a `locations` row.
 *
 * Deliberately conservative: it returns a *suggestion*, and the form makes the
 * agent confirm it. Auto-assigning a zona from a fuzzy string match would put
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
  // Prefer the deepest match: a zona is more useful than its municipio, and a
  // page naming both should land on the zona.
  const byDepth = {
    zona: 4,
    municipio: 3,
    provincia: 2,
    comunidad: 1,
    pais: 0,
  } as const;
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

/** Which listing, if any, already holds this catastral reference. */
async function catastralHolder(catastral: string): Promise<number | null> {
  const [row] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.referenciaCatastral, catastral))
    .limit(1);
  return row?.id ?? null;
}

export interface ClaimInput {
  parsed: ParsedListing;
  /** Confirmed by the agent in the form, never inferred. */
  operation: Operation;
  propertyType: PropertyType;
  title: string;
  descriptionEs: string | null;
  priceEur: number;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  builtM2: number | null;
  usableM2: number | null;
  plotM2: number | null;
  locationId: number;
  /**
   * The Spain legal block, as the claiming agent states it. `energy_rating` is
   * optional here for the same reason it is optional in the CSV: this creates
   * a DRAFT, and the gate that needs the rating is the one on publishing.
   */
  referenciaCatastral: string | null;
  energyRating: EnergyRating | null;
  legalStatus: LegalStatus | null;
  chargesStatus: ChargesStatus | null;
  touristLicence: string | null;
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
  const priceEur = toPriceEur(input.priceEur);
  const publicId = makePublicId();

  /**
   * A catastral reference already held by another listing is a real-world
   * conflict — two accounts claiming one physical property — and `uq_catastral`
   * would refuse the insert outright. Dropping the reference here keeps the
   * claim as a draft the reviewer can judge, with the conflict written on the
   * row, instead of failing the agent's submission with a duplicate-key error
   * and losing everything they typed.
   */
  const catastral = normalizeCatastral(input.referenciaCatastral);
  const catastralHeldBy = catastral ? await catastralHolder(catastral) : null;
  const claimedCatastral = catastralHeldBy == null ? catastral : null;
  const conflictNote =
    catastralHeldBy != null
      ? ` — ATENCIÓN: la referencia catastral ${catastral} ya pertenece al aviso #${catastralHeldBy}`
      : "";

  await db.insert(listings).values({
    publicId,
    slug: slugify(input.title) || "bostad",
    status: "draft",
    operation: input.operation,
    propertyType: input.propertyType,
    title: input.title.slice(0, 180),
    descriptionEs: input.descriptionEs,
    priceEur: String(priceEur),
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    parking: input.parking,
    builtM2: input.builtM2 != null ? String(input.builtM2) : null,
    usableM2: input.usableM2 != null ? String(input.usableM2) : null,
    plotM2: input.plotM2 != null ? String(input.plotM2) : null,
    locationId: input.locationId,
    referenciaCatastral: claimedCatastral,
    energyRating: input.energyRating,
    legalStatus: input.legalStatus ?? "desconocido",
    chargesStatus: input.chargesStatus ?? "desconocido",
    touristLicence:
      input.operation === "alquiler_vacacional" ? input.touristLicence : null,
    agencyId: input.agencyId,
    ownerUserId: input.userId,
    isVerified: false,
    // What the reviewer needs to know, on the row itself.
    reviewNotes:
      `Importado por el usuario desde ${input.parsed.sourceUrl.slice(0, 200)} (declaró ser el titular)${conflictNote}`.slice(
        0,
        280,
      ),
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
    priceEur,
    bedrooms: input.bedrooms ?? undefined,
    bathrooms: input.bathrooms ?? undefined,
    parking: input.parking ?? undefined,
    builtM2: input.builtM2 ?? undefined,
    usableM2: input.usableM2 ?? undefined,
    plotM2: input.plotM2 ?? undefined,
    referenciaCatastral: input.referenciaCatastral ?? undefined,
    energyRating: input.energyRating ?? undefined,
    legalStatus: input.legalStatus ?? undefined,
    chargesStatus: input.chargesStatus ?? undefined,
    touristLicence: input.touristLicence ?? undefined,
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
    contentHash: contentHash(raw, priceEur),
    /**
     * NULL when the claimed page carried no phone — the claim flow never sets
     * one, so this is the normal case. A claim is already identified by its
     * source URL (findExistingClaim), which is a far stronger signal than the
     * fuzzy key, so nothing is lost by not having one.
     *
     * Also NULL whenever the row carries a catastral reference, matching the
     * planner: a property with an exact identity must not additionally carry a
     * bucketed key that a later, reference-less row could match against.
     */
    dedupKey: claimedCatastral
      ? null
      : dedupKey(raw, priceEur, input.locationId, scopeAgencyId),
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
