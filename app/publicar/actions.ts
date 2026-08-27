"use server";

/**
 * Publish-wizard server actions (ARCHITECTURE.md §3, M5). These run in the Node
 * runtime and are the trust boundary: the client supplies field values, but
 * every action re-resolves the caller from the session (requireUser), re-derives
 * the agency scope server-side, and validates the payload here. The client is
 * never trusted for identity, ownership, or the verified flag.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, listings, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { alertOperator, getCrm, isMessagingConfigured } from "@/lib/crm";
import { canonPhone } from "@/lib/import/normalize";
import {
  OPERATIONS,
  PROPERTY_TYPES,
  type Operation,
  type PropertyType,
} from "@/lib/import/types";
import { esPanel } from "@/i18n/es";
import { siteOrigin } from "@/lib/origin";
import { createOtp, verifyOtp } from "@/lib/otp";
import { saveDraft, submitDraftForReview } from "@/lib/publish-queries";

/** Which agency (if any) a publisher belongs to — never read from the client. */
async function resolveAgencyId(userId: number): Promise<number | null> {
  const [row] = await db
    .select({ agencyId: agents.agencyId })
    .from(agents)
    .where(eq(agents.userId, userId))
    .limit(1);
  return row?.agencyId ?? null;
}

/** Raw wizard payload from the client — every field re-validated below. */
export interface DraftPayload {
  draftId?: number | null;
  operation?: string;
  propertyType?: string;
  title?: string;
  descriptionEs?: string;
  priceAmount?: number;
  priceCurrency?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parking?: number | null;
  areaM2?: number | null;
  landM2?: number | null;
  locationId?: number;
  projectId?: number | null;
  videoUrl?: string;
  foreignExposure?: boolean;
}

function posIntOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export type SaveDraftResult =
  | { ok: true; draftId: number }
  | { ok: false; error: string };

/**
 * Persist the wizard's core once the required fields are present (operation,
 * type, title, price, location). Called on step advance and on manual save;
 * partial step-1 state stays client-side until it's complete.
 */
export async function saveDraftAction(
  payload: DraftPayload,
): Promise<SaveDraftResult> {
  const user = await requireUser("/publicar");

  const operation = payload.operation as Operation;
  const propertyType = payload.propertyType as PropertyType;
  const title = String(payload.title ?? "").trim();
  const priceAmount = Number(payload.priceAmount);
  const priceCurrency = payload.priceCurrency === "PYG" ? "PYG" : "USD";
  const locationId = Number(payload.locationId);

  if (!OPERATIONS.includes(operation)) return { ok: false, error: "operation" };
  if (!PROPERTY_TYPES.includes(propertyType))
    return { ok: false, error: "propertyType" };
  if (title.length < 8) return { ok: false, error: "title" };
  if (!Number.isFinite(priceAmount) || priceAmount <= 0)
    return { ok: false, error: "price" };
  if (!Number.isInteger(locationId) || locationId <= 0)
    return { ok: false, error: "location" };

  const agencyId = await resolveAgencyId(user.id);
  const draftId = await saveDraft({
    userId: user.id,
    agencyId,
    draftId: payload.draftId ?? null,
    input: {
      operation,
      propertyType,
      title,
      descriptionEs: String(payload.descriptionEs ?? "").trim() || null,
      priceAmount,
      priceCurrency,
      bedrooms: posIntOrNull(payload.bedrooms),
      bathrooms: posIntOrNull(payload.bathrooms),
      parking: posIntOrNull(payload.parking),
      areaM2:
        payload.areaM2 != null && Number(payload.areaM2) > 0
          ? Number(payload.areaM2)
          : null,
      landM2:
        payload.landM2 != null && Number(payload.landM2) > 0
          ? Number(payload.landM2)
          : null,
      locationId,
      projectId: posIntOrNull(payload.projectId) || null,
      videoUrl: String(payload.videoUrl ?? "").trim().slice(0, 500) || null,
      foreignExposure: payload.foreignExposure !== false,
    },
  });

  if (draftId === 0) return { ok: false, error: "not_found" };
  return { ok: true, draftId };
}

export type RequestOtpResult =
  | { ok: true }
  | {
      ok: false;
      error: "invalid_number" | "cooldown" | "undeliverable";
      cooldownMs?: number;
    };

/**
 * Issue and deliver a WhatsApp OTP for the publisher's number. Only reachable
 * when a messaging provider exists — see publishDraftAction for the path that
 * runs when none does.
 */
export async function requestOtpAction(
  rawWhatsapp: string,
): Promise<RequestOtpResult> {
  await requireUser("/publicar");
  const whatsapp = canonPhone(rawWhatsapp);
  if (whatsapp.length < 9) return { ok: false, error: "invalid_number" };

  if (!isMessagingConfigured()) return { ok: false, error: "undeliverable" };

  const created = await createOtp(whatsapp);
  if (!created.ok)
    return { ok: false, error: "cooldown", cooldownMs: created.cooldownMs };

  // A provider that fails to deliver must not look like a sent code.
  const sent = await getCrm().sendOtp(whatsapp, created.code);
  if (!sent.ok) return { ok: false, error: "undeliverable" };
  return { ok: true };
}

/**
 * Tell the operator a listing is waiting for review (audit I10).
 *
 * The review queue is the whole trust story, and it only works if someone
 * looks at it: a draft submitted on a Friday and approved on a Tuesday is a
 * publisher who assumes the portal is dead. Best-effort by construction — the
 * row is already `pending_review`, and /admin badges the count regardless of
 * whether any provider is configured.
 */
async function alertReviewSubmitted(
  draftId: number,
  verified: boolean,
): Promise<void> {
  const [row] = await db
    .select({ title: listings.title })
    .from(listings)
    .where(eq(listings.id, draftId))
    .limit(1);
  await alertOperator({
    kind: "review_submitted",
    title: esPanel.alertReviewTitle,
    detail: esPanel.alertReviewDetail(row?.title ?? String(draftId), verified),
    url: `${await siteOrigin()}/admin`,
  });
}

export type PublishResult =
  | { ok: true }
  | {
      ok: false;
      error: "invalid_number" | "otp" | "too_many" | "not_found" | "otp_required";
    };

/**
 * Verify the OTP and submit the draft for review (draft → pending_review). On
 * success the publisher's WhatsApp is recorded and stamped verified, and the
 * listing carries the verified-publisher flag (the ✓ badge basis).
 *
 * Requires a messaging provider by definition — a code cannot be verified if it
 * could never be sent. Without one the wizard calls publishDraftAction instead.
 */
export async function verifyAndPublishAction(params: {
  draftId: number;
  whatsapp: string;
  code: string;
}): Promise<PublishResult> {
  const user = await requireUser("/publicar");
  if (!isMessagingConfigured()) return { ok: false, error: "otp_required" };

  const whatsapp = canonPhone(params.whatsapp);
  if (whatsapp.length < 9) return { ok: false, error: "invalid_number" };

  const verified = await verifyOtp(whatsapp, params.code);
  if (!verified.ok) {
    return { ok: false, error: verified.reason === "too_many" ? "too_many" : "otp" };
  }

  // Record the verified WhatsApp on the user (idempotent; unique in schema).
  await db
    .update(users)
    .set({ whatsapp, whatsappVerifiedAt: new Date() })
    .where(eq(users.id, user.id));

  const affected = await submitDraftForReview({
    userId: user.id,
    draftId: params.draftId,
    verified: true,
  });
  if (affected === 0) return { ok: false, error: "not_found" };
  await alertReviewSubmitted(params.draftId, true);
  return { ok: true };
}

/**
 * Publish without phone verification, for the case where no messaging provider
 * is configured and an OTP could never arrive.
 *
 * This is not a weaker door than it looks. /publicar already requires a login,
 * and since /registro exists that login is a real account with a password; the
 * draft is scoped to `owner_user_id`, so a publisher can only submit their own.
 * The listing still lands in `pending_review` and a human approves it. What is
 * genuinely missing is proof the *phone number* is real, so the row is NOT
 * flagged verified — the ✓ badge stays something you grant deliberately.
 *
 * The guard is server-side: if messaging IS configured, this refuses and the
 * OTP path is the only way through. A client cannot opt out of verification.
 */
export async function publishDraftAction(params: {
  draftId: number;
  whatsapp?: string;
}): Promise<PublishResult> {
  const user = await requireUser("/publicar");
  if (isMessagingConfigured()) return { ok: false, error: "otp_required" };

  // Keep the number if given — the agency still needs to be reachable — but
  // record it as unverified.
  const whatsapp = params.whatsapp ? canonPhone(params.whatsapp) : "";
  if (whatsapp.length >= 9) {
    await db.update(users).set({ whatsapp }).where(eq(users.id, user.id));
  }

  const affected = await submitDraftForReview({
    userId: user.id,
    draftId: params.draftId,
    verified: false,
  });
  if (affected === 0) return { ok: false, error: "not_found" };
  await alertReviewSubmitted(params.draftId, false);
  return { ok: true };
}
