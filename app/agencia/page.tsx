import type { Metadata } from "next";
import Link from "next/link";
import { PanelBar } from "@/components/panel/PanelBar";
import { canManageTeam, panelScope, requireAgencyContext } from "@/lib/auth/guards";
import {
  AGENCY_LOCKED_STATUSES,
  agencyStatusOptions,
  type EditScope,
} from "@/lib/listing-edit";
import { getPanelListings } from "@/lib/panel-queries";
import {
  getPanelListingStats,
  STATS_WINDOW_DAYS,
  totalsFrom,
} from "@/lib/stats-queries";
import { esPanel, listingStatusLabel } from "@/i18n/es";
import { formatPrice } from "@/lib/format";
import { PROPERTY_TYPE_LABELS } from "@/lib/property-types";
import { listingUrl } from "@/lib/urls";
import { agencyTabs } from "./tabs";
import { setListingStatusAction } from "./actions";

export const metadata: Metadata = {
  title: `Tus propiedades`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";



export default async function AgencyListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const { msg } = await searchParams;
  const ctx = await requireAgencyContext();
  const { user, agencyId } = ctx;
  const scope = panelScope(ctx);

  return (
    <>
      <PanelBar
        title="Panel de la inmobiliaria"
        role={user.role}
        userName={user.name}
        tabs={agencyTabs("listings", canManageTeam(ctx))}
      />
      <main className="panel site-main">
        {msg === "welcome" ? (
          <p className="panel-flash">{esPanel.agencyWelcome}</p>
        ) : null}
        {msg === "joined" ? (
          <p className="panel-flash">{esPanel.teamJoined}</p>
        ) : null}

        <div className="panel-section__header">
          <h2 className="panel-section__title">{esPanel.agencyListingsTitle}</h2>
          <Link className="panel-btn panel-btn--primary" href="/publicar">
            {esPanel.agencyAddListingCta}
          </Link>
        </div>

        {/* Publishing moved behind the review queue (audit F1); say so where
            the status control is, not in a help page nobody opens. */}
        <p className="panel-note">{esPanel.statusReviewNote}</p>

        {/* An agency account with no agencies row is a setup slip worth
            flagging; an independent agent is simply scoped to their own rows. */}
        {agencyId == null && user.role === "agency_admin" ? (
          <p className="panel-empty">{esPanel.agencyNoLink}</p>
        ) : (
          <AgencyListings scope={scope} />
        )}
      </main>
    </>
  );
}

async function AgencyListings({ scope }: { scope: EditScope }) {
  // Both are scope-guarded reads and neither depends on the other.
  const [rows, stats] = await Promise.all([
    getPanelListings(scope),
    getPanelListingStats(scope),
  ]);
  if (rows.length === 0) {
    return <p className="panel-empty">{esPanel.agencyListingsEmpty}</p>;
  }

  const totals = totalsFrom(stats);

  return (
    <>
      {/* The headline answer to "is this working?", before the table detail. */}
      <p className="panel-stats-summary">
        {esPanel.statsSummary}:{" "}
        <strong>{totals.views}</strong> {esPanel.statsViews.toLowerCase()} ·{" "}
        <strong>{totals.leads}</strong> {esPanel.statsLeads.toLowerCase()}{" "}
        <span className="panel-stats-summary__hint">
          ({STATS_WINDOW_DAYS} días — {esPanel.statsViewsHint})
        </span>
      </p>

      <div className="panel-table__wrap">
      <table className="panel-table">
        <thead>
          <tr>
            <th>Propiedad</th>
            <th>Tipo</th>
            <th>Precio</th>
            <th>{esPanel.statusLabel}</th>
            <th title={esPanel.statsViewsHint}>{esPanel.statsViews}</th>
            <th>{esPanel.statsLeads}</th>
            <th>Cambiar estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="panel-table__name">
                {row.status === "published" ? (
                  <Link href={listingUrl(row)} target="_blank">
                    {row.title}
                  </Link>
                ) : (
                  row.title
                )}
              </td>
              <td>{PROPERTY_TYPE_LABELS[row.propertyType]}</td>
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
              {/* A listing with no activity is absent from the map, not 0 in it. */}
              <td className="panel-table__num">{stats.get(row.id)?.views ?? 0}</td>
              <td className="panel-table__num">{stats.get(row.id)?.leads ?? 0}</td>
              <td>
                <div className="panel-actions">
                  {/* pending_review / removed are admin-owned states: no
                      status select — the old default silently pre-set
                      "Borrador", so one save cancelled the review (F25). */}
                  {!AGENCY_LOCKED_STATUSES.includes(row.status) ? (
                    <form
                      action={setListingStatusAction}
                      className="panel-actions"
                      style={{ gap: 6 }}
                    >
                      <input type="hidden" name="listingId" value={row.id} />
                      <select
                        name="status"
                        className="panel-select"
                        defaultValue={row.status}
                      >
                        {agencyStatusOptions(row.status).map((s) => (
                          <option key={s} value={s}>
                            {listingStatusLabel[s]}
                          </option>
                        ))}
                      </select>
                      <button className="panel-btn" type="submit">
                        {esPanel.saveStatus}
                      </button>
                    </form>
                  ) : (
                    <p className="panel-status-note">
                      {row.status === "pending_review"
                        ? esPanel.statusPendingNote
                        : esPanel.statusRejectedNote}
                      {row.status === "removed" && row.reviewNotes && (
                        <>
                          {" "}
                          {esPanel.statusRejectedReason}: {row.reviewNotes}
                        </>
                      )}
                    </p>
                  )}
                  <Link
                    className="panel-btn"
                    href={`/agencia/propiedad/${row.id}`}
                  >
                    {esPanel.editListing}
                  </Link>
                </div>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
