import type { Metadata } from "next";
import Link from "next/link";
import { PanelBar } from "@/components/panel/PanelBar";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { countReviewQueue } from "@/lib/panel-queries";
import {
  ADMIN_STATUSES,
  countListingsByStatus,
  listAllListings,
  type ListingStatusValue,
} from "@/lib/listing-edit";
import { esPanel, listingStatusLabel } from "@/i18n/es";
import { formatPrice } from "@/lib/format";
import { PROPERTY_TYPE_LABELS } from "@/lib/property-types";
import { listingUrl } from "@/lib/urls";
import { BulkCount, BulkSelectAll } from "@/components/panel/BulkSelect";
import { adminTabs } from "../tabs";
import { bulkListingAction } from "./actions";

export const metadata: Metadata = {
  title: `Propiedades`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const OPERATION_LABEL: Record<string, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
  alquiler_temporal: "Alquiler temporal",
};

const FLASH: Record<string, string> = {
  deleted: esPanel.listingDeleted,
};

/** The whole table is one form, so the bulk bar can live above the rows. */
const BULK_FORM_ID = "admin-bulk";

function isStatus(v: string | undefined): v is ListingStatusValue {
  return Boolean(v) && (ADMIN_STATUSES as readonly string[]).includes(v!);
}

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; msg?: string }>;
}) {
  const [params, user] = await Promise.all([searchParams, requireSuperAdmin()]);
  const status = isStatus(params.status) ? params.status : "all";
  const q = params.q?.trim() ?? "";

  const [reviewCount, counts, rows] = await Promise.all([
    countReviewQueue(),
    countListingsByStatus(),
    listAllListings({ status, q }),
  ]);

  const flash = params.msg ? FLASH[params.msg] : undefined;
  const chips: (ListingStatusValue | "all")[] = ["all", ...ADMIN_STATUSES];

  return (
    <>
      <PanelBar
        title="Panel de administración"
        role={user.role}
        userName={user.name}
        tabs={adminTabs("listings", reviewCount)}
      />
      <main className="panel site-main">
        {flash ? <p className="panel-flash">{flash}</p> : null}

        <h2 className="panel-section__title">{esPanel.adminListingsTitle}</h2>

        <form action="/admin/propiedades" className="panel-form">
          {status !== "all" ? (
            <input type="hidden" name="status" value={status} />
          ) : null}
          <label className="panel-form__field" style={{ flexBasis: "280px" }}>
            <span className="auth-field__label">{esPanel.searchListingsLabel}</span>
            <input
              className="auth-field__input"
              name="q"
              type="search"
              defaultValue={q}
            />
          </label>
          <div className="panel-form__field panel-form__field--action">
            <button className="panel-btn" type="submit">
              {esPanel.searchSubmit}
            </button>
          </div>
        </form>

        <nav className="panel-chips" aria-label="Filtrar por estado">
          {chips.map((s) => {
            const href = `/admin/propiedades?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
            const label = s === "all" ? esPanel.filterAll : listingStatusLabel[s];
            const count = counts[s] ?? 0;
            return (
              <Link
                key={s}
                href={href}
                className={`panel-chip${s === status ? " panel-chip--active" : ""}`}
              >
                {label}
                <span className="panel-tab__count">{count}</span>
              </Link>
            );
          })}
        </nav>

        {rows.length === 0 ? (
          <p className="panel-empty">{esPanel.adminListingsEmpty}</p>
        ) : (
          <form action={bulkListingAction} id={BULK_FORM_ID}>
            {/* Preserve the current filter so the redirect lands back on the
                same view instead of resetting to "todas". */}
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="q" value={q} />

            <div className="panel-bulk">
              <BulkCount formId={BULK_FORM_ID} />
              <label className="panel-bulk__field">
                <span className="auth-field__label">Acción</span>
                <select className="panel-select" name="op" defaultValue="">
                  <option value="" disabled>
                    Elegí una acción
                  </option>
                  {ADMIN_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      Marcar como {listingStatusLabel[s] ?? s}
                    </option>
                  ))}
                  <option value="delete">Borrar definitivamente</option>
                </select>
              </label>
              <label className="panel-bulk__field">
                <span className="auth-field__label">
                  Escribí BORRAR para confirmar el borrado
                </span>
                <input className="auth-field__input" name="confirm" />
              </label>
              <button className="panel-btn" type="submit">
                Aplicar
              </button>
            </div>
            <p className="panel-bulk__hint">
              Cambiar el estado es reversible: <strong>Borrador</strong> o{" "}
              <strong>Eliminada</strong> saca la propiedad del sitio pero
              conserva la ficha, sus fotos y sus consultas.{" "}
              <strong>Borrar definitivamente</strong> no se puede deshacer y
              deja huérfanas las consultas recibidas — por eso pide la palabra
              de confirmación. Máximo 500 por vez.
            </p>

          <div className="panel-table__wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th className="panel-table__check">
                    <BulkSelectAll formId={BULK_FORM_ID} />
                  </th>
                  <th>Propiedad</th>
                  <th>Operación</th>
                  <th>Tipo</th>
                  <th>Inmobiliaria</th>
                  <th>Precio</th>
                  <th>{esPanel.statusLabel}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="panel-table__check">
                      <input
                        type="checkbox"
                        name="ids"
                        value={row.id}
                        aria-label={`Seleccionar ${row.title}`}
                      />
                    </td>
                    <td className="panel-table__name">
                      {row.title}
                      <div className="panel-card__meta">
                        <span>#{row.publicId}</span>
                        {row.locationName ? <span>{row.locationName}</span> : null}
                      </div>
                    </td>
                    <td>{OPERATION_LABEL[row.operation] ?? row.operation}</td>
                    <td>{PROPERTY_TYPE_LABELS[row.propertyType]}</td>
                    <td>{row.agencyName ?? "Particular"}</td>
                    <td>
                      {formatPrice({
                        priceAmount: row.priceAmount,
                        priceCurrency: row.priceCurrency,
                      })}
                    </td>
                    <td>
                      <span className={`panel-status panel-status--${row.status}`}>
                        {listingStatusLabel[row.status] ?? row.status}
                      </span>
                    </td>
                    <td>
                      <div className="panel-actions">
                        <Link
                          className="panel-btn"
                          href={`/admin/propiedades/${row.id}`}
                        >
                          {esPanel.editListing}
                        </Link>
                        {row.status === "published" ? (
                          <Link
                            className="panel-btn"
                            href={listingUrl(row)}
                            target="_blank"
                          >
                            {esPanel.viewListing}
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </form>
        )}
      </main>
    </>
  );
}
