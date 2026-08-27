"use server";

/**
 * Super-admin agency creation. Same contract as the other panel actions: the
 * guard runs again here because a forged POST never touches the UI, and the
 * form fields are re-validated rather than trusted.
 *
 * The verify/unverify toggles for this page live in ../actions.ts alongside
 * the review queue; only the create form is here.
 */
import { revalidatePath } from "next/cache";
import { revalidateDirectory } from "@/lib/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { createPanelAgency, type AgencyRow } from "@/lib/panel-queries";

const ROUTE = "/admin/inmobiliarias";

const PLANS: readonly AgencyRow["plan"][] = ["free", "destacado", "partner"];

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

function toPlan(v: FormDataEntryValue | null): AgencyRow["plan"] {
  const s = str(v);
  return (PLANS as readonly string[]).includes(s)
    ? (s as AgencyRow["plan"])
    : "free";
}

/** Bounce back to the page with a flash code in the query string. */
function done(code: string): never {
  revalidatePath(ROUTE);
  revalidateDirectory();
  redirect(`${ROUTE}?msg=${code}`);
}

export async function createAgencyAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const name = str(formData.get("name"));
  if (name.length < 2) done("invalid");

  const id = await createPanelAgency({
    name,
    // Both columns are nullable and whatsapp is matched on elsewhere; a blank
    // string would be a fake value, so an empty field stays NULL.
    email: str(formData.get("email")).toLowerCase() || null,
    whatsapp: str(formData.get("whatsapp")) || null,
    plan: toPlan(formData.get("plan")),
  });

  done(id ? "agency_created" : "invalid");
}
