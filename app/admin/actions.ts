"use server";

/**
 * Super-admin actions. Every action re-checks requireSuperAdmin() — the form
 * is never trusted, and a non-admin who forges a POST is bounced by the guard
 * before any write. Mutations revalidate the affected panel routes.
 */
import { revalidatePath } from "next/cache";
import { revalidateDirectory, revalidateListings } from "@/lib/cache";
import { requireSuperAdmin } from "@/lib/auth/guards";
import {
  approveListing,
  rejectListing,
  setAgencyKind,
  setAgencyVerified,
  setAgentVerified,
  type AgencyRow,
} from "@/lib/panel-queries";

const AGENCY_KINDS: readonly AgencyRow["kind"][] = [
  "inmobiliaria",
  "relocation",
  "developer",
];

function toId(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export async function approveAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = toId(formData.get("listingId"));
  if (id) await approveListing(id);
  revalidatePath("/admin");
  // Approval is the write that changes which listings are published, so it is
  // the one that must drop the data cache: the home rail, the sitemap and the
  // directories all read published rows.
  revalidateListings();
}

export async function rejectAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = toId(formData.get("listingId"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (id && reason) await rejectListing(id, reason);
  revalidatePath("/admin");
  revalidateListings();
}

export async function toggleAgencyVerifiedAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = toId(formData.get("agencyId"));
  const verified = formData.get("verified") === "1";
  if (id) await setAgencyVerified(id, verified);
  revalidatePath("/admin/inmobiliarias");
}

export async function updateAgencyKindAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = toId(formData.get("agencyId"));
  const kind = String(formData.get("kind") ?? "");
  if (id && (AGENCY_KINDS as readonly string[]).includes(kind)) {
    await setAgencyKind(id, kind as AgencyRow["kind"]);
  }
  revalidatePath("/admin/inmobiliarias");
  // The kind decides the "represents the buyer" label on every public
  // surface that renders this agency's name — the directory, the profile
  // page, and every listing's seller card. Both tags, belt and suspenders:
  // this is a rare admin write, not a hot path.
  revalidateDirectory();
  revalidateListings();
}

export async function toggleAgentVerifiedAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = toId(formData.get("agentId"));
  const verified = formData.get("verified") === "1";
  if (id) await setAgentVerified(id, verified);
  revalidatePath("/admin/inmobiliarias");
}
