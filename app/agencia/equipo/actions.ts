"use server";

/**
 * Team actions for /agencia/equipo.
 *
 * Every one of them re-resolves the caller with requireAgencyContext() and
 * re-checks the `agency_admin` role — the page hiding a button is a courtesy,
 * not a permission. The agency id is never read from the form, so a forged
 * userId can only ever address somebody inside the caller's own agency, and
 * matches nothing otherwise.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAgencyContext } from "@/lib/auth/guards";
import {
  createAgencyInvite,
  revokeAgencyInvite,
  type InviteRole,
} from "@/lib/agency-invites";
import {
  removeTeamMember,
  setTeamMemberRole,
  type TeamRole,
} from "@/lib/team-queries";

const ROUTE = "/agencia/equipo";

function done(code: string): never {
  revalidatePath(ROUTE);
  redirect(`${ROUTE}?msg=${code}`);
}

function toId(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

function toRole(v: FormDataEntryValue | null): TeamRole {
  return String(v ?? "") === "agency_admin" ? "agency_admin" : "agent";
}

/**
 * The gate every action here starts with: an agency_admin with an agency.
 * An `agent` who posts to these actions is refused, not silently obeyed.
 */
async function requireTeamAdmin(): Promise<{ userId: number; agencyId: number }> {
  const { user, agencyId } = await requireAgencyContext();
  if (user.role !== "agency_admin" || agencyId == null) done("forbidden");
  return { userId: user.id, agencyId };
}

export async function createInviteAction(formData: FormData): Promise<void> {
  const { userId, agencyId } = await requireTeamAdmin();

  // Only an agency_admin reaches this line, so an agency_admin invitation is
  // allowed here by construction — an `agent` cannot mint one because they
  // cannot get past requireTeamAdmin().
  const role: InviteRole = toRole(formData.get("role"));

  await createAgencyInvite({ agencyId, invitedByUserId: userId, role });
  done("invite_created");
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  const { agencyId } = await requireTeamAdmin();

  const inviteId = toId(formData.get("inviteId"));
  if (!inviteId) done("invalid");

  const ok = await revokeAgencyInvite({ inviteId, agencyId });
  done(ok ? "invite_revoked" : "invalid");
}

export async function setMemberRoleAction(formData: FormData): Promise<void> {
  const { userId, agencyId } = await requireTeamAdmin();

  const targetUserId = toId(formData.get("userId"));
  if (!targetUserId) done("invalid");
  // Demoting yourself is how the last admin locks the whole agency out; the
  // count guard below catches that case anyway, but this keeps the message
  // honest when there are other admins around.
  if (targetUserId === userId) done("self_role");

  const result = await setTeamMemberRole({
    agencyId,
    targetUserId,
    role: toRole(formData.get("role")),
  });

  done(
    result === "ok"
      ? "role_saved"
      : result === "last_admin"
        ? "last_admin"
        : "invalid",
  );
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const { userId, agencyId } = await requireTeamAdmin();

  const targetUserId = toId(formData.get("userId"));
  if (!targetUserId) done("invalid");
  if (targetUserId === userId) done("self_remove");

  const result = await removeTeamMember({ agencyId, targetUserId });

  done(
    result === "ok"
      ? "member_removed"
      : result === "last_admin"
        ? "last_admin"
        : "invalid",
  );
}
