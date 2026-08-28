# Phase 2 — Core logic: query layer, import, auth, leads, verify. Paste into a fresh Opus session, ONLY after phase 1 is merged.

Read `plan.md` FIRST, in full — plus §9 build log (Phase 1's entry names the
typecheck errors this phase inherits) and `KNOWN-ISSUES.md`. Read
`docs/SPAIN-PORTAL-DESIGN.md` §3.1 (import/catastral), §3.2 (publish gate),
§3.7 (leads/users/otp) in full. Execute plan §5 "Phase 2" under the
autonomy protocol §4. Build nothing outside the plan.

Phase rules:
- Branch `phase/2` off latest `main`. If `phase/1` is not yet merged, stop
  and report — do not build on top of an unmerged phase.
- Start from Phase 1's build-log entry's list of known-remaining typecheck
  errors; that is your starting checklist, not a full re-audit from zero.
- The catastral dedup path and the phone-bucket fallback path are both
  real and must both be covered by a passing fixture in
  `verify:import` — do not special-case one at the expense of leaving the
  other untested.
- The publish gate (`energy_rating` required for `status: "published"`)
  belongs in the server action, matching where `commitImportAction`'s
  permission check already lives — a form-only check is bypassed by the
  importer, which is the primary listing-creation path.
- The email-first flip touches `sendOtp` semantics: never log or return a
  line that claims a message was delivered when it was not (same rule
  `CLAUDE.md`'s pattern library states for the WhatsApp version — carry the
  principle, not the channel).
- Re-runnable; minor issues → `KNOWN-ISSUES.md`; stop only per plan §4.4.

Exit: the concrete checklist at the end of plan §5 Phase 2 — full
typecheck pass, all four pure verify scripts green, the DB-backed
`verify:import` exercise green with both dedup paths covered,
`verify:scopes` green including a `relocation`-kind agency, `npm run build`
green. PR merged green on `main`.

## After this phase — hand off to Phase 3, and the model switches (fresh session)

Only after all four handoff gates in plan §4.9 pass, spawn Phase 3 as a NEW
session via `create_session`: inherit this session's environment and
permission mode (never `plan` mode), `model` = **Sonnet** (this is the
model-group switch — Phase 3 onward is Sonnet, never Fable), prompt exactly
`Read prompts/sonnet-1-public-pages.md in this repo and execute it.`
If `create_session` is unavailable: stop and report rather than continuing
in the same window — Phase 3 needs a different model and this session
cannot switch its own model mid-run.
