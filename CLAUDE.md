# CLAUDE.md — current reality of this project

`ARCHITECTURE.md` is the design contract. **This file is the state of the
world.** Where the two disagree, this file wins.

Last verified against the code: 2026-08-27. The project pivoted from a
Paraguay real-estate portal (`propia.node`) to **flyttatillspanien.se** —
Spanish property, Swedish buyers — on 2026-08-27; `docs/SPAIN-PORTAL-
DESIGN.md` is the decision record for that pivot and the section a Sonnet
implementer worked from to build everything this file now describes as
done. `PLAN.md`'s Paraguay-era decisions (D1–D20 and friends) are kept as
history at the top of that file — they explain why some inherited
machinery looks the way it does, but they are not current instructions.

## Domain — one door, owned and enabled

| Domain | Reality |
| --- | --- |
| `flyttatillspanien.se` | **The only vertical**, `locale: "sv"`, `enabled: true`, `ownsListingDetail: true`. `CANONICAL_HOST` defaults to it. |

`src/config/verticals.ts` has exactly one entry. **Do not add a disabled
English or `.es` entry.** The inherited `propia.com.py` lesson holds
verbatim: an unowned domain in this file becomes a fallback nobody meant to
build, because `resolveVertical()`, `siteOrigin()` and the sitemap all treat
"has an entry" as "is a real door" regardless of `enabled`. The English
door — a real second audience (Norwegian/Danish/Finnish/Dutch buyers of
Spanish property) — is documented as a future decision in
`docs/SPAIN-PORTAL-DESIGN.md` §1 and gets an entry **the day the domain is
bought**, not before.

Consequences that bite, unchanged in shape from the inherited design:

- `siteOrigin()` / `listingCanonicalOrigin()` (`src/lib/origin.ts`) emit
  `PRIMARY_ORIGIN` for any host that is not the enabled vertical — preview
  deploys and `*.hostingersite.com` included.
- `app/sitemap.ts` only lists `/bostad` entries for a host that
  `hostOwnsListingDetail()` — trivially true with one door, but the rule
  stays because it's what makes a second door safe later.
- `npm run verify:seo` checks what a one-door table can prove today
  (unique keys, host-key spelling, brand-name uniqueness, the primary host
  owning its own detail pages) and documents in its header why the old
  Paraguay version's synthetic two-locale hreflang exercise cannot be
  honestly reconstructed until `Locale` actually widens beyond `"sv"`.
- `languageAlternates()` (`src/lib/alternates.ts`) emits nothing today —
  there is only one served locale — and is otherwise untouched from the
  inherited implementation, ready for a second door.

## Brand — the domain is the brand

`brand.ts` / `brand-server.ts` split is unchanged from the inherited
pattern: `brandName()` / `brandMeta()` (`src/lib/brand-server.ts`) are
async, request-scoped, correct on every public page. `BRAND_NAME`
(`src/lib/brand.ts`) is the CANONICAL_HOST's brand resolved once at module
load — correct only on `/admin` and `/agencia` (staff, one host), client
components, and scripts. `brand.ts` must never import `next/headers`,
directly or transitively — `src/i18n/sv.ts` imports it and several client
components import that.

`BRAND_NAME` = "Flytta till Spanien". `BRAND_KICKER` = "Spanien".
`brandTaglineFor("sv")` = "Hitta din bostad i Spanien" — the parameter is
kept (rather than dropped to a bare constant) so a second locale is a
`switch` addition, not a signature change.

The brand suffix on page titles is set once, as `title.template` in
`app/layout.tsx`. A page returns only its own segment; OG titles do not
inherit the template and spell the brand out by hand.

## Currency — EUR is the only stored price

`listings.price_eur` is the sole stored, filtered price column. There is no
`price_amount`/`price_currency` pair and no normalized-second-currency
column (no `price_usd` equivalent) — Spain is a one-currency market, unlike
the inherited Paraguay schema's USD/PYG duality.

- **SEK is never stored.** `formatSek(eur, rate)` (`src/lib/format.ts`)
  computes it at render from the cached `fx_rates` row, rounds to the
  nearest 10 000 kr, and returns `null` — no SEK line at all — when the
  newest rate is older than `FX_MAX_AGE_DAYS` (default 7). A missing SEK
  figure is the acceptable failure mode; a stale-but-shown one is not.
- **`npm run cron:fx`** (`scripts/fetch-fx.ts`) pulls the ECB daily
  reference XML and upserts `fx_rates`. It writes nothing on fetch failure
  — the previous rate stands — and it is the only writer; there is no
  in-request fallback.
- **A visitor's SEK budget converts to EUR once, before `facetConds()`.**
  Never `price_eur * :rate` in a WHERE clause — not sargable, the same class
  of mistake the geo section's F38 audit describes for coalesced
  coordinates.
- `src/lib/queries.ts` exposes `getEurSekRate()` and
  `getAcquisitionCostForRegion()`, both `unstable_cache`-wrapped under
  `CACHE_TAGS.fx` / `CACHE_TAGS.acquisitionCosts`.

## The acquisition-cost engine (replaces the Paraguay cuota engine)

`src/lib/amortization.ts` keeps only `frenchAmortization()`, moved verbatim
from the inherited `cuota.ts` and currently **unused** — there is no
published non-resident mortgage rate scale to seed a quote from, so a
Spanish mortgage calculator is backlog, blocked on a lender partnership
(founder decision). Do not build a stub around it.

What ships instead, in the slot the cuota module occupied on the card and
the detail page:

- **`src/lib/acquisition-cost.ts`** — pure function
  `estimateAcquisitionCost(priceEur, acquisitionCostsRow, isNewBuild)` →
  an itemised breakdown (ITP or IVA+AJD, notary, registry, legal estimate)
  or `null` when the region has no active row. **Computed at render, never
  cached on a listing column** — the seven-row `acquisition_costs` table is
  cached for a day, so there is no per-listing query to avoid the way
  `cuota_gs` avoided one; a cached column would only import "the cron
  didn't run and the card is quoting a stale ITP rate" bugs for nothing.
- **`scripts/seed-acquisition-costs.ts`** seeds exactly the seven
  comunidades in the design doc's handoff table (AN, VC, MC, IB, CN, CT,
  MD) with rates marked **PLACEHOLDER** — verifying them against each
  comunidad's published scale is a research task, not a code task, in the
  same voice as the inherited `seed-financing.ts`'s AFD-rate warning.
- **`CACHE_TAGS.acquisitionCosts`**, TTL 86 400s (a comunidad's tax scale
  changes at most once a year) — cron-owned, TTL-is-the-invalidation, same
  reasoning as `fx` above.

Deleted outright, with no replacement: `financing_programs` table,
`scripts/seed-financing.ts` / `npm run seed:financing`, `listings.cuota_gs`,
`scripts/recompute-cuotas.ts` / `npm run cron:cuotas`, `bestCuota()`,
`FinancingProgram`, `CuotaResult`, `formatCuota()`, `/financiamiento`.

## i18n — Swedish only, machinery kept for a second locale

`src/i18n/sv.ts` is the sole dictionary (renamed from the inherited
`es.ts`; every namespace lost its `es` prefix — `svHome`, `svHub`,
`svCategory`, `svSearchBar`, `svFilters`, `svCard`, `svListing`,
`svPrecios`, `svSiteNotice`, `svPanel`, `svPublish`, `svOwner`,
`svAgentProfile`, plus the bare `sv` namespace and
`inquiryPrefillFor`/`agentInquiryPrefillFor`). `en.ts` is **deleted** at
MVP — a deliberate tradeoff, not an oversight: keeping it would have
preserved `verify:i18n`'s two-dictionary comparison, but doubles the cost of
every copy change for a door no host serves. Re-adding it later is meant to
be a file addition.

- `Locale` (`src/i18n/index.ts`) = `"sv"` only. `DEFAULT_LOCALE = "sv"`.
  `Dictionary = Widen<typeof svDictionary>`. The `Widen<>` machinery and the
  `satisfies` assembly pattern are **kept**, unsimplified, for the same
  reason `en.ts` was cut rather than kept-and-doubled: the whole point is
  that a second dictionary is cheap to add back.
- **Reach strings through the dictionary, never by importing the
  namespace directly** — `dict()` from `@/i18n/server` (async,
  request-scoped, correct on every public page) or `getDictionary(locale)`
  from `@/i18n` (pure, for client components — `SearchBar` is the only
  buyer-facing one — and callers that already hold a locale).
- `src/i18n/index.ts` must never import `next/headers`, directly or
  transitively.
- `scripts/verify-i18n.ts` no longer diffs two dictionaries (there is only
  one). It walks `sv.ts` checking for empty strings and for leftover
  Paraguay/propia.node vocabulary (a regex list: "propia", "paraguay",
  "asunción", "guaraní", "cuota", "US$") — it keeps its exit code and
  general shape so a future second dictionary only has to add the
  side-by-side comparison back, not rebuild the harness.
- Number formatting is `sv-SE` (a thin non-breaking space as the thousands
  separator, comma decimal), derived from the request, never the
  dictionary — "numbers are not copy" holds unchanged from the inherited
  rule.

**The translation direction is inverted from the Paraguay pattern.**
Spanish is authored (it arrives from the agency feed via
`descriptionEs`/`title`, marked `source_lang = 'es'`); Swedish is derived —
except when a Swedish relocation agent writes the listing directly
(`source_lang = 'sv'`). `npm run cron:translate`
(`scripts/translate-listings.ts` + `src/lib/translate.ts`) does the
es→sv work: decided by `listings.translation_hash_sv`, never a form, never
a request-path hook (a publish must not depend on Anthropic being up), and
refuses to run without `ANTHROPIC_API_KEY`, writing nothing rather than a
placeholder. **Unlike the inherited English door, `title_sv`/
`description_sv` ARE read from day one** — the card, detail page and
metadata read `titleSv ?? title`.

## Import pipeline — read before touching intake or dedup

Two intakes, same shape as the inherited design:

| Path | What it is |
| --- | --- |
| `/agencia/importar` | An agent pastes a link to **their own** listing, attests to it, gets a draft. |
| `/admin/importar` | Super-admin uploads an agency's spreadsheet (.csv/.xlsx), previews, commits, can roll the whole batch back. |

Rules that are load-bearing, mostly unchanged in shape:

- **`dedupKey()` still returns `null` when there is no contact phone**, and
  it is still correct for the same reason — bucketed by 5k EUR / 10 m² now,
  not 5k USD.
- **`referencia_catastral`, when present on a raw listing, is the dedup
  key.** `src/lib/import/upsert.ts` checks for an exact match on
  `listings.referencia_catastral` *before* falling into the fuzzy
  `dedupKey()` path, and skips the fuzzy path entirely when a catastral
  reference is present — see the "1.5" step in `planImport()`. Absent a
  catastral reference, dedup falls back to the unchanged fuzzy phone-bucket
  key.
- **`listing_sources.scope_agency_id` is still `NOT NULL DEFAULT 0`** — the
  MySQL-NULLs-in-unique-indexes-are-distinct reasoning is unchanged and
  still load-bearing.
- **Always pass an agency.** Unchanged.
- **The dry run and the commit still share one planner.** Unchanged.
- **The publish gate for `energy_rating` lives in the server action, not
  the form**, and it is enforced in *two* places that both write
  `status: "published"`: `src/lib/listing-edit.ts`'s `updateListing()`
  (admin/agency edit forms) and `src/lib/import/upsert.ts`'s
  `insertListing()` (the importer, forced to `pending_review` when
  `energyRating` is absent even if the caller asked for an immediate
  publish). A listing cannot reach `published` with `energy_rating` NULL —
  RD 390/2021 requires it in the advertisement itself.
- `RawListing` (`src/lib/import/types.ts`) carries the full Spain legal
  block as optional fields (`referenciaCatastral`, `energyRating`,
  `energyEmissions`, `energyKwhM2`, `energyCo2M2`, `legalStatus`,
  `chargesStatus`, `ibiAnnualEur`, `communityMonthlyEur`, `isVpo`,
  `landClassification`, `buildableM2`, `touristLicence`) — most feeds omit
  some of it, and `legalStatus`/`chargesStatus` default to `"desconocido"`
  in the schema when omitted.
- `ListingSource` enum members are
  `manual | fsbo_ads | whiteglove | import_idealista | import_fotocasa |
  import_kyero | import_agency_site | api` — the inherited
  `import_tulugar`/`import_infocasas`/`import_clasipar` (Paraguay portals)
  are gone.

Verify with `npm run verify:import` (pure checks, EUR/Spain fixtures, no
DB). With a local database up it also exercises plan → commit → re-run →
rollback: `docker compose up -d && npm run db:migrate &&
DATABASE_URL="mysql://ftse:ftse@127.0.0.1:3306/ftse" npm run verify:import`

`npm run cron:resync` pauses listings whose sources have gone quiet. `npm
run cron:medians` recomputes `market_medians` in EUR/m².

## Backlog state (verified, not remembered)

1. **R2 image storage** — unchanged from the inherited state: code is
   complete, blocked purely on the founder creating the Cloudflare
   account/bucket and setting `R2_*` env vars. **Do not build around it.**
2. **English door** — not in `verticals.ts`, on purpose (see "Domain"
   above). Gets an entry the day a real second domain is bought, alongside
   widening `Locale` in `src/i18n/index.ts`.
3. **Individual agent profile pages** — done, unchanged in shape
   (`/agente/[slug]`, mirrors `/inmobiliaria/[slug]`).
4. **Reviews/ratings** — does not exist. Needs a migration and a moderation
   design. **Ask the founder before starting.**
5. **Import image pipeline** — not built, on purpose, same reasoning as
   the inherited state: blocked on backlog item 1. `listing_images.r2_key`
   holds the remote source URL as an interim.
6. **Spanish mortgage calculator — not built, on purpose.**
   `frenchAmortization()` in `src/lib/amortization.ts` is the surviving
   half of the Paraguayan cuota engine and is unused. There is no published
   non-resident rate scale to seed, so any quote would be invented. Blocked
   on a lender partnership, which is a founder decision, not a code task.
   What ships instead is the acquisition-cost estimate
   (`acquisition_costs`), which is deterministic and needs no rate feed.
   **Do not build a stub around it.**
7. **Acquisition-cost rates are PLACEHOLDERS.** `scripts/seed-acquisition-
   costs.ts` seeds all seven comunidades with placeholder ITP/IVA/AJD/
   notary/registry/legal percentages. Verifying each against that
   comunidad's published scale is a research task, not a code task, and it
   feeds a money figure printed on every venta listing's detail page.
8. **FSBO loop — half built, on purpose**, unchanged in shape from the
   inherited state: the contact chain (agent → agency → owner) works, the
   seller card labels a private seller "Privatperson", `/admin/leads`
   resolves and forwards owner-routed leads. An FSBO publisher does not get
   an `agents` row. What's still missing is their own inbox — a founder
   decision (see the historical `PLAN.md` D8 for the reasoning); `routed_to`
   has an `owner` lane already and needs no further schema change to ship
   it, only the panel.
9. **Operator alerts are optional and silent when unset.** Unchanged in
   shape: no `LEAD_WEBHOOK_URL` means no alert and no fake one; the
   `/admin` badges are the zero-config signal.
10. **No email address is hardcoded as a fallback anywhere** — unlike the
    Paraguay portal's design (which deliberately had none, for a different
    reason), **this portal needs `CONTACT_EMAIL` set before launch**: Sweden
    is email-first, and a Swedish consumer portal with no email address on
    the contact page is not credible. `CONTACT_WHATSAPP` stays optional —
    the agency-side channel, never the buyer's primary one.
11. **English *data* columns** (`title_en`/`description_en`) do not exist
    on this schema at all — they were dropped along with the rest of the
    Paraguay English-door machinery. When the English door is built, the
    columns are added fresh; nothing to migrate around.
12. **No full NIE/DNI capture** — `users.identity_doc_type` +
    `identity_ref_last4` (last 4 characters only) + `identity_verified_at`
    are deliberately the whole of it. See `docs/SPAIN-PORTAL-DESIGN.md`
    §3.4 for the GDPR/LOPDGDD reasoning. Flag as a founder decision + DPA if
    full capture ever seems necessary; do not add the column.
13. **XML feed ingestion (Idealista/Fotocasa/Kyero)** is v1.1, not built.
    MVP intake is CSV/XLSX through the existing planner; XML goes through
    the *same* planner when it lands, never a second validation path.

## Caching — the data cache is the only cache this portal has

Unchanged in mechanism from the inherited design (every public route is
dynamic, `unstable_cache` is what actually saves query time, every
writer-backed tag needs its `revalidate*()` call, `Date`s don't survive the
cache boundary). What's new:

- **`CACHE_TAGS.fx`** (TTL 3600s) and **`CACHE_TAGS.acquisitionCosts`**
  (TTL 86 400s) are **cron-only tags**: their writers
  (`npm run cron:fx`, `npm run seed:costs`) run as separate `tsx`
  processes, so `revalidateTag()` there cannot reach the running Next
  server's cache. `src/lib/cache.ts`'s header comment states this
  explicitly: for these two, **the TTL is the invalidation mechanism, not a
  backstop** — the writer-has-a-revalidate-call rule that governs every
  other tag does not apply to them, because there genuinely is no
  in-process writer. `revalidateFx()` / `revalidateAcquisitionCosts()` still
  exist, called from the `/admin` manual-override actions (which *are*
  in-process).
- The sitemap split (`src/lib/sitemap.ts` decides *what*,
  `src/lib/sitemap-xml.ts` decides *how*) is unchanged.

## Listing filters — Swedish query-string vocabulary

`FACET_PARAM` (`src/lib/facets.ts`) is Swedish, per the design-doc handoff:

| Facet | Param | Was (Paraguay) |
| --- | --- | --- |
| operation | `affar` | `operacion` |
| propertyType | `typ` | `tipo` |
| city | `ort` | `ciudad` |
| barrio | `omrade` | `barrio` |
| priceMin | `pris_min` | `precio_min` |
| priceMax | `pris_max` | `precio_max` |
| minBedrooms | `sovrum` | `dormitorios` |
| sort | `sortering` | `orden` |

`SortOption` is `"senaste" | "pris_upp" | "pris_ner"`. Path segments:
`/bostad/{slug}` (was `/propiedad`), operation segments
`kopa | hyra | korttidshyra` (was `venta | alquiler | alquiler_temporal`
spelled directly). `src/lib/urls.ts` holds the slug↔enum mapping
(`parseOperation`, `parseTypePlural`) — the DB enum values stay Spanish
(`venta`, `alquiler`, `alquiler_vacacional`, `villa`, `apartamento`,
`atico`, `adosado`, `duplex`, `finca`, `terreno`, `local`), only the URL
vocabulary is Swedish, because Spanish is the language of every agency feed
the importer will ever read.

`facets.ts` stays pure (no `next/*`, no drizzle); `facet-sql.ts` stays
`server-only` and price filtering runs on `price_eur`. `VerticalConfig`
lost `filters.foreign_exposure` along with the column it filtered on —
every listing on this portal is already for a foreign (Swedish) buyer, so
an opt-in flag for foreign exposure has no meaning here.

`npm run verify:facets` covers the pure half with Spain/Sweden fixtures
(villor/marbella/kopa instead of casas/asuncion/venta). It runs in the
pre-push hook.

## Geography — five levels, materialized region key

`locations.level` is `pais | comunidad | provincia | municipio | zona` (five
levels; Paraguay's was four: `pais | departamento | ciudad | barrio`).
`full_slug` is still the URL path only, and it still starts at the
second-from-bottom level for the same reason (no ranking benefit to a
`espana/andalucia/malaga/marbella` URL) — except here that level is
`municipio`, not `ciudad`: a municipio's `full_slug` is its own slug, not
joined onto its province's, and only a `zona` joins onto its municipio.
`resolveCity()`/`resolveBarrio()` (`src/lib/queries.ts`) keep their names
per the handoff's "only rename if it doesn't break unrelated things"
guidance, but compare against the new level values (`municipio`, `zona`)
internally.

`locations.acquisition_region` is new: the comunidad's 2-letter ISO code,
copied down the whole subtree at seed time by `scripts/seed-locations.ts`,
for the same F38 reason display coordinates are materialized rather than
resolved by walking `parent_id` in a query.

`scripts/seed-locations.ts`'s `TREE` covers the coastal comunidades a
Swedish buyer actually looks at: Andalucía (Málaga: Marbella, Estepona,
Mijas, Fuengirola, Benalmádena, Torremolinos, Málaga, Nerja, Manilva;
Almería: Mojácar, Vera, Roquetas de Mar), Comunitat Valenciana (Alicante:
Torrevieja, Orihuela Costa, Alfaz del Pi, Altea, Calpe, Jávea, Dénia,
Guardamar del Segura, Santa Pola), Región de Murcia (San Javier, Los
Alcázares, Cartagena, Mazarrón), Illes Balears (Palma, Calvià, Andratx,
Pollença, Alcúdia, Santanyí), Canarias (Mogán, San Bartolomé de Tirajana,
Adeje, Arona), Catalunya (Lloret de Mar, Roses, Castell-Platja d'Aro,
Barcelona, Sitges), Comunidad de Madrid (Madrid). Zona children are seeded
only for Marbella and Palma — the same "pages only exist where listings
will" rule the inherited Paraguay seed stated.

## Map coordinates — unchanged mechanism, new levels

`display_lat`/`display_lng` materialization (`src/lib/geo.ts`), the F38
sargability reasoning, the `BETWEEN` vs. redundant `IS NOT NULL` index
warning, and the raw-SQL-not-`db.update()` rule for `updatedAt` are all
unchanged from the inherited design — see `ARCHITECTURE.md` §9. Run
`npm run cron:geo` after `npm run seed:locations` or any edit to
`locations.lat/lng`.

## CI — local, never GitHub Actions

Unchanged. `.githooks/pre-push` runs `npm run typecheck`, `npm run build`,
`npm run verify:import`, `npm run verify:facets`, `npm run verify:i18n`,
`npm run verify:seo` — all five are green against the Spain/Sweden schema
and fixtures as of this file's last-verified date. `npm run verify:scopes`
stays manual (needs a localhost database).

## Migrations

Unchanged mechanism: `npm run db:status` before and after
`npm run db:migrate`. `No drift` is the only green.

## Working agreements with the founder

Unchanged from the inherited state:

- **Autonomous build + merge is authorised** for well-verified, low-risk
  work. Zero live users, everything git-revertible.
- **Flag before merging** anything touching auth, payments, or the DB
  schema.
- **Always** `git fetch origin main && git reset --hard origin/main` before
  branching.
- Verify with `npx tsc --noEmit` **and** `npm run build` before merging.
- Branch naming: `claude/<feature-name>`.
