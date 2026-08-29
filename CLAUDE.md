# CLAUDE.md — current reality of this project

`ARCHITECTURE.md` is the design contract. **This file is the state of the
world.** Where the two disagree, this file wins and ARCHITECTURE.md describes
an intention that has not happened yet. Read both before building, and read
`docs/SPAIN-PORTAL-DESIGN.md` too — it is the design pass that turned this repo
from a byte-for-byte copy of `propia.node` (a Paraguay real-estate portal) into
flyttatillspanien.se, and it is the source of truth for *why* every decision
below was made, not just what it is.

Last verified against the code: 2026-08-29 (Phase 5 of the build).

## What this site is

**flyttatillspanien.se** — Spanish property, for Swedish buyers. One domain,
one vertical, `locale: "sv"`. Three kinds of lister sell through it: Spanish
estate agencies (`inmobiliaria`), Swedish relocation intermediaries who
represent the buyer rather than the seller (`relocation`), developers
(`developer`), and private sellers publishing their own listing with no agency
at all (FSBO, `listings.owner_user_id`). The site's whole editorial premise is
surfacing the legal and compliance facts a Spanish buyer reads automatically
and a Swedish buyer has never heard of — see "Legal & compliance block" below.

## Domain — read this before touching `verticals.ts`, `CANONICAL_HOST` or `BRAND_NAME`

`src/config/verticals.ts` has **exactly one entry**, and that is a decision,
not a stub:

| Domain | Reality |
| --- | --- |
| `flyttatillspanien.se` | The only domain, live today, `CANONICAL_HOST` default, `locale: "sv"`, `ownsListingDetail: true`. |

There is no second door, disabled or otherwise, and adding one without first
reading `docs/SPAIN-PORTAL-DESIGN.md` §1 is how the `propia.com.py` mistake
happens again: that lesson (an unowned domain in the code gets read as a fact
and fallback chains get built on it) is why the English door — the one
genuinely worth pre-planning, since Norwegian/Danish/Finnish/Dutch buyers of
Spanish property read English and are a real second audience for the same
inventory — is documented only in `PLAN.md` as a future decision with its own
flip checklist, and is **not** written into `verticals.ts` until the domain is
bought. A `.es` door for Spanish agencies was considered and rejected: it would
duplicate the listing set across two hosts (forcing one to canonicalise
`/bostad` away, the same duplicate-content trap `inmobiliaria.com.py` existed
to demonstrate on the Paraguay portal), double every dictionary change, and
fight Idealista/Fotocasa on their own turf for a benefit that is really a
one-page problem — solved by `/for-maklare` instead.

Consequences that bite:

- `siteOrigin()` / `listingCanonicalOrigin()` in `src/lib/origin.ts` emit
  `PRIMARY_ORIGIN` (= `https://${CANONICAL_HOST}`) for any host that is not an
  `enabled` vertical — preview deploys and `*.hostingersite.com` included.
- `npm run verify:seo` refuses a push where two served doors would own their
  `/bostad` pages in the same language, where two doors share a vertical key,
  or where a host key is spelled in a form `resolveVertical()` never looks up.
  With one door these checks are trivially satisfied; they exist so that
  adding the English door later is a mechanical, safe change rather than an
  SEO incident — do not weaken or bypass them to make a "quick" second entry
  work.
- **hreflang is derived, not hand-maintained.** `languageAlternates()`
  (`src/lib/alternates.ts`) builds a page's language map from `verticals.ts`.
  With one door it emits nothing, correctly — a set is only emitted when two
  doors serve **different locales**. The day the English door is added, this
  starts working with no separate commit.
- `CANONICAL_HOST` is not just an origin string: `verticals.ts` derives
  `DEFAULT` from it, so it decides the locale, filters and copy of every
  request that arrives without a known host.

## Brand — the domain is the brand

There is no separate wordmark. `brand` is per-vertical config
(`"Flytta till Spanien"` today), read through:

- `brandName()` from **`src/lib/brand-server.ts`** — async, request-scoped,
  correct on every public page, in `generateMetadata` and in the component
  body alike. With one door this always resolves to the same string today,
  but use it anyway on public pages — it is what makes the English door a
  no-op change on this front.
- `BRAND_NAME` from **`src/lib/brand.ts`** — the `CANONICAL_HOST`'s brand,
  resolved once at module load. Correct only on `/admin` and `/agencia`
  (staff surfaces reached on one host), in client components, and in scripts.
- `BRAND_KICKER` (`src/lib/brand.ts`) is `"Spanien"` — the small uppercase line
  under the wordmark, deliberately not a name so it stays true on every door.
- `brand.ts` must never import `next/headers`, directly or transitively:
  `src/i18n/sv.ts` imports it and several client components import that.
- Copy that names the brand is brand-parameterised, not constant:
  `brandTaglineFor(locale)` and the copy functions in `src/i18n/sv.ts` that
  take `brand` as an argument. Do not hardcode the brand name into a string
  that also has a parameterised version.

## Currency and FX — EUR is the only stored price, SEK is never stored

**`listings.price_eur`** is the only price column and the only column any
filter or index runs against. There is no `price_sek` column, and there must
never be one: a stored kronor snapshot is correct on the day it is written and
goes stale invisibly (EUR/SEK moved roughly 10% inside 2022–2023), and a card
confidently printing an eighteen-month-old kronor figure is not a rounding
error, it is a lie the site tells with total confidence.

- `src/lib/format.ts` — `formatEur()`, `formatSek(eur, rate | null)` (rounds
  to the nearest 10 000 kr), `formatRateNote(rate, observedOn)`
  (`"EUR/SEK 11,42 · 27 aug 2026"`), `isFxFresh()`. All `sv-SE` formatted
  (U+00A0 thousands separator, comma decimal) — numbers are not copy, this
  locale is derived from the request, never from the dictionary.
- **`fx_rates`** is a two-row-per-day reference table written only by
  `npm run cron:fx` (ECB daily XML, no API key, no rate limit). The app never
  writes to it except through the `/admin` manual-override action
  (`setManualFxRate()` in `src/lib/reference-queries.ts`, which also calls
  `revalidateFx()` — the one in-process writer).
- **Staleness guard**: if the newest `fx_rates` row is older than
  `FX_MAX_AGE_DAYS` (default 7, env-overridable), `formatSek()`/
  `formatRateNote()` return `null` and every SEK line disappears from the
  site. The EUR price is unaffected. A missing SEK figure is a small
  disappointment; a confidently wrong one is a complaint — same rule
  `sendOtp()` follows for delivery claims.
- **SEK filter bounds convert to EUR in the caller, before `facetConds()`.**
  Never `price_eur * :rate` in a WHERE clause — an expression over a column is
  not sargable, the same class of mistake `coalesce(listings.lat,
  locations.lat)` was in the map-coordinates audit below.
- `cron:fx` can fail to reach the ECB feed (this build environment's egress
  proxy 403s it) and is designed to: on fetch failure it writes nothing and
  the previous rate stands, rather than writing a bad or empty row. A silent
  crash would be the actual bug; a graceful skip is the sanctioned outcome.

## Legal & compliance block — the whole editorial premise of the site

A Spanish buyer reads these signals automatically; a Swedish buyer has never
heard of most of them and finds out from a lawyer after paying a reservation
deposit. Surfacing them, honestly, is what makes this portal worth more to a
Swede than Idealista with Google Translate.

- **`referencia_catastral`** — the Catastro's 20-character identifier for the
  physical property. `uniqueIndex("uq_catastral")` **over a nullable column,
  on purpose**: MySQL treats NULLs in a unique index as all-distinct, so most
  listings (no reference) never collide, while any two rows that share a real
  reference *are* the same property. Never "fix" this by making the column
  required or by inventing a fallback for the null case.
- **Import consequence**: when a row carries `referencia_catastral`, dedup on
  it exactly and skip the fuzzy path entirely. When it is absent — which will
  be most rows — fall back to the pre-existing `dedupKey()` (bucketed
  price/area/phone) completely unchanged, including its `null`-means-do-not-
  merge rule. A row with a reference deliberately stores no fuzzy key beside
  it.
- **`energy_rating`** (`A`–`G`, `en_tramite`, `exento`) — Spain's RD 390/2021
  requires the energy rating to appear in *any* advertisement offering a
  property for sale or rent; without it the ad is non-compliant, not merely
  thin. **`src/lib/publish-gate.ts`** enforces this: a listing cannot reach
  `status: "published"` with `energy_rating` NULL. The gate is called from the
  three server-side writers that can make that transition
  (`approveListing()`, `updateListing()`, `commitImport(..., {publish:
  true})`) — **never only in a form**, because the importer is the other
  write path and is where most listings will come from. `draft` and
  `pending_review` are deliberately not gated, so a lister waiting on a
  certificate can still save and submit.
- **`legal_status`** (`escritura_registrada` / `obra_nueva_lpo` / `sin_lpo` /
  `en_regularizacion` / `desconocido`) — the landmine field. A meaningful
  share of coastal and rural Spanish property has no first-occupation licence
  or sits on unlicensed rustic land; `desconocido` is the honest default and
  must never be silently upgraded to "fine".
- **`charges_status`** (the lister's declaration) and **`nota_simple_seen_at`**
  (the portal's own verification, operator-set only, never by the lister) are
  two separate columns on purpose — the UI must say "seller states: free of
  charges — not yet verified by us", never launder a claim into a fact.
- **`ibi_annual_eur`** / **`community_monthly_eur`** — the running-cost
  question Swedish buyers most consistently fail to budget for (a `comunidad`
  fee on a pool-and-garden urbanisation routinely exceeds the annual IBI).
  Both optional, both shown on the detail page when present.
- **`is_vpo`** — price-capped, resale-restricted housing, in practice not
  purchasable by a non-resident foreign buyer. One boolean that heads off a
  category of wasted inquiry.
- **`land_classification`** (`urbano` / `urbanizable` / `rustico`) +
  `buildable_m2` — `terreno`/`finca` only. `rustico` means you very probably
  cannot build a house on it, the single most common misunderstanding in a
  foreign land purchase.
- **`tourist_licence`** — the comunidad's holiday-let registration number
  (VFT/… in Andalucía, VT-… in Valencia); `alquiler_vacacional` ships at MVP
  and the wizard and detail page both carry it. Several comunidades require it
  in the advertisement, and Balearic/Catalan enforcement fines the platform,
  not only the owner.
- **Areas**: `built_m2` (superficie construida) is the **only** faceted,
  indexed, median-eligible area column — a buyer comparing this site to
  Idealista must be comparing the same number. `usable_m2` (superficie útil,
  10–15% smaller, interior only) is display-only. Replaces the old single
  `area_m2`.

## Listers — three kinds, one table, no forked scope machinery

| Lister | Mechanism |
| --- | --- |
| Spanish estate agency (`inmobiliaria`) | `agencies` + `agents` + `agency_invites`, `agencies.kind = "inmobiliaria"` |
| Swedish relocation intermediary | Same mechanism, `agencies.kind = "relocation"` — represents the **buyer**, not the seller, and every seller-card render must label it distinctly rather than blur it into "agency" |
| Developer | `agencies.kind = "developer"`, project-linked listings |
| Private seller (FSBO) | `listings.owner_user_id`, **no `agents` row** — a private seller never lands in the agent directory carrying a professional's trust signal |

`agencies.kind` is a value on the existing enum, not a new table —
`listingScopeWhere()`/`panelScope()` are not forked for `relocation`, and
`npm run verify:scopes` asserts a `relocation`-kind agency is scoped
identically to an `inmobiliaria`-kind one. `agencies.tax_id` +
`tax_id_country` hold a CIF (Spanish company) or a Swedish
organisationsnummer in the same column, disambiguated by country — publicly
filed information, stored in full. `users.identity_doc_type` +
`identity_ref_last4` (last four characters only, never the full number) +
`identity_verified_at` are the equivalent for a private seller: a NIE/DNI is
GDPR Art. 9 / LOPDGDD-sensitive data with no lawful basis to store in full
here, so the portal stores enough to recognise which document is on file and
nothing more, set only by an operator who has sighted it.

**The FSBO inbox is built.** `leads.routed_to` has an `owner` lane (schema
comment: "PLAN.md D8") for a listing with no agent and no agency; any scope's
`getPanelLeads()` includes `owner`-routed leads whenever the WHERE guard
already restricts to that owner's own listings, so a private seller sees their
own leads in the same panel shape an agency does, with no separate build.

## Import pipeline — two intakes, still different products

| Path | What it is |
| --- | --- |
| `/agencia/importar` | An agent pastes a link to **their own** listing, attests to it, gets a draft. |
| `/admin/importar` | Super-admin uploads an agency's spreadsheet (.csv/.xlsx), previews, commits, can roll the whole batch back. |

Everything `propia.node`'s import pipeline established still holds and is
currency/country-independent:

- **`dedupKey()` returns `null` when there is no contact phone, and that stays
  correct** for a row with no `referencia_catastral` either — never invent a
  fallback key for either null.
- **`listing_sources.scope_agency_id` is `NOT NULL DEFAULT 0`, 0 = unscoped.**
  Still load-bearing: MySQL treats NULLs in a unique index as all-distinct, so
  a nullable column would silently switch off the "re-importing the same file
  changes nothing" guarantee.
- **Always pass an agency.** Listings imported without one are unattributable.
- **The dry run and the commit share one planner** (`planImport` /
  `commitImport`) — do not add a second validation path for the catastral
  case or any other.
- Permission to commit an import is a **column**, checked in the server
  action, not the form.

Verify with `npm run verify:import` (pure checks). With a local database up it
also exercises plan → commit → re-run → rollback, with fixtures covering
**both** dedup paths (catastral-exact and phone-bucket fallback):
`docker compose up -d && npm run db:migrate && DATABASE_URL="mysql://ftse:ftse@127.0.0.1:3306/ftse" npm run verify:import`

**Known defect, not caused by this build's own phases**: the rollback
exercise's `updated`-outcome path restores a batch's price update onto more
rows than it changed (six rows instead of three for a three-row fixture).
Confirmed pre-existing across multiple merged phases. Full symptom trace in
`KNOWN-ISSUES.md`; fixing it needs a session with license to touch
`src/lib/import/jobs.ts` (core logic, out of a Sonnet phase's reach).

`npm run cron:resync` pauses listings whose sources have gone quiet (30 days
by default, `--dry` first), recorded as a revertible import job, unchanged in
mechanism.

## Leads, auth & messaging — Sweden is email-first, and Paraguay was not

The inverse of the inherited design: `users.email` and `leads.email` are
`NOT NULL`; phone is optional. `otp_codes` is keyed by `destination` +
`channel` (`email` | `sms`, default `email`). `src/lib/crm.ts` sends OTPs and
transactional mail over SMTP (nodemailer, `SMTP_HOST`/`SMTP_PORT`/
`SMTP_USER`/`SMTP_PASS`/`EMAIL_FROM`), all optional in dev with a
dev-console fallback. **The one rule that outranks the rest, carried forward
verbatim: never log or return a line that says a message was delivered when
it was not.**

WhatsApp has not disappeared — it changed sides. Spanish agencies live on it,
so `CONTACT_WHATSAPP` and `agencies.phone` are the **agency-facing** channel
now, never the buyer's. `CONTACT_EMAIL` (`src/config/contact.ts`) is
`string | null` with **no fallback**, same reasoning as before (a hard-coded
address is a compose window aimed at a mailbox nobody owns), but is now a
**required-before-launch** value, not an optional nicety — a Swedish consumer
portal with no address on its contact page is not credible. Every consumer
already handles `null`.

The outbound operator webhook (`alertOperator()` in `crm.ts`, `LEAD_WEBHOOK_URL`)
is unchanged: optional, silent when unset, with `/admin`'s own badges as the
zero-config signal.

## Backlog state (verified, not remembered)

1. **Spanish mortgage calculator — not built, on purpose.**
   `frenchAmortization()` in `src/lib/amortization.ts` is the surviving half
   of the old Paraguayan cuota engine and is unused. There is no published
   non-resident mortgage rate scale to seed — a non-resident buyer's LTV and
   spread are negotiated per applicant and per bank — so any printed quote
   would be an invention. Blocked on a lender partnership, which is a founder
   decision, not a code task (`PLAN.md`, `D-mortgage`). What ships instead is
   the acquisition-cost estimate (`acquisition_costs`,
   `src/lib/acquisition-cost.ts`), which is deterministic and needs no rate
   feed. **Do not build a stub around it.**
2. **Every `acquisition_costs` rate is a PLACEHOLDER**, `source_url` NULL on
   all seven comunidad rows on purpose (a source link next to an unverified
   number makes the number look verified). These print money figures on every
   detail page. Verifying each comunidad's published ITP/AJD scale and the
   notary/registry/legal estimates is a founder research task, not a code
   task — the same status the old Paraguayan AFD rate had.
3. **R2 image storage** — code is complete (`src/lib/r2.ts`,
   `src/lib/listing-images.ts`, both gate on `isR2Configured()`). Blocked
   purely on the founder creating the Cloudflare account/bucket and setting
   `R2_*` env vars. **Do not build around it or re-implement it.**
4. **Import image pipeline — not built, on purpose.** Imported photos keep the
   remote source URL as an interim `r2_key`; fetching, deduping,
   WebP-converting and resizing them waits on item 3. Do not build a stub.
5. **English door** — `verticals.ts` has one entry and stays that way until
   the domain is bought (see "Domain" above). `PLAN.md` carries the flip
   checklist.
6. **Zone-card photography** (`public/img/zona-{marbella,torrevieja,palma,javea}.webp`)
   is the four inherited Paraguay zone photos, renamed rather than replaced —
   none of them actually depict their Spanish city. Real location photography
   is a founder/content task.
7. **Reviews/ratings** — does not exist. Needs a migration and a moderation /
   anti-fake-review design. Ask the founder before starting.
8. **`registry_number` UI** — the estate-agent registry column exists
   (AICAT-style registers, where a comunidad operates one) but has no
   consumer at MVP; v1.1 per the design doc's MVP/wait table.
9. **Full NIE/DNI capture** — explicitly out of scope; a founder decision plus
   a data-processing agreement, not a schema task.
10. **`inmobiliaria`/`agente` route segments stay Spanish.** `agencyUrl()`/
    `agentUrl()` deliberately still emit `/inmobiliaria/{slug}` and
    `/agente/{slug}` rather than Swedish segments — a decision, not an
    oversight: these are not the SEO-load-bearing category tree, and moving
    them would add redirect risk for no ranking benefit. `/bostad` (the one
    rename the design doc's handoff requires) is done.

## Caching — the data cache is the only cache this portal has

Every public route is `ƒ (Dynamic)`. The root layout reads the `Host` header
for the per-host brand, so no route holds a full route cache and none ever
will without moving the vertical into the URL. An `export const revalidate`
at route level is therefore silently dead — don't add one.

What does work is `unstable_cache` — tags, TTLs and invalidation helpers live
in **`src/lib/cache.ts`**. Two rules:

- **Every tag has a writer** — `revalidatePath()` does NOT clear
  `unstable_cache` entries. A new cached query without a matching
  `revalidateListings()` / `revalidateDirectory()` / `revalidateGuides()` /
  `revalidateFx()` / `revalidateAcquisitionCosts()` call in the actions that
  write it means an operator saves a change and the public page keeps
  showing the old one until the TTL expires — reads as "the save didn't
  work". **One documented exception**: `fx_rates` and `acquisition_costs`
  are also written by out-of-process crons (`cron:fx`; `acquisition_costs`
  only by the in-process `/admin` override) whose `revalidateTag()` calls, if
  any, cannot reach the running server's data cache — for those, **the TTL is
  the invalidation mechanism, not a backstop**. Pick the TTL to match the
  publication cadence of the upstream data (`fx`: 3600s, ECB publishes once a
  business day; `acquisitionCosts`: 86 400s, regional tax scales move with an
  annual budget), not how fast an operator expects a save to appear.
- **Dates do not survive the boundary.** A cached query returning Dates
  re-wraps them in its exported wrapper (see `listFinancingPrograms`'s
  successor readers in `reference-queries.ts` and the `revive*` helpers in
  `post-queries.ts`), not in each consumer.

**The sitemap has two halves and they are not interchangeable.**
`src/lib/sitemap.ts` decides *what* is listed — the half that must agree with
`getIndexability()` and `hostOwnsListingDetail()`. `src/lib/sitemap-xml.ts`
decides how it is served: the hour-long cache every chunk shares, the
10 000-URL chunking, and the XML. It is a route handler rather than Next's
`generateSitemaps()` because that enumerates chunk ids at build time and this
build has no database at build time — the same constraint that keeps every
route dynamic.

## Listing filters — one vocabulary, two files

- **`src/lib/facets.ts`** — pure. `ListingFacets`, the Swedish query-string
  names (`FACET_PARAM`: `affar`, `typ`, `ort`, `omrade`, `pris_min`,
  `pris_max`, `sovrum`, `sortering`), `parseFacetParams` and its inverse. No
  `next/*`, no drizzle — the filter bar is a client component and shares this.
- **`src/lib/facet-sql.ts`** — `server-only`. `facetConds()`, `verticalConds()`
  and `publishedFacetWhere()` — the only place a facet becomes a WHERE
  clause, and the only place that knows price filters run on `price_eur`
  (never a computed SEK expression — see "Currency and FX" above).

Two rules that bite:

- `VerticalConfig.filters` narrows the grid, the count that decides
  indexability, the map pins, the home rails, similar listings and the
  sitemap — ANDed, never merged over the visitor's own choice. No enabled
  vertical declares filters today.
- A cached query that filters by vertical must put the vertical key in its
  cache key, or a mistake here is silent until the day the English door adds
  a second one.

`npm run verify:facets` covers the pure half and runs in the pre-push hook.

## Map coordinates — materialized at write time, never coalesced in a query

Unchanged in mechanism from the pattern this repo inherited, and still
correct: a listing is plotted at its own `lat`/`lng` when it has one and at
its zona/municipio centroid when it does not, in `listings.display_lat` /
`display_lng`, indexed by `idx_geo (status, display_lat, display_lng)`.

- **The rule has one home: `src/lib/geo.ts`.** `syncDisplayCoords(conn, id)`
  runs after any write that touches `lat`, `lng` or `location_id`.
- **Do not put the coalesce back into a query.** `coalesce(listings.lat,
  locations.lat)` in a WHERE is a function of two columns across a join, not
  sargable — the bounding box could not use `idx_geo` and every map pan
  scanned the published set.
- **`display_lat BETWEEN …` already excludes NULL — never add `IS NOT NULL`
  next to it.** The redundant predicate makes MariaDB fall back from `range`
  to `ref` on `status` alone.
- `npm run cron:geo` (`--dry` first) repairs the table and names published
  listings with no position at all. Run it after `npm run seed:locations` or
  any edit to `locations.lat/lng`.

## i18n — one dictionary, `sv`, and that is a decision not a gap

The site is Swedish-only. **`src/i18n/en.ts` was deleted at MVP** (design doc
handoff) rather than kept disabled: keeping a second dictionary preserves
`verify:i18n`'s pairwise check, but doubles the cost of every copy change for
a door no host serves and no domain exists for. The `Widen<>` machinery —
`Dictionary = Widen<typeof svDictionary>`, the `satisfies` assembly in
`index.ts`, `dict()` in `server.ts`, `getDictionary(locale)` in `index.ts` —
is deliberately kept anyway, unused today, because it is what makes
reintroducing `en.ts` a file addition later rather than a refactor.

- **Strings live in `src/i18n/sv.ts`** (~1,600 lines), namespaced (`svHome`,
  `svHub`, `svCategory`, `svSearchBar`, `svFilters`, `svCard`, `svListing`,
  `svPrecios`, `svTasacion`, `svPanel`, `svPublish`, `svProject`,
  `svDeveloper`, `svForMaklare`, and others). **Do not add a new
  visitor-facing literal to a page or component** — add it to the namespace
  and read it back. The namespace identifiers keep their inherited
  Spanish-flavoured suffixes (`svTasacion`, `svPrecios`) rather than being
  renamed to English — a mechanical, diffable rename, not a design choice to
  revisit lightly.
- Reach them through the dictionary, not by importing the namespace directly:
  `dict()` from **`@/i18n/server`** (async, request-scoped, correct on every
  public page and in `generateMetadata`) or `getDictionary(locale)` from
  **`@/i18n`** (pure, for client components, which take `locale` as a prop).
- **`src/i18n/index.ts` must never import `next/headers`**, directly or
  transitively — several client components consume it.
- **`verify:i18n` calls every copy function with sentinel arguments and
  asserts changing an argument changes the output** — stronger than a
  pairwise dictionary walk, and it also catches a function that silently
  drops an argument. It runs in the pre-push hook.
- **The English *data* layer is `cron:translate`, and it is not a hook.**
  `listings.title_sv` / `description_sv` are written only by
  `npm run cron:translate` (inverted to es→sv), decided by
  `listings.translation_hash_sv`, never by a form and never in a request.
  Without `ANTHROPIC_API_KEY` the job refuses to run and writes nothing.
  `title_sv ?? title` (via `src/lib/listing-copy.ts`'s `servedTitle`) is read
  from day one — unlike the old `title_en`, `sv` is a **served** locale — with
  a visible "maskinöversatt från spanska" marker where the Swedish came from
  the cron rather than a human.
- Numbers are not copy: `toLocaleString`/`Intl` calls use `sv-SE`, derived
  from the request, never the dictionary.

## CI — local, never GitHub Actions

Deploys run on Hostinger's build servers; GitHub's whole job is to hold the
code and fire a **webhook**, free and unmetered. Actions minutes bill per
account across every repo, so a workflow here would spend the founder's
shared quota on a deploy path that does not use it.

- **Do not create files under `.github/workflows/`.** `.githooks/pre-commit`
  refuses to stage them. If a task genuinely needs one, state the case and
  stop — explicit yes first.
- The gate that replaces CI is `.githooks/pre-push`: `npm run typecheck`,
  `npm run build`, `npm run verify:import`, `npm run verify:facets`,
  `npm run verify:i18n`, `npm run verify:seo` — same as `npm run verify:local`.
- Hooks install themselves via `prepare` on `npm install`; after a fresh
  clone that skipped scripts, run `npm run hooks:install`.
- `npm run verify:scopes` stays manual — needs a localhost database, refuses
  to run against anything else. Run it on anything touching
  `listingScopeWhere`, `panelScope` or a panel query.
- Because there is no required status check, **nothing auto-merges**.

## Migrations — `db:status` before you fire, and again after

`npm run db:migrate` decides what to run from `__drizzle_migrations`, which
can be wrong in either direction, so the migration list is a proxy. The
question that actually matters is **does this database have what the
deployed code selects** — drizzle names every column of a table in its
`SELECT`, so one missing column is a 500 on every page that reads that table.

`npm run db:status` answers both: the real pending set, and a schema-drift
diff of `src/db/schema.ts` against `information_schema`, naming every missing
table, column and enum value. `--probe` additionally proves an `owner`-lane
lead inserts, inside a transaction it always rolls back. Run it **before
merging any PR that touches `schema.ts`** and **again immediately after
`db:migrate`**. `No drift` is the only green.

Local `DATABASE_URL` is `mysql://ftse:ftse@127.0.0.1:3306/ftse` — the
docker-compose service, DB name and user are all `ftse`, not `propia`.

## Working agreements with the founder

- **Autonomous build + merge is authorised** for well-verified, low-risk work
  (CSS, UI, copy, docs). Zero live users, everything git-revertible.
- **Flag before merging** anything touching auth, payments, or the DB schema.
- **Always** `git fetch origin main && git reset --hard origin/main` before
  branching. Merges happen through the GitHub API, so local `main` goes stale
  and a merged PR can look "missing".
- Verify with `npx tsc --noEmit` **and** `npm run build` before merging;
  Hostinger auto-deploys `main` with no staging environment.
- Branch naming: `phase/<id>` for a phased-build phase (`plan.md`'s own
  numbering); `claude/<feature-name>` for any other ad hoc session.
