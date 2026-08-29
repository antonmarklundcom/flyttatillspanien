# ARCHITECTURE.md — flyttatillspanien.se

Spanish property, Swedish buyers. One Next.js engine, one served door
(`locale: "sv"`), three lister types against one database. Solo founder +
Claude Code building and maintaining it.

> **Read `CLAUDE.md` first.** This document is the design contract — the
> shape the system is built to. `CLAUDE.md` is the state of the world and
> wins wherever the two disagree. The full delta this rewrite is based on is
> `docs/SPAIN-PORTAL-DESIGN.md`, and the phase-by-phase account of what
> actually landed is `plan.md` §9 (the build log) — read that before
> assuming a design-doc intention shipped exactly as written.

**Origin note.** This repo began as a byte-for-byte copy of `propia.node`,
a Paraguay real-estate portal (`realestateinparaguay.com` /
`inmobiliaria.com.py`, Guaraní pricing, WhatsApp-OTP auth, a state-subsidised
mortgage programme called Che Róga Porã). None of that describes this site
today. Every table, route, currency rule and auth flow below is the Spain/
Sweden shape a six-phase rebuild (`plan.md`) put in its place. Where this
document still says something Paraguayan, that is a bug in the document, not
a fact about the code — see the verification grep at the end of
`docs/SPAIN-PORTAL-DESIGN.md`'s handoff section.

---

## 1. Tech stack

One Next.js app on MySQL — unchanged from the Paraguay build, because none of
the reasons for it were Paraguay-specific. No WordPress/JetEngine: the
differentiators (import/dedup, the acquisition-cost estimate, email-first
leads, market-median jobs, Claude-API translation) are custom code that fits
a Node app, not a template engine.

**MySQL, not Postgres — still deliberate.** Hostinger provides MySQL/MariaDB
free with the plan, and composite indexes handle the target inventory size
easily. The escape hatch stays baked in:

- **Drizzle ORM** (`src/db/schema.ts`) — schema in TypeScript, migrations
  generated. A Postgres driver swap later is contained and mostly mechanical.
- **No MySQL-only cleverness**: no stored procedures, no MySQL-specific JSON
  tricks in hot paths. Geo queries are plain lat/lng bounding boxes on
  `idx_geo` — nothing blocks a future PostGIS upgrade.

| Layer | Choice | Why / cost |
| --- | --- | --- |
| Framework | Next.js App Router, single app | Server components for slow mobile networks; every public route is dynamic (see §7) |
| Database | MySQL 8 on Hostinger via Drizzle | Free with the plan; portable |
| Search | SQL + composite indexes; no search engine | Free, zero ops |
| Images | Cloudflare R2 + CDN | 10 GB free, zero egress; blocked on the founder creating the account — code exists, do not build around the gap |
| Maps | MapLibre GL JS + OSM tiles | $0; Mapbox-compatible API |
| Geocoding | Cached in `locations`, seeded by hand for 41 municipios + 10 zonas | Spain's target location space is small and known in advance |
| Background jobs | hPanel cron → `npx tsx scripts/*.ts` | No queue infra; every job idempotent |
| Auth | Session cookies + **email OTP**, not WhatsApp | Sweden is email-first; see §6 |
| Leads / transactional mail | Nodemailer over SMTP against a Hostinger mailbox, behind `src/lib/crm.ts` | No CRM product (GHL is gone); the boundary is kept so a transactional provider (Resend/Postmark) is a config swap later |
| Currency | EUR stored, SEK computed at render from a cached ECB rate | See §3 |
| Analytics | GA4 | Unchanged from the original plan |

## 2. Data model

Implemented in `src/db/schema.ts` — that file is the source of truth. This is
a summary of the design intent per table, as it stands after the Phase 1–4
rebuild.

- **`listings`** — wide, deliberately denormalized. `price_eur` is the only
  stored price and the only filter column (§3). The Spain legal/compliance
  block lives here (§4) — `referencia_catastral`, the energy quad,
  `legal_status`, `charges_status` + `nota_simple_seen_at`, `ibi_annual_eur`,
  `community_monthly_eur`, `is_vpo`, `land_classification`/`buildable_m2`,
  `tourist_licence`. Areas split into `built_m2` (the only faceted/compared
  figure — matches what agency feeds and Idealista both show), `usable_m2`
  (display-only) and `plot_m2`. `operation` is
  `venta | alquiler | alquiler_vacacional`; `property_type` includes `atico`
  as its own tier, not a flag on `apartamento`. Copy direction is inverted
  from the Paraguay build: Spanish (`title`/`description_es`) is the
  **source** language (agency feeds), Swedish (`title_sv`/`description_sv`)
  is **derived** by `cron:translate`, marked `source_lang` and hashed per
  target language (`translation_hash_sv` — suffixed because a second target
  language, English, is a stated future addition, not a hypothetical). A
  served `title_sv ?? title` fallback with a visible "maskinöversatt"
  marker is required from day one, because `sv` — unlike Paraguay's `en` —
  is a served locale immediately.
- **`listing_images`** — R2 keys, position 0 = cover; unchanged mechanism
  from the Paraguay build, still blocked on the R2 account existing.
- **`locations`** — Spain has five natural levels, one more than Paraguay's
  four: `pais → comunidad → provincia → municipio → zona`. `full_slug` stays
  the **URL path only** (`municipio[/zona]`) — `comunidad`/`provincia` are
  grouping/tax-resolution levels reached through `parent_id`, never in the
  slug. Each node also carries a materialised `acquisition_region` (the
  comunidad's ISO-3166-2 code, copied down the tree at seed time) so the
  acquisition-cost estimate never has to walk the tree inside a query — the
  same F38 sargability reasoning that keeps `display_lat`/`display_lng`
  materialised. Seeded: 1 país, 7 comunidades, 10 provincias, 41 municipios,
  10 zonas (6 under Marbella, 4 under Palma) — `scripts/seed-locations.ts`.
- **`agencies` / `agents`** — supply side. `agencies.kind` is
  `inmobiliaria | relocation | developer`, one enum column rather than a
  forked table or forked scope machinery: a Swedish relocation intermediary
  is a *kind of agency*, not a new entity, and gets the whole apparatus
  (`agents`, invites, panel, leads) for free. A `relocation`-kind agency
  represents the buyer's side, not the seller's, and every seller-card
  render labels it distinctly rather than blurring it into "agency".
  `agencies.tax_id`/`tax_id_country`/`country_code` hold a CIF (Spanish
  company) or a Swedish organisationsnummer in one column pair rather than
  three mostly-NULL per-country columns. `registry_number` (the AICAT/Madrid/
  Andalucía estate-agent registry number, where one applies) is a column
  with no UI yet — v1.1, per the design doc's MVP/wait table; most of Spain
  has no mandatory registry, so its absence is not a red flag.
- **`users`** — email-first: `email` is `NOT NULL UNIQUE` (was nullable),
  `phone` optional (was the unique `whatsapp` identity). `identity_doc_type`/
  `identity_ref_last4`/`identity_verified_at` hold **only the last four
  characters** of a NIE/DNI/passport/personnummer plus an operator-set
  verification timestamp — full-number capture is a deliberate non-column
  (§5). `locale` is `sv | en | es`, where `es` exists for a future Spanish
  agency panel login, not a public door.
- **`leads`** — `email NOT NULL`, `phone` optional (the inverse of the
  Paraguay shape, where `whatsapp` was required and email was nullable).
  `routed_to` keeps its existing lanes.
- **`otp_codes`** — `destination` (was `whatsapp`) + `channel` (`email | sms`,
  default `email`). OTP and transactional mail both go out over SMTP via
  `crm.ts`, never WhatsApp.
- **`fx_rates`** and **`acquisition_costs`** — new reference tables occupying
  the slot `financing_programs` vacated (§3, §4). Both tiny, cron-owned,
  read-only to the app, cached forever with an explicit override path from
  `/admin`.
- **Deleted outright**: `financing_programs`, `listings.cuota_gs`,
  `listings.foreign_exposure`, `listings.price_amount`/`price_currency`,
  `listings.title_en`/`description_en`/`translation_hash` (the English pair
  returns with the English door, suffixed the same way the Swedish pair is),
  `listings.area_m2`/`land_m2`.

### Reference tables in detail

**`fx_rates`** — a two-row table (`EUR`→`SEK`, keyed on `(base, quote)`),
written only by `npm run cron:fx` against the ECB's daily reference-rate XML,
or by an operator's manual override from `/admin/referens`. `observed_on` is
stored as a `'YYYY-MM-DD'` string, not a `Date` — an ECB reference date is a
publication day, not an instant, and mapping it to a `Date` invites a
timezone bug in a column with no time in it.

**`acquisition_costs`** — one row per comunidad autónoma (`AN`, `VC`, `MC`,
`IB`, `CN`, `CT`, `MD` at MVP), each carrying `itp_pct` (resale transfer
tax), `iva_pct`/`ajd_pct` (new-build), and estimated notary/registry/legal
percentages. **Every seeded rate is a PLACEHOLDER**, marked exactly as the
inherited `seed-financing.ts` marked its AFD rate — verifying each
comunidad's published scale is a research task for the founder, not a code
task (`KNOWN-ISSUES.md` names this explicitly).

## 3. Currency: EUR is stored, SEK is computed

**`price_eur decimal(12,2) NOT NULL`** is the only stored price and the only
filter column. There is no `price_sek` column, in any form, and there must
never be one:

- A stored SEK snapshot goes stale invisibly — EUR/SEK has moved ~10% across
  a single year before, and nothing in the UI can tell a fresh snapshot from
  an eighteen-month-old one.
- Refreshing it would be a full-table rewrite for a number that is purely
  presentational — the same class of pointless cron the old `cuota_gs`
  column would have needed if Spain still had a per-listing cached figure.
- It is unnecessary for filtering: a visitor's SEK filter bounds convert to
  EUR **once, in the caller**, before `facetConds()` runs — never
  `price_eur * :rate` inside a WHERE clause. An expression over a column
  cannot use an index; the whole published set would scan on every filtered
  search (the same F38 mistake as `coalesce(listings.lat, locations.lat)`).

SEK is computed at render from the newest `fx_rates` row, rounded to the
nearest 10 000 kr (so it visibly reads as an estimate, not a quoted price),
and shown with its rate and date on the detail page:
`EUR/SEK 11,42 · 27 aug 2026`. **If the newest rate is older than
`FX_MAX_AGE_DAYS` (7), `formatSek()` returns `null` and every SEK line
disappears** — the EUR price is unaffected. A missing SEK figure is a small
disappointment; a confidently wrong one is a complaint the site cannot take
back. `/admin/referens` shows the current rate and a manual-override field
(`source: "manual"`) so the operator is never blocked on ECB being down.

Number formatting is `sv-SE` throughout (thin non-breaking space thousands
separator, comma decimal) — derived from the request, never from the
dictionary. "Numbers are not copy."

## 4. The Spain legal/compliance block

This is the block that makes the portal worth more to a Swede than Idealista
with Google Translate, and the closest thing the site has to an editorial
premise.

- **`referencia_catastral`** — the Catastro's 20-character property
  identifier, unique (`uq_catastral`) over a **nullable** column. NULLs are
  all-distinct in a MySQL unique index, which is exactly what is wanted here:
  most listings will have no reference and must not collide, while any two
  that share one *are* the same property. Import dedup uses it as an exact
  key and skips the fuzzy `dedupKey()` path entirely when it is present;
  the fuzzy phone-bucket fallback (including its `null`-means-do-not-merge
  rule) is unchanged for everything else.
- **`energy_rating`** (`A`–`G`, `en_tramite`, `exento`) plus emissions/kWh/CO₂
  fields — legally required in the advertisement itself under Spain's
  RD 390/2021. There is a **publish gate**: a listing cannot reach
  `status: "published"` with `energy_rating` NULL, enforced in
  `src/lib/publish-gate.ts` and called from every writer that can make that
  transition (`approveListing`, `updateListing`, `commitImport(publish:true)`)
  — never only in a form, because the importer is a write path a form-only
  check would miss entirely.
- **`legal_status`** (`escritura_registrada | obra_nueva_lpo | sin_lpo |
  en_regularizacion | desconocido`) — surfaces whether a property is deeded
  and licensed, on a coastline where an unlicensed rustic-land purchase is a
  real and recurring trap for a foreign buyer who has no context for the
  category. `desconocido` is the honest default; the site never implies a
  clean status it was not told about.
- **`charges_status`** (the lister's declaration) and
  **`nota_simple_seen_at`** (the portal's own verification, operator-set
  only, never touched by a lister-facing form) are deliberately two separate
  facts, not one enum — "seller says: free of charges — not yet verified by
  us" is a different sentence from a laundered claim of fact.
- **`ibi_annual_eur`** / **`community_monthly_eur`** — the running-cost pair
  a Swedish buyer coming from a Swedish bostadsrätt routinely fails to
  budget for; the comunidad fee on an urbanisation with a pool often exceeds
  the municipal tax.
- **`is_vpo`** — one boolean, price-capped VPO housing that in practice a
  non-resident foreign buyer cannot purchase; it exists purely to prevent a
  category of wasted inquiry.
- **`land_classification`** (`urbano | urbanizable | rustico`) and
  **`buildable_m2`** — `terreno`/`finca` only; `rustico` means "you very
  probably cannot build a house here," the single most common
  misunderstanding in a foreign land purchase.
- **`tourist_licence`** — the comunidad's short-let registration number
  (VFT/VT/…), shown for `alquiler_vacacional` listings, which ship at MVP.

## 5. The NIE/DNI question — a deliberate non-column

There is **no full NIE/DNI column** for private sellers. A national ID
number under GDPR Art. 9 / the Spanish LOPDGDD needs a documented lawful
basis and retention policy the portal does not have. What the portal
actually needs — "is this person who they say they are" — is answered by a
one-time document check, not a stored number; the number itself is the
notary's business at the escritura, under their own legal basis.

`users.identity_doc_type` / `identity_ref_last4` (**last four characters
only**) / `identity_verified_at` (operator-set, NULL = unverified — the
state almost every private seller is in, and it must render as such) is the
whole schema footprint. Agencies are different: a CIF is a public business
identifier, so `agencies.tax_id` is stored in full. Full-number capture for
individuals, if it ever becomes necessary, is a founder decision with a
data-processing agreement behind it, tracked as `PLAN.md`'s open decisions —
never add the column speculatively.

## 6. Leads, auth and identity — email-first

The inherited schema assumed WhatsApp-first, phone-as-identity, because that
was correct for Paraguay. It is wrong for Sweden, and every consumer-facing
column flipped:

- `users.email` / `leads.email` are `NOT NULL` (were nullable); `phone` is
  optional (was the required/unique `whatsapp`).
- `otp_codes.destination` (was `whatsapp`) + `channel` (`email | sms`,
  default `email`).
- Delivery goes over **SMTP via nodemailer**, against a Hostinger mailbox on
  the same account the site deploys to, behind the same `crm.ts`-style
  interface the old CRM boundary used — swapping to a transactional provider
  (Resend/Postmark) later is a config/adapter change, not an architecture
  change. In dev with no SMTP configured, delivery falls back to a console
  log, exactly like the old `DevNullCrm`. The one rule that survived
  verbatim: **`sendOtp` never logs or returns a line claiming delivery
  happened when it did not.**
- `CONTACT_EMAIL` remains `string | null` with no fallback (the reasoning —
  never render a compose window to a mailbox nobody owns — is unchanged) but
  is a **launch blocker**: a Swedish consumer portal with no visible email
  address is not credible. Every consumer already null-safe; this is a
  config decision, not a code change.
- `CONTACT_WHATSAPP` still exists, optionally, as the **agency-side**
  channel — Spanish agencies live on WhatsApp even though buyers do not.

## 7. Domain / vertical topology — one door, no `.es`, English is a future decision

`src/config/verticals.ts` has **exactly one entry**:

```ts
export type VerticalKey = "sv";

export const VERTICALS: Record<string, VerticalConfig> = {
  "flyttatillspanien.se": {
    key: "sv",
    brand: "Flytta till Spanien",
    locale: "sv",
    copy: "relocation",
    enabled: true,
    ownsListingDetail: true,
  },
} as const;
```

No disabled Spanish or English entry sits alongside it. The lesson carried
forward from the Paraguay build's own domain history: an unowned domain
appearing in code — even disabled — gets read as a fact and fallback chains
get built on it. `CANONICAL_HOST` defaults to `flyttatillspanien.se`.

**Why not a `.es` door for Spanish agencies?** The thing that looks like a
second audience here is the *supply side* (Spanish agencies vs. Swedish
buyers), not a second buyer audience for one inventory — unlike the old
Paraguay/English two-door shape, which really was two audiences for the same
rows. Listers already have a first-class answer that is not a vertical: the
panel surfaces (`/agencia`, `/publicar`, `/admin`), all single-host. A
Spanish-language agency pitch is a one-page problem (`/for-maklare` on the
`.se` host today; a hand-written `/es/inmobiliarias` sibling is backlog, not
MVP), not a second dictionary, a second `verticals.ts` entry, and a
duplicate-content fight with Idealista on its own turf.

**The genuine future door is English**, not Spanish — Norwegian, Danish,
Finnish and Dutch buyers of Spanish property read English, and that is a
real second audience for the same inventory, the exact shape
`languageAlternates()` already knows how to serve. It stays out of
`verticals.ts` until the domain is bought; until then it lives only as an
open decision in `PLAN.md`. `VerticalConfig.locale` is typed `"sv"` today,
widened to `"sv" | "en"` on the day the entry is added — a file addition,
not a refactor, by design.

`middleware.ts` sets `x-locale: "sv"`; `resolveVertical`,
`DEFAULT_VERTICAL_KEY`, `hostOwnsListingDetail()`, `languageAlternates()`
and `npm run verify:seo` are untouched from the mechanism the Paraguay build
proved — trivially satisfied by one door, and what makes adding a second one
later a safe, mechanical change instead of an SEO incident.

## 8. URL vocabulary and facets — one vocabulary, two files, now in Swedish

`src/lib/facets.ts` (pure — the `ListingFacets` type, `FACET_PARAM`,
`parseFacetParams` / `facetSearchParams`; no `next/*`, no drizzle, because
the filter bar is a client component) and `src/lib/facet-sql.ts`
(`server-only` — `facetConds()`, `verticalConds()`, `publishedFacetWhere()`,
the only place a facet becomes a WHERE clause, and the only place that
knows price filters run on `price_eur`).

Swedish query-string vocabulary:

```
affar        (was operacion)     — kopa | hyra | korttidshyra
typ          (was tipo)
ort          (was ciudad)
omrade       (was barrio)
pris_min / pris_max
sovrum       (was dormitorios)
sortering    (was orden)          — senaste | pris_upp | pris_ner
```

`/propiedad/{slug}` is `/bostad/{slug}`. `agencyUrl()`/`agentUrl()`
deliberately **kept** their Spanish route segments (`/inmobiliaria/{slug}`,
`/agente/{slug}`) — a Phase 3 decision (`KNOWN-ISSUES.md`): the design doc's
handoff only requires the `/bostad` and operation-segment renames, these two
profile routes are not SEO-load-bearing category pages, and moving route
directories buys nothing but redirect risk.

`npm run verify:facets` covers the pure half (parse ∘ build is the identity,
every facet maps to its own real column, every filter value declared in
`verticals.ts` is a real enum member); it runs in the pre-push hook.

## 9. Programmatic SEO

```
/{affar}/{typ}/{ort}                       /kopa/villa/marbella
/bostad/{slug}                             listing detail (canonical)
/for-maklare                               Swedish agency-acquisition pitch
/inmobiliaria/{slug}  /agente/{slug}       supply-side profiles (kept Spanish)
```

The thin-page rule is unchanged in mechanism from the Paraguay build —
single source of truth in `src/lib/indexability.ts`, called by both page
templates and the sitemap generator. Structured data
(`RealEstateListing`/`Offer` in EUR, `BreadcrumbList`, `FAQPage`) is unchanged
in shape, updated for one served locale and the new URL vocabulary.
`languageAlternates()` emits nothing today — one door, no pair to alternate
— and is proven against a synthetic post-flip vertical table by
`npm run verify:seo` so a second door is safe to add later without an SEO
incident.

## 10. i18n — one dictionary, machinery kept for a second

- **`src/i18n/sv.ts`** is the only dictionary; namespaces are `svHome`,
  `svHub`, `svCategory`, `svSearchBar`, `svFilters`, `svCard`, `svListing`,
  `svPrecios`, `svPublish`, `svPanel`, and others carried over from the
  inherited es→en rename (some namespace identifiers keep Spanish-flavoured
  suffixes — `svTasacion`, `svPrecios` — kept mechanical/diffable rather than
  renamed on sight; see `KNOWN-ISSUES.md`).
- **`src/i18n/en.ts` is deleted**, not kept disabled. Keeping it would
  preserve `verify:i18n`'s pairwise-dictionary check, but doubles the cost
  of every copy change for a door no host serves and no domain exists for.
  It is reintroduced as a **file addition** the day the English domain is
  bought, not before — the machinery that makes that possible
  (`Dictionary = Widen<typeof svDictionary>`, the `satisfies` assembly in
  `index.ts`, `dict()` in `server.ts`, `getDictionary(locale)` in
  `index.ts`) is kept even with one locale.
- **`src/i18n/index.ts` must never import `next/headers`**, directly or
  transitively — `SearchBar` and several other client components consume it.
  The request-scoped half lives in `server.ts`.
- `verify:i18n` no longer walks two dictionaries pairwise; with one, it calls
  every copy function with sentinel arguments and asserts that changing an
  argument changes the output — stronger than the pairwise walk, because it
  also catches a function that silently drops an argument in the one
  dictionary that exists.
- Numbers are not copy: `toLocaleString` takes `sv-SE`, derived from the
  request, never from the dictionary.

## 11. Caching

The data cache is still the only cache this portal has — every public route
is `ƒ (Dynamic)` because the root layout reads request-scoped state, so a
route-level `export const revalidate` is dead code, same as before. What
works is `unstable_cache`; tags, TTLs and invalidation helpers live in
`src/lib/cache.ts`.

**New for Spain:** `CACHE_TAGS.fx` / `CACHE_TAGS.acquisitionCosts`, with
`revalidateFx()` / `revalidateAcquisitionCosts()` called from `/admin`'s
manual-override actions. One rule is new and load-bearing:

> For cron-written reference tables (`fx_rates`, `acquisition_costs`), the
> **TTL is the invalidation mechanism**, not a backstop. `npm run cron:fx`
> and `npm run cron:medians` run as separate `tsx` processes; a
> `revalidateTag()` call there cannot reach the running Next server's data
> cache. Pick the TTL to match the upstream publication cadence (`fx`:
> 3600s, ECB publishes once per business day; `acquisitionCosts`: 86 400s,
> a regional budget rarely changes intra-year) — not to match how fast an
> operator expects a save to appear.

Every other tag keeps the rule the Paraguay build already proved:
**every tag has a writer** — `revalidatePath()` does not clear
`unstable_cache` entries — and **dates do not survive the cache boundary**
(a cached query returning a `Date` re-wraps it at the exported wrapper, not
in each consumer).

## 12. Acquisition-cost estimate — what replaced the cuota engine

The Paraguay build's `cuota_gs`/`financing_programs` engine (a French
amortization against a subsidised state mortgage programme) has no Spanish
equivalent worth building at MVP, and the reasoning is recorded as its own
decision in `PLAN.md` (`D-mortgage`) because it keeps getting re-asked. In
short: a **non-resident** Spanish mortgage rate is negotiated per applicant
with no published scale to seed, so any printed quote would be invented; most
Swedish buyers of Spanish property either pay cash or borrow against Swedish
property at Swedish rates.

What fills the slot instead is `src/lib/acquisition-cost.ts` — a pure
function of `(priceEur, acquisitionCosts[region], isNewBuild)` → an itemised
breakdown (ITP or IVA+AJD, notario, registro, gestoría — roughly 10–14% on
top of the asking price) + total, `null` when the region has no active row.
**Computed at render, never cached on a column** — unlike `cuota_gs`, which
existed because computing it needed a per-listing query loop over the
programme set; the Spain figure is a pure function over a seven-row table
that is itself cached, so there is no per-listing query to avoid, and a
cached column would just add a new class of "the cron didn't run and the
card is quoting a superseded ITP rate" bugs for zero gain.

`src/lib/amortization.ts` keeps `frenchAmortization()` verbatim — the pure
12-line function is not Paraguayan, it is unused today, and it is what any
future mortgage or payment-plan feature will need first. **A Spanish
mortgage calculator is backlog, not MVP; do not build a stub around it** —
see `CLAUDE.md`'s backlog list and `PLAN.md`'s `D-mortgage`.

## 13. Import pipeline

Mechanism unchanged from the Paraguay build — one shared planner
(`planImport`/`commitImport`), never a second validation path; every batch
writes `import_jobs`/`import_rows` with `previous_json` for rollback;
permission is a column checked in the server action, not the form; `/admin`
white-glove CSV/XLSX intake and an agency's self-service link import remain
two different products, not two versions of one.

**New for Spain**: when an incoming row carries `referencia_catastral`,
dedup is **exact** on it via `uq_catastral` and the fuzzy path is skipped
entirely. When it is absent, the existing bucketed-phone `dedupKey()` is the
unchanged fallback, `null`-means-do-not-merge rule included — no invented
fallback for the null. XML feed ingestion (Idealista/Fotocasa/Kyero) is
v1.1, through the same planner; MVP intake stays CSV/XLSX.

## 14. CI — local, never GitHub Actions

Unchanged in philosophy: deploys run on Hostinger's build servers via a free,
unmetered webhook; a GitHub Actions workflow here would spend the founder's
shared per-account minutes on a deploy path that never uses them.

- **No files under `.github/workflows/`** — `.githooks/pre-commit` refuses
  to stage them.
- `.githooks/pre-push` runs `typecheck` + `build` + `verify:import` +
  `verify:facets` + `verify:i18n` + `verify:seo` — the same set as
  `npm run verify:local`. The last four are pure (no DB, no network), which
  is why they can live in a hook at all.
- `npm run verify:scopes` stays manual — needs a localhost database, refuses
  to run against anything else.
- Nothing auto-merges; there is no required GitHub status check to gate on.

## 15. Where the build stands

The six-phase rebuild (`plan.md`) has landed Phases 1–4 (schema/config/core
libs, core query/import/auth logic, public pages, admin & agency panels).
Phase 5 (SEO/content/the editorial Swedish pass/this document) is in
progress; Phase 6 (Hostinger deploy) has not started — **the site is not
live**. `PLAN.md` is the living status tracker for what remains, including
the open decisions this document deliberately does not resolve (the English
door's timing, the `D-mortgage` decision, GDPR/privacy review, full NIE/DNI
capture, reviews/ratings).
