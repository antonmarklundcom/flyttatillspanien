/**
 * The shape every operations job answers in — one runner per job, shared by
 * the CLI (`scripts/*.ts`) and, later, by an operator surface in `/admin`.
 *
 * This is the `/admin/importar` rule (`planImport` / `commitImport`) applied to
 * every routine job: **a second code path for the UI is forbidden.** The
 * preview is the only reason pressing a button on a production database is
 * safe, and a preview computed by different code from the write is not a
 * preview — it is a guess that agrees most of the time.
 *
 * Deliberately not a barrel: there is no `src/lib/ops/index.ts` re-exporting
 * every runner, because `backfill-images.ts` pulls in `@aws-sdk/client-s3` and
 * `translate-listings.ts` pulls in `@anthropic-ai/sdk`. A page that only needs
 * one runner must not drag those into its module graph. Import the one file.
 */

/**
 * What a run did — or, when `dry` is true, exactly what the same call with
 * `dry: false` would have done. The two must be computed by the same pass over
 * the same rows; a dry run that reports a different number from the real one is
 * a bug in the job, not a rounding difference.
 *
 * `counts` is free-form on purpose: every job counts different things, and a
 * caller renders whatever keys it finds rather than a fixed set of columns.
 * Keys are lower-case identifiers so they read as a table header unchanged.
 */
export interface OpsResult {
  /** Stable job id — the name a cron log and an operator surface share. */
  job: OpsJob;
  dry: boolean;
  counts: Record<string, number>;
  /** Human lines: warnings, the first N affected rows, why nothing ran. */
  notes: string[];
  durationMs: number;
}

/**
 * Every job that has, or will have, a runner. The union is the registry: a new
 * job is added here first so a caller and the CLI cannot disagree about its
 * name.
 *
 * Spelled as the `package.json` script that runs it, so a line in a cron log
 * and a line in a report are recognisably the same thing.
 */
export type OpsJob =
  | "cron:fx"
  | "cron:medians"
  | "cron:geo"
  | "cron:resync"
  | "cron:translate"
  | "cron:sessions"
  | "seed:costs"
  | "seed:locations"
  | "seed:guides"
  | "import:csv"
  | "backfill:images";

/**
 * What every runner takes. `dry` is required and never defaulted: a job that
 * writes when the caller forgot to say so is the failure mode this whole layer
 * exists to remove, so the type refuses to let a caller omit it.
 *
 * `limit` is mandatory-by-convention for the long jobs (`cron:translate` and
 * `backfill:images` spend money and third-party quota per row), enforced by the
 * caller rather than the type — the CLI is allowed to run them unbounded.
 */
export interface OpsOptions {
  dry: boolean;
  limit?: number;
}

/** Collector handed to a job body so it does not build the result by hand. */
export interface OpsSink {
  /** Add `n` to a counter, creating it at 0 first. Order of first use is the display order. */
  count(key: string, n?: number): void;
  /** Ensure a counter exists (so a zero shows in the table instead of vanishing). */
  track(...keys: string[]): void;
  note(line: string): void;
}

/**
 * Run a job body and stamp the result. Every runner is `return opsRun(job, dry,
 * async (out) => { … })`, so `durationMs`, the `job`/`dry` echo and the counter
 * bookkeeping are written once rather than once per job.
 *
 * Errors are **not** swallowed: a job that throws must reach the caller, which
 * is the CLI's non-zero exit.
 */
export async function opsRun(
  job: OpsJob,
  dry: boolean,
  body: (out: OpsSink) => Promise<void> | void,
): Promise<OpsResult> {
  const started = Date.now();
  const counts: Record<string, number> = {};
  const notes: string[] = [];
  const sink: OpsSink = {
    count(key, n = 1) {
      counts[key] = (counts[key] ?? 0) + n;
    },
    track(...keys) {
      for (const key of keys) if (counts[key] === undefined) counts[key] = 0;
    },
    note(line) {
      notes.push(line);
    },
  };

  await body(sink);

  return { job, dry, counts, notes, durationMs: Date.now() - started };
}
