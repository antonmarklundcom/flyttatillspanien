# Phase 3 — Public-facing pages. Paste into a fresh Sonnet session, ONLY after phase 2 is merged.

Read `plan.md` FIRST, in full — plus §9 build log and `KNOWN-ISSUES.md`.
Read `docs/SPAIN-PORTAL-DESIGN.md` §3.1–§3.2 and §3.8 (the MVP field table)
for exactly which fields must be visible where. Execute plan §6 "Phase 3"
under the autonomy protocol §4. Build nothing outside the plan.

**Hard limits (repeated from plan §4.7 — this is a Sonnet phase):** no
changes to `src/db/schema.ts`, no auth/session logic changes, no import-
planner algorithm changes, no facet/URL vocabulary changes (`FACET_PARAM`,
`SortOption`, path segments are Phase 1's decisions). Read listing/location/
pricing data only through the query layer, `facet-sql.ts`, and
`acquisition-cost.ts`/`amortization.ts` that Phases 1–2 built. If you hit a
gap in that layer, work around it at the page level and note it in
`KNOWN-ISSUES.md` — do not reach back into schema or core logic.

Phase rules:
- Branch `phase/3` off latest `main`. If `phase/2` is not yet merged, stop
  and report.
- Every visible string goes through `sv.ts` — no new inline literal copy in
  a page or component, same rule the pattern-library docs state for
  propia.node's `es.ts`.
- `alquiler_vacacional` ships at MVP — already decided in plan §1, do NOT
  stop to ask: build the `tourist_licence` input into the wizard (shown
  for holiday-let listings) and render the licence on the detail page.
- `/for-maklare` (the Swedish agency-acquisition page, plan §6 Phase 3) is
  this phase's scope too; its Spanish sibling `/es/inmobiliarias` is §10
  backlog — don't build it.
- Test data is a committed script, `scripts/seed-dev-listings.ts`
  (`npm run seed:dev`), per the plan's exit criteria — not manual inserts.
  Phases 4 and 6 reuse it.
- The legal/compliance fields are the differentiator the whole design doc
  is built around — do not bury them. `legal_status`/`charges_status` must
  render as two distinct lines ("seller says" vs. "portal verified"), not
  merged into one badge.
- Seed enough test data locally (per the plan's exit criteria) to actually
  see the landmine cases render — an `en_tramite` energy rating and a
  `sin_lpo` legal_status row — before calling this done.
- Re-runnable; minor issues → `KNOWN-ISSUES.md`; stop only per plan §4.4.

Exit: the concrete checklist at the end of plan §6 Phase 3 — seeds clean
(`seed:locations` + `seed:costs` + `seed:dev`), then `npm run build &&
npm run start` and curl the plan's route list (home, an operation hub, a
category page, a landmine-case `/bostad/[slug]`, `/for-maklare`, the
wizard entry) — all 200 with no runtime error in the server log;
`verify:i18n` and `verify:facets` still green. PR merged green on `main`.

## After this phase — hand off to Phase 4 (fresh session, same model)

Only after all four handoff gates in plan §4.9 pass, spawn Phase 4 as a NEW
session via `create_session`: inherit environment and permission mode
(never `plan` mode), `model` = Sonnet, prompt exactly
`Read prompts/sonnet-2-admin-agencia.md in this repo and execute it.`
If `create_session` is unavailable, continuing in the same window is an
acceptable fallback here since the model doesn't change — but still start
Phase 4 as a fresh read of `plan.md` rather than relying on this session's
accumulated context, per the protocol's cheap-context reasoning.
