# ARCHITECTURE.md — propia.com.py

Paraguay real-estate portal. One engine, multiple branded doors. Target: 15k
listings at launch maturity, 50–100k ceiling, solo founder + Claude Code
maintaining it.

> **Read `CLAUDE.md` first.** This document is the design contract, and parts
> of it are aspirational: `propia.com.py` is **not owned**, the live site runs
> on `realestateinparaguay.com`, and the brand name is undecided. `CLAUDE.md`
> records the current state of the world and wins wherever the two disagree.

**v2 amendments (2026-07-04), superseding the original brief where they conflict:**

1. **propia.com.py launches FIRST and alone.** The terreno.com.py beachhead is
   dropped from this build. Listing detail pages are canonical on propia from
   day one — the 301 migration map is no longer needed. Feeder domains
   (terreno, alquiler, inmobiliarios, desarrolladores, EN site) stay
   pre-declared in `src/config/verticals.ts` with `enabled: false` so turning
   one on later is a config flip, not a refactor.
2. **No calendar timeframes.** Milestones are strictly sequential with STOP
   gates; ship each as fast as it passes its gate. Goal: propia.com.py live,
   listing properties and earning SEO traffic, ASAP.
3. **No Diana / no second operator.** Review queue, white-glove imports, and
   lead follow-up are founder tasks (or GHL automations). `leads.routed_to`
   uses `internal`, not a person.
4. **GHL is the CRM of record** for leads, WhatsApp messaging, and OTP
   delivery. See §5 (CRM strategy) for the sub-account / own-CRM path.
5. **Model workflow:** Fable 5 does architecture, planning, and the
   hardest/most expensive-to-unwind problems, then STOPs for human review;
   Opus 4.8 executes the heavy implementation phases; Sonnet 5 executes
   templated work (page templates, forms, wizard steps, copy wiring).

Constraining facts: (1) hosting starts on Hostinger shared/cloud (Brazil
region — São Paulo is the lowest-latency major region to Paraguay), migrate
once traction is proven; (2) inventory seeded by scrape/API bootstrap +
white-glove agency imports + paid ads driving FSBO sellers; (3) maps are free
OSM-based to start.

---

## 1. Tech stack

One Next.js app on MySQL. No WordPress/JetEngine — the portal is a product,
not a content site; everything that makes propia win (import/dedup pipeline,
cuota calculation, lead routing to GHL, market-median jobs, Claude-API content
pipeline) is custom code that fits a Node app.

**MySQL, not Postgres — deliberately.** Hostinger provides MySQL/MariaDB free
with the plan. MySQL 8 with proper composite indexes handles 100k-row faceted
filtering easily (the incumbent's whole inventory is 14.5k rows). The escape
hatch is baked in:

- **Drizzle ORM** (`src/db/schema.ts`) — schema in TypeScript, migrations
  generated. Switching to the Postgres driver later is contained and mostly
  mechanical.
- **No MySQL-only cleverness**: no stored procedures, no MySQL-specific JSON
  tricks in hot paths. Geo queries are plain lat/lng bounding boxes on
  `idx_geo` — nothing blocks a Postgres/PostGIS upgrade.

**A hosting move is NOT a database move.** When leaving Hostinger shared for
a VPS (Hostinger KVM or elsewhere), the cheapest path is `mysqldump` → MySQL
on the VPS — same driver, same schema, one evening. Switch to Postgres only
when a migration trigger actually fires:

> **Migration triggers (revisit quarterly):** listings > ~50k with visible
> filter latency; you need search-as-you-type (→ Meilisearch, wants a VPS
> anyway); import jobs exceed shared-hosting execution limits; a second
> developer joins. Then: VPS + Postgres + Meilisearch, a weekend not a
> rewrite.

| Layer | Choice | Why / cost |
| --- | --- | --- |
| Framework | Next.js App Router, single app for ALL domains | ISR for programmatic SEO, host-header middleware for verticals, server components for slow Paraguayan mobile |
| Database | MySQL 8 / MariaDB on Hostinger via Drizzle | Free with the plan; portable |
| Search | SQL + composite indexes; no search engine in v1 | Free, zero ops; Meilisearch is the Year-2 upgrade |
| Images | Cloudflare R2 + CDN | 10 GB free, zero egress; never on hosting disk; thumbs via sharp on upload |
| Maps | MapLibre GL JS + OSM tiles | $0; Mapbox-compatible API = paid upgrade is a token swap |
| Geocoding | Nominatim, aggressively cached in `locations` | $0; Paraguay's location space is small |
| Background jobs | hPanel cron → `npx tsx scripts/*.ts` | No queue infra; every job idempotent + checkpointed |
| Auth | Session cookies + WhatsApp OTP via GHL | Reuses the $497 GHL plan; no Twilio |
| Leads/CRM | Webhook → GHL (`src/lib/crm.ts`) | See §5 |
| Analytics | GA4 now, Plausible later | Free now |

## 2. Data model

Implemented in `src/db/schema.ts` (Drizzle, MySQL dialect) — that file is the
source of truth. Summary of the design intent per table:

- **`listings`** — wide, deliberately denormalized row per property.
  `price_usd` normalized at write time (ALL filtering uses it); `cuota_gs`
  cached by nightly cron (`src/lib/cuota.ts`, French amortization vs best
  qualifying `financing_programs` row); `bedrooms = 0` means monoambiente,
  `NULL` means N/A (terreno). `idx_search (status, operation, property_type,
  location_id, price_usd)` covers every consumer query; map view uses
  `idx_geo` bounding boxes with client-side supercluster.
- **`listing_images`** — R2 keys, position 0 = cover; importer scores
  watermarks so third-party-portal watermarked photos never become the cover.
- **`locations`** — pais → departamento → ciudad → barrio hierarchy with
  precomputed `full_slug` and hourly-cached `listing_counts` JSON (powers
  "122 propiedades acá" and the thin-page rule with zero COUNT queries at
  request time). Seed from OSM/GeoNames cross-checked against Tu Lugar's
  taxonomy. `guide_content_es/en` hold Claude-generated barrio guides.
- **`agencies` / `agents` / `developers` / `projects`** — supply side.
  `projects` powers the nearby-projects autocomplete in the wizard (preventa
  units attach to buildings) and the developer revenue lane.
  `agencies.ghl_sub_account_id` reserved for the CRM product lane (§5).
- **`listing_sources`** — provenance + dedup, load-bearing because seeding is
  scrape + white-glove + FSBO simultaneously. Dedup order: exact `source_url`
  → same listing; matching `dedup_key` (normalized phone + price ±5% bucket +
  m² ±10% bucket + location) → flag for the review queue, never auto-merge.
  Importers mark stale listings `paused` via `last_seen_at`.
- **`leads`** — every lead fires a webhook to GHL with full context; the
  portal never sends WhatsApp itself. `lead_type` distinguishes
  seller/valuation leads (the money report is one query).
- **`market_medians`** + **`financing_programs`** — nightly cron recomputes
  medians (own + blended sources) and every listing's `cuota_gs`. Medians
  power the valuation magnet, barrio guides, and the "8% debajo de la mediana"
  context module (render only when `sample_size ≥ 8`).
- **`users`** + **`otp_codes`** — WhatsApp OTP before publish (6 digits,
  10-min expiry, resend cooldown), delivered via GHL.

### Domain routing

`src/config/verticals.ts` + `middleware.ts`. Vertical config lives in code
(deploy cadence, type safety). Only propia is `enabled` in v1; unknown or
disabled hosts resolve to propia. Canonical policy: listing detail pages exist
canonically on propia.com.py only; future feeder domains own their own
category/landing/guide pages with distinct copy and link into propia. The EN
site is the exception (own `description_en` detail pages with hreflang —
translation ≠ duplicate).

## 3. Design system & UX

Tokens in `src/design/tokens.ts` (petrol teal #0D3B4D + warm gold #D4A24C;
WhatsApp green never repurposed). Voseo strings in `src/i18n/es.ts` — the
canonical set; never generate neutral-Spanish variants. Mobile-first (Android
+ WhatsApp is the market).

Keep from Tu Lugar: 3-step wizard with autosave, map-pin + nearby-projects
location flow, WhatsApp OTP at publish, split list/map with price pins and
cluster chips, pre-filled inquiry + quick-question chips, "Avisame si baja",
publish-as persona selector.

propia's openings (the differentiators, in priority order):

1. **Cuota on the card** — `🏦 Gs X/mes con Che Róga Porã` on every venta
   card (amber, from cached `cuota_gs`); rentals show the Gs conversion line.
2. **Trust system** — `✓ Verificado` badge (WhatsApp-verified publisher + no
   open duplicate/report flags); watermarked photos never the cover.
3. **Market context on the detail page** — "Mediana del barrio: $X/m² — este
   aviso está 8% por debajo" when `sample_size ≥ 8`.
4. **WhatsApp as the primary CTA** (logs the lead before redirecting —
   attribution never depends on the agent); email demoted to secondary.
5. Wizard deltas: foreign-exposure toggle (default ON, shown pre-launch with
   "próximamente"), 20-photo cap + video URL, cuota preview on the price
   step, "¿Tienes muchos inmuebles?" → white-glove intake.

## 4. Programmatic SEO

URL scheme:

```
/{operacion}/{ciudad}                      /alquiler/asuncion
/{operacion}/{ciudad}/{tipo}               /alquiler/asuncion/departamentos
/{operacion}/{ciudad}/{barrio}/{tipo}      /venta/asuncion/recoleta/casas
/propiedad/{slug}-{public_id}              listing detail (canonical)
/barrios/{ciudad}/{barrio}                 neighborhood guide
/precios/{ciudad}[/{barrio}]               market-data pages
/proyectos/{slug}                          development/preventa pages
/inmobiliarias/{slug}  /agentes/{slug}     supply-side profiles
```

Types pluralized (casas, departamentos, terrenos); operations as nouns
(venta, alquiler — never verb forms). ISR (`revalidate: 3600`) over a page
inventory derived from `locations.listing_counts`; top ~200 pages seeded via
`generateStaticParams`, long tail renders on first hit.

**Thin-page rule — non-negotiable, single source of truth in
`src/lib/indexability.ts`**, called by BOTH page templates and the sitemap
generator: count ≥ 3 → indexable + sitemap; 1–2 → renders but
`noindex,follow`, out of sitemap; 0 → 404 (via `notFound()`) or redirect to
parent — a true 410 would need a route handler and buys nothing over 404 for
deindexing. Barrio pages
additionally require an indexable parent city page.

Structured data: `RealEstateListing` + `Offer` (+ `Residence`/`LandParcel`),
`BreadcrumbList` everywhere, `ItemList` on categories, `FAQPage` on guides,
`RealEstateAgent` on profiles. Sitemap index → chunked child maps, nightly
cron. Internal linking via one data-driven `RelatedLinks` component — never
hand-curated. Guides: monthly Claude-API batch, grounded ONLY in DB data
(medians history, counts, projects, landmarks), 400–600-word voseo,
regenerated quarterly.

## 5. CRM strategy (GHL now, options later)

**Now:** GHL is the CRM. The portal's entire CRM surface is
`src/lib/crm.ts` (`CrmProvider` interface): `pushLead()` and `sendOtp()`.
Leads are recorded in MySQL first (source of truth for the money report),
then pushed to GHL with full context (listing, vertical, UTM). GHL pipelines
handle follow-up.

**Later, two compatible expansion paths — decided outside this repo:**

- **GHL sub-accounts per agency**: resell GHL as the agency's CRM.
  `agencies.ghl_sub_account_id` already exists; lead routing sends the lead
  to the agency's sub-account instead of the internal pipeline. Fastest
  revenue, zero build.
- **Own real-estate CRM** (a Mspecs/Vitec for Paraguay): a separate repo and
  product. This repo stays ready by keeping the boundary clean: leads webhook
  payloads are provider-agnostic JSON, stable `public_id`s everywhere, and
  nothing outside `crm.ts` knows GHL exists. The future CRM consumes the same
  payloads GHL does today.

Do **not** build CRM features in this repo beyond the webhook boundary.

## 6. Build plan (sequential milestones, no dates — ship ASAP)

Model policy: **Fable 5** = architecture + hardest problems + review gates
(done: this document, schema, indexability, cuota, routing, CRM boundary).
**Opus 4.8** = expensive-to-unwind implementation. **Sonnet 5** = templated
work. Every milestone ends in a STOP gate the founder clears; no session
starts the next milestone past a gate.

**M0 — Rails** _(Sonnet 5)_ — deploy pipeline to Hostinger (git → build →
Node.js app in hPanel), production MySQL created + connected, R2 bucket +
upload helper, envs. STOP: app serves on a real URL, DB round-trips, one
image round-trips through R2. Nothing else until deploys are boring.

**M1 — Schema live + seeds** _(Opus 4.8)_ — generate + run Drizzle
migrations from `src/db/schema.ts`; seed `locations` (OSM/GeoNames ×
Tu Lugar taxonomy) and `financing_programs` (verify real Che Róga Porã/AFD
terms); cuota + median cron scripts wired (fine against sparse data). STOP:
schema reviewed against every §3 UI element and §4 page type — changes after
M3 cost 10x.

**M2 — Minimum supply** _(Opus 4.8)_ — white-glove intake: CSV/spreadsheet
adapter + the importer framework core (normalize → dedup → upsert +
`listing_sources`), Drizzle Studio as the interim admin, minimal review
queue. Enough to get real published listings WITHOUT waiting for scrapers.
STOP: 50 hand-audited listings correct; importer re-runs produce zero
duplicates.

**M3 — Public launch surface** _(Opus 4.8 core, Sonnet 5 UI)_ — the
LAUNCHABLE increment: listing detail page (gallery, sticky WhatsApp contact
card, cuota module, JSON-LD), category ISR pages with the templated intro
block, `getIndexability()` enforced, sitemap index + robots, lead capture →
GHL webhook, GA4 + Search Console. STOP → **LAUNCH propia.com.py**: real
listings indexed, leads landing in GHL with correct attribution.

**M4 — Search, filters & map** _(Opus 4.8 query layer, Sonnet 5 UI)_ — typed
query function over `idx_search`, facets, map API (bounding box +
supercluster), split list/map UI, mobile full-screen map. STOP: <200ms
server-side filters, every combination hits an index (EXPLAIN audit).

**M5 — Wizard, OTP & accounts** _(Sonnet 5; Opus 4.8 for auth/OTP)_ — 3-step
wizard with autosave, nearby-projects autocomplete, foreign-exposure toggle,
cuota preview, 20 photos + video URL; GHL WhatsApp OTP; agency/agent
profiles; "¿Tienes muchos inmuebles?" intake. STOP: an outsider publishes
end-to-end on a phone; OTP delivery > 95%.

**M6 — Scrape importers + programmatic SEO at scale** _(Opus 4.8)_ —
InfoCasas/Clasipar adapters (Tu Lugar API for bootstrap/validation only —
fragile, never a foundation), watermark scoring, barrio guides via Claude
API for top 30 barrios, /precios pages, full internal-link modules. STOP:
Screaming Frog crawl — zero indexable thin pages, zero canonical conflicts,
valid structured data everywhere.

**M7 — Monetization & feeders** _(mixed)_ — valuation lead magnet, featured
listings + preventa promotion, then feeder domains flipped on one at a time
(alquiler → EN site → directories), each with distinct copy. Year-2 items
(Meilisearch, VPS/Postgres, agent lite-CRM, reviews) stay out of scope until
§1 triggers fire.
