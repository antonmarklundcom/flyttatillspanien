"use server";

/**
 * Profile actions for /agencia/perfil. Each one re-resolves the caller from the
 * session — the agency id is never read from the form, and the agency-record
 * action additionally requires the `agency_admin` role, so an agent inside the
 * agency who forges a POST is refused rather than silently allowed.
 */
import { revalidatePath } from "next/cache";
import { revalidateDirectory } from "@/lib/cache";
import { redirect } from "next/navigation";
import { requireAgencyContext } from "@/lib/auth/guards";
import { createSession } from "@/lib/auth/session";
import {
  updateAgencyProfile,
  updateOwnAccount,
  updateOwnAgentProfile,
} from "@/lib/profile-queries";

function finish(msg: string): never {
  revalidatePath("/agencia/perfil");
  revalidatePath("/agencia");
  revalidateDirectory();
  redirect(`/agencia/perfil?msg=${msg}`);
}

export async function updateAgencyProfileAction(
  formData: FormData,
): Promise<void> {
  const { user, agencyId } = await requireAgencyContext();
  // Only the company's own admin account may rename or re-contact it.
  if (user.role !== "agency_admin" || agencyId == null) finish("forbidden");

  const ok = await updateAgencyProfile(agencyId, {
    name: String(formData.get("name") ?? ""),
    logoUrl: String(formData.get("logoUrl") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    taxId: String(formData.get("taxId") ?? ""),
    taxIdCountry: String(formData.get("taxIdCountry") ?? ""),
  });
  finish(ok ? "agency_saved" : "invalid");
}

export async function updateAgentProfileAction(
  formData: FormData,
): Promise<void> {
  const { user } = await requireAgencyContext();

  const ok = await updateOwnAgentProfile(user.id, {
    name: String(formData.get("name") ?? ""),
    photoUrl: String(formData.get("photoUrl") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  });
  finish(ok ? "saved" : "invalid");
}

export async function updateAccountAction(formData: FormData): Promise<void> {
  const { user } = await requireAgencyContext();

  const result = await updateOwnAccount(user.id, {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    // Required by updateOwnAccount whenever the email or password moves
    // (audit F21) — a session alone must not be enough to take the account.
    currentPassword: String(formData.get("currentPassword") ?? ""),
  });

  if (!result.ok) {
    finish(
      result.error === "email_taken"
        ? "taken"
        : result.error === "bad_password"
          ? "bad_password"
          : "invalid",
    );
  }

  // The password change revoked every session, this one included — reissue so
  // the person who just changed it isn't bounced to the login screen.
  if (result.passwordChanged) {
    await createSession(user.id);
    finish("password");
  }
  finish("account_saved");
}
