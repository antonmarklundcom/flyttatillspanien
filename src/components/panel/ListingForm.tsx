import { svPanel, listingStatusLabel } from "@/i18n/sv";
import { PROPERTY_TYPE_OPTIONS } from "@/lib/property-types";
import type { PublishLocation } from "@/lib/publish-queries";
import type { EditableListing, ListingStatusValue } from "@/lib/listing-edit";

/** Operation labels — nouns, never verb forms. */
const OPERATION_OPTIONS = [
  { value: "venta", label: "Köp" },
  { value: "alquiler", label: "Uthyrning" },
  { value: "alquiler_vacacional", label: "Korttidshyra" },
] as const;

const ENERGY_RATING_OPTIONS = ["A", "B", "C", "D", "E", "F", "G", "en_tramite", "exento"] as const;
const LEGAL_STATUS_OPTIONS = [
  "escritura_registrada",
  "obra_nueva_lpo",
  "sin_lpo",
  "en_regularizacion",
  "desconocido",
] as const;
const CHARGES_STATUS_OPTIONS = ["libre_de_cargas", "con_hipoteca", "con_cargas", "desconocido"] as const;

/**
 * The listing edit form, shared verbatim by /admin/propiedades/[id] and
 * /agencia/bostad/[id]. The two callers differ only in the action they pass
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
          <span className="auth-field__label">{svPanel.listingPriceLabel} (€)</span>
          <input
            className="auth-field__input"
            name="priceEur"
            type="number"
            min="1"
            step="any"
            defaultValue={listing.priceEur}
            required
          />
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
            name="builtM2"
            type="number"
            min="0"
            step="any"
            defaultValue={listing.builtM2 ?? ""}
          />
        </label>

        <label className="panel-form__field">
          <span className="auth-field__label">{svPanel.listingLandLabel}</span>
          <input
            className="auth-field__input"
            name="plotM2"
            type="number"
            min="0"
            step="any"
            defaultValue={listing.plotM2 ?? ""}
          />
        </label>

        <label className="panel-form__field" style={{ flexBasis: "260px" }}>
          <span className="auth-field__label">Referencia catastral</span>
          <input
            className="auth-field__input"
            name="referenciaCatastral"
            type="text"
            maxLength={20}
            defaultValue={listing.referenciaCatastral ?? ""}
          />
        </label>

        <label className="panel-form__field">
          <span className="auth-field__label">Energiklass</span>
          <select
            className="panel-select"
            name="energyRating"
            defaultValue={listing.energyRating ?? ""}
          >
            <option value="">—</option>
            {ENERGY_RATING_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r === "en_tramite" ? "Ansökt" : r === "exento" ? "Undantagen" : r}
              </option>
            ))}
          </select>
        </label>

        <label className="panel-form__field">
          <span className="auth-field__label">Lagfartsstatus</span>
          <select
            className="panel-select"
            name="legalStatus"
            defaultValue={listing.legalStatus}
          >
            {LEGAL_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="panel-form__field">
          <span className="auth-field__label">Belastningar</span>
          <select
            className="panel-select"
            name="chargesStatus"
            defaultValue={listing.chargesStatus}
          >
            {CHARGES_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="panel-form__field">
          <span className="auth-field__label">IBI (€/år)</span>
          <input
            className="auth-field__input"
            name="ibiAnnualEur"
            type="number"
            min="0"
            step="any"
            defaultValue={listing.ibiAnnualEur ?? ""}
          />
        </label>

        <label className="panel-form__field">
          <span className="auth-field__label">Samfällighetsavgift (€/mån)</span>
          <input
            className="auth-field__input"
            name="communityMonthlyEur"
            type="number"
            min="0"
            step="any"
            defaultValue={listing.communityMonthlyEur ?? ""}
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
