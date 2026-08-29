"use client";

/**
 * 3-step publish wizard (ARCHITECTURE.md §3, M5). Detalles → Ubicación →
 * Precio & publicación, then an emailed code at publish. Autosave is two-layer:
 * localStorage on every change (instant, survives a reload) and a server draft
 * (a status='draft' listings row) written when a step is completed, so a draft
 * also survives a device change and shows up in the panel. All identity,
 * ownership and the verified flag are decided server-side in ../app/publicar/
 * actions.ts — this component only collects and previews.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { svPanel, svPublish, svListing, svCard } from "@/i18n/sv";
import { PROPERTY_TYPE_OPTIONS } from "@/lib/property-types";
import type { NearbyProject, PublishLocation } from "@/lib/publish-queries";
import type {
  Operation,
  PropertyType,
  EnergyRating,
  LegalStatus,
  ChargesStatus,
} from "@/lib/import/types";
import {
  ENERGY_RATINGS,
  LEGAL_STATUSES,
  CHARGES_STATUSES,
} from "@/lib/import/types";
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
  { value: "venta", label: svCard.operationBadge.venta },
  { value: "alquiler", label: svCard.operationBadge.alquiler },
  { value: "alquiler_vacacional", label: svCard.operationBadge.alquiler_vacacional },
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
  builtM2: string;
  usableM2: string;
  plotM2: string;
  locationId: number;
  projectId: number | null;
  /** EUR — the only stored price, so there is no currency to pick. */
  priceEur: string;
  videoUrl: string;
  /**
   * The Spain legal block. `nota_simple_seen_at` is deliberately absent from
   * this state — it is the portal's own attestation and a lister cannot set
   * it (design doc §3.2); an operator sets it from /admin.
   */
  energyRating: EnergyRating | "";
  referenciaCatastral: string;
  legalStatus: LegalStatus;
  chargesStatus: ChargesStatus;
  /** Only meaningful (and only sent) for `alquiler_vacacional`. */
  touristLicence: string;
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
  Pick<
    WizardState,
    "operation" | "propertyType" | "builtM2" | "plotM2" | "locationId"
  >
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
  usableM2: "",
  plotM2: "",
  locationId: 0,
  projectId: null,
  priceEur: "",
  videoUrl: "",
  energyRating: "",
  referenciaCatastral: "",
  legalStatus: "desconocido",
  chargesStatus: "desconocido",
  touristLicence: "",
};

const LS_KEY = "ftse:publish-draft";

export function PublishWizard({
  locations,
  projects,
  accountEmail,
  initialDraft,
  initialPhotos,
  prefill,
  otpEnabled,
  homeHref,
}: {
  locations: PublishLocation[];
  projects: NearbyProject[];
  /** The signed-in account's address — where the code is sent. Display only. */
  accountEmail: string;
  initialDraft: InitialDraft | null;
  initialPhotos?: ListingImageRow[];
  /** Seed values from /tasacion. See PublishPrefill. */
  prefill?: PublishPrefill | null;
  /**
   * Whether an emailed code can actually be delivered. False → publish
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
  /**
   * An optional callback number. NOT the code's destination: the code goes to
   * the account's own address, decided server-side from the session, because a
   * client-named destination would make this an open relay that mails a
   * six-digit code anywhere a script asks.
   */
  const [phone, setPhone] = useState("");
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
      usableM2: numOrNull(state.usableM2),
      plotM2: numOrNull(state.plotM2),
      locationId: state.locationId,
      projectId: state.projectId,
      videoUrl: state.videoUrl,
      referenciaCatastral: state.referenciaCatastral,
      energyRating: state.energyRating,
      legalStatus: state.legalStatus,
      chargesStatus: state.chargesStatus,
      // Sent only for a holiday let — a licence number on any other operation
      // would render a compliance claim about the wrong thing (the server
      // enforces this too; see draftFields() in publish-queries.ts).
      touristLicence:
        state.operation === "alquiler_vacacional" ? state.touristLicence : "",
      /**
       * `nota_simple_seen_at` is deliberately absent from this payload: it is
       * the portal's own attestation and a lister cannot set it — see the
       * type comment on WizardState above.
       */
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
        // The real gate lives server-side (src/lib/publish-gate.ts) and fires
        // at the actual publish transition — this is UX only, so a seller who
        // genuinely doesn't know yet still has "Under handläggning" to reach
        // for rather than being stuck.
        if (!state.energyRating) return svPublish.errors.energyRating;
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
      const res = await requestOtpAction();
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
  }, [persist]);

  /** Publish with no code, when none can be delivered (otpEnabled === false). */
  const publishDirect = useCallback(async () => {
    setOtpBusy(true);
    setOtpError(null);
    try {
      const saved = await persist();
      if (saved === null) return;
      const res = await publishDraftAction({ draftId: saved, phone });
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
  }, [persist, phone]);

  const verifyAndPublish = useCallback(async () => {
    if (!state.draftId) return;
    setOtpBusy(true);
    setOtpError(null);
    try {
      const res = await verifyAndPublishAction({
        draftId: state.draftId,
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
  }, [state.draftId, code]);

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
      <ol className="wizard-steps" aria-label="Pasos">
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

      {/* Step 1 — Detalles */}
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
                <NumField label={svPublish.builtLabel} value={state.builtM2} onChange={(v) => set("builtM2", v)} />
                <NumField label={svPublish.usableLabel} value={state.usableM2} onChange={(v) => set("usableM2", v)} />
              </>
            )}
            <NumField label={svPublish.plotLabel} value={state.plotM2} onChange={(v) => set("plotM2", v)} />
          </div>

          {/* The Spain legal block — the site's whole editorial premise.
              `nota_simple_seen_at` is intentionally not here: it is the
              portal's own attestation, never a lister's self-report. */}
          <div className="wizard-legal">
            <h3 className="wizard-legal__title">{svPublish.legalTitle}</h3>
            <p className="wizard-hint">{svPublish.legalIntro}</p>

            <div className="wizard-field">
              <label className="wizard-label" htmlFor="energy">
                {svPublish.energyRatingLabel}
              </label>
              <select
                id="energy"
                className="wizard-input"
                value={state.energyRating}
                onChange={(e) => set("energyRating", e.target.value as EnergyRating)}
              >
                <option value="">—</option>
                {ENERGY_RATINGS.map((r) => (
                  <option key={r} value={r}>
                    {r === "en_tramite"
                      ? svListing.energyPending
                      : r === "exento"
                        ? svListing.energyExempt
                        : svCard.energy(r)}
                  </option>
                ))}
              </select>
              <p className="wizard-hint">{svPublish.energyRatingHint}</p>
            </div>

            <div className="wizard-field">
              <label className="wizard-label" htmlFor="catastral">
                {svPublish.catastralLabel}
              </label>
              <input
                id="catastral"
                className="wizard-input"
                value={state.referenciaCatastral}
                maxLength={20}
                onChange={(e) => set("referenciaCatastral", e.target.value.toUpperCase())}
              />
              <p className="wizard-hint">{svPublish.catastralHint}</p>
            </div>

            <div className="wizard-grid">
              <div className="wizard-field">
                <label className="wizard-label" htmlFor="legalStatus">
                  {svPublish.legalStatusLabel}
                </label>
                <select
                  id="legalStatus"
                  className="wizard-input"
                  value={state.legalStatus}
                  onChange={(e) => set("legalStatus", e.target.value as LegalStatus)}
                >
                  {LEGAL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {svListing.legalStatusLabel[s]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="wizard-field">
                <label className="wizard-label" htmlFor="chargesStatus">
                  {svPublish.chargesStatusLabel}
                </label>
                <select
                  id="chargesStatus"
                  className="wizard-input"
                  value={state.chargesStatus}
                  onChange={(e) => set("chargesStatus", e.target.value as ChargesStatus)}
                >
                  {CHARGES_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {svListing.chargesStatusLabel[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Only meaningful for a holiday let — several comunidades
                require the number in the advertisement itself. */}
            {state.operation === "alquiler_vacacional" && (
              <div className="wizard-field">
                <label className="wizard-label" htmlFor="touristLicence">
                  {svPublish.touristLicenceLabel}
                </label>
                <input
                  id="touristLicence"
                  className="wizard-input"
                  value={state.touristLicence}
                  maxLength={40}
                  onChange={(e) => set("touristLicence", e.target.value)}
                />
                <p className="wizard-hint">{svPublish.touristLicenceHint}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2 — Ubicación */}
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

      {/* Step 3 — Precio y publicación */}
      {step === 2 && (
        <div className="wizard-panel">
          <div className="wizard-field">
            <label className="wizard-label">{svPublish.priceLabel}</label>
            {/* No currency select: EUR is the only stored price, and the
                kronor figure is computed at render from a dated ECB rate. */}
            <div className="wizard-price">
              <span className="wizard-currency" aria-hidden>
                €
              </span>
              <input
                className="wizard-input"
                inputMode="numeric"
                value={state.priceEur}
                placeholder="0"
                onChange={(e) => set("priceEur", e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
            <p className="wizard-hint">{svPublish.priceHint}</p>
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
            {/* The destination is shown, not asked for: it is the address
                this account logs in with, and the server sends there whatever
                the form says. */}
            <div className="wizard-field">
              <span className="wizard-label">{svPublish.emailLabel}</span>
              <p className="wizard-hint">{accountEmail}</p>
            </div>

            {!otpEnabled && (
              <div className="wizard-field">
                <label className="wizard-label" htmlFor="phone">
                  {svPanel.profilePhoneLabel}
                </label>
                <input
                  id="phone"
                  className="wizard-input"
                  inputMode="tel"
                  value={phone}
                  placeholder="+46 70 123 45 67"
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            )}

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
                  className="panel-btn panel-btn--primary"
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
