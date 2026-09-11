# flyttatillspanien — port plan from the propia.node comparison audit

Written 2026-09-11 by the Fable director session against
`flyttatillspanien@15b6222` (main, PR #10 merged) and `propia.node@209f773`.
Every finding below was re-verified against the code, not taken from the audit.

## Model assignment (all seven findings)

| # | Finding | Model | Why |
|---|---------|-------|-----|
| 1 | Rate limit `/registro` + `/publicar` | **Opus** | Small port, but it is the launch blocker and a security control on a public unauthenticated write; the audit's description of the `/publicar` half is wrong (propia throttles the OTP send per user, not the write per IP) and the builder must reason about the throttled-path UX and the dictionary key rather than paste. |
| 2 | `AGENTS.md` + `DATABASE_URL_RW` credential split | **Opus** | New process/policy documentation the founder is bound by, plus a module-evaluation-order trap (`db-credential` must be the first import in every writing script or it silently does nothing). Folds in finding 7. |
| 3 | `cron:translate` DeepL → Gemini → Claude chain, es→sv | **Sonnet** | Mechanical port of working `propia.node/src/lib/translate.ts`; the Swedish glossary already exists in ftse's `SYSTEM` prompt, and every value (models, env names, correction table) is pre-decided in the spec. |
| 4 | Import rollback transaction wrap + "6 rows not 3" investigation | **Opus**, two PRs | `src/lib/import/jobs.ts` is "out of a Sonnet phase's reach" per CLAUDE.md; rollback moves price data. The investigation needs judgment: the evidence points at a test-fixture artefact, not a `jobs.ts` bug, and the builder must prove which before touching core logic. |
| 5 | `src/lib/ops/<job>.ts` runner pattern | **Sonnet** | Pure refactor against thirteen working propia exemplars; no behaviour change, `--dry` output must be byte-comparable before/after. Depends on Batch 1 PR-2 (`scripts/ops-cli.ts`, `scripts/db-credential.ts`). |
| 6 | Extract `src/lib/ops/migrations.ts` from `check-migrations.ts` | **Sonnet** | Same shape as 5; propia's split is the exemplar. Own PR so it can run in parallel with 5. |
| 7 | Drop `"db:push"` from `package.json` | **Opus (folded into PR-2)** | One line, but it is the discipline `AGENTS.md` states ("there is no db:push"), so it lands with the file that says so. |

**Cost guardrail (standing rule, restated for both windows):** Fable/Mythos-class
models are never used as a subagent, spawned session, workflow agent, Routine or
background run without Anton's explicit approval in that conversation. In both
windows the director writes the delta-spec, spawns **Opus or Sonnet** builder
subagents via the Agent tool with `model` set explicitly (never inherited), reviews
the result, and fixes small findings inline. Fable only planned this document; it
edits no files in either window.

**Ordering dependency:** Batch 2 PR-5/6/7 all import `scripts/db-credential.ts`
and `scripts/ops-cli.ts`, which PR-2 creates. Batch 2 must start from a `main`
that contains PR-2. PR-5 (translate chain) also benefits from PR-2's
`.env.example` DeepL/Gemini block being absent — it adds that block itself.

---

# PART 1 — Opus window (paste this into the first new session)

You are the director for Batch 1 of the flyttatillspanien port plan. You run on
Opus. Read `CLAUDE.md` (this repo) in full — it is short and every rule in it is
load-bearing. Do **not** read `plan.md`, `PLAN.md`, `ARCHITECTURE.md` or the
Phase build logs; everything you need is below. Read `propia.node`'s files only
at the exact paths named in each spec.

Cost rule: spawn builders with the Agent tool and `model: "opus"` (or
`"sonnet"` where a spec says so). Never Fable. You review every builder result
yourself before pushing; small findings you fix inline.

Setup, once:
```
git fetch origin main && git reset --hard origin/main
npm install && npm run hooks:install
docker compose up -d && npm run db:migrate       # fresh DB; if Docker is unavailable say so in each PR
export DATABASE_URL="mysql://ftse:ftse@127.0.0.1:3306/ftse"
```
Four PRs, in this order, each on its own `claude/<name>` branch cut from
`origin/main` after the previous one merges. You may merge PR-1 and PR-2
yourself when green (they are CSS/UI/copy/docs-class risk: PR-1 is fifteen
lines against a public form, PR-2 is docs plus scripts). **PR-3 and PR-4 touch
`src/lib/import/jobs.ts`: open them, title them clearly, and stop — the founder
merges.** No PR here touches `src/db/schema.ts`; if you find you need to, stop
and write the question into `docs/decisions-needed.md` (create it).

## PR-1 — `claude/rate-limit-signup` — "Rate-limit /registro sign-up and /publicar OTP issue (launch blocker)"

Builder: **Opus** subagent. Spec:

**Why.** `registerAccount()` runs Node scrypt (`src/lib/auth/password.ts`)
before it touches the database. `/registro` is unauthenticated, so a loop
against it burns the shared Hostinger Node process. `requestOtpAction()` in
`/publicar` is authenticated but sends an SMTP mail per call; `createOtp()`'s
resend cooldown is per destination, which is the user's own email, so a
per-user counter is the right second guard. The audit described `/publicar` as
needing a per-IP wrap on the write action; that is wrong — `saveDraftAction`
already requires a session and does no expensive work. Do not add an IP limit
there.

**Reference (copy the shape, not the prose):**
`propia.node/app/registro/actions.ts` lines 12–17 and 60–74, and
`propia.node/app/publicar/actions.ts` lines 149–150 and 166–175.

**Files to change (and only these):**
1. `app/registro/actions.ts` — import `headers` from `next/headers`,
   `clientIpFrom` from `@/lib/client-ip`, `allowRequest` from
   `@/lib/rate-limit`. Add `const REGISTER_MAX = 5; const REGISTER_WINDOW_MS =
   10 * 60_000;` with a comment explaining the scrypt cost (rewrite propia's
   comment in your own words; drop the PLAN.md post-mortem reference — this
   repo's PLAN.md is different). Widen `bounce()`'s first parameter to
   `RegistrationError | "generic" | "throttled"`. Insert the check **after**
   the `kind`/`invite` parsing and **before** `registerAccount()`:
   `const ip = clientIpFrom(await headers()); if (!allowRequest(\`register|${ip}\`, REGISTER_MAX, REGISTER_WINDOW_MS)) bounce("throttled", kind, invite);`
2. `app/registro/page.tsx` — the `ERRORS` map (line ~32 in propia) gets
   `throttled: svPanel.registerErrorThrottled`.
3. `src/i18n/sv.ts` — in `svPanel`, next to `registerErrorGeneric` (line ~294),
   add `registerErrorThrottled: "För många försök från den här anslutningen. Vänta tio minuter och försök igen."`.
   Do not add any other string. No `en.ts` exists in this repo; do not create one.
4. `app/publicar/actions.ts` — import `allowRequest` from `@/lib/rate-limit`.
   Add `const OTP_MAX = 5; const OTP_WINDOW_MS = 60 * 60_000;`. In
   `requestOtpAction()`, after the `isMessagingConfigured()` guard and before
   `createOtp(email)`, add
   `if (!allowRequest(\`otp|${user.id}\`, OTP_MAX, OTP_WINDOW_MS)) return { ok: false, error: "cooldown", cooldownMs: OTP_WINDOW_MS };`
   with propia's comment rewritten (why `cooldown` reuses the wizard's existing
   countdown; why it reports the whole window). `RequestOtpResult` already has
   the `cooldown` shape — do not change the type.

**Do not touch:** `src/lib/rate-limit.ts`, `src/lib/client-ip.ts`,
`src/lib/registration.ts`, `src/lib/otp.ts`, `app/api/leads/route.ts`, the
login action (it has its own lockout limiter in `src/lib/auth/rate-limit.ts`).

**Definition of done:** `npm run verify:local` green. Manually: `npm run dev`,
submit `/registro` six times from one browser with an invalid password; the
sixth must land on `/registro?error=throttled&kind=...` and render the new
Swedish line. Report files changed and any deviation.

**Director review checklist:** the throttle is before any hash/DB work; the
`throttled` bounce keeps `invite`; `verify:i18n` still passes (it is a
function-arity check, a new string key is fine); no new string literal outside
`sv.ts`. Merge when green.

## PR-2 — `claude/agents-md-credential-split` — "AGENTS.md, read-only vs owner DB credential for scripts, drop db:push"

Builder: **Opus** subagent. Spec:

**What to create, copying from propia.node and adapting:**
1. `scripts/ops-cli.ts` — copy `propia.node/scripts/ops-cli.ts` verbatim. It
   imports `type { OpsResult } from "../src/lib/ops/types"`, so also create
   `src/lib/ops/types.ts` as a copy of `propia.node/src/lib/ops/types.ts` with
   `OpsJob` narrowed to this repo's script names:
   `"cron:fx" | "cron:medians" | "cron:geo" | "cron:resync" | "cron:translate" | "cron:sessions" | "seed:costs" | "seed:locations" | "seed:guides" | "import:csv" | "backfill:images"`.
   Remove the `ops_runs` / `esPanel` / "O2" / "S1" sentences from its comments —
   there is no `ops_runs` table here and this PR must not add one. No runners
   are written in this PR; Batch 2 does that.
2. `scripts/db-credential.ts` — copy `propia.node/scripts/db-credential.ts`;
   replace the `fable/plan.md` / `fable-plan-ops.md` references with
   "AGENTS.md §3". Keep the rule: `if (!DRY && rw) process.env.DATABASE_URL = rw`
   with the console line.
3. Add `import "./db-credential"; // MUST be first …` as the **first import**
   of every script that can write: `backfill-images.ts`, `compute-medians.ts`,
   `create-user.ts`, `fetch-fx.ts`, `import-csv.ts`, `purge-sessions.ts`,
   `resync-stale.ts`, `seed-acquisition-costs.ts`, `seed-dev-listings.ts`,
   `seed-guides.ts`, `seed-locations.ts`, `sync-display-coords.ts`,
   `translate-listings.ts`. Each of these currently reads `--dry` its own way;
   leave that logic alone in this PR (Batch 2 refactors it) — `db-credential`
   only needs `DRY` from `ops-cli`, which reads `process.argv` independently.
   `check-migrations.ts`: make `--probe` (the only writing path) pick
   `DATABASE_URL_RW ?? DATABASE_URL` for its probe connection, as
   propia's does (`propia.node/scripts/check-migrations.ts` header comment
   documents the rule; read its `probe` branch). Do **not** add the import to
   `verify-*.ts` (they refuse non-local databases already).
4. `.env.example` — insert propia's `DATABASE_URL_RW=` block (its lines 11–23)
   directly under `DATABASE_URL`, with the example job names changed to this
   repo's (`cron:fx`, `seed:costs`, `import:csv`, `user:create`, `db:migrate`,
   `db:status -- --probe`).
5. `package.json` — delete the `"db:push"` line. Nothing else.
6. `AGENTS.md` at repo root — write it **from** `propia.node/AGENTS.md` (read
   it in full) with the same seven sections, but every fact must be this
   repo's. Concretely: §1 describes flyttatillspanien.se (one domain, Swedish,
   `locale: "sv"`, EUR-only prices, the legal/compliance block as the
   editorial premise — lift the one-paragraph summaries from `CLAUDE.md`, do not
   re-explain them); the "domains" rules collapse to "one entry in
   `verticals.ts`, the English door is a PLAN.md decision, never add a host"
   and "`CONTACT_EMAIL` is required-before-launch, still `string | null`,
   never hard-code a fallback". §2 is identical in substance (reset to
   origin/main, `claude/<name>` branches, `verify:local`, never `--no-verify`,
   no `.github/workflows/`, `verify:scopes` manual, may-merge / must-never-merge
   / `MIGRATION REQUIRED —` title / no `db:migrate` against prod / no
   `DATABASE_URL_RW` for agents / nothing auto-merges). §3 is the credential
   split with local URL `mysql://ftse:ftse@127.0.0.1:3306/ftse` and the
   MariaDB `json`-as-`longtext` caveat kept. §4 conventions: keep i18n (one
   dictionary `sv.ts`, no `en.ts` peer — say so explicitly, and that
   `verify:i18n` is a sentinel-argument check), filters, caching (add the
   `fx`/`acquisitionCosts` TTL-is-the-invalidation exception from CLAUDE.md),
   map coordinates, SEO ownership (one door; `verify:seo` guards the future
   English door), import pipeline (add the catastral-exact dedup rule and the
   publish gate on `energy_rating`), the "calling app code from a script"
   `unstable_cache` rule, alerts never lie, **plus** the ops-runner rule
   phrased as forward-looking ("every routine job moves into
   `src/lib/ops/<job>.ts`; until Batch 2 lands the scripts are monolithic —
   do not add a second code path when you touch one"). Drop `rentalPath()`
   and anything Paraguay. §5 "before you claim done" and §6 "stop and ask"
   copy over, with the FX rate, the seven `acquisition_costs` placeholders and
   NIE/DNI capture named as founder decisions; keep the model-cost guardrail
   paragraph verbatim. §7 points at `CLAUDE.md`, `ARCHITECTURE.md`, `PLAN.md`,
   `plan.md` (the phased-build tracker), `docs/SPAIN-PORTAL-DESIGN.md`,
   `KNOWN-ISSUES.md`.
7. `CLAUDE.md` — replace the "Working agreements with the founder" section
   body with `@AGENTS.md` and one sentence saying the agreements moved there on
   2026-09-11 (mirror propia's wording). Add a one-line pointer in the
   Migrations section: "`db:push` was removed; migrations are files."
8. Create `docs/decisions-needed.md` with a heading and an empty list (§6 of
   AGENTS.md names it).

**Do not touch:** `src/db/index.ts` (the app pool's credential handling is
never edited), `drizzle.config.ts`, any `app/` file, `src/db/schema.ts`.

**Definition of done:** `npm run verify:local` green. With the local DB:
`npm run cron:fx -- --dry` and `npm run cron:geo -- --dry` still run (the
former will report the ECB feed unreachable behind the sandbox proxy — that is
the sanctioned outcome, not a failure of this PR). Prove the credential switch:
`DATABASE_URL_RW=mysql://ftse:ftse@127.0.0.1:3306/ftse npm run cron:sessions`
must print `using DATABASE_URL_RW (this run writes)`, and the same with `--dry`
must not. Report which scripts you could and could not exercise.

**Director review checklist:** `db-credential` is line 1 of every listed
script (an import placed lower is the silent failure); `AGENTS.md` names no
Paraguay domain, no `db:push`, no `ops_runs`; `.env.example` says the app
itself keeps using `DATABASE_URL`. Merge when green.

## PR-3 — `claude/import-rollback-transaction` — "Import rollback: one transaction for the whole undo"

Builder: **Opus** subagent. Spec:

**Reference:** `propia.node/src/lib/import/jobs.ts` lines 318–455 — the
`rollbackImportJob()` body from `const now = new Date()` through the
`importJobs` update. The two files' `rollbackImportJob()` are otherwise
line-for-line identical (verified), so this is a diff-shaped port.

**Change, in `src/lib/import/jobs.ts` only:** hoist `now` and `note` above the
cascade; wrap everything from the `deletableIds` delete cascade through the
`import_rows.reverted_at` stamp and the `import_jobs` status update in
`await db.transaction(async (tx) => { … })`, replacing every `db.` inside with
`tx.` — including `syncDisplayCoords(tx, row.listingId)`. `syncDisplayCoords`'s
`DbConn` type in `src/lib/geo.ts` (line 41) already accepts a transaction —
verified — so no signature change is needed; if `tsc` disagrees, stop and
report rather than widening the type. Keep propia's "REVIEW R10" comment
rewritten without the R10 reference. Do not change the protected-listing
logic, the legacy-`deduped` path, or any return value.

**Do not touch:** `upsert.ts`, `resync.ts`, `scripts/verify-import.ts`,
anything under `app/`.

**Definition of done:** `npm run verify:local` green (its `verify:import` pure
half runs without a DB). Then, against the **fresh** docker database from
setup, `DATABASE_URL=mysql://ftse:ftse@127.0.0.1:3306/ftse npm run
verify:import` must pass every check including `rollback restored the old
prices` and `a job cannot be rolled back twice`. Paste the full output in the
PR. If Docker is unavailable, say so and stop — do not open the PR as verified.

**PR title prefix:** none needed (no schema change), but the body says "core
import logic — founder merges". Open and stop.

## PR-4 — `claude/verify-import-rollback-fixture` — "verify:import: rollback assertion scoped to the agency it updated"

Builder: **Opus** subagent, spawned only after PR-3 is open (it can branch from
PR-3's branch; note that in the PR body). Spec:

**The question.** `KNOWN-ISSUES.md` lines 163–195 record the rollback check
reporting six rows (`["299000.00" × 3, "285000.00" × 3]`) on a reused local
database, and Phase 5 failing to reproduce it on a fresh one. The director's
reading of `scripts/verify-import.ts`: the fixture deliberately imports the
same three `Flat` rows under **agency B** at line ~341 (`another agency's ids
1-3 do not overwrite the first agency's`), so `like(listings.title, '<MARKER>
Flat%')` at line ~566 selects **six** rows by design — agency A's three
(updated to 299000 by plan C, restored by the rollback) and agency B's three
(created at 285000, never updated). On a fresh DB all six read 285000 and the
`every()` passes, which is why Phase 5 saw green; on a reused DB, three rows
left over from an earlier run's aborted `cleanup()` sat at 299000. Under this
reading there is no over-restore in `rollbackImportJob()` at all: the assertion
is simply not scoped to the rows the job touched.

**Your job is to prove or refute that, then fix the right thing:**
1. Reproduce on the fresh DB (must pass). Then run `verify:import` a second
   time without resetting the DB, and a third time after deliberately killing
   the process mid-run (`--` insert a `process.exit(1)` locally before
   `cleanup()`, run, remove it, run again). Record what the rollback check
   prints each time.
2. Instrument, do not guess: before the rollback, `SELECT id, agency_id,
   price_eur FROM listings WHERE title LIKE '<MARKER> Flat%'`; after it, the
   same. Include both in the PR body.
3. If the reading holds (the extra rows are agency B's, or stale marker rows,
   and every row the job updated is restored exactly once): change the
   assertion, not `jobs.ts` — filter `afterRollback` by `agencyId === agencyA`
   **and** assert `afterRollback.length === 3`, and make `cleanup()` run in a
   `finally` so an aborted run cannot leave marker rows for the next one.
   Rewrite the KNOWN-ISSUES entry as resolved with the one-paragraph cause, and
   delete the "Known defect" paragraph in `CLAUDE.md`'s Import pipeline section.
4. If the reading does **not** hold and `rollbackImportJob()` really restores
   onto rows it did not update: stop after step 2, write the trace into the PR
   body and `KNOWN-ISSUES.md`, and do not patch `jobs.ts` — the director
   decides the fix with the founder.

**Do not touch:** `src/lib/import/upsert.ts`, `src/db/schema.ts`, any `app/`
file. `jobs.ts` only under branch 4 and only after the director agrees.

**Definition of done:** `verify:local` green; `verify:import` against the
local DB green three runs in a row on the same database without a reset.
Open and stop; founder merges.

**Director review checklist (PR-3 and PR-4):** every `db.` inside the
transaction became `tx.`; nothing outside the cascade (the `getImportJob`
guard, the protected-id reads) moved inside; PR-4's assertion counts exactly
three rows; the KNOWN-ISSUES entry says what was actually found, not what was
expected. You do not merge either.

## Batch 1 verification checklist
- After **every** PR: `npm run verify:local` (typecheck, build, verify:import,
  verify:facets, verify:i18n, verify:seo) — the pre-push hook runs it anyway;
  never `--no-verify`.
- PR-3 and PR-4 additionally: `DATABASE_URL=<local> npm run verify:import`
  (the database half), pasted into the PR.
- `verify:scopes`: **not required** for any Batch 1 PR (none touches
  `listingScopeWhere`, `panelScope` or a panel query). Say so in each PR body.
- `npm run db:status`: no Batch 1 PR touches `src/db/schema.ts`. If one ends
  up doing so, its title starts `MIGRATION REQUIRED —`, `db:status` must show
  `No drift` before merge, and an agent never merges it or runs `db:migrate`.
- No agent holds `DATABASE_URL_RW`. The local docker credential is the only
  write credential this window ever sees.

---

# PART 2 — Sonnet window (paste this into the second new session, after Part 1's PRs are merged)

You are the director for Batch 2 of the flyttatillspanien port plan. You run on
Opus and spawn **Sonnet** builders (`model: "sonnet"`) — the specs below are
complete and every value is pre-decided, which is what makes Sonnet the right
builder. Never Fable. You review every result before pushing and fix small
findings inline.

Precondition: `origin/main` contains Batch 1's PR-2 (`scripts/ops-cli.ts`,
`scripts/db-credential.ts`, `src/lib/ops/types.ts`, `AGENTS.md`). Verify with
`ls scripts/ops-cli.ts scripts/db-credential.ts src/lib/ops/types.ts AGENTS.md`
before spawning anything; if any is missing, stop and say so. Read `AGENTS.md`
and `CLAUDE.md` (both short). Do not read `plan.md`, `PLAN.md`,
`ARCHITECTURE.md` or the build logs.

Setup as in Part 1 (reset to `origin/main`, `npm install`, `hooks:install`,
fresh docker DB, `export DATABASE_URL=...ftse`).

Three PRs. PR-5 and PR-7 touch disjoint files and may be built by two Sonnet
subagents in parallel from separate branches; PR-6 must wait for PR-5 to merge
(its `runTranslate` wraps PR-5's `translateListing`). All three are low-risk
refactors/ports with no schema change: you may merge each yourself once green.

## PR-5 — `claude/translate-provider-chain` — "cron:translate: DeepL → Gemini → Claude fallback chain for es→sv"

Builder: **Sonnet**. Spec:

**Reference:** `propia.node/src/lib/translate.ts` (449 lines) is the working
implementation for es→en. `flyttatillspanien/src/lib/translate.ts` (187 lines)
is the Claude-only es→sv version whose `SYSTEM` prompt, `TRANSLATION_SCHEMA`,
`translationSourceHash()`, `TranslatableListing` / `Translation` types and
`TITLE_MAX` are already correct for this repo and **must be kept**.

**Rewrite `src/lib/translate.ts`** to propia's structure, changing only what
the direction change requires:
- Keep every exported symbol name and signature as-is (`translationSourceHash`,
  `isTranslationConfigured`, `translateListing`, the two interfaces). The
  script `scripts/translate-listings.ts` must compile unchanged — do not edit it
  in this PR (PR-6 does).
- Port `isDeepLConfigured` / `isGeminiConfigured` / `isClaudeConfigured`,
  `isTranslationConfigured()` = any of the three, the `providers` array and the
  cheapest-first fall-through loop in `translateListing()` (propia lines
  404–449) verbatim, including the `console.warn` on fall-through.
- `translateWithDeepL`: port propia's (lines 149–196) with `target_lang: "SV"`,
  `source_lang: "ES"`. Keep the `:fx` free-tier host selection logic exactly.
  Result fields are `titleSv` / `descriptionSv`.
- `DEEPL_CORRECTIONS` for Swedish (DeepL never sees the SYSTEM glossary, so
  post-edit its literal renderings). Use exactly this table, word-boundary,
  case-insensitive, applied to title and description:
  `[/\bnybyggnation\b/gi, "nyproduktion"]`, `[/\bnytt bygge\b/gi, "nyproduktion"]`,
  `[/\bpå plan\b/gi, "på ritning"]`, `[/\bvindsvåning\b/gi, "takvåning"]`,
  `[/\bparhus\b/gi, "radhus"]` **only when the Spanish source contains "adosado"**
  (a guarded entry, see note), `[/\bgemenskap(savgift)?\b/gi, "samfällighetsavgift"]`,
  `[/\bgemensamma avgifter\b/gi, "samfällighetsavgift"]`, `[/\bfastighetsskatt \(IBI\)/gi, "IBI (kommunal fastighetsskatt)"]`.
  Note: implement the table as `Array<[RegExp, string, (src: string) => boolean]>`
  with an always-true guard for all but the `parhus` entry, so the guard is
  one shape. Do not invent more entries; a missing correction is a mild
  literalism, a wrong one rewrites a human's sentence.
- `translateWithGemini`: port propia's (lines 245–350) unchanged except the
  output field names (`title_sv` / `description_sv`) and `SYSTEM`. Model default
  `gemini-3.5-flash-lite`, env override `GEMINI_TRANSLATION_MODEL`, keep
  propia's `GEMINI_MODEL` comment about 3.6-flash's hidden thinking tokens.
- `translateWithClaude`: this is the existing ftse body, moved into a
  function; keep `MODEL = process.env.ANTHROPIC_TRANSLATION_MODEL || "claude-opus-5"`
  and the refusal check.
- Module doc comment: keep ftse's (the inverted-direction explanation and the
  "never runs in a request" reasoning), and add propia's provider-order
  paragraph (its lines 20–58) adapted: DeepL Developer tier is a **one-time**
  1,000,000-character credit; Gemini is the ongoing cheap path; Claude is the
  last resort.
- `.env.example`: below `ANTHROPIC_TRANSLATION_MODEL=`, add propia's
  `DEEPL_API_KEY` / `GEMINI_API_KEY` / `GEMINI_TRANSLATION_MODEL` block
  (`propia.node/.env.example` lines 79–94) with "English" → "Swedish".
- `CLAUDE.md` i18n section: replace "Without `ANTHROPIC_API_KEY` the job
  refuses to run" with a three-sentence version of propia's provider-order
  paragraph (its CLAUDE.md i18n section has it) for es→sv.

**No new npm dependencies**: DeepL and Gemini are called with `fetch`, as in
propia. Do not add `@google/generative-ai` or a DeepL SDK.

**Do not touch:** `scripts/translate-listings.ts`, `src/db/schema.ts`,
`src/lib/listing-copy.ts`, any `app/` file, `src/i18n/sv.ts`.

**Definition of done:** `npm run verify:local` green. Then, with the local DB
and `npm run seed:dev` if the table is empty: `npm run cron:translate -- --dry`
lists candidates with no key set; with only `ANTHROPIC_API_KEY` set to a
deliberately bogus value and `--limit 1`, the run must report the row as
FAILED with the Claude error (proving the chain reaches the last provider and
that a failure is per-row); with no keys and no `--dry` it exits 1 with the
"none of DEEPL_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY is set" message.
Do not make a real paid API call. Report files changed and deviations.

**Director review:** exported signatures unchanged (`tsc` proves it); the
correction table matches the spec exactly; `isTranslationConfigured()` is
any-of-three; no SDK added to `package.json`.

## PR-6 — `claude/ops-runners` — "Operations jobs: one runner per job in src/lib/ops/, CLIs become thin shells"

Builder: **Sonnet**. Spawn after PR-5 merges and reset to `origin/main`. Spec:

**Reference exemplars (read all four, copy the shape):**
`propia.node/src/lib/ops/fx.ts`, `.../ops/resync.ts`, `.../ops/translate.ts`,
`.../ops/geo.ts`, and the CLIs `propia.node/scripts/fetch-fx.ts`,
`resync-stale.ts`, `translate-listings.ts`. `src/lib/ops/types.ts` and
`scripts/ops-cli.ts` already exist in this repo (Batch 1) — use them, do not
re-copy them. The rule they encode (from `AGENTS.md` §4): the dry run must be
the same pass over the same rows as the real one, and the CLI computes nothing
of its own.

**Create these runners**, each `export async function run<Job>(opts): Promise<OpsResult>`
returning `opsRun("<job>", opts.dry, async (out) => { … })`, with counter keys
in **Swedish** lower-case identifiers (this is a Swedish-operator site; propia's
are Spanish):
1. `src/lib/ops/fx.ts` — `runFx`. Move `parseEcbDaily()` and the ECB fetch out
   of `scripts/fetch-fx.ts` unchanged. The fetch failure and parse failure
   **throw** with the existing "wrote nothing, the previous rate stands"
   wording (propia's fx runner also throws on fetch failure; the CLI's `runCli`
   turns that into exit 1). Counters: `rader` (1 in both modes). Note the rate
   and observed date. Keep the `onDuplicateKeyUpdate` write.
2. `src/lib/ops/geo.ts` — `runGeo`. Port `scripts/sync-display-coords.ts`'s
   drift count, `syncAllDisplayCoords`, and the orphan report. Counters:
   `stale`, `utan_position`.
3. `src/lib/ops/resync.ts` — `runResync` wrapping `src/lib/import/resync.ts`'s
   `runResync` (import it as `sweepStaleListings` as propia does; the inner
   function is not renamed). Options `{ days?, userId? }`. Counters:
   `kandidater`, `pausade` (dry reports candidate count under `pausade`, as
   propia explains in its comment).
4. `src/lib/ops/translate.ts` — `runTranslate` with `TranslateOptions
   { id?, force? }`, porting `scripts/translate-listings.ts`'s `candidates()`
   generator, the update statement (`titleSv`, `descriptionSv`,
   `translationHashSv`), the `sourceLang = 'es'` filter (keep it — propia has
   no such column) and the coverage query. Counters: `väntande`, `översatta`,
   `misslyckade`, `uppskjutna`, `med_svenska`, `publicerade`. The
   no-provider-key error text comes from PR-5's wording.
5. `src/lib/ops/medians.ts` — `runMedians` from `scripts/compute-medians.ts`;
   read that script first, keep its `built_m2`-only rule and comment.
6. `src/lib/ops/sessions.ts` — `runSessions` from `scripts/purge-sessions.ts`
   (counter `raderade`; dry counts the rows the predicate matches).
7. `src/lib/ops/backfill-images.ts` and `src/lib/ops/import-csv.ts` — from
   the two scripts of the same name; `backfill-images` must keep gating on
   `isR2Configured()` and throw (not silently return) when unconfigured;
   `import-csv` must keep calling `planImport`/`commitImport` and must accept
   `--dry` as the plan-only path. Positional args go through `positionals()`
   from `ops-cli.ts`.
Every runner starts with `import "server-only";`. There is deliberately **no**
`src/lib/ops/index.ts` barrel (propia's `types.ts` comment explains why —
keep that comment). Add `"cron:medians"` etc. to `OpsJob` only if missing.

**Rewrite the eight `scripts/*.ts` CLIs** to propia's three-line shape:
`import "./db-credential"` first, then the runner, then
`void runCli(() => run<Job>({ dry: DRY, limit: flagNumber("--limit"), … }))`,
with `failWhen` for translate (`misslyckade > 0`). Keep each script's header
comment (usage lines) but point it at the runner file. `resync-stale.ts`
keeps accepting `--days=N` and `RESYNC_STALE_DAYS` (use `flagNumber("--days")`;
`ops-cli.ts` handles both `--days 45` and `--days=45`). Seeds and
`create-user.ts` stay as they are (already carrying `db-credential` from PR-2).

**Do not touch:** `src/lib/import/jobs.ts`, `upsert.ts`, `resync.ts`
(the inner sweep), `src/lib/geo.ts`, `src/lib/translate.ts`, `src/db/`, any
`app/` file. **Do not create an `ops_runs` table, `runs.ts`, or an
`/admin/operaciones` page** — that is a schema change and a founder decision;
this PR only makes it possible.

**Definition of done:** `npm run verify:local` green. Against the local DB
(seeded with `seed:locations` + `seed:dev`), capture **before** (on `main`)
and **after** (your branch) output of: `cron:geo -- --dry`, `cron:resync --
--dry`, `cron:translate -- --dry`, `cron:medians -- --dry`, `cron:sessions --
--dry`, `cron:fx -- --dry` (expect the ECB-unreachable error both times in
this sandbox). Every number must match before/after; the format may differ
(the new `printResult` table). Paste both in the PR. Report deviations.

**Director review:** each runner's dry and real paths are the same loop with
one `if (opts.dry)` short-circuit before the write (grep for a second query
that only runs in one mode — that is the bug this pattern exists to prevent);
`db-credential` is line 1 of every CLI; no `ops_runs`; counters exist in both
modes (`out.track`) so a zero renders instead of vanishing.

## PR-7 — `claude/ops-migrations-read` — "db:status: read logic moves to src/lib/ops/migrations.ts"

Builder: **Sonnet** (can run in parallel with PR-5 on its own branch). Spec:

**Reference:** `propia.node/src/lib/ops/migrations.ts` (320 lines,
`readDatabaseStatus()`, `readSchemaDrift()`, `driftCount()`, the typed
`DatabaseStatus` / `MigrationStatus` / `SchemaDrift`) and
`propia.node/scripts/check-migrations.ts` (252 lines: `report()` formatting
and the `--probe` branch, the only write path).

**Change:** split `flyttatillspanien/scripts/check-migrations.ts` (375 lines)
the same way: everything that reads (`describeTarget`, `hashOf`, the journal
read, the `__drizzle_migrations` comparison, the `information_schema` drift
diff, strict-mode check) becomes `src/lib/ops/migrations.ts` with propia's
exported names and types; the script keeps `report()` and `--probe`. The
probe must keep using `DATABASE_URL_RW ?? DATABASE_URL` (PR-2 set that) and
keep its `finally` rollback. While there, fix the stale narration KNOWN-ISSUES
records ("still probes for migration 0009 by name" — this repo's migrations
were regenerated as `0000_spain_schema.sql`): make the owner-lane sentence
name the enum and column, not a migration number, and delete that
KNOWN-ISSUES entry.

**Do not touch:** `drizzle/`, `src/db/`, `package.json`.

**Definition of done:** `verify:local` green; `npm run db:status` against the
local migrated DB prints `No drift`; `npm run db:status -- --probe` prints the
probe result and leaves `SELECT COUNT(*) FROM leads` unchanged (check before and
after, paste both). Output must be line-for-line identical to `main`'s except
the corrected 0009 sentence — paste a diff of the two outputs.

**Director review:** `readDatabaseStatus()` opens its own `mysql2` connection
(not the app pool) as propia's does; nothing in `src/lib/ops/migrations.ts`
writes; the script is the only place `--probe` exists.

## Batch 2 verification checklist
- After **every** PR: `npm run verify:local` — never `--no-verify`.
- PR-6 and PR-7 additionally run their scripts in `--dry` form against the
  local database with before/after output pasted; PR-5 runs the three
  key-configuration checks in its spec. If Docker is unavailable, the PR says
  so and does not describe a run that did not happen.
- `verify:scopes`: not required for any Batch 2 PR (no panel query, no
  `listingScopeWhere`/`panelScope` change). Say so in each PR body.
- `npm run db:status`: no Batch 2 PR touches `src/db/schema.ts`. PR-6 in
  particular must **not** add `ops_runs`; if a builder does, revert it. Any PR
  that does touch the schema gets a `MIGRATION REQUIRED —` title, must show
  `No drift` after the founder migrates, and is never merged by an agent.
- No agent holds `DATABASE_URL_RW`; the local docker credential is the only
  write credential either window sees.
- After Batch 2: update `CLAUDE.md`'s "Last verified against the code" date and
  its backlog to say the ops runners exist and `/admin` one-click buttons are
  now a UI-plus-`ops_runs`-migration task (founder decision).
