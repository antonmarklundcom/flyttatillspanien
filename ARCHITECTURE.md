# ARCHITECTURE.md — flyttatillspanien.se

Spanish real-estate portal for Swedish buyers. One engine, one branded door.
This codebase started as a byte-for-byte copy of `propia.node` (a Paraguay
portal) and was converted in place — the shape of the system (import
pipeline, panel scoping, geo materialization, i18n dictionary split, facet
layer, caching discipline) is the inherited design; the domain, currency,
schema and copy are Spain/Sweden's.

> **Read `CLAUDE.md` first.** This document is the design contract.
> `CLAUDE.md` records the current state of the world — what is actually
> built, what is still a placeholder, what is deliberately not built — and
> wins wherever the two disagree. `docs/SPAIN-PORTAL-DESIGN.md` is the
> decision record for the Paraguay→Spain pivot: read it for the *reasoning*
> behind a choice this file merely states.

Target: a few thousand listings at launch maturity, solo founder + Claude
Code maintaining it. No second operator: review queue, imports and lead
follow-up are founder tasks (or automations behind the CRM webhook
boundary).

---

## 1. Tech stack

One Next.js app on MySQL. No WordPress/JetEngine — the portal is a product:
the import/dedup pipeline, the acquisition-cost estimate, lead routing,
market-median jobs and the Claude-API translation pipeline are custom code
that fits a Node app.

**MySQL, not Postgres — deliberately.** Hostinger provides MySQL/MariaDB
free with the plan, and MySQL 8 with proper composite indexes handles this
portal's scale easily. The escape hatch is baked in:

- **Drizzle ORM** (`src/db/schema.ts`) — schema in TypeScript, migrations
  generated. Switching to the Postgres driver later is contained and mostly
  mechanical.
- **No MySQL-only cleverness**: no stored procedures, no MySQL-specific JSON
  tricks in hot paths. Geo queries are plain lat/lng bounding boxes on
  `idx_geo` — nothing blocks a Postgres/PostGIS upgrade.

| Layer | Choice | Why / cost |
| --- | --- | --- |
| Framework | Next.js App Router, single app | Host-header middleware for verticals (one enabled today), server components |
| Database | MySQL 8 / MariaDB on Hostinger via Drizzle | Free with the plan; portable |
| Search | SQL + composite indexes; no search engine | Free, zero ops |
| Images | Cloudflare R2 + CDN | Code complete, blocked on the founder creating the account (CLAUDE.md backlog 1) |
| Maps | MapLibre GL JS + OSM tiles | $0; Mapbox-compatible API |
| Geocoding | Seeded centroids in `locations`, cached | $0; the seeded region set is small |
| Background jobs | hPanel cron → `npx tsx scripts/*.ts` | No queue infra; every job idempotent + checkpointed |
| Auth | Session cookies + email OTP | Sweden is email-first (§7); no SMS provider needed at MVP |
| Leads/CRM | Webhook (`src/lib/crm.ts`) | Provider-agnostic; see §5 |
| FX | ECB daily reference XML, cron-cached | Free, no key, the rate Swedish banks reference |
| Translation | Anthropic API, cron-only | es→sv listing copy; see §7 |
| Analytics | GA4 | — |

## 2. Data model

Implemented in `src/db/schema.ts` (Drizzle, MySQL dialect) — that file is the
source of truth. Summary of the design intent per table:

- **`listings`** — wide, deliberately denormalized row per property.
  `price_eur` is the only stored price (EUR-only market — see §7); it is
  normalized, indexed, and the only column any filter runs on. `built_m2` is
  the only faceted area column (`usable_m2`/`plot_m2` are display-only).
  Carries the full Spain legal block: `referencia_catastral` (unique,
  nullable — the exact dedup key when present), `energy_rating` (gated:
  a listing cannot reach `status = 'published'` with this NULL —
  RD 390/2021), `legal_status`, `charges_status` +
  `nota_simple_seen_at` (the lister's declaration vs. the portal's own
  verification, kept as two columns on purpose), `ibi_annual_eur`,
  `community_monthly_eur`, `is_vpo`, `land_classification` +
  `buildable_m2` (terreno/finca), `tourist_licence`. `source_lang` +
  `title_sv`/`description_sv`/`translation_hash_sv` carry the Spanish→Swedish
  translation pair (§7). `idx_search (status, operation, location_id,
  property_type, price_eur)` covers every consumer query; map view uses
  `idx_geo` bounding boxes on the materialized `display_lat`/`display_lng`
  (§geo below).
- **`listing_images`** — R2 keys, position 0 = cover; importer scores
  watermarks so third-party-portal watermarked photos never become the
  cover. Still interim: `r2_key` holds the remote source URL until R2 is
  configured (CLAUDE.md backlog 1).
- **`locations`** — `pais → comunidad → provincia → municipio → zona`, five
  levels (Spain has one more than Paraguay's four). `full_slug` is the URL
  path only, and it starts at `municipio` — a municipio's slug is its own,
  never prefixed by its province; only a zona joins onto its municipio.
  `acquisition_region` is the comunidad's ISO-3166-2 code, materialized down
  the whole subtree at seed time (never resolved by walking `parent_id` in a
  query — see the geo section's F38 reasoning, which is currency- and
  country-independent).
- **`agencies` / `agents` / `developers` / `projects`** — supply side.
  `agencies.kind` is `inmobiliaria | relocation | developer`: a Swedish
  relocation intermediary is a *kind of agency*, not a new entity, and the
  UI must label it distinctly from a Spanish selling agent (they represent
  the buyer's side and earn from the introduction). `agencies.tax_id` +
  `tax_id_country` hold a CIF or an organisationsnummer, disambiguated by
  country rather than one column per country.
- **`listing_sources`** — provenance + dedup. Two paths: an exact
  `referencia_catastral` match short-circuits the fuzzy path entirely; absent
  that, `dedup_key` (bucketed price + area + phone + location) decides
  create vs. attach-as-another-source, and is **NULL, on purpose, when there
  is no contact phone** — a NULL key means "create it and let the review
  queue judge", never a fallback that risks folding distinct units into one
  listing.
- **`leads`** — `email` is `NOT NULL` (Sweden is email-first, §7); `phone` is
  optional and is the agency-side channel. `routed_to` includes an `owner`
  lane for FSBO listings (resolved via the seller card's chain: agent →
  agency → owner), append-only by MySQL ENUM-ordinal convention.
- **`market_medians`** — nightly cron recomputes medians (own + blended
  sources) in EUR/m². Powers the valuation magnet and the "X% below the
  median" context module (render only when `sample_size ≥ 8`).
- **`fx_rates`** + **`acquisition_costs`** — occupy the slot
  `financing_programs` vacated. `fx_rates` is a two-column-key (base, quote)
  table written only by `npm run cron:fx`; `acquisition_costs` is one row per
  comunidad (ITP/IVA/AJD/notary/registry/legal percentages), written by
  `npm run seed:costs`. Both are cron-owned reference tables where **the
  cache TTL is the invalidation mechanism**, not a backstop — there is no
  in-process writer (see `src/lib/cache.ts`'s header comment).
- **`users`** + **`otp_codes`** — email OTP before publish (6 digits,
  10-min expiry, resend cooldown). `otp_codes.destination` + `channel` are
  intentionally generic (SMS stays possible for a later phone-verification
  flow) though nothing writes `channel: 'sms'` yet.

### Domain routing

`src/config/verticals.ts` + `middleware.ts`. Vertical config lives in code
(deploy cadence, type safety). **Exactly one door is enabled:**
`flyttatillspanien.se`, `locale: "sv"`. `VerticalKey` and `Locale` are both
narrowed to `"sv"` — there is no disabled English (or Spanish) entry, on
purpose: an unowned domain in this file becomes a fallback nobody meant to
build (the inherited `propia.com.py` lesson). The machinery for a second
door — `languageAlternates()`, `hostOwnsListingDetail()`,
`verify:seo` — is kept exactly as it stood, because it is what makes adding
a real second domain later a safe, mechanical change rather than an SEO
incident, not because a second door exists today.

## 3. Design system & UX

Tokens in `src/design/tokens.ts`. Swedish strings in `src/i18n/sv.ts` — the
canonical set; the site is Swedish-only until a second locale is
reintroduced (there is no second door to serve it to yet). Mobile-first.

The differentiators, in priority order:

1. **Total acquisition cost on the detail page** — the deterministic money
   figure that fills the slot a Paraguayan "cuota" module used to occupy
   (`src/lib/acquisition-cost.ts`): a seven-row, cron-owned table, no rate
   feed, no FX dependency, closer to the reason the site exists (a Swede who
   has only bought a Swedish bostadsrätt does not know this cost category
   exists).
2. **The legal block, surfaced, not buried** — energy rating, legal status,
   charges declaration + portal verification, IBI/community costs, VPO,
   land classification for rural plots. This is the whole editorial premise:
   worth more to a Swede than Idealista with Google Translate.
3. **EUR is the price; SEK is an honest approximation** — always marked
   `≈`, rounded to the nearest 10 000 kr, with the rate and its date printed
   under it on the detail page, and it disappears entirely (not a stale
   number) when the cached rate is more than `FX_MAX_AGE_DAYS` old.
4. **Machine-translated Swedish, marked as such** — `title_sv`/
   `description_sv` are served from day one (unlike the inherited English
   door, which nothing read yet), with a visible marker when the copy came
   from the cron rather than a human source.
5. **Email as the primary CTA** — Sweden is email-first (§7); WhatsApp stays
   the agency-side channel, not the buyer's.

## 4. Programmatic SEO

URL scheme (Swedish segments; DB enum values stay Spanish — see §7):

```
/{affar}/{ort}                       /kopa/marbella
/{affar}/{ort}/{typ}                 /kopa/marbella/villor
/{affar}/{ort}/{omrade}/{typ}        /kopa/marbella/nueva-andalucia/villor
/bostad/{slug}-{public_id}           listing detail (canonical)
/precios/{ort}                       market-data pages
/proyecto/{slug}                     development/preventa pages
/inmobiliaria/{slug}  /agente/{slug} supply-side profiles
```

`affar` is `kopa | hyra | korttidshyra` (mapping to the DB's
`venta | alquiler | alquiler_vacacional`); types are pluralized Swedish
nouns (villor, lägenheter, tomter…). The pure vocabulary lives in
`src/lib/facets.ts` (query-string names, parse/build, no `next/*`, no
drizzle — the client filter bar shares it); `src/lib/facet-sql.ts` is the
only place a facet becomes a WHERE clause and is `server-only`.

**Thin-page rule — non-negotiable, single source of truth in
`src/lib/indexability.ts`**, called by BOTH page templates and the sitemap
generator: count ≥ 3 → indexable + sitemap; 1–2 → renders but
`noindex,follow`, out of sitemap; 0 → 404. A zona page additionally requires
an indexable parent municipio page.

Structured data: `RealEstateListing` + `Offer` (EUR, `Residence`/
`LandParcel`), `BreadcrumbList` everywhere, `ItemList` on categories,
`FAQPage` on guides, `RealEstateAgent` on profiles. Sitemap is a route
handler (`src/lib/sitemap-xml.ts`) rather than `generateSitemaps()` because
this build has no database at build time — every route is dynamic (§8).

## 5. CRM strategy

The portal's entire outbound-messaging surface is `src/lib/crm.ts`
(`CrmProvider` interface): `pushLead()`, `sendOtp()`, `notifyOperator()`.
Leads are recorded in MySQL first (source of truth), then pushed to the
configured webhook with full context. **The provider is optional by
construction** (`isMessagingConfigured()`): without one, email OTP is
skipped (a listing publishes unverified rather than the wizard issuing a
code nobody can receive), and a lead push or operator alert is a no-op —
never a logged line pretending a message was delivered.

Do **not** build CRM features in this repo beyond the webhook boundary.

## 6. Backlog and what is deliberately not built

`CLAUDE.md`'s "Backlog state" section is the live, verified list — read it
before assuming a feature is missing by accident rather than by decision.
Notable deliberate non-builds, restated here because they shape the
architecture:

- **No Spanish mortgage calculator.** `src/lib/amortization.ts` keeps the
  French-amortization maths, unused — there is no published non-resident
  rate scale to seed a quote from. Returns when there is a lender
  partnership (a founder decision).
- **No stored `price_sek` column, ever.** SEK is always computed at render
  (§3/§7) — a stored snapshot goes stale invisibly and a rewrite-the-whole-
  table cron for a presentational number buys nothing.
- **No cached acquisition-cost column on `listings`.** Computed at render
  from a seven-row table — see `src/lib/acquisition-cost.ts`'s header
  comment for why the `cuota_gs` caching precedent does not transfer.
- **No full NIE/DNI capture.** `users.identity_doc_type` +
  `identity_ref_last4` (last four characters only) + `identity_verified_at`
  are the whole of it — a national ID number needs a documented GDPR lawful
  basis and retention policy this portal does not have. Flag it as a
  founder decision + DPA if it ever seems necessary; do not add the column.
- **No XML feed ingestion (Idealista/Fotocasa/Kyero) yet.** MVP intake is
  CSV/XLSX through `planImport`/`commitImport`; XML is v1.1 through the
  *same* planner, never a second validation path.

## 7. i18n, currency and the source-language inversion

The site is Swedish-only (`src/i18n/sv.ts`); the machinery for a second
locale (`Widen<>`, `satisfies`, `getDictionary()`) is kept intentionally
so reintroducing English is a file addition, not a refactor.

**The translation direction is inverted from the inherited pattern.** On
propia.node, Spanish was authored and English was derived. Here, Spanish
arrives from the agency feed and **Swedish is derived** — except when a
Swedish relocation agent writes the listing themselves (`source_lang =
'sv'`). `npm run cron:translate` (`src/lib/translate.ts`) does the
es→sv work, decided by `translation_hash_sv`, never in a request path.
Unlike the inherited English door (where nothing read `title_en` yet),
`sv` **is served from day one** — the card, detail page and metadata read
`title_sv ?? title`.

**Currency is EUR-only for the price; SEK is presentation.** `price_eur` is
the sole stored, filtered price column. A visitor's SEK budget is converted
to EUR once, at the request layer, before it reaches `facetConds()` — never
`price_eur * :rate` in a WHERE clause, which would not be sargable (the
same class of mistake as the geo section's F38). `formatSek()`
(`src/lib/format.ts`) rounds to the nearest 10 000 kr and returns `null`
when the cached rate is stale, so a missing SEK line is the failure mode,
never a confidently wrong one.

## 8. Caching

Every public route is dynamic — the root layout reads the `Host` header for
the per-host brand, so no route holds a full Next.js route cache. The data
cache (`unstable_cache`, `src/lib/cache.ts`) is what actually saves query
time. Two categories of tag:

- **Writer-backed tags** (`listings`, `directory`, `guides`, `locations`,
  `marketMedians`): every tag has an in-process `revalidate*()` call in the
  action that writes it. A tag with no writer means an operator's save
  silently doesn't show up until the TTL expires.
- **Cron-only tags** (`fx`, `acquisitionCosts`): written by a separate
  `tsx` process, so `revalidateTag()` there cannot reach the running
  server's cache. For these, **the TTL is the invalidation mechanism**,
  picked to match the upstream publication cadence (ECB: once a business
  day; a comunidad's tax scale: at most once a year) — not to match how
  fast a save should appear, because there is no save path.

## 9. Map coordinates

A listing is plotted at its own `lat`/`lng` when it has one, else its zona
or municipio centroid — materialized into `display_lat`/`display_lng` at
write time (`src/lib/geo.ts`) rather than resolved with a `COALESCE` in the
query, because that coalesce is a function of two columns across a join and
is not sargable: the bounding-box test could not use `idx_geo` and every
map pan scanned the published set. Every writer that touches `lat`, `lng`
or `location_id` calls `syncDisplayCoords()`; `npm run cron:geo` repairs the
whole table after a centroid moves (e.g. after re-seeding `locations`).
