# flyttatillspanien.se — Spanish property for Swedish buyers

One Next.js engine, one served door. Read `ARCHITECTURE.md` before building
anything — it is the contract — and `CLAUDE.md` for the current state of the
world, which supersedes the contract wherever they disagree.

**Project history:** this repo began as a byte-for-byte copy of
`propia.node`, a Paraguay real-estate portal. A phased rebuild
(`plan.md`, `docs/SPAIN-PORTAL-DESIGN.md`) replaced its schema, currency,
locale, legal fields and lead-capture model with the Spain/Sweden shape
described below. Nothing Paraguayan remains as a live fact — see
`KNOWN-ISSUES.md` for the handful of cosmetic-only backend strings
(a cookie name, a couple of localStorage keys) left alone deliberately
because renaming them has zero visitor-facing effect.

## Stack

Next.js (App Router) · TypeScript · Drizzle ORM · MySQL 8 (Hostinger) ·
Cloudflare R2 (images, not yet activated) · MapLibre + OSM (maps) ·
Nodemailer/SMTP (email-first leads and OTP — no CRM product, no WhatsApp
buyer flow).

## Local development

```bash
cp .env.example .env          # fill in values
docker compose up -d          # local MySQL 8 on :3306 (db/user "ftse")
npm install
npm run db:generate           # generate SQL migrations from src/db/schema.ts
npm run db:migrate            # apply them
npm run db:status             # confirm zero drift against src/db/schema.ts
npm run seed:locations        # Spain locations tree: 7 comunidades → 41 municipios → 10 zonas
npm run seed:costs            # acquisition_costs — 7 comunidad rows (rates are PLACEHOLDER, see below)
npm run seed:dev              # one seed listing per property-type/operation combo, incl. both "landmine" legal cases
npm run seed:guides           # short factual area note per municipio (locations.guide_content_sv) — no page renders it yet
npm run dev                   # http://localhost:3000
npm run db:studio             # Drizzle Studio — interim admin UI
```

Local `DATABASE_URL` is `mysql://ftse:ftse@127.0.0.1:3306/ftse` (the
docker-compose service, database and user are all named `ftse` —
`propia`/`propia` is the old Paraguay-build name, not this one).

Cron-style jobs (idempotent; also run on a schedule in production):

```bash
npm run cron:fx               # fetch the ECB EUR/SEK daily reference rate into fx_rates
npm run cron:medians          # market_medians for the current month, over price_eur/built_m2
npm run cron:geo              # repair listings.display_lat/lng after a centroid moves
npm run cron:translate        # fill listings.title_sv/description_sv (needs ANTHROPIC_API_KEY; es → sv)
npm run cron:resync           # pause listings whose sources have gone quiet (--dry first)
npm run cron:sessions         # purge expired sessions
```

Import (CSV/XLSX → pending-review listings):

```bash
npm run import:csv -- data/sample-listings.csv whiteglove
```

Re-running the same file is safe: the normalize → dedup → upsert pipeline
(`src/lib/import/`) reports every unchanged row as `unchanged` and never
creates a duplicate. When a row carries `referencia_catastral`, dedup is
exact on it; otherwise the existing bucketed-phone fallback applies.

Other scripts worth knowing:

```bash
npm run user:create           # create a login directly (bootstrapping the first admin)
npm run backfill:images       # pull imported photos into R2 once R2_* is configured
npm run verify:import         # pure checks (no DB); add DATABASE_URL=<local> to also exercise plan → commit → rollback
npm run verify:facets         # facet parse/build identity + enum coverage (pure)
npm run verify:i18n           # single-dictionary checks: no empty strings, arity, reachability (pure)
npm run verify:seo            # vertical-table SEO invariants, incl. a synthetic post-flip check (pure)
npm run verify:scopes         # panel/agency scoping — needs a local database, run manually
npm run verify:local          # typecheck + build + the four pure verify:* scripts — what the pre-push hook runs
```

## Currency and the acquisition-cost estimate

Every price is stored and filtered in **EUR** (`listings.price_eur`). SEK is
never stored — it is computed at render from the newest `fx_rates` row and
disappears (not zero, not wrong — `null`) once that rate is older than
`FX_MAX_AGE_DAYS` (default 7). There is no mortgage calculator; the
deterministic money figure on the detail page is the acquisition-cost
estimate (`src/lib/acquisition-cost.ts`, backed by the `acquisition_costs`
table) — ITP/IVA+AJD, notario, registro and gestoría, roughly 10–14% on top
of the asking price. See `ARCHITECTURE.md` §3/§12 and `PLAN.md`'s
`D-mortgage` decision for why a mortgage calculator is backlog, not MVP.

**The seeded `acquisition_costs` rates are PLACEHOLDERS**, marked as such in
`scripts/seed-acquisition-costs.ts` — they print money figures on every
detail page. Verifying each comunidad's published ITP/AJD scale, and the
notary/registry/legal estimates, is a research task for the founder before
launch, not a code task.

## Hostinger production setup (one-time)

1. **MySQL (free, included in the plan):** hPanel → Databases → MySQL
   Databases → create database + user. Note host/db/user/password →
   `DATABASE_URL`. Enable **Remote MySQL** for your IP to run migrations
   from your machine. Photos live on R2, never in the DB or on hosting disk.
2. **Node.js app:** hPanel → your site → set up a Node.js application
   (requires a plan with Node.js support). Point it at this repo (git
   deploy), build command `npm run build`, start command `npm run start`.
   **After every deploy where `drizzle/` changed, run the migrations against
   production** (`DATABASE_URL=<prod url> npm run db:migrate`, then
   `npm run db:status` to confirm zero drift). Deployed code selects every
   column named in `src/db/schema.ts`; a database behind on migrations 500s
   entire page trees, not just one feature.
3. **Domain:** point `flyttatillspanien.se` at the app.
   `NEXT_PUBLIC_CANONICAL_HOST` must match the live host exactly.
4. **Cron jobs:** hPanel → Cron Jobs → schedule `npx tsx scripts/<job>.ts`
   for `cron:fx` (daily), `cron:medians` (nightly), `cron:geo` (after any
   location edit), `cron:resync`, `cron:sessions`, and `cron:translate` if
   `ANTHROPIC_API_KEY` is set. Every script is idempotent.
5. **R2:** create the bucket in Cloudflare, fill the `R2_*` envs, then run
   `npm run backfill:images` once to stop hotlinking import sources.
6. **SMTP:** create a mailbox in hPanel → Emails (it can be the same address
   as `CONTACT_EMAIL`) and set `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/
   `SMTP_PASS`/`EMAIL_FROM`. Without these, production OTP login and lead
   mail silently do not send — this is a **launch blocker**, not a
   nice-to-have.

## Launch blockers — what to fix before go-live

Founder-only items that code cannot resolve. Nothing here blocks writing
more code, but all must be cleared before the site serves real traffic.

1. **Hostinger Node.js plan.** Confirm the plan has the Node.js app option.
2. **`CONTACT_EMAIL` and SMTP credentials.** The site is null-safe without
   them, but a Swedish consumer portal with no reachable email address is
   not credible, and without SMTP no OTP or lead mail sends at all.
3. **Acquisition-cost rates.** Every comunidad row in `acquisition_costs` is
   a placeholder — see above.
4. **Domain DNS.** `flyttatillspanien.se` must point at the Hostinger app,
   and `NEXT_PUBLIC_CANONICAL_HOST` must match (it is inlined at build time
   — a change needs a rebuild, not just an env edit).
5. **Cloudflare R2 account + bucket.** Code is complete and gated on
   `isR2Configured()`; nothing to build, just an account to create.
6. **GDPR/privacy review.** The privacy copy is translated and de-Paraguayed,
   but whether it is *adequate* for a Swedish consumer site under GDPR —
   lawful basis for the identity-verification fields, retention wording — is
   a review by the founder or a lawyer, not a build task. See `PLAN.md`.

## Repo map

```
ARCHITECTURE.md            the contract — read first
docs/SPAIN-PORTAL-DESIGN.md the full Spain delta from the Paraguay build — design source of truth
plan.md                    the phased-build tracker (Phases 1-6) — distinct from PLAN.md below
PLAN.md                    the project's own living decision/status tracker
src/db/schema.ts           entire data model (Drizzle, MySQL dialect)
src/config/verticals.ts    domain → vertical routing config (one entry: flyttatillspanien.se, locale "sv")
src/lib/indexability.ts    thin-page rule — the ONLY indexability logic
src/lib/facets.ts          pure facet types + Swedish query-string vocabulary (affar/typ/ort/...)
src/lib/facet-sql.ts       server-only: facets → WHERE clauses; price filters run on price_eur
src/lib/amortization.ts    frenchAmortization() — unused, kept for a future mortgage feature
src/lib/acquisition-cost.ts the deterministic money figure that replaced the cuota engine
src/lib/format.ts          formatEur / formatSek / formatRateNote — sv-SE formatting
src/lib/crm.ts             email/SMTP boundary — the only file that knows the transport
src/lib/publish-gate.ts    enforces energy_rating before status: "published"
src/lib/slug.ts            shared diacritic-safe slugify + joinSlug
src/lib/urls.ts            URL scheme (§9 of ARCHITECTURE.md) — canonical build + inbound parse
src/lib/queries.ts         public read queries (listing detail, categories)
src/lib/reference-queries.ts fx_rates / acquisition_costs readers + operator writers
src/lib/jsonld.ts          structured data (RealEstateListing, BreadcrumbList…)
src/lib/import/            intake pipeline: normalize → dedup (catastral-exact + fallback) → upsert
app/bostad/[slug]/         listing detail page (canonical, JSON-LD, acquisition-cost block)
app/[operacion]/[...]/     category pages (indexability enforced)
app/for-maklare/           Swedish agency-acquisition landing page
app/api/leads/             lead capture → MySQL first, then email (crm.ts)
app/sitemap.ts app/robots.ts   SEO surface
src/i18n/sv.ts             the single dictionary (en.ts deleted at MVP, machinery kept)
scripts/                   cron-run idempotent jobs (seeds, medians, sitemap, fx…)
```

## Working rules for Claude Code sessions

- The gate that replaces CI is `.githooks/pre-push`: `npm run typecheck`,
  `npm run build`, `npm run verify:import`, `npm run verify:facets`,
  `npm run verify:i18n`, `npm run verify:seo`. Same thing by hand:
  `npm run verify:local`. The last four are pure — no database, no network.
- **Do not create files under `.github/workflows/`.** Deploys run on
  Hostinger's build servers via a free webhook; a workflow here would spend
  Actions minutes billed per-account on a deploy path that never uses them.
  `.githooks/pre-commit` refuses to stage such files.
- Hooks install themselves via `prepare` on `npm install`; after a fresh
  clone that skipped scripts, run `npm run hooks:install`.
- `npm run verify:scopes` stays manual — needs a localhost database, refuses
  to run against anything else. Run it on anything touching
  `listingScopeWhere`, `panelScope` or a panel query.
- Indexability decisions go through `getIndexability()` — never duplicated.
- All lead/OTP traffic goes through `src/lib/crm.ts` — nothing else may know
  which transport is behind it.
- Every visitor-facing string comes from `src/i18n/sv.ts` — no new inline
  literal in a page or component.
- Never `price_eur * :rate` in a WHERE clause — SEK filter bounds convert to
  EUR in the caller, before `facetConds()` runs.
