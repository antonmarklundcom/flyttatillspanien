import type { Metadata } from "next";
import { PanelBar } from "@/components/panel/PanelBar";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { countRecentLeads, getReviewQueue } from "@/lib/panel-queries";
import { svPanel } from "@/i18n/sv";
import { formatEur } from "@/lib/format";
import { PROPERTY_TYPE_LABELS } from "@/lib/property-types";
import { adminTabs } from "./tabs";
import { approveAction, rejectAction } from "./actions";
import { publishBlockReason } from "@/lib/publish-gate";

export const metadata: Metadata = {
  title: `Cola de revisión`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const OPERATION_LABEL: Record<string, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
  alquiler_temporal: "Alquiler temporal",
};

export default async function AdminReviewPage() {
  const user = await requireSuperAdmin();
  const [queue, recentLeads] = await Promise.all([
    getReviewQueue(),
    countRecentLeads(),
  ]);

  return (
    <>
      <PanelBar
        title="Panel de administración"
        role={user.role}
        userName={user.name}
        tabs={adminTabs("review", queue.length, undefined, recentLeads)}
      />
      <main className="panel site-main">
        <h2 className="panel-section__title">{svPanel.adminReviewTitle}</h2>

        {queue.length === 0 ? (
          <p className="panel-empty">{svPanel.adminReviewEmpty}</p>
        ) : (
          queue.map((row) => (
            <article className="panel-card" key={row.id}>
              <div className="panel-card__head">
                <div>
                  <h3 className="panel-card__title">{row.title}</h3>
                  <div className="panel-card__meta">
                    <span>{OPERATION_LABEL[row.operation] ?? row.operation}</span>
                    <span>{PROPERTY_TYPE_LABELS[row.propertyType]}</span>
                    {row.locationName ? <span>{row.locationName}</span> : null}
                    <span>{row.agencyName ?? "Particular"}</span>
                    <span>#{row.publicId}</span>
                  </div>
                </div>
                <span className="panel-card__price">
                  {formatEur(row.priceEur)}
                </span>
              </div>

              <div className="panel-card__body">
                {/* The publish gate, said out loud. `approveAction` refuses a
                    row that fails it either way (publish-gate.ts); showing the
                    reason here is what stops the refusal reading as a bug. */}
                {publishBlockReason(row) && (
                  <p className="panel-card__warning" role="note">
                    {publishBlockReason(row)}
                  </p>
                )}
                <div className="panel-actions">
                  <form action={approveAction}>
                    <input type="hidden" name="listingId" value={row.id} />
                    <button
                      className="panel-btn panel-btn--primary"
                      type="submit"
                      disabled={Boolean(publishBlockReason(row))}
                    >
                      {svPanel.approve}
                    </button>
                  </form>

                  <details>
                    <summary className="panel-btn panel-btn--danger">
                      {svPanel.reject}
                    </summary>
                    <form action={rejectAction} className="panel-reject">
                      <input type="hidden" name="listingId" value={row.id} />
                      <label
                        className="auth-field__label"
                        htmlFor={`reason-${row.id}`}
                      >
                        {svPanel.rejectReasonLabel}
                      </label>
                      <textarea
                        id={`reason-${row.id}`}
                        name="reason"
                        className="panel-reject__textarea"
                        placeholder={svPanel.rejectReasonPlaceholder}
                        required
                      />
                      <div>
                        <button
                          className="panel-btn panel-btn--danger"
                          type="submit"
                        >
                          {svPanel.reject}
                        </button>
                      </div>
                    </form>
                  </details>
                </div>
              </div>
            </article>
          ))
        )}
      </main>
    </>
  );
}
