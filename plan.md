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
| 5 | Sonnet | `prompts/sonnet-3-seo-content-docs.md` | §6.3 | Sitemap, structured data, guide content seeding, the editorial Swedish pass over `sv.ts` (Phase 1 ships draft-grade), and the CLAUDE.md/ARCHITECTURE.md/README.md/PLAN.md rewrite the design doc requires |
| 6 | Sonnet | `prompts/sonnet-4-deploy.md` | §6.4 | Hostinger app + MySQL setup, env vars, domain, cron jobs, production migration, smoke test |

Phases 1–2 are Opus because a wrong call in schema shape, the catastral
unique-index-over-nullable behaviour, the EUR-only price column, or the
publish gate placement forces a rewrite of everything built on top. Phases
3–6 are Sonnet: templated UI work, content, and infra wiring against a
foundation that is already decided and must not change.

> **Starting the chain (for Anton):** open a fresh window, model **Opus**,
> permission mode set to auto-accept edits/commands (spawned child sessions
> can never be MORE permissive than their parent — a restrictive Phase 1
> session strands every later phase at permission prompts), and paste:
> `Read prompts/opus-1-schema-config.md in this repo and execute it.`
> Each finished phase spawns the next in its own fresh window via
> `create_session`; no further human input is needed until Phase 6's
> closing report (§7 lists what Phase 6 will ask for).

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
- **`alquiler_vacacional` ships at MVP** (resolved at plan review,
  2026-08-28): the enum member is live, and the `tourist_licence` field is
  built into the wizard and the detail page in Phase 3 — the design doc's
  "only if alquiler_vacacional ships" condition is met. Phase 3 does NOT
  need to ask about this.
- **OTP + transactional email go out over SMTP** (resolved at plan review,
  2026-08-28 — the design doc flipped auth to email-first but never named a
  transport; the inherited `crm.ts` only knows the WhatsApp webhook). MVP
  transport: **nodemailer over SMTP against a Hostinger mailbox** (same
  account the site deploys to; the `CONTACT_EMAIL` mailbox in §7 can be the
  same one). Env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
  `EMAIL_FROM` — all documented in `.env.example` in Phase 2, all optional
  in dev (console fallback, exactly like the current `DevNullCrm`), and the
  `sendOtp` rule carries over verbatim: **never log or return a line that
  claims delivery happened when it did not**. Swapping to a transactional
  provider (Resend/Postmark) later is a config/adapter change, not
  architecture — keep the transport behind the existing `crm.ts`-style
  interface so the swap stays that way.

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
   **One sanctioned exception:** Phase 1 — and ONLY Phase 1 — pushes with
   `git push --no-verify`. The `.githooks/pre-push` gate runs typecheck +
   build + all four verify scripts, and Phase 1's cut deliberately leaves
   typecheck errors in Phase-2-owned files and stale verify fixtures
   (Phase 2 updates them). `main` is therefore knowingly red between the
   Phase 1 and Phase 2 merges; that is harmless because Hostinger is not
   wired up until Phase 6 — nothing deploys a red `main`. Phase 2's exit
   criteria (full typecheck, all verifies green) restore the gate, and
   **no phase after 1 ever pushes with `--no-verify`**.
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
11. **Recovery from a dead session** (usage ran out mid-phase, container
    died, window closed): open a fresh window with that phase's model per
    the phase table, and paste exactly
    `Read prompts/<phase-file>.md in this repo and execute it.`
    The prompt is re-runnable (§4.6) and continues from the first unmet
    exit criterion. Find the current phase by reading §9's build log plus
    the open PRs / `phase/*` branches — the newest phase without a §9
    entry or a merged PR is the one to re-run. Nothing about a phase lives
    only in a session's memory; if it did, that was a §4.10 violation, and
    the re-run re-derives it from the branch state.

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
8. `src/i18n/`: the **structural** rename — `es.ts` → `sv.ts`, all
   namespaces `es*` → `sv*`, delete `en.ts`, update `index.ts`/`server.ts`
   so `Dictionary`, `dict()`, `getDictionary()` all point at the single
   dictionary; keep the `Widen<>` machinery even with one locale, since
   it's what makes `en.ts` a file-addition later rather than a refactor.
   Strings become **working-draft Swedish**: correct language, correct
   intent, no Spanish left behind, no empty strings — but this phase does
   NOT owe the final editorial voice. `es.ts` is ~1,100 lines; the
   full editorial pass is deliberately **Phase 5's scope** (the content
   phase), so Phase 1 stays inside one session. Note in the §9 build-log
   entry that the dictionary is draft-grade pending Phase 5.
9. Scripts: delete `seed-financing.ts`/`seed:financing`,
   `recompute-cuotas.ts`/`cron:cuotas`; add `scripts/seed-acquisition-costs.ts`
   (`seed:costs`, idempotent upsert by region, 7 comunidades, rates marked
   PLACEHOLDER) and `scripts/fetch-fx.ts` (`cron:fx`, ECB daily XML →
   `fx_rates`, writes nothing on fetch failure); rewrite
   `scripts/seed-locations.ts`'s `TREE` for the Spain hierarchy in the
   design doc's "Seeded regions" table, setting `acquisition_region` on
   every node and starting `joinSlug` at municipio; invert
   `scripts/translate-listings.ts` to es→sv semantics (same cron-only, no
   publish-hook rule); update `scripts/compute-medians.ts` to `price_eur`
   and `built_m2` — **the design doc's script table marks `cron:medians`
   "unchanged", and on this one point it is wrong**: the script reads
   `price_usd`/`area_m2`, both of which this phase deletes, and `built_m2`
   is the only comparable area figure per design §3.1. This is a semantic
   fix (wrong column = wrong number on every category page), not just a
   compile fix.
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
  fresh local MySQL with zero errors. (After this phase's docker-compose
  rename the local `DATABASE_URL` is `mysql://ftse:ftse@127.0.0.1:3306/ftse`
  — the `propia:propia@…/propia` string the inherited `CLAUDE.md` documents
  is stale the moment the rename lands; don't trip over your own rename.)
- `npm run db:status` reports no drift against the new `schema.ts`.
- `npm run seed:locations && npm run seed:costs` both run successfully
  against the local DB and produce the expected row counts: **41
  municipios** and **10 zonas** (6 under Marbella, 4 under Palma) per the
  design doc's "Seeded regions" table (count the table, don't trust this
  sentence if they disagree), plus the comunidad/provincia parent nodes,
  and **7** `acquisition_costs` rows.
- `npm run cron:fx --dry` (or equivalent manual invocation) either writes a
  real `fx_rates` row from the live ECB feed or fails gracefully with a
  clear message if network access is unavailable in this environment —
  either outcome is fine, a silent crash is not.
- Pushed with `git push --no-verify` per the §4.2 exception — the ONLY
  phase allowed to.

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
   The email transport is **decided in §1**: nodemailer over SMTP
   (`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`EMAIL_FROM`, all in
   `.env.example`), behind the existing `crm.ts`-style interface, with the
   dev-console fallback preserved and the never-fake-delivery rule intact.
   While in `crm.ts`/`otp.ts`/`auth/password.ts`, also update their prose
   comments — they narrate "WhatsApp OTP" as current fact, and Phase 5's
   leftover-Paraguay grep only covers the four doc files, so a stale code
   comment here survives as false documentation if this phase doesn't fix
   it.
5. `users.identity_doc_type`/`identity_ref_last4`/`identity_verified_at`:
   wire the column into whatever create/update user path exists, operator-
   settable only, never populated by self-report from the wizard.
6. Update `scripts/verify-import.ts`, `verify-facets.ts`, `verify-i18n.ts`,
   `verify-seo.ts`, `verify-scopes.ts` fixtures for the new schema, new
   vocabulary, and single-dictionary i18n shape. Keep every script's
   purpose exactly as `CLAUDE.md` (pre-rewrite, still readable in this
   phase for the *mechanism*, not the facts) describes it — pure vs.
   DB-requiring split unchanged.
7. **Mechanical compile-fixes across pages and components are IN scope for
   this phase** — rename-level only: `formatPrice` → `formatEur`, deleted
   columns/fields (`cuota_gs`, `price_usd`, `area_m2`, `whatsapp` →
   `phone`/`email`), deleted helpers, the dead `/financiamiento` surfaces
   if Phase 1 left any reference standing. This is what makes this phase's
   "repo-wide typecheck, zero errors" exit criterion reachable at all —
   without it the page files still reference the old schema. The line:
   make every file **compile and be truthful**, but do NOT redesign,
   restyle, or restructure any page — UI substance is Phase 3, and a
   too-eager rewrite here just gives Phase 3 merge conflicts with itself.
   This phase restores the pre-push gate: it pushes green, never
   `--no-verify`.

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
selects with `desconocido` as the honest default, `tourist_licence` input
shown for `alquiler_vacacional` (per the §1 decision — holiday lets ship
at MVP, and the licence renders on the detail page too), no field asking a
private seller to self-certify `nota_simple_seen_at` (operator-only, not
on the form at all).

Also this phase: **`/for-maklare`** — the Swedish "annonsera hos oss"
agency-acquisition page the design doc's §1 gives as the reason a `.es`
door is unnecessary. Strings through `sv.ts` like every other page. (Its
Spanish-language sibling `/es/inmobiliarias` is §10 backlog, not this
phase — it lives outside the dictionary system by design.)

Test data is a **committed script**, not manual inserts:
`scripts/seed-dev-listings.ts` (`npm run seed:dev`) inserting one
published listing per `propertyType`/`operation` combination that has a
card to render, including at least one `energy_rating: "en_tramite"` row
and one `legal_status: "sin_lpo"` row (the landmine cases), at least one
`alquiler_vacacional` row with a `tourist_licence`, and one listing owned
by each lister type. Committed so this phase is re-runnable and Phases 4
and 6 can reuse it for their own verification.

**Exit (mechanical, not "looks right"):** `npm run seed:locations &&
npm run seed:costs && npm run seed:dev` clean against local MySQL; then
`npm run build && npm run start` and curl this route list — home, one
operation hub, one category page (`/{affar}/{typ}/{ort}`), one
`/bostad/[slug]` for a landmine-case listing, `/for-maklare`, the wizard
entry — **all returning 200 with no runtime error in the server log**;
`verify:i18n` and `verify:facets` still green.

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

**Exit (mechanical):** create a local admin with the existing
`scripts/create-user.ts` (it survives Phase 1 with the email-first column
rename); against `npm run start` + the Phase 3 seed data
(`npm run seed:dev`), exercise the `nota_simple_seen_at` flip and the FX
override — via authenticated HTTP or by invoking the server action
directly in a script — then curl the affected public page and confirm the
change is visible immediately (the in-process `revalidate*()` path, not
the TTL); a relocation-kind agency's listing renders the "represents the
buyer" label on its public seller card (curl and grep the rendered HTML);
`npm run build` green.

### Phase 5 — SEO, content & docs rewrite (`prompts/sonnet-3-seo-content-docs.md`)

Sitemap and structured data (`RealEstateListing`/`Offer` with EUR pricing,
`BreadcrumbList`, `FAQPage`) updated for the new URL vocabulary and single
vertical; `verify:seo` fixtures reflect a one-door site (should be
trivially satisfied per the design doc, confirm rather than fight it).
Seed guide content for the Phase 1 locations tree (`guide_content_sv`) —
short, factual, grounded only in DB data (medians/counts once they exist,
otherwise landmark/region facts), matching the "no invented facts" rule
carried from propia.node.

**Also this phase: the editorial Swedish pass over the whole `sv.ts`
dictionary.** Phase 1 delivered working-draft Swedish (correct meaning, no
Spanish left, but not final voice — its §9 build-log entry says so). This
phase reads every namespace end to end and rewrites for the site's
editorial voice: plain, concrete, trust-building Swedish for a person
making a six-figure purchase in a country whose rules they don't know —
translate intent, never invent a fact the source copy doesn't state, keep
brand-parameterised functions parameterised. This is real scope on par
with the docs rewrite below, not a skim.

**Also this phase: rewrite `CLAUDE.md`, `ARCHITECTURE.md`, `README.md`, and
the upper-case `PLAN.md`** (the project's own living tracker, distinct from
this file) to describe flyttatillspanien.se as it now exists — not
propia.node. Use `docs/SPAIN-PORTAL-DESIGN.md` as the source of truth for
what changed; do not leave any Paraguay-specific fact (Gs, WhatsApp OTP,
`inmobiliaria.com.py`, Che Róga Porã, etc.) stated as current reality
anywhere in those four files. Add the mortgage-calculator backlog item and
the `D-mortgage` PLAN.md decision exactly as specified in the design doc's
§4 "Where to flag it".

**Exit:** `verify:seo` green; `verify:i18n` green with **no draft-grade
strings left** (every namespace read and finalized — if Phase 1's build
log flagged specific namespaces as rough, those are the first stop); the
four docs read as a self-consistent
description of flyttatillspanien.se with no leftover propia.node facts
(grep for `propia`, `Paraguay`, `Gs`, `.com.py`, `WhatsApp OTP` outside of
this file, `docs/SPAIN-PORTAL-DESIGN.md`, and the acknowledged cosmetic-only
backend strings from Phase 1's rename table — anything else found is a
docs bug, fix it); `npm run build` green.

### Phase 6 — Deploy (`prompts/sonnet-4-deploy.md`)

Hostinger Node.js app + MySQL setup for flyttatillspanien.se, following the
`nextjs-deploy-hostinger` skill's playbook. Production `.env` from
`.env.example` (flag `CONTACT_EMAIL`, `SMTP_*`/`EMAIL_FROM` (the §1 email
transport — without these, production OTP login and lead mail silently
don't send, so list them as **launch blockers**, not nice-to-haves),
`ANTHROPIC_API_KEY`, `R2_*` as
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
| SMTP credentials (`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`EMAIL_FROM`) | Phase 6 (**launch blocker**: no OTP login, no lead mail without them); Phase 2 codes against them with a dev-console fallback | §1 decision: a Hostinger mailbox on the same account — can be the `CONTACT_EMAIL` mailbox. Create it in hPanel → Emails |
| GitHub: sessions can merge their own PRs in this repo | Every phase | Already true today (this plan merged the same way); listed so the checklist is complete |
| `ANTHROPIC_API_KEY` | Phase 1 (script exists, degrades gracefully without it), real use starts once real listings exist | `cron:translate` refuses to run and writes nothing without it |
| Cloudflare R2 account + bucket | Not this build | Inherited backlog item; code path already exists upstream in the propia.node pattern, do not rebuild it |
| ECB FX feed reachability from the Hostinger box | Phase 6, ongoing via `cron:fx` | No key needed, but confirm outbound HTTPS isn't blocked |

## 8. Open business questions (parked, not build work)

- **English-door domain** — when to buy it and flip `verticals.ts` to a
  second entry. Not before the domain is owned (propia.com.py lesson).
- **D-mortgage** — lender partnership before a Spanish mortgage calculator
  ships. Recorded as its own decision in the rewritten `PLAN.md` (Phase 5).
- ~~`alquiler_vacacional` at MVP~~ — **resolved**, see §1: ships at MVP,
  `tourist_licence` built in Phase 3. Kept here struck-through so a session
  that remembers the old open question finds the answer, not a gap.
- **Email provider swap** — §1 decides SMTP-on-Hostinger for MVP; whether
  to move to a transactional provider (Resend/Postmark) for deliverability
  once real volume exists is a founder call later. The transport sits
  behind an interface so the swap is config-level.
- **GDPR/privacy-policy legal review** — Phase 1/5 translate the inherited
  privacy copy to Swedish and Phase 5 de-Paraguayifies it, but whether the
  text is *adequate* for a Swedish consumer site under GDPR (lawful basis
  for the identity-verification fields, retention wording) is a review by
  Anton or a lawyer, not a build task.
- **`registry_number` UI** — v1.1 per the design doc's MVP/Wait table; no
  consumer needed at MVP, column only.
- **Full NIE/DNI capture** — founder decision + DPA, explicitly out of
  scope for all six phases.
- **Reviews/ratings** — inherited backlog item, still needs a founder
  decision, not touched by this plan.

## 9. Build log & handoff

_Each phase appends an entry here before its PR merges — phase id, PR link,
5–10 lines: what now exists, decisions/deviations, where the next phase
should look first._

### Phase 1 — schema, config & core libs (2026-08-28)

Branch `claude/opus-1-schema-config-xb1i3y` (the session's assigned branch;
`phase/1` in §4.2 is the naming intent, the branch name is not load-bearing).

**What now exists.** `src/db/schema.ts` is the Spain schema — EUR-only
`price_eur`, `built_m2`/`usable_m2`/`plot_m2`, the full legal block
(`referencia_catastral` + `uq_catastral`, energy quad, `legal_status`,
`charges_status` + `nota_simple_seen_at`, IBI/comunidad, `is_vpo`,
`land_classification`, `tourist_licence`), `source_lang`/`title_sv`/
`description_sv`/`translation_hash_sv`, `agencies.kind`, email-first
`users`/`leads`/`otp_codes`, five-level `locations` with
`acquisition_region`, new `fx_rates` + `acquisition_costs`, no
`financing_programs`. **The 12 inherited Paraguay migrations were deleted and
regenerated as one `drizzle/0000_spain_schema.sql`** — a clean start, per the
phase prompt. Also: single-entry `verticals.ts`; Swedish `FACET_PARAM` and
`/bostad` + `kopa|hyra|korttidshyra` in `facets.ts`/`urls.ts`; `format.ts`
(`formatEur`/`formatSek`/`formatRateNote`/`isFxFresh`); `amortization.ts`
(only `frenchAmortization`, unused) and the new pure `acquisition-cost.ts`;
`fx`/`acquisitionCosts` cache tags + TTLs + `revalidate*()`; `es.ts` → `sv.ts`
with `en.ts` deleted; `seed:costs` and `cron:fx` added, `seed:financing` and
`cron:cuotas` gone, `seed-locations` rewritten for Spain, `cron:translate`
inverted to es→sv, `compute-medians` moved to `price_eur`/`built_m2`.

**Verified against a local MySQL 8.4.** `db:migrate` applies clean;
`db:status` reports 0 pending, **no drift**, 20 tables / 243 columns;
`seed:locations` writes **69 rows — 1 pais, 7 comunidades, 10 provincias, 41
municipios, 10 zonas** (6 Marbella, 4 Palma), every municipio carrying an
`acquisition_region`; `seed:costs` writes **7** rows; both are idempotent
(re-run leaves 69/7). `cron:fx` **fails gracefully** — the ECB feed is 403 through
this environment's egress proxy, so it printed `wrote nothing, the previous
rate stands` and exited 1, which is the sanctioned outcome; the parser and the
`fx_rates` upsert were exercised separately and both work.

**Decisions and deviations.**
1. `scripts/check-migrations.ts` had a latent bug that made `db:status` unusable
   on MySQL 8.x: `information_schema` column names come back UPPER regardless of
   query case, so `r.table_schema` was `undefined` and the tracking query ran
   against a database literally named `undefined`. Aliased all three queries.
   Not in the plan; fixed because `db:status` is an exit criterion.
2. In scope beyond §5.1's list, because nothing else would have caught them:
   `src/lib/brand.ts` (`BRAND_KICKER`, tagline), `src/lib/property-types.ts`
   and `src/lib/photos.ts` (both keyed by the changed enum),
   `src/config/faq.ts`, `site-nav.ts`, `popular-searches.ts` — the nav hrefs
   were hand-typed Paraguayan category paths that would have shipped as a menu
   of 404s without a single type error. Category hrefs now go through
   `categoryUrl()`/`operationSlug()`.
3. `agencyUrl()`/`agentUrl()` deliberately still emit `/inmobiliaria/{slug}` and
   `/agente/{slug}` — moving them means moving route directories, which is
   Phase 3's. See `KNOWN-ISSUES.md`.
4. **`sv.ts` is working-draft Swedish**, as the plan intends: correct language
   and intent, no Spanish left, no empty strings, but not final voice. Phase 5
   owns the editorial pass; `KNOWN-ISSUES.md` names the roughest namespaces in
   priority order (`svPanel`, `svHome`, `svPrecios`, `svTasacion`) and the two
   that are already close to final (`svListing`'s legal block, `svPublish`'s
   legal step).
5. Every `acquisition_costs` rate is a PLACEHOLDER with `source_url` NULL, in
   the same voice `seed-financing.ts` used. Founder research task.

**Where Phase 2 starts.** `npx tsc --noEmit` (root + `scripts/`) leaves **626
error lines across 83 files, all Phase-2 or Phase-3 owned, none in a file this
phase owns.** They cluster in exactly four places:
(a) the query/write layer on deleted columns — `queries.ts`, `panel-queries.ts`,
`publish-queries.ts`, `listing-edit.ts`, `directory-queries.ts`,
`map-queries.ts`, `precios-queries.ts`, `profile-queries.ts`,
`stats/team-queries`, `valuation.ts`, `jsonld.ts`, `sitemap.ts`,
`facet-sql.ts` (`price_usd` → `price_eur`, `foreign_exposure` gone,
`whatsapp` → `phone`/`email`, `area_m2` → `built_m2`, `USD_TO_PYG`);
(b) the import pipeline — `import/{upsert,normalize,from-url,claim-import,csv,intake,resync}.ts`
(the `RawListing` shape now carries `priceEur` and the catastral/legal fields);
(c) auth/leads — `otp.ts`, `registration.ts`, `app/api/leads/route.ts`
(`destination`/`channel`, `users.email` NOT NULL);
(d) **every `@/i18n/es` import and every `es*` namespace identifier** across
`app/**` and `src/components/**` — a mechanical `es` → `sv` rename, plus the
handful of keys whose Paraguayan concept disappeared (`publishWaPrefill`,
`investFinancingCta`, `ctaWhatsapp`, `financing*`, `detailArea`/`detailLand`,
`ctaBarWhatsapp`, `foreignExposureLabel`) and the ones that replaced them
(`publishEmailPrefill`, `investCostsCta`, `ctaEmail`, `acquisition*`,
`detailBuilt`/`detailUsable`/`detailPlot`, `ctaBarContact`).
The five `verify:*` scripts still carry Paraguayan fixtures and are Phase 2's
per §5.2.6. Deleted modules that Phase 2 still has live imports of:
`src/lib/cuota.ts` (`bestCuota`, `FinancingProgram`) in `PublishWizard.tsx` and
`publish-queries.ts`, and `financingPrograms` / `listFinancingPrograms` in
`directory-queries.ts` and `publish-queries.ts`. `app/financiamiento/` is
deleted; `/financiamiento` links outside `site-nav.ts` (already cleaned) are
Phase 2's to sweep. Local DB string is now
`mysql://ftse:ftse@127.0.0.1:3306/ftse`.

**The trap for Phases 2–3: typecheck does not see content.** These files carry
Paraguayan or Spanish copy, or Paraguayan URLs, and compile perfectly — they
will ship silently if someone treats a green `tsc` as done. Phase 1 already
cleared the config half of this class (`faq.ts`, `site-nav.ts`,
`popular-searches.ts`); the rest are pages and components, so they belong to
Phase 3 (and Phase 5's editorial pass), not to Phase 2:
`app/{nosotros,contacto,terminos,privacidad,planes,para-inmobiliarias,como-funciona,datos,preguntas-frecuentes,guias,guias/[slug],agentes,inmobiliarias,proyectos,desarrolladoras}/page.tsx`,
`app/api/mapa/route.ts`, and
`src/components/{SiteFooter,LeadForm,NewsletterSignup,panel/PostForm}.tsx`.
Phase 2 owns one of them by subject rather than by content: `src/lib/wa.ts`,
`crm.ts`, `otp.ts` and `auth/password.ts` narrate WhatsApp-first delivery as
current fact (§5.2.4 already calls this out).

### Phase 2 — core logic: query layer, import, auth, leads, verify (2026-08-29)

Branch `phase/2`.

**What now exists.** The whole read/write layer speaks the Spain schema:
`facet-sql` filters on `price_eur` (SEK never enters a WHERE — `verify:facets`
asserts the absence of a conversion, not just the presence of the column), the
five-level locations tree replaces ciudad/barrio everywhere, and cards carry
`title_sv`, `energy_rating`, `legal_status` and `is_vpo` so Phase 3 can render
a compliant advertisement without reaching back into the query layer. **Import:
`referencia_catastral` is an EXACT dedup key that skips the fuzzy path
entirely**, and `dedupKey()` is the unchanged fallback when a row carries none,
`null`-means-do-not-merge included; a row with a reference deliberately stores
NO fuzzy key beside it. **New `src/lib/publish-gate.ts`**: `energy_rating` is
required to reach `published`, enforced in the three writers that can make that
transition (`approveListing`, `updateListing`, `commitImport(publish:true)`),
never in a form. **Email-first** end to end: `crm.ts` gained a nodemailer SMTP
transport behind the same optional-by-construction interface, `otp_codes` is
keyed by destination+channel, and the wizard verifies the *account's own* inbox
rather than a client-supplied address. Also new: `src/lib/listing-copy.ts` (the
one home for `title_sv ?? title` and the machine-translation marker) and
`src/lib/reference-queries.ts`.

**Verified.** `npm run verify:local` green (typecheck, build, and the four pure
verifies); `verify:import` green against local MySQL with **both** dedup paths
covered by fixtures that can only pass through the path they name; `verify:scopes`
green — 50 assertions, including a `relocation`-kind agency scoped identically
to an `inmobiliaria` one; `db:status` reports no drift.

**Decisions and deviations.**
1. **`fx_rates` and `acquisition_costs` had a cache tag, a cron and no reader.**
   Nothing in the app read either table, so Phase 3's SEK line and
   acquisition-cost block and Phase 4's FX/cost overrides had no query layer to
   call — and §4.7 forbids the Sonnet phases from adding one. Added
   `src/lib/reference-queries.ts` with the readers *and* the two operator
   writers (`setManualFxRate`, `updateAcquisitionCost`). Smoke-tested end to
   end: a manual rate renders through `formatSek`, a region itemises through
   `acquisitionCost()`.
2. `verify:i18n` had to change shape, not purpose. Its arity check fell out of
   walking two dictionaries; with one, it calls every copy function with
   sentinel arguments and asserts that changing an argument changes the output.
   That is stronger than the pairwise walk — it also catches a function that
   drops an argument in *both* locales. Negative-tested before shipping.
3. `ListingOwner` (public FSBO seller card) exposes `phone` and
   `emailVerifiedAt` but deliberately NOT the owner's email: it is the account
   identity now, and rendering it publicly would publish a private person's
   inbox to every scraper. `/admin/leads` may select it — that surface is
   staff-only — and the buyer's route to an FSBO seller is the lead form.
4. `requestOtpAction` takes no destination. The address is the session's, so the
   endpoint cannot be turned into a relay that mails a six-digit code anywhere
   a script asks.
5. Draft and user writes only touch the legal / identity columns when the
   caller actually carried them (`undefined` = "this form did not ask", an
   explicit `null` still clears). Without that, an operator's energy rating or
   identity verification would be wiped by the next save from a form that has
   no such field — which is every form until Phases 3 and 4 add them.
6. The importer's CSV template example row was positional and the column set
   grew by eleven; the generated template misaligned. Keyed by column name now
   and round-tripped through `readIntake()` as part of this phase's audit.
7. `waPhone()` had a hardcoded `595`. It now reads a leading zero as Sweden's
   trunk prefix and a bare nine digits as Spain, and leaves anything already
   international alone — a relocation partner's +46 must not get 34 in front.

**Where Phase 3 starts.** `main` is green again, so the pre-push gate is back
and no phase after this one may use `--no-verify`. Everything Phase 3 needs is
in the query layer: `ListingCard` carries the compliance fields, `getFxRate()`
feeds `formatSek`/`formatRateNote`, `getAcquisitionRatesFor(region)` feeds
`acquisitionCost()` (the region is on every `locations` row as
`acquisition_region`), and `servedTitle`/`isMachineTranslated` in
`listing-copy.ts` are the `title_sv ?? title` rule. Two things are stubbed on
purpose and are Phase 3's first jobs: the listing detail page has a commented
slot where the Paraguayan financing box was, for the acquisition-cost block
(`svListing.acquisition*` is already written), and the publish wizard does not
yet collect the legal block (`DraftPayload` and `saveDraftAction` accept it —
adding the inputs is all that is missing). The route tree is still Spanish
(`/propiedad`, `/inmobiliaria`, `/agente`) and moving it is Phase 3's, per
`KNOWN-ISSUES.md`.

### Phase 3 — public-facing pages (2026-08-29)

Branch `phase/3`.

**What now exists.** The whole public browsing path is wired to the Spain
schema and shows the legal/compliance block: `ListingCard` renders an energy
badge (RD 390/2021 — required in any advertisement, so it's on the card, not
only the detail page), `formatSek` next to `formatEur`, and a VPO/landmine
caution line; `/bostad/[slug]` (moved from `/propiedad`) adds the full legal
block (legal_status as its own fact line, charges_status/nota_simple_seen_at
as the "seller says"/"we verified" pair design doc §3.2 requires), energy
detail, running costs (IBI/comunidad), tourist_licence, and the
acquisition-cost estimate (`src/lib/acquisition-cost.ts`, gated on
`operation === "venta"`) with its SEK line and `EUR/SEK rate · date`
disclosure. The publish wizard collects the same legal block
(`energy_rating`/`referencia_catastral`/`legal_status`/`charges_status`/
`tourist_licence`, client-validated but server-gated via the existing
`publish-gate.ts`) into the `DraftPayload` shape Phase 2 already accepted.
Home, the operation hubs and category pages are re-pointed at Spain
locations/URLs (`/kopa`, `/hyra`, `/korttidshyra`) — several were still
linking `/venta/asuncion`-shaped paths that compiled but 404'd. New
`/for-maklare` (design doc §1's one-page answer to "should agencies get a
`.es` door") and `scripts/seed-dev-listings.ts` (`npm run seed:dev`, 20
listings covering every operation × sensible property-type combination, both
landmine cases by name, one FSBO/one relocation-agency/one inmobiliaria-agency
listing, idempotent via `uq_catastral`).

**Route tree decision (KNOWN-ISSUES §1).** `/propiedad → /bostad` is done, the
one rename the design doc's handoff actually requires. `agencyUrl()`/
`agentUrl()` keep their Spanish segments — decided to leave `/inmobiliaria` and
`/agente` alone rather than move them: no SEO requirement forces it and moving
route directories for two profile pages that aren't the category tree adds
redirect risk for no design-doc benefit.

**Decisions and deviations.**
1. Content sweep: pages Phase 1's build log flagged as compiling but
   Paraguayan (`nosotros`, `contacto`, `terminos`, `privacidad`, `planes`,
   `para-inmobiliarias`, `como-funciona`, `datos`, `preguntas-frecuentes`,
   `guias`×2, `agentes`, `inmobiliarias`, `proyectos`, `desarrolladoras`,
   `SiteFooter`/`SiteHeader`/`MobileMenu`/`LeadForm`/`NewsletterSignup`/
   `panel/PostForm`) are rewritten to Swedish, corrected facts (no guaraníes,
   no WhatsApp-first buyer framing, `sv-SE` not `es-PY`, the deleted cuota
   engine replaced by the acquisition-cost pitch everywhere it was mentioned).
   Kept as plain inline literals rather than migrated into the `sv.ts`
   dictionary system — that migration is real additional scope the phase
   description doesn't ask for; Phase 5's editorial pass is the natural place
   to fold them in if it decides to.
2. Two more pages had the same "compiles, describes the wrong country" defect
   Phase 1 warned about but weren't on anyone's list: `app/proyecto/[slug]` and
   `app/desarrolladora/[slug]` (fully Spanish, `es-PY` dates, and — the
   substantive bug — `STAGE_LABEL`/`STATE_LABEL` maps keyed to the old
   Paraguay stage enum against the real `obra_nueva`/`sobre_plano`/
   `en_construccion` schema, which would have printed raw enum values on any
   real project). Fixed by reuse (`svListing.stateLabel`) plus a new
   `svProject`/`svDeveloper` namespace pair. `app/layout.tsx`'s sitewide
   default `openGraph.locale` was still `"es_PY"` — every page without its own
   OpenGraph block was emitting the wrong locale; now `"sv_SE"`.
3. `ListingCard` takes `fx: FxRate | null` as a required prop rather than
   fetching its own — `getFxRate()` is a cheap single-row cached read, but a
   grid renders up to 48 cards, and the codebase's own stated discipline
   (`attachCovers()`, the whole-table `acquisition_costs` cache) is "fetch
   once per page, not once per row." All six render sites (`page.tsx`, the
   hub, the category grid, the detail page, and the agency/agent profiles —
   the latter two weren't Phase 3's on anyone's list either, but render
   `ListingCard` and were still fully Spanish) now fetch `fx` once and thread
   it through.
4. `IBI`/`community_monthly_eur` are NOT in the publish wizard —
   `DraftPayload`/`saveDraft()`'s `DraftInput` never gained fields for them in
   Phase 2 (only the other five legal fields did), and extending that file is
   past a Sonnet phase's hard limits. Detail page still renders them when
   present (import/admin-set). Full explanation in `KNOWN-ISSUES.md`.
5. Zone-card images (`public/img/zona-{marbella,torrevieja,palma,javea}.webp`)
   are the four inherited Paraguay photos renamed, not real photography — a
   founder/content task, flagged rather than silently shipped as if real.
6. `npm run cron:fx` still 403s in this build environment (same ECB-blocked
   proxy Phase 1 found); verified the SEK/rate-note render path end-to-end by
   inserting a manual `fx_rates` row locally rather than depending on the live
   feed working here.

**Verified.** `npm run verify:local` green (typecheck, build, all four pure
verifies); `verify:import`, `verify:scopes` green against local MySQL;
`seed:locations && seed:costs && seed:dev` clean and idempotent (re-run: 0
inserted, 20 updated); `npm run build && npm run start` then curled home, the
`/kopa` hub, a category page, both landmine `/bostad/[slug]` rows, `/for-maklare`
and `/publicar` (307 → `/login?next=/publicar`, the correct gate) — all 200 or
the one correct redirect, no server-log errors.

**Where Phase 4 starts.** `/admin` and `/agencia` are still the inherited
Spanish panels (KNOWN-ISSUES, several open items) — that's Phase 4's whole
scope: energy/legal/charges editing, `nota_simple_seen_at` (operator-only,
still not on any form), FX/acquisition-cost manual override UI
(`setManualFxRate`/`updateAcquisitionCost` in `reference-queries.ts` already
exist and are unused), agency `kind` selector, and the relocation "represents
the buyer" label's own exit-criteria grep against a live seller card (the
detail page already renders it — see point 3 in Phase 2's notes plus this
phase's seller-card change). `IBI`/`community_monthly_eur` in the wizard
(point 4 above) is fair game for whichever phase touches `publish-queries.ts`
next.

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
- `/es/inmobiliarias` — the single Spanish-language agency-acquisition
  landing page (design doc §1), hand-written outside the dictionary
  system, `noindex` optional. The Swedish `/for-maklare` ships in Phase 3;
  this Spanish sibling waits until agency outreach actually starts.
- Transactional email provider (Resend/Postmark) swap — see §8.
