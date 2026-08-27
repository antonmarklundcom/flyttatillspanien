"use server";

/**
 * Super-admin: move an agent between inmobiliarias (or out to independent).
 *
 * Same lockout logic as the agency panel, from the other side — moveAgentToAgency()
 * refuses to pull the last agency_admin out of an agency, so no super-admin
 * action can leave an inmobiliaria without a responsable either. The rule lives
 * in team-queries.ts, not here, so both callers get it.
 */
import { revalidatePath } from "next/cache";
import { revalidateDirectory } from "@/lib/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { moveAgentToAgency, type TeamRole } from "@/lib/team-queries";

const ROUTE = "/admin/agentes";

function done(code: string): never {
  revalidatePath(ROUTE);
  revalidatePath("/admin/inmobiliarias");
  revalidateDirectory();
  redirect(`${ROUTE}?msg=${code}`);
}

function toId(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export async function moveAgentAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const agentId = toId(formData.get("agentId"));
  if (!agentId) done("invalid");

  const raw = String(formData.get("agencyId") ?? "").trim();
  const agencyId = raw === "" ? null : toId(raw) || null;
  const role: TeamRole =
    String(formData.get("role") ?? "") === "agency_admin"
      ? "agency_admin"
      : "agent";

  const result = await moveAgentToAgency({ agentId, agencyId, role });

  done(
    result === "ok"
      ? "agent_moved"
      : result === "last_admin"
        ? "last_admin"
        : result === "protected"
          ? "protected"
          : "invalid",
  );
}
