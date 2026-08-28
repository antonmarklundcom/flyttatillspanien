# plan.md — flyttatillspanien.se build plan

Turns the propia.node (Paraguay) copy sitting in this repo into
flyttatillspanien.se: Spanish property, Swedish buyers. The full delta is
already decided in `docs/SPAIN-PORTAL-DESIGN.md` — this file sequences that
decision into phases a fresh Claude Code session can execute unattended, one
PR each. **Read the design doc before any phase; it is not duplicated here,
only referenced by section.**

> **Naming note:** this repo already has an upper-case `PLAN.md` — the
> propia.node build tracker, inherited byte-for-byte in the initial copy.
> That file and this lower-case `plan.md` are different documents on a
> case-sensitive filesystem: `PLAN.md` is *content* that Phase 3 rewrites
> (per the design doc's "Docs that must be rewritten" list) into the Spain
> project's own living status tracker; `plan.md` (this file) is the
> phased-build script that gets deleted or archived once the build finishes.
> Do not merge them.

| Phase | Model | Prompt file | Plan sections | What it produces |
| --- | --- | --- | --- | --- |
| 1 | Opus | `prompts/opus-1-schema-config.md` | §5.1 | New schema, verticals.ts, env vars, cosmetic renames, core libs (facets/urls/format/cache/amortization/acquisition-cost), i18n machinery (sv.ts, en.ts deleted), seed/cron scripts |
| 2 | Opus | `prompts/opus-2-core-logic.md` | §5.2 | Query layer, import/dedup, leads/auth/OTP, publish gate, verify:* scripts — everything Sonnet is forbidden to touch |
| 3 | Sonnet | `prompts/sonnet-1-public-pages.md` | §6.1 | Home, category/hub pages, search bar, listing card, detail page, wizard — wired to the Phase 1–2 layer |
| 4 | Sonnet | `prompts/sonnet-2-admin-agencia.md` | §6.2 | `/admin`, `/agencia`, `/publicar` panels: relocation-agency kind, identity verification UI, energy/legal-status editing, FX & acquisition-cost admin override |
| 5 | Sonnet | `prompts/sonnet-3-seo-content-docs.md` | §6.3 | Sitemap, structured data, guide content seeding, and the CLAUDE.md/ARCHITECTURE.md/README.md/PLAN.md rewrite the design doc requires |
| 6 | Sonnet | `prompts/sonnet-4-deploy.md` | §6.4 | Hostinger app + MySQL setup, env vars, domain, cron jobs, production migration, smoke test |

Phases 1–2 are Opus because a wrong call in schema shape, the catastral
unique-index-over-nullable behaviour, the EUR-only price column, or the
publish gate placement forces a rewrite of everything built on top. Phases
3–6 are Sonnet: templated UI work, content, and infra wiring against a
foundation that is already decided and must not change.

---

## 1. Decisions already made — do not re-litigate

Everything in `docs/SPAIN-PORTAL-DESIGN.md` is decided, not proposed — it was
written as a design pass and its own final section is literally titled
"Handoff to Sonnet: concrete decisions, ready to apply." In particular:

- **One vertical only**, `flyttatillspanien.se`, `locale: "sv"`. No `.es`
  door, no disabled English entry. (§1 of the design doc)
- **EUR is the only stored price.** SEK is computed at render from a cached
  ECB rate, rounded to the nearest 10 000 kr, and disappears (not zero, not
  wrong — `null`) when the rate is older than 7 days. Never `price_sek` on a
  row, never `price_eur * :rate` in a WHERE clause. (§2)
- **Full Spain legal/schema block** — referencia catastral (exact dedup key,
  unique-over-nullable), energy rating with a publish gate, legal_status,
  charges_status vs nota_simple_seen_at, IBI/comunidad, is_vpo,
  land_classification. All MVP per the §3.8 table — build the whole table,
  do not phase it. (§3)
- **Three lister types, one table**: `agencies.kind` enum
  (`inmobiliaria | relocation | developer`) — no forked scope machinery.
  (§3.3)
- **No full NIE/DNI column.** Last-4 + doc type + verified_at only. Full
  capture is a founder decision + DPA, not a build task. (§3.4)
- **Leads/users/OTP flip to email-first**, phone optional — the inverse of
  propia.node's WhatsApp-first design, because Sweden is email-first and
  Paraguay was not. (§3.7)
- **Cuota engine**: keep `frenchAmortization()` verbatim (moved, unused),
  delete the entire Paraguayan programme layer, replace with
  `acquisition-cost.ts` — computed at render, never cached on a column, no
  Spanish mortgage calculator at MVP. (§4)
- **`en.ts` is deleted** at MVP, not kept disabled — reintroduce it only when
  the English domain is bought. (Handoff → i18n)
- **XML feed ingestion is v1.1**, not MVP. Intake stays CSV/XLSX through the
  existing `planImport`/`commitImport` planner. (Handoff → explicitly out of
  scope)

If a phase session finds a decision in this file or the design doc that
looks wrong once real code is in front of it, it still implements it as
written and logs the concern in §9 or `KNOWN-ISSUES.md` — it does not
silently deviate. Only a genuinely new bad-foundation question (not covered
by the design doc at all) triggers the stop-and-ask rule in §4.4 below.

## 2. Roles & object model

Unchanged in shape from propia.node, values changed:

- **Roles** (`users.role` enum): `consumer | agent | agency_admin | developer
  | admin` — unchanged.
- **Listers** (who can own a listing): agency-affiliated (`agencies` +
  `agents`, now including `kind: "relocation"`), private FSBO
  (`listings.owner_user_id`, no `agents` row), and developer/project-linked.
  Design doc §3.3 — do not fork `listingScopeWhere`/`panelScope` for the new
  `relocation` kind; it is a value on the existing enum, not a new table.
- **Objects**: one `listings` table (wide, denormalized, as propia.node),
  typed reference tables (`fx_rates`, `acquisition_costs`) replacing
  `financing_programs`. `locations` gains a fifth hierarchy level
  (`comunidad`) and `acquisition_region`.
- Code/DB identifiers in English or Spanish (feed vocabulary — see design
  doc §3.1 on why DB enum values stay Spanish); public URLs and copy in
  Swedish (`src/lib/urls.ts`, `src/i18n/sv.ts`); every UI string through the
  dictionary from the first line touched.

## 3. Feature scope

**Core (MVP, all phases below build toward this):**

- Single-vertical Spanish-property-for-Swedish-buyers portal, EUR pricing
  with computed SEK display, full legal/compliance block, three lister
  types, CSV/XLSX white-glove + agency import with catastral-exact dedup,
  email-first leads/auth, acquisition-cost estimate on the detail page,
  Swedish-only UI with the `sv.ts` dictionary.
- Seeded reference data: 7 comunidades in `acquisition_costs` (PLACEHOLDER
  rates, flagged as such), the Spain locations tree per the design doc's
  seed table (§ "Seeded regions").

**Explicitly deferred (see §10 Backlog and the design doc's own "Explicitly
NOT in scope" list) — do not build any of these in phases 1–6:**

- Second vertical/domain (English or `.es`), in any form, disabled or not.
- Stored `price_sek`, cached per-listing acquisition-cost column.
- Full NIE/DNI capture.
- Spanish mortgage calculator or any stub of one.
- XML feed ingestion (Idealista/Fotocasa/Kyero).
- R2 image pipeline activation (code exists upstream in propia.node's
  pattern, blocked on the founder creating the Cloudflare account — carry
  the same "do not build around it" rule forward).
- Reviews/ratings.
- Anything under `.github/workflows/` — the local `.githooks/pre-push` gate
  is CI here, same as propia.node.

## 4. Autonomy protocol

Every phase prompt operates under these rules:

1. Work until the phase's exit criteria all pass; never ask permission for
   in-plan work.
2. One PR per phase: branch `phase/<id>` off latest `main`; create, watch,
   and merge the PR when green; a red build is always the session's own
   work to fix. Never start a phase on top of an unmerged previous phase —
   check `git log`/open PRs first.
3. Minor non-blocking issues → append to `KNOWN-ISSUES.md` (create it in
   Phase 1 if it doesn't exist), keep building.
4. **Stop and ask ONLY for:**
   - a missing credential with no graceful fallback (e.g. a real Hostinger
     DB password in Phase 6 — document the exact manual step instead and
     continue everything else that doesn't need it);
   - a bad-foundation decision (schema shape, auth, money math, dedup/
     conflict logic) that isn't already answered in
     `docs/SPAIN-PORTAL-DESIGN.md` or this file, where guessing wrong forces
     a rewrite of later phases.
   Everything else: choose reasonably, record the choice in the §9 build
   log, continue.
5. Missing env values never block a phase: document in `.env.example`,
   degrade gracefully (this repo already does this for `R2_*` and
   `CONTACT_EMAIL`/`CONTACT_WHATSAPP` — keep the pattern, extend it to
   `FX_MAX_AGE_DAYS`, `ANTHROPIC_API_KEY`, etc.).
6. Every phase prompt is re-runnable: on start, check what already exists on
   the branch and continue from the first unmet exit criterion instead of
   redoing finished work.
7. **Sonnet phases (3–6) hard limits**: no changes to `src/db/schema.ts`, no
   changes to auth/session logic, no changes to the dedup/import planner's
   core algorithm, no changes to the facet/URL vocabulary decided in Phase
   1. Page data access only through the query layer Opus phases built
   (`src/lib/*-queries.ts`, `facet-sql.ts`, `acquisition-cost.ts`,
   `amortization.ts`). Hit a foundation gap → work around it in the page
   layer and note it in `KNOWN-ISSUES.md`, do not reach back into schema or
   core logic to "fix" it.
8. **Model cost guardrail** — Fable (`claude-fable-5`/Mythos-class) is
   NEVER used for build phases, subagents, or spawned sessions. This phase
   table only ever names Opus and Sonnet. If a build session believes Fable
   is genuinely needed for something mid-build, it stops and asks Anton
   first with the reason — spawning Fable without explicit approval is
   treated like a destructive action, because it burns limited usage.
   Fable's only role in this method is the human-driven planning
   conversation that happens before Phase 1 starts (see the Fable prompt
   handed to Anton separately, for reviewing/finalizing this plan itself —
   not for executing any phase).
9. **Phase handoff** — hand off only when four gates pass: PR merged green;
   the phase's exit checklist passed; **pre-handoff audit** done (re-run
   `npm run verify:local` — build + typecheck + all verify scripts — and
   adversarially re-read the phase's own merged diff for anything that
   silently breaks the next phase; fix findings now, it is the last cheap
   moment); build-log entry committed to §9. Then spawn the next phase as a
   **new session** via the claude-code-remote `create_session` tool:
   inherit environment and permission mode (never `plan` mode — an
   unattended plan-mode child stalls forever waiting for approval), set
   `model` per the phase table above (this is what crosses the Opus→Sonnet
   switch automatically), `prompt` exactly:
   `Read prompts/<next-file>.md in this repo and execute it.`
   Then end the current session with a short phase report (what shipped,
   PR link, what's next). Fallback when `create_session` is unavailable:
   continue in the same window if the next phase uses the same model;
   otherwise stop and report, asking Anton to open a fresh session at the
   new model.
10. **Build log**: before merging each phase's PR, append a 5–10 line dated
    entry to §9 below — phase id + PR link, what now exists, any decisions
    or deviations from this plan, where the next phase should look first.
    Fresh sessions orient from `plan.md` + §9 + `KNOWN-ISSUES.md` ONLY — no
    replaying this conversation's history. Keep the log entries short so
    that stays cheap.

## 5. Opus phases

### Phase 1 — Schema, config & core libs (`prompts/opus-1-schema-config.md`)

Full scope: `docs/SPAIN-PORTAL-DESIGN.md` §2, §3, §4 "Keep"/"Delete outright"
subsections, and the entire "Handoff to Sonnet" section's `Config`,
`Environment variables`, `Schema`, `Scripts`, `i18n`, `URL vocabulary`,
`Cache`, `Formatting`, `Cuota engine`, and `Cosmetic renames` subsections.

Concretely, this phase:

1. Rewrites `src/db/schema.ts`: every delete/add/change in the design doc's
   Schema handoff section, across `listings`, `locations`, `agencies`,
   `users`, `leads`, `otp_codes`, `agents`, `listing_sources`; adds
   `fx_rates` and `acquisition_costs`; drops `financing_programs`. Generates
   the migration (`npm run db:generate`) — this is a clean start, no
   production data exists, so this can be one migration, not an
   incremental series.
2. Rewrites `src/config/verticals.ts` to the single-entry shape given
   verbatim in the design doc's Config section. Deletes the Paraguayan
   `VerticalKey` members.
3. Updates `.env.example`: delete `USD_TO_PYG`, add `FX_MAX_AGE_DAYS=7`,
   document `CONTACT_EMAIL` as required-before-launch (still `string |
   null` in code, per the design doc's §3.7 — this is a config/launch-
   checklist requirement, not a type change).
4. `src/lib/facets.ts` + `src/lib/urls.ts`: swap to the Swedish
   `FACET_PARAM` vocabulary and `SortOption` type given verbatim in the
   design doc; path segments `/propiedad` → `/bostad`,
   `kopa | hyra | korttidshyra`.
5. `src/lib/format.ts`: delete `formatUsd`/`formatGs`/`formatPrice`/
   `formatCuota`; add `formatEur`, `formatSek` (null past
   `FX_MAX_AGE_DAYS`, rounds to nearest 10 000), `formatRateNote`.
6. `src/lib/cuota.ts` → `src/lib/amortization.ts` (keep only
   `frenchAmortization`, unused for now); new `src/lib/acquisition-cost.ts`
   (pure function, `null` on no active region row, computed at render per
   §4's "do not cache" rule).
7. `src/lib/cache.ts`: add `fx`/`acquisitionCosts` tags + TTLs (3600 /
   86400) and `revalidateFx()`/`revalidateAcquisitionCosts()`; keep the
   file-header note about cron-written tables using TTL as the real
   invalidation mechanism (already true for `cron:cuotas`/`cron:medians` —
   extend the same paragraph, don't rewrite the reasoning).
8. `src/i18n/`: rename `es.ts` → `sv.ts`, all namespaces `es*` → `sv*`,
   every string translated to Swedish (not machine-placeholder text — real
   Swedish, in the same voseo-equivalent editorial voice the design doc
   asks the site to have). Delete `en.ts`. Update `index.ts`/`server.ts` so
   `Dictionary`, `dict()`, `getDictionary()` all point at the single
   dictionary; keep the `Widen<>` machinery even with one locale, since
   it's what makes `en.ts` a file-addition later rather than a refactor.
9. Scripts: delete `seed-financing.ts`/`seed:financing`,
   `recompute-cuotas.ts`/`cron:cuotas`; add `scripts/seed-acquisition-costs.ts`
   (`seed:costs`, idempotent upsert by region, 7 comunidades, rates marked
   PLACEHOLDER) and `scripts/fetch-fx.ts` (`cron:fx`, ECB daily XML →
   `fx_rates`, writes nothing on fetch failure); rewrite
   `scripts/seed-locations.ts`'s `TREE` for the Spain hierarchy in the
   design doc's "Seeded regions" table, setting `acquisition_region` on
   every node and starting `joinSlug` at municipio; invert
   `scripts/translate-listings.ts` to es→sv semantics (same cron-only, no
   publish-hook rule).
10. Cosmetic renames from the design doc's table: `propia_session` →
    `ftse_session`, the two `propia:*` localStorage keys → `ftse:*`,
    `package.json` name → `flyttatillspanien`, docker-compose DB name/user
    `propia` → `ftse`, the import User-Agent in `src/lib/safe-fetch.ts`.

**Exit criteria:**
- `npm run typecheck` passes (it will not fully pass until Phase 2 also
  lands — acceptable if the *only* remaining errors are in files Phase 2
  owns per §5.2 below; note exactly which files/errors remain in the §9
  build log so Phase 2 starts there).
- `docker compose up -d && npm run db:migrate` applies clean against a
  fresh local MySQL with zero errors.
- `npm run db:status` reports no drift against the new `schema.ts`.
- `npm run seed:locations && npm run seed:costs` both run successfully
  against the local DB and produce the expected row counts (10 municipios
  + the Marbella/Palma zonas, 7 acquisition_costs rows).
- `npm run cron:fx --dry` (or equivalent manual invocation) either writes a
  real `fx_rates` row from the live ECB feed or fails gracefully with a
  clear message if network access is unavailable in this environment —
  either outcome is fine, a silent crash is not.

### Phase 2 — Core logic: query layer, import, auth, leads, verify (`prompts/opus-2-core-logic.md`)

Full scope: design doc §3.1 (import consequence of catastral), §3.2 (publish
gate placement), §3.7 (leads/users/otp), and the design doc's own scattered
notes on `facet-sql.ts`, `verify:*` fixtures.

Concretely:

1. `src/lib/facet-sql.ts`: `facetConds()`/`verticalConds()`/
   `publishedFacetWhere()` filter on `price_eur`; SEK filter bounds (when a
   visitor filters in kr) convert to EUR **in the caller**, before
   `facetConds()` — never in the WHERE. Comment updated, not deleted, per
   the design doc's explicit instruction.
2. Import pipeline (`src/lib/import/`): when `referencia_catastral` is
   present on an incoming row, dedup on it exactly (via `uq_catastral`) and
   skip the fuzzy path; when absent, fall back to the existing
   `dedupKey()`/bucketed-phone logic completely unchanged, including its
   `null`-means-do-not-merge rule. `planImport`/`commitImport` stay one
   shared planner — do not add a second validation path for the catastral
   case.
3. Publish gate: a listing cannot move to `status: "published"` with
   `energy_rating` NULL, enforced in the server action (alongside
   `commitImportAction`'s existing permission check), not just in the
   wizard form — the importer is the other write path and must be gated
   too.
4. `leads`, `users`, `otp_codes`: apply the schema's already-decided
   email-first flip in every consumer — the lead form, the OTP send/verify
   flow (channel becomes `email` by default, `sendOtp` sends email not
   WhatsApp, still never logs a line pretending delivery happened when it
   didn't), `agencies.kind === "relocation"` labeled distinctly wherever an
   agency name renders (seller card, agent directory) — "represents the
   buyer, not the seller" per the design doc's §3.3 note. Do not build the
   agency directory /admin UI itself here — that is Phase 4; this phase is
   the data/logic layer those pages will call.
5. `users.identity_doc_type`/`identity_ref_last4`/`identity_verified_at`:
   wire the column into whatever create/update user path exists, operator-
   settable only, never populated by self-report from the wizard.
6. Update `scripts/verify-import.ts`, `verify-facets.ts`, `verify-i18n.ts`,
   `verify-seo.ts`, `verify-scopes.ts` fixtures for the new schema, new
   vocabulary, and single-dictionary i18n shape. Keep every script's
   purpose exactly as `CLAUDE.md` (pre-rewrite, still readable in this
   phase for the *mechanism*, not the facts) describes it — pure vs.
   DB-requiring split unchanged.

**Exit criteria:**
- `npm run typecheck` fully passes, zero errors, repo-wide.
- `npm run verify:import`, `verify:facets`, `verify:i18n`, `verify:seo` all
  green.
- `DATABASE_URL=<local> npm run verify:import` (the DB-backed exercise:
  plan → commit → re-run → rollback) passes, including one fixture row that
  dedups via `referencia_catastral` and one that dedups via the phone-
  bucket fallback.
- `npm run verify:scopes` passes against the local DB, including a
  `relocation`-kind agency scoped identically to an `inmobiliaria`-kind one.
- `npm run build` succeeds.

## 6. Sonnet phases

**Hard limits repeated for every phase below (§4.7):** no schema changes, no
auth/session logic changes, no import-planner algorithm changes, no facet/
URL vocabulary changes. Read from the query layer only.

### Phase 3 — Public-facing pages (`prompts/sonnet-1-public-pages.md`)

Home, category/hub pages, `SearchBar`, `CategoryFilterBar`, `ListingCard`,
`/bostad/[slug]` detail page, the publish wizard. Every visible string comes
from `sv.ts` (no new inline literals — same rule `CLAUDE.md` states for
propia.node, carried forward). Listing card and detail page show:
`formatEur` price, `formatSek`/`formatRateNote` when the rate is fresh,
energy rating badge, legal_status / charges_status as separate "seller
says" vs "we verified" lines, IBI/comunidad monthly costs when present,
acquisition-cost estimate block on the detail page (via
`src/lib/acquisition-cost.ts`), `atico` as its own type tier not a flag,
`built_m2` as the only faceted/compared area figure with `usable_m2`
display-only nearby. Wizard: energy_rating field with the `en_tramite`/
`exento` options, referencia catastral input, legal_status/charges_status
selects with `desconocido` as the honest default, no field asking a private
seller to self-certify `nota_simple_seen_at` (operator-only, not on the
form at all).

**Exit:** every public route builds and renders without runtime error
against seeded local data (`npm run seed:locations && npm run seed:costs`,
plus a handful of manually inserted test listings covering each
`propertyType`/`operation` and at least one `en_tramite` and one
`legal_status: "sin_lpo"` row to prove the UI doesn't hide the landmine
case); `verify:i18n` and `verify:facets` still green; `npm run build`
green.

### Phase 4 — Admin & agency panels (`prompts/sonnet-2-admin-agencia.md`)

`/admin`: energy/legal/charges fields editable, `nota_simple_seen_at`
settable only here, FX rate display + manual override
(`revalidateFx()`), acquisition_costs table view + manual override
(`revalidateAcquisitionCosts()`), identity verification action for
`users.identity_*`, CSV import template updated for the new column set.
`/agencia`: `kind` selector at agency creation/edit (`inmobiliaria` /
`relocation` / `developer`), relocation agencies' listings and leads shown
distinctly. `/publicar` (FSBO): unchanged funnel shape, new field set from
Phase 3's wizard work if not already wired there.

**Exit:** an admin can flip `nota_simple_seen_at`, override the FX rate,
and see the change reflected on a public page within the cache TTL (or
immediately via the in-process `revalidate*()` call); a relocation-kind
agency's listing renders the "represents the buyer" label on its public
seller card; `npm run build` green.

### Phase 5 — SEO, content & docs rewrite (`prompts/sonnet-3-seo-content-docs.md`)

Sitemap and structured data (`RealEstateListing`/`Offer` with EUR pricing,
`BreadcrumbList`, `FAQPage`) updated for the new URL vocabulary and single
vertical; `verify:seo` fixtures reflect a one-door site (should be
trivially satisfied per the design doc, confirm rather than fight it).
Seed guide content for the Phase 1 locations tree (`guide_content_sv`) —
short, factual, grounded only in DB data (medians/counts once they exist,
otherwise landmark/region facts), matching the "no invented facts" rule
carried from propia.node.

**Also this phase: rewrite `CLAUDE.md`, `ARCHITECTURE.md`, `README.md`, and
the upper-case `PLAN.md`** (the project's own living tracker, distinct from
this file) to describe flyttatillspanien.se as it now exists — not
propia.node. Use `docs/SPAIN-PORTAL-DESIGN.md` as the source of truth for
what changed; do not leave any Paraguay-specific fact (Gs, WhatsApp OTP,
`inmobiliaria.com.py`, Che Róga Porã, etc.) stated as current reality
anywhere in those four files. Add the mortgage-calculator backlog item and
the `D-mortgage` PLAN.md decision exactly as specified in the design doc's
§4 "Where to flag it".

**Exit:** `verify:seo` green; the four docs read as a self-consistent
description of flyttatillspanien.se with no leftover propia.node facts
(grep for `propia`, `Paraguay`, `Gs`, `.com.py`, `WhatsApp OTP` outside of
this file, `docs/SPAIN-PORTAL-DESIGN.md`, and the acknowledged cosmetic-only
backend strings from Phase 1's rename table — anything else found is a
docs bug, fix it); `npm run build` green.

### Phase 6 — Deploy (`prompts/sonnet-4-deploy.md`)

Hostinger Node.js app + MySQL setup for flyttatillspanien.se, following the
`nextjs-deploy-hostinger` skill's playbook. Production `.env` from
`.env.example` (flag `CONTACT_EMAIL`, `ANTHROPIC_API_KEY`, `R2_*` as
founder-provided — do not block on them, document exactly what's missing).
Run `db:migrate` against production, then `db:status` to confirm zero
drift, then `seed:locations` + `seed:costs` against production. Register
the cron jobs (`cron:fx`, `cron:geo`, `cron:medians`, `cron:resync`,
`cron:sessions`, `cron:translate` if `ANTHROPIC_API_KEY` is set) in
hPanel's Cron Jobs UI — this is a manual hPanel step the session documents
precisely (exact command lines) since it cannot click through hPanel
itself. Point the `flyttatillspanien.se` domain at the app. Smoke-test:
home page loads, one category page loads, `/api/health` and
`/api/health/db` both green.

**Exit:** production build succeeds on Hostinger, `db:status` shows zero
drift, home page and one category page return 200 over the real domain
(or over the Hostinger-assigned interim hostname if DNS propagation is
still pending — note which), final closing report to Anton with the live
URL(s), the exact manual hPanel steps still needed (cron jobs, DNS if not
yet propagated, R2 bucket creation, `CONTACT_EMAIL` mailbox), and a
numbered launch checklist.

## 7. Human-inputs checklist

| Item | Needed by | Notes |
| --- | --- | --- |
| Hostinger account + Node.js-capable plan | Phase 6 | Confirm before Phase 6 starts; if missing, Phase 6 stops and reports rather than guessing an upgrade |
| `flyttatillspanien.se` domain DNS access | Phase 6 | To point at the Hostinger app |
| Production `DATABASE_URL` (Hostinger MySQL) | Phase 6 | Username ≠ database name — same Hostinger footgun `CLAUDE.md` records for propia.node; verify both independently |
| `CONTACT_EMAIL` real mailbox | Phase 6 (launch blocker per design doc §3.7) | Site works without it (null-safe), but is not launch-credible without it |
| `ANTHROPIC_API_KEY` | Phase 1 (script exists, degrades gracefully without it), real use starts once real listings exist | `cron:translate` refuses to run and writes nothing without it |
| Cloudflare R2 account + bucket | Not this build | Inherited backlog item; code path already exists upstream in the propia.node pattern, do not rebuild it |
| ECB FX feed reachability from the Hostinger box | Phase 6, ongoing via `cron:fx` | No key needed, but confirm outbound HTTPS isn't blocked |

## 8. Open business questions (parked, not build work)

- **English-door domain** — when to buy it and flip `verticals.ts` to a
  second entry. Not before the domain is owned (propia.com.py lesson).
- **D-mortgage** — lender partnership before a Spanish mortgage calculator
  ships. Recorded as its own decision in the rewritten `PLAN.md` (Phase 5).
- **`alquiler_vacacional` at MVP** — the design doc includes it in the
  operation enum and gates `tourist_licence` on it being live; confirm with
  Anton before Phase 3 whether holiday-let listings actually launch at MVP
  or the enum member ships unused for now (either is fine mechanically —
  this only affects whether Phase 3 builds the tourist_licence field into
  the wizard/detail page).
- **`registry_number` UI** — v1.1 per the design doc's MVP/Wait table; no
  consumer needed at MVP, column only.
- **Full NIE/DNI capture** — founder decision + DPA, explicitly out of
  scope for all six phases.
- **Reviews/ratings** — inherited backlog item, still needs a founder
  decision, not touched by this plan.

## 9. Build log & handoff

_Empty at plan creation. Each phase appends an entry here before its PR
merges — phase id, PR link, 5–10 lines: what now exists, decisions/
deviations, where the next phase should look first._

## 10. Backlog

Anything a phase session finds that is real but out of its scope goes here
(or in `KNOWN-ISSUES.md` for defects — this section is for deferred
*scope*, not bugs):

- Second vertical / English door (see §8).
- `price_sek` column, cached acquisition-cost column — never, per design
  doc, not just "later".
- XML feed ingestion (Idealista/Fotocasa/Kyero) — v1.1, same planner.
- R2 image pipeline activation.
- Reviews/ratings.
- Spanish mortgage calculator.
- `basura_annual_eur`, `registry_number` UI — v1.1 per design doc §3.8.
- Nota simple / escritura document storage — needs R2 + a retention policy.
