# Phase 5 — SEO, content & docs rewrite. Paste into a fresh Sonnet session, ONLY after phase 4 is merged.

Read `plan.md` FIRST, in full — plus §9 build log and `KNOWN-ISSUES.md`.
Read `docs/SPAIN-PORTAL-DESIGN.md` in full — this phase's docs rewrite must
match it exactly, section for section, and its §4 "Where to flag it" gives
the exact wording pattern for the mortgage-calculator backlog item. Execute
plan §6 "Phase 5" under the autonomy protocol §4. Build nothing outside the
plan.

**Hard limits (repeated from plan §4.7):** no schema changes, no auth/
session logic changes, no import-planner algorithm changes, no facet/URL
vocabulary changes.

Phase rules:
- Branch `phase/5` off latest `main`. If `phase/4` is not yet merged, stop
  and report.
- The docs rewrite (`CLAUDE.md`, `ARCHITECTURE.md`, `README.md`, the
  upper-case `PLAN.md`) is real scope for this phase, not an afterthought —
  budget real time for it. These four files currently describe propia.node
  and must describe flyttatillspanien.se when this phase merges. Do not
  patch isolated lines; rewrite each file's substance to match current
  reality, the same standard `CLAUDE.md`'s own header states ("this file is
  the state of the world").
- Grep for `propia`, `Paraguay`, `Gs`, `.com.py`, `WhatsApp OTP` across
  those four files before merging; anything left describing the old portal
  as current fact is a bug in this phase's own work, not pre-existing debt
  to leave for later. (Backend-only cosmetic strings acknowledged in plan
  §5 Phase 1's rename table — the ones NOT renamed by design, if any remain
  — are the only acceptable exception, and only if plan.md or the design
  doc explicitly says to leave them.)
- Add the `D-mortgage` decision to the rewritten `PLAN.md` and the mortgage-
  calculator backlog item to the rewritten `CLAUDE.md`, using the design
  doc §4's wording as the template, not a paraphrase that loses the
  reasoning.
- Re-runnable; minor issues → `KNOWN-ISSUES.md`; stop only per plan §4.4.

Exit: the concrete checklist at the end of plan §6 Phase 5 — `verify:seo`
green, the four docs read as self-consistent and free of leftover
Paraguay-as-current-fact statements, `npm run build` green. PR merged green
on `main`.

## After this phase — hand off to Phase 6 (fresh session, same model)

Only after all four handoff gates in plan §4.9 pass, spawn Phase 6 as a NEW
session via `create_session`: inherit environment and permission mode
(never `plan` mode), `model` = Sonnet, prompt exactly
`Read prompts/sonnet-4-deploy.md in this repo and execute it.`
If `create_session` is unavailable, continuing in the same window is an
acceptable fallback since the model is unchanged.
