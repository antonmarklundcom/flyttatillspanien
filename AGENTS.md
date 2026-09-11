# AGENTS.md — the rules for any agent working in this repo

Read this file before touching anything. It is **self-contained**: every rule you
must obey is here, in full, with no other file required. Where it points at
another file, that pointer is for *history and detail*, never for a rule you need
in order to act safely.

Applies to Claude Code, Codex, and any other automated contributor. A human
running these commands is bound by the same production facts.

---

## 1. What this is

**flyttatillspanien.se** — one Next.js app (App Router, TypeScript), one MySQL
database, one deployment on Hostinger's managed Node.js hosting. It sells
Spanish property to Swedish buyers: one domain, one vertical, `locale: "sv"`,
and a single Swedish dictionary. Four kinds of lister publish through it —
Spanish estate agencies (`agencies.kind = "inmobiliaria"`), Swedish relocation
intermediaries who represent the **buyer** rather than the seller
(`kind = "relocation"`), developers (`kind = "developer"`), and private sellers
with no agency at all (FSBO, `listings.owner_user_id`, and deliberately no
`agents` row, so a private seller never borrows a professional's trust signal).

- **Zero live users so far.** Everything is git-revertible. That is why some
  autonomy is granted below — not because mistakes are cheap in production.
- **Hostinger auto-deploys `main`. There is no staging environment.** A merge is
  a deploy. A push that does not build is a live outage.
- **The database is the only copy of every listing and every lead.** Hostinger's
  daily backup is the only backup that exists.

### The editorial premise: the legal and compliance block

This portal is worth more to a Swede than Idealista with Google Translate for
exactly one reason — it surfaces, honestly, the facts a Spanish buyer reads
automatically and a Swedish buyer first hears from a lawyer after paying a
reservation deposit. Treat these columns as the product, not as metadata:

- `energy_rating` is **required to publish**. Spain's RD 390/2021 makes an
  advertisement without it non-compliant, so `src/lib/publish-gate.ts` refuses
  the `published` transition when it is NULL, and the gate is called from all
  three server-side writers that can make that transition (`approveListing()`,
  `updateListing()`, `commitImport(..., { publish: true })`) — **never only in a
  form**, because the importer is the other write path and is where most
  listings come from. `draft` and `pending_review` are deliberately ungated.
- `legal_status` (`escritura_registrada` / `obra_nueva_lpo` / `sin_lpo` /
  `en_regularizacion` / `desconocido`) is the landmine field. `desconocido` is
  the honest default and must **never** be silently upgraded to "fine".
- `charges_status` (what the lister declares) and `nota_simple_seen_at` (what
  the portal itself verified, operator-set only) are two columns on purpose.
  The UI says "seller states: free of charges — not yet verified by us". Never
  launder a claim into a fact.
- `referencia_catastral` carries `uniqueIndex("uq_catastral")` **over a nullable
  column, on purpose** — MySQL treats NULLs in a unique index as all-distinct,
  so most listings never collide while two rows sharing a real reference *are*
  the same property. Never make it required, never invent a fallback value.
- `ibi_annual_eur`, `community_monthly_eur`, `is_vpo`, `land_classification` +
  `buildable_m2`, `tourist_licence` — all optional, all shown when present,
  all there because a Swedish buyer would otherwise not know to ask.
- Areas: `built_m2` (superficie construida) is the **only** faceted, indexed,
  median-eligible area column, because a buyer comparing this site to Idealista
  must be comparing the same number. `usable_m2` is display-only.

### Prices: EUR is stored, SEK is computed

`listings.price_eur` is the only price column and the only column a filter or
index runs against. **There is no `price_sek` and there must never be one** — a
stored kronor snapshot is right on the day it is written and goes stale
invisibly. SEK is rendered at request time from `fx_rates` via
`formatSek()` / `formatRateNote()` in `src/lib/format.ts`, and if the newest
rate is older than `FX_MAX_AGE_DAYS` (default 7) every SEK line disappears from
the site while the EUR price is unaffected. **A missing figure is a small
disappointment; a confidently wrong one is a lie.** SEK filter bounds are
converted to EUR in the caller, before `facetConds()` — never
`price_eur * :rate` in a WHERE clause, which is not sargable.

### The domain

`src/config/verticals.ts` has **exactly one entry**, `flyttatillspanien.se`, and
that is a decision rather than a stub. Two rules, and they are absolute:

- **Never add a host to `verticals.ts`, and never introduce a domain that is not
  a key in it** — not as a canonical, not as a link, not as a contact address,
  not as a fallback. An unowned domain written into the code gets read by the
  next session as a fact, and fallback chains get built on it. The English door
  (Norwegian/Danish/Finnish/Dutch buyers of Spanish property read English, so it
  is a real second audience for the same inventory) is a **`PLAN.md` decision
  with its own flip checklist**, and is not written into `verticals.ts` until
  the domain is actually bought.
- **`CONTACT_EMAIL` (`src/config/contact.ts`) is `string | null` with no
  fallback, and never gets a hard-coded default.** A placeholder address is a
  compose window aimed at a mailbox nobody owns. It is nevertheless a
  **required-before-launch** value — a Swedish consumer portal with no address
  on its contact page is not credible — but the way to fix that is for the
  founder to set the env var, not for an agent to invent one. Every consumer
  already handles `null`. `CONTACT_WHATSAPP` and `agencies.phone` are the
  **agency-facing** channel (Spanish agencies live on WhatsApp), never the
  buyer's.

**The brand is the domain.** `brand` is per-vertical config
(`"Flytta till Spanien"`). On a public page read it with `brandName()` from
`src/lib/brand-server.ts` (async, request-scoped, correct in `generateMetadata`
and in the component body alike) — even though one door means one answer today,
because that is what makes the English door a no-op on this front. `BRAND_NAME`
from `src/lib/brand.ts` is the canonical host's brand resolved once at module
load, and is correct **only** on `/admin` and `/agencia`, in client components,
and in scripts. `brand.ts` must never import `next/headers`, directly or
transitively: `src/i18n/sv.ts` imports it and client components import that.
Copy that names the brand takes it as an argument (`brandTaglineFor(locale)`,
the `brand`-taking functions in `sv.ts`) — do not hardcode the name into a
string that has a parameterised version.

---

## 2. Git, verification and deploy

```bash
git fetch origin main && git reset --hard origin/main   # ALWAYS, before branching
git checkout -b claude/<feature-name>
# … work …
npm install && npm run hooks:install     # after a fresh clone
npm run verify:local                     # must be green before every push
git push -u origin claude/<feature-name>
```

- **Always reset to `origin/main` before branching.** Merges happen through the
  GitHub API, so a local `main` goes stale and a merged PR can look "missing".
  This has already cost a session.
- **Branch naming: `claude/<feature-name>`** for ad hoc work, `phase/<id>` for a
  phase of the tracked build in `plan.md`. One PR per unit of work.
- **`npm run verify:local` must pass before every push.** It is
  `typecheck → build → verify:import → verify:facets → verify:i18n → verify:seo`.
  The last four are pure — no database, no network.
- **Never `git push --no-verify`.** `.githooks/pre-push` runs the same gate; it
  is the only CI this repo has. Hooks install themselves via `prepare` on
  `npm install`; after a clone that skipped scripts, run `npm run hooks:install`.
- **Never create a file under `.github/workflows/`.** `.githooks/pre-commit`
  blocks it. Deploys run on Hostinger's build servers, which GitHub reaches with
  a free webhook; Actions minutes bill per account across every repo, so a
  workflow here spends the founder's shared quota on a path that does not use
  it. If a task genuinely needs one, state the case and stop — explicit yes
  first.
- **`npm run verify:scopes` stays manual.** It needs a localhost database and
  refuses to run against anything else. Run it on anything touching
  `listingScopeWhere`, `panelScope` or a panel query — it also asserts that a
  `relocation`-kind agency is scoped identically to an `inmobiliaria`-kind one —
  and say in the PR whether you ran it.

### What an agent may and may not do

- **You may merge** only well-verified, low-risk work — CSS, UI, copy, docs,
  script flags — and only when a plan or the founder has said so for that unit
  of work. When in doubt, open the PR and stop.
- **You must never merge** anything touching **auth**, **payments**, or
  **`src/db/schema.ts`**. Open the PR, title it so the risk is visible, and stop.
- **A schema change is `MIGRATION REQUIRED —` in the PR title**, always, and is
  never merged by an agent. Deployed code selects every column in `schema.ts`,
  so code on `main` ahead of the database 500s every page that reads that table.
- **You never run a migration against production.** `db:migrate` is the
  founder's command, on the founder's machine.
- **You never hold the write database credential.** See §3.
- Nothing auto-merges: there is no required status check on this repo.

---

## 3. Environment and the database

`tsx` does **not** read `.env`. Every script needs the credential exported in the
shell first:

```bash
export DATABASE_URL="mysql://user:pass@host:3306/db"   # bash
$env:DATABASE_URL = "mysql://user:pass@host:3306/db"   # PowerShell
```

**Two credentials, and the split is the point:**

| Variable | Who has it | What it is for |
| --- | --- | --- |
| `DATABASE_URL` | agents included | **Read-only** user. Enough for `db:status` and every `--dry` run. |
| `DATABASE_URL_RW` | the founder's machine only | The owner user. **Never given to an agent.** |

A writing CLI run picks `DATABASE_URL_RW ?? DATABASE_URL` (see
`scripts/db-credential.ts`, which every writing script imports **first**, above
every other import, because `src/db/index.ts` builds its pool at module load);
a dry run always uses `DATABASE_URL`. `db:status -- --probe` is the one writing
path in an otherwise read-only script and opens its own connection on the same
rule. With no `DATABASE_URL_RW` set nothing changes — writing runs use
`DATABASE_URL`, which is how a single-credential machine has always worked. The
app's own pool (`src/db/index.ts`) reads `DATABASE_URL` and **its credential
handling is never edited**, nor are `drizzle.config.ts` or the pool bounds.

Production MySQL is reachable only from an IP allowlisted in hPanel → Remote
MySQL. **A cloud agent cannot reach production at all, and must not try.** If a
task needs production data, it needs the founder.

### Local database

```bash
docker compose up -d                 # MySQL 8 on :3306
npm run db:migrate
export DATABASE_URL="mysql://ftse:ftse@127.0.0.1:3306/ftse"
```

The docker-compose service, database name and user are all `ftse`. If Docker is
unavailable in your sandbox, **say so in the PR** and do not claim a run you did
not do. A MariaDB stand-in is close but not identical: it stores `json` columns
as `longtext`, so `mysql2` hands them back as strings and anything reading
`previous_json` (the import rollback) misbehaves. That is the sandbox, not the
code.

### Migrations

```bash
npm run db:status            # read-only: pending set + schema drift. `No drift` is the only green.
npm run db:status -- --probe # additionally proves an owner-lane INSERT works; always rolls back
npm run db:migrate           # the founder, on the founder's machine
npm run db:status            # again, immediately after
```

`db:migrate` decides what to run from `__drizzle_migrations`, which **can be
wrong in both directions**: migrations pasted into phpMyAdmin record nothing,
and a recorded hash with no matching file means production ran SQL this checkout
does not contain. So the migration list is a proxy. The question that actually
matters is *does this database have what the deployed code selects* — which is
what `db:status`'s drift diff answers, by reading `src/db/schema.ts` against
`information_schema`. Run it **before merging any PR that touches `schema.ts`**
and **again immediately after `db:migrate`**.

**There is no `db:push`.** It was removed: migrations are files, reviewed in a
PR, applied by a human. Do not add it back.

---

## 4. Conventions that are load-bearing

Each of these has already caused a bug. They are not style preferences.

**Operations jobs — one runner per job, eventually.** The target shape is that
every routine job lives in `src/lib/ops/<job>.ts` as
`run<Job>(opts: { dry: boolean; limit?: number })` returning `OpsResult`
(`src/lib/ops/types.ts`), with the `scripts/*.ts` file a thin CLI over it
(`scripts/ops-cli.ts`) and any future operator surface calling the same
function. **Today the scripts are still monolithic** — the runners have not been
extracted yet. So: when you touch one of them, do not add a second code path for
a new caller, and do not half-extract a runner as a side effect of an unrelated
change. Every writing script takes `--dry`, spelled the same everywhere on
purpose, and a dry run must be the same pass over the same rows as the real one;
a preview computed by different code is a guess that agrees most of the time.
There is deliberately no barrel file under `src/lib/ops/` — one job pulls in the
AWS SDK, another the Anthropic SDK. Import the one file.

**i18n — never inline a visitor-facing string.** Copy lives in `src/i18n/sv.ts`,
namespaced (`svHome`, `svHub`, `svCategory`, `svSearchBar`, `svFilters`,
`svCard`, `svListing`, `svPanel`, `svPublish`, and others, some keeping inherited
Spanish-flavoured suffixes like `svTasacion` / `svPrecios` — a mechanical rename
nobody has spent a diff on, not a design choice). **There is no `en.ts` peer and
that is a decision, not a gap**: the site is Swedish-only, a second dictionary
for a door no host serves doubles the cost of every copy change, and `en.ts` was
deleted at MVP. The `Widen<>` machinery (`Dictionary = Widen<typeof
svDictionary>`, the `satisfies` assembly in `index.ts`, `getDictionary(locale)`)
is kept unused so that reintroducing a dictionary later is a file addition
rather than a refactor. Read copy through `dict()` from `@/i18n/server` on the
server (async, request-scoped, correct in `generateMetadata` too) or
`getDictionary(locale)` from `@/i18n` in client components, which take `locale`
as a prop. `src/i18n/index.ts` must never import `next/headers`.
`npm run verify:i18n` is **not** a pairwise dictionary walk — with one
dictionary there is nothing to walk. It calls every copy function with sentinel
arguments and asserts that changing an argument changes the output, which is
stronger: it catches a function that silently drops a parameter.

**Swedish listing text is written by a cron, not by a request.**
`listings.title_sv` / `description_sv` are written only by
`npm run cron:translate` (es→sv), decided by `listings.translation_hash_sv`,
never by a form and never in a request. Without `ANTHROPIC_API_KEY` the job
refuses to run and writes nothing. `servedTitle` (`src/lib/listing-copy.ts`)
reads `title_sv ?? title`, with a visible "maskinöversatt från spanska" marker
wherever the Swedish came from the cron rather than a human.

**Page titles** get their brand suffix once, from a `title.template` in
`app/layout.tsx`. A page returns only its own segment. OG titles do not inherit
the template, so those spell the brand out.

**Numbers are not copy.** `toLocaleString` / `Intl` take `sv-SE`, derived from
the request, never from the dictionary.

**Filters — one vocabulary, two files.** `src/lib/facets.ts` is pure (the
`ListingFacets` type, the Swedish query-string names in `FACET_PARAM` — `affar`,
`typ`, `ort`, `omrade`, `pris_min`, `pris_max`, `sovrum`, `sortering` —
`parseFacetParams` and its inverse) and is shared with client components.
`src/lib/facet-sql.ts` is `server-only` and is the **only** place a facet becomes
a WHERE clause, and the only place that knows price filters run on `price_eur`.
Never add a facet in a page or a route handler. A door's `filters` may only ever
*narrow* what the visitor asked for — conditions are ANDed, never merged over
the visitor's choice — and they narrow the grid, the count that decides
indexability, the map pins, the home rails, similar listings and the sitemap
alike. **A cached query that filters by vertical must put the vertical key in
its cache key**; with one door a mistake here is silent until the day a second
one exists. `npm run verify:facets` covers the pure half.

**Caching — `unstable_cache` only, and every tag has a writer.** Every public
route is dynamic (the root layout reads the `Host` header), so `export const
revalidate` is silently dead — do not add one. Tags, TTLs and the
`revalidateListings()` / `revalidateDirectory()` / `revalidateGuides()` /
`revalidateFx()` / `revalidateAcquisitionCosts()` helpers live in
`src/lib/cache.ts`. `revalidatePath()` does **not** clear `unstable_cache`
entries — they are separate caches — so a new cached query without a matching
`revalidate*` call in the action that writes it reads to an operator as "my save
didn't work" until the TTL expires. **One documented exception**: `fx_rates` and
`acquisition_costs` are also written from outside the running server (the
`cron:fx` job; the `/admin` manual FX override is the one in-process writer), and
a `revalidateTag()` call in another process cannot reach the server's data
cache. For those two, **the TTL is the invalidation mechanism, not a backstop** —
pick it to match the upstream publication cadence (`fx`: 3600 s, the ECB
publishes once a business day; `acquisitionCosts`: 86 400 s, regional tax scales
move with an annual budget), not how fast an operator expects a save to appear.
**Dates do not survive the cache boundary**: entries are serialized, a `Date`
returns as an ISO string and `string > Date` is silently false, so a cached
query returning Dates re-wraps them in its own exported wrapper, not in each
consumer.

**Map coordinates are materialized at write time.** A listing is plotted at
`listings.display_lat` / `display_lng` — its own coordinate, else its
zona/municipio centroid — and `idx_geo` is `(status, display_lat, display_lng)`.
Call `syncDisplayCoords(conn, id)` from `src/lib/geo.ts` after any write that
touched `lat`, `lng` or `location_id`. **Never put `coalesce(listings.lat,
locations.lat)` back into a query**: it is a function of two columns across a
join, not sargable, so every map pan scans the published set. **Never add
`IS NOT NULL` next to `display_lat BETWEEN …`** — `BETWEEN` already excludes
NULL, and the redundant predicate is what made the planner fall back from
`range` to `ref` on `status` alone. A moved centroid is the one staleness no
write hook can see: `npm run cron:geo` (`--dry` first) repairs it, and names
published listings with no position at all.

**SEO ownership is a check, not a convention.** Which host is canonical for
`/bostad` (`ownsListingDetail`) and for the directory pages (`ownsDirectory`,
per locale) is declared in `verticals.ts`; a host's sitemap lists only URLs that
host owns, and hreflang is *derived* from the same table by
`languageAlternates()` (`src/lib/alternates.ts`) — never hand-maintained. With
one door a hreflang set is correctly emitted as nothing: a set only appears when
two doors serve **different** locales. `npm run verify:seo` refuses a push where
two served doors would own their `/bostad` pages in the same language, where two
doors share a vertical key, or where a host key is spelled in a form
`resolveVertical()` never looks up. With one door those checks are trivially
satisfied — **they exist so that adding the English door later is a mechanical
change rather than an SEO incident, so never weaken or bypass one to make a
quick second entry work.** The sitemap itself has two halves that are not
interchangeable: `src/lib/sitemap.ts` decides *what* is listed (and must agree
with `getIndexability()` and `hostOwnsListingDetail()`), `src/lib/sitemap-xml.ts`
decides how it is served.

**Import pipeline.** Two intakes, one planner: `/agencia/importar` (an agent
pastes a link to their own listing) and `/admin/importar` (a super-admin uploads
an agency spreadsheet, previews, commits, can roll the batch back). **When a row
carries `referencia_catastral`, dedup on it exactly and skip the fuzzy path
entirely**; when it is absent — which will be most rows — fall back to
`dedupKey()` (bucketed price/area/phone) completely unchanged. `dedupKey()`
returns `null` when there is no contact phone, **and that is correct** — the key
is bucketed, and the phone is the only thing stopping those buckets from
describing every unit in a building. Never invent a fallback key for either
null. `listing_sources.scope_agency_id` is `NOT NULL DEFAULT 0` (0 = unscoped)
and is half of `uq_source`; making it nullable silently switches off the
"re-importing the same file changes nothing" guarantee, because MySQL treats
NULLs in a unique index as all-distinct. **Always pass an agency** — without one
the listings belong to nobody and their leads are unattributable. **The dry run
and the commit share one planner** (`planImport` / `commitImport`); never add a
separate validation path, for the catastral case or any other. Permission to
commit an import is a **column**, checked in the server action, not the form.
Every batch writes `import_jobs` + `import_rows` with pre-update values in
`previous_json` — that is what makes rollback real rather than a delete. And a
commit that publishes goes through the same `energy_rating` publish gate as a
form does.

**Calling app code from a script.** Anything wrapped in `unstable_cache` throws
`Invariant: incrementalCache missing` when there is no Next.js runtime around
it. Batch code must read the uncached variant; when you write a new cached
reader that a job may reach, give it an uncached sibling rather than making the
job fake a runtime.

**Alerts never lie.** `alertOperator()` (`src/lib/crm.ts`) posts to
`LEAD_WEBHOOK_URL` if one is set, and does nothing if not. Same rule as
`sendOtp()`, and it outranks the rest: **never log or return a line that says a
message was delivered when it was not.** With no webhook the zero-config signal
is the `/admin` badges.

---

## 5. Before you claim you are done

Every one of these, in order:

1. `npm run verify:local` — green. Not "green except".
2. `npm run verify:scopes` if you touched `listingScopeWhere`, `panelScope` or a
   panel query — and say in the PR whether a local database was available.
3. Ran every script you changed in its `--dry` form, against a real database if
   you have one. **If you could not, say so in the PR.** Never describe a run you
   did not perform, and never present a `--dry` result as a real one.
4. Re-read your own diff adversarially, as a reviewer looking for what CI would
   reject. Fix what you find before pushing.
5. `npm run db:status` if you touched `src/db/schema.ts` — and the PR title
   starts `MIGRATION REQUIRED —`, and you do **not** merge it.
6. Said plainly in the PR what you did not verify. An honest gap is information;
   an unstated one is a trap for whoever merges.

---

## 6. Stop and ask

Stop, write the question into `docs/decisions-needed.md`, and say so, for:

- **auth**, **payments**, or any **`src/db/schema.ts`** change beyond what your
  task explicitly authorised;
- a **founder decision**: money math, a rate, anything a visitor is told is a
  fact, a new brand or domain, a policy on user data. The open ones today are
  named so you do not rediscover them: the **EUR/SEK rate source and any manual
  override**, the **seven `acquisition_costs` comunidad rows — every rate in
  them is a PLACEHOLDER with `source_url` deliberately NULL**, and they print
  money figures on every detail page; and **full NIE/DNI capture**, which is out
  of scope until there is a founder decision plus a data-processing agreement
  (today `users.identity_doc_type` + `identity_ref_last4` + `identity_verified_at`
  store enough to recognise which document is on file and nothing more).
  A non-resident **mortgage calculator** is in the same bucket: there is no
  published non-resident rate scale to seed, so it is blocked on a lender
  partnership. Do not build a stub around any of these;
- a missing credential with **no graceful fallback** (a missing env value on its
  own is never a blocker — document it in `.env.example` and degrade quietly);
- anything where guessing wrong forces a rewrite rather than an edit.

Everything else: choose, write down what you chose and why, and keep going.
Minor non-blocking findings go in `KNOWN-ISSUES.md` — record them and carry on
rather than widening your diff.

**Model cost guardrail.** The Fable / Mythos-class models (`claude-fable-*`) are
never used for a phase, a subagent, a spawned session, a Workflow or a Routine
without the founder's explicit approval in that conversation. A session that
believes it needs one stops and says why; it never spawns one.

---

## 7. Where the history lives

These files explain *why*, and are not a substitute for anything above.

- **`CLAUDE.md`** — the verified state of the world: the domain decision, the
  brand rules, currency and FX, the legal & compliance block, the lister kinds,
  the import pipeline, leads and messaging, the **backlog state** (what is
  deliberately *not* built — R2 is written and waits on a bucket, the import
  image pipeline waits on R2, the mortgage calculator waits on a lender,
  reviews need a founder decision), caching, filters, map coordinates, i18n, CI
  and migrations. Read the backlog before proposing work. This file supersedes
  its old "Working agreements with the founder" section.
- **`ARCHITECTURE.md`** — the design contract. Where it disagrees with
  `CLAUDE.md`, `CLAUDE.md` wins and the contract describes an intention that has
  not happened yet.
- **`PLAN.md`** — product tracker: milestones, founder decisions, the English
  door's flip checklist, the audit findings many code comments cite.
- **`plan.md`** — the phased-build tracker: the phase numbering `phase/<id>`
  branches use, and what each phase was scoped to.
- **`docs/SPAIN-PORTAL-DESIGN.md`** — the design pass that turned this repo from
  the inherited portal codebase it was forked from into flyttatillspanien.se.
  The source of truth for *why* the domain, currency, i18n and compliance
  decisions are what they are.
- **`KNOWN-ISSUES.md`** — findings recorded rather than fixed (including the
  pre-existing import-rollback defect on the `updated` path).
