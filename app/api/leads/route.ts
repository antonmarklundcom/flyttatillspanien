/**
 * Lead capture (ARCHITECTURE.md §5). Order matters: record in MySQL first
 * (source of truth for the money report), THEN push to the CRM through the
 * crm.ts boundary. A CRM failure never loses the lead — it's already stored.
 *
 * **Email is required and the phone is optional**, the inverse of the shape
 * this endpoint was born with. A Swedish buyer fills in a form and expects an
 * email reply; being asked to WhatsApp a stranger about a €400 000 purchase
 * reads as unserious (design doc §3.7).
 */
import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leads, listings } from "@/db/schema";
import { alertOperator, getCrm, type LeadPayload } from "@/lib/crm";
import { listingUrl } from "@/lib/urls";
import { servedTitle } from "@/lib/listing-copy";
import { listingCanonicalOrigin, siteOrigin } from "@/lib/origin";
import { svPanel } from "@/i18n/sv";
import { clientIpFrom } from "@/lib/client-ip";
import { allowRequest } from "@/lib/rate-limit";
import { rawHostFrom } from "@/lib/host";
import { DEFAULT_VERTICAL_KEY } from "@/config/verticals";

const bodySchema = z.object({
  leadType: z.enum([
    "buyer",
    "renter",
    "seller",
    "valuation",
    "developer",
    "agent_signup",
  ]),
  listingPublicId: z.string().length(10).optional(),
  name: z.string().max(140).optional(),
  email: z.string().email().max(190),
  phone: z.string().min(6).max(30).optional(),
  message: z.string().max(2000).optional(),
  utm: z.record(z.string()).optional(),
});

/** 10 leads per IP per 10 minutes — far above a real buyer, far below a bot. */
const LEAD_MAX = 10;
const LEAD_WINDOW_MS = 10 * 60_000;

/**
 * The endpoint is intentionally unauthenticated — it is the public capture
 * form, and requiring a session would defeat it. What it was missing is
 * everything *else* that keeps an open endpoint from being free infrastructure
 * (audit F28): each accepted row also fires an outbound GHL webhook, so an
 * unthrottled POST loop is both a junk-lead flood in the panel and an
 * amplifier pointed at our own CRM quota.
 *
 * The Origin check is a cheap same-origin filter, not a security boundary: a
 * browser sets Origin on every cross-site POST and cannot forge it, so it
 * stops the drive-by embedded form. A script that sends no Origin at all is
 * left to the rate limit, which is the control that actually bounds the harm.
 */
function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser client; the rate limit is its bound
  try {
    return new URL(origin).host.replace(/^www\./, "") === rawHostFrom(req.headers);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // req.json() happily parses a body sent as text/plain, which is exactly the
  // content-type a cross-site form uses to dodge a CORS preflight.
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "invalid payload" },
      { status: 415 },
    );
  }

  const ip = clientIpFrom(req.headers);
  if (!allowRequest(`leads|${ip}`, LEAD_MAX, LEAD_WINDOW_MS)) {
    return NextResponse.json(
      { ok: false, error: "too many requests" },
      { status: 429, headers: { "retry-after": "600" } },
    );
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    // No `detail`: the zod error echoes the submitted payload and the schema
    // back to an unauthenticated caller (audit F28).
    return NextResponse.json(
      { ok: false, error: "invalid payload" },
      { status: 400 },
    );
  }

  const vertical = req.headers.get("x-vertical") ?? DEFAULT_VERTICAL_KEY;

  // Resolve listing context (for routing + CRM payload) if one was given.
  let listing: typeof listings.$inferSelect | null = null;
  if (parsed.listingPublicId) {
    const [row] = await db
      .select()
      .from(listings)
      .where(eq(listings.publicId, parsed.listingPublicId))
      .limit(1);
    listing = row ?? null;
  }

  /**
   * Same precedence as the detail page's seller card: agent, then agency, then
   * the private owner. `owner` exists so an FSBO lead is addressed to the
   * person actually waiting for it instead of landing in `internal` with the
   * valuation leads, invisible to them (PLAN.md D8).
   *
   * A lead with no listing at all stays `internal` — there is nobody else it
   * could belong to.
   */
  const routedTo: LeadPayload["routedTo"] = listing?.agentId
    ? "agent"
    : listing?.agencyId
      ? "agency"
      : listing?.ownerUserId
        ? "owner"
        : "internal";

  // 1. Record in MySQL first.
  const [res] = await db.insert(leads).values({
    leadType: parsed.leadType,
    vertical,
    listingId: listing?.id,
    projectId: listing?.projectId,
    name: parsed.name,
    email: parsed.email,
    phone: parsed.phone,
    message: parsed.message,
    utm: parsed.utm,
    routedTo,
  });
  const leadId = Number((res as unknown as { insertId: number }).insertId);

  // 2. Push to GHL (best effort — never blocks the stored lead).
  const payload: LeadPayload = {
    leadType: parsed.leadType,
    vertical,
    name: parsed.name,
    email: parsed.email,
    phone: parsed.phone,
    message: parsed.message,
    utm: parsed.utm,
    routedTo,
    listing: listing
      ? {
          publicId: listing.publicId,
          title: servedTitle(listing),
          url: `${await listingCanonicalOrigin()}${listingUrl(listing)}`,
          priceEur: Number(listing.priceEur),
          operation: listing.operation,
        }
      : undefined,
  };

  /**
   * Ping the operator (audit I10). A solo operator otherwise finds a lead by
   * opening /admin, and a lead found next week is a lead lost. It runs after
   * the response so a slow or dead webhook never becomes the visitor's wait,
   * and it is separate from the CRM push above: that one carries the record,
   * this one is "go look", and a downstream flow routes them differently.
   */
  const adminUrl = `${await siteOrigin()}/admin/leads`;
  after(() =>
    alertOperator({
      kind: "new_lead",
      title: svPanel.alertNewLeadTitle,
      detail: svPanel.alertNewLeadDetail({
        leadType: parsed.leadType,
        name: parsed.name ?? null,
        email: parsed.email,
        listingTitle: listing ? servedTitle(listing) : null,
      }),
      url: adminUrl,
    }),
  );

  const crmResult = await getCrm().pushLead(payload);
  if (crmResult.ok && crmResult.contactId) {
    await db
      .update(leads)
      .set({ ghlContactId: crmResult.contactId })
      .where(eq(leads.id, leadId));
  }

  return NextResponse.json({ ok: true, leadId, crm: crmResult.ok });
}
