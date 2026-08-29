"use server";

/**
 * Super-admin overrides for the two reference tables every price on the site
 * reads: the EUR/SEK rate and the per-comunidad acquisition costs. Both are
 * normally cron-written (`npm run cron:fx`, seeded once by
 * `seed-acquisition-costs.ts`); this is the in-process writer the design doc
 * calls out explicitly, so the operator is never blocked on a third-party
 * outage or a placeholder rate they have since verified. `revalidate*()` is
 * what makes the change visible immediately rather than at the end of the
 * TTL (`docs/SPAIN-PORTAL-DESIGN.md` §2).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { revalidateAcquisitionCosts, revalidateFx } from "@/lib/cache";
import { setManualFxRate, updateAcquisitionCost } from "@/lib/reference-queries";

const ROUTE = "/admin/referens";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

function done(code: string): never {
  revalidatePath(ROUTE);
  redirect(`${ROUTE}?msg=${code}`);
}

export async function adminSetFxRateAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const rate = Number(str(formData.get("rate")));
  const observedOn = str(formData.get("observedOn")) || undefined;

  const ok = await setManualFxRate({ rate, observedOn });
  if (!ok) done("fx_invalid");

  revalidateFx();
  done("fx_saved");
}

/** Blank/non-numeric → leave the column as it is (undefined skips the SET). */
function optNum(v: FormDataEntryValue | null): number | undefined {
  const s = str(v);
  const n = Number(s);
  return s && Number.isFinite(n) ? n : undefined;
}

export async function adminUpdateAcquisitionCostAction(
  formData: FormData,
): Promise<void> {
  await requireSuperAdmin();

  const region = str(formData.get("region"));
  if (!region) done("costs_invalid");

  const ok = await updateAcquisitionCost(region, {
    itpPct: optNum(formData.get("itpPct")),
    ivaPct: optNum(formData.get("ivaPct")),
    ajdPct: optNum(formData.get("ajdPct")),
    notaryPctEst: optNum(formData.get("notaryPctEst")),
    registryPctEst: optNum(formData.get("registryPctEst")),
    legalPctEst: optNum(formData.get("legalPctEst")),
    sourceUrl: str(formData.get("sourceUrl")) || null,
    active: formData.get("active") === "1",
  });
  if (!ok) done("costs_invalid");

  revalidateAcquisitionCosts();
  done("costs_saved");
}
