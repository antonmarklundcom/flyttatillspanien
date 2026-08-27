"use server";

/**
 * Publish-wizard server actions. These run in the Node runtime and are the
 * trust boundary: the client supplies field values, but every action
 * re-resolves the caller from the session (requireUser), re-derives the
 * agency scope server-side, and validates the payload here. The client is
 * never trusted for identity, ownership, or the verified flag.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, listings, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { alertOperator, getCrm, isMessagingConfigured } from "@/lib/crm";
import {
  OPERATIONS,
  PROPERTY_TYPES,
  type Operation,
  type PropertyType,
} from "@/lib/import/types";
import { svPanel } from "@/i18n/sv";
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
  priceEur?: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parking?: number | null;
  builtM2?: number | null;
  plotM2?: number | null;
  locationId?: number;
  projectId?: number | null;
  videoUrl?: string;
  referenciaCatastral?: string | null;
  energyRating?: string | null;
  legalStatus?: string | null;
  chargesStatus?: string | null;
  ibiAnnualEur?: number | null;
  communityMonthlyEur?: number | null;
  isVpo?: boolean;
  landClassification?: string | null;
  buildableM2?: number | null;
}

function posIntOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function posNumOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
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
  const priceEur = Number(payload.priceEur);
  const locationId = Number(payload.locationId);

  if (!OPERATIONS.includes(operation)) return { ok: false, error: "operation" };
  if (!PROPERTY_TYPES.includes(propertyType))
    return { ok: false, error: "propertyType" };
  if (title.length < 8) return { ok: false, error: "title" };
  if (!Number.isFinite(priceEur) || priceEur <= 0)
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
      priceEur,
      bedrooms: posIntOrNull(payload.bedrooms),
      bathrooms: posIntOrNull(payload.bathrooms),
      parking: posIntOrNull(payload.parking),
      builtM2: posNumOrNull(payload.builtM2),
      plotM2: posNumOrNull(payload.plotM2),
      locationId,
      projectId: posIntOrNull(payload.projectId) || null,
      videoUrl: String(payload.videoUrl ?? "").trim().slice(0, 500) || null,
      referenciaCatastral: payload.referenciaCatastral?.trim() || null,
      energyRating: payload.energyRating as never,
      legalStatus: payload.legalStatus as never,
      chargesStatus: payload.chargesStatus as never,
      ibiAnnualEur: posNumOrNull(payload.ibiAnnualEur),
      communityMonthlyEur: posNumOrNull(payload.communityMonthlyEur),
      isVpo: Boolean(payload.isVpo),
      landClassification: payload.landClassification as never,
      buildableM2: posNumOrNull(payload.buildableM2),
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
 * Issue and deliver an email OTP for the publisher's address. Only reachable
 * when a messaging provider exists — see publishDraftAction for the path that
 * runs when none does. Sweden is email-first (docs/SPAIN-PORTAL-DESIGN.md
 * §3.7), unlike the inherited WhatsApp-first flow.
 */
export async function requestOtpAction(
  rawEmail: string,
): Promise<RequestOtpResult> {
  await requireUser("/publicar");
  const email = rawEmail.trim().toLowerCase();
  if (!email.includes("@")) return { ok: false, error: "invalid_number" };

  if (!isMessagingConfigured()) return { ok: false, error: "undeliverable" };

  const created = await createOtp(email);
  if (!created.ok)
    return { ok: false, error: "cooldown", cooldownMs: created.cooldownMs };

  // A provider that fails to deliver must not look like a sent code.
  const sent = await getCrm().sendOtp(email, created.code);
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
    title: svPanel.alertReviewTitle,
    detail: svPanel.alertReviewDetail(row?.title ?? String(draftId), verified),
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
 * success the publisher's email is recorded and stamped verified, and the
 * listing carries the verified-publisher flag (the ✓ badge basis).
 *
 * Requires a messaging provider by definition — a code cannot be verified if it
 * could never be sent. Without one the wizard calls publishDraftAction instead.
 */
export async function verifyAndPublishAction(params: {
  draftId: number;
  email: string;
  code: string;
}): Promise<PublishResult> {
  const user = await requireUser("/publicar");
  if (!isMessagingConfigured()) return { ok: false, error: "otp_required" };

  const email = params.email.trim().toLowerCase();
  if (!email.includes("@")) return { ok: false, error: "invalid_number" };

  const verified = await verifyOtp(email, params.code);
  if (!verified.ok) {
    return { ok: false, error: verified.reason === "too_many" ? "too_many" : "otp" };
  }

  // Record the verified email on the user (idempotent; unique in schema).
  await db
    .update(users)
    .set({ email, emailVerifiedAt: new Date() })
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
 * Publish without email verification, for the case where no messaging
 * provider is configured and an OTP could never arrive.
 *
 * This is not a weaker door than it looks. /publicar already requires a login,
 * and since /registro exists that login is a real account with a password; the
 * draft is scoped to `owner_user_id`, so a publisher can only submit their own.
 * The listing still lands in `pending_review` and a human approves it. What is
 * genuinely missing is proof the *email address* is real, so the row is NOT
 * flagged verified — the ✓ badge stays something you grant deliberately.
 *
 * The guard is server-side: if messaging IS configured, this refuses and the
 * OTP path is the only way through. A client cannot opt out of verification.
 */
export async function publishDraftAction(params: {
  draftId: number;
}): Promise<PublishResult> {
  const user = await requireUser("/publicar");
  if (isMessagingConfigured()) return { ok: false, error: "otp_required" };

  const affected = await submitDraftForReview({
    userId: user.id,
    draftId: params.draftId,
    verified: false,
  });
  if (affected === 0) return { ok: false, error: "not_found" };
  await alertReviewSubmitted(params.draftId, false);
  return { ok: true };
}
