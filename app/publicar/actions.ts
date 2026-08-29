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
import { alertOperator, isMessagingConfigured, sendOtpEmail } from "@/lib/crm";
import {
  CHARGES_STATUSES,
  ENERGY_RATINGS,
  LEGAL_STATUSES,
  OPERATIONS,
  PROPERTY_TYPES,
  type ChargesStatus,
  type EnergyRating,
  type LegalStatus,
  type Operation,
  type PropertyType,
} from "@/lib/import/types";
import { servedTitle } from "@/lib/listing-copy";
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
  usableM2?: number | null;
  plotM2?: number | null;
  locationId?: number;
  projectId?: number | null;
  videoUrl?: string;
  /* The Spain legal block the wizard collects. */
  referenciaCatastral?: string;
  energyRating?: string;
  legalStatus?: string;
  chargesStatus?: string;
  ibiAnnualEur?: number | null;
  communityMonthlyEur?: number | null;
  touristLicence?: string;
}

/**
 * A client-supplied value narrowed to a known enum member, or null.
 *
 * Silently null rather than an error: this is a wizard field, and an
 * unrecognised value means a hand-built payload that should change nothing.
 * The two NOT NULL columns fall back to `desconocido` at the query layer,
 * which is the honest reading of "the lister did not say".
 */
function enumOrNull<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  const v = String(value ?? "").trim();
  return (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

/** A positive number from the client, or null. */
function posNumOrNull(v: unknown): number | null {
  const n = Number(v);
  return v != null && Number.isFinite(n) && n > 0 ? n : null;
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
      usableM2: posNumOrNull(payload.usableM2),
      plotM2: posNumOrNull(payload.plotM2),
      locationId,
      projectId: posIntOrNull(payload.projectId) || null,
      videoUrl: String(payload.videoUrl ?? "").trim().slice(0, 500) || null,
      /**
       * Only forwarded when the wizard actually carried the key. A field the
       * form did not ask about must not be written as "the seller cleared
       * it" — see draftFields() in publish-queries.ts.
       */
      ...("referenciaCatastral" in payload && {
        referenciaCatastral:
          String(payload.referenciaCatastral ?? "").trim() || null,
      }),
      ...("energyRating" in payload && {
        energyRating: enumOrNull<EnergyRating>(
          payload.energyRating,
          ENERGY_RATINGS,
        ),
      }),
      ...("legalStatus" in payload && {
        legalStatus:
          enumOrNull<LegalStatus>(payload.legalStatus, LEGAL_STATUSES) ??
          "desconocido",
      }),
      ...("chargesStatus" in payload && {
        chargesStatus:
          enumOrNull<ChargesStatus>(payload.chargesStatus, CHARGES_STATUSES) ??
          "desconocido",
      }),
      ...("ibiAnnualEur" in payload && {
        ibiAnnualEur: posNumOrNull(payload.ibiAnnualEur),
      }),
      ...("communityMonthlyEur" in payload && {
        communityMonthlyEur: posNumOrNull(payload.communityMonthlyEur),
      }),
      ...("touristLicence" in payload && {
        touristLicence: String(payload.touristLicence ?? "").trim() || null,
      }),
      /**
       * `nota_simple_seen_at` is not in `DraftPayload` and must never be: it
       * is the portal's attestation that a charges search was sighted, and a
       * lister setting it about their own property is the one thing it must
       * not be able to mean.
       */
    },
  });

  if (draftId === 0) return { ok: false, error: "not_found" };
  return { ok: true, draftId };
}

export type RequestOtpResult =
  | { ok: true }
  | {
      ok: false;
      error: "invalid_email" | "cooldown" | "undeliverable";
      cooldownMs?: number;
    };

/**
 * Issue and deliver a login code to the publisher's own email address.
 *
 * The address is NOT taken from the client. It is the account's — the session
 * already identifies the publisher, and letting the wizard name a destination
 * would turn this into an open mail relay that sends a six-digit code to any
 * address a script asks for.
 *
 * Only reachable when mail can actually be delivered — see publishDraftAction
 * for the path that runs when it cannot.
 */
export async function requestOtpAction(): Promise<RequestOtpResult> {
  const user = await requireUser("/publicar");
  const email = user.email.trim();

  if (!isMessagingConfigured()) return { ok: false, error: "undeliverable" };

  const created = await createOtp(email);
  if (!created.ok)
    return { ok: false, error: "cooldown", cooldownMs: created.cooldownMs };

  // A transport that failed to deliver must not look like a sent code.
  const sent = await sendOtpEmail(email, created.code);
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
    .select({
      title: listings.title,
      titleSv: listings.titleSv,
      sourceLang: listings.sourceLang,
    })
    .from(listings)
    .where(eq(listings.id, draftId))
    .limit(1);
  await alertOperator({
    kind: "review_submitted",
    title: svPanel.alertReviewTitle,
    detail: svPanel.alertReviewDetail(
      row ? servedTitle(row) : String(draftId),
      verified,
    ),
    url: `${await siteOrigin()}/admin`,
  });
}

export type PublishResult =
  | { ok: true }
  | {
      ok: false;
      error: "invalid_email" | "otp" | "too_many" | "not_found" | "otp_required";
    };

/**
 * Verify the code and submit the draft for review (draft → pending_review). On
 * success the publisher's email is stamped verified and the listing carries
 * the verified-publisher flag (the ✓ badge basis).
 *
 * Requires a mail transport by definition — a code cannot be verified if it
 * could never be sent. Without one the wizard calls publishDraftAction instead.
 */
export async function verifyAndPublishAction(params: {
  draftId: number;
  code: string;
}): Promise<PublishResult> {
  const user = await requireUser("/publicar");
  if (!isMessagingConfigured()) return { ok: false, error: "otp_required" };

  // Same address the code was sent to, and for the same reason: the session
  // decides who this is, never the payload.
  const email = user.email.trim();

  const verified = await verifyOtp(email, params.code);
  if (!verified.ok) {
    return { ok: false, error: verified.reason === "too_many" ? "too_many" : "otp" };
  }

  // The address is already on the row (it is the account identity); what this
  // proves is that the person holding the session can read that inbox.
  await db
    .update(users)
    .set({ emailVerifiedAt: new Date() })
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
 * Publish without email verification, for the case where no mail transport is
 * configured and a code could never arrive.
 *
 * This is not a weaker door than it looks. /publicar already requires a login,
 * and since /registro exists that login is a real account with a password; the
 * draft is scoped to `owner_user_id`, so a publisher can only submit their own.
 * The listing still lands in `pending_review` and a human approves it. What is
 * genuinely missing is proof the person holds the *inbox*, so the row is NOT
 * flagged verified — the ✓ badge stays something you grant deliberately.
 *
 * The guard is server-side: if mail IS configured, this refuses and the code
 * path is the only way through. A client cannot opt out of verification.
 */
export async function publishDraftAction(params: {
  draftId: number;
  /** Optional callback number — the lister stays reachable, unverified. */
  phone?: string;
}): Promise<PublishResult> {
  const user = await requireUser("/publicar");
  if (isMessagingConfigured()) return { ok: false, error: "otp_required" };

  const phone = params.phone?.trim();
  if (phone) {
    await db
      .update(users)
      .set({ phone: phone.slice(0, 30) })
      .where(eq(users.id, user.id));
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
