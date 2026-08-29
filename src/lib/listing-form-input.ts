/**
 * Parse + validate the shared listing edit form (src/components/panel/ListingForm).
 *
 * Lives apart from the two server actions that use it so admin and agency edits
 * can never drift into validating the same form differently. This only shapes
 * the payload — *authorisation* is the caller's EditScope, enforced in the
 * query layer's WHERE clause.
 */
import type { ListingEditInput, ListingStatusValue } from "@/lib/listing-edit";
import { ADMIN_STATUSES } from "@/lib/listing-edit";
import {
  CHARGES_STATUSES,
  ENERGY_EMISSIONS,
  ENERGY_RATINGS,
  LAND_CLASSIFICATIONS,
  LEGAL_STATUSES,
  OPERATIONS,
  PROPERTY_TYPES,
  type ChargesStatus,
  type EnergyEmissions,
  type EnergyRating,
  type LandClassification,
  type LegalStatus,
  type Operation,
  type PropertyType,
} from "@/lib/import/types";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

/** Blank input → NULL; otherwise a non-negative integer, else NULL. */
function optInt(v: FormDataEntryValue | null): number | null {
  const s = str(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Blank input → NULL; otherwise a positive number, else NULL. */
function optNum(v: FormDataEntryValue | null): number | null {
  const s = str(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * A select whose value must be one of a fixed set, or null.
 *
 * Blank and unrecognised both become null rather than throwing: this is a
 * form, the browser only ever submits the options rendered, and an
 * unrecognised value means a hand-crafted POST that should change nothing
 * rather than fail loudly and hint at what the column accepts.
 */
function optEnum<T extends string>(
  v: FormDataEntryValue | null,
  allowed: readonly T[],
): T | null {
  const s = str(v);
  return (allowed as readonly string[]).includes(s) ? (s as T) : null;
}

export type ListingFormResult =
  | { ok: true; id: number; input: ListingEditInput }
  | { ok: false; id: number };

export function readListingForm(formData: FormData): ListingFormResult {
  const id = Number(formData.get("listingId"));
  const safeId = Number.isInteger(id) && id > 0 ? id : 0;

  const title = str(formData.get("title"));
  const operation = str(formData.get("operation")) as Operation;
  const propertyType = str(formData.get("propertyType")) as PropertyType;
  const priceEur = Number(str(formData.get("priceEur")));
  const locationId = Number(str(formData.get("locationId")));
  const status = str(formData.get("status")) as ListingStatusValue;

  const valid =
    safeId > 0 &&
    title.length >= 8 &&
    OPERATIONS.includes(operation) &&
    PROPERTY_TYPES.includes(propertyType) &&
    Number.isFinite(priceEur) &&
    priceEur > 0 &&
    Number.isInteger(locationId) &&
    locationId > 0 &&
    ADMIN_STATUSES.includes(status);

  if (!valid) return { ok: false, id: safeId };

  return {
    ok: true,
    id: safeId,
    input: {
      title,
      descriptionEs: str(formData.get("descriptionEs")) || null,
      operation,
      propertyType,
      priceEur,
      bedrooms: optInt(formData.get("bedrooms")),
      bathrooms: optInt(formData.get("bathrooms")),
      parking: optInt(formData.get("parking")),
      builtM2: optNum(formData.get("builtM2")),
      usableM2: optNum(formData.get("usableM2")),
      plotM2: optNum(formData.get("plotM2")),
      yearBuilt: optInt(formData.get("yearBuilt")),
      locationId,
      videoUrl: str(formData.get("videoUrl")).slice(0, 500) || null,
      status,
      /* The Spain legal block. */
      referenciaCatastral: str(formData.get("referenciaCatastral")) || null,
      energyRating: optEnum<EnergyRating>(
        formData.get("energyRating"),
        ENERGY_RATINGS,
      ),
      energyEmissions: optEnum<EnergyEmissions>(
        formData.get("energyEmissions"),
        ENERGY_EMISSIONS,
      ),
      // `desconocido` rather than null when the form says nothing: the columns
      // are NOT NULL and their default is the honest "nobody told us", which
      // is exactly what an empty select means.
      legalStatus:
        optEnum<LegalStatus>(formData.get("legalStatus"), LEGAL_STATUSES) ??
        "desconocido",
      chargesStatus:
        optEnum<ChargesStatus>(
          formData.get("chargesStatus"),
          CHARGES_STATUSES,
        ) ?? "desconocido",
      ibiAnnualEur: optNum(formData.get("ibiAnnualEur")),
      communityMonthlyEur: optNum(formData.get("communityMonthlyEur")),
      isVpo: formData.get("isVpo") === "1",
      landClassification: optEnum<LandClassification>(
        formData.get("landClassification"),
        LAND_CLASSIFICATIONS,
      ),
      buildableM2: optNum(formData.get("buildableM2")),
      touristLicence: str(formData.get("touristLicence")).slice(0, 40) || null,
      /**
       * `nota_simple_seen_at` is deliberately NOT read from this form.
       * `updateListing()` ignores it outside the admin scope anyway, but the
       * portal's own attestation has no business being parseable out of a
       * shared form at all — /admin sets it through its own action.
       */
    },
  };
}
