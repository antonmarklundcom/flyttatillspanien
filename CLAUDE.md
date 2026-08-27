# CLAUDE.md — current reality of this project

`ARCHITECTURE.md` is the design contract. **This file is the state of the
world.** Where the two disagree, this file wins and ARCHITECTURE.md describes
an intention that has not happened yet. Read both before building.

Last verified against the code: 2026-08-20.

## Domains — read this before touching canonicals, metadata or BRAND_NAME

| Domain | Reality |
| --- | --- |
| `realestateinparaguay.com` | **This app, live, today**, and the current `CANONICAL_HOST` default. Serves the Spanish marketplace. Slated to become the **English** site once `inmobiliaria.com.py` takes over as Spanish primary — its `verticals.ts` entry still says `locale: "es"` and must not be flipped alone (see the flip checklist in PLAN.md D6). |
| `inmobiliaria.com.py` (singular) | **Owned, enabled, and as of 2026-08-16 the Spanish marketplace primary in waiting** — the founder reversed the earlier "his own agency brand only, never wire it in" call (PLAN.md D6). Same app, same database, same `/admin` and `/agencia`. It ships with `ownsListingDetail: false` while both hosts serve identical Spanish rows, so its `/propiedad` pages canonicalise to `realestateinparaguay.com` and its sitemap omits them; every other page type there indexes normally. |
| `propia.com.py` | **NOT owned, and as of 2026-08-17 no longer in the code.** Its `verticals.ts` entry (and the `"propia"` vertical key) is deleted, the `hola@propia.com.py` contact fallback is gone, and the founder has ruled out *propia* as a brand name anywhere a client or realtor can see it. ARCHITECTURE.md and README.md still name it — that is stale prose, not a fact. `inmobiliaria.com.py` is the `.com.py` domain it was standing in for; do **not** reintroduce it as a fallback for anything. |
| `inmobiliarios.com.py` (plural) | Not owned. The future agent-directory vertical already declared in `verticals.ts`. Distinct from the singular above — do not conflate them. |
| `*.hostingersite.com` | Hostinger's raw deploy host. Never a canonical target. |

Consequences that bite:

- `siteOrigin()` / `listingCanonicalOrigin()` in `src/lib/origin.ts` emit
  `PRIMARY_ORIGIN` (= `https://${CANONICAL_HOST}`) for any host that is not an
  `enabled` vertical — preview deploys and `*.hostingersite.com` included.
- A host's sitemap only lists URLs that host owns: `app/sitemap.ts` skips
  `/propiedad` entries when `hostOwnsListingDetail()` is false. Keep any new
  host-specific page type on that same rule — submitting a URL you
  canonicalise elsewhere is a Search Console error, not a neutral extra.
- **The vertical table's SEO invariants are a check, not a convention.**
  `npm run verify:seo` refuses a push where two served doors would own their
  `/propiedad` pages in the same language (that is the duplicate-content trap
  `inmobiliaria.com.py`'s `ownsListingDetail: false` exists to avoid — and
  flipping that one flag alone is how it happens), where two doors share a
  vertical key (`currentVertical()` resolves the header by first match), or
  where a host key is spelled in a form `resolveVertical()` never looks up.
- **hreflang is derived, not hand-maintained.** `languageAlternates()`
  (`src/lib/alternates.ts`) builds a page's language map from the same
  `verticals.ts` entries, so the D6 flip turns the tags on with no separate
  commit. Two rules it encodes and a new call site must not break: a set is
  emitted only when two doors serve **different locales** (two Spanish doors
  are a duplicate, which is the canonical tag's job, not hreflang's), and only
  a host that owns the page type appears in it — `/propiedad` alternates are
  gated on `hostOwnsListingDetail()`, and a noindex category page gets none.
  Checked by `npm run verify:seo`, which runs the rule against a synthetic
  post-flip vertical table.
- `CANONICAL_HOST` is not just an origin string: `verticals.ts` derives
  `DEFAULT` from it (`VERTICALS[CANONICAL_HOST]`), so it decides the locale,
  filters and copy of every request that arrives without a known host. Moving
  it to `inmobiliaria.com.py` and leaving `realestateinparaguay.com` at
  `locale: "es"` leaves two Spanish primaries; flipping that entry to
  `locale: "en"` + `filters.foreign_exposure` without moving the env var
  silently switches the whole live site to English and filters the listing
  set. **Change the env var and the vertical entries together, never one
  alone** — PLAN.md D6 has the full flip checklist.

## Brand name — DECIDED: the domain is the brand

Resolved 2026-08-16. There is no separate wordmark and no "Homes Paraguay" —
that name is gone from the codebase. **Each host is branded as its own
domain**, declared as `brand` on the vertical:

| Host | Brand |
| --- | --- |
| `realestateinparaguay.com` | Real Estate in Paraguay |
| `inmobiliaria.com.py` | Inmobiliaria Paraguay |

How to read it, and the one mistake to avoid:

- `brandName()` / `brandMeta()` from **`src/lib/brand-server.ts`** — async,
  request-scoped, **correct on every public page**, in `generateMetadata` and
  in the component body alike.
- `BRAND_NAME` from `src/lib/brand.ts` — the CANONICAL_HOST's brand, resolved
  once at module load. Correct **only** on `/admin` and `/agencia` (staff
  surfaces reached on one host), in client components, and in scripts. On a
  public page it pins that page to one domain's name regardless of which
  domain the visitor typed.
- `brand.ts` must never import `next/headers`, directly or transitively:
  `src/i18n/es.ts` imports it and six client components import that. The
  request-scoped half lives in `brand-server.ts` for exactly this reason.
- **The brand suffix on page titles is set once**, as a `title.template` in
  `app/layout.tsx`. A page returns only its own segment (`"Casas en Asunción"`)
  and Next appends `" — <brand>"`. Do not put the brand back into a page's own
  title — it will double. OG titles do *not* inherit the template, so those
  spell the brand out.
- Copy that names the brand is brand-parameterised, not constant:
  `faqSections(brand)`, `esSiteNotice.body(brand)`, `esPrecios.methodBody(brand)`,
  `inquiryPrefillFor(brand, …)`, and friends.
- **No *propia* in anything a visitor, realtor or staff user sees** (founder
  decision, 2026-08-17). The `propia.com.py` vertical and its `brand: "Propia"`
  are deleted; the admin CSV template downloads as `plantilla-avisos.csv`.
- **There is no portal email, on purpose.** `CONTACT_EMAIL` / `CONTACT_WHATSAPP`
  in `src/config/contact.ts` are `string | null` with **no fallback** — the old
  `hola@propia.com.py` default opened a compose window to a domain nobody owns.
  Until the founder has a real mailbox (he wants it outside Hostinger, ideally
  through VenderCRM), the contact channels are **the on-site lead form and
  WhatsApp**. Every consumer already handles null: the footer and `/contacto`
  hide the address, the privacy policy drops the "or write to" clause, the
  Organization JSON-LD omits the email `contactPoint`, the homepage publish CTA
  routes to `/publicar`, and `NewsletterSignup` falls back to WhatsApp and then
  to a `/contacto` link. **Do not add a placeholder address back.**
- Still *propia*-flavoured and deliberately left alone (backend only, never
  rendered): the session cookie `propia_session`, the localStorage keys
  `propia:recently-viewed` / `propia:publish-draft`, the docker-compose DB
  name/user, `package.json`'s name, and the import User-Agent in
  `src/lib/safe-fetch.ts` (that file is being rewritten in the security PR —
  change the UA there, not on a parallel branch).
- The site is **Spanish-only** for now. Both hosts serve `locale: "es"`; the
  English vertical waits until the Spanish site is finished.

## Import pipeline — read before touching intake or dedup

Two intakes exist and they are different products, not two versions of one:

| Path | What it is |
| --- | --- |
| `/agencia/importar` | An agent pastes a link to **their own** listing, attests to it, gets a draft. One page, structured data only, no per-site selectors. |
| `/admin/importar` | Super-admin uploads an agency's spreadsheet (.csv/.xlsx), previews, commits, can roll the whole batch back. |

Rules that are load-bearing:

- **`dedupKey()` returns `null` when there is no contact phone, and that is
  correct.** The key is bucketed (5k USD, 10 m²) so a re-listed flat still
  collapses; the phone is the only thing stopping those buckets from describing
  every unit in a building. A phone-less batch used to fold twenty flats into
  one and report success. Never "fix" the null by inventing a fallback key.
- **`listing_sources.scope_agency_id` is `NOT NULL DEFAULT 0`, 0 = unscoped.**
  It is half of `uq_source`; MySQL treats NULLs in a unique index as
  all-distinct, so making it nullable silently switches off the "re-importing
  the same file changes nothing" guarantee. Both `dedupKey()` and the
  external-id lookup are scoped by it.
- **Always pass an agency.** `importListings({ agencyId })` stamps ownership;
  without it the listings belong to nobody and their leads are unattributable.
  The CLI warns when you omit `--agency`.
- **The dry run and the commit share one planner** (`planImport` /
  `commitImport`). Do not add a separate validation path — it will drift from
  what actually runs, and the preview is the only reason the feature is safe.
- Every batch writes `import_jobs` + `import_rows`, with the pre-update values
  in `previous_json`. That is what makes rollback real rather than a delete.
- Permission is a **column**, and `commitImportAction` refuses to write without
  it. Scraping a competitor's catalogue wholesale is the thing this must not
  become; the gate is in the server action, not the form.

Verify with `npm run verify:import` (pure checks, no DB). With a local database
up it also exercises plan → commit → re-run → rollback:
`docker compose up -d && npm run db:migrate && DATABASE_URL="mysql://propia:propia@127.0.0.1:3306/propia" npm run verify:import`

`npm run cron:resync` pauses listings whose sources have gone quiet (30 days by
default, `--dry` first). It records itself as a revertible import job.

## Backlog state (verified, not remembered)

1. **R2 image storage** — code is complete (`src/lib/r2.ts`,
   `src/lib/listing-images.ts`, both photo panels gate on `isR2Configured()`).
   Blocked purely on the founder creating the Cloudflare account/bucket and
   setting `R2_*` env vars. **Do not build around it or re-implement it.**
2. **`NEXT_PUBLIC_CANONICAL_HOST`** — see the domain trap above. It moves to
   `inmobiliaria.com.py` on flip day, as one item in the PLAN.md D6 checklist,
   never on its own.
3. **Individual agent profile pages** — done (`/agente/[slug]`, PR #32,
   2026-07-31). Mirrors `/inmobiliaria/[slug]` (PR #28): same indexability
   rule, same DB-backed no-static-cache pattern. `app/agente/[slug]/page.tsx`.
4. **Reviews/ratings** — does not exist. Needs a migration and a moderation /
   anti-fake-review design. **Ask the founder before starting.**
5. **Import image pipeline** — **not built, on purpose.** `syncImages()` writes
   the *remote source URL* into `listing_images.r2_key` as an interim, and
   `imageUrl()` passes it through while `R2_PUBLIC_BASE_URL` is unset. Fetching,
   deduping, WebP-converting and resizing imported photos waits on backlog item
   1 above. **Do not build a stub around it** — the R2 code is written.
6. **Financing rates** — `afd_primera_vivienda` (9.00%) in
   `scripts/seed-financing.ts` is a **placeholder**. It feeds
   `npm run cron:cuotas`, which caches `listings.cuota_gs`, which is printed on
   every venta card. Wrong rates = wrong money sitewide. Verifying it against
   published AFD/MUVH terms is a research task, not a code task.
7. **Che Róga Porã is `active: false`** (founder decision, 2026-08-16): it is
   approved per development, not per portal, so quoting it on every venta
   listing implied an eligibility the seller had not established. With only AFD
   active, cuotas are ~19% higher and listings above ~US$107k show no cuota
   line at all (AFD's 700M Gs cap). Applying it to a live database is two
   commands in order — `npm run seed:financing && npm run cron:cuotas` — the
   second clears cuotas still cached from the programme. **Per-project opt-in
   is not built**: it needs a column on `projects` plus an `/admin/proyectos`
   screen that does not exist yet. Flipping `active` back to `true` site-wide
   is NOT the intended path.

8. **FSBO loop — half built, on purpose.** As of 2026-08-20 (PRs #62–#64) a
   listing published through `/publicar` has a working contact: the chain on
   the detail page is agent → agency → **owner** (`ListingDetail.ownerUser`,
   resolved only when there is no agency and no agent), the seller card labels
   them "Particular", and `/admin/leads` names that publisher behind an
   `internal` lead and offers a one-tap WhatsApp forward. An FSBO publisher
   does **not** get an `agents` row — that would put a private seller into
   `/agente/[slug]` and the agent directory with a professional's trust
   signal. What is still missing is their own inbox: **PLAN.md D8**, a founder
   decision. Until it lands the operator forwards, which is why the forward
   button exists. `routed_to` has no `owner` lane and adding one is a schema
   change — do not add it without D8.
9. **Operator alerts are optional and silent when unset.** `alertOperator()`
   in `src/lib/crm.ts` posts `{"event":"operator_alert"}` to
   `LEAD_WEBHOOK_URL` on a new lead and a new review submission. With no
   webhook there is no alert and no fake one — the zero-config signal is the
   `/admin` badges (review queue, and leads from the last 24 h). Same rule as
   `sendOtp`: never log a line that pretends a message was delivered.

## Caching — the data cache is the only cache this portal has

Every public route is `ƒ (Dynamic)`. The root layout reads the `Host` header
for the per-host brand, so no route holds a full route cache and none ever will
without moving the vertical into the URL (PLAN.md, "F17, re-measured"). A
`export const revalidate` at route level is therefore silently dead — don't add
one.

What does work is `unstable_cache`: the page still renders per request, but its
queries don't run. Tags, TTLs and the invalidation helpers live in
**`src/lib/cache.ts`**. Two rules:

- **Every tag has a writer.** `revalidatePath()` does NOT clear
  `unstable_cache` entries — they are separate caches. A new cached query
  without a matching `revalidateListings()` / `revalidateDirectory()` /
  `revalidateGuides()` call in the actions that write it means an operator
  saves a change and the public page keeps showing the old one until the TTL
  expires, which reads as "the save didn't work". The TTL is the backstop.
- **Dates do not survive the boundary.** Entries are serialized, so a `Date`
  comes back as an ISO string and `string > Date` is silently false (this is
  why `ListingCard` re-wraps `featuredUntil`). A cached query returning Dates
  re-wraps them in its exported wrapper — see `listFinancingPrograms` and the
  `revive*` helpers in `post-queries.ts` — not in each consumer.

**The sitemap has two halves and they are not interchangeable.**
`src/lib/sitemap.ts` decides *what* is listed — the half that must agree with
`getIndexability()` and `hostOwnsListingDetail()`, and where a new page type
goes. `src/lib/sitemap-xml.ts` decides how it is served: the hour-long cache
every chunk shares, the 10 000-URL chunking, and the XML. `/sitemap.xml`
renders a `<urlset>` while the site fits in one chunk and a `<sitemapindex>`
past it, so `robots.txt` keeps pointing at one address either way. It is a
route handler rather than Next's `generateSitemaps()` **because that
enumerates its chunk ids at build time and this build has no database** — the
same constraint that keeps every route dynamic.

`app/not-found.tsx` deliberately does `listCities().catch(() => [])`: a 404 is
also the zero-match category surface, and it must not become a 500 during the
exact incident where MySQL is the thing that is unwell.

## Listing filters — one vocabulary, two files

Every surface that narrows a listing set goes through the same layer. Adding a
facet in a page or a route handler instead is how the grid and its map start
disagreeing about what the visitor asked for.

- **`src/lib/facets.ts`** — pure. The `ListingFacets` type, the query-string
  names (`precio_min`, `dormitorios`, `orden`, `ciudad`, …), `parseFacetParams`
  and its inverse `facetSearchParams`. No `next/*`, no drizzle: the filter bar
  is a client component and shares this. Same split as `brand.ts`.
- **`src/lib/facet-sql.ts`** — `server-only`. `facetConds()`, `verticalConds()`
  and `publishedFacetWhere()`. The only place a facet becomes a WHERE clause,
  and the only place that knows price filters run on `price_usd` (the
  normalized, indexed column) rather than `price_amount`.

Two rules that bite:

- **`VerticalConfig.filters` is now read** (it was declared and consumed by
  nothing until 2026-08-21). It narrows the grid, the count that decides
  indexability, the map pins, the home rails, the operation hub, similar
  listings and the sitemap. A door may only ever *narrow* what a visitor asked
  for — the conditions are ANDed, never merged over the visitor's choice.
- **A cached query that filters by vertical must put the vertical key in its
  cache key.** The home payload and the sitemap entries do; a new one that
  forgets will serve one door's listing set to another. No enabled vertical
  declares filters today, so a mistake here is silent until flip day.

`npm run verify:facets` covers the pure half (parse ∘ build is the identity,
every facet maps to its own column, every filter value declared in
`verticals.ts` is a real enum member). It runs in the pre-push hook.

## Map coordinates — materialized at write time, never coalesced in a query

A listing is plotted at its own `lat`/`lng` when it has one and at its
barrio/city centroid when it does not. That answer lives in
`listings.display_lat` / `display_lng`, and `idx_geo` is
`(status, display_lat, display_lng)`.

- **The rule has one home: `src/lib/geo.ts`.** `syncDisplayCoords(conn, id)`
  after any write that touched `lat`, `lng` or `location_id` — that is
  `saveDraft`, `updateListing`, `createClaimedDraft`, both import writers and
  the import rollback. A writer that only changes status, price or ownership
  does not need it. `syncAllDisplayCoords()` is the same statement over the
  whole table.
- **Do not put the coalesce back into a query.** `coalesce(listings.lat,
  locations.lat)` in a WHERE is a function of two columns across a join: not
  sargable, so the bounding box could not use `idx_geo` and every map pan
  scanned the published set (audit F38). Measured on 3 000 rows: `ALL` + a
  block-nested-loop join before, `range` on `idx_geo` (key_len 13, 130 index
  entries) after.
- **`display_lat BETWEEN …` already excludes NULL — never add `IS NOT NULL`
  next to it.** The redundant predicate is what made MariaDB fall back from
  `range` to `ref` on `status` alone (734 entries instead of 130). It reads
  like harmless defensiveness and costs the index.
- **A centroid that moves is the one staleness no write hook can see.**
  `npm run cron:geo` (`--dry` first) repairs the table and names published
  listings with no position at all — those render everywhere except the map,
  and nothing else in the app will ever mention it. Run it after
  `npm run seed:locations` or any edit to `locations.lat/lng`.
- The sync runs raw SQL rather than `db.update()` on purpose: `updatedAt`
  carries a JS-side `$onUpdate`, and a recomputation a visitor cannot see must
  not move a listing's sitemap `lastmod`.

## i18n — read this before touching any visitor-facing string

The site is **Spanish-only** and stays that way until the Spanish site is
finished (both live hosts are `locale: "es"`). `src/i18n/en.ts` exists as of
2026-08-21 (Batch 3 layer 2) but **no host serves it** — a door renders
English only once its `verticals.ts` entry says `locale: "en"`, and that is
the whole D6 flip checklist, never a one-line change.

- **Strings live in `src/i18n/es.ts`.** Buyer-facing copy — home, the operation
  hubs, the category grid, `SearchBar`, `CategoryFilterBar`, `ListingCard` and
  the `/propiedad` detail page — was inline JSX until 2026-08-20 and is now in
  the `esHome` / `esHub` / `esCategory` / `esSearchBar` / `esFilters` /
  `esCard` / `esListing` namespaces. **Do not add a new visitor-facing literal
  to a page or component**; add it to the namespace and read it back.
- **Reach them through the dictionary, not by importing the namespace.**
  Two ways in, and picking the wrong one is the mistake to avoid — the same
  split as `brand.ts` / `brand-server.ts`, for the same reason:
  - `dict()` from **`@/i18n/server`** — async, request-scoped, reads the
    `x-locale` header the middleware sets. **Correct on every public page**,
    in `generateMetadata` and in the component body alike.
  - `getDictionary(locale)` from **`@/i18n`** — pure. For **client components**
    (which take `locale` as a prop — `SearchBar` is the only buyer-facing one)
    and for callers that already hold a locale.
- **`src/i18n/index.ts` must never import `next/headers`**, directly or
  transitively. `SearchBar` and five other client components consume it. The
  request-scoped half is `server.ts`, which is `server-only`.
- **`en.ts` is a peer of `es.ts`, not a copy of its sentences.** The English
  door is pitched at foreign buyers (PLAN.md D6), so *cuota* is "estimated
  monthly payment", *en pozo* is "pre-construction", and `enCategory.title`
  puts the operation where English wants it. Translate intent; never invent a
  fact the Spanish does not state.
- `Dictionary` is `Widen<typeof esDictionary>` — the Spanish shape with its
  literal strings widened to `string`. Widening is what makes a second locale
  satisfiable at all (`as const` would otherwise require the exact Spanish
  sentence); the structure is not widened, so a missing key or a wrong leaf
  type is still a type error. Both dictionaries are checked with `satisfies`
  where they are assembled in `index.ts`.
- **Add a key to `es.ts` ⇒ add it to `en.ts` in the same commit.** The type
  gate catches a missing key; it does *not* catch a function that quietly takes
  fewer arguments (TypeScript allows that), which is what `npm run verify:i18n`
  is for — keys, arity, array lengths, empty strings, both dictionaries walked
  side by side. It runs in the pre-push hook.
- **The English *data* layer is `cron:translate`, and it is not a hook.**
  `listings.title_en` / `description_en` are written only by
  `npm run cron:translate` (`src/lib/translate.ts` + `scripts/translate-listings.ts`),
  never by a form and never in a request. What needs work is decided by
  `listings.translation_hash` — a sha256 of the title and Spanish description
  the stored English came from — so an edit is picked up by the next run
  without any publish-path hook. **Do not add one:** a publish must not depend
  on a third party being up, and a multi-second outbound call inside a server
  action is the exact shape of the 503 post-mortem in PLAN.md. Without
  `ANTHROPIC_API_KEY` the job refuses to run and writes nothing; the site is
  unaffected either way, because no host serves `locale: "en"` yet.
- **Nothing reads `title_en`/`description_en` yet** — wiring the detail page,
  the card and the metadata to prefer them on an English door is flip-day work
  (PLAN.md D6), listed in the checklist there. The columns being populated is
  the *precondition* for the flip, not the flip.
- **Numbers are not copy.** `toLocaleString` takes a number locale derived from
  the request (`es-PY` / `en-US`), not the dictionary — the thousands separator
  differs even where the words don't.
- Copy that names the brand stays brand-parameterised: `faqSubtitle(brand)`,
  `discoverTitle(brand)`, `sellerFallback(brand)` and friends take it as an
  argument rather than baking one host's name in.

## CI — local, never GitHub Actions

Deploys run on Hostinger's build servers; GitHub's whole job is to hold the
code and fire a **webhook**, which is free and unmetered. Actions minutes bill
**per account across every repo**, so a workflow here spends the founder's
shared quota on a deploy path that does not use it.

- **Do not create files under `.github/workflows/`.** `.githooks/pre-commit`
  refuses to stage them. If a task genuinely needs one, state the case and stop
  — explicit yes first.
- The gate that replaces CI is `.githooks/pre-push`: `npm run typecheck`,
  `npm run build`, `npm run verify:import`, `npm run verify:facets`,
  `npm run verify:i18n`, `npm run verify:seo`. Same thing by hand:
  `npm run verify:local`. The last four are pure — no database, no network —
  which is why they belong in a hook at all.
- Hooks install themselves via `prepare` on `npm install`; after a fresh clone
  that skipped scripts, run `npm run hooks:install` (`git config core.hooksPath
  .githooks`).
- `npm run verify:scopes` stays manual — it needs a localhost database and
  refuses to run against anything else. Run it on anything touching
  `listingScopeWhere`, `panelScope` or a panel query.
- Because there is no required status check, **nothing auto-merges** — see
  PLAN.md D11/D20.

## Migrations — `db:status` before you fire, and again after

`npm run db:migrate` decides what to run from `__drizzle_migrations`, which can
be wrong in both directions (README documents pasting SQL into phpMyAdmin,
which records nothing). So the migration list is a proxy. The question that
actually matters is **does this database have what the deployed code selects**,
because drizzle names every column of a table in its `SELECT` — one missing
column is a 500 on every page that reads that table, not a broken feature.

`npm run db:status` answers both: the real pending set (hashing each
`drizzle/*.sql` the way drizzle's migrator does), and a **schema-drift diff**
of `src/db/schema.ts` against `information_schema` naming every missing table,
column and enum value. Read-only; `--probe` additionally proves an `owner`-lane
lead inserts, inside a transaction it always rolls back.

Run it **before merging any PR that touches `schema.ts`** and **again
immediately after `db:migrate`**. `No drift` is the only green.

## Working agreements with the founder

- **Autonomous build + merge is authorised** for well-verified, low-risk work
  (CSS, UI, copy, docs). Zero live users, everything git-revertible.
- **Flag before merging** anything touching auth, payments, or the DB schema.
- **Always** `git fetch origin main && git reset --hard origin/main` before
  branching. Merges happen through the GitHub API, so local `main` goes stale
  and a merged PR can look "missing". This has already cost a session.
- Verify with `npx tsc --noEmit` **and** `npm run build` before merging;
  Hostinger auto-deploys `main` with no staging environment.
- Branch naming: `claude/<feature-name>`.
