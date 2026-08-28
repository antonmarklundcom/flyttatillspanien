# Phase 6 — Deploy. FINAL PHASE. Paste into a fresh Sonnet session, ONLY after phase 5 is merged.

Read `plan.md` FIRST, in full — plus §9 build log and `KNOWN-ISSUES.md`.
Execute plan §6 "Phase 6" under the autonomy protocol §4. Load the
`nextjs-deploy-hostinger` skill before touching any Hostinger config,
env vars, or the database connection — it has the verified fixes for the
common Hostinger footguns (username ≠ database name, tsx not auto-loading
`.env`, IPv6 routing, the SSH npm PATH problem). Build nothing outside the
plan.

**Hard limits (repeated from plan §4.7):** no schema changes beyond running
the migrations Phase 1 already generated, no auth/session logic changes, no
import-planner changes, no facet/URL vocabulary changes.

Phase rules:
- Branch `phase/6` off latest `main`. If `phase/5` is not yet merged, stop
  and report.
- Check plan §7 "Human-inputs checklist" against what credentials/access
  are actually available in this environment before starting. A missing
  Hostinger account or domain DNS access is a stop-and-ask per plan §4.4 —
  document the exact manual steps Anton needs to do and what you need from
  him to continue, rather than guessing at an account that may not exist.
- Run `db:migrate` then immediately `db:status` against production —
  `plan.md`'s inherited lesson from propia.node is that a database behind
  on migrations 500s entire page trees, and the fix is to always confirm
  zero drift right after migrating, not to assume the migrate command's
  exit code was enough.
- hPanel cron-job registration cannot be automated from this session —
  document the exact command lines (e.g. `npx tsx scripts/fetch-fx.ts`) and
  suggested schedule for each cron script from plan §5 Phase 1's script
  list, as a numbered manual checklist in your closing report.
- Re-runnable; minor issues → `KNOWN-ISSUES.md`; stop only per plan §4.4.

Exit: the concrete checklist at the end of plan §6 Phase 6 — production
build succeeds, `db:status` zero drift, home + one category page return
200, PR merged green on `main`.

## This is the final phase — STOP here, no further handoff

Do not spawn another session. After the four handoff gates in plan §4.9
pass (PR merged, exit checklist passed, pre-handoff audit done, build-log
entry committed to §9), end with a closing report to Anton containing:

1. The live URL(s) actually reached (real domain, or the interim Hostinger
   hostname if DNS is still propagating — say which).
2. A numbered checklist of exactly what's still manual: cron job
   registration (exact command lines), DNS propagation if pending, R2
   bucket creation for image storage (still blocked on the Cloudflare
   account per plan §7), setting a real `CONTACT_EMAIL` mailbox,
   `ANTHROPIC_API_KEY` if translation output is wanted soon.
3. A one-line pointer to `plan.md` §9 for the full six-phase build history.
4. A suggestion, per the `phased-autonomous-build` skill's own closing
   step: once the site is live and stable, ask Anton whether he wants a
   project-specific skill (like `propia-dev`) written for
   flyttatillspanien.se, capturing the final schema, routes, and
   do-not-touch guardrails for future sessions working in this repo.
