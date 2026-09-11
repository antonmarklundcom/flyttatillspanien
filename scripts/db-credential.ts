/**
 * Pick the database credential a CLI run is allowed to use, before anything
 * opens a connection.
 *
 * **Import this first, above every other import, in any script that can write.**
 * `src/db/index.ts` builds its pool at module load from `process.env.DATABASE_URL`,
 * and that file is off-limits (AGENTS.md §3 — the app's own credential handling
 * is never rewritten). So the choice has to be made in the process before that
 * module is evaluated, and ES modules are evaluated in the order their imports
 * are declared: putting this line first is what makes it work. Moving it below
 * the runner import silently restores the old behaviour.
 *
 * The rule (AGENTS.md §3):
 *
 * - `DATABASE_URL` is the **read-only** user. It is what an agent is given, and
 *   it is enough for `db:status` and for every `--dry` run.
 * - `DATABASE_URL_RW` is the owner user. It lives on the founder's machine only,
 *   is never given to an agent, and is used **only** when a run actually writes.
 *
 * With no `DATABASE_URL_RW` set, nothing changes: writing runs use
 * `DATABASE_URL`, which is how a single-credential machine has always worked.
 */
import { DRY } from "./ops-cli";

const rw = process.env.DATABASE_URL_RW;

if (!DRY && rw) {
  process.env.DATABASE_URL = rw;
  // Say it out loud. Reading "this wrote to the owner connection" in a cron mail
  // is the difference between a surprising change and an explicable one.
  console.log("using DATABASE_URL_RW (this run writes)");
}

export {};
