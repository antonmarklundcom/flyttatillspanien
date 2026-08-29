"use server";

/**
 * Import-by-link actions.
 *
 * Both steps re-resolve the caller from the session. The parsed page travels
 * back to the client between the two steps (it is just what a public page said),
 * but nothing from it is trusted on the way in: the confirm step re-reads every
 * field from the submitted form and re-validates it, so a tampered payload can
 * only produce a draft with bad data the agent is looking at — never a published
 * listing, a different owner, or another agency's row.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { panelScope, requireAgencyContext } from "@/lib/auth/guards";
import {
  importListingFromUrl,
  type ParsedListing,
} from "@/lib/import/from-url";
import {
  createClaimedDraft,
  findExistingClaim,
  suggestLocation,
} from "@/lib/import/claim-import";
import { UnsafeUrlError, type FetchRejection } from "@/lib/safe-fetch";
import { allowRequest } from "@/lib/rate-limit";
import {
  CHARGES_STATUSES,
  ENERGY_RATINGS,
  LEGAL_STATUSES,
  OPERATIONS,
  PROPERTY_TYPES,
} from "@/lib/import/types";
import type {
  ChargesStatus,
  EnergyRating,
  LegalStatus,
  Operation,
  PropertyType,
} from "@/lib/import/types";

/**
 * A form value narrowed to a known enum member, or null. Blank and
 * unrecognised are the same answer here: the claim form only ever renders the
 * options below, so anything else is a hand-built POST that should set
 * nothing rather than fail loudly.
 */
function enumOrNull<T extends string>(
  value: FormDataEntryValue | null,
  allowed: readonly T[],
): T | null {
  const v = String(value ?? "").trim();
  return (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

export type ReadUrlResult =
  | {
      ok: true;
      parsed: ParsedListing;
      suggestedLocationId: number | null;
      duplicate: { listingId: number; title: string; status: string } | null;
    }
  | { ok: false; error: FetchRejection | "generic" | "rate_limited" };

/**
 * How often one account may make the server fetch a URL of its choosing.
 *
 * This is the one endpoint in the app that turns a form field into an outbound
 * request, so it is the one worth a cooldown even behind a login (PLAN.md 3.5
 * lists this as the feature's known limit). `safe-fetch.ts` already refuses
 * private addresses, so the risk left is volume: a loop of public URLs turning
 * the site into someone's fetch proxy, and 90 neighbours on the same Hostinger
 * process cap paying for it.
 *
 * Twelve in five minutes is far past a real migration session — an agent
 * pastes a link, reviews the form and confirms it, which takes longer than
 * this window allows a bot to be interesting.
 */
const URL_FETCHES = 12;
const URL_WINDOW_MS = 5 * 60_000;

/** Step 1: fetch and parse. Creates nothing. */
export async function readListingUrlAction(
  rawUrl: string,
): Promise<ReadUrlResult> {
  const ctx = await requireAgencyContext();

  // Keyed on the account, not the IP: the caller is authenticated, and an IP
  // key would let one office's shared connection lock out its colleagues.
  if (!allowRequest(`import-url:${ctx.user.id}`, URL_FETCHES, URL_WINDOW_MS)) {
    return { ok: false, error: "rate_limited" };
  }

  try {
    const parsed = await importListingFromUrl(rawUrl);
    const [suggestedLocationId, duplicate] = await Promise.all([
      suggestLocation(parsed.locationText, parsed.title),
      findExistingClaim(parsed.sourceUrl),
    ]);
    return { ok: true, parsed, suggestedLocationId, duplicate };
  } catch (err) {
    if (err instanceof UnsafeUrlError) return { ok: false, error: err.reason };
    return { ok: false, error: "generic" };
  }
}

function num(v: FormDataEntryValue | null): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Step 2: create the draft from the *confirmed* form values. */
export async function confirmImportAction(formData: FormData): Promise<void> {
  const ctx = await requireAgencyContext();
  const scope = panelScope(ctx);

  // The attestation is the whole basis for the claim; without it, nothing.
  if (formData.get("ownership") !== "1") {
    redirect("/agencia/importar?msg=ownership");
  }

  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const operation = String(formData.get("operation") ?? "");
  const propertyType = String(formData.get("propertyType") ?? "");
  const priceEur = num(formData.get("priceEur"));
  const locationId = num(formData.get("locationId"));

  const valid =
    sourceUrl.length > 0 &&
    title.length >= 8 &&
    OPERATIONS.includes(operation as Operation) &&
    PROPERTY_TYPES.includes(propertyType as PropertyType) &&
    priceEur != null &&
    priceEur > 0 &&
    locationId != null &&
    locationId > 0;

  if (!valid) redirect("/agencia/importar?msg=invalid");

  // The id arrives from the form and a wrong one would file the listing under
  // a location that does not exist — off every SEO page, invisible to search.
  const [location] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.id, locationId!))
    .limit(1);
  if (!location) redirect("/agencia/importar?msg=invalid");

  // Re-check at write time: step 1's duplicate warning is minutes old by now,
  // and a double-submit (or two agents pasting the same link) would otherwise
  // create two listings for one URL. The existing claim may belong to someone
  // else, so this points back at the form rather than at their listing.
  const existing = await findExistingClaim(sourceUrl);
  if (existing) redirect("/agencia/importar?msg=duplicate");

  const listingId = await createClaimedDraft({
    // Only the source URL and the free-text location survive from the parse;
    // everything else is what the agent confirmed above.
    parsed: {
      sourceUrl,
      locationText: String(formData.get("locationText") ?? "") || null,
      imageUrls: [],
      title: null,
      description: null,
      priceEur: null,
      operation: null,
      propertyType: null,
      bedrooms: null,
      bathrooms: null,
      parking: null,
      builtM2: null,
      plotM2: null,
      notes: [],
    },
    operation: operation as Operation,
    propertyType: propertyType as PropertyType,
    title,
    descriptionEs: String(formData.get("descriptionEs") ?? "").trim() || null,
    priceEur,
    bedrooms: num(formData.get("bedrooms")),
    bathrooms: num(formData.get("bathrooms")),
    parking: num(formData.get("parking")),
    builtM2: num(formData.get("builtM2")),
    usableM2: num(formData.get("usableM2")),
    plotM2: num(formData.get("plotM2")),
    locationId,
    /* The Spain legal block, as the claiming agent states it. */
    referenciaCatastral:
      String(formData.get("referenciaCatastral") ?? "").trim() || null,
    energyRating: enumOrNull<EnergyRating>(
      formData.get("energyRating"),
      ENERGY_RATINGS,
    ),
    legalStatus: enumOrNull<LegalStatus>(
      formData.get("legalStatus"),
      LEGAL_STATUSES,
    ),
    chargesStatus: enumOrNull<ChargesStatus>(
      formData.get("chargesStatus"),
      CHARGES_STATUSES,
    ),
    touristLicence:
      String(formData.get("touristLicence") ?? "").trim() || null,
    userId: ctx.user.id,
    // An independent agent has no agency; the draft is theirs via ownerUserId.
    agencyId: scope.kind === "agency" ? scope.agencyId : null,
  });

  revalidatePath("/agencia");
  redirect(`/agencia/propiedad/${listingId}?msg=imported`);
}
