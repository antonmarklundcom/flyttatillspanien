"use client";

/**
 * Two-step bulk upload: check the file, then commit it.
 *
 * The dry run is the feature. An importer that wrote 200 rows and then told you
 * what it did is an importer you cannot trust with an agency's inventory; this
 * one shows the same counts the commit will produce, marks every row it intends
 * to skip and why, and only then offers the button. The preview is produced by
 * the same planner that does the writing, so the two cannot drift apart.
 *
 * The file is held in the browser between the steps and posted twice. That is
 * deliberate: no half-finished upload is parked on the server, and the commit
 * re-parses the bytes rather than replaying a decision the client sent back.
 */
import { useRef, useState } from "react";
import { svPanel } from "@/i18n/sv";
import type { AgencyRow } from "@/lib/panel-queries";
import type {
  CommitResult,
  DryRunResult,
  UploadPayload,
} from "../../../app/admin/importar/actions";

const SOURCE_LABELS: Record<string, string> = {
  whiteglove: "Planilla enviada por la inmobiliaria",
  import_agency_site: "Sitio propio de la inmobiliaria",
  import_tulugar: "TuLugar",
  import_infocasas: "InfoCasas",
  import_clasipar: "Clasipar",
};

const OUTCOME_LABELS: Record<string, string> = {
  created: "Nueva",
  updated: "Actualiza",
  unchanged: "Sin cambios",
  deduped: "Duplicada",
  skipped: "Se omite",
};

/** File → base64 without pulling the whole thing through a JS string twice. */
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const result = String(reader.result);
      // data:<mime>;base64,<payload>
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

export function ImportUpload({
  agencies,
  sources,
  dryRunAction,
  commitAction,
}: {
  agencies: AgencyRow[];
  sources: readonly string[];
  dryRunAction: (payload: UploadPayload) => Promise<DryRunResult>;
  commitAction: (payload: UploadPayload) => Promise<CommitResult>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dry, setDry] = useState<DryRunResult | null>(null);
  const [done, setDone] = useState<{ jobId: number } | null>(null);

  /** Snapshot the form exactly as it is now, alongside the chosen file. */
  async function buildPayload(): Promise<UploadPayload | null> {
    const form = formRef.current;
    if (!form || !file) return null;
    const data = new FormData(form);
    const agencyRaw = String(data.get("agencyId") ?? "");
    return {
      filename: file.name,
      base64: await readAsBase64(file),
      agencyId: agencyRaw ? Number(agencyRaw) : null,
      source: String(data.get("source") ?? ""),
      publish: data.get("publish") === "on",
      permissionGranted: data.get("permissionGranted") === "on",
      permissionGrantedBy: String(data.get("permissionGrantedBy") ?? ""),
      permissionNote: String(data.get("permissionNote") ?? ""),
    };
  }

  async function runDry() {
    if (!file) {
      setError("Elegí un archivo .csv o .xlsx.");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const payload = await buildPayload();
      if (!payload) return;
      const result = await dryRunAction(payload);
      setDry(result);
      if (!result.ok) setError(result.error);
    } catch {
      setError("No pudimos procesar el archivo.");
    } finally {
      setBusy(false);
    }
  }

  async function runCommit() {
    setBusy(true);
    setError(null);
    try {
      const payload = await buildPayload();
      if (!payload) return;
      const result = await commitAction(payload);
      if (result.ok) {
        setDone({ jobId: result.jobId });
        setDry(null);
      } else {
        setError(result.error);
      }
    } catch {
      setError("No pudimos confirmar la importación.");
    } finally {
      setBusy(false);
    }
  }

  /** Any edit invalidates the preview — it described a different import. */
  function invalidate() {
    setDry(null);
    setDone(null);
  }

  const report = dry?.ok ? dry.report : null;

  return (
    <>
      <form ref={formRef} className="panel-form" onChange={invalidate}>
        <label className="panel-form__field">
          <span className="auth-field__label">Inmobiliaria</span>
          <select className="panel-select" name="agencyId" defaultValue="">
            <option value="">Sin inmobiliaria</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <span className="panel-card__meta">
            Define de quién son las propiedades y aísla la deduplicación: dos
            inmobiliarias pueden usar los mismos códigos internos sin pisarse.
          </span>
        </label>

        <label className="panel-form__field">
          <span className="auth-field__label">Origen</span>
          <select className="panel-select" name="source" defaultValue="whiteglove">
            {sources.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s] ?? s}
              </option>
            ))}
          </select>
        </label>

        <label className="panel-form__field">
          <span className="auth-field__label">Archivo (.csv o .xlsx)</span>
          <input
            className="auth-field__input"
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              invalidate();
            }}
          />
          <span className="panel-card__meta">
            Usá la plantilla: las columnas son fijas.{" "}
            <a href="/admin/importar/plantilla.csv" download>
              Descargar plantilla
            </a>
          </span>
        </label>

        <fieldset className="panel-form__field">
          <legend className="auth-field__label">Autorización</legend>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <input type="checkbox" name="permissionGranted" />
            <span>
              La inmobiliaria autorizó publicar estas propiedades en el portal.
            </span>
          </label>
          <input
            className="auth-field__input"
            name="permissionGrantedBy"
            type="text"
            placeholder="Quién lo autorizó (nombre y cargo)"
            maxLength={160}
            style={{ marginTop: 8 }}
          />
          <input
            className="auth-field__input"
            name="permissionNote"
            type="text"
            placeholder="Cómo y cuándo (ej. WhatsApp del 2/8, audio de Marta)"
            maxLength={500}
            style={{ marginTop: 8 }}
          />
          <span className="panel-card__meta">
            Queda guardado con el lote. Sin esto no se puede confirmar la
            importación.
          </span>
        </fieldset>

        <label className="panel-form__field" style={{ display: "flex", gap: 8 }}>
          <input type="checkbox" name="publish" />
          <span>
            Publicar directamente (si no, quedan en revisión — recomendado)
          </span>
        </label>

        <div className="panel-form__field panel-form__field--action">
          <button
            className="panel-btn"
            type="button"
            onClick={runDry}
            disabled={busy || !file}
          >
            {busy ? "Revisando…" : "Revisar sin importar"}
          </button>
        </div>
      </form>

      {error ? <p className="auth-error">{error}</p> : null}

      {done ? (
        <p className="panel-flash">
          Importación confirmada.{" "}
          <a href={`/admin/importar/${done.jobId}`}>
            Ver el lote #{done.jobId} y revertirlo si hace falta
          </a>
          .
        </p>
      ) : null}

      {dry?.ok && report ? (
        <article className="panel-card" style={{ marginTop: 20 }}>
          <h3 className="panel-section__title" style={{ marginTop: 0 }}>
            Vista previa — no se escribió nada todavía
          </h3>

          {dry.missingRequired.length > 0 ? (
            <p className="auth-error">
              Faltan columnas obligatorias: {dry.missingRequired.join(", ")}.
            </p>
          ) : null}
          {dry.unknownColumns.length > 0 ? (
            <p className="panel-card__meta">
              Columnas que no reconocemos y vamos a ignorar:{" "}
              {dry.unknownColumns.join(", ")}.
            </p>
          ) : null}

          <p className="panel-card__meta">
            {dry.totalRows} filas ({dry.kind.toUpperCase()})
            {dry.agencyName ? ` · ${dry.agencyName}` : " · sin inmobiliaria"}
          </p>

          <ul className="panel-card__meta" style={{ lineHeight: 1.8 }}>
            <li>Nuevas: {report.created}</li>
            <li>Actualizan una existente: {report.updated}</li>
            <li>Sin cambios: {report.unchanged}</li>
            <li>Duplicadas (se adjuntan a otra): {report.deduped}</li>
            <li>Se omiten: {report.skipped}</li>
          </ul>

          {dry.withoutDedupKey > 0 ? (
            <p className="panel-card__meta">
              {dry.withoutDedupKey} filas no traen teléfono de contacto. Se
              importan igual, pero no podemos detectar si ya existen bajo otro
              origen — conviene revisarlas en la cola.
            </p>
          ) : null}

          {dry.preview.length > 0 ? (
            <div className="panel-table__wrap" style={{ marginTop: 12 }}>
              <table className="panel-table">
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Qué pasa</th>
                    <th>Título</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {dry.preview.map((r) => (
                    <tr key={`${r.rowNumber}-${r.outcome}-${r.title}`}>
                      <td>{r.rowNumber}</td>
                      <td>{OUTCOME_LABELS[r.outcome] ?? r.outcome}</td>
                      <td>{r.title}</td>
                      <td>{r.reason ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="panel-form__field panel-form__field--action">
            <button
              className="panel-btn panel-btn--primary"
              type="button"
              onClick={runCommit}
              disabled={busy || dry.missingRequired.length > 0}
            >
              {busy
                ? "Importando…"
                : `Importar ${report.created + report.updated + report.deduped} filas`}
            </button>
          </div>
          <p className="panel-card__meta">{svPanel.importRollbackHint}</p>
        </article>
      ) : null}
    </>
  );
}
