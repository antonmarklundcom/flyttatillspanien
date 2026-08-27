/**
 * The import template, served rather than committed as a static file so its
 * columns can only ever come from `TEMPLATE_COLUMNS` — a checked-in sample that
 * drifted from the parser would be worse than no sample at all.
 *
 * Behind the super-admin guard because it is a panel affordance, not public
 * documentation.
 */
import { requireSuperAdmin } from "@/lib/auth/guards";
import { templateCsv } from "@/lib/import/intake";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  await requireSuperAdmin();

  // Leading UTF-8 BOM so Excel on Windows opens the accented sample text as
  // UTF-8 instead of showing "jardÃ­n". `readIntake` strips it on the way back
  // in, so the round trip is closed.
  return new Response(`﻿${templateCsv()}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="plantilla-avisos.csv"',
      "Cache-Control": "no-store",
    },
  });
}
