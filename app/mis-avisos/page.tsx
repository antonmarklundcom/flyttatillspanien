import type { Metadata } from "next";
import Link from "next/link";
import { PanelBar } from "@/components/panel/PanelBar";
import { requireOwnerContext } from "@/lib/auth/guards";
import { AGENCY_LOCKED_STATUSES, agencyStatusOptions } from "@/lib/listing-edit";
import { getPanelListings } from "@/lib/panel-queries";
import { getPanelListingStats } from "@/lib/stats-queries";
import { svOwner, svPanel, listingStatusLabel } from "@/i18n/sv";
import { formatEur } from "@/lib/format";
import { PROPERTY_TYPE_LABELS } from "@/lib/property-types";
import { listingUrl } from "@/lib/urls";
import { ownerTabs } from "./tabs";
import { setOwnerListingStatusAction } from "./actions";

export const metadata: Metadata = {
  title: `Tus avisos`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OwnerListingsPage() {
  const { user, scope } = await requireOwnerContext();
  // Both are scope-guarded reads and neither depends on the other.
  const [rows, stats] = await Promise.all([
    getPanelListings(scope),
    getPanelListingStats(scope),
  ]);

  return (
    <>
      <PanelBar
        title={svOwner.panelTitle}
        role={user.role}
        userName={user.name}
        tabs={ownerTabs("listings")}
      />
      <main className="panel site-main">
        <div className="panel-section__header">
          <h2 className="panel-section__title">{svOwner.listingsTitle}</h2>
          <Link className="panel-btn panel-btn--primary" href="/publicar">
            {svOwner.addListingCta}
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="panel-empty">{svOwner.listingsEmpty}</p>
        ) : (
          <>
            <p className="panel-note">{svOwner.statusReviewNote}</p>

            <div className="panel-table__wrap">
              <table className="panel-table">
                <thead>
                  <tr>
                    <th>Propiedad</th>
                    <th>Tipo</th>
                    <th>Pris</th>
                    <th>{svOwner.statusLabel}</th>
                    <th title={svPanel.statsViewsHint}>{svPanel.statsViews}</th>
                    <th>{svPanel.statsLeads}</th>
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
                        {formatEur(row.priceEur)}
                      </td>
                      <td>
                        <span className={`panel-status panel-status--${row.status}`}>
                          {listingStatusLabel[row.status] ?? row.status}
                        </span>
                      </td>
                      {/* A listing with no activity is absent from the map, not 0 in it. */}
                      <td className="panel-table__num">
                        {stats.get(row.id)?.views ?? 0}
                      </td>
                      <td className="panel-table__num">
                        {stats.get(row.id)?.leads ?? 0}
                      </td>
                      <td>
                        <div className="panel-actions">
                          {/* pending_review / removed are ours to move, not
                              theirs: a select here would let one save cancel
                              the review that is already under way (F25). */}
                          {!AGENCY_LOCKED_STATUSES.includes(row.status) ? (
                            <form
                              action={setOwnerListingStatusAction}
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
                                {svOwner.saveStatus}
                              </button>
                            </form>
                          ) : (
                            <p className="panel-status-note">
                              {row.status === "pending_review"
                                ? svPanel.statusPendingNote
                                : svPanel.statusRejectedNote}
                              {row.status === "removed" && row.reviewNotes && (
                                <>
                                  {" "}
                                  {svPanel.statusRejectedReason}: {row.reviewNotes}
                                </>
                              )}
                            </p>
                          )}
                          <Link
                            className="panel-btn"
                            href={`/mis-avisos/aviso/${row.id}`}
                          >
                            {svOwner.editListing}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </>
  );
}
