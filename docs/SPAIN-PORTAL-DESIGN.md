# flyttatillspanien.se — architecture design

Design-only. No code in this document, and none of it is implemented yet.

**What this repo is right now:** a byte-for-byte copy of `propia.node`, the
Paraguay portal (commit `81503bf`, "Copy propia.node codebase as starting
point"). Every domain, currency, locale, legal field and financing programme
in it is Paraguayan. `CLAUDE.md` in this repo therefore describes *that*
portal, not this one — read it as the pattern library it is, not as a
statement about flyttatillspanien.se. This document is the delta.

**Target:** flyttatillspanien.se — Spanish property, Swedish buyers, multiple
listers (Spanish agencies, private Spanish owners, Swedish relocation
intermediaries).

Four decisions follow, then a handoff section a Sonnet implementer can apply
without re-deciding anything.

---

## 1. Vertical / domain topology

### Recommendation: one enabled vertical, `flyttatillspanien.se`, `locale: "sv"`. No second door at MVP.

The Paraguay two-door shape does not transfer, and the reason is worth being
precise about, because the surface similarity is misleading.

In propia.node the two doors are **two buyer audiences for one inventory**:
`inmobiliaria.com.py` sells to Paraguayans in Spanish, `realestateinparaguay.com`
sells the same rows to foreign buyers in English. Two doors, two locales, one
listing set — which is exactly the case `languageAlternates()` and the
`ownsListingDetail` flag exist to manage, and exactly why `verify:seo` refuses
two same-locale doors that both own `/propiedad`.

Here, the thing that looks like a second door is **the supply side**, not a
second audience. A Spanish agency in Marbella and a Swedish buyer in Uppsala
are not two audiences for the same pages; they are two *roles* against the same
database. This codebase already has a first-class answer for roles, and it is
not a vertical — it is the panel surfaces:

- `/agencia` — agency admin and its agents (`agencies`, `agents`, `agency_invites`)
- `/publicar` — the private-seller (FSBO) funnel, landing on `listings.owner_user_id`
- `/admin` — operator

`CLAUDE.md` already records that these are single-host surfaces: `BRAND_NAME`
from `brand.ts` (the module-load constant, not the request-scoped one) is
documented as *"correct only on `/admin` and `/agencia` — staff surfaces
reached on one host"*. The architecture already assumes listers arrive on one
host. Giving them a domain would fight that assumption for nothing.

### What a `.es` door would actually cost

Spell the tradeoff out plainly, because "add a Spanish door for Spanish
agencies" sounds free and is not:

**Costs**
- A second dictionary (`es.ts`) that must move key-for-key and arity-for-arity
  with `sv.ts` in the same commit, forever, enforced by `verify:i18n`. Every
  copy change doubles.
- Both doors would serve the **same listing rows**, so one of them must ship
  `ownsListingDetail: false` and canonicalise `/propiedad` away — that is the
  duplicate-content trap `inmobiliaria.com.py` exists to demonstrate. The `.es`
  door would launch as a non-indexing shell of category pages.
- A Spanish-language Spanish-property portal is a fight with Idealista and
  Fotocasa on their own turf with zero differentiation. Every ranking signal
  the site can earn comes from being the *Swedish* answer.
- A second brand, a second `verticals.ts` entry to keep invariant-clean, halved
  crawl budget, and a second set of hreflang pairs to get wrong.

**Benefit**
- Spanish agencies see a Spanish-language "list with us" pitch on a `.es`
  address, which feels more legitimate to them than a `.se` address.

That benefit is real but it is a **one-page problem**, and a route on the `.se`
host solves it: `/for-maklare` (Swedish) and `/es/inmobiliarias` (a single
Spanish-language landing page for agency acquisition, outside the dictionary
system, hand-written, `noindex` optional). One page of Spanish copy is not a
vertical.

### The second door that *is* worth pre-planning — and why it stays out of code

The genuine growth door is **English**, not Spanish: Norwegian, Danish, Finnish
and Dutch buyers of Spanish property read English, and that door would be a
real second audience for the same inventory — the exact shape
`realestateinparaguay.com` has, and the shape `languageAlternates()` handles
correctly.

But it does not go in `verticals.ts` yet. `CLAUDE.md`'s hardest-won domain
lesson is the `propia.com.py` one: **a domain that is not owned must not appear
in the code**, not even as a disabled entry, because disabled entries get read
as facts and fallback chains get built on them. So:

- MVP `verticals.ts` has **exactly one entry**.
- The English door is documented in `PLAN.md` as a future decision with its
  flip checklist, and the entry is written **on the day the domain is bought**,
  not before.
- Keep `verify:seo` and `languageAlternates()` untouched. With one door they
  are trivially satisfied; they are the guard that makes adding the second door
  a safe, mechanical change rather than an SEO incident.

### Consequences for the routing layer

- `VerticalKey` becomes `"sv"` (and later `"en"`). `"terreno" | "alquiler" |
  "agents" | "devs" | "inmobiliaria"` are Paraguayan feeder domains — delete.
- `VerticalConfig.locale` becomes `"sv" | "en"`. Spanish is a **source-data**
  language on this portal, never a served locale (see §3, `source_lang`).
- `VerticalConfig.filters.foreign_exposure` is deleted along with the column
  (§3): on this portal every listing is for a foreign buyer, so an opt-in flag
  for foreign exposure has no meaning. `property_type` / `operation` filter
  keys stay — a future `villor.flyttatillspanien.se` would use them.
- `copy` becomes a single member, `"relocation"`. Keep the field; a one-member
  union costs nothing and is where the English door's `"foreign"` variant goes.
- `CANONICAL_HOST` defaults to `"flyttatillspanien.se"`. The
  `DEFAULT = VERTICALS[CANONICAL_HOST] ?? VERTICALS["…"]` fallback stays, and
  the fallback host must be the same single owned host.
- `middleware.ts` sets `x-locale: "sv"`. No change to the mechanism.

---

## 2. Currency and pricing

### Recommendation: EUR is the only stored price. SEK is computed at render from one cached FX rate and is never stored on a listing.

### The price column

propia.node stores three price columns — `price_amount` + `price_currency`
(`USD | PYG`) + `price_usd` (normalised, indexed, *"ALL filtering uses this"*).
That shape exists because Paraguayan listings are genuinely priced in two
currencies and both must be displayed natively.

Spain has one. Collapse to one column:

```
price_eur   decimal(12,2)  NOT NULL      -- the price, and the only filter column
```

Delete `price_amount` and `price_currency`. A one-member `price_currency` enum
is a trap that invites someone to add a second member later without redoing the
filter story. There is no live data here, so this is a clean start, not a
migration.

### Why SEK is not stored

The tempting move is `price_sek` alongside `price_eur`, mirroring `price_usd`.
Reject it, for two independent reasons:

**It goes stale invisibly.** A stored SEK snapshot is correct on the day it is
written and drifts thereafter. EUR/SEK moved roughly 10% inside 2022–2023. A
card printing "3 250 000 kr" against a €285 000 property is not a rounding
error to a buyer budgeting in SEK — it is a lie the site tells with total
confidence, and nothing in the UI can distinguish a fresh snapshot from an
eighteen-month-old one.

**Refreshing it is a full-table rewrite that changes nothing anyone can see.**
A cron rewriting every row's `price_sek` daily would have to go through raw SQL
to dodge `updatedAt`'s `$onUpdate` — precisely the workaround `syncDisplayCoords()`
already documents (*"a recomputation a visitor cannot see must not move a
listing's sitemap `lastmod`"*). Doing that daily, for a number that is
presentational, buys nothing.

**And you do not need it for filtering.** The obvious objection is that a
Swedish buyer filters in SEK ("jag har 3 miljoner"), so the filter column must
be SEK. It must not: convert the *filter bounds* SEK→EUR once, at request time,
in `parseFacetParams`' consumers, and keep filtering on `price_eur`. One
multiplication of two scalars, then a sargable range scan on an indexed column.
The alternative — `price_eur * :rate BETWEEN …` in the WHERE — is not sargable
and is the identical mistake as `coalesce(listings.lat, locations.lat)` in
audit F38: an expression over a column cannot use the index, so every filtered
search scans the published set.

### The FX source and its caching story

**Source: the ECB euro foreign-exchange reference rates.** Free, no API key, no
rate limit, published once per TARGET business day around 16:00 CET, and it is
the rate Swedish banks and Skatteverket themselves reference — which makes it
the defensible number to print next to a property price. Daily XML at
`https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml`.

**Storage:** a two-row reference table, `fx_rates` (§3), written only by
`npm run cron:fx`. Same shape as `financing_programs`: tiny, cron-owned,
read-only to the app.

**Cache — and one honest caveat about the tag rule.** `CLAUDE.md` requires
every cache tag to have a writer, because *"`revalidatePath()` does NOT clear
`unstable_cache` entries"* and a TTL-only tag reads as "the save didn't work".
That rule assumes an in-process writer. `npm run cron:fx` runs as a separate
`tsx` process; `revalidateTag()` there cannot touch the running Next server's
data cache. This is already true of `cron:cuotas` and `cron:medians` today, and
it should be written down rather than papered over:

> For cron-written reference tables (`fx_rates`, `acquisition_costs`), **the TTL
> is the invalidation mechanism**, not a backstop. There is no in-process
> writer and there will not be one. Pick the TTL to match the publication
> cadence of the upstream data, not to match how fast an operator expects a
> save to appear.

So: `CACHE_TAGS.fx = "fx"`, `CACHE_TTL.fx = 3600`. ECB publishes once per
business day; an hour of lag on a once-a-day number is invisible. Add
`revalidateFx()` anyway, exported and called from the `/admin` manual-override
action (below) — that one *is* in-process.

**Dates do not survive the boundary.** `fetched_at` comes back from the cache
as an ISO string, so the exported wrapper re-wraps it, at the wrapper, exactly
as `listFinancingPrograms` and the `revive*` helpers in `post-queries.ts` do —
not in each consumer.

### The staleness guard, which is the part that actually matters

A cached rate can be stale for reasons the app cannot see: ECB is down, the
cron is not installed on the Hostinger box, the XML format changed. The rule,
in the same spirit as `sendOtp` refusing to log a delivery that did not happen
and `bestCuota()` returning `null` so the card omits the line:

> If the newest `fx_rates` row for EUR/SEK is older than **7 days**,
> `formatSek()` returns `null` and every SEK line disappears from the site. The
> EUR price is unaffected. A missing SEK figure is a small disappointment; a
> confidently wrong one is a complaint.

`/admin` shows the current rate, its `observed_on` date, and a manual override
field (writing `source: "manual"`) so the operator is never blocked on a
third-party outage.

### Display rules

- **EUR is the price.** SEK is always an approximation and always marked as
  one: `≈ 3 250 000 kr`.
- Round SEK to the nearest **10 000 kr**. Unrounded SEK reads as a quoted price
  and churns between renders as the rate moves; rounding makes it visibly an
  estimate.
- The detail page prints the rate and its date under the price:
  `EUR/SEK 11,42 · 27 aug 2026`. Cards do not — no room, and the detail page
  carries the disclosure.
- Number formatting uses `sv-SE` (thin non-breaking space as the thousands
  separator, comma decimal), derived from the request locale, not from the
  dictionary — `CLAUDE.md`'s *"numbers are not copy"* rule applies unchanged.
- Nothing in a lead, an inquiry email or an export ever carries SEK alone.

---

## 3. Spain-specific schema

Conventions followed throughout, from `src/db/schema.ts`: snake_case DB names /
camelCase TS keys, `decimal` with explicit precision and scale, `mysqlEnum` for
closed sets, nullable meaning "not applicable or not stated", booleans
`.notNull().default(false)`, `idx_*` / `uq_*` index names, and a comment that
says *why* rather than what.

### 3.1 Listings — replace the Paraguayan columns

**Delete outright:**

| Column | Why |
| --- | --- |
| `cuota_gs` | Guaraní-denominated cached monthly payment for a Paraguayan state programme (§4) |
| `foreign_exposure` | Opt-in to the foreign-buyer door. Every listing here is for a foreign buyer |
| `price_amount`, `price_currency` | Spain is EUR-only (§2) |
| `title_en`, `description_en`, `translation_hash` | Replaced by the Swedish pair below; `en` returns with the English door |

**Change the enums:**

```ts
operation: mysqlEnum("operation", [
  "venta",              // /kopa
  "alquiler",           // /hyra        — long let
  "alquiler_vacacional" // /korttidshyra — holiday let, licence-regulated
]).notNull(),

propertyType: mysqlEnum("property_type", [
  "villa",       // /villa       — chalet independiente
  "apartamento", // /lagenhet
  "atico",       // /takvaning   — penthouse; a distinct price tier in Spain, not a flag on apartamento
  "adosado",     // /radhus
  "duplex",      // /etagelagenhet
  "finca",       // /lantegendom — rural, and the type most likely to carry legal_status problems
  "terreno",     // /tomt
  "local",       // /lokal       — commercial
]).notNull(),

propertyState: mysqlEnum("property_state", [
  "obra_nueva",       // new build, delivered
  "sobre_plano",      // off-plan
  "en_construccion",
  "segunda_mano",     // resale
]),
```

DB values stay in Spanish because that is the language of every agency feed the
importer will ever read; the Swedish URL slugs live in `src/lib/urls.ts`, which
is already the layer that maps slug ↔ enum (`parseOperation`, `parseTypePlural`).
Keeping feed vocabulary and URL vocabulary in one column is how they drift.

**Areas — Spain distinguishes two, and the difference is 10–15%:**

```ts
builtM2:  decimal("built_m2",  { precision: 10, scale: 2 }), // superficie construida — what feeds carry and Idealista shows
usableM2: decimal("usable_m2", { precision: 10, scale: 2 }), // superficie útil — interior, excludes walls and shared area
plotM2:   decimal("plot_m2",   { precision: 12, scale: 2 }), // parcela
yearBuilt: smallint("year_built", { unsigned: true }),
```

`built_m2` is the **only** faceted area column, and the only one that goes into
an index or a m²-median. A buyer comparing this site to Idealista must be
comparing the same number. `usable_m2` is display-only. Replaces PY's
`area_m2` / `land_m2`.

**Localised copy — note the direction has inverted:**

On propia.node, Spanish is authored and English is derived. Here, Spanish
arrives from the agency feed and **Swedish is derived** — except when a Swedish
relocation agent writes the listing themselves, in which case Swedish is the
source. That needs a marker:

```ts
sourceLang: mysqlEnum("source_lang", ["es", "sv"]).notNull().default("es"),
title:         varchar("title", { length: 180 }).notNull(), // in source_lang
descriptionEs: text("description_es"),                      // agency feed copy
titleSv:       varchar("title_sv", { length: 180 }),
descriptionSv: text("description_sv"),
translationHashSv: char("translation_hash_sv", { length: 64 }),
```

`translation_hash` becomes **`translation_hash_sv`**, per target language. The
single unsuffixed column only worked because there was exactly one target;
adding `en` later without the suffix is how a re-translation job either
re-translates everything every night or refreshes nothing. Suffix it now.

`cron:translate` inverts to es→sv and keeps every rule `CLAUDE.md` states about
it verbatim: written only by the cron, never by a form, never in a request,
work decided by the hash, refuses to run without `ANTHROPIC_API_KEY`, and **no
publish-path hook** — a publish must not depend on a third party being up.

The one new rule: `sv` is a **served** locale, unlike `en` on propia.node where
nothing read `title_en` yet. So the card, the detail page and the metadata must
read `title_sv ?? title` from day one, with a visible "maskinöversatt från
spanska" marker where the Swedish came from the cron rather than from a human.
A machine translation presented as the agency's own words is a trust problem
the moment one is wrong about a room count.

### 3.2 Listings — the Spain legal block

This is the block that makes the portal worth more to a Swede than Idealista
with Google Translate.

**Referencia catastral — the single highest-value field on the listing.**

```ts
referenciaCatastral: char("referencia_catastral", { length: 20 }),
// The Catastro's 20-char identifier for the physical property. Government-issued
// and globally unique, which makes it three things at once: the strongest
// anti-fraud signal on the portal, a link target into Sede Catastro, and an
// EXACT dedup key that needs none of dedupKey()'s bucketing guesswork.
```

with `uniqueIndex("uq_catastral").on(t.referenciaCatastral)`.

The unique index over a nullable column is deliberate and relies on the exact
MySQL behaviour `CLAUDE.md` warns about elsewhere: **NULLs in a unique index
are all-distinct**. On `listing_sources.scope_agency_id` that behaviour was a
hazard, which is why the column is `NOT NULL DEFAULT 0`. Here it is precisely
what is wanted — many listings will have no cadastral reference and must not
collide, while any two that share one *are* the same property. State this in
the column comment so nobody "fixes" it in either direction.

**Import consequence:** when `referencia_catastral` is present, dedup on it
exactly and skip the fuzzy path entirely. When it is absent, fall back to
`dedupKey()`'s existing bucketed phone key — including its `null`-means-do-not-
merge rule, which stays untouched. Do not invent a fallback for the null.

**Energy certificate — legally mandatory in the advertisement itself.**

```ts
energyRating:   mysqlEnum("energy_rating", ["A","B","C","D","E","F","G","en_tramite","exento"]),
energyEmissions: mysqlEnum("energy_emissions", ["A","B","C","D","E","F","G"]),
energyKwhM2: decimal("energy_kwh_m2", { precision: 7, scale: 2 }),
energyCo2M2: decimal("energy_co2_m2", { precision: 7, scale: 2 }),
```

Spain's RD 390/2021 requires the energy rating to appear in any advertisement
offering a property for sale or rent. This is not a nice-to-have field; without
it the ad is non-compliant. So it gets a **publish gate**: a listing cannot
move to `status: "published"` with `energy_rating` NULL — `en_tramite`
(certificate applied for) and `exento` (exempt: listed buildings, some rural,
under-50m²) are valid answers, but silence is not.

Put that gate **in the server action, not the form** — the same placement and
the same reasoning as `commitImportAction`'s permission check. A form-only
check is bypassed by the importer, and the importer is where most listings will
come from.

**Legalisation status — the landmine field.**

```ts
legalStatus: mysqlEnum("legal_status", [
  "escritura_registrada", // deeded and recorded in the Registro de la Propiedad
  "obra_nueva_lpo",       // new build holding a licencia de primera ocupación
  "sin_lpo",              // built, no first-occupation licence
  "en_regularizacion",    // AFO/DAFO or equivalent under way (common on Andalucían rustic)
  "desconocido",          // the lister did not state it — the honest default, never a silent "fine"
]).notNull().default("desconocido"),
```

A meaningful share of coastal and rural Spanish property lacks a first-
occupation licence or sits on unlicensed rustic land. A Spanish buyer reads the
signals; a Swedish buyer has no idea the category exists and finds out from a
lawyer after paying a reservation deposit. Surfacing this is close to the whole
editorial premise of the site, and `desconocido` as the default means the site
never implies a clean status it has not been told about.

**Charges and encumbrances:**

```ts
chargesStatus: mysqlEnum("charges_status", [
  "libre_de_cargas", "con_hipoteca", "con_cargas", "desconocido",
]).notNull().default("desconocido"),
notaSimpleSeenAt: datetime("nota_simple_seen_at"),
// NULL = nobody at the portal has sighted a nota simple. Set by an operator,
// never by the lister: it is the portal's own attestation, and its whole value
// is that a lister cannot set it.
```

`charges_status` is the **lister's declaration**; `nota_simple_seen_at` is the
**portal's verification**. Keeping them as two columns rather than one enum is
the point — it is the same separation as `is_verified` vs a self-reported
field, and it is what lets the UI say "seller states: free of charges — not yet
verified by us" instead of laundering a claim into a fact.

**Running costs — the "what does it cost to own" question:**

```ts
ibiAnnualEur:        decimal("ibi_annual_eur", { precision: 9, scale: 2 }),
communityMonthlyEur: decimal("community_monthly_eur", { precision: 9, scale: 2 }),
```

IBI is the annual municipal property tax; `comunidad` is the monthly community
fee, which on an urbanisation with a pool and gardens routinely exceeds the IBI
and is the cost Swedish buyers most consistently fail to budget for. Both
optional, both prominent on the detail page when present.

**Price-capped housing and land classification:**

```ts
isVpo: boolean("is_vpo").notNull().default(false),
// Vivienda de Protección Oficial: price-capped, resale-restricted, and in
// practice not purchasable by a non-resident foreign buyer. One boolean that
// prevents a category of wasted inquiry.

landClassification: mysqlEnum("land_classification", ["urbano","urbanizable","rustico"]),
buildableM2: decimal("buildable_m2", { precision: 12, scale: 2 }),
// terreno / finca only. `rustico` means you very probably cannot build a house
// on it, which is the single most common misunderstanding in a foreign land purchase.
```

**Holiday-let licence — only if `alquiler_vacacional` ships at MVP:**

```ts
touristLicence: varchar("tourist_licence", { length: 40 }),
// The comunidad's registration number (VFT/… in Andalucía, VT-… in Valencia).
// Several comunidades require it in the advertisement, and Balearic/Catalan
// enforcement fines the platform, not only the owner.
```

### 3.3 Listers — three types, one table, one new enum

The three lister types map onto machinery that already exists, and forking it
would fork `listingScopeWhere` / `panelScope` — which `CLAUDE.md` singles out
as needing `verify:scopes` against a real database. Do not fork it.

| Lister | Existing mechanism |
| --- | --- |
| Spanish agency (inmobiliaria) | `agencies` + `agents` + `agency_invites` |
| Private owner (particular) | `listings.owner_user_id`, the FSBO lane — **no `agents` row**, exactly as PY documents, so a private seller never lands in the agent directory carrying a professional's trust signal |
| Swedish relocation intermediary | **new**: an `agencies` row with `kind: "relocation"` |

The third type is the only genuinely new one, and it is a *kind of agency*, not
a new entity: it has staff, a profile page, listings it represents, leads
routed to it, and a panel. One enum column buys the whole apparatus.

```ts
// agencies
kind: mysqlEnum("kind", ["inmobiliaria","relocation","developer"])
  .notNull().default("inmobiliaria"),
// `relocation` = a Swedish-facing intermediary who is not the property's selling
// agent. Materially different to a buyer — they represent the buyer's side and
// earn from the introduction — so the seller card must label it, not blur it
// into "agency".

countryCode: char("country_code", { length: 2 }).notNull().default("ES"),
taxId:       varchar("tax_id", { length: 20 }),
// CIF/NIF for a Spanish company, organisationsnummer for a Swedish AB. One
// column, disambiguated by tax_id_country — a per-country column set would be
// three columns of which two are always NULL.
taxIdCountry: char("tax_id_country", { length: 2 }),
registryNumber: varchar("registry_number", { length: 40 }),
// Estate-agent registry number where the comunidad operates one (AICAT in
// Catalonia, the Madrid and Andalucía registries). NULL is correct and common:
// most of Spain has no mandatory registration, so absence is not a red flag
// and the UI must not render it as one.
```

### 3.4 The NIE/DNI question — a deliberate non-column

**Do not add a full NIE/DNI column for private sellers.**

A NIE or DNI is a national identification number, which under GDPR Art. 9 /
Spanish LOPDGDD is data whose collection needs a documented lawful basis and a
retention policy. The portal's actual need is "is this person who they say they
are", which the number does not answer — the *document check* does, and that is
a one-time act, not a stored value. The number is genuinely required at the
escritura, and that is the notary's job under their own legal basis, not the
portal's.

```ts
// users
identityDocType:     mysqlEnum("identity_doc_type", ["nie","dni","passport","personnummer"]),
identityRefLast4:    char("identity_ref_last4", { length: 4 }),
// Last four characters only — enough for the user to recognise which document
// is on file and for an operator to match a support call. Never the full number.
identityVerifiedAt:  datetime("identity_verified_at"),
// Set by an operator who sighted the document. NULL = unverified, which is the
// state almost every private seller is in and must be rendered as such.
```

Agencies are different: a CIF is a public business identifier, published in
company filings, and storing it in full is normal and expected. Hence
`agencies.tax_id` in full, `users` masked.

If full-number capture ever becomes necessary, it is a founder decision with a
data-processing agreement behind it — flag it, do not add the column.

### 3.5 Reference tables

**FX rates** — the §2 store. Shaped like `financing_programs`: tiny,
cron-owned, read-only to the app.

```ts
export const fxRates = mysqlTable("fx_rates", {
  base:  char("base",  { length: 3 }).notNull(), // 'EUR'
  quote: char("quote", { length: 3 }).notNull(), // 'SEK'
  rate:  decimal("rate", { precision: 12, scale: 6 }).notNull(),
  observedOn: date("observed_on", { mode: "string" }).notNull(),
  // mode "string": an ECB reference date is 'YYYY-MM-DD', a publication day and
  // not an instant. Same reasoning as listing_views_daily.day — mapping it to a
  // Date invites a timezone bug in a column that has no time in it.
  source:    mysqlEnum("source", ["ecb","manual"]).notNull().default("ecb"),
  fetchedAt: datetime("fetched_at").notNull(),
}, (t) => [primaryKey({ columns: [t.base, t.quote] })]);
```

**Acquisition costs** — occupies the slot `financing_programs` vacates (§4).
Per comunidad autónoma, because ITP is set regionally and ranges from 6% to 10%
on the same purchase.

```ts
export const acquisitionCosts = mysqlTable("acquisition_costs", {
  region: char("region", { length: 2 }).primaryKey(), // ISO-3166-2:ES subdivision: 'AN','VC','CT','MD','IB','CN','MC'
  name:   varchar("name", { length: 80 }).notNull(),  // 'Andalucía'
  itpPct: decimal("itp_pct", { precision: 5, scale: 2 }).notNull(),  // resale transfer tax
  ivaPct: decimal("iva_pct", { precision: 5, scale: 2 }).notNull().default("10.00"), // new build, state-set
  ajdPct: decimal("ajd_pct", { precision: 5, scale: 2 }).notNull(),  // stamp duty, new build only, regional
  notaryPctEst:   decimal("notary_pct_est",   { precision: 5, scale: 2 }).notNull(),
  registryPctEst: decimal("registry_pct_est", { precision: 5, scale: 2 }).notNull(),
  legalPctEst:    decimal("legal_pct_est",    { precision: 5, scale: 2 }).notNull(),
  effectiveFrom: date("effective_from").notNull(),
  sourceUrl: varchar("source_url", { length: 400 }), // the comunidad's published scale — the reader must be able to check us
  active:    boolean("active").notNull().default(true),
  updatedAt: datetime("updated_at"),
});
```

**Seed rates ship as PLACEHOLDERS**, marked exactly as `seed-financing.ts`
marks its AFD rate, with the same warning in the same place: these numbers
print money figures on every card, and verifying them against each comunidad's
published scale is a research task, not a code task.

**Locations get a materialised region key:**

```ts
// locations
acquisitionRegion: char("acquisition_region", { length: 2 }),
// The comunidad autónoma this node belongs to, copied down the tree at seed
// time. Materialised rather than resolved by walking parent_id, for the F38
// reason: a tree walk (or a self-join) inside a query is not sargable and would
// put a recursive lookup in the path of every listing render.
```

### 3.6 Locations hierarchy

Spain has five natural levels against Paraguay's four:

```ts
level: mysqlEnum("level", ["pais","comunidad","provincia","municipio","zona"]).notNull(),
```

**`full_slug` stays the URL path — `municipio[/zona]` — not the full ancestry.**
`comunidad` and `provincia` are grouping and tax-resolution levels that live in
`parent_id`; putting them in `full_slug` would produce
`espana/andalucia/malaga/marbella/nueva-andalucia` as a public URL for no
ranking benefit and a lot of ugliness. The `idx_slug` on `(slug, level)` that
`resolveCity`/`resolveBarrio` already use resolves a municipio by bare slug
unchanged; only the seed script's `joinSlug` call changes, to start joining at
`municipio`.

### 3.7 Leads and identity — Sweden is email-first, and Paraguay is not

Worth stating explicitly because the inherited schema encodes the opposite
assumption. `leads.whatsapp` is `NOT NULL`; `users.whatsapp` is the unique
identity and the OTP channel; `CLAUDE.md` records that the portal has *no
email address on purpose* and that the contact channels are the on-site form
and WhatsApp.

Every part of that is correct for Paraguay and wrong for Sweden. A Swedish
buyer will fill in a form and expect an email reply; being asked to WhatsApp a
stranger about a €400 000 purchase reads as unserious. Spanish *agencies*, on
the other hand, live on WhatsApp — so the channel does not disappear, it moves
from being the buyer's channel to being the agency's.

```ts
// leads
email: varchar("email", { length: 190 }).notNull(),      // was nullable
phone: varchar("phone", { length: 30 }),                 // was `whatsapp`, NOT NULL

// users
email: varchar("email", { length: 190 }).notNull().unique(),  // was nullable
phone: varchar("phone", { length: 30 }),                      // was `whatsapp`, unique
locale: mysqlEnum("locale", ["sv","en","es"]).notNull().default("sv"),
// `es` is here for a Spanish agency's PANEL, not for a public door. Not wired
// to a switcher at MVP; the panel is Swedish and English.

// otp_codes
destination: varchar("destination", { length: 190 }).notNull(), // was `whatsapp`
channel: mysqlEnum("channel", ["email","sms"]).notNull().default("email"),
```

And: **`CONTACT_EMAIL` becomes a real, required value before launch.** The
`string | null` no-fallback design stays — the reasoning behind it (never
render a compose window to a mailbox nobody owns) is sound — but a Swedish
consumer portal with no email address on the contact page is not credible.
Every consumer already handles `null`, so this is a config decision, not code.

### 3.8 MVP vs. wait

| Field | MVP | Wait |
| --- | --- | --- |
| `price_eur`, `built_m2`, `usable_m2`, `plot_m2`, `year_built` | ✅ | |
| `energy_rating` + publish gate | ✅ legally required in the ad | |
| `energy_emissions`, `energy_kwh_m2`, `energy_co2_m2` | ✅ cheap, arrive in the same feed field | |
| `referencia_catastral` + `uq_catastral` | ✅ it is the dedup key | |
| `legal_status` | ✅ the editorial premise | |
| `ibi_annual_eur`, `community_monthly_eur` | ✅ | |
| `is_vpo` | ✅ one boolean | |
| `land_classification`, `buildable_m2` | ✅ if terreno/finca ship at MVP | |
| `charges_status`, `nota_simple_seen_at` | ✅ (declaration + verification pair) | |
| `source_lang`, `title_sv`, `description_sv`, `translation_hash_sv` | ✅ | |
| `agencies.kind` / `tax_id` / `tax_id_country` / `country_code` | ✅ | |
| `users.identity_*` | ✅ columns; the verification *flow* can be manual | |
| `agencies.registry_number` | | v1.1 — nullable, no consumer at MVP |
| `tourist_licence` | | only if `alquiler_vacacional` ships |
| `basura_annual_eur` | | v1.1 — small, and rarely in feeds |
| Modelo 210 / plusvalía / non-resident tax modelling | | editorial content, not columns |
| Full NIE/DNI capture | | founder decision + DPA, not a schema task |
| Nota simple / escritura document **storage** | | needs R2 (backlog item 1) and a retention policy |
| Reviews / ratings | | inherited backlog item — still needs a founder decision |

---

## 4. The cuota engine

### Verdict: keep the maths and the shape, delete the programme layer, and a Spanish mortgage calculator is **backlog, not MVP**.

### Keep

**`frenchAmortization()` verbatim.** `P·r / (1 − (1+r)^−n)` is not Paraguayan.
It is 12 lines, pure, has no dependency on anything, and any future mortgage or
payment-plan feature needs exactly it. Move it to `src/lib/amortization.ts` and
leave it there unused rather than deleting and rewriting it later.

**The architectural shape, which is the genuinely valuable inheritance:**

1. A tiny, cron-owned reference table of rates, seeded from a script that is
   idempotent by primary key and shouts that its numbers are placeholders.
2. A pure function over `(price, reference rows)` returning a result object or
   `null`.
3. **`null` means the UI omits the line entirely** — never a zero, never a
   "contact us for financing". `bestCuota()` returning `null` when no programme
   fits is the cleanest small decision in the inherited codebase.
4. An `active` flag so the operator can switch a whole quoting behaviour off
   without a deploy — the mechanism that let Che Róga Porã be withdrawn
   site-wide in two commands.
5. The **"cache it if the computation needs a query, compute it if it does
   not"** discipline.

Point 5 is where Spain diverges, and it is worth being explicit so nobody
cargo-cults the cached column. `cuota_gs` exists because computing it requires
selecting the programme set and looping it per listing, and doing that on every
card render is a query per card. The Spain acquisition-cost figure is a pure
function of `price_eur × acquisition_costs[region] × (obra_nueva | segunda_mano)`
over a **seven-row table that is cached forever**. There is no per-listing query
to avoid. So:

> **Compute the acquisition-cost figure at render. Do not add a cached column.**
> The precedent for `cuota_gs` does not transfer, and a cached column would
> import the entire class of "the cron did not run and the card is quoting a
> superseded ITP rate" bugs for no gain.

The one thing that *is* materialised is `locations.acquisition_region` (§3.5) —
because resolving it otherwise means walking the location tree inside a query,
which is the F38 mistake in a different costume.

### Delete outright

| Thing | Why |
| --- | --- |
| `financing_programs` table | Paraguayan state programmes |
| `scripts/seed-financing.ts` and `npm run seed:financing` | Che Róga Porã / AFD Mi Primera Vivienda are MUVH/AFD instruments |
| `listings.cuota_gs` and `scripts/recompute-cuotas.ts` / `npm run cron:cuotas` | Guaraní-denominated cached payment |
| `bestCuota()`, `FinancingProgram`, `CuotaResult` | Their fields are `maxAmountGs`, `monthlyGs`, `financedGs`, `downPaymentGs` — the currency is in the type names, which is a signal that they are not portable |
| `formatCuota()` (`"Gs 2,1 M/mes"`) | Guaraní millions formatting |
| `/financiamiento` page, `listFinancingPrograms`, the cuota line on `ListingCard` | Programme-specific surfaces |
| `esPrecios.methodBody`, the cuota strings in `esCard`/`esListing` | Copy about Paraguayan programmes |

Also delete the inherited backlog items that only exist because of this engine:
CLAUDE.md items **6** (AFD rate verification) and **7** (Che Róga Porã
`active: false` and per-project opt-in). Neither has a Spanish counterpart.

### Why a Spanish mortgage calculator is backlog, not MVP

Not merely "we are short on time" — it is genuinely worth less here than the
cuota engine was there:

- In Paraguay the state programme *was* the differentiator: a subsidised rate
  most sellers did not advertise, quotable from public terms, and the single
  reason a card outperformed a competitor's card.
- In Spain, a **non-resident** buyer gets roughly 60–70% LTV against a
  resident's 80%, at a spread that is negotiated per applicant and per bank.
  There is no published scale to seed. Any number the portal printed would be
  an invention.
- Most Swedish buyers of Spanish holiday property either pay cash or borrow
  against Swedish property at Swedish rates — a Spanish mortgage quote is not
  the number they are working with.
- The number they *are* blindsided by is **total acquisition cost**: ITP or
  IVA+AJD, notario, registro, gestoría and a lawyer add roughly **10–14% on top
  of the asking price**, varying by comunidad. A Swede who has only ever bought
  a Swedish bostadsrätt (where the acquisition tax is essentially nil) does not
  know this category exists.

So the slot the cuota engine occupied — the deterministic money figure on the
card that no competitor prints — is filled by the acquisition-cost estimate,
not by a mortgage payment. It is cheaper (seven seeded rows, no rate feed, no
FX, no staleness beyond the annual regional budget), more accurate, and closer
to the reason the site exists.

**A mortgage calculator returns when there is a lender partner**, because at
that point there is a real rate to quote and a real referral to earn — and that
is a business decision about partnerships, not an engineering one.

### Where to flag it

Two places, both of which this design assumes get rewritten for Spain anyway:

1. **`CLAUDE.md`, "Backlog state (verified, not remembered)"** — as a numbered
   item, in the same voice as the existing ones, saying what exists, what does
   not, and what unblocks it:

   > **N. Spanish mortgage calculator — not built, on purpose.**
   > `frenchAmortization()` in `src/lib/amortization.ts` is the surviving half
   > of the Paraguayan cuota engine and is unused. There is no published
   > non-resident rate scale to seed, so any quote would be invented. Blocked
   > on a lender partnership, which is a founder decision, not a code task.
   > What ships instead is the acquisition-cost estimate (`acquisition_costs`),
   > which is deterministic and needs no rate feed. **Do not build a stub
   > around it.**

2. **`PLAN.md`, as a new lettered decision** (the file's existing D6/D8/D11
   convention) — `D-mortgage: lender partnership before mortgage quoting`,
   recording the reasoning above so it is not re-litigated every time someone
   notices Idealista has a payment slider.

---

## Handoff to Sonnet

Concrete decisions, ready to apply. Everything below is decided; none of it
needs re-deriving.

### Config

**`src/config/verticals.ts`** — replace the whole `VERTICALS` map with exactly
one entry. Do not add a disabled English or `.es` entry; the founder does not
own those domains, and `CLAUDE.md`'s `propia.com.py` lesson is that an
unowned domain in the code becomes a fallback nobody meant to build.

```ts
export type VerticalKey = "sv";

export interface VerticalConfig {
  key: VerticalKey;
  locale: "sv";                       // widen to "sv" | "en" when the English door is bought
  brand: string;
  filters?: { property_type?: string[]; operation?: string[] };  // foreign_exposure is deleted
  mode?: "portal" | "directory";
  copy: "relocation";
  enabled: boolean;
  ownsListingDetail: boolean;
}

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

export const CANONICAL_HOST =
  process.env.NEXT_PUBLIC_CANONICAL_HOST ?? "flyttatillspanien.se";

const DEFAULT =
  VERTICALS[CANONICAL_HOST] ?? VERTICALS["flyttatillspanien.se"];
```

Keep `resolveVertical`, `DEFAULT_VERTICAL_KEY`, `hostOwnsListingDetail()`,
`languageAlternates()` and `npm run verify:seo` exactly as they are. They are
trivially satisfied by one door and they are what makes adding the second one
safe later.

### Environment variables

| Var | Value / note |
| --- | --- |
| `NEXT_PUBLIC_CANONICAL_HOST` | `flyttatillspanien.se` |
| `USD_TO_PYG` | **delete** |
| `FX_MAX_AGE_DAYS` | `7` — SEK display disappears past this |
| `ANTHROPIC_API_KEY` | unchanged; now drives es→sv |
| `CONTACT_EMAIL` | must be set before launch (Sweden is email-first) |
| `CONTACT_WHATSAPP` | optional; agency-side channel, not the buyer's |
| `R2_*` | unchanged, still blocked on the Cloudflare account |

### Schema — `src/db/schema.ts`

**`listings` — delete:** `cuota_gs`, `foreign_exposure`, `price_amount`,
`price_currency`, `title_en`, `description_en`, `translation_hash`, `area_m2`,
`land_m2`.

**`listings` — add / change:**

```
price_eur              decimal(12,2)  NOT NULL
source_lang            enum('es','sv') NOT NULL DEFAULT 'es'
title_sv               varchar(180)   NULL
description_sv         text           NULL
translation_hash_sv    char(64)       NULL
built_m2               decimal(10,2)  NULL      -- the only faceted area column
usable_m2              decimal(10,2)  NULL
plot_m2                decimal(12,2)  NULL
year_built             smallint unsigned NULL
referencia_catastral   char(20)       NULL      -- UNIQUE uq_catastral
energy_rating          enum('A','B','C','D','E','F','G','en_tramite','exento') NULL
energy_emissions       enum('A','B','C','D','E','F','G') NULL
energy_kwh_m2          decimal(7,2)   NULL
energy_co2_m2          decimal(7,2)   NULL
legal_status           enum('escritura_registrada','obra_nueva_lpo','sin_lpo','en_regularizacion','desconocido') NOT NULL DEFAULT 'desconocido'
charges_status         enum('libre_de_cargas','con_hipoteca','con_cargas','desconocido') NOT NULL DEFAULT 'desconocido'
nota_simple_seen_at    datetime       NULL      -- operator-set only
ibi_annual_eur         decimal(9,2)   NULL
community_monthly_eur  decimal(9,2)   NULL
is_vpo                 boolean        NOT NULL DEFAULT false
land_classification    enum('urbano','urbanizable','rustico') NULL
buildable_m2           decimal(12,2)  NULL
tourist_licence        varchar(40)    NULL      -- only if alquiler_vacacional ships
```

**`listings` enums — replace:**

```
operation      enum('venta','alquiler','alquiler_vacacional')
property_type  enum('villa','apartamento','atico','adosado','duplex','finca','terreno','local')
property_state enum('obra_nueva','sobre_plano','en_construccion','segunda_mano')
```

**`listings` indexes:** everywhere `price_usd` appears in an index, use
`price_eur`. Add `uniqueIndex("uq_catastral").on(t.referenciaCatastral)`.
`idx_search`, `idx_recent`, `idx_location`, `idx_geo`, `idx_agency`,
`idx_project`, `idx_fresh`, `idx_home_row` keep their column order and their
comments — the F38 reasoning is currency-independent.

**`locations`:**

```
level              enum('pais','comunidad','provincia','municipio','zona')  -- was 4 levels
acquisition_region char(2) NULL   -- comunidad ISO code, copied down the tree at seed time
guide_content_es → guide_content_sv    (and guide_content_en dropped for now)
```
`full_slug` continues to be the **URL path only** — `municipio[/zona]`. Change
`joinSlug` in the seed to start at municipio; leave `idx_slug` on
`(slug, level)` alone.

**`agencies`:**

```
kind            enum('inmobiliaria','relocation','developer') NOT NULL DEFAULT 'inmobiliaria'
country_code    char(2)     NOT NULL DEFAULT 'ES'
tax_id          varchar(20) NULL
tax_id_country  char(2)     NULL
registry_number varchar(40) NULL
whatsapp → phone (varchar 30)
plan  enum('free','destacado','partner') → enum('free','premium','partner')
```

**`users`:**

```
email    varchar(190) NOT NULL UNIQUE     -- was nullable
phone    varchar(30)  NULL                -- was `whatsapp`, unique
locale   enum('sv','en','es') NOT NULL DEFAULT 'sv'
role     enum('consumer','agent','agency_admin','developer','admin')   -- unchanged
identity_doc_type     enum('nie','dni','passport','personnummer') NULL
identity_ref_last4    char(4)  NULL       -- last 4 ONLY; never the full number
identity_verified_at  datetime NULL
whatsapp_verified_at → email_verified_at
```

**`leads`:**

```
email varchar(190) NOT NULL   -- was nullable
phone varchar(30)  NULL       -- was `whatsapp`, NOT NULL
vertical varchar(40) NOT NULL -- unchanged; values are now 'sv'
routed_to enum('agency','agent','internal','developer','owner')  -- unchanged; APPEND new lanes only
```

**`otp_codes`:** `whatsapp` → `destination varchar(190)`, add
`channel enum('email','sms') NOT NULL DEFAULT 'email'`, index becomes
`idx_dest (destination, expires_at)`.

**`agents`, `listing_sources`, `import_jobs`, `import_rows`:** `whatsapp` →
`phone` on `agents`; otherwise unchanged. `listing_sources.scope_agency_id`
stays `NOT NULL DEFAULT 0` — the reasoning is unchanged and load-bearing.
`source` enum members become `('manual','fsbo_ads','whiteglove','import_idealista','import_fotocasa','import_kyero','import_agency_site','api')`.

**New tables:** `fx_rates` and `acquisition_costs` exactly as written in §3.5.

**Dropped tables:** `financing_programs`.

### Scripts

| Script | Action |
| --- | --- |
| `seed:financing` / `scripts/seed-financing.ts` | **delete** |
| `cron:cuotas` / `scripts/recompute-cuotas.ts` | **delete** |
| `seed:costs` / `scripts/seed-acquisition-costs.ts` | **new**, idempotent upsert by `region`, rates marked PLACEHOLDER in the same voice as `seed-financing.ts` |
| `cron:fx` / `scripts/fetch-fx.ts` | **new**, ECB daily XML → `fx_rates`; writes nothing on fetch failure so the previous rate stands |
| `seed:locations` | rewrite `TREE` for Spain, set `acquisition_region` on every node |
| `cron:translate` | invert to es→sv, write `title_sv`/`description_sv`/`translation_hash_sv` |
| `cron:geo`, `cron:medians`, `cron:resync`, `cron:sessions` | unchanged |
| `verify:import`, `verify:facets`, `verify:i18n`, `verify:seo`, `verify:scopes` | keep all five; update their fixtures |

### Seeded regions

**`acquisition_costs` — seven comunidades, rates PLACEHOLDER pending each
comunidad's published scale:**

| region | name |
| --- | --- |
| `AN` | Andalucía |
| `VC` | Comunitat Valenciana |
| `MC` | Región de Murcia |
| `IB` | Illes Balears |
| `CN` | Canarias |
| `CT` | Catalunya |
| `MD` | Comunidad de Madrid |

**`locations` — the Swedish-buyer map. `pais → comunidad → provincia →
municipio → zona`; only municipio and zona appear in URLs.**

| comunidad | provincia | municipios (MVP) |
| --- | --- | --- |
| Andalucía (`AN`) | Málaga | Marbella, Estepona, Mijas, Fuengirola, Benalmádena, Torremolinos, Málaga, Nerja, Manilva |
| Andalucía (`AN`) | Almería | Mojácar, Vera, Roquetas de Mar |
| Comunitat Valenciana (`VC`) | Alicante | Torrevieja, Orihuela Costa, Alfaz del Pi, Altea, Calpe, Jávea, Dénia, Guardamar del Segura, Santa Pola |
| Región de Murcia (`MC`) | Murcia | San Javier, Los Alcázares, Cartagena, Mazarrón |
| Illes Balears (`IB`) | Illes Balears | Palma, Calvià, Andratx, Pollença, Alcúdia, Santanyí |
| Canarias (`CN`) | Las Palmas | Mogán, San Bartolomé de Tirajana |
| Canarias (`CN`) | Santa Cruz de Tenerife | Adeje, Arona |
| Catalunya (`CT`) | Girona | Lloret de Mar, Roses, Castell-Platja d'Aro |
| Catalunya (`CT`) | Barcelona | Barcelona, Sitges |
| Comunidad de Madrid (`MD`) | Madrid | Madrid |

Seed `zona` children only for Marbella (Nueva Andalucía, Golden Mile, San
Pedro de Alcántara, Puerto Banús, Elviria, Nagüeles) and Palma (Santa Catalina,
Portixol, Son Vida, Old Town). Everywhere else, municipio depth is enough for
MVP — the same "pages only exist where listings will" rule the Paraguay seed
states.

### i18n

- `src/i18n/es.ts` → **`src/i18n/sv.ts`**. Namespaces rename `esHome` →
  `svHome`, `esHub` → `svHub`, `esCategory`, `esSearchBar`, `esFilters`,
  `esCard`, `esListing`, `esPrecios`, `esSiteNotice` likewise.
- **Delete `src/i18n/en.ts` at MVP.** Tradeoff, stated so it is a decision and
  not an accident: keeping it preserves `verify:i18n`'s strongest check (two
  dictionaries walked side by side for missing keys, wrong arity, empty
  strings), but doubles the cost of every copy change for a door no host serves
  and no domain exists for. With one founder shipping one site, delete it and
  reintroduce it with the English domain.
- **Keep all the machinery**: `Dictionary = Widen<typeof svDictionary>`, the
  `satisfies` assembly in `index.ts`, `dict()` in `server.ts`,
  `getDictionary(locale)` in `index.ts`, and the hard rule that
  `src/i18n/index.ts` never imports `next/headers`. That machinery is what
  makes reintroducing `en.ts` a file addition rather than a refactor.
- `verify:i18n` keeps its shape and runs its single-dictionary checks (no empty
  strings, no placeholder leftovers, every namespace reachable) until a second
  dictionary lands.
- Number locale is `sv-SE`. Note for whoever writes the tests: `sv-SE` groups
  thousands with U+00A0, not a plain space.

### URL vocabulary — `src/lib/facets.ts` + `src/lib/urls.ts`

```ts
export const FACET_PARAM = {
  operation:   "affar",       // was "operacion"
  propertyType:"typ",         // was "tipo"
  city:        "ort",         // was "ciudad"
  barrio:      "omrade",      // was "barrio"
  priceMin:    "pris_min",    // was "precio_min"
  priceMax:    "pris_max",
  minBedrooms: "sovrum",      // was "dormitorios"
  sort:        "sortering",   // was "orden"
} as const;

export type SortOption = "senaste" | "pris_upp" | "pris_ner";
```

Path segments: `/propiedad/{slug}` → `/bostad/{slug}`;
`/{operacion}/{tipo}/{ciudad}` → `/{affar}/{typ}/{ort}` with
`kopa | hyra | korttidshyra`. Everything else about the facet layer is
unchanged, including the split: `facets.ts` stays pure (no `next/*`, no
drizzle — the filter bar is a client component) and `facet-sql.ts` stays
`server-only` and remains the only place a facet becomes a WHERE clause. Price
filters now run on **`price_eur`**, and `facet-sql.ts`'s comment saying so must
be updated, not deleted.

**SEK filter bounds convert to EUR in the caller, before `facetConds()`.**
Never `price_eur * :rate` in a WHERE — see §2.

### Cache — `src/lib/cache.ts`

```ts
CACHE_TAGS.fx = "fx";
CACHE_TAGS.acquisitionCosts = "acquisition-costs";
CACHE_TTL.fx = 3600;              // ECB publishes once per business day
CACHE_TTL.acquisitionCosts = 86_400;
```

Add `revalidateFx()` and `revalidateAcquisitionCosts()`, called from the
`/admin` manual-override actions. Document in the file header that for
cron-written reference tables the TTL *is* the invalidation mechanism, because
the cron runs out of process and its `revalidateTag()` cannot reach the running
server's data cache. `CACHE_TAGS.marketMedians` stays; the rest are unchanged.

### Formatting — `src/lib/format.ts`

```
formatUsd / formatGs / formatPrice / formatCuota   → delete
formatEur(amount)                  → "€ 285 000"      (sv-SE grouping)
formatSek(eur, rate | null)        → "≈ 3 250 000 kr" rounded to nearest 10 000; null when the rate is stale
formatRateNote(rate, observedOn)   → "EUR/SEK 11,42 · 27 aug 2026"
imageUrl / imageThumbUrl           → unchanged
```

### Cuota engine

- `src/lib/cuota.ts` → **`src/lib/amortization.ts`**, keeping only
  `frenchAmortization()`. Delete `bestCuota`, `FinancingProgram`, `CuotaResult`.
- New `src/lib/acquisition-cost.ts`: pure, `(priceEur, region row, isNewBuild)`
  → itemised breakdown + total, `null` when the region has no active row.
  **Rendered, not cached on a column** — see §4.
- Flag the mortgage calculator in `CLAUDE.md`'s backlog list and as a new
  lettered decision in `PLAN.md`, wording in §4.

### Cosmetic renames — do these now, while nothing is live

propia.node deliberately left these alone because it had live sessions and
stored drafts. This repo has neither.

| From | To |
| --- | --- |
| `propia_session` cookie | `ftse_session` |
| `propia:recently-viewed` | `ftse:recently-viewed` |
| `propia:publish-draft` | `ftse:publish-draft` |
| `package.json` `"name": "propia"` | `"flyttatillspanien"` |
| docker-compose DB name / user `propia` | `ftse` |
| import User-Agent in `src/lib/safe-fetch.ts` | `flyttatillspanien.se` |

### Docs that must be rewritten, not patched

`CLAUDE.md`, `ARCHITECTURE.md`, `README.md` and `PLAN.md` in this repo are all
Paraguay documents. Every domain, every backlog item, every decision letter and
every founder decision in them describes propia.node. Rewrite `CLAUDE.md`
first — it is the file that claims to be the state of the world, and right now
it is the state of a different world.

### Explicitly NOT in scope for the first implementation pass

- Any second vertical entry, in any state, until a second domain is owned.
- A stored `price_sek` column, in any form.
- A cached per-listing acquisition-cost column.
- A full NIE/DNI column.
- A Spanish mortgage calculator or any stub of one.
- XML feed ingestion (Idealista / Fotocasa / Kyero formats) — MVP intake stays
  CSV/XLSX through the existing `planImport` / `commitImport` planner, with the
  permission column and the rollback trail untouched. XML is v1.1 and goes
  through the *same* planner; do not add a second validation path.
- Anything under `.github/workflows/` — `.githooks/pre-commit` refuses it, and
  the local pre-push gate is the CI.
