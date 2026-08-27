/**
 * Route guards for the panel (ARCHITECTURE.md §1). These run in the Node
 * runtime (server components / server actions) and are the authoritative
 * access check — every server action re-invokes its guard rather than trusting
 * anything from the client. Edge middleware never gates these routes because it
 * can't reach MySQL.
 */
import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { getSessionUser, type SessionUser } from "./session";
import { isAgencyRole, isSuperAdmin } from "./roles";
import type { EditScope } from "@/lib/listing-edit";

/** Where a logged-in user belongs by role — used for post-login and 403 bounces. */
export function homeForRole(user: SessionUser): string {
  if (isSuperAdmin(user.role)) return "/admin";
  if (isAgencyRole(user.role)) return "/agencia";
  // A consumer account exists because somebody published a property; their
  // own avisos are the only panel they have (D8).
  return "/mis-avisos";
}

/** Any authenticated user, or bounce to /login (optionally preserving a target). */
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return user;
}

/** Super-admin only (/admin). Authenticated non-admins go to their own home. */
export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fadmin");
  if (!isSuperAdmin(user.role)) redirect(homeForRole(user));
  return user;
}

export interface AgencyContext {
  user: SessionUser;
  /** NULL when the user's role is agency/agent but no agencies row is linked yet. */
  agencyId: number | null;
}

/**
 * Agency-scoped access (/agencia). Requires an agency/agent role and resolves
 * which agency the user belongs to via agents.user_id (idx_user). The agencyId
 * is the ONLY scope every downstream query trusts — pages never read an agency
 * id from the URL or the request body.
 */
export async function requireAgencyContext(): Promise<AgencyContext> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fagencia");
  if (isSuperAdmin(user.role)) redirect("/admin");
  if (!isAgencyRole(user.role)) redirect(homeForRole(user));

  const [row] = await db
    .select({ agencyId: agents.agencyId })
    .from(agents)
    .where(eq(agents.userId, user.id))
    .limit(1);

  return { user, agencyId: row?.agencyId ?? null };
}

/**
 * The scope every /agencia query and mutation runs under.
 *
 * An agency account is scoped to its agency, so colleagues share one inbox and
 * one set of listings. An independent agent has no agencies row at all — their
 * claim is `owner_user_id`, the same scope the publish wizard uses — and
 * without this fallback they would log in to an empty panel and be unable to
 * edit the listings they just published.
 */
/**
 * May this caller manage the agency's team (/agencia/equipo)?
 *
 * "Responsable de la inmobiliaria" is not a new column: it is `users.role ===
 * "agency_admin"` on an account that actually belongs to an agency. Both halves
 * matter — an agency_admin with no agencies row (an independent who registered
 * as a company that was later unlinked) has no team to manage.
 *
 * The page and every team action re-check this themselves; this exists so the
 * nav and the UI agree with them instead of guessing.
 */
export function canManageTeam(ctx: AgencyContext): boolean {
  return ctx.user.role === "agency_admin" && ctx.agencyId != null;
}

/**
 * Owner-scoped access (/mis-avisos) — the FSBO seller's panel (PLAN.md D8).
 *
 * Deliberately NOT an agency role check. A private seller is not a
 * professional: they get no `agents` row, no /agente/[slug] profile and none
 * of the trust signals that come with one (CLAUDE.md, FSBO loop). What they
 * get is a scope, `owner_user_id`, which is the same claim /publicar already
 * writes and the same one listingScopeWhere() has always understood.
 *
 * Staff surfaces win when a user has one: an agency account or an independent
 * agent already has the richer /agencia panel over the very same rows, so
 * sending them here too would be two doors onto one inbox.
 */
export async function requireOwnerContext(): Promise<{
  user: SessionUser;
  scope: EditScope;
}> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fmis-avisos");
  if (isSuperAdmin(user.role)) redirect("/admin");
  if (isAgencyRole(user.role)) redirect("/agencia");
  return { user, scope: { kind: "owner", userId: user.id } };
}

export function panelScope(ctx: AgencyContext): EditScope {
  return ctx.agencyId != null
    ? { kind: "agency", agencyId: ctx.agencyId }
    : { kind: "owner", userId: ctx.user.id };
}
