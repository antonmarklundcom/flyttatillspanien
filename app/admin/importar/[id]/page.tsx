import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PanelBar } from "@/components/panel/PanelBar";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { countReviewQueue } from "@/lib/panel-queries";
import {
  countImportRows,
  getImportJob,
  listImportRows,
} from "@/lib/import/jobs";
import { svPanel } from "@/i18n/sv";
import { adminTabs } from "../../tabs";
import { rollbackImportAction } from "../actions";

export const metadata: Metadata = {
  title: `Importerad batch`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const FLASH: Record<string, { text: string; error?: boolean }> = {
  rolled_back: { text: svPanel.importJobRolledBack },
  rollback_failed: { text: svPanel.importJobRollbackFailed, error: true },
};

export default async function ImportJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const [{ id }, { msg }, user] = await Promise.all([
    params,
    searchParams,
    requireSuperAdmin(),
  ]);

  const jobId = Number(id);
  if (!Number.isInteger(jobId) || jobId <= 0) notFound();

  const [reviewCount, job] = await Promise.all([
    countReviewQueue(),
    getImportJob(jobId),
  ]);
  if (!job) notFound();

  const [rows, totalLogged] = await Promise.all([
    listImportRows(jobId),
    countImportRows(jobId),
  ]);
  const flash = msg ? FLASH[msg] : undefined;

  return (
    <>
      <PanelBar
        title={svPanel.adminPanelTitle}
        role={user.role}
        userName={user.name}
        tabs={adminTabs("import", reviewCount)}
      />
      <main className="panel site-main">
        <p className="panel-card__meta">
          <Link href="/admin/importar">{svPanel.importBackToJobs}</Link>
        </p>

        {flash ? (
          <p className={flash.error ? "auth-error" : "panel-flash"}>
            {flash.text}
          </p>
        ) : null}

        <h2 className="panel-section__title">
          {svPanel.importBatchTitle(job.id, job.filename ?? job.kind)}
        </h2>

        <article className="panel-card">
          <ul className="panel-card__meta" style={{ lineHeight: 1.9 }}>
            <li>{svPanel.importAgencyLine(job.agencyName ?? svPanel.importNoAgency)}</li>
            <li>{svPanel.importSourceLine(job.source)}</li>
            <li>{svPanel.importTotalRowsLine(job.totalRows)}</li>
            <li>
              {svPanel.importResultLine(
                job.createdCount,
                job.updatedCount,
                job.unchangedCount,
                job.dedupedCount,
                job.skippedCount,
              )}
            </li>
            <li>
              {svPanel.importAuthorizationLine}{" "}
              {job.permissionGranted
                ? `${job.permissionGrantedBy ?? svPanel.importPermissionYes}${
                    job.permissionNote ? ` — ${job.permissionNote}` : ""
                  }`
                : svPanel.importPermissionMissing}
            </li>
          </ul>

          {job.status === "rolled_back" ? (
            <p className="panel-card__meta">
              {svPanel.importRolledBackLabel}{" "}
              {job.rollbackNote ?? svPanel.importRolledBackDefaultNote}
            </p>
          ) : job.status === "committed" ? (
            <form action={rollbackImportAction}>
              <input type="hidden" name="jobId" value={job.id} />
              <p className="panel-card__meta">{svPanel.importRollbackHint}</p>
              <button className="panel-btn" type="submit">
                {svPanel.importJobRollback}
              </button>
            </form>
          ) : null}
        </article>

        <h3 className="panel-section__title" style={{ marginTop: 28 }}>
          {svPanel.importRowsTitle}
        </h3>
        {totalLogged > rows.length ? (
          <p className="panel-card__meta" style={{ marginTop: 0 }}>
            {svPanel.importRowsTruncatedNote(rows.length, totalLogged)}
          </p>
        ) : null}
        <div className="panel-table__wrap">
          <table className="panel-table">
            <thead>
              <tr>
                <th>{svPanel.colRow}</th>
                <th>{svPanel.colResult}</th>
                <th>{svPanel.colTitle}</th>
                <th>{svPanel.colProperty}</th>
                <th>{svPanel.colDetail}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.rowNumber}</td>
                  <td>{svPanel.importOutcomeLabel[r.outcome] ?? r.outcome}</td>
                  <td>{r.title ?? ""}</td>
                  <td>
                    {/* A reverted `created` row is the only case where the
                        listing is gone; a restored `updated` row still exists. */}
                    {r.listingId &&
                    !(r.outcome === "created" && r.revertedAt) ? (
                      <Link href={`/admin/propiedades/${r.listingId}`}>
                        #{r.listingId}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{r.error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
