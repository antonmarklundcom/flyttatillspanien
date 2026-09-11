/**
 * The thin shell every `scripts/*.ts` job is: parse flags, call the one runner in
 * `src/lib/ops/`, print its `OpsResult`, exit.
 *
 * There is no logic here that a runner does not have. That is the point — the
 * same runners are meant to be callable from an operator surface later, and a
 * CLI that computed anything of its own would be a second code path whose
 * output slowly stops matching what the other caller does.
 *
 * `--dry` is the flag every writing job takes. It is spelled the same everywhere
 * on purpose: an operator who has to remember which job says `--dry-run` will
 * eventually run the one that writes.
 */
import type { OpsResult } from "../src/lib/ops/types";

const argv = process.argv.slice(2);

/** True when the flag is present in any accepted spelling. */
export function hasFlag(...names: string[]): boolean {
  return names.some((n) => argv.includes(n));
}

/**
 * `--limit 25` and `--limit=25` both work; absent, or present with an
 * unparseable value, → undefined.
 *
 * The `-1` guard is load-bearing: `argv.indexOf(name)` returns -1 when the flag
 * is absent, and `argv[-1 + 1]` is `argv[0]` — so without it,
 * `import:csv -- 25 whiteglove` would read a positional as `--limit`.
 */
export function flagNumber(name: string): number | undefined {
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  let raw: string | undefined;
  if (eq) {
    raw = eq.slice(name.length + 1);
  } else {
    const i = argv.indexOf(name);
    raw = i === -1 ? undefined : argv[i + 1];
  }
  if (raw === undefined || raw.startsWith("--")) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** Everything that is not a flag or a flag's value — file paths, mostly. */
export function positionals(valueFlags: string[] = []): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const bare = a.split("=")[0];
      // `--limit 25`: skip the value too, unless it was given as `--limit=25`.
      if (valueFlags.includes(bare) && !a.includes("=")) i++;
      continue;
    }
    out.push(a);
  }
  return out;
}

/**
 * `--dry` (with `--dry-run` accepted, since `backfill:images` documented that
 * spelling first). Every writing job reads its dry flag through this.
 */
export const DRY = hasFlag("--dry", "--dry-run");

function pad(s: string, n: number): string {
  return s + " ".repeat(Math.max(0, n - s.length));
}

/** One shape for every job's output, so a cron mail is readable across jobs. */
export function printResult(result: OpsResult): void {
  const keys = Object.keys(result.counts);
  const width = keys.reduce((w, k) => Math.max(w, k.length), 0);

  console.log(`\n${result.job}${result.dry ? "  [DRY RUN — nothing written]" : ""}`);
  for (const k of keys) {
    console.log(`  ${pad(k, width)}  ${result.counts[k]}`);
  }
  if (result.notes.length > 0) {
    console.log("");
    for (const n of result.notes) console.log(n.startsWith(" ") ? n : `  ${n}`);
  }
  console.log(`\n  ${(result.durationMs / 1000).toFixed(1)}s`);
}

/**
 * Run a job and exit with the right code. A thrown error is the job's way of
 * saying "this did not run" (no provider key, R2 unconfigured, the ECB feed
 * unreachable); it exits 1 so a cron that mails its output says so, and never
 * prints a count that would read as success.
 */
export async function runCli(
  job: () => Promise<OpsResult>,
  opts: {
    /**
     * A run that completed but did partial work — `cron:translate` with rows that
     * threw. It prints its whole report and still exits 1, so a cron that mails
     * its output says something went wrong without pretending the batch died.
     */
    failWhen?: (result: OpsResult) => boolean;
  } = {},
): Promise<void> {
  try {
    const result = await job();
    printResult(result);
    process.exit(opts.failWhen?.(result) ? 1 : 0);
  } catch (err) {
    console.error(`\n${(err as Error).message}`);
    if (process.env.OPS_DEBUG) console.error(err);
    process.exit(1);
  }
}
