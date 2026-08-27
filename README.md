# flyttatillspanien.se — Spanish property, Swedish buyers

One Next.js engine, one branded door. Read `ARCHITECTURE.md` for the design
contract inherited from propia.node (a Paraguay portal, this codebase's
starting point) and `docs/SPAIN-PORTAL-DESIGN.md` for the Spain-specific
delta — schema, currency, cuota-engine replacement, URL vocabulary — that
this file and `CLAUDE.md` now describe as built. `CLAUDE.md` is the current
state of the world and supersedes both wherever they disagree.

## Stack

Next.js (App Router) · TypeScript · Drizzle ORM · MySQL 8 (Hostinger) ·
Cloudflare R2 (images, pending — see CLAUDE.md backlog) · MapLibre + OSM
(maps) · a generic outbound webhook for CRM/email-OTP/lead alerts
(`src/lib/crm.ts`) · Anthropic API for es→sv listing translation.

## Local development

```bash
cp .env.example .env          # fill in values
docker compose up -d          # local MySQL 8 on :3306 (db/user "ftse")
npm install
npm run db:generate           # generate SQL migrations from src/db/schema.ts
npm run db:migrate            # apply them
npm run seed:costs            # acquisition_costs (verify rates before launch)
npm run seed:locations        # comunidad/provincia/municipio/zona hierarchy
                              # (follow it with `npm run cron:geo` — moving a
                              #  centroid moves every pin borrowing it)
npm run dev                   # http://localhost:3000
npm run db:studio             # Drizzle Studio — interim admin UI
```

Cron-style jobs (idempotent; also run on a schedule in production):

```bash
npm run cron:fx               # fetch the ECB EUR/SEK reference rate
npm run cron:medians          # market_medians for the current month
npm run cron:geo              # repair listings.display_lat/lng after a centroid moves
npm run cron:translate        # fill listings.title_sv/description_sv (needs ANTHROPIC_API_KEY)
npm run cron:resync           # pause listings whose sources have gone quiet
npm run cron:sessions         # purge expired sessions
```

White-glove import — CSV/spreadsheet → pending_review listings:

```bash
npm run import:csv -- data/sample-listings.csv whiteglove
```

Re-running the same file is safe: the normalize → dedup → upsert pipeline
(`src/lib/import/`) reports every unchanged row as `unchanged` and never
creates a duplicate. A re-listed property at a slightly different price
collapses onto the existing listing (`deduped`) — or, when the row carries a
`referencia_catastral`, on that exact cadastral reference instead of the
fuzzy match. See `data/sample-listings.csv` for the expected columns
(EUR-only pricing, the Spain legal block).

Prices are EUR-only (`listings.price_eur`); there is no currency conversion
in the import pipeline. SEK is computed at render from the cached
`fx_rates` row (`npm run cron:fx`) and is never stored.

## Hostinger production setup (one-time)

1. **MySQL (free, included in the plan):** hPanel → Databases → MySQL
   Databases → create database + user. Note host/db/user/password →
   `DATABASE_URL`. Enable **Remote MySQL** for your IP if you want to run
   migrations from your machine.
2. **Node.js app:** hPanel → your site → set up a Node.js application
   (requires a plan with Node.js support). Point it at this repo (git
   deploy), build command `npm run build`, start command `npm run start`.
   **After every deploy where `drizzle/` changed, run the migrations against
   the production DB** (`DATABASE_URL=<prod url> npm run db:migrate`), then
   `npm run db:status` to confirm `No drift`. Deployed code selects every
   column in `src/db/schema.ts`; a DB behind on migrations 500s entire page
   trees.
3. **Domain:** point flyttatillspanien.se at the app. `middleware.ts` routes
   by Host header; an unrecognised host resolves to `CANONICAL_HOST`.
4. **Cron jobs:** hPanel → Cron Jobs → schedule `npx tsx scripts/<job>.ts`
   (medians nightly, fx daily, geo repair nightly, translate on a schedule
   once `ANTHROPIC_API_KEY` is set). Every script must stay idempotent.
5. **R2:** blocked on the founder creating the Cloudflare account/bucket —
   see CLAUDE.md backlog item 1. Do not build around it.

## Launch blockers — what to fix before go-live

Founder-only items that code cannot resolve.

1. **Real acquisition-cost rates.** `scripts/seed-acquisition-costs.ts` ships
   PLACEHOLDER ITP/IVA/AJD/notary/registry/legal percentages for all seven
   comunidades. Verify each against that comunidad's published scale before
   launch, then `npm run seed:costs`.
2. **`CONTACT_EMAIL` must be set.** Sweden is email-first
   (docs/SPAIN-PORTAL-DESIGN.md §3.7); a Swedish consumer portal with no
   email address on the contact page is not credible. `CONTACT_WHATSAPP` is
   optional and is the agency-side channel only.
3. **`ANTHROPIC_API_KEY`** for `cron:translate` — without it Spanish-sourced
   listings never get a Swedish translation and the site shows `title ??`
   the untranslated Spanish text with no "maskinöversatt" fallback ever
   firing (there is nothing to translate from).
4. **R2 credentials** — see backlog item 1 above; photos fall back to the
   remote source URL until then.
5. **Domain + `NEXT_PUBLIC_CANONICAL_HOST`** must both point at
   flyttatillspanien.se before public launch.

## Repo map

```
ARCHITECTURE.md                the inherited design contract — read with CLAUDE.md
docs/SPAIN-PORTAL-DESIGN.md    the Spain-specific delta this build implements
src/db/schema.ts               entire data model (Drizzle, MySQL dialect)
src/config/verticals.ts        domain -> vertical routing config (one door: flyttatillspanien.se)
src/lib/indexability.ts        thin-page rule — the ONLY indexability logic
src/lib/amortization.ts        French amortization (unused today — no lender partner yet)
src/lib/acquisition-cost.ts    total-purchase-cost estimate (the cuota engine's replacement)
src/lib/crm.ts                 CRM boundary — the only file that knows the outbound provider
src/lib/slug.ts                shared diacritic-safe slugify + joinSlug
src/lib/import/                intake pipeline: normalize -> dedup -> upsert
src/lib/urls.ts                URL scheme — canonical build + inbound parse (Swedish segments)
src/lib/facets.ts              pure facet vocabulary (query-string names, parse/build)
src/lib/facet-sql.ts           facets -> SQL, server-only
src/lib/queries.ts             public read queries (listing detail, categories)
src/lib/jsonld.ts              structured data (RealEstateListing, BreadcrumbList…)
src/lib/format.ts              sv-SE EUR/SEK formatting, R2 image URLs
src/lib/geo.ts                 display-coordinate materialization
src/lib/translate.ts           es -> sv listing translation (cron-only, never a request hook)
src/lib/sitemap.ts             sitemap entries via getIndexability (single source)
app/bostad/[slug]/             listing detail page (canonical, JSON-LD, EUR/SEK price)
app/[affar]/[...]/             category pages (indexability enforced)
app/api/leads/                 lead webhook -> MySQL first, then the outbound provider
app/sitemap.ts app/robots.ts   SEO surface
src/i18n/sv.ts                 canonical Swedish strings — the only served dictionary
src/design/tokens.ts           design tokens v1
middleware.ts                  host-header vertical resolution
scripts/                       cron-run idempotent jobs (seeds, medians, fx, sitemap…)
```

## Working rules for Claude Code sessions

- `CLAUDE.md` is the state of the world; read it before touching canonicals,
  metadata, currency, or the schema.
- No MySQL-only tricks (stored procs, JSON in hot paths) — the Postgres
  escape hatch stays open.
- Indexability decisions go through `getIndexability()` — never duplicated.
- All lead/OTP/alert traffic goes through `src/lib/crm.ts` — nothing else
  may know which provider is behind it.
- Visitor-facing copy is Swedish, from `src/i18n/sv.ts` — never inline a new
  literal in a page or component.
