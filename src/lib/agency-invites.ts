/**
 * Agency invitations — how an inmobiliaria adds a colleague without the founder
 * editing rows by hand.
 *
 * The whole design rests on one rule: **the token decides which agency and
 * which role**, never the form. The person accepting an invite never sends an
 * agency id or a role, exactly as public sign-up never sends a role
 * (lib/registration.ts). That keeps the single gate of the panel — an agency's
 * data is scoped on `agents.agency_id` (auth/guards.ts) — the only thing that
 * has to hold.
 *
 * Redemption is single-use and race-safe without a transaction: `consumeInvite`
 * is an UPDATE whose WHERE clause carries the precondition (`used_at IS NULL`)
 * and whose affectedRows tells the caller whether it won — the same pattern
 * `updateListing()` uses to prove a scoped row was hit (lib/listing-edit.ts).
 * Two people opening the same link at once means one insert, not two.
 */
import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { agencies, agencyInvites, users } from "@/db/schema";

/** Roles an invite may grant. Deliberately a subset of users.role. */
export type InviteRole = "agent" | "agency_admin";

/** A week: long enough to be handed over on WhatsApp, short enough to expire. */
export const INVITE_TTL_DAYS = 7;

export interface AgencyInvite {
  id: number;
  token: string;
  agencyId: number;
  agencyName: string;
  role: InviteRole;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

/** The URL an inviter copies. Relative — the caller prefixes the origin. */
export function invitePath(token: string): string {
  return `/registro?invite=${token}`;
}

/**
 * Mint an invite for an agency. The caller must already have checked that the
 * inviter belongs to `agencyId` and — for an `agency_admin` invite — that they
 * are an agency_admin themselves; this function is the storage, not the gate.
 */
export async function createAgencyInvite(params: {
  agencyId: number;
  invitedByUserId: number;
  role: InviteRole;
}): Promise<string> {
  // 32 random bytes = 64 hex chars. Not guessable, and it is the only secret
  // in the flow, so it is never derived from the agency or the invitee.
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(agencyInvites).values({
    token,
    agencyId: params.agencyId,
    invitedByUserId: params.invitedByUserId,
    role: params.role,
    expiresAt,
  });

  return token;
}

/**
 * Resolve a token that is still redeemable — exists, unused, unexpired — with
 * the agency's name, so the acceptance screen can show *who* is inviting before
 * anything is submitted. Returns null for every failure mode alike: a wrong
 * token and an expired one are indistinguishable from outside.
 */
export async function getUsableInvite(
  token: string,
): Promise<AgencyInvite | null> {
  // A malformed token can never match; skip the round trip.
  if (!/^[0-9a-f]{64}$/.test(token)) return null;

  const [row] = await db
    .select({
      id: agencyInvites.id,
      token: agencyInvites.token,
      agencyId: agencyInvites.agencyId,
      agencyName: agencies.name,
      role: agencyInvites.role,
      expiresAt: agencyInvites.expiresAt,
      usedAt: agencyInvites.usedAt,
      createdAt: agencyInvites.createdAt,
    })
    .from(agencyInvites)
    .innerJoin(agencies, eq(agencyInvites.agencyId, agencies.id))
    .where(
      and(
        eq(agencyInvites.token, token),
        isNull(agencyInvites.usedAt),
        gt(agencyInvites.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return row ?? null;
}

/**
 * Claim an invite. Returns true only for the caller that actually flipped the
 * row: `used_at IS NULL` lives in the WHERE clause, so a second concurrent
 * redemption affects 0 rows and is told the link is spent.
 *
 * Call this *before* creating anything the invite pays for, and treat false as
 * a hard stop.
 */
export async function consumeInvite(inviteId: number): Promise<boolean> {
  const [res] = await db
    .update(agencyInvites)
    .set({ usedAt: new Date() })
    .where(and(eq(agencyInvites.id, inviteId), isNull(agencyInvites.usedAt)));
  return res.affectedRows === 1;
}

/**
 * Record who redeemed an invite, once their user row exists. Best-effort
 * bookkeeping: the invite is already spent by consumeInvite(), so a failure
 * here cannot let it be used again.
 */
export async function stampInviteUser(
  inviteId: number,
  userId: number,
): Promise<void> {
  await db
    .update(agencyInvites)
    .set({ usedByUserId: userId })
    .where(eq(agencyInvites.id, inviteId));
}

export interface AgencyInviteRow {
  id: number;
  token: string;
  role: InviteRole;
  expiresAt: Date;
  usedAt: Date | null;
  usedByName: string | null;
  createdAt: Date;
}

/** This agency's invites, newest first — hits idx_agency_created. */
export async function listAgencyInvites(
  agencyId: number,
): Promise<AgencyInviteRow[]> {
  return db
    .select({
      id: agencyInvites.id,
      token: agencyInvites.token,
      role: agencyInvites.role,
      expiresAt: agencyInvites.expiresAt,
      usedAt: agencyInvites.usedAt,
      usedByName: users.name,
      createdAt: agencyInvites.createdAt,
    })
    .from(agencyInvites)
    .leftJoin(users, eq(agencyInvites.usedByUserId, users.id))
    .where(eq(agencyInvites.agencyId, agencyId))
    .orderBy(desc(agencyInvites.createdAt))
    .limit(50);
}

/**
 * Cancel an open invite. Scoped on agencyId in the WHERE clause so one agency
 * cannot revoke another's link, and on `used_at IS NULL` so a redeemed invite
 * is never rewritten. Marking it used is the revocation: the row stays as the
 * record that the link existed.
 */
export async function revokeAgencyInvite(params: {
  inviteId: number;
  agencyId: number;
}): Promise<boolean> {
  const [res] = await db
    .update(agencyInvites)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(agencyInvites.id, params.inviteId),
        eq(agencyInvites.agencyId, params.agencyId),
        isNull(agencyInvites.usedAt),
      ),
    );
  return res.affectedRows === 1;
}

/** Open invites for an agency — shown as a count next to the generator. */
export async function countOpenInvites(agencyId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(agencyInvites)
    .where(
      and(
        eq(agencyInvites.agencyId, agencyId),
        isNull(agencyInvites.usedAt),
        gt(agencyInvites.expiresAt, new Date()),
      ),
    );
  return Number(row?.n ?? 0);
}
