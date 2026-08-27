"use client";

/**
 * 3-step publish wizard (ARCHITECTURE.md §3, M5). Detalles → Ubicación →
 * Precio & publicación, then WhatsApp OTP at publish. Autosave is two-layer:
 * localStorage on every change (instant, survives a reload) and a server draft
 * (a status='draft' listings row) written when a step is completed, so a draft
 * also survives a device change and shows up in the panel. All identity,
 * ownership and the verified flag are decided server-side in ../app/publicar/
 * actions.ts — this component only collects and previews.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { bestCuota, type FinancingProgram } from "@/lib/cuota";
import { formatCuota } from "@/lib/format";
import { esPublish } from "@/i18n/es";
import { PROPERTY_TYPE_OPTIONS } from "@/lib/property-types";
import type { NearbyProject, PublishLocation } from "@/lib/publish-queries";
import type { Operation, PropertyType } from "@/lib/import/types";
import {
  publishDraftAction,
  requestOtpAction,
  saveDraftAction,
  verifyAndPublishAction,
  type DraftPayload,
} from "../../../app/publicar/actions";
import {
  deleteDraftPhotoAction,
  uploadDraftPhotosAction,
} from "../../../app/publicar/photo-actions";
import { imageThumbUrl } from "@/lib/format";
import type { ListingImageRow } from "@/lib/listing-images";

const OPERATION_OPTIONS: { value: Operation; label: string }[] = [
  { value: "venta", label: "Venta" },
  { value: "alquiler", label: "Alquiler" },
  { value: "alquiler_temporal", label: "Alquiler temporal" },
];

/** Terrenos have no rooms; every other type does. */
function hasRooms(t: PropertyType | ""): boolean {
  return t !== "" && t !== "terreno";
}

interface WizardState {
  draftId: number | null;
  operation: Operation | "";
  propertyType: PropertyType | "";
  title: string;
  descriptionEs: string;
  bedrooms: string;
  bathrooms: string;
  parking: string;
  areaM2: string;
  landM2: string;
  locationId: number;
  projectId: number | null;
  priceCurrency: "USD" | "PYG";
  priceAmount: string;
  videoUrl: string;
  foreignExposure: boolean;
}

export interface InitialDraft extends Partial<WizardState> {
  draftId: number | null;
}

/**
 * Fields carried in from another screen — today only /tasacion, which already
 * asked for the operation, type, city and m² it needed to price the property
 * (audit I4). It is a convenience, never work: it loses to a server draft and
 * to a draft in progress on this device.
 */
export type PublishPrefill = Partial<
  Pick<WizardState, "operation" | "propertyType" | "areaM2" | "landM2" | "locationId">
>;

const EMPTY: WizardState = {
  draftId: null,
  operation: "",
  propertyType: "",
  title: "",
  descriptionEs: "",
  bedrooms: "",
  bathrooms: "",
  parking: "",
  areaM2: "",
  landM2: "",
  locationId: 0,
  projectId: null,
  priceCurrency: "USD",
  priceAmount: "",
  videoUrl: "",
  foreignExposure: true,
};

const LS_KEY = "propia:publish-draft";

export function PublishWizard({
  locations,
  projects,
  programs,
  usdToPyg,
  initialDraft,
  initialPhotos,
  prefill,
  otpEnabled,
  homeHref,
}: {
  locations: PublishLocation[];
  projects: NearbyProject[];
  programs: FinancingProgram[];
  usdToPyg: number;
  initialDraft: InitialDraft | null;
  initialPhotos?: ListingImageRow[];
  /** Seed values from /tasacion. See PublishPrefill. */
  prefill?: PublishPrefill | null;
  /**
   * Whether a WhatsApp code can actually be delivered. False → publish
   * directly; the server enforces the same rule, this only shapes the UI.
   */
  otpEnabled: boolean;
  homeHref: string;
}) {
  const [state, setState] = useState<WizardState>(() => ({
    ...EMPTY,
    ...initialDraft,
    draftId: initialDraft?.draftId ?? null,
  }));
  const [step, setStep] = useState(0); // 0..2
  const [saving, setSaving] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // Photos live on the server as soon as there is a draft row to hang them
  // on — there is no client-side "pending upload" state to lose on reload.
  const [photos, setPhotos] = useState<ListingImageRow[]>(initialPhotos ?? []);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // OTP sub-state (step 3 → publish).
  const [otpSent, setOtpSent] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [code, setCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Layer 1 autosave: mirror to localStorage on every change (skip once done).
  useEffect(() => {
    if (done) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      /* storage full / disabled — the server draft is the durable copy */
    }
  }, [state, done]);

  /**
   * Rehydrate from localStorage only when there's no server draft to resume,
   * and fall back to the /tasacion prefill only when there is no local draft
   * either. Precedence is server draft → local draft → prefill: a half-typed
   * listing on this device is work, and a prefill is four fields the visitor
   * can retype, so the prefill must never be the thing that overwrites it.
   */
  useEffect(() => {
    if (initialDraft) return;
    let stored: Partial<WizardState> | null = null;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) stored = JSON.parse(raw) as Partial<WizardState>;
    } catch {
      /* ignore */
    }
    if (stored) {
      setState((s) => ({ ...s, ...stored }));
    } else if (prefill) {
      setState((s) => ({ ...s, ...prefill }));
      setPrefilled(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const set = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  }, []);

  const locationLabel = useMemo(() => {
    const byId = new Map(locations.map((l) => [l.id, l.label]));
    return byId.get(state.locationId) ?? "";
  }, [locations, state.locationId]);

  const projectName = useMemo(() => {
    const byId = new Map(projects.map((p) => [p.id, p.name]));
    return state.projectId ? byId.get(state.projectId) ?? "" : "";
  }, [projects, state.projectId]);

  // Cuota preview (venta only), computed client-side from the same engine the
  // nightly cron uses. Converts the entered price to Gs first.
  const cuotaPreview = useMemo(() => {
    if (state.operation !== "venta") return null;
    const amount = Number(state.priceAmount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const priceGs = state.priceCurrency === "PYG" ? amount : amount * usdToPyg;
    const best = bestCuota(priceGs, programs);
    if (!best) return null;
    return { text: formatCuota(best.monthlyGs), programName: best.programName };
  }, [state.operation, state.priceAmount, state.priceCurrency, usdToPyg, programs]);

  const payload = useCallback(
    (): DraftPayload => ({
      draftId: state.draftId,
      operation: state.operation || undefined,
      propertyType: state.propertyType || undefined,
      title: state.title,
      descriptionEs: state.descriptionEs,
      priceAmount: Number(state.priceAmount) || 0,
      priceCurrency: state.priceCurrency,
      bedrooms: hasRooms(state.propertyType) ? numOrNull(state.bedrooms) : null,
      bathrooms: hasRooms(state.propertyType) ? numOrNull(state.bathrooms) : null,
      parking: numOrNull(state.parking),
      areaM2: numOrNull(state.areaM2),
      landM2: numOrNull(state.landM2),
      locationId: state.locationId,
      projectId: state.projectId,
      videoUrl: state.videoUrl,
      foreignExposure: state.foreignExposure,
    }),
    [state],
  );

  /**
   * Upload picked files against the current draft. The server returns the new
   * image list rather than us patching state optimistically — position is
   * decided server-side, and a half-rejected batch must not leave the grid
   * claiming photos that were never stored.
   */
  const uploadPhotos = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !state.draftId) return;
      setPhotoBusy(true);
      setPhotoError(null);
      try {
        const fd = new FormData();
        fd.set("draftId", String(state.draftId));
        for (const file of Array.from(files)) fd.append("photos", file);

        const res = await uploadDraftPhotosAction(fd);
        if (!res.ok) {
          setPhotoError(
            res.error === "not_configured"
              ? esPublish.photosStorageOff
              : res.error === "too_many"
                ? esPublish.photosTooMany
                : esPublish.photosFailed,
          );
          return;
        }
        setPhotos(res.images);
        if (res.rejected.length > 0) setPhotoError(esPublish.photosFailed);
      } catch {
        setPhotoError(esPublish.photosFailed);
      } finally {
        setPhotoBusy(false);
      }
    },
    [state.draftId],
  );

  const removePhoto = useCallback(
    async (imageId: number) => {
      if (!state.draftId) return;
      setPhotoBusy(true);
      try {
        const res = await deleteDraftPhotoAction(state.draftId, imageId);
        if (res.ok) setPhotos(res.images);
      } catch {
        setPhotoError(esPublish.photosFailed);
      } finally {
        setPhotoBusy(false);
      }
    },
    [state.draftId],
  );

  /** Persist the server draft; returns the (possibly new) draft id or null. */
  const persist = useCallback(async (): Promise<number | null> => {
    setSaving(true);
    setStepError(null);
    try {
      const res = await saveDraftAction(payload());
      if (!res.ok) {
        setStepError(esPublish.errors[res.error] ?? esPublish.errors.generic);
        return null;
      }
      if (res.draftId !== state.draftId) set("draftId", res.draftId);
      return res.draftId;
    } catch {
      setStepError(esPublish.errors.generic);
      return null;
    } finally {
      setSaving(false);
    }
  }, [payload, set, state.draftId]);

  const validateStep = useCallback(
    (i: number): string | null => {
      if (i === 0) {
        if (!state.operation) return esPublish.errors.operation;
        if (!state.propertyType) return esPublish.errors.propertyType;
        if (state.title.trim().length < 8) return esPublish.errors.title;
      }
      if (i === 1 && !state.locationId) return esPublish.errors.location;
      if (i === 2 && !(Number(state.priceAmount) > 0)) return esPublish.errors.price;
      return null;
    },
    [state],
  );

  const goNext = useCallback(async () => {
    const err = validateStep(step);
    if (err) {
      setStepError(err);
      return;
    }
    // Step 1 completes the required core → we can persist the server draft.
    const saved = await persist();
    if (saved === null) return;
    setStep((s) => Math.min(2, s + 1));
  }, [persist, step, validateStep]);

  const goBack = useCallback(() => {
    setStepError(null);
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const sendCode = useCallback(async () => {
    setOtpBusy(true);
    setOtpError(null);
    try {
      // Make sure the latest edits are on the draft before we verify & publish.
      const saved = await persist();
      if (saved === null) return;
      const res = await requestOtpAction(whatsapp);
      if (!res.ok) {
        if (res.error === "cooldown") {
          setCooldown(Math.ceil((res.cooldownMs ?? 60000) / 1000));
          setOtpSent(true);
        } else {
          setOtpError(esPublish.errors.invalidNumber);
        }
        return;
      }
      setOtpSent(true);
      setCooldown(60);
    } catch {
      setOtpError(esPublish.errors.generic);
    } finally {
      setOtpBusy(false);
    }
  }, [persist, whatsapp]);

  /** Publish with no code, when none can be delivered (otpEnabled === false). */
  const publishDirect = useCallback(async () => {
    setOtpBusy(true);
    setOtpError(null);
    try {
      const saved = await persist();
      if (saved === null) return;
      const res = await publishDraftAction({ draftId: saved, whatsapp });
      if (!res.ok) {
        setOtpError(esPublish.errors.generic);
        return;
      }
      try {
        localStorage.removeItem(LS_KEY);
      } catch {
        /* ignore */
      }
      setDone(true);
    } catch {
      setOtpError(esPublish.errors.generic);
    } finally {
      setOtpBusy(false);
    }
  }, [persist, whatsapp]);

  const verifyAndPublish = useCallback(async () => {
    if (!state.draftId) return;
    setOtpBusy(true);
    setOtpError(null);
    try {
      const res = await verifyAndPublishAction({
        draftId: state.draftId,
        whatsapp,
        code,
      });
      if (!res.ok) {
        setOtpError(
          res.error === "too_many"
            ? esPublish.errors.otpTooMany
            : res.error === "otp"
              ? esPublish.errors.otpMismatch
              : esPublish.errors.generic,
        );
        return;
      }
      try {
        localStorage.removeItem(LS_KEY);
      } catch {
        /* ignore */
      }
      setDone(true);
    } catch {
      setOtpError(esPublish.errors.generic);
    } finally {
      setOtpBusy(false);
    }
  }, [state.draftId, whatsapp, code]);

  if (done) {
    return (
      <div className="wizard-done">
        <div className="wizard-done__check">✓</div>
        <h2 className="wizard-done__title">{esPublish.doneTitle}</h2>
        <p className="wizard-done__body">{esPublish.doneBody}</p>
        <a className="panel-btn panel-btn--primary" href={homeHref}>
          {esPublish.doneCta}
        </a>
      </div>
    );
  }

  const rooms = hasRooms(state.propertyType);

  return (
    <div className="wizard">
      <ol className="wizard-steps" aria-label="Pasos">
        {esPublish.stepLabels.map((label, i) => (
          <li
            key={label}
            className={`wizard-step${i === step ? " wizard-step--active" : ""}${
              i < step ? " wizard-step--done" : ""
            }`}
          >
            <span className="wizard-step__num">{i < step ? "✓" : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {/* Say why fields arrived filled in — an unexplained pre-filled form
          reads as someone else's data, not as a shortcut. */}
      {prefilled && step === 0 && (
        <p className="wizard-prefill">{esPublish.prefillNote}</p>
      )}

      {/* Step 1 — Detalles */}
      {step === 0 && (
        <div className="wizard-panel">
          <div className="wizard-field">
            <label className="wizard-label">{esPublish.operationLabel}</label>
            <div className="wizard-chips">
              {OPERATION_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`wizard-chip${state.operation === o.value ? " wizard-chip--on" : ""}`}
                  onClick={() => set("operation", o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="wizard-field">
            <label className="wizard-label" htmlFor="ptype">
              {esPublish.propertyTypeLabel}
            </label>
            <select
              id="ptype"
              className="wizard-input"
              value={state.propertyType}
              onChange={(e) => set("propertyType", e.target.value as PropertyType)}
            >
              <option value="">—</option>
              {PROPERTY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="wizard-field">
            <label className="wizard-label" htmlFor="title">
              {esPublish.titleLabel}
            </label>
            <input
              id="title"
              className="wizard-input"
              value={state.title}
              maxLength={180}
              placeholder={esPublish.titlePlaceholder}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>

          <div className="wizard-field">
            <label className="wizard-label" htmlFor="desc">
              {esPublish.descriptionLabel}
            </label>
            <textarea
              id="desc"
              className="wizard-input wizard-textarea"
              value={state.descriptionEs}
              rows={5}
              placeholder={esPublish.descriptionPlaceholder}
              onChange={(e) => set("descriptionEs", e.target.value)}
            />
          </div>

          <div className="wizard-grid">
            {rooms && (
              <>
                <NumField label={esPublish.bedroomsLabel} value={state.bedrooms} onChange={(v) => set("bedrooms", v)} />
                <NumField label={esPublish.bathroomsLabel} value={state.bathrooms} onChange={(v) => set("bathrooms", v)} />
                <NumField label={esPublish.parkingLabel} value={state.parking} onChange={(v) => set("parking", v)} />
                <NumField label={esPublish.areaLabel} value={state.areaM2} onChange={(v) => set("areaM2", v)} />
              </>
            )}
            <NumField label={esPublish.landLabel} value={state.landM2} onChange={(v) => set("landM2", v)} />
          </div>
        </div>
      )}

      {/* Step 2 — Ubicación */}
      {step === 1 && (
        <div className="wizard-panel">
          <div className="wizard-field">
            <label className="wizard-label" htmlFor="loc">
              {esPublish.locationLabel}
            </label>
            <input
              id="loc"
              className="wizard-input"
              list="loc-list"
              defaultValue={locationLabel}
              placeholder={esPublish.locationPlaceholder}
              onChange={(e) => {
                const hit = locations.find((l) => l.label === e.target.value);
                set("locationId", hit ? hit.id : 0);
              }}
            />
            <datalist id="loc-list">
              {locations.map((l) => (
                <option key={l.id} value={l.label} />
              ))}
            </datalist>
            <p className="wizard-hint">{esPublish.locationHint}</p>
          </div>

          {projects.length > 0 && (
            <div className="wizard-field">
              <label className="wizard-label" htmlFor="proj">
                {esPublish.projectLabel}
              </label>
              <input
                id="proj"
                className="wizard-input"
                list="proj-list"
                defaultValue={projectName}
                placeholder={esPublish.projectPlaceholder}
                onChange={(e) => {
                  const hit = projects.find((p) => p.name === e.target.value);
                  set("projectId", hit ? hit.id : null);
                }}
              />
              <datalist id="proj-list">
                {projects.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
              <p className="wizard-hint">{esPublish.projectHint}</p>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Precio y publicación */}
      {step === 2 && (
        <div className="wizard-panel">
          <div className="wizard-field">
            <label className="wizard-label">{esPublish.priceLabel}</label>
            <div className="wizard-price">
              <select
                className="wizard-input wizard-currency"
                value={state.priceCurrency}
                onChange={(e) => set("priceCurrency", e.target.value as "USD" | "PYG")}
              >
                <option value="USD">US$</option>
                <option value="PYG">Gs</option>
              </select>
              <input
                className="wizard-input"
                inputMode="numeric"
                value={state.priceAmount}
                placeholder="0"
                onChange={(e) => set("priceAmount", e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
            {cuotaPreview && (
              <p className="wizard-cuota">
                🏦 {cuotaPreview.text} {esPublish.cuotaWith} {cuotaPreview.programName}
              </p>
            )}
          </div>

          <div className="wizard-field">
            <label className="wizard-label" htmlFor="video">
              {esPublish.videoLabel}
            </label>
            <input
              id="video"
              className="wizard-input"
              value={state.videoUrl}
              placeholder="https://youtube.com/..."
              onChange={(e) => set("videoUrl", e.target.value)}
            />
          </div>

          <div className="wizard-field">
            <span className="wizard-label">{esPublish.photosTitle}</span>
            <p className="wizard-hint">{esPublish.photosHint}</p>

            {state.draftId == null ? (
              <p className="wizard-hint">{esPublish.photosDraftFirst}</p>
            ) : (
              <>
                <input
                  className="wizard-input"
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={photoBusy}
                  onChange={(e) => {
                    void uploadPhotos(e.target.files);
                    // Let the same file be picked again after a failure.
                    e.target.value = "";
                  }}
                  aria-label={esPublish.photosPickLabel}
                />
                {photoBusy && (
                  <p className="wizard-hint">{esPublish.photosUploading}</p>
                )}
                {photoError && <p className="auth-error">{photoError}</p>}

                {photos.length > 0 && (
                  <ul className="wizard-photos">
                    {photos.map((photo) => (
                      <li key={photo.id} className="wizard-photos__item">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          className="wizard-photos__thumb"
                          src={imageThumbUrl(photo.r2Key) ?? ""}
                          alt=""
                          loading="lazy"
                        />
                        <button
                          type="button"
                          className="wizard-photos__remove"
                          onClick={() => void removePhoto(photo.id)}
                          disabled={photoBusy}
                        >
                          {esPublish.photosDelete}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <label className="wizard-toggle">
            <input
              type="checkbox"
              checked={state.foreignExposure}
              onChange={(e) => set("foreignExposure", e.target.checked)}
            />
            <span>{esPublish.foreignExposureLabel}</span>
          </label>

          {/* OTP-at-publish — only when a code can actually reach them. */}
          <div className="wizard-otp">
            <h3 className="wizard-otp__title">
              {otpEnabled ? esPublish.otpTitle : esPublish.publishTitle}
            </h3>
            <p className="wizard-hint">
              {otpEnabled ? esPublish.otpSubtitle : esPublish.publishSubtitle}
            </p>
            <div className="wizard-field">
              <label className="wizard-label" htmlFor="wa">
                {esPublish.whatsappLabel}
              </label>
              <input
                id="wa"
                className="wizard-input"
                inputMode="tel"
                value={whatsapp}
                placeholder="0981 123 456"
                onChange={(e) => setWhatsapp(e.target.value)}
                disabled={otpEnabled && otpSent}
              />
            </div>

            {otpEnabled && otpSent && (
              <div className="wizard-field">
                <label className="wizard-label" htmlFor="code">
                  {esPublish.codeLabel}
                </label>
                <input
                  id="code"
                  className="wizard-input wizard-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  placeholder="••••••"
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            )}

            {otpError && <p className="auth-error">{otpError}</p>}

            <div className="wizard-actions">
              {!otpEnabled ? (
                <button
                  type="button"
                  className="panel-btn panel-btn--primary"
                  onClick={publishDirect}
                  disabled={otpBusy || Number(state.priceAmount) <= 0}
                >
                  {otpBusy ? esPublish.publishing : esPublish.publish}
                </button>
              ) : !otpSent ? (
                <button
                  type="button"
                  className="panel-btn panel-btn--whatsapp"
                  onClick={sendCode}
                  disabled={otpBusy || Number(state.priceAmount) <= 0}
                >
                  {otpBusy ? esPublish.sending : esPublish.sendCode}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="panel-btn panel-btn--primary"
                    onClick={verifyAndPublish}
                    disabled={otpBusy || code.length !== 6}
                  >
                    {otpBusy ? esPublish.publishing : esPublish.publish}
                  </button>
                  <button
                    type="button"
                    className="panel-btn"
                    onClick={sendCode}
                    disabled={otpBusy || cooldown > 0}
                  >
                    {cooldown > 0 ? `${esPublish.resendIn} ${cooldown}s` : esPublish.resend}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {stepError && <p className="auth-error">{stepError}</p>}

      {/* Wizard nav (steps 1–2; step 3 publishes via the OTP panel). */}
      {step < 2 && (
        <div className="wizard-nav">
          {step > 0 ? (
            <button type="button" className="panel-btn" onClick={goBack}>
              {esPublish.back}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="panel-btn panel-btn--primary"
            onClick={goNext}
            disabled={saving}
          >
            {saving ? esPublish.saving : esPublish.next}
          </button>
        </div>
      )}
      {step === 2 && (
        <div className="wizard-nav">
          <button type="button" className="panel-btn" onClick={goBack}>
            {esPublish.back}
          </button>
          <span className="wizard-hint">{saving ? esPublish.saving : ""}</span>
        </div>
      )}
    </div>
  );
}

function numOrNull(v: string): number | null {
  const n = Number(v);
  return v.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="wizard-field">
      <label className="wizard-label">{label}</label>
      <input
        className="wizard-input"
        inputMode="numeric"
        value={value}
        placeholder="0"
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
      />
    </div>
  );
}
