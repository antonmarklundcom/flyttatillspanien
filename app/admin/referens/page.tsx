import type { Metadata } from "next";
import { PanelBar } from "@/components/panel/PanelBar";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { countReviewQueue } from "@/lib/panel-queries";
import {
  getFxRateDetail,
  listAcquisitionCosts,
} from "@/lib/reference-queries";
import { isFxFresh } from "@/lib/format";
import { svPanel } from "@/i18n/sv";
import { adminTabs } from "../tabs";
import {
  adminSetFxRateAction,
  adminUpdateAcquisitionCostAction,
} from "./actions";

export const metadata: Metadata = {
  title: `Referensdata`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const FLASH: Record<string, { text: string; error?: boolean }> = {
  fx_saved: { text: svPanel.referenceFxSaved },
  fx_invalid: { text: svPanel.referenceFxInvalid, error: true },
  costs_saved: { text: svPanel.referenceCostsSaved },
  costs_invalid: { text: svPanel.referenceCostsInvalid, error: true },
};

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("sv-SE");
}

export default async function AdminReferencePage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const [{ msg }, user] = await Promise.all([
    searchParams,
    requireSuperAdmin(),
  ]);
  const [reviewCount, fx, costs] = await Promise.all([
    countReviewQueue(),
    getFxRateDetail(),
    listAcquisitionCosts(),
  ]);

  const flash = msg ? FLASH[msg] : undefined;
  const fxFresh = isFxFresh(fx);

  return (
    <>
      <PanelBar
        title="Panel de administración"
        role={user.role}
        userName={user.name}
        tabs={adminTabs("reference", reviewCount)}
      />
      <main className="panel site-main">
        {flash ? (
          <p className={flash.error ? "auth-error" : "panel-flash"}>
            {flash.text}
          </p>
        ) : null}

        <h2 className="panel-section__title">{svPanel.referenceFxTitle}</h2>
        <article className="panel-card">
          <p className="panel-card__meta">{svPanel.referenceFxHint}</p>

          {fx ? (
            <p className="panel-card__meta">
              <span>
                1 EUR = {fx.rate.toLocaleString("sv-SE")} SEK
                {fxFresh ? null : ` — ${svPanel.referenceFxStale}`}
              </span>
              <span>
                {svPanel.referenceFxObservedLabel}: {fx.observedOn}
              </span>
              <span>
                {svPanel.referenceFxSourceLabel}:{" "}
                {fx.source === "manual"
                  ? svPanel.referenceFxSourceManual
                  : svPanel.referenceFxSourceEcb}
              </span>
              <span>
                {svPanel.referenceFxFetchedLabel}: {fmtDate(fx.fetchedAt)}
              </span>
            </p>
          ) : (
            <p className="panel-empty">{svPanel.referenceFxNone}</p>
          )}

          <form action={adminSetFxRateAction} className="panel-form">
            <label className="panel-form__field">
              <span className="auth-field__label">
                {svPanel.referenceFxRateLabel}
              </span>
              <input
                className="auth-field__input"
                name="rate"
                type="number"
                min="0"
                step="any"
                defaultValue={fx?.rate ?? ""}
                required
              />
            </label>
            <label className="panel-form__field">
              <span className="auth-field__label">
                {svPanel.referenceFxObservedLabel}
              </span>
              <input className="auth-field__input" name="observedOn" type="date" />
            </label>
            <div className="panel-form__field panel-form__field--action">
              <button className="panel-btn panel-btn--primary" type="submit">
                {svPanel.referenceFxSave}
              </button>
            </div>
          </form>
        </article>

        <h2 className="panel-section__title" style={{ marginTop: 32 }}>
          {svPanel.referenceCostsTitle}
        </h2>
        <p className="panel-card__meta">{svPanel.referenceCostsHint}</p>

        {costs.map((c) => (
          <article className="panel-card" key={c.region}>
            <h3 className="panel-card__title">
              {c.name} <span className="panel-card__meta">({c.region})</span>
            </h3>
            <p className="panel-card__meta">
              {c.updatedAt
                ? svPanel.referenceCostsUpdatedLabel(fmtDate(c.updatedAt))
                : svPanel.referenceCostsUpdatedNever}
            </p>

            <form
              action={adminUpdateAcquisitionCostAction}
              className="panel-form"
            >
              <input type="hidden" name="region" value={c.region} />

              <label className="panel-form__field">
                <span className="auth-field__label">
                  {svPanel.referenceCostsItpLabel}
                </span>
                <input
                  className="auth-field__input"
                  name="itpPct"
                  type="number"
                  min="0"
                  step="any"
                  defaultValue={c.itpPct}
                />
              </label>

              <label className="panel-form__field">
                <span className="auth-field__label">
                  {svPanel.referenceCostsIvaLabel}
                </span>
                <input
                  className="auth-field__input"
                  name="ivaPct"
                  type="number"
                  min="0"
                  step="any"
                  defaultValue={c.ivaPct}
                />
              </label>

              <label className="panel-form__field">
                <span className="auth-field__label">
                  {svPanel.referenceCostsAjdLabel}
                </span>
                <input
                  className="auth-field__input"
                  name="ajdPct"
                  type="number"
                  min="0"
                  step="any"
                  defaultValue={c.ajdPct}
                />
              </label>

              <label className="panel-form__field">
                <span className="auth-field__label">
                  {svPanel.referenceCostsNotaryLabel}
                </span>
                <input
                  className="auth-field__input"
                  name="notaryPctEst"
                  type="number"
                  min="0"
                  step="any"
                  defaultValue={c.notaryPctEst}
                />
              </label>

              <label className="panel-form__field">
                <span className="auth-field__label">
                  {svPanel.referenceCostsRegistryLabel}
                </span>
                <input
                  className="auth-field__input"
                  name="registryPctEst"
                  type="number"
                  min="0"
                  step="any"
                  defaultValue={c.registryPctEst}
                />
              </label>

              <label className="panel-form__field">
                <span className="auth-field__label">
                  {svPanel.referenceCostsLegalLabel}
                </span>
                <input
                  className="auth-field__input"
                  name="legalPctEst"
                  type="number"
                  min="0"
                  step="any"
                  defaultValue={c.legalPctEst}
                />
              </label>

              <label className="panel-form__field" style={{ flexBasis: "100%" }}>
                <span className="auth-field__label">
                  {svPanel.referenceCostsSourceLabel}
                </span>
                <input
                  className="auth-field__input"
                  name="sourceUrl"
                  type="url"
                  maxLength={400}
                  defaultValue={c.sourceUrl ?? ""}
                  placeholder="https://…"
                />
              </label>

              <label className="panel-form__field panel-form__check">
                <input
                  type="checkbox"
                  name="active"
                  value="1"
                  defaultChecked={c.active}
                />
                <span>{svPanel.referenceCostsActiveLabel}</span>
              </label>

              <div className="panel-form__field panel-form__field--action">
                <button className="panel-btn panel-btn--primary" type="submit">
                  {svPanel.referenceCostsSave}
                </button>
              </div>
            </form>
          </article>
        ))}
      </main>
    </>
  );
}
