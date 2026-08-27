"use client";

/**
 * Two-step import: read a link, then confirm what we read.
 *
 * The review step is the point of the whole feature. An importer that silently
 * created listings from whatever a page happened to say would put wrong prices
 * on the portal and make the agent look careless; here every field is an editable
 * input pre-filled with our best guess, blanks stay blank, and the attestation
 * checkbox is required before anything is written.
 */
import { useState } from "react";
import { svPanel } from "@/i18n/sv";
import { PROPERTY_TYPE_OPTIONS } from "@/lib/property-types";
import type { PublishLocation } from "@/lib/publish-queries";
import type { ParsedListing } from "@/lib/import/from-url";
import type { ReadUrlResult } from "../../../app/agencia/importar/actions";

const OPERATION_OPTIONS = [
  { value: "venta", label: "Venta" },
  { value: "alquiler", label: "Alquiler" },
  { value: "alquiler_temporal", label: "Alquiler temporal" },
] as const;

const ERROR_TEXT: Record<string, string> = {
  bad_url: svPanel.importErrorBadUrl,
  blocked_host: svPanel.importErrorBlocked,
  unreachable: svPanel.importErrorUnreachable,
  http_error: svPanel.importErrorUnreachable,
  not_html: svPanel.importErrorNotHtml,
  too_large: svPanel.importErrorTooLarge,
  too_many_redirects: svPanel.importErrorUnreachable,
  rate_limited: svPanel.importErrorRateLimited,
  generic: svPanel.importErrorGeneric,
};

export function ImportByUrl({
  locations,
  readAction,
  confirmAction,
}: {
  locations: PublishLocation[];
  readAction: (url: string) => Promise<ReadUrlResult>;
  confirmAction: (formData: FormData) => void | Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedListing | null>(null);
  const [suggestedLocationId, setSuggestedLocationId] = useState<number | null>(null);
  const [duplicate, setDuplicate] = useState<{
    listingId: number;
    title: string;
    status: string;
  } | null>(null);

  async function read() {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await readAction(url);
      if (!res.ok) {
        setError(ERROR_TEXT[res.error] ?? ERROR_TEXT.generic);
        setParsed(null);
        return;
      }
      setParsed(res.parsed);
      setSuggestedLocationId(res.suggestedLocationId);
      setDuplicate(res.duplicate);
    } catch {
      setError(ERROR_TEXT.generic);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="panel-card">
        <label className="panel-form__field" style={{ flexBasis: "100%" }}>
          <span className="auth-field__label">{svPanel.importUrlLabel}</span>
          <input
            className="auth-field__input"
            type="url"
            inputMode="url"
            value={url}
            placeholder="https://…"
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <div style={{ marginTop: 12 }}>
          <button
            className="panel-btn panel-btn--primary"
            type="button"
            onClick={() => void read()}
            disabled={busy || url.trim().length === 0}
          >
            {busy ? svPanel.importReading : svPanel.importFetch}
          </button>
        </div>
        {error && (
          <p className="auth-error" style={{ marginTop: 12 }}>
            {error}
          </p>
        )}
        <p style={{ color: "#55655F", fontSize: 12.5, marginTop: 14 }}>
          {svPanel.importLegalNote}
        </p>
      </div>

      {parsed && (
        <form action={confirmAction} className="panel-card" style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: 18, margin: "0 0 .25rem" }}>
            {svPanel.importReviewTitle}
          </h2>
          <p style={{ color: "#55655F", fontSize: 13, margin: "0 0 1rem" }}>
            {svPanel.importReviewHint}
          </p>

          {duplicate && (
            <p className="panel-flash panel-flash--error">
              {svPanel.importDuplicate} “{duplicate.title}”
            </p>
          )}

          {parsed.notes.length > 0 && (
            <ul style={{ color: "#8A6D3B", fontSize: 13, margin: "0 0 1rem", paddingLeft: 18 }}>
              {parsed.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}

          <input type="hidden" name="sourceUrl" value={parsed.sourceUrl} />
          <input
            type="hidden"
            name="locationText"
            value={parsed.locationText ?? ""}
          />

          <div className="panel-form">
            <label className="panel-form__field" style={{ flexBasis: "100%" }}>
              <span className="auth-field__label">{svPanel.listingTitleLabel}</span>
              <input
                className="auth-field__input"
                name="title"
                defaultValue={parsed.title ?? ""}
                maxLength={180}
                required
              />
            </label>

            <label className="panel-form__field" style={{ flexBasis: "100%" }}>
              <span className="auth-field__label">
                {svPanel.listingDescriptionLabel}
              </span>
              <textarea
                className="panel-reject__textarea"
                name="descriptionEs"
                rows={4}
                defaultValue={parsed.description ?? ""}
              />
            </label>

            <label className="panel-form__field">
              <span className="auth-field__label">{svPanel.listingOperationLabel}</span>
              <select
                className="panel-select"
                name="operation"
                defaultValue={parsed.operation ?? ""}
                required
              >
                <option value="">—</option>
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
                defaultValue={parsed.propertyType ?? ""}
                required
              >
                <option value="">—</option>
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
                min={1}
                step={1}
                defaultValue={parsed.priceEur ?? ""}
                required
              />
            </label>

            <label className="panel-form__field" style={{ flexBasis: "100%" }}>
              <span className="auth-field__label">{svPanel.importLocationLabel}</span>
              <select
                className="panel-select"
                name="locationId"
                defaultValue={suggestedLocationId ?? ""}
                required
              >
                <option value="">—</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="panel-form__field">
              <span className="auth-field__label">{svPanel.listingBedroomsLabel}</span>
              <input
                className="auth-field__input"
                name="bedrooms"
                type="number"
                min={0}
                defaultValue={parsed.bedrooms ?? ""}
              />
            </label>

            <label className="panel-form__field">
              <span className="auth-field__label">{svPanel.listingBathroomsLabel}</span>
              <input
                className="auth-field__input"
                name="bathrooms"
                type="number"
                min={0}
                defaultValue={parsed.bathrooms ?? ""}
              />
            </label>

            <label className="panel-form__field">
              <span className="auth-field__label">{svPanel.listingParkingLabel}</span>
              <input
                className="auth-field__input"
                name="parking"
                type="number"
                min={0}
                defaultValue={parsed.parking ?? ""}
              />
            </label>

            <label className="panel-form__field">
              <span className="auth-field__label">{svPanel.listingAreaLabel}</span>
              <input
                className="auth-field__input"
                name="builtM2"
                type="number"
                min={0}
                step="0.01"
                defaultValue={parsed.builtM2 ?? ""}
              />
            </label>

            <label className="panel-form__field">
              <span className="auth-field__label">{svPanel.listingLandLabel}</span>
              <input
                className="auth-field__input"
                name="plotM2"
                type="number"
                min={0}
                step="0.01"
                defaultValue={parsed.plotM2 ?? ""}
              />
            </label>
          </div>

          <p style={{ color: "#55655F", fontSize: 12.5, marginTop: 4 }}>
            {svPanel.importPhotosNote}
          </p>

          {/* The attestation. Required, unchecked by default, and re-checked
              server-side — the claim is the legal basis for the import. */}
          <label className="auth-choice__option" style={{ marginTop: 14 }}>
            <input type="checkbox" name="ownership" value="1" required />
            <span style={{ fontSize: 13.5 }}>{svPanel.importOwnershipLabel}</span>
          </label>

          <div style={{ marginTop: 16 }}>
            <button className="panel-btn panel-btn--primary" type="submit">
              {svPanel.importCreate}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
