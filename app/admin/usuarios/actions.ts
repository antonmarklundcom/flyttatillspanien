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
  type IdentityDocType,
  type UserLocaleValue,
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

const LOCALES: readonly UserLocaleValue[] = ["sv", "en", "es"];

const IDENTITY_DOC_TYPES: readonly IdentityDocType[] = [
  "nie",
  "dni",
  "passport",
  "personnummer",
];

function toId(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

function toRole(v: FormDataEntryValue | null): UserRoleValue | null {
  const s = String(v ?? "");
  return (ROLES as readonly string[]).includes(s) ? (s as UserRoleValue) : null;
}

/** `sv` is the site's own locale and the schema default — the fallback. */
function toLocale(v: FormDataEntryValue | null): UserLocaleValue {
  const s = String(v ?? "");
  return (LOCALES as readonly string[]).includes(s)
    ? (s as UserLocaleValue)
    : "sv";
}

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

/**
 * The identity block: operator-settable only (design doc §3.4), read here and
 * nowhere a lister's own form could reach. `identityDocType`/`identityRefLast4`
 * are blank → `null` (cleared); `identityVerifiedAt` has its own three-way
 * control (`identityVerifiedAction`) rather than a raw datetime field, since
 * "verified now" is the only write an operator should be able to make with one
 * click — see the form in usuarios/page.tsx.
 */
function identityFields(formData: FormData): {
  identityDocType: IdentityDocType | null;
  identityRefLast4: string | null;
} {
  const docType = str(formData.get("identityDocType"));
  return {
    identityDocType: (IDENTITY_DOC_TYPES as readonly string[]).includes(
      docType,
    )
      ? (docType as IdentityDocType)
      : null,
    identityRefLast4: str(formData.get("identityRefLast4")) || null,
  };
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
    ...identityFields(formData),
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
    ...identityFields(formData),
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

/**
 * `identity_verified_at` gets its own one-click action rather than a raw
 * datetime field on the main form, for the same reason `nota_simple_seen_at`
 * does in the listings panel (design doc §3.4): "verified now" is the only
 * write an operator sighting a document should be able to make, not an
 * arbitrary date they could backdate or forge.
 */
export async function identityVerifiedAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const userId = toId(formData.get("userId"));
  if (!userId) done("invalid");

  const email = str(formData.get("email"));
  const role = toRole(formData.get("role"));
  if (!email || !role) done("invalid");

  const clear = formData.get("op") === "clear";
  await updatePanelUser(userId, {
    name: str(formData.get("name")) || null,
    email,
    role,
    locale: toLocale(formData.get("locale")),
    identityVerifiedAt: clear ? null : new Date(),
  });

  done("identity_saved");
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
