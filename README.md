# propia — Paraguay real-estate portal

One Next.js engine, multiple branded doors. Read `ARCHITECTURE.md` before
building anything — it is the contract — and `CLAUDE.md` for the current state
of the world (live domain, undecided brand name, verified backlog), which
supersedes the contract wherever they disagree.

## Stack

Next.js (App Router) · TypeScript · Drizzle ORM · MySQL 8 (Hostinger) ·
Cloudflare R2 (images) · MapLibre + OSM (maps) · GHL (CRM/WhatsApp/OTP).

## Local development

```bash
cp .env.example .env          # fill in values
docker compose up -d          # local MySQL 8 on :3306
npm install
npm run db:generate           # generate SQL migrations from src/db/schema.ts
npm run db:migrate            # apply them
npm run seed:financing        # financing_programs (verify rates before launch)
npm run seed:locations        # Gran Asunción metro + major cities hierarchy
                              # (follow it with `npm run cron:geo` — moving a
                              #  centroid moves every pin borrowing it)
npm run dev                   # http://localhost:3000
npm run db:studio             # Drizzle Studio — interim admin UI
```

Cron-style jobs (idempotent; also run on a schedule in production):

```bash
npm run cron:cuotas           # cache listings.cuota_gs (French amortization)
npm run cron:medians          # market_medians for the current month
npm run cron:geo              # repair listings.display_lat/lng after a centroid moves
npm run cron:translate        # fill listings.title_en/description_en (needs ANTHROPIC_API_KEY)
```

White-glove import (M2) — CSV/spreadsheet → pending_review listings:

```bash
npm run import:csv -- data/sample-listings.csv whiteglove
```

Re-running the same file is safe: the normalize → dedup → upsert pipeline
(`src/lib/import/`) reports every unchanged row as `unchanged` and never
creates a duplicate. A re-listed property at a slightly different price
collapses onto the existing listing (`deduped`). See
`data/sample-listings.csv` for the expected columns.

Cuota conversion uses `USD_TO_PYG` (default 7300) to turn normalized
`price_usd` into the Gs the financing programs quote in; override it in
`.env` when a treasury feed is available.

## Hostinger production setup (one-time)

1. **MySQL (free, included in the plan):** hPanel → Databases → MySQL
   Databases → create database + user. Note host/db/user/password →
   `DATABASE_URL`. Enable **Remote MySQL** for your IP if you want to run
   migrations from your machine. Per-database size limit (~3 GB on most
   plans) is a non-issue: 15k listings is tens of MB — photos live on R2,
   never in the DB or on hosting disk.
2. **Node.js app:** hPanel → your site → set up a Node.js application
   (requires a plan with Node.js support — Cloud/Business hPanel plans have
   it; classic PHP-only shared plans do not. If your plan lacks the Node.js
   option, the cheapest fixes are upgrading to Cloud or a small Hostinger
   KVM VPS in the same São Paulo region). Point it at this repo (git
   deploy), build command `npm run build`, start command `npm run start`.
   **After every deploy where `drizzle/` changed, run the migrations against
   the production DB** (`DATABASE_URL=<prod url> npm run db:migrate`, or paste
   the new `drizzle/NNNN_*.sql` into phpMyAdmin). Deployed code selects every
   column in `src/db/schema.ts`; a DB behind on migrations 500s entire page
   trees (e.g. missing `listings.review_notes` broke every listing detail
   page after M5).
3. **Domains:** point propia.com.py (and later feeder domains) at the same
   app. `middleware.ts` routes by Host header; disabled verticals resolve to
   propia.
4. **Cron jobs:** hPanel → Cron Jobs → schedule
   `npx tsx scripts/<job>.ts` (medians nightly, cuota nightly, counts
   hourly, sitemap nightly). Every script must stay idempotent.
5. **R2:** create the bucket in Cloudflare, fill the `R2_*` envs, map
   `img.propia.com.py` to it.

## Launch blockers — what to fix before go-live

Founder-only items that code cannot resolve. Nothing here blocks writing more
code, but all must be cleared before propia.com.py serves real traffic.

1. **Hostinger Node.js plan (M0).** Confirm the plan has the Node.js app
   option (Cloud/Business hPanel or a KVM VPS). MySQL is included on every
   plan; the *app* tier is the gate. If missing → upgrade to Cloud or a small
   KVM VPS in the São Paulo region.
2. **Real financing rates.** `scripts/seed-financing.ts` ships PLACEHOLDER
   Che Róga Porã / AFD terms. Verified symptom: a US$160k home currently gets
   no cuota because the placeholder caps (~900M Gs ≈ US$123k) are too low.
   Replace `annualRate`, `maxTermMonths`, `maxAmountGs`, `minDownPct` with the
   current published AFD/MUVH terms, then `npm run seed:financing` +
   `npm run cron:cuotas`. The math is verified correct; only the data is a
   placeholder.
3. **USD→PYG source.** Cuota and price normalization use `USD_TO_PYG`
   (default 7300). Set it in `.env` to the rate you want quoted; wire a
   treasury feed later if desired.
4. **Domain.** propia.com.py must be registered and pointed at the Hostinger
   app before public launch (a temporary Hostinger subdomain is fine for M0
   testing — see below). `NEXT_PUBLIC_CANONICAL_HOST` must match the live host
   so canonical URLs and vertical routing are correct.

## Repo map

```
ARCHITECTURE.md            the contract — read first
src/db/schema.ts           entire data model (Drizzle, MySQL dialect)
src/config/verticals.ts    domain → vertical routing config (propia only enabled)
src/lib/indexability.ts    thin-page rule — the ONLY indexability logic
src/lib/cuota.ts           French amortization / financing-program engine
src/lib/crm.ts             CRM boundary — the only file that knows about GHL
src/lib/slug.ts            shared diacritic-safe slugify + joinSlug
src/lib/import/            intake pipeline: normalize → dedup → upsert (M2)
src/lib/urls.ts            URL scheme (§4) — canonical build + inbound parse
src/lib/queries.ts         public read queries (listing detail, categories)
src/lib/jsonld.ts          structured data (RealEstateListing, BreadcrumbList…)
src/lib/format.ts          es-PY price/cuota formatting, R2 image URLs
src/lib/sitemap.ts         sitemap entries via getIndexability (single source)
app/propiedad/[slug]/      listing detail page (canonical, JSON-LD, WhatsApp)
app/[operacion]/[...]/     category pages (§4 shapes, indexability enforced)
app/api/leads/             lead webhook → MySQL first, then GHL (crm.ts)
app/sitemap.ts app/robots.ts   SEO surface
src/i18n/es.ts             canonical voseo strings (never neutral Spanish)
src/design/tokens.ts       design tokens v1
middleware.ts              host-header vertical resolution
scripts/                   cron-run idempotent jobs (seeds, medians, sitemap…)
```

## Working rules for Claude Code sessions

- Milestones and STOP gates are defined in `ARCHITECTURE.md` §6. Do not start
  the next milestone past a gate without founder sign-off.
- No MySQL-only tricks (stored procs, JSON in hot paths) — the Postgres
  escape hatch stays open.
- Indexability decisions go through `getIndexability()` — never duplicated.
- All lead/OTP traffic goes through `src/lib/crm.ts` — nothing else may know
  which CRM is behind it.
- Local-facing copy is Paraguayan voseo from `src/i18n/es.ts`.
