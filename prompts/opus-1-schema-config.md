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
- The i18n work (es.ts → sv.ts) is the STRUCTURAL rename plus
  working-draft Swedish (plan §5.1 item 8): correct language and intent,
  no Spanish left, no empty strings — but the final editorial voice is
  Phase 5's scope, on purpose (the dictionary is ~1,100 lines and this
  phase is already the biggest). Flag the draft status in your §9
  build-log entry so Phase 5 knows.
- `npm run typecheck` will likely still show errors in files Phase 2 owns
  (query layer, import pipeline, leads/auth consumers, pages still
  reading deleted columns) — that's expected.
  Before merging, list exactly which remaining errors are Phase 2's to fix
  in your §9 build-log entry, so Phase 2 doesn't have to rediscover them.
- Because of those known-remaining errors, `.githooks/pre-push` (typecheck
  + build + the verify scripts) WILL fail on this phase's push. Push with
  `git push --no-verify` — this is the sanctioned §4.2 exception, unique
  to Phase 1: `main` is knowingly red until Phase 2 merges, and nothing
  deploys it before Phase 6. Do not "fix" the redness by pulling Phase 2's
  scope into this phase.
- `scripts/compute-medians.ts` moves to `price_eur`/`built_m2` in this
  phase's script pass — the design doc's script table says `cron:medians`
  is "unchanged" and is wrong on that one point (plan §5.1 item 9).
- After the docker-compose rename, the local `DATABASE_URL` is
  `mysql://ftse:ftse@127.0.0.1:3306/ftse` — the `propia` string in the
  inherited `CLAUDE.md` is stale the moment your own rename lands.
- Re-runnable; minor issues → `KNOWN-ISSUES.md`; stop only per plan §4.4.

Exit: the concrete checklist at the end of plan §5 Phase 1 — typecheck
(modulo the documented Phase-2 exceptions), clean migration apply, zero
`db:status` drift, both seed scripts run with the row counts the plan
states (41 municipios + 10 zonas + 7 acquisition_costs rows), `cron:fx`
either writes a real row or fails gracefully. PR merged on `main`
(via `--no-verify`, per above — the only phase allowed to).

## After this phase — hand off to Phase 2 (fresh session)

Only after all four handoff gates in plan §4.9 pass (PR merged, exit
checklist passed, pre-handoff audit done, build-log entry committed), spawn
Phase 2 as a NEW session via `create_session`: inherit this session's
environment and permission mode (never `plan` mode), `model` = Opus, prompt
exactly `Read prompts/opus-2-core-logic.md in this repo and execute it.`
If `create_session` is unavailable: continue in the same window (Phase 2
is also Opus), but start it as a fresh read of `plan.md` + §9 +
`KNOWN-ISSUES.md`, not from this session's accumulated context.
