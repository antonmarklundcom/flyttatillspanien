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
import { esPanel } from "@/i18n/es";
import { adminTabs } from "../../tabs";
import { rollbackImportAction } from "../actions";

export const metadata: Metadata = {
  title: `Lote importado`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const OUTCOME_LABELS: Record<string, string> = {
  created: "Nueva",
  updated: "Actualizada",
  unchanged: "Sin cambios",
  deduped: "Duplicada",
  skipped: "Omitida",
  paused: "Pausada",
};

const FLASH: Record<string, { text: string; error?: boolean }> = {
  rolled_back: { text: esPanel.importJobRolledBack },
  rollback_failed: { text: esPanel.importJobRollbackFailed, error: true },
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
        title="Panel de administración"
        role={user.role}
        userName={user.name}
        tabs={adminTabs("import", reviewCount)}
      />
      <main className="panel site-main">
        <p className="panel-card__meta">
          <Link href="/admin/importar">← Volver a importaciones</Link>
        </p>

        {flash ? (
          <p className={flash.error ? "auth-error" : "panel-flash"}>
            {flash.text}
          </p>
        ) : null}

        <h2 className="panel-section__title">
          Lote #{job.id} — {job.filename ?? job.kind}
        </h2>

        <article className="panel-card">
          <ul className="panel-card__meta" style={{ lineHeight: 1.9 }}>
            <li>Inmobiliaria: {job.agencyName ?? "sin inmobiliaria"}</li>
            <li>Origen: {job.source}</li>
            <li>Filas en el archivo: {job.totalRows}</li>
            <li>
              Nuevas {job.createdCount} · actualizadas {job.updatedCount} · sin
              cambios {job.unchangedCount} · duplicadas {job.dedupedCount} ·
              omitidas {job.skippedCount}
            </li>
            <li>
              Autorización:{" "}
              {job.permissionGranted
                ? `${job.permissionGrantedBy ?? "sí"}${
                    job.permissionNote ? ` — ${job.permissionNote}` : ""
                  }`
                : esPanel.importPermissionMissing}
            </li>
          </ul>

          {job.status === "rolled_back" ? (
            <p className="panel-card__meta">
              Revertido{job.rolledBackAt ? "" : ""}.{" "}
              {job.rollbackNote ?? "Se deshizo todo lo que había escrito."}
            </p>
          ) : job.status === "committed" ? (
            <form action={rollbackImportAction}>
              <input type="hidden" name="jobId" value={job.id} />
              <p className="panel-card__meta">{esPanel.importRollbackHint}</p>
              <button className="panel-btn" type="submit">
                {esPanel.importJobRollback}
              </button>
            </form>
          ) : null}
        </article>

        <h3 className="panel-section__title" style={{ marginTop: 28 }}>
          Filas
        </h3>
        {totalLogged > rows.length ? (
          <p className="panel-card__meta" style={{ marginTop: 0 }}>
            Mostramos las primeras {rows.length} de {totalLogged} filas
            registradas.
          </p>
        ) : null}
        <div className="panel-table__wrap">
          <table className="panel-table">
            <thead>
              <tr>
                <th>Fila</th>
                <th>Resultado</th>
                <th>Título</th>
                <th>Propiedad</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.rowNumber}</td>
                  <td>{OUTCOME_LABELS[r.outcome] ?? r.outcome}</td>
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
