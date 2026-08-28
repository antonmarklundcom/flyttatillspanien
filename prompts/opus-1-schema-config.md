# Phase 1 — Schema, config & core libs. Paste into a fresh Opus session.

Read `plan.md` FIRST, in full — plus §9 build log and `KNOWN-ISSUES.md` (if
it exists). Then read `docs/SPAIN-PORTAL-DESIGN.md` in full — it is the
design contract this phase implements, referenced but not duplicated in
`plan.md`. Execute plan §5 "Phase 1" under the autonomy protocol §4. Build
nothing outside the plan.

Phase rules:
- Branch `phase/1` off latest `main`.
- This is the first phase — there is nothing to check out from a previous
  one, but still check whether `phase/1` already has commits (a resumed
  session) before starting fresh work.
- The current repo is a byte-for-byte copy of propia.node (Paraguay). Every
  fact in the current `CLAUDE.md`/`ARCHITECTURE.md`/`README.md`/`PLAN.md`
  describes that portal, not this one — read them only as the *pattern
  library* the design doc tells you to read them as (e.g. how
  `unstable_cache` tags work, how `syncDisplayCoords` avoids
  non-sargable queries). Do not treat any Paraguay-specific fact in them as
  true for this build. Do not rewrite those four docs yet — that's Phase 5.
- Do the schema rewrite as ONE clean migration — there is no production
  data, this is not an incremental migration series.
- The i18n translation work (es.ts → sv.ts) needs real Swedish, not
  placeholder text — translate intent, matching the design doc's "the
  editorial voice the site should have" standard, the same way the design
  doc says `en.ts` on propia.node translates intent rather than the
  Spanish sentence.
- `npm run typecheck` will likely still show errors in files Phase 2 owns
  (query layer, import pipeline, leads/auth consumers) — that's expected.
  Before merging, list exactly which remaining errors are Phase 2's to fix
  in your §9 build-log entry, so Phase 2 doesn't have to rediscover them.
- Re-runnable; minor issues → `KNOWN-ISSUES.md`; stop only per plan §4.4.

Exit: the concrete checklist at the end of plan §5 Phase 1 — typecheck
(modulo the documented Phase-2 exceptions), clean migration apply, zero
`db:status` drift, both seed scripts run successfully, `cron:fx` either
writes a real row or fails gracefully. PR merged green on `main`.

## After this phase — hand off to Phase 2 (fresh session)

Only after all four handoff gates in plan §4.9 pass (PR merged, exit
checklist passed, pre-handoff audit done, build-log entry committed), spawn
Phase 2 as a NEW session via `create_session`: inherit this session's
environment and permission mode (never `plan` mode), `model` = Opus, prompt
exactly `Read prompts/opus-2-core-logic.md in this repo and execute it.`
If `create_session` is unavailable, stop and report — Phase 2 is also Opus,
so continuing in the same window is fine as a fallback if the tool truly
isn't there, but prefer the fresh session per the protocol's cheap-context
reasoning.
