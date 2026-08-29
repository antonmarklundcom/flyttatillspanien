/**
 * Panel data access (admin review queue + agency dashboard). Same rules as
 * src/lib/queries.ts: typed selects, filtering only on indexed scalar columns,
 * no MySQL-only cleverness. Writes are scoped in the WHERE clause so an agency
 * can never mutate a row it doesn't own — the agencyId comes from the session
 * (guards.ts), never from the request.
 */
import { and, desc, eq, inArray, isNull, like, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  agencies,
  agents,
  leads,
  listings,
  locations,
  sessions,
  users,
} from "@/db/schema";
import { uniqueAgencySlug } from "@/lib/agency-slug";
import { hashPassword } from "@/lib/auth/password";
import { slugify } from "@/lib/slug";
import { listingScopeWhere, maySetStatus, type EditScope } from "@/lib/listing-edit";
import { canPublish } from "@/lib/publish-gate";
import { containsPattern } from "@/lib/sql-like";

export type ListingStatus = (typeof listings.$inferSelect)["status"];

/* ------------------------------------------------------------------ */
/* Super-admin: review queue                                           */
/* ------------------------------------------------------------------ */

export interface ReviewRow {
  id: number;
  publicId: string;
  slug: string;
  title: string;
  operation: (typeof listings.$inferSelect)["operation"];
  propertyType: (typeof listings.$inferSelect)["propertyType"];
  priceEur: string;
  createdAt: Date;
  /**
   * Read here so the review queue can show at a glance which rows the publish
   * gate would refuse — approving one and getting a silent no-op is worse than
   * seeing why beforehand (publish-gate.ts).
   */
  energyRating: (typeof listings.$inferSelect)["energyRating"];
  agencyName: string | null;
  locationName: string | null;
}

/** Listings awaiting review, oldest first. Hits idx_search on the status prefix. */
export async function getReviewQueue(): Promise<ReviewRow[]> {
  return db
    .select({
      id: listings.id,
      publicId: listings.publicId,
      slug: listings.slug,
      title: listings.title,
      operation: listings.operation,
      propertyType: listings.propertyType,
      priceEur: listings.priceEur,
      createdAt: listings.createdAt,
      energyRating: listings.energyRating,
      agencyName: agencies.name,
      locationName: locations.name,
    })
    .from(listings)
    .leftJoin(agencies, eq(listings.agencyId, agencies.id))
    .leftJoin(locations, eq(listings.locationId, locations.id))
    .where(eq(listings.status, "pending_review"))
    .orderBy(listings.createdAt);
}

/** How many listings are waiting — the /admin nav badge, on every panel page. */
export async function countReviewQueue(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(listings)
    .where(eq(listings.status, "pending_review"));
  return Number(row?.n ?? 0);
}

/**
 * Leads captured in the last `hours` — the badge on the /admin Consultas tab.
 *
 * The zero-config half of the operator notification (audit I10): an outbound
 * ping needs `LEAD_WEBHOOK_URL`, this needs nothing, so the founder always has
 * one signal that something arrived. Deliberately "recent", not "unread":
 * read-state would be a column on `leads` and a schema change, and a rolling
 * window is honest about what it counts.
 *
 * One COUNT on idx_created (leads.created_at), so it stays cheap enough to run
 * on every admin page render.
 */
export async function countRecentLeads(hours = 24): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(leads)
    .where(sql`${leads.createdAt} >= now() - interval ${sql.raw(String(Math.max(1, Math.floor(hours))))} hour`);
  return Number(row?.n ?? 0);
}

/** Approve a pending listing → published. Scoped to pending_review so it can't
 * resurrect a removed/sold row. Returns rows affected (0 = nothing to do). */
export async function approveListing(id: number): Promise<number> {
  const [res] = await db
    .update(listings)
    .set({
      status: "published",
      // FIRST publish only. Approving a listing that was published before (it
      // went back through review after an edit) must not re-date it: that
      // pushes unchanged content back to the top of `published_at desc` and
      // moves its sitemap lastmod. COALESCE instead of a read-then-write so
      // there is no extra round-trip and no race between the two.
      publishedAt: sql`coalesce(${listings.publishedAt}, now())`,
      reviewNotes: null,
    })
    .where(and(eq(listings.id, id), eq(listings.status, "pending_review")));
  return res.affectedRows;
}

/** Reject a pending listing → removed, recording the reason on the row. */
export async function rejectListing(id: number, reason: string): Promise<number> {
  const [res] = await db
    .update(listings)
    .set({ status: "removed", reviewNotes: reason.slice(0, 280) })
    .where(and(eq(listings.id, id), eq(listings.status, "pending_review")));
  return res.affectedRows;
}

/* ------------------------------------------------------------------ */
/* Super-admin: agency / agent management                              */
/* ------------------------------------------------------------------ */

export interface AgencyRow {
  id: number;
  name: string;
  slug: string;
  /**
   * Which of the three lister types this is. A `relocation` agency represents
   * the BUYER and earns from the introduction, so every surface that renders
   * an agency name has to be able to say so rather than blur it into
   * "byrå" — which is why the value rides along with the name everywhere,
   * not just on the profile page.
   */
  kind: (typeof agencies.$inferSelect)["kind"];
  phone: string | null;
  email: string | null;
  isVerified: boolean;
  plan: (typeof agencies.$inferSelect)["plan"];
}

export async function listAgencies(): Promise<AgencyRow[]> {
  return db
    .select({
      id: agencies.id,
      name: agencies.name,
      slug: agencies.slug,
      kind: agencies.kind,
      phone: agencies.phone,
      email: agencies.email,
      isVerified: agencies.isVerified,
      plan: agencies.plan,
    })
    .from(agencies)
    .orderBy(agencies.name);
}

export interface AgentRow {
  id: number;
  name: string;
  slug: string;
  phone: string | null;
  isVerified: boolean;
  agencyName: string | null;
  /** The agent's agency kind, so the directory can label a relocation partner. */
  agencyKind: (typeof agencies.$inferSelect)["kind"] | null;
}

export async function listAgents(): Promise<AgentRow[]> {
  return db
    .select({
      id: agents.id,
      name: agents.name,
      slug: agents.slug,
      phone: agents.phone,
      isVerified: agents.isVerified,
      agencyName: agencies.name,
      agencyKind: agencies.kind,
    })
    .from(agents)
    .leftJoin(agencies, eq(agents.agencyId, agencies.id))
    .orderBy(agents.name);
}

export interface CreateAgencyInput {
  name: string;
  email: string | null;
  phone: string | null;
  plan: AgencyRow["plan"];
  /** Defaults to `inmobiliaria`, the overwhelmingly common case. */
  kind?: AgencyRow["kind"];
}

/**
 * Create an agency from the admin panel — the white-glove counterpart to
 * public self-registration, for inmobiliarias the founder onboards himself.
 *
 * Deliberately the same trust level as a self-registered one: `is_verified`
 * starts false, and the ✓ badge only appears once you flip it with the toggle
 * on this page. Unlike registration this creates *no* login — the agency's
 * users are created and linked from /admin/usuarios.
 *
 * Returns the new id, or null if the insert produced no readable row.
 */
export async function createPanelAgency(
  input: CreateAgencyInput,
): Promise<number | null> {
  const slug = await uniqueAgencySlug(input.name);

  await db.insert(agencies).values({
    name: input.name,
    slug,
    email: input.email,
    phone: input.phone,
    plan: input.plan,
    kind: input.kind ?? "inmobiliaria",
    isVerified: false,
  });

  const [row] = await db
    .select({ id: agencies.id })
    .from(agencies)
    .where(eq(agencies.slug, slug))
    .limit(1);
  return row?.id ?? null;
}

export async function setAgencyVerified(id: number, verified: boolean): Promise<void> {
  await db
    .update(agencies)
    .set({ isVerified: verified })
    .where(eq(agencies.id, id));
}

export async function setAgentVerified(id: number, verified: boolean): Promise<void> {
  await db.update(agents).set({ isVerified: verified }).where(eq(agents.id, id));
}

/* ------------------------------------------------------------------ */
/* Super-admin: user management                                        */
/* ------------------------------------------------------------------ */

export type UserRoleValue = (typeof users.$inferSelect)["role"];
export type UserLocaleValue = (typeof users.$inferSelect)["locale"];
export type IdentityDocType = NonNullable<
  (typeof users.$inferSelect)["identityDocType"]
>;

export interface PanelUserRow {
  id: number;
  name: string | null;
  /** The identity here, and NOT NULL since the email-first flip (§3.7). */
  email: string;
  role: UserRoleValue;
  locale: UserLocaleValue;
  phone: string | null;
  hasPassword: boolean;
  createdAt: Date;
  /**
   * Identity verification, operator-set only. `identityRefLast4` is the last
   * four characters of the document and never the whole number — see the
   * schema's `users.identity_*` note on why the full NIE/DNI is deliberately
   * not a column. `identityVerifiedAt` NULL = unverified, which is the state
   * almost every private seller is in and must be rendered as such.
   */
  identityDocType: IdentityDocType | null;
  identityRefLast4: string | null;
  identityVerifiedAt: Date | null;
  /** Agency the user belongs to via agents.user_id — NULL when unlinked. */
  agencyId: number | null;
  agencyName: string | null;
}

/** Every panel user, newest first, with the agency their agents row points at. */
export async function listUsers(): Promise<PanelUserRow[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      locale: users.locale,
      phone: users.phone,
      passwordHash: users.passwordHash,
      createdAt: users.createdAt,
      identityDocType: users.identityDocType,
      identityRefLast4: users.identityRefLast4,
      identityVerifiedAt: users.identityVerifiedAt,
      agencyId: agents.agencyId,
      agencyName: agencies.name,
    })
    .from(users)
    .leftJoin(agents, eq(agents.userId, users.id))
    .leftJoin(agencies, eq(agents.agencyId, agencies.id))
    .orderBy(desc(users.createdAt));

  return rows.map(({ passwordHash, ...r }) => ({
    ...r,
    hasPassword: Boolean(passwordHash),
  }));
}

/** How many super-admins exist — used to refuse removing the last one. */
export async function countSuperAdmins(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.role, "admin"));
  return Number(row?.n ?? 0);
}

export interface UpsertUserInput {
  name: string | null;
  email: string;
  role: UserRoleValue;
  locale: UserLocaleValue;
  phone?: string | null;
  /** Omitted/empty on edit = keep the existing password. */
  password?: string;
  /**
   * Identity verification. **Operator-settable only**: these fields reach the
   * database through this admin path and no other — never from the publish
   * wizard, never from registration, never from a self-service profile form.
   * The whole value of `identity_verified_at` is that the person it describes
   * cannot set it, exactly like `listings.nota_simple_seen_at`.
   *
   * `undefined` leaves whatever is on the row; an explicit `null` clears it.
   */
  identityDocType?: IdentityDocType | null;
  identityRefLast4?: string | null;
  identityVerifiedAt?: Date | null;
}

/**
 * The last four characters, uppercased, or null. Longer input is truncated
 * from the END rather than rejected, because an operator pasting the whole
 * document number is the expected mistake and storing its tail is the intended
 * result — but the full number is never what lands in the column.
 */
function last4(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  return cleaned ? cleaned.slice(-4) : null;
}

/** The identity fields, shared by create and update. */
function identityPatch(input: UpsertUserInput) {
  const patch: Partial<typeof users.$inferInsert> = {};
  if (input.identityDocType !== undefined)
    patch.identityDocType = input.identityDocType;
  if (input.identityRefLast4 !== undefined)
    patch.identityRefLast4 = last4(input.identityRefLast4);
  if (input.identityVerifiedAt !== undefined)
    patch.identityVerifiedAt = input.identityVerifiedAt;
  return patch;
}

/** True when another user already owns this email (unique column). */
async function emailTaken(email: string, exceptId?: number): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      exceptId
        ? and(eq(users.email, email), ne(users.id, exceptId))
        : eq(users.email, email),
    )
    .limit(1);
  return rows.length > 0;
}

/** Create a panel user. Returns the new id, or null when the email is taken. */
export async function createPanelUser(
  input: UpsertUserInput & { password: string },
): Promise<number | null> {
  const email = input.email.trim().toLowerCase();
  if (await emailTaken(email)) return null;

  await db.insert(users).values({
    name: input.name,
    email,
    role: input.role,
    locale: input.locale,
    phone: input.phone?.trim() || null,
    passwordHash: await hashPassword(input.password),
    ...identityPatch(input),
  });

  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Update a user's profile fields, and optionally their password. Returns false
 * when the email collides with another account (the caller surfaces the error).
 */
export async function updatePanelUser(
  id: number,
  input: UpsertUserInput,
): Promise<boolean> {
  const email = input.email.trim().toLowerCase();
  if (await emailTaken(email, id)) return false;

  const patch: Partial<typeof users.$inferInsert> = {
    name: input.name,
    email,
    role: input.role,
    locale: input.locale,
    ...identityPatch(input),
  };
  if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
  if (input.password) patch.passwordHash = await hashPassword(input.password);

  await db.update(users).set(patch).where(eq(users.id, id));
  return true;
}

/**
 * Delete a user and every session they hold, so an open cookie cannot outlive
 * the account. Their `agents` row is kept but unlinked — the public profile and
 * its listings survive the login being removed.
 */
export async function deletePanelUser(id: number): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, id));
  await db.update(agents).set({ userId: null }).where(eq(agents.userId, id));
  await db.delete(users).where(eq(users.id, id));
}

/** Drop every session for a user — used after a password reset. */
export async function revokeUserSessions(id: number): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, id));
}

/**
 * Point a user's `agents` row at an agency (or NULL for independent), creating
 * the row on first link. This is the join `requireAgencyContext()` reads, and
 * it previously had to be made by hand in Drizzle Studio.
 */
export async function linkUserToAgency(params: {
  userId: number;
  agencyId: number | null;
  fallbackName: string;
}): Promise<void> {
  const [existing] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.userId, params.userId))
    .limit(1);

  if (existing) {
    await db
      .update(agents)
      .set({ agencyId: params.agencyId })
      .where(eq(agents.id, existing.id));
    return;
  }

  // Slugs are unique and never recomputed later — disambiguate with the user id.
  const base = slugify(params.fallbackName) || "agente";
  await db.insert(agents).values({
    agencyId: params.agencyId,
    userId: params.userId,
    name: params.fallbackName,
    slug: `${base}-${params.userId}`,
  });
}

/* ------------------------------------------------------------------ */
/* Agency dashboard: own listings + leads inbox                        */
/* ------------------------------------------------------------------ */

export interface AgencyListingRow {
  id: number;
  publicId: string;
  slug: string;
  title: string;
  status: ListingStatus;
  operation: (typeof listings.$inferSelect)["operation"];
  propertyType: (typeof listings.$inferSelect)["propertyType"];
  priceEur: string;
  updatedAt: Date;
  /** Rejection reason set by admin review (status "removed"), else null. */
  reviewNotes: string | null;
}

/** All of an agency's listings (every status), newest-touched first. Uses
 * idx_agency (agency_id, status) on the agency_id prefix. */
/**
 * The dashboard's own listings. Takes a scope rather than an agencyId because
 * an independent agent has no agencies row — see listingScopeWhere().
 */
export async function getPanelListings(
  scope: EditScope,
): Promise<AgencyListingRow[]> {
  const guard = listingScopeWhere(scope);
  return db
    .select({
      id: listings.id,
      publicId: listings.publicId,
      slug: listings.slug,
      title: listings.title,
      status: listings.status,
      operation: listings.operation,
      propertyType: listings.propertyType,
      priceEur: listings.priceEur,
      updatedAt: listings.updatedAt,
      reviewNotes: listings.reviewNotes,
    })
    .from(listings)
    .where(guard)
    .orderBy(desc(listings.updatedAt));
}

/** Status change scoped to the caller — the WHERE clause is the guard.
 * Returns rows affected (0 = not a listing this scope may touch). */
export async function setPanelListingStatus(params: {
  listingId: number;
  scope: EditScope;
  status: ListingStatus;
}): Promise<number> {
  /**
   * The permission gate lives here rather than in each action, so a new caller
   * cannot forget it (audit F1). `published` is admin-only; an agency submits
   * for review. Reading the current status first is what lets a row keep the
   * status it already has — see maySetStatus().
   */
  const [current] = await db
    .select({
      status: listings.status,
      energyRating: listings.energyRating,
    })
    .from(listings)
    .where(eq(listings.id, params.listingId))
    .limit(1);
  if (!maySetStatus(params.scope, current?.status, params.status)) return 0;

  /**
   * RD 390/2021: no energy rating, no advertisement. This is a status-only
   * transition, so unlike `updateListing()` there is no incoming value that
   * could supply the missing rating — the row as it stands is the row that
   * would be published. See publish-gate.ts.
   */
  if (params.status === "published" && !canPublish(current ?? {})) return 0;

  // FIRST publish stamps publishedAt so category ordering (idx_fresh) is sane —
  // and only the first. Un-pausing a listing is not a new listing, so COALESCE
  // keeps the original date rather than re-floating old inventory.
  const publishPatch =
    params.status === "published"
      ? { publishedAt: sql`coalesce(${listings.publishedAt}, now())` }
      : {};
  const guard = listingScopeWhere(params.scope);
  const [res] = await db
    .update(listings)
    .set({ status: params.status, ...publishPatch })
    .where(
      guard
        ? and(eq(listings.id, params.listingId), guard)
        : eq(listings.id, params.listingId),
    );
  return res.affectedRows;
}

export interface LeadRow {
  id: number;
  leadType: (typeof leads.$inferSelect)["leadType"];
  name: string | null;
  /** The required identity since the email-first flip. Was `whatsapp`. */
  email: string;
  phone: string | null;
  message: string | null;
  createdAt: Date;
  listingId: number | null;
  listingTitle: string | null;
  listingPublicId: string | null;
  listingSlug: string | null;
}

/**
 * Leads inbox for an agency: leads whose listing belongs to the agency (task
 * brief: "filtered by routedTo + their listing ids"). We resolve the agency's
 * listing ids first, then read leads on idx_listing. routedTo is constrained to
 * the agency/agent lanes so internal/developer leads never leak in.
 */
export interface AdminLeadRow extends LeadRow {
  vertical: string;
  routedTo: (typeof leads.$inferSelect)["routedTo"];
  agencyName: string | null;
  /**
   * The FSBO publisher behind a lead on a self-published listing.
   *
   * Resolving the owner here makes the founder's inbox say who the lead is
   * for, and gives a one-tap way to forward it (audit F4) — by email now, the
   * channel a Swedish private seller actually reads. This is a staff-only
   * surface, which is why the address may be selected here and deliberately
   * may not be on the public detail page (see `ListingOwner` in queries.ts).
   */
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
}

/**
 * Every lead the site captured, newest first — the super-admin view.
 *
 * Unscoped by design: this is the founder's own inbox, and it is the only
 * place a lead with `routed_to = 'internal'` (valuation and seller leads,
 * which belong to no agency) is visible at all. Optional filters narrow by
 * type and search name / email / phone.
 */
export async function listAllLeads(params: {
  type?: LeadRow["leadType"] | "all";
  q?: string;
  limit?: number;
}): Promise<AdminLeadRow[]> {
  const filters: SQL[] = [];
  if (params.type && params.type !== "all") {
    filters.push(eq(leads.leadType, params.type));
  }
  const q = params.q?.trim();
  if (q) {
    const term = containsPattern(q);
    const match = or(
      like(leads.name, term),
      like(leads.email, term),
      like(leads.phone, term),
    );
    if (match) filters.push(match);
  }

  return db
    .select({
      id: leads.id,
      leadType: leads.leadType,
      name: leads.name,
      email: leads.email,
      phone: leads.phone,
      message: leads.message,
      createdAt: leads.createdAt,
      listingId: leads.listingId,
      listingTitle: listings.title,
      listingPublicId: listings.publicId,
      listingSlug: listings.slug,
      vertical: leads.vertical,
      routedTo: leads.routedTo,
      agencyName: agencies.name,
      ownerName: users.name,
      ownerEmail: users.email,
      ownerPhone: users.phone,
    })
    .from(leads)
    .leftJoin(listings, eq(leads.listingId, listings.id))
    .leftJoin(agencies, eq(listings.agencyId, agencies.id))
    // Owner only when nobody professional owns the row — the same precedence
    // the detail page's contact chain uses.
    .leftJoin(
      users,
      and(
        eq(listings.ownerUserId, users.id),
        isNull(listings.agencyId),
        isNull(listings.agentId),
      ),
    )
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(leads.createdAt))
    .limit(params.limit ?? 300);
}

/** Lead counts per type for the admin filter chips — one GROUP BY, not one query each. */
export async function countLeadsByType(): Promise<Record<string, number>> {
  const rows = await db
    .select({ leadType: leads.leadType, n: sql<number>`count(*)` })
    .from(leads)
    .groupBy(leads.leadType);
  const out: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    const n = Number(r.n);
    out[r.leadType] = n;
    total += n;
  }
  out.all = total;
  return out;
}

export async function getPanelLeads(scope: EditScope): Promise<LeadRow[]> {
  // One join with the ownership predicate applied to the joined listing —
  // the previous shape read every owned listing id into Node first and then
  // sent them back as an IN(...) list, which grows with the agency's inventory.
  const guard = listingScopeWhere(scope);
  /**
   * The lanes a non-admin inbox may show. `owner` is the FSBO lane (D8) and is
   * safe to include for every scope precisely because `guard` is the real
   * check: an owner-routed lead sits on a listing with no agency, so an agency
   * scope's WHERE clause excludes it anyway. `internal` and `developer` stay
   * out — those are the founder's, and they belong to no panel.
   */
  const routed = inArray(leads.routedTo, ["agency", "agent", "owner"]);

  return db
    .select({
      id: leads.id,
      leadType: leads.leadType,
      name: leads.name,
      email: leads.email,
      phone: leads.phone,
      message: leads.message,
      createdAt: leads.createdAt,
      listingId: leads.listingId,
      listingTitle: listings.title,
      listingPublicId: listings.publicId,
      listingSlug: listings.slug,
    })
    .from(leads)
    // INNER join: a lead with no listing belongs to no agency panel.
    .innerJoin(listings, eq(leads.listingId, listings.id))
    .where(guard ? and(routed, guard) : routed)
    .orderBy(desc(leads.createdAt));
}
