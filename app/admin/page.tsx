import type { Metadata } from "next";
import { PanelBar } from "@/components/panel/PanelBar";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { countRecentLeads, getReviewQueue } from "@/lib/panel-queries";
import { esPanel } from "@/i18n/es";
import { formatPrice } from "@/lib/format";
import { PROPERTY_TYPE_LABELS } from "@/lib/property-types";
import { adminTabs } from "./tabs";
import { approveAction, rejectAction } from "./actions";

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
        <h2 className="panel-section__title">{esPanel.adminReviewTitle}</h2>

        {queue.length === 0 ? (
          <p className="panel-empty">{esPanel.adminReviewEmpty}</p>
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
                  {formatPrice({
                    priceAmount: row.priceAmount,
                    priceCurrency: row.priceCurrency,
                  })}
                </span>
              </div>

              <div className="panel-card__body">
                <div className="panel-actions">
                  <form action={approveAction}>
                    <input type="hidden" name="listingId" value={row.id} />
                    <button className="panel-btn panel-btn--primary" type="submit">
                      {esPanel.approve}
                    </button>
                  </form>

                  <details>
                    <summary className="panel-btn panel-btn--danger">
                      {esPanel.reject}
                    </summary>
                    <form action={rejectAction} className="panel-reject">
                      <input type="hidden" name="listingId" value={row.id} />
                      <label
                        className="auth-field__label"
                        htmlFor={`reason-${row.id}`}
                      >
                        {esPanel.rejectReasonLabel}
                      </label>
                      <textarea
                        id={`reason-${row.id}`}
                        name="reason"
                        className="panel-reject__textarea"
                        placeholder={esPanel.rejectReasonPlaceholder}
                        required
                      />
                      <div>
                        <button
                          className="panel-btn panel-btn--danger"
                          type="submit"
                        >
                          {esPanel.reject}
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
