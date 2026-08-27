"use client";

/**
 * The valuation form and its result.
 *
 * The estimate comes back before any contact field is shown: the number is the
 * value we give away, and the lead is what the visitor may choose to give in
 * return. Gating the number behind a phone number would earn one lead and lose
 * the trust that makes them come back to publish.
 *
 * Every caveat the calculation carries is rendered, not tucked into a tooltip —
 * this is the one screen that puts a price on a property nobody has seen.
 */
import { useState } from "react";
import Link from "next/link";
import { svTasacion } from "@/i18n/sv";
import { formatEur } from "@/lib/format";
import { PROPERTY_TYPE_OPTIONS } from "@/lib/property-types";
import type { ValuationResult } from "@/lib/valuation";
import type { estimateAction, requestValuationContactAction } from "../../app/tasacion/actions";

/**
 * /publicar with the valuation's answers attached. The wizard treats these as
 * a seed only — a draft already in progress wins — and re-validates every
 * value server-side, so nothing here is trusted beyond "what the visitor typed
 * one screen ago".
 */
function publishHref(
  citySlug: string,
  propertyType: string,
  operation: string,
  area: string,
): string {
  const qs = new URLSearchParams({
    ciudad: citySlug,
    tipo: propertyType,
    operacion: operation,
  });
  if (area.trim() !== "") qs.set("m2", area.trim());
  return `/publicar?${qs.toString()}`;
}

const ERROR_TEXT: Record<string, string> = {
  bad_area: svTasacion.errorBadArea,
  unknown_city: svTasacion.errorUnknownCity,
  no_data: svTasacion.errorNoData,
  thin_data: svTasacion.errorThinData,
};

export function ValuationTool({
  cities,
  estimate,
  requestContact,
}: {
  cities: { slug: string; name: string }[];
  estimate: typeof estimateAction;
  requestContact: typeof requestValuationContactAction;
}) {
  const [citySlug, setCitySlug] = useState(cities[0]?.slug ?? "");
  const [propertyType, setPropertyType] = useState("casa");
  const [operation, setOperation] = useState("venta");
  const [area, setArea] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ValuationResult | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const [leadError, setLeadError] = useState(false);

  async function calculate() {
    setBusy(true);
    setResult(null);
    setLeadSent(false);
    try {
      setResult(
        await estimate({
          citySlug,
          propertyType,
          operation,
          areaM2: Number(area),
        }),
      );
    } catch {
      setResult({ ok: false, reason: "no_data" });
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!result?.ok) return;
    setLeadBusy(true);
    setLeadError(false);
    try {
      const typeLabel =
        PROPERTY_TYPE_OPTIONS.find((o) => o.value === propertyType)?.label ??
        propertyType;
      const res = await requestContact({
        name,
        email,
        // Plain-text context so /admin/leads is readable without a join.
        context:
          `Tasación: ${typeLabel} de ${area} m² en ${result.cityName} ` +
          `(${operation}). Rango estimado ${formatEur(result.lowEur)}–${formatEur(result.highEur)}, ` +
          `mediana ${formatEur(result.pricePerM2Eur)}/m², ${result.sampleSize} comparables.`,
      });
      if (res.ok) setLeadSent(true);
      else setLeadError(true);
    } catch {
      setLeadError(true);
    } finally {
      setLeadBusy(false);
    }
  }

  return (
    <>
      <div className="tasacion-card">
        <div className="tasacion-grid">
          <label className="tasacion-field">
            <span className="tasacion-label">{svTasacion.cityLabel}</span>
            <select
              className="panel-select"
              value={citySlug}
              onChange={(e) => setCitySlug(e.target.value)}
            >
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="tasacion-field">
            <span className="tasacion-label">{svTasacion.typeLabel}</span>
            <select
              className="panel-select"
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
            >
              {PROPERTY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="tasacion-field">
            <span className="tasacion-label">{svTasacion.operationLabel}</span>
            <select
              className="panel-select"
              value={operation}
              onChange={(e) => setOperation(e.target.value)}
            >
              <option value="venta">{svTasacion.operationSale}</option>
              <option value="alquiler">{svTasacion.operationRent}</option>
            </select>
          </label>

          <label className="tasacion-field">
            <span className="tasacion-label">{svTasacion.areaLabel}</span>
            <input
              className="auth-field__input"
              type="number"
              inputMode="numeric"
              min={10}
              max={100000}
              value={area}
              onChange={(e) => setArea(e.target.value)}
            />
            <span className="tasacion-hint">{svTasacion.areaHint}</span>
          </label>
        </div>

        <button
          className="panel-btn panel-btn--primary tasacion-submit"
          type="button"
          onClick={() => void calculate()}
          disabled={busy || area.trim() === ""}
        >
          {busy ? svTasacion.calculating : svTasacion.submit}
        </button>
      </div>

      {result && !result.ok && (
        <div className="tasacion-card tasacion-card--muted">
          <p style={{ margin: 0 }}>
            {ERROR_TEXT[result.reason] ?? svTasacion.errorGeneric}
          </p>
        </div>
      )}

      {result?.ok && (
        <div className="tasacion-result">
          <div className="tasacion-result__label">{svTasacion.resultTitle}</div>
          <div className="tasacion-result__range">
            {svTasacion.resultRange(
              formatEur(result.lowEur),
              formatEur(result.highEur),
            )}
          </div>
          <p className="tasacion-result__basis">
            {svTasacion.resultBasis(
              result.sampleSize,
              formatEur(result.pricePerM2Eur),
              result.cityName,
              result.period,
            )}
          </p>
          <p className="tasacion-result__basis">
            {svTasacion.resultBandNote(result.bandPct)}
          </p>
          <p className="tasacion-disclaimer">{svTasacion.disclaimer}</p>

          <div className="tasacion-next">
            <h2 style={{ fontSize: 17, margin: "0 0 .25rem" }}>
              {svTasacion.nextTitle}
            </h2>
            <p className="tasacion-hint" style={{ marginTop: 0 }}>
              {svTasacion.nextBody} {svTasacion.publishCtaHint}
            </p>

            {leadSent ? (
              <p className="panel-flash">{svTasacion.contactSent}</p>
            ) : (
              <div className="tasacion-grid">
                <label className="tasacion-field">
                  <span className="tasacion-label">{svTasacion.nameLabel}</span>
                  <input
                    className="auth-field__input"
                    value={name}
                    maxLength={140}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="tasacion-field">
                  <span className="tasacion-label">
                    {svTasacion.whatsappLabel}
                  </span>
                  <input
                    className="auth-field__input"
                    type="email"
                    inputMode="email"
                    placeholder="namn@exempel.se"
                    value={email}
                    maxLength={190}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              </div>
            )}

            {leadError && <p className="auth-error">{svTasacion.contactError}</p>}

            <div className="tasacion-actions">
              {!leadSent && (
                <button
                  className="panel-btn panel-btn--whatsapp"
                  type="button"
                  onClick={() => void send()}
                  disabled={leadBusy || !email.includes("@")}
                >
                  {svTasacion.contactSubmit}
                </button>
              )}
              {/* Carry the four answers the valuation already collected into
                  the wizard (audit I4): the visitor who just learned what
                  their property is worth is the likeliest publisher the
                  portal will see, and re-asking is where they drop out.
                  Price is deliberately NOT carried: the estimate is a
                  reference band from published asking prices, and seeding it
                  as an asking price would anchor the market on our own
                  output. */}
              <Link
                className="panel-btn panel-btn--primary"
                href={publishHref(citySlug, propertyType, operation, area)}
              >
                {svTasacion.publishCta}
              </Link>
              <Link className="panel-btn" href={`/precios/${citySlug}`}>
                {svTasacion.seePrices}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
