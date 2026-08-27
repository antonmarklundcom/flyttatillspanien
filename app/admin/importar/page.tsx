import type { Metadata } from "next";
import Link from "next/link";
import { PanelBar } from "@/components/panel/PanelBar";
import { ImportUpload } from "@/components/panel/ImportUpload";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { countReviewQueue, listAgencies } from "@/lib/panel-queries";
import { listImportJobs } from "@/lib/import/jobs";
import { recentPriceChanges } from "@/lib/import/resync";
import { UPLOAD_SOURCES } from "@/lib/import/intake";
import { formatUsd } from "@/lib/format";
import { esPanel } from "@/i18n/es";
import { adminTabs } from "../tabs";
import { commitImportAction, dryRunImportAction } from "./actions";

export const metadata: Metadata = {
  title: `Importar planilla`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  dry_run: "Solo revisado",
  committed: "Confirmado",
  rolled_back: "Revertido",
  failed: "Falló",
};

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function AdminImportPage() {
  const user = await requireSuperAdmin();
  const [reviewCount, agencies, jobs, priceChanges] = await Promise.all([
    countReviewQueue(),
    listAgencies(),
    listImportJobs(),
    recentPriceChanges(25),
  ]);

  return (
    <>
      <PanelBar
        title="Panel de administración"
        role={user.role}
        userName={user.name}
        tabs={adminTabs("import", reviewCount)}
      />
      <main className="panel site-main">
        <h2 className="panel-section__title">{esPanel.adminImportTitle}</h2>
        <p style={{ color: "#55655F", fontSize: 14, marginTop: 0 }}>
          {esPanel.adminImportSubtitle}
        </p>

        <article className="panel-card">
          <ImportUpload
            agencies={agencies}
            sources={UPLOAD_SOURCES}
            dryRunAction={dryRunImportAction}
            commitAction={commitImportAction}
          />
        </article>

        <h2 className="panel-section__title" style={{ marginTop: 32 }}>
          {esPanel.importJobsTitle}
        </h2>
        {jobs.length === 0 ? (
          <p className="panel-card__meta">{esPanel.importJobsEmpty}</p>
        ) : (
          <div className="panel-table__wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Fecha</th>
                  <th>Inmobiliaria</th>
                  <th>Archivo</th>
                  <th>Resultado</th>
                  <th>Autorización</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <Link href={`/admin/importar/${j.id}`}>#{j.id}</Link>
                    </td>
                    <td>{formatDate(j.createdAt)}</td>
                    <td>{j.agencyName ?? "—"}</td>
                    <td>{j.filename ?? j.kind}</td>
                    <td>
                      {j.createdCount} nuevas · {j.updatedCount} act. ·{" "}
                      {j.skippedCount} omitidas
                    </td>
                    <td>
                      {j.permissionGranted
                        ? (j.permissionGrantedBy ?? "sí")
                        : esPanel.importPermissionMissing}
                    </td>
                    <td>{STATUS_LABELS[j.status] ?? j.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {priceChanges.length > 0 ? (
          <>
            <h2 className="panel-section__title" style={{ marginTop: 32 }}>
              Cambios de precio detectados
            </h2>
            <p className="panel-card__meta" style={{ marginTop: 0 }}>
              Cada re-importación compara contra lo que ya estaba. Esto es lo
              que se movió.
            </p>
            <div className="panel-table__wrap">
              <table className="panel-table">
                <thead>
                  <tr>
                    <th>Propiedad</th>
                    <th>Antes</th>
                    <th>Ahora</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {priceChanges.map((c) => (
                    <tr key={`${c.listingId}-${c.at.toISOString()}`}>
                      <td>
                        <Link href={`/admin/propiedades/${c.listingId}`}>
                          {c.title ?? `#${c.listingId}`}
                        </Link>
                      </td>
                      <td>{c.before ? formatUsd(c.before) : "—"}</td>
                      <td>{formatUsd(c.after)}</td>
                      <td>{formatDate(c.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </main>
    </>
  );
}
