"use client";

/**
 * 3-step publish wizard. Detaljer → Läge → Pris & publicering, then email
 * OTP at publish (Sweden is email-first, docs/SPAIN-PORTAL-DESIGN.md §3.7).
 * Autosave is two-layer: localStorage on every change (instant, survives a
 * reload) and a server draft (a status='draft' listings row) written when a
 * step is completed, so a draft also survives a device change and shows up
 * in the panel. All identity, ownership and the verified flag are decided
 * server-side in ../app/publicar/actions.ts — this component only collects
 * and previews.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { svPublish } from "@/i18n/sv";
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
  { value: "venta", label: "Köp" },
  { value: "alquiler", label: "Uthyrning" },
  { value: "alquiler_vacacional", label: "Korttidshyra" },
];

const ENERGY_RATING_OPTIONS = ["A", "B", "C", "D", "E", "F", "G", "en_tramite", "exento"] as const;

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
  builtM2: string;
  plotM2: string;
  locationId: number;
  projectId: number | null;
  priceEur: string;
  videoUrl: string;
  /**
   * Spain's RD 390/2021 requires the energy rating in the ad itself, and the
   * server refuses to publish without it (the gate lives in
   * listing-edit.ts/upsert.ts, not here — this is only the form's copy of
   * the same requirement).
   */
  energyRating: string;
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
  Pick<WizardState, "operation" | "propertyType" | "builtM2" | "plotM2" | "locationId">
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
  builtM2: "",
  plotM2: "",
  locationId: 0,
  projectId: null,
  priceEur: "",
  videoUrl: "",
  energyRating: "",
};

const LS_KEY = "ftse:publish-draft";

export function PublishWizard({
  locations,
  projects,
  initialDraft,
  initialPhotos,
  prefill,
  otpEnabled,
  homeHref,
}: {
  locations: PublishLocation[];
  projects: NearbyProject[];
  initialDraft: InitialDraft | null;
  initialPhotos?: ListingImageRow[];
  /** Seed values from /tasacion. See PublishPrefill. */
  prefill?: PublishPrefill | null;
  /**
   * Whether an email code can actually be delivered. False → publish
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
  const [email, setEmail] = useState("");
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

  const payload = useCallback(
    (): DraftPayload => ({
      draftId: state.draftId,
      operation: state.operation || undefined,
      propertyType: state.propertyType || undefined,
      title: state.title,
      descriptionEs: state.descriptionEs,
      priceEur: Number(state.priceEur) || 0,
      bedrooms: hasRooms(state.propertyType) ? numOrNull(state.bedrooms) : null,
      bathrooms: hasRooms(state.propertyType) ? numOrNull(state.bathrooms) : null,
      parking: numOrNull(state.parking),
      builtM2: numOrNull(state.builtM2),
      plotM2: numOrNull(state.plotM2),
      locationId: state.locationId,
      projectId: state.projectId,
      videoUrl: state.videoUrl,
      energyRating: state.energyRating || null,
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
              ? svPublish.photosStorageOff
              : res.error === "too_many"
                ? svPublish.photosTooMany
                : svPublish.photosFailed,
          );
          return;
        }
        setPhotos(res.images);
        if (res.rejected.length > 0) setPhotoError(svPublish.photosFailed);
      } catch {
        setPhotoError(svPublish.photosFailed);
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
        setPhotoError(svPublish.photosFailed);
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
        setStepError(svPublish.errors[res.error] ?? svPublish.errors.generic);
        return null;
      }
      if (res.draftId !== state.draftId) set("draftId", res.draftId);
      return res.draftId;
    } catch {
      setStepError(svPublish.errors.generic);
      return null;
    } finally {
      setSaving(false);
    }
  }, [payload, set, state.draftId]);

  const validateStep = useCallback(
    (i: number): string | null => {
      if (i === 0) {
        if (!state.operation) return svPublish.errors.operation;
        if (!state.propertyType) return svPublish.errors.propertyType;
        if (state.title.trim().length < 8) return svPublish.errors.title;
      }
      if (i === 1 && !state.locationId) return svPublish.errors.location;
      if (i === 2 && !(Number(state.priceEur) > 0)) return svPublish.errors.price;
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
      const res = await requestOtpAction(email);
      if (!res.ok) {
        if (res.error === "cooldown") {
          setCooldown(Math.ceil((res.cooldownMs ?? 60000) / 1000));
          setOtpSent(true);
        } else {
          setOtpError(svPublish.errors.invalidNumber);
        }
        return;
      }
      setOtpSent(true);
      setCooldown(60);
    } catch {
      setOtpError(svPublish.errors.generic);
    } finally {
      setOtpBusy(false);
    }
  }, [persist, email]);

  /** Publish with no code, when none can be delivered (otpEnabled === false). */
  const publishDirect = useCallback(async () => {
    setOtpBusy(true);
    setOtpError(null);
    try {
      const saved = await persist();
      if (saved === null) return;
      const res = await publishDraftAction({ draftId: saved });
      if (!res.ok) {
        setOtpError(svPublish.errors.generic);
        return;
      }
      try {
        localStorage.removeItem(LS_KEY);
      } catch {
        /* ignore */
      }
      setDone(true);
    } catch {
      setOtpError(svPublish.errors.generic);
    } finally {
      setOtpBusy(false);
    }
  }, [persist]);

  const verifyAndPublish = useCallback(async () => {
    if (!state.draftId) return;
    setOtpBusy(true);
    setOtpError(null);
    try {
      const res = await verifyAndPublishAction({
        draftId: state.draftId,
        email,
        code,
      });
      if (!res.ok) {
        setOtpError(
          res.error === "too_many"
            ? svPublish.errors.otpTooMany
            : res.error === "otp"
              ? svPublish.errors.otpMismatch
              : svPublish.errors.generic,
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
      setOtpError(svPublish.errors.generic);
    } finally {
      setOtpBusy(false);
    }
  }, [state.draftId, email, code]);

  if (done) {
    return (
      <div className="wizard-done">
        <div className="wizard-done__check">✓</div>
        <h2 className="wizard-done__title">{svPublish.doneTitle}</h2>
        <p className="wizard-done__body">{svPublish.doneBody}</p>
        <a className="panel-btn panel-btn--primary" href={homeHref}>
          {svPublish.doneCta}
        </a>
      </div>
    );
  }

  const rooms = hasRooms(state.propertyType);

  return (
    <div className="wizard">
      <ol className="wizard-steps" aria-label="Steg">
        {svPublish.stepLabels.map((label, i) => (
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
        <p className="wizard-prefill">{svPublish.prefillNote}</p>
      )}

      {/* Step 1 — Detaljer */}
      {step === 0 && (
        <div className="wizard-panel">
          <div className="wizard-field">
            <label className="wizard-label">{svPublish.operationLabel}</label>
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
              {svPublish.propertyTypeLabel}
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
              {svPublish.titleLabel}
            </label>
            <input
              id="title"
              className="wizard-input"
              value={state.title}
              maxLength={180}
              placeholder={svPublish.titlePlaceholder}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>

          <div className="wizard-field">
            <label className="wizard-label" htmlFor="desc">
              {svPublish.descriptionLabel}
            </label>
            <textarea
              id="desc"
              className="wizard-input wizard-textarea"
              value={state.descriptionEs}
              rows={5}
              placeholder={svPublish.descriptionPlaceholder}
              onChange={(e) => set("descriptionEs", e.target.value)}
            />
          </div>

          <div className="wizard-grid">
            {rooms && (
              <>
                <NumField label={svPublish.bedroomsLabel} value={state.bedrooms} onChange={(v) => set("bedrooms", v)} />
                <NumField label={svPublish.bathroomsLabel} value={state.bathrooms} onChange={(v) => set("bathrooms", v)} />
                <NumField label={svPublish.parkingLabel} value={state.parking} onChange={(v) => set("parking", v)} />
                <NumField label={svPublish.areaLabel} value={state.builtM2} onChange={(v) => set("builtM2", v)} />
              </>
            )}
            <NumField label={svPublish.landLabel} value={state.plotM2} onChange={(v) => set("plotM2", v)} />
          </div>
        </div>
      )}

      {/* Step 2 — Läge */}
      {step === 1 && (
        <div className="wizard-panel">
          <div className="wizard-field">
            <label className="wizard-label" htmlFor="loc">
              {svPublish.locationLabel}
            </label>
            <input
              id="loc"
              className="wizard-input"
              list="loc-list"
              defaultValue={locationLabel}
              placeholder={svPublish.locationPlaceholder}
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
            <p className="wizard-hint">{svPublish.locationHint}</p>
          </div>

          {projects.length > 0 && (
            <div className="wizard-field">
              <label className="wizard-label" htmlFor="proj">
                {svPublish.projectLabel}
              </label>
              <input
                id="proj"
                className="wizard-input"
                list="proj-list"
                defaultValue={projectName}
                placeholder={svPublish.projectPlaceholder}
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
              <p className="wizard-hint">{svPublish.projectHint}</p>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Pris och publicering */}
      {step === 2 && (
        <div className="wizard-panel">
          <div className="wizard-field">
            <label className="wizard-label">{svPublish.priceLabel} (€)</label>
            <div className="wizard-price">
              <input
                className="wizard-input"
                inputMode="numeric"
                value={state.priceEur}
                placeholder="0"
                onChange={(e) => set("priceEur", e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
          </div>

          <div className="wizard-field">
            <label className="wizard-label" htmlFor="energy">
              Energiklass
            </label>
            <select
              id="energy"
              className="wizard-input"
              value={state.energyRating}
              onChange={(e) => set("energyRating", e.target.value)}
            >
              <option value="">—</option>
              {ENERGY_RATING_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r === "en_tramite" ? "Ansökt" : r === "exento" ? "Undantagen" : r}
                </option>
              ))}
            </select>
            <p className="wizard-hint">
              Krävs enligt spansk lag (RD 390/2021) för att annonsen ska kunna publiceras.
            </p>
          </div>

          <div className="wizard-field">
            <label className="wizard-label" htmlFor="video">
              {svPublish.videoLabel}
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
            <span className="wizard-label">{svPublish.photosTitle}</span>
            <p className="wizard-hint">{svPublish.photosHint}</p>

            {state.draftId == null ? (
              <p className="wizard-hint">{svPublish.photosDraftFirst}</p>
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
                  aria-label={svPublish.photosPickLabel}
                />
                {photoBusy && (
                  <p className="wizard-hint">{svPublish.photosUploading}</p>
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
                          {svPublish.photosDelete}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {/* OTP-at-publish — only when a code can actually reach them. */}
          <div className="wizard-otp">
            <h3 className="wizard-otp__title">
              {otpEnabled ? svPublish.otpTitle : svPublish.publishTitle}
            </h3>
            <p className="wizard-hint">
              {otpEnabled ? svPublish.otpSubtitle : svPublish.publishSubtitle}
            </p>
            <div className="wizard-field">
              <label className="wizard-label" htmlFor="wa">
                {svPublish.whatsappLabel}
              </label>
              <input
                id="wa"
                className="wizard-input"
                type="email"
                inputMode="email"
                value={email}
                placeholder="namn@exempel.se"
                onChange={(e) => setEmail(e.target.value)}
                disabled={otpEnabled && otpSent}
              />
            </div>

            {otpEnabled && otpSent && (
              <div className="wizard-field">
                <label className="wizard-label" htmlFor="code">
                  {svPublish.codeLabel}
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
                  disabled={otpBusy || Number(state.priceEur) <= 0}
                >
                  {otpBusy ? svPublish.publishing : svPublish.publish}
                </button>
              ) : !otpSent ? (
                <button
                  type="button"
                  className="panel-btn panel-btn--whatsapp"
                  onClick={sendCode}
                  disabled={otpBusy || Number(state.priceEur) <= 0}
                >
                  {otpBusy ? svPublish.sending : svPublish.sendCode}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="panel-btn panel-btn--primary"
                    onClick={verifyAndPublish}
                    disabled={otpBusy || code.length !== 6}
                  >
                    {otpBusy ? svPublish.publishing : svPublish.publish}
                  </button>
                  <button
                    type="button"
                    className="panel-btn"
                    onClick={sendCode}
                    disabled={otpBusy || cooldown > 0}
                  >
                    {cooldown > 0 ? `${svPublish.resendIn} ${cooldown}s` : svPublish.resend}
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
              {svPublish.back}
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
            {saving ? svPublish.saving : svPublish.next}
          </button>
        </div>
      )}
      {step === 2 && (
        <div className="wizard-nav">
          <button type="button" className="panel-btn" onClick={goBack}>
            {svPublish.back}
          </button>
          <span className="wizard-hint">{saving ? svPublish.saving : ""}</span>
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
