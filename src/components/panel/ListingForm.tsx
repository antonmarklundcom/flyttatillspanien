import { svPanel, listingStatusLabel } from "@/i18n/sv";
import { PROPERTY_TYPE_OPTIONS } from "@/lib/property-types";
import type { PublishLocation } from "@/lib/publish-queries";
import type { EditableListing, ListingStatusValue } from "@/lib/listing-edit";

/** Operation labels — nouns, never verb forms (ARCHITECTURE.md §4). */
const OPERATION_OPTIONS = [
  { value: "venta", label: "Venta" },
  { value: "alquiler", label: "Alquiler" },
  { value: "alquiler_temporal", label: "Alquiler temporal" },
] as const;

/**
 * The listing edit form, shared verbatim by /admin/propiedades/[id] and
 * /agencia/propiedad/[id]. The two callers differ only in the action they pass
 * and the statuses they may set — the scope guard itself lives in the server
 * action and the query layer, never here, because a form is not a trust
 * boundary.
 */
export function ListingForm({
  listing,
  locations,
  statuses,
  action,
  canDelete,
  deleteAction,
}: {
  listing: EditableListing;
  locations: PublishLocation[];
  statuses: readonly ListingStatusValue[];
  action: (formData: FormData) => void | Promise<void>;
  canDelete?: boolean;
  deleteAction?: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <>
      <form action={action} className="panel-form">
        <input type="hidden" name="listingId" value={listing.id} />

        <label className="panel-form__field" style={{ flexBasis: "100%" }}>
          <span className="auth-field__label">{svPanel.listingTitleLabel}</span>
          <input
            className="auth-field__input"
            name="title"
            type="text"
            defaultValue={listing.title}
            maxLength={180}
            required
          />
        </label>

        <label className="panel-form__field" style={{ flexBasis: "100%" }}>
          <span className="auth-field__label">{svPanel.listingDescriptionLabel}</span>
          <textarea
            className="panel-reject__textarea"
            name="descriptionEs"
            defaultValue={listing.descriptionEs ?? ""}
            rows={5}
          />
        </label>

        <label className="panel-form__field">
          <span className="auth-field__label">{svPanel.listingOperationLabel}</span>
          <select
            className="panel-select"
            name="operation"
            defaultValue={listing.operation}
          >
            {OPERATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="panel-form__field">
          <span className="auth-field__label">{svPanel.listingTypeLabel}</span>
          <select
            className="panel-select"
            name="propertyType"
            defaultValue={listing.propertyType}
          >
            {PROPERTY_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="panel-form__field">
          <span className="auth-field__label">{svPanel.listingPriceLabel}</span>
          <input
            className="auth-field__input"
            name="priceAmount"
            type="number"
            min="1"
            step="any"
            defaultValue={listing.priceAmount}
            required
          />
        </label>

        <label className="panel-form__field">
          <span className="auth-field__label">{svPanel.listingCurrencyLabel}</span>
          <select
            className="panel-select"
            name="priceCurrency"
            defaultValue={listing.priceCurrency}
          >
            <option value="USD">USD</option>
            <option value="PYG">Gs</option>
          </select>
        </label>

        <label className="panel-form__field">
          <span className="auth-field__label">{svPanel.listingBedroomsLabel}</span>
          <input
            className="auth-field__input"
            name="bedrooms"
            type="number"
            min="0"
            defaultValue={listing.bedrooms ?? ""}
          />
        </label>

        <label className="panel-form__field">
          <span className="auth-field__label">{svPanel.listingBathroomsLabel}</span>
          <input
            className="auth-field__input"
            name="bathrooms"
            type="number"
            min="0"
            defaultValue={listing.bathrooms ?? ""}
          />
        </label>

        <label className="panel-form__field">
          <span className="auth-field__label">{svPanel.listingParkingLabel}</span>
          <input
            className="auth-field__input"
            name="parking"
            type="number"
            min="0"
            defaultValue={listing.parking ?? ""}
          />
        </label>

        <label className="panel-form__field">
          <span className="auth-field__label">{svPanel.listingAreaLabel}</span>
          <input
            className="auth-field__input"
            name="areaM2"
            type="number"
            min="0"
            step="any"
            defaultValue={listing.areaM2 ?? ""}
          />
        </label>

        <label className="panel-form__field">
          <span className="auth-field__label">{svPanel.listingLandLabel}</span>
          <input
            className="auth-field__input"
            name="landM2"
            type="number"
            min="0"
            step="any"
            defaultValue={listing.landM2 ?? ""}
          />
        </label>

        <label className="panel-form__field" style={{ flexBasis: "260px" }}>
          <span className="auth-field__label">{svPanel.listingLocationLabel}</span>
          <select
            className="panel-select"
            name="locationId"
            defaultValue={String(listing.locationId)}
            required
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <label className="panel-form__field" style={{ flexBasis: "260px" }}>
          <span className="auth-field__label">{svPanel.listingVideoLabel}</span>
          <input
            className="auth-field__input"
            name="videoUrl"
            type="url"
            defaultValue={listing.videoUrl ?? ""}
            maxLength={500}
          />
        </label>

        <label className="panel-form__field">
          <span className="auth-field__label">{svPanel.statusLabel}</span>
          <select
            className="panel-select"
            name="status"
            defaultValue={
              statuses.includes(listing.status) ? listing.status : statuses[0]
            }
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {listingStatusLabel[s] ?? s}
              </option>
            ))}
          </select>
        </label>

        <label className="panel-form__field panel-form__check">
          <input
            type="checkbox"
            name="foreignExposure"
            value="1"
            defaultChecked={listing.foreignExposure}
          />
          <span>{svPanel.listingForeignLabel}</span>
        </label>

        <div className="panel-form__field panel-form__field--action">
          <button className="panel-btn panel-btn--primary" type="submit">
            {svPanel.saveListing}
          </button>
        </div>
      </form>

      {canDelete && deleteAction ? (
        <div className="panel-actions">
          <details>
            <summary className="panel-btn panel-btn--danger">
              {svPanel.deleteListing}
            </summary>
            <form action={deleteAction} className="panel-reject">
              <input type="hidden" name="listingId" value={listing.id} />
              <p className="panel-card__meta">{svPanel.deleteListingWarning}</p>
              <div>
                <button className="panel-btn panel-btn--danger" type="submit">
                  {svPanel.deleteListing}
                </button>
              </div>
            </form>
          </details>
        </div>
      ) : null}
    </>
  );
}
