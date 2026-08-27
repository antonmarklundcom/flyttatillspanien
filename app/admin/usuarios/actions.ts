"use server";

/**
 * Super-admin user management actions. Same contract as the other panel
 * actions: every one re-checks requireSuperAdmin() before touching a row, and
 * the form is never trusted.
 *
 * Three lockout guards are enforced here rather than in the UI, because a
 * forged POST bypasses the UI entirely: you cannot change your own role, you
 * cannot delete your own account, and you cannot remove the last super-admin.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/guards";
import {
  countSuperAdmins,
  createPanelUser,
  deletePanelUser,
  linkUserToAgency,
  revokeUserSessions,
  updatePanelUser,
  type UserRoleValue,
} from "@/lib/panel-queries";

const ROUTE = "/admin/usuarios";

const ROLES: readonly UserRoleValue[] = [
  "consumer",
  "agent",
  "agency_admin",
  "developer",
  "admin",
];

function toId(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

function toRole(v: FormDataEntryValue | null): UserRoleValue | null {
  const s = String(v ?? "");
  return (ROLES as readonly string[]).includes(s) ? (s as UserRoleValue) : null;
}

function toLocale(v: FormDataEntryValue | null): "es" | "en" {
  return String(v ?? "") === "en" ? "en" : "es";
}

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

/** Bounce back to the page with a flash code in the query string. */
function done(code: string): never {
  revalidatePath(ROUTE);
  redirect(`${ROUTE}?msg=${code}`);
}

export async function createUserAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const email = str(formData.get("email"));
  const password = str(formData.get("password"));
  const role = toRole(formData.get("role"));
  if (!email || !password || !role) done("invalid");

  const id = await createPanelUser({
    name: str(formData.get("name")) || null,
    email,
    role,
    locale: toLocale(formData.get("locale")),
    password,
  });

  done(id ? "created" : "email_taken");
}

export async function updateUserAction(formData: FormData): Promise<void> {
  const me = await requireSuperAdmin();

  const id = toId(formData.get("userId"));
  const email = str(formData.get("email"));
  const role = toRole(formData.get("role"));
  if (!id || !email || !role) done("invalid");

  // Changing your own role is how an admin locks themselves out of /admin.
  if (id === me.id && role !== me.role) done("self_role");

  // Demoting the only remaining admin leaves nobody who can promote one back.
  if (role !== "admin" && (await countSuperAdmins()) <= 1) {
    done("last_admin");
  }

  const password = str(formData.get("password"));
  const ok = await updatePanelUser(id, {
    name: str(formData.get("name")) || null,
    email,
    role,
    locale: toLocale(formData.get("locale")),
    password: password || undefined,
  });

  if (!ok) done("email_taken");

  // A password change should not leave old cookies working elsewhere.
  if (password) {
    await revokeUserSessions(id);
    done("password_reset");
  }

  done("saved");
}

export async function deleteUserAction(formData: FormData): Promise<void> {
  const me = await requireSuperAdmin();

  const id = toId(formData.get("userId"));
  if (!id) done("invalid");
  if (id === me.id) done("self_delete");

  const role = toRole(formData.get("role"));
  if (role === "admin" && (await countSuperAdmins()) <= 1) done("last_admin");

  await deletePanelUser(id);
  done("deleted");
}

export async function linkAgencyAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const userId = toId(formData.get("userId"));
  if (!userId) done("invalid");

  const raw = str(formData.get("agencyId"));
  const agencyId = raw === "" ? null : toId(raw) || null;

  await linkUserToAgency({
    userId,
    agencyId,
    fallbackName: str(formData.get("name")) || str(formData.get("email")) || "Agente",
  });

  done("agency_linked");
}
