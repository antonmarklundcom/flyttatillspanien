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
  OPERATIONS,
  PROPERTY_TYPES,
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

export type ListingFormResult =
  | { ok: true; id: number; input: ListingEditInput }
  | { ok: false; id: number };

export function readListingForm(formData: FormData): ListingFormResult {
  const id = Number(formData.get("listingId"));
  const safeId = Number.isInteger(id) && id > 0 ? id : 0;

  const title = str(formData.get("title"));
  const operation = str(formData.get("operation")) as Operation;
  const propertyType = str(formData.get("propertyType")) as PropertyType;
  const priceAmount = Number(str(formData.get("priceAmount")));
  const locationId = Number(str(formData.get("locationId")));
  const status = str(formData.get("status")) as ListingStatusValue;

  const valid =
    safeId > 0 &&
    title.length >= 8 &&
    OPERATIONS.includes(operation) &&
    PROPERTY_TYPES.includes(propertyType) &&
    Number.isFinite(priceAmount) &&
    priceAmount > 0 &&
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
      priceAmount,
      priceCurrency: str(formData.get("priceCurrency")) === "PYG" ? "PYG" : "USD",
      bedrooms: optInt(formData.get("bedrooms")),
      bathrooms: optInt(formData.get("bathrooms")),
      parking: optInt(formData.get("parking")),
      areaM2: optNum(formData.get("areaM2")),
      landM2: optNum(formData.get("landM2")),
      locationId,
      videoUrl: str(formData.get("videoUrl")).slice(0, 500) || null,
      foreignExposure: formData.get("foreignExposure") === "1",
      status,
    },
  };
}
