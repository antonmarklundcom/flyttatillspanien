"use server";

/**
 * Bulk import actions (super-admin only).
 *
 * Two steps, and the second one does not trust the first. The spreadsheet
 * travels to the browser and back between preview and commit — it is the
 * operator's own file, so nothing is leaked by that — but the commit step
 * re-decodes the bytes, re-parses them and re-plans from scratch. The preview
 * is a *view*, never an instruction: a tampered payload can only produce a
 * different import that the same validation had to accept.
 *
 * Everything writes through `planImport`/`commitImport`, so the counts an
 * operator approves are produced by the code that then runs.
 */
import { revalidatePath } from "next/cache";
import { revalidateListings } from "@/lib/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { agencies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/auth/guards";
import {
  IntakeError,
  readIntake,
  MAX_UPLOAD_BYTES,
  UPLOAD_SOURCES,
} from "@/lib/import/intake";
import {
  commitImport,
  planImport,
  reportFromCommitted,
  type PlannedRow,
} from "@/lib/import/upsert";
import {
  createImportJob,
  recordImportRows,
  rollbackImportJob,
} from "@/lib/import/jobs";
import type { ImportReport, ListingSource } from "@/lib/import/types";

const ROUTE = "/admin/importar";

export interface UploadPayload {
  filename: string;
  /** The file itself, base64 — see the note above on why it round-trips. */
  base64: string;
  agencyId: number | null;
  source: string;
  publish: boolean;
  permissionGranted: boolean;
  permissionGrantedBy: string;
  permissionNote: string;
}

export interface PreviewRow {
  rowNumber: number;
  outcome: string;
  title: string;
  reason: string | null;
}

export type DryRunResult =
  | {
      ok: true;
      report: ImportReport;
      totalRows: number;
      kind: "csv" | "xlsx";
      preview: PreviewRow[];
      unknownColumns: string[];
      missingRequired: string[];
      /** Rows carrying no contact phone, so no cross-source dedup is possible. */
      withoutDedupKey: number;
      agencyName: string | null;
    }
  | { ok: false; error: string };

export type CommitResult =
  | { ok: true; jobId: number; report: ImportReport }
  | { ok: false; error: string };

/* ------------------------------------------------------------------ */
/* Shared validation                                                   */
/* ------------------------------------------------------------------ */

interface Resolved {
  bytes: Buffer;
  source: ListingSource;
  agencyId: number | null;
  agencyName: string | null;
}

async function resolvePayload(payload: UploadPayload): Promise<Resolved> {
  const source = payload.source as ListingSource;
  if (!UPLOAD_SOURCES.includes(source))
    throw new IntakeError("Origen no válido.");

  let bytes: Buffer;
  try {
    bytes = Buffer.from(payload.base64, "base64");
  } catch {
    throw new IntakeError("No pudimos leer el archivo.");
  }
  if (bytes.length > MAX_UPLOAD_BYTES)
    throw new IntakeError(
      `El archivo supera los ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
    );

  // The agency id decides the dedup scope and the listings' owner, so it is
  // resolved against the table rather than believed.
  let agencyId: number | null = null;
  let agencyName: string | null = null;
  if (payload.agencyId != null) {
    const [row] = await db
      .select({ id: agencies.id, name: agencies.name })
      .from(agencies)
      .where(eq(agencies.id, payload.agencyId))
      .limit(1);
    if (!row) throw new IntakeError("Esa inmobiliaria no existe.");
    agencyId = row.id;
    agencyName = row.name;
  }

  return { bytes, source, agencyId, agencyName };
}

/** Merge the file's own parse failures into the plan's skipped rows. */
function mergeParseErrors(
  report: ImportReport,
  parseErrors: { row: number; reason: string }[],
): ImportReport {
  return {
    ...report,
    skipped: report.skipped + parseErrors.length,
    errors: [...parseErrors, ...report.errors].sort((a, b) => a.row - b.row),
  };
}

function toPreview(
  planned: PlannedRow[],
  parseErrors: { row: number; reason: string }[],
  limit = 40,
): PreviewRow[] {
  const rows: PreviewRow[] = [
    ...parseErrors.map((e) => ({
      rowNumber: e.row,
      outcome: "skipped",
      title: "",
      reason: e.reason,
    })),
    ...planned.map((p) => ({
      rowNumber: p.rowNumber,
      outcome: p.outcome,
      title: p.title ?? "",
      reason: p.reason ?? null,
    })),
  ];
  // Problems first, then file order — the rows an operator needs to look at
  // should not be on page four of the preview.
  rows.sort((a, b) => {
    const aBad = a.outcome === "skipped" ? 0 : 1;
    const bBad = b.outcome === "skipped" ? 0 : 1;
    return aBad !== bBad ? aBad - bBad : a.rowNumber - b.rowNumber;
  });
  return rows.slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Step 1 — dry run. Writes nothing.                                   */
/* ------------------------------------------------------------------ */

export async function dryRunImportAction(
  payload: UploadPayload,
): Promise<DryRunResult> {
  await requireSuperAdmin();

  try {
    const { bytes, source, agencyId, agencyName } = await resolvePayload(payload);
    const intake = readIntake(bytes, payload.filename, source);
    const plan = await planImport(db, intake.rows, { agencyId });

    return {
      ok: true,
      report: mergeParseErrors(plan.report, intake.parseErrors),
      totalRows: intake.totalRows,
      kind: intake.kind,
      preview: toPreview(plan.rows, intake.parseErrors),
      unknownColumns: intake.unknownColumns,
      missingRequired: intake.missingRequired,
      withoutDedupKey: plan.rows.filter(
        (r) => r.outcome !== "skipped" && !r.dedupKey,
      ).length,
      agencyName,
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof IntakeError
          ? e.message
          : "No pudimos procesar el archivo.",
    };
  }
}

/* ------------------------------------------------------------------ */
/* Step 2 — commit.                                                    */
/* ------------------------------------------------------------------ */

export async function commitImportAction(
  payload: UploadPayload,
): Promise<CommitResult> {
  const user = await requireSuperAdmin();

  try {
    const { bytes, source, agencyId } = await resolvePayload(payload);

    /**
     * The permission gate, enforced here rather than in the form. Importing
     * someone's catalogue because it was technically reachable is the thing
     * this feature must not become, and a checkbox the server does not check
     * is decoration.
     */
    const grantedBy = payload.permissionGrantedBy.trim();
    if (!payload.permissionGranted || grantedBy.length < 2)
      throw new IntakeError(
        "Registrá quién autorizó la importación antes de confirmarla.",
      );

    const intake = readIntake(bytes, payload.filename, source);
    const plan = await planImport(db, intake.rows, { agencyId });
    const committed = await commitImport(db, plan, { agencyId, publish: payload.publish });
    const report = mergeParseErrors(
      reportFromCommitted(committed),
      intake.parseErrors,
    );

    const jobId = await createImportJob({
      agencyId,
      source,
      kind: intake.kind,
      filename: payload.filename,
      status: "committed",
      report,
      totalRows: intake.totalRows,
      permission: {
        granted: true,
        grantedBy,
        note: payload.permissionNote.trim() || null,
      },
      createdByUserId: user.id,
    });

    // Parse failures are rows of the file too; the log is incomplete without them.
    await recordImportRows(jobId, [
      ...committed,
      ...intake.parseErrors.map((e) => ({
        rowNumber: e.row,
        outcome: "skipped" as const,
        listingId: null,
        title: null,
        error: e.reason,
        note: null,
        previous: null,
      })),
    ]);

    revalidatePath(ROUTE);
    revalidatePath("/admin");
    revalidatePath("/admin/propiedades");
    revalidateListings();
    return { ok: true, jobId, report };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof IntakeError ? e.message : "No pudimos confirmar la importación.",
    };
  }
}

/* ------------------------------------------------------------------ */
/* Rollback                                                            */
/* ------------------------------------------------------------------ */

export async function rollbackImportAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const jobId = Number(formData.get("jobId"));
  if (!Number.isInteger(jobId) || jobId <= 0) redirect(ROUTE);

  const result = await rollbackImportJob(jobId);
  revalidatePath(ROUTE);
  revalidatePath(`${ROUTE}/${jobId}`);
  revalidatePath("/admin/propiedades");
  revalidateListings();

  // The outcome matters — a rollback that kept rows back is not a failure, but
  // the operator has to be told which ones and why.
  redirect(
    `${ROUTE}/${jobId}?msg=${result.ok ? "rolled_back" : "rollback_failed"}`,
  );
}
