# Phase 4 — Admin & agency panels. Paste into a fresh Sonnet session, ONLY after phase 3 is merged.

Read `plan.md` FIRST, in full — plus §9 build log and `KNOWN-ISSUES.md`.
Read `docs/SPAIN-PORTAL-DESIGN.md` §3.3 (lister types), §3.4 (identity,
non-column decision), §2 (FX override) for the exact fields this phase
exposes to operators. Execute plan §6 "Phase 4" under the autonomy protocol
§4. Build nothing outside the plan.

**Hard limits (repeated from plan §4.7):** no schema changes, no auth/
session logic changes, no import-planner algorithm changes, no facet/URL
vocabulary changes. `/admin` writes go through the same server actions
Phase 2 built (extend them if a field is missing a write path — do not add
a second write path).

Phase rules:
- Branch `phase/4` off latest `main`. If `phase/3` is not yet merged, stop
  and report.
- `nota_simple_seen_at` is operator-only by design (design doc §3.2) — it
  must not appear on any lister-facing form, only in `/admin`.
- The identity fields (`identity_doc_type`, `identity_ref_last4`,
  `identity_verified_at`) are set by an operator who sighted a document —
  build the action, not a self-serve upload; full document storage is
  explicitly out of scope (needs R2 + a retention policy, not this phase).
- FX and acquisition-cost overrides call the `revalidateFx()`/
  `revalidateAcquisitionCosts()` functions Phase 1 exported — confirm the
  public page reflects the change without waiting for the TTL, since these
  are the one in-process writer path the design doc calls out explicitly.
- A `relocation`-kind agency must read distinctly from an `inmobiliaria`
  one everywhere its name surfaces publicly (seller card, agent/agency
  directory) — "represents the buyer's side," not blurred into "agency."
- Verification is mechanical, not "looks right": create a local admin
  with the existing `scripts/create-user.ts`, seed data with Phase 3's
  `npm run seed:dev`, exercise the flip/override via authenticated HTTP or
  by invoking the server action from a script, then curl the affected
  public page and grep the rendered HTML for the change.
- Re-runnable; minor issues → `KNOWN-ISSUES.md`; stop only per plan §4.4.

Exit: the concrete checklist at the end of plan §6 Phase 4 — the
`nota_simple_seen_at` flip and FX override verified visible immediately
(the in-process `revalidate*()` path, not the TTL), a relocation-kind
agency's public listing shows the distinct label (curl + grep),
`npm run build` green. PR merged green on `main`.

## After this phase — hand off to Phase 5 (fresh session, same model)

Only after all four handoff gates in plan §4.9 pass, spawn Phase 5 as a NEW
session via `create_session`: inherit environment and permission mode
(never `plan` mode), `model` = Sonnet, prompt exactly
`Read prompts/sonnet-3-seo-content-docs.md in this repo and execute it.`
If `create_session` is unavailable, continuing in the same window is an
acceptable fallback since the model is unchanged.
