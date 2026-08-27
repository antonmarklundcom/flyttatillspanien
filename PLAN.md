# PLAN.md — live build status

Living tracker for the ARCHITECTURE.md §6 milestones. **Update this file in
every session that finishes a step** — mark items done, add new blockers.
`[C]` = Claude does it (code/session work). `[YOU]` = founder must do it
(hosting, accounts, real-world data — things code cannot reach).

_Last updated: 2026-08-21 (second session: hreflang ahead of the flip, the
vertical table's SEO invariants as a failing check, and /admin's tab row
grouped — PRs #71–#73; see the two 2026-08-21 sections at the end)._

---

## Where we actually are

- **Live** on `realestateinparaguay.com`, served by the single Next.js
  deployment in the Hostinger **Brazil** account (the app formerly reachable
  at `silver-goshawk-568437.hostingersite.com`; Hostinger renamed the site
  when the domain was attached, so that old URL no longer resolves).
- **Superadmin exists.** A `users` row with `role='admin'` was created by hand
  (SQL via phpMyAdmin, because the panel has no user management). `/login`,
  `/admin` and `/agencia` all work.
- **Migration 0001 is applied in production.** `password_hash`, `sessions` and
  `listings.review_notes` are all present — verified with `SHOW COLUMNS`. The
  "listing detail pages return 500" incident recorded in earlier versions of
  this file is **resolved**; do not re-diagnose it.
- **Photos are still `picsum.photos` placeholders in the data**, but the
  pipeline to replace them now exists (1.1). The rows hold *source URLs*, so
  the site hotlinks them until `npm run backfill:images` runs — which needs
  the R2 envs below.

### Post-mortem: the 503 spiral (2026-07-26)

The site went 503, then started hanging, then 503 again. `Max Processes` sat
pinned at the account's 200 cap (189/200 average) for an hour. Killing all
processes brought it back immediately.

**Mechanism.** A request that never resolves keeps its process alive. Processes
accumulate, the account-wide cap fills, and then *every* site on the account
answers 503 — including requests that would have been fine. The reason requests
never resolved: `src/db/index.ts` used mysql2's defaults, i.e. an unbounded
queue and **no acquire timeout**, so once the 6–8 pool connections were busy the
next request waited forever.

**What made it easy to hit.** The per-request canonical work (1.2) cost the
listing detail page its ISR cache, and the `/precios` link modules then added
three uncached queries to both hot page types. Measured: 12 queries per view on
the category and detail pages, now 9 with the medians cached.

**Fixed by** bounding the pool queue and adding timeouts (a stuck request now
fails in milliseconds and releases its process), caching the medians reads for
an hour, and adding `/api/health` (process alive?) plus `/api/health/db`
(MySQL alive, and how fast?) so the next incident is diagnosable in seconds
instead of hours.

**Still true, and the real risk:** this app shares a 200-process cap with ~90
other sites on an account at ~96% of plan resources. The code no longer *causes*
the spiral, but it cannot survive the neighbours either. Moving this site to its
own plan is the durable fix; everything above is damage control.

### Post-mortem worth keeping

The multi-hour outage during the domain migration had one root cause that is
easy to hit again: **the MySQL username is not the database name.** The
database is `u210059163_propia`; the user is `u210059163_anton`. hPanel's
Remote MySQL screen lists *databases*, which invites the wrong assumption.
Any `DATABASE_URL` for this project takes the form:

```
mysql://u210059163_anton:<password>@127.0.0.1:3306/u210059163_propia   # from the app
mysql://u210059163_anton:<password>@srv1724.hstgr.io:3306/u210059163_propia  # from a dev machine
```

Second lesson: the error page tells you which layer failed. `503` = the Node
process is not running (startup crash or account process limits). `Application
error … Digest:` = the process is running and a page threw. A request that
hangs and never resolves = neither — look at DNS/SSL or account resources.

---

## Decisions needed from you (these block work below)

> **Recording gap, 2026-08-19.** A chat session went through decisions the
> founder answered verbally (referred to there as D3–D19). **Only D1–D11
> exist in this file, and D3–D11 are still written as *recommendations* with
> unticked boxes — the answers were never committed.** D12–D19 do not exist in
> the repo at all. Anything gated on D7 (publish policy / F1), D10 (import vs
> manual edits / F61), D5 (featured pricing) or D9 (retention scope) is
> therefore still formally undecided *for a builder chat reading this file*,
> which is the only thing a builder chat can read. Paste those answers and
> they land here as ticked decisions; until then treat the "Recommended:"
> lines as proposals, not policy.

- [ ] **D1 — Product name.** The docs say "propia.com.py" everywhere; the UI
      says "Homes Paraguay" (commit `b5a4e0a`). Pick one; the loser gets
      renamed out of the docs and `metadata.title`s.
- [ ] **D2 — Domain order.** ARCHITECTURE.md §v2.1 says propia.com.py launches
      *first and alone* with the EN site `enabled: false`. Reality is the
      reverse: realestateinparaguay.com is live, propia.com.py is not attached,
      `NEXT_PUBLIC_CANONICAL_HOST=realestateinparaguay.com`, and
      `verticals.ts` still marks that host disabled (so it is silently served
      the Spanish propia experience). Decide which domains are on and which is
      canonical. The URL layer no longer waits on this (1.2 is done and treats
      the primary host as authoritative whatever `enabled` says); what is still
      wrong until you decide is the *experience* — the English domain serving
      Spanish copy — plus `realestateinparaguay.com` being `enabled: false`
      while it is the only live host.
- [ ] **D3 — Real financing terms.** `scripts/seed-financing.ts` ships
      placeholder Che Róga Porã / AFD numbers. Every venta card currently
      advertises a monthly cuota derived from invented terms.
- [ ] **D4 — USD→PYG rate** to quote (`USD_TO_PYG`, currently 6082).
- [ ] **D5 — Featured-listing pricing, and how money arrives.** In-app payment
      (an integration to pick and build) or invoice/transfer with an admin
      toggle? The toggle is a small build on the existing `featured_until`
      column; the integration is not. Blocks the rest of M7.
- [ ] **D6 — Second production domain: `inmobiliaria.com.py`, and
      `realestateinparaguay.com`'s role flips.** (session: 2026-08-16).
      This is a bigger architecture decision than it first looked —
      capturing it in full so it isn't re-litigated:
      - **One repo, one deployment, one database. Never fork the codebase.**
        Founder floated copying the repo into a second, independently-edited
        site; decided against it once we worked through the alternative
        below — it would mean hand-syncing every future fix across two
        copies and hand-syncing listing data across two databases forever.
      - **Admin/auth/import stay unforked too (decided, session:
        2026-08-16, second follow-up).** Founder floated a second full
        admin for realestateinparaguay.com, then a read-only site instead;
        landed on the actual default of the one-repo approach: `/admin` and
        `/agencia` are ordinary pages in this one app, so they are already
        reachable — same login, same data, same edit rights — from either
        domain's `/admin` or `/agencia` with **no extra build**. An agent
        can add/edit a property via `realestateinparaguay.com/admin` or
        `inmobiliaria.com.py/admin` and it's the same row either way. Only
        the public-facing pages (home, search, listing cards, nav, colors,
        copy) branch by resolved vertical for the different look/buyer
        positioning — the admin surface does not need or get a second
        identity.
      - **New primary/source-of-truth: `inmobiliaria.com.py` (Spanish).**
        Nearly all publishing happens here going forward — founder's own
        agency inventory plus other realtors' listings he takes on
        case-by-case until his EAS/SERPLAID license issues (~Oct 2026).
        This is also the `.com.py` domain `propia.com.py`'s `CANONICAL_HOST`
        placeholder was always meant to become. CLAUDE.md's domain table
        has been updated to match (session: 2026-08-16, fourth follow-up):
        the "his own agency brand only / never wire it into this app" line
        is gone, because the founder reversed that call. Do not restore it
        from memory of an older session.
      - **`realestateinparaguay.com` reverts to its originally-designed
        role: the English feeder, auto-translated from the Spanish rows.**
        This is literally what `src/config/verticals.ts`'s comment on that
        host already described as the eventual reversion once a `.com.py`
        domain existed — `inmobiliaria.com.py` is that domain.
        `listings.description_en` already exists for exactly this
        ("filled lazily (Claude API) for realestateinparaguay.com" —
        `src/db/schema.ts:76`); no batch job writes it yet.
      - **Refinement beyond the original plan (session: 2026-08-16,
        follow-up): all three domains get distinct positioning and visual
        identity, not just inmobiliaria.com.py.** The original architecture
        only ever specified realestateinparaguay.com as a *translated*,
        same-shell, hreflang'd copy of the primary ("translation ≠
        duplicate" in the `verticals.ts` comment). Founder now wants real
        design/copy/color-scheme divergence there too, driven by different
        target buyers:
        - `inmobiliaria.com.py` — Spanish, pitched at Paraguayan sellers.
        - `realestateinparaguay.com` — English, pitched at foreign investors.
        Same mechanism as the inmobiliaria.com.py design work already noted
        below (per-vertical theme tokens + copy dictionary + shell
        components, branching on the resolved vertical) — still one repo,
        one DB, one admin, listing data and translation pipeline shared.
        Just confirms the "different design per domain" ask applies to all
        non-primary domains, not only the new one. Not started.
      - **Translation scope (decided):** everything a visitor reads —
        title, description, property-type/amenity labels, not just the
        free-text description. Barrio/location names are assumed
        identical in Spanish and English and are NOT translated (confirm
        this holds for every barrio in the DB before relying on it — some
        neighborhood names may not be). **The batch job is BUILT**
        (2026-08-26, migration 0011): `npm run cron:translate` fills
        `title_en` / `description_en`, and `translation_hash` is what tells it
        an edit happened, so it is picked up without a publish-path hook (see
        `src/lib/translate.ts` for why a hook would be the wrong shape).
        **What is still missing is the reader half** — nothing prefers the
        English columns yet. That is flip-day work, and the sites are:
        `app/propiedad/[slug]/page.tsx` (title, description, `generateMetadata`),
        `src/components/ListingCard.tsx` (card title), `src/lib/jsonld.ts`
        (`description`), and the OG title. All four should read the `*_en`
        column when the resolved vertical's locale is `en` **and the column is
        non-null**, falling back to Spanish otherwise — a listing published
        five minutes before the cron runs must render, not blank.
      - **Flip timing (decided): wait.** `realestateinparaguay.com` is
        live and Spanish-indexed today — do not touch its `locale`/
        `filters` in `verticals.ts` yet. Sequence: (1) launch
        `inmobiliaria.com.py` in Spanish, same as realestateinparaguay.com
        is today: (2) build + verify the translation batch job against it;
        (3) only once translation coverage looks solid, flip
        `realestateinparaguay.com`'s vertical entry to
        `locale: "en", filters: { foreign_exposure: true }, copy: "foreign"`
        per the plan already written in its `verticals.ts` comment.
      - Routing groundwork already committed:
        `inmobiliaria.com.py` added to `src/config/verticals.ts` as an
        `enabled: true` vertical. New `VerticalKey: "inmobiliaria"`. Its
        `locale`/`copy` there is currently a placeholder copy of
        realestateinparaguay.com's and will need revisiting once the roles
        above are actually built.
      - **SEO — duplicate-content risk while both hosts are Spanish
        (fixed, session: 2026-08-16, third follow-up).** Both hosts serve
        the same DB rows; `ownsListingDetail` controls whether a host's
        `/propiedad` pages self-canonicalise or point back at the primary
        (`src/lib/origin.ts`). Originally set `true` on both, which would
        have had Google see two domains publishing identical listing pages
        — duplicate content, ranking cannibalisation, before translation
        even exists. Fixed: `inmobiliaria.com.py` ships with
        `ownsListingDetail: false` for now, so its listing detail pages
        canonicalise to realestateinparaguay.com like any other feeder;
        its other pages (home, search, guías) are unique content and index
        normally. Flip it to `true` — together with flipping
        realestateinparaguay.com to `locale: "en"` — only once
        inmobiliaria.com.py is the real primary and the EN content is
        genuinely translated, not a mirror. Not yet built: hreflang tags
        between the ES/EN listing pages (the `verticals.ts` comment on
        realestateinparaguay.com already calls this out as needed) and
        Search Console verification + sitemap submission for the new domain
        (new domain = zero history/authority with Google, won't rank on day
        one regardless of content quality).
      - **Sitemap is now host-aware (fixed, session: 2026-08-16, fourth
        follow-up).** The canonical fix above was only half the job:
        `app/sitemap.ts` built its origin per-host but still listed *every*
        URL for whichever domain asked, so inmobiliaria.com.py's sitemap
        would have submitted `/propiedad/...` URLs that canonicalise to
        realestateinparaguay.com — "submitted URL not selected as canonical"
        in Search Console, i.e. crawl budget and trust spent on URLs Google
        is told to ignore. Now `buildSitemapEntries({ includeListingDetail })`
        takes the flag and `app/sitemap.ts` passes
        `hostOwnsListingDetail()` (`src/lib/origin.ts`), which shares its
        predicate with `listingCanonicalOrigin()` so the sitemap and the
        canonical tag cannot disagree. The published rows are still read on
        every host — the category, agency and agent sections count them to
        decide what is indexable *there*. Rule for any future page type that
        one host owns and another doesn't: gate it in the sitemap the same
        way, in the same commit as the canonical rule.
      - **The vertical system is write-only today — the "consumption
        layer" is unbuilt, and it BLOCKS the English flip (documented,
        session: 2026-08-16, fourth follow-up).** `middleware.ts` resolves
        the host and sets `x-vertical` / `x-locale`, and that is where it
        ends. Nothing in the render path acts on either header:
        - `currentVertical()` (`src/lib/vertical-context.ts`) is called in
          exactly one place (`app/page.tsx:175`) and its result is
          discarded — the value is awaited, never read.
        - ~~There is **no `src/i18n/en.ts`**.~~ **LANDED 2026-08-21**
          (Batch 3 layer 2). `locale: "en"` now renders English copy. The
          *data* is still Spanish — `title_en`/`description_en` have no writer
          — so this closes the copy half of the flip precondition, not the
          translation half.
        - ~~There is **no per-vertical theming**~~ — **the token wire
          exists** (`src/design/themes.ts`, written onto `<html>` by
          `app/layout.tsx` for the resolved vertical, so every rule reading
          `var(--color-*)` follows the domain). `OVERRIDES` is empty on
          purpose: giving a door its own palette is an entry in that file, not
          a refactor. What is genuinely unbuilt is a **shell variant** — a
          different homepage composition per door — which is the founder's
          "fully separate visual identity" ask and is design work, not wiring.
        - **`VerticalConfig.copy` is still declared and never read — and
          re-checked 2026-08-21, it does NOT block the flip.** The two doors
          the flip concerns differ by *locale*, and `en.ts` is already written
          for foreign buyers (D6's own translation-scope decision), so
          `copy: "foreign"` would select copy the locale already selected.
          Its only non-redundant consumers are the Spanish feeder doors that
          share `es` but need a different pitch — `terreno` ("land"),
          `alquiler` ("rental") — and neither domain is owned. Consuming it
          today means writing copy for doors that may never open. Leave it
          declared; build the branch when a feeder actually launches.
        - ~~**`VerticalConfig.filters` is never applied to a query.**~~
          **FIXED 2026-08-21.** `verticalConds()` (`src/lib/facet-sql.ts`) is
          now ANDed into the category grid and its indexability count, the map
          pins, the home rails, the operation hub, similar listings and the
          sitemap. `listings.foreign_exposure` is read by it, so
          `filters: { foreign_exposure: true }` on realestateinparaguay.com
          will do what it says on flip day. No enabled vertical declares
          filters today, so nothing a visitor sees changed. Note for whoever
          adds the next cached query: the vertical key must join its cache key
          (the home payload and the sitemap entries already do).
        Consequence for sequencing: flipping `realestateinparaguay.com` to
        `locale: "en"` today would produce a Spanish site that merely
        *claims* to be English — worse than the status quo, since hreflang
        and Search Console would both be lied to. The consumption layer
        (locale-aware copy + `en.ts`, per-vertical theme/shell, filter
        application in the query builders) is a **build task that must land
        before the flip is even possible**, and it is separate from the
        translation batch job (that fills `*_en` data; this reads it).
      - **Flip-day checklist — every item changes together, in one commit +
        one env change.** Nothing here is safe to do alone; CLAUDE.md's
        domain section says the same and points back at this list. When
        `realestateinparaguay.com` goes English:
        1. **`NEXT_PUBLIC_CANONICAL_HOST` on Hostinger** →
           `inmobiliaria.com.py`. This is an env change in hPanel, not a
           code change, so it is the one item a `git revert` cannot undo —
           note the old value before touching it. It also needs a rebuild:
           `NEXT_PUBLIC_*` is inlined at build time.
        2. **`src/config/verticals.ts` → `realestateinparaguay.com`**:
           `locale: "es"` → `"en"`, add
           `filters: { foreign_exposure: true }`, `copy: "ownership"` →
           `"foreign"`, and keep `ownsListingDetail: true` (translated
           pages are its own content, not duplicates). Replace the INTERIM
           comment on the entry with its real role.
        3. **`src/config/verticals.ts` → `inmobiliaria.com.py`**:
           `ownsListingDetail: false` → `true`, and drop the "INTENTIONAL
           and TEMPORARY" paragraph. This is what makes its `/propiedad`
           pages self-canonicalise *and* what puts them back into its
           sitemap — one flag, both effects, no separate sitemap change.
        4. **hreflang** between the two hosts' listing pages must ship in
           the same release, or the two now-distinct language versions
           compete instead of pairing. **The mechanism landed 2026-08-21**
           (`src/lib/alternates.ts`, wired into home, the operation hubs,
           indexable category pages and `/propiedad`): it reads the same
           `verticals.ts` entries this checklist edits, so items 2–3 turn the
           tags on by themselves — there is no separate hreflang commit to
           forget. It emits nothing today by design (two Spanish doors are a
           canonical problem, not a translation pair). `npm run verify:seo`
           drives it against a synthetic post-flip table, so flip-day output
           is proven before flip day.
        5. **CLAUDE.md**: update the domain table (both hosts change role)
           and its `CANONICAL_HOST` warning — the trap it describes is
           precisely items 1–3 being done separately. CLAUDE.md is the file
           the next session reads first; a stale table there is how this
           work gets reverted.
        6. **Search Console**: submit `inmobiliaria.com.py`'s sitemap as
           primary; expect a re-index period on both properties.
        Precondition for the whole list: the consumption layer above exists
        and the translation job has filled the `*_en` columns. Do not run
        the checklist before then.
      - **Blog:** there is no blog in this codebase. The closest thing is
        `/guias` (barrio guides, admin at `/admin/guias`), already
        canonical-aware. Not addressed yet whether guides content should
        be shared, forked per audience (Paraguayan sellers vs. foreign
        investors likely want different topics), or is in scope at all for
        this domain split — needs a decision before any guides work here.
      - Design/copy: founder wants **fully separate visual identity** for
        inmobiliaria.com.py — not a reskin, closer to a second frontend on
        the same backend/admin/DB. Not started.
      - **Also still needed, deferred:** a per-listing publish-target
        toggle — two boolean columns on `listings` (default both `true`,
        i.e. publish everywhere), a checkbox pair in the panel/admin
        listing form, and the public queries (home, search, sitemap,
        detail page) filtered by host. This is a DB migration against the
        live prod database, so it needs a deliberate go-ahead before it's
        built, not folded in silently with the design/translation work.
      - Founder wants to talk through the build more (and possibly use a
        different model for the design-heavy part) before continuing.
        Paused here — do not resume the schema change, translation job, or
        visual build without checking in first.

- [ ] **D7 — Publish policy for agencies (this IS the audit's open P0, F1).**
      Today FSBO submissions always pass `pending_review` while any
      self-registered agency can set `published` directly
      (`AGENCY_STATUSES` in `app/agencia/actions.ts`) — the review queue the
      trust story rests on is advisory. **Recommended default: everyone goes
      through review, plus a per-agency `trusted` flag (set manually in
      `/admin`, like `is_verified`) that skips the queue.** Veto only if you
      want agencies to keep direct publish.
- [ ] **D8 — FSBO owner panel: in scope now?** A consumer who publishes via
      `/publicar` currently has NO page after approval: can't see, edit or
      pause their listing, and their leads route `internal` where only
      `/admin/leads` sees them (audit F4 is the same loop). **Recommended:
      yes — Batch 2 below (F4 contact fix → minimal owner panel → lead
      notifications) completes the FSBO loop end-to-end.**
- [ ] **D9 — Buyer retention features (favorites + real saved-search /
      price-alert engine).** `PriceAlert` today is a manual lead with no
      engine behind it; no favorites/saved-search exists. **Recommended:
      build in Batch 4, after the FSBO loop and before/alongside i18n —
      lightweight version only (favorites + weekly "nuevos en tu zona"
      digest), not a full buyer-account system.**
- [ ] **D10 — Import vs manual edits: who wins? (audit F61.)** Re-importing a
      feed currently overwrites panel edits silently. **Recommended: manual
      edits win — track `manually_edited_at` and have the importer skip+flag
      those rows instead of overwriting.** Veto if a feed should be the
      source of truth.
- [ ] **D11 — AFK auto-merge policy for the builder chats (Opus/Sonnet).**
      Merge = Hostinger auto-deploy, no staging. **REVISED 2026-08-19 by D20:**
      the original (a) — "CI is a required check and branch protection is on" —
      cannot happen without GitHub Actions, and Actions are off. So: (a) every
      builder session runs `npm run verify:local` and pushes through the
      pre-push hook, which is the same three checks CI would have run;
      (b) PRs touching `src/db/schema.ts` (MIGRATION REQUIRED) are NEVER
      auto-merged — you merge those by hand and run `npm run db:migrate`
      against prod; (c) **everything else waits for your merge click too**,
      because with no required status check there is nothing for auto-merge to
      wait on. A green hook on the builder's machine is not visible to GitHub.
      The alternative if the merge clicks become the bottleneck: one small
      workflow, `ubuntu-latest`, `timeout-minutes: 5`, `paths-ignore` for docs
      — roughly 3 minutes per push on one repo. That is a deliberate spend, not
      a default; say the word and it lands.

- [x] **D20 — CI runs locally, not on GitHub Actions.** (session: 2026-08-19,
      founder asked to cut GitHub minutes.) Actions minutes bill **per account,
      not per repo**, so fifteen repos each running a harmless 3-minute build
      cost the same as one repo running a disaster — and the waste is invisible
      until the quota is gone. This repo deploys via hPanel → Node.js App →
      Import Git Repository: GitHub holds the code and fires a **webhook**,
      which is free and unmetered and never appears in Actions billing. So a
      workflow file here would add cost to a deploy path that does not use it.
      Built instead (Batch 0): `.githooks/pre-push` = `typecheck` + `build` +
      `verify:import`; `.githooks/pre-commit` = refuse `.github/workflows/**`;
      `npm run verify:local` to run the gate by hand; wired by `prepare` on
      `npm install`, or `npm run hooks:install`. `verify:scopes` stays manual —
      it needs a localhost database and refuses to run against anything else.
      **[YOU], account-level, where the actual minutes are going** — this repo
      has never had a workflow, so its usage is already 0 and the spend is in
      *other* repos: (1) github.com/settings/billing → set the Actions spending
      limit to **$0** (runs get blocked, never billed); (2) per repo →
      Settings → Actions → General → **Disable actions** on anything that
      deploys off-GitHub; (3) turn **off Copilot code review** on private repos
      — it consumes Actions minutes per PR and it is easy to miss.

## [YOU] — production items code cannot reach

- [ ] ⚠️ **Run `npm run db:migrate` against prod when you merge.** Two
      migrations are generated but not applied:
      • `drizzle/0002` reorders `idx_search` and adds `idx_recent` on
        `listings` (the EXPLAIN audit in step 4). No risk, no rush — the app
        runs fine without it, category pages just keep the slower plan.
      • `drizzle/0003` creates `listing_views_daily`. **This one the code does
        touch:** without the table, every listing detail page render tries to
        count a view and fails. The failure is swallowed (the counter is
        wrapped in try/catch and runs after the response, so pages still
        render) but the panel will report zero views until it exists.
      Both are fast — one DROP/CREATE INDEX pair and one small CREATE TABLE.
      Standing rule: a schema change is not done until the migration has run
      against prod.
- [x] ~~`GHL_WEBHOOK_URL` + `GHL_API_KEY`~~ **No longer required — GHL is
      optional.** Leads were always written to MySQL *before* the CRM push, so
      the push was a copy and nothing is lost without it; `/admin/leads` is now
      the founder's inbox and `/agencia/leads` the agency's. The one thing GHL
      really carried was OTP delivery, and that had a trap: with no key
      configured the provider logged the code server-side and returned
      **success**, so production told publishers "we sent you a code" that could
      never arrive. Now `isMessagingConfigured()` decides: no provider → the
      wizard publishes straight to `pending_review` (login + review are the
      gate) and the row is *not* flagged phone-verified; a provider that fails
      → an honest error, never a fake send.
      Optional later: set `LEAD_WEBHOOK_URL` to any endpoint (n8n, your own
      CRM, GHL) to get lead pushes and re-enable OTP.
- [ ] **Cloudflare R2 bucket + `R2_*` envs + image host mapping.** Now the
      blocker rather than a companion task: 1.1 is written and builds, but
      until `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and
      `R2_BUCKET` exist in the production env, every upload button says
      "storage not configured". Also map `R2_PUBLIC_BASE_URL`
      (img.propia.com.py) to the bucket's public URL, then run
      `npm run backfill:images` once to stop hotlinking the import sources.
- [ ] ⚠️ **Sign the lawyer agreement — before inmobiliaria.com.py launches.**
      (session: 2026-08-16.) The pre-license operating model is: founder does
      marketing/lead-gen only, all leads go to the licensed lawyer, she pays
      commission afterwards. A contract for this was drafted earlier but the
      founder is **not sure it was ever signed**. Confirm; if it can't be
      confirmed, sign a fresh one-page version covering: who sends leads,
      commission %, and when it's paid. This is the actual legal protection —
      an under-construction banner or popup on the site is not, and isn't
      worth building. The one site change worth making later: a short footer
      line identifying who brokers the deals, with wording from the lawyer,
      as part of the inmobiliaria.com.py design pass.
- [ ] **inmobiliaria.com.py is PARKED on the realestateinparaguay.com
      Node.js site as of 2026-08-16** (alias/parked domain, NOT a second
      app — the setup Hostinger support recommended). Both domains now hit
      the same deployment; the app routes by hostname (middleware.ts) and
      the merged canonical + sitemap protections (PR #42) are what makes
      serving identical Spanish rows on two hosts safe. Still to do:
      1. Verify https://inmobiliaria.com.py loads with valid SSL (and www),
         and that a /propiedad page there emits a canonical pointing at
         realestateinparaguay.com and /sitemap.xml omits /propiedad URLs.
      2. Search Console property + sitemap submission for the new domain
         (folds into the GA4/GSC item below).
- [ ] GA4 + Search Console properties.
- [ ] hPanel cron jobs: `cron:cuotas`, `cron:medians` (nightly).
- [ ] **Security hygiene from the migration session:** rotate the MySQL
      password and the panel login password (both were typed into a chat
      transcript), and delete the `%` ("Any Host") Remote MySQL grant that was
      added while debugging — it was never the cause and leaves port 3306 open
      to any IP.
- [ ] **Account capacity.** The Brazil account runs 91 sites at ~96% of plan
      resources, and Max Processes has breached its cap (169/200 average).
      That is a live risk to this site's uptime, not a future concern.

---

## Milestone status (ARCHITECTURE.md §6)

| Milestone | Code | Gate cleared? |
| --- | --- | --- |
| M0 Rails (deploy, DB, R2) | ✅ deploy + DB + R2 pipeline built | ⏳ R2 envs not set, so no photo has been stored yet |
| M1 Schema + seeds | ✅ done | ⚠️ financing rates are placeholders (D3) |
| M2 Minimum supply (importer, review queue) | ✅ done | ⏳ 50 hand-audited listings not confirmed |
| M3 Public launch surface | ✅ done | ✅ canonical host is per-request (1.2) |
| M4 Search, filters & map | ✅ filters, search, EXPLAIN audit (index fixed, migration 0002), bbox map API + split list/map view, one shared typed facet builder | ✅ code complete |
| M5 Wizard, OTP & accounts | ✅ wizard, auth, admin user management, self-registration, profile editing; publishing no longer needs OTP | ✅ no external provider required |
| M6 Scrape importers + SEO at scale | 🔶 link-import (3.5) + `/precios` pages and internal link modules done; barrio guides remain | ⏳ Screaming Frog crawl not run |
| M7 Monetization & feeders | 🔶 valuation magnet done | ⏳ featured/preventa need a pricing decision (D5) |

---

## 2026-08-19 repo review — verified state, gaps, and the build batches

Full re-verification of `docs/audit-2026-08.md` against HEAD plus a roles /
i18n / buyer-UX review. Every claim below was checked in code this session,
not remembered.

### Audit findings: 55 of 64 are FIXED (PRs #54–#57)

`docs/audit-2026-08.md` now carries a status header; do not re-audit fixed
items. Still open / partial:

| ID | Sev | Status | What remains |
| --- | --- | --- | --- |
| F1 | P0 | OPEN | Agency can self-publish; review queue bypassable → **D7** |
| F4 | P1 | OPEN | FSBO listing has no WhatsApp contact; its leads route `internal` and no panel shows them → **D8 / Batch 2** |
| F48 | P3 | **FIXED 2026-08-19** | First publish only, in all three writers: `listing-edit.ts` (reads `publishedAt` in the row it already selects), `approveListing` and `setPanelListingStatus` (`coalesce(published_at, now())` — no extra round-trip, no race) |
| F61 | P3 | OPEN | Re-import overwrites manual edits → **D10** |
| F63 | P3 | **CLOSED 2026-08-19** | No code change: ARCHITECTURE.md §4 already documents `0 → 404 (via notFound()) or redirect to parent — a true 410 would need a route handler and buys nothing over 404 for deindexing`. Code and doc agree; the audit row was stale |
| F17 | P1 | **RESCOPED + DONE 2026-08-20** | The route-cache half is dead ground and the data-cache half is now finished. See "F17, re-measured" below |
| F38 | P2 | **FIXED 2026-08-26** | `listings.display_lat/display_lng` materialised at write time (`src/lib/geo.ts`), `idx_geo` repointed at them, the bbox join dropped. MIGRATION `0010` — see "Pending migration" |
| F43 | P2 | **FIXED 2026-08-26** | `/sitemap.xml` is a `<urlset>` under 10 000 URLs and a `<sitemapindex>` over it, with chunks at `/sitemap/{n}.xml`. Route handlers, not `generateSitemaps()` — that enumerates its ids at build time and the build has no database. No migration |

### F17, re-measured (2026-08-20) — the route cache is not the win

Measured against HEAD with `npm run build`, not reasoned about:

- **Baseline: every route is `ƒ (Dynamic)`.** All 49 pages, `/terminos`
  included. Only `/icon.svg` is `○`.
- **The root layout is indeed the global blocker.** Stubbing `brandMeta()`,
  `siteOrigin()` and `currentVertical()` out of `app/layout.tsx` and adding a
  throwaway `<p>hi</p>` page made Next attempt to prerender it. Confirmed.
- **The CSP nonce does NOT block static rendering** here, contrary to the
  usual warning about nonces. One less obstacle.
- **`app/not-found.tsx` was a second, undocumented blocker**: it called
  `listCities()`, so the prerender attempt died on `ECONNREFUSED 127.0.0.1:3306`.
  The global not-found boundary is bundled into every static export, so no page
  could prerender while it queried the DB — and every 404 in production paid a
  round-trip. Fixed in this PR (cached + `.catch(() => [])`).

**Why "middleware-resolved brand" cannot work.** The full route cache is keyed
by path and nothing else. Two hosts must emit two different documents (`Real
Estate in Paraguay` vs `Inmobiliaria Paraguay` in `<title>`, header lockup,
footer, OG `siteName`). One file keyed on `/terminos` cannot hold both, and a
middleware header read at render time is itself the dynamic API being removed.
The brand has to enter through the **URL** or not at all:

```
/terminos  ->  rewrite to /en/terminos  |  /inmobiliaria/terminos
app/[vertical]/terminos/page.tsx + generateStaticParams(['en','inmobiliaria'])
```

**Why that is a bad trade today.** It moves all ~49 route files and rethreads
132 `brandName()` / `siteOrigin()` / `currentVertical()` call sites across 41
files from `headers()` to `params` — and it collides with Batch 3, which
rewrites the same buyer-facing components. What it buys is ~10–12 pages
(`/terminos`, `/privacidad`, `/nosotros`, `/preguntas-frecuentes`,
`/como-funciona`, `/financiamiento`, `/para-inmobiliarias`, `/planes`,
`/datos`, `/contacto`). Those are the only ones with neither a DB read nor
search params — and they already do zero DB work, so their dynamic render is a
template render. Everything implicated in the 503s (`/`, `/[operacion]/*`,
`/propiedad/[slug]`, `/precios`) reads the database and the query string and
can never hold a route cache regardless.

**So F17's premise was wrong.** Static HTML cannot reach the pages that fell
over; cached *data* can. A dynamic render over a warm data cache costs one
render and zero queries, which is the actual 503 shape. That is what this PR
finishes, extending the pattern already proven on the home payload:

| Cached | Tag | Writer |
| --- | --- | --- |
| `listCities()` — the hottest query in the app (home, both category routes, /tasacion, every 404) | `locations` | none needed; seed data |
| agency / agent / developer directories, `listAllProjects`, `getPortalStats`, `listFinancingPrograms` | `directory` | admin inmobiliarias + agentes actions, agencia perfil action |
| `/guias` index and post detail | `guides` | every write in `app/admin/guias/actions.ts` |
| home payload, sitemap (pre-existing) | `listings` | admin + agencia listing, photo and import actions |
| price medians, valuation (pre-existing) | `market-medians` | nightly job / TTL |

Two things that were quietly broken and are now fixed: `revalidatePath()` does
**not** clear `unstable_cache` entries, so nothing ever invalidated the home
payload — an approved listing took up to 10 minutes to appear. Every tag above
now has a named writer calling `revalidateListings()` / `revalidateDirectory()`
/ `revalidateGuides()` from `src/lib/cache.ts`; the TTL is the backstop, not
the mechanism. And a cached entry is serialized, so `Date` comes back as an ISO
string — the guides and financing readers re-wrap at the cache boundary rather
than leaving the next reader to trip over `string > Date`.

**If the route cache is still wanted**, it is a multi-PR project of its own and
belongs *after* Batch 3, not inside Batch 1. Its prerequisites are now down to
one: the `[vertical]` segment rewrite. `not-found.tsx` no longer blocks it.


### Roles — verified model and gaps

Enum: `consumer` (default) / `agent` / `agency_admin` / `developer` / `admin`.
Agency teams already work (`/agencia/equipo`, invites, promote/demote,
last-admin guard) — an invited `agent` IS the "employee" role; no new global
role needed for that.

Real gaps, in priority order:
1. **FSBO owners have no panel** (see F4/D8). The `owner` EditScope exists in
   code; no route uses it post-publish.
2. **Publish-policy asymmetry** = F1/D7.
3. **Agents see the whole agency's listings + leads** — no per-agent
   assignment. Probably correct for small PY agencies today; noted as a later
   option (`assigned_agent_id` + optional "only mine" scope), not a build item.
4. **No buyer accounts / favorites / working alerts** → D9.
5. **`developer` role is dormant** — in the enum, mapped to no panel. Reserved;
   a `/proyecto`-owner panel is a someday item.
6. **Admin "moderator" tier** (review queue + leads only) — cheap to add when
   the founder hires help; unnecessary while solo.

### Language swap — real scope (bigger than "add en.ts")

Verified at the time (2026-08-19; layers 1 and 2 and the filter consumption
have since landed — see the 2026-08-21 section): no `en.ts`, no
`getDictionary`, `x-locale` header set by middleware
and read by nothing, `vertical.filters`/`.copy` never consumed,
`description_en`/`guide_content_en` columns exist with no read/write path,
no toggle UI. **And `es.ts` mostly covers admin/panel/publish — the
buyer-facing surface (home ~39 literals, category page, SearchBar,
CategoryFilterBar, ListingCard, detail ~18 literals) is inline Spanish JSX.**
So the swap is four sequential layers (Batch 3): (1) extract buyer-facing
strings into the dictionary + a `getDictionary(locale)` helper keyed off
`x-locale`; (2) write `en.ts`; (3) translation batch job (Claude API) filling
`title_en`/`description_en` on publish/edit — new columns, MIGRATION; (4) the
existing D6 flip-day checklist (hreflang, env var, verticals) in one release.
A visitor-facing ES/EN "toggle" is a cross-domain link to the sister host's
listing (domain = language), cheap once hreflang exists — not a `?lang=`
switch.

#### Layer 1 landed 2026-08-20 — extraction + `getDictionary`

The buyer-facing surface is out of the JSX and into `src/i18n/es.ts`:
`esHome`, `esHub`, `esCategory`, `esSearchBar`, `esFilters`, `esCard`,
`esListing`. Extraction only — every string is byte-identical to the literal
it replaced, no schema change, no new column, no `en.ts`.

The lookup layer is split the same way `brand.ts` / `brand-server.ts` is, and
for the same reason (`SearchBar` and five other client components import the
dictionary, so it must never reach `next/headers`):

- `src/i18n/index.ts` — client-safe. `getDictionary(locale)`, `Locale`,
  `DEFAULT_LOCALE`, `parseLocale`, and `Dictionary` derived as
  `typeof esDictionary`.
- `src/i18n/server.ts` — `server-only`. `currentLocale()` reads the `x-locale`
  header, `dict()` returns that request's dictionary. **This is the first
  consumer of `x-locale`**, which the middleware has been setting since the
  vertical routing layer landed and nothing read.

Three consequences worth knowing before layer 2:

- `Dictionary` being derived rather than hand-written means `en.ts` is a type
  error until it is complete. A missing key cannot ship as a blank string.
- `ListingCard` and `CategoryFilterBar` became async server components (they
  await `dict()`). Neither is rendered from a client component — checked.
- Number formatting is separate from copy: `toLocaleString` takes a locale
  derived from the request, because the thousands separator differs even
  where the words do not. Today both hosts resolve to `es-PY`, so nothing a
  visitor sees changed.

What layer 2 has to do is now confined to writing `en.ts` and adding it to
`DICTIONARIES` — no page, component or call site changes again.

### Product ideas agreed into scope (from audit §4 + this review)

Ordered by leverage at zero users:
1. **Operator lead notifications** (audit I10) — WhatsApp/email ping on new
   lead + new review-queue item. Small; solo operator currently finds both by
   chance. (Batch 2.)
2. **Real photos** — purely the `[YOU]` R2 envs. Blocks perceived quality of
   everything else.
3. **Favorites + real saved-search/price-alert engine** (I2/I7, D9, Batch 4).
4. **Valuation → publish funnel** (I4) — `/tasacion` CTA pre-fills
   `/publicar`. Small; manufactures supply. (Batch 4.)
5. **Featured listings, admin-toggle variant** (D5) — on `featured_until`,
   invoice/transfer; skip payment integration until demand. (Batch 4.)
6. Filter depth (baños/área/amenities, by-m² sort) — deferred until inventory
   justifies it.

### Build batches for the builder chats (Opus/Sonnet, PR-per-item)

Guardrails for every builder session: CLAUDE.md + the Standing rules below;
any `schema.ts` PR is MIGRATION REQUIRED and never auto-merged (D11); never
touch `drizzle.config.ts` / `src/db/index.ts`; `npx tsc --noEmit` +
`npm run build` before push; `npm run verify:scopes` on anything touching
panel scoping.

- **Batch 0 — the quality gate (first, alone, blocking). DONE 2026-08-19, and
  it is NOT GitHub Actions.** Superseded by D20 below: minutes are billed per
  *account* across every repo, and this repo deploys through a Hostinger
  webhook, so a workflow here buys nothing the deploy needs. The gate is local
  instead — `.githooks/pre-push` runs `typecheck` + `build` + `verify:import`
  (also available as `npm run verify:local`), and `.githooks/pre-commit`
  refuses any file under `.github/workflows/`. `npm install` wires both up via
  the `prepare` script; a builder session that skipped it runs
  `npm run hooks:install`. Consequence for the batches: there is no required
  status check to gate on, so **auto-merge is off** — see the revised D11.
- **Batch 1 — independent fixes (parallel PRs):** F1+trusted flag (per D7,
  MIGRATION for the flag column), ~~F48~~ (done), ~~F63~~ (closed, no change),
  F17 finish, ~~F38 display coordinate~~ (**DONE 2026-08-26**, MIGRATION 0010),
  F61 per D10 (MIGRATION).
  The three MIGRATION items are also the three gated on an unrecorded decision
  (D7, D10) — see the decision-record gap below.
- **Batch 2 — FSBO loop (sequential, shared files):** ~~F4 contact fallback~~
  (**DONE 2026-08-20**, PR #62) → minimal owner panel (D8, still gated on the
  decision) → ~~operator lead notifications (I10)~~ (**DONE 2026-08-20**,
  PR #63). Until D8 lands, an FSBO lead reaches its publisher by the operator
  forwarding it from /admin/leads.
- **Batch 3 — i18n (strictly sequential):** ~~string extraction →
  `getDictionary`~~ (**DONE 2026-08-20**) → ~~`en.ts`~~ (**DONE 2026-08-21**,
  see the section at the end) → ~~translation job~~ (**DONE 2026-08-26**,
  MIGRATION 0011 for `title_en` + `translation_hash`).
  Flip day itself stays gated on D6's checklist and is NOT part of the batch.
- **Batch 4 — retention & monetisation (mostly parallel):** favorites +
  saved-search/alert engine (D9, MIGRATION), ~~valuation→publish funnel~~
  (**DONE 2026-08-20**, PR #64), featured toggle (D5 decision permitting).

Dependency notes: Batch 0 is done (locally, not in CI) and no longer blocks
anything; Batch 2 items are ordered;
Batch 3 items are ordered; Batches 1/2/4 are independent of each other except
that lead notifications (Batch 2) should land before the alert engine
(Batch 4) reuses its delivery path.

## Codeable work, in priority order

Everything below is `[C]` unless marked otherwise. Ordered so each step makes
the product more usable than the last.

### Step 1 — Make the portal genuinely usable

- [x] **1.1 R2 image pipeline.** ✅ Code done — **waiting on the `[YOU]` R2
      envs to actually run.** `src/lib/r2.ts` (S3 client pointed at R2),
      `src/lib/images.ts` (sharp: EXIF-oriented, downscaled to 1600px + a
      480px thumb, re-encoded to WebP) and `src/lib/listing-images.ts` (the
      same `EditScope` guard the edit layer uses, extended with an `owner`
      scope for FSBO publishers). Upload/delete/reorder/set-cover in both
      panels via one shared `PhotoManager`, photo upload in the publish
      wizard as soon as a draft row exists, and
      `npm run backfill:images [--dry-run] [--limit N]` to pull the importer's
      remote URLs into the bucket and rewrite `r2_key`.
      Two things worth knowing: re-encoding is what makes the upload path
      safe — a file that only claims to be an image never gets stored, and
      **EXIF GPS is dropped** rather than served (schema §2.1 says precise
      coordinates are never public). And cards now request the thumb, so a
      category page stops pulling ~20 full-size photos over mobile data.
      Until the envs are set the panel shows "photo storage is not
      configured" instead of failing — missing config is a disabled feature,
      never a crash.
- [x] **1.2 Per-request canonical host.** ✅ Done — `src/lib/origin.ts` derives
      the origin from the `Host` header, the way `middleware.ts` already
      resolves the vertical, and every absolute URL (canonical, OG, JSON-LD,
      sitemap, robots, the CRM's listing link) now goes through it. Two
      functions, because detail pages are the one page type whose owning host
      isn't simply the host that served it: `siteOrigin()` and
      `listingCanonicalOrigin()` (ARCHITECTURE §2.8 — feeders canonicalise
      their detail pages back to the primary host; EN owns its own).
      A host speaks for itself only if it is an enabled vertical **or** the
      `NEXT_PUBLIC_CANONICAL_HOST` primary — so unknown hosts (previews, the
      raw `*.hostingersite.com` name) still point at the primary instead of
      indexing themselves. Verified against a running build: the live host
      self-canonicals exactly as before (no regression), propia.com.py starts
      self-canonicalling the moment it is attached, and disabled feeders point
      at the primary. **D2 no longer gates any of this** — it now only decides
      which verticals are `enabled` and what the env var says.
- [x] **1.3 Listing editing for owners.** ✅ Done — `/agencia/propiedad/[id]`
      edits every field, not just status. Shares one form component and one
      parser with the admin edit (`src/components/panel/ListingForm.tsx`,
      `src/lib/listing-form-input.ts`) so the two can never validate
      differently. Photos included as of 1.1 (shared `PhotoManager`).

### Step 2 — Admin control plane

- [x] **2.1 `/admin/usuarios` — user management.** ✅ Done. Third `/admin` tab:
      create users, edit name/email/role/locale, reset a password (which also
      revokes that user's open sessions), and delete a user (sessions removed,
      their `agents` row unlinked but kept so the public profile and its
      listings survive). Lockout guards live in the server actions, not the UI:
      no changing your own role, no deleting your own account, no removing the
      last super-admin. No migration — existing columns only.
- [x] **2.2 `/admin/propiedades` — all listings.** ✅ Done — status filter
      chips with counts, title/public-id search, and edit at
      `/admin/propiedades/[id]` covering every field, the full status
      lifecycle, and hard delete. Scope is an `EditScope` enforced in the query
      layer's WHERE clause (`src/lib/listing-edit.ts`), so the same code serves
      the agency panel without it ever reaching another agency's rows.
- [x] **2.3 Link users to agencies in the UI.** ✅ Done as part of 2.1 — each
      user card has an agency picker that creates or repoints the `agents` row
      `requireAgencyContext()` reads. Onboarding an agency no longer needs
      database access.

### Step 3 — Supply-side self-service

- [x] **3.1 Registration for agents and agencies.** ✅ Done — `/registro`
      creates the login plus its profile rows in one call
      (`src/lib/registration.ts`): an *inmobiliaria* gets a `users` row
      (`agency_admin`), an `agencies` row and the `agents` row that links them;
      an *agente independiente* gets a `users` row (`agent`) and an `agents`
      row with `agency_id` NULL. Both start `is_verified = false`, so sign-up
      grants a login and never trust — the ✓ badge is still your manual call,
      and listings still pass the review queue. The new account is logged in
      immediately, and the form has no `role` field to forge: role, agency link
      and verification state are all decided server-side.
      **This exposed a real gap it had to fix:** the whole `/agencia` panel
      assumed an `agency_id`, so an independent agent would have logged in to
      an empty dashboard and been unable to edit the listing they just
      published. `panelScope()` (auth/guards.ts) now resolves an agency account
      to its agency and an independent to `owner_user_id` — the same `owner`
      scope the wizard uses — and the dashboard listings, leads inbox, status
      changes, edit form and photo actions all run through it.
- [x] **3.2 Profile editing.** ✅ Done — `/agencia/perfil` (fourth tab) edits
      the company record (name, logo, WhatsApp, contact email), the caller's own
      public agent profile (name, photo, WhatsApp) and their own login (name,
      email, password). Three separate permissions, not one form: the company
      record is **agency-admin only** — an `agent` inside the agency sees it
      read-only and a forged POST is refused — while every user owns their agent
      profile and their login. Changing a password revokes every session for
      that user and reissues one for the browser doing it, so a stolen cookie
      cannot outlive the change. Slugs are never rewritten on a rename, same SEO
      contract as listings.
      _Not included:_ a **description/bio** field. The plan assumed the schema
      had one; it does not (`agencies` has name/logo/whatsapp/email, `agents`
      name/photo/whatsapp). Adding it is a one-column migration — say the word
      and it lands with MIGRATION REQUIRED. Logo and photo are URL fields for
      now rather than uploads, even though 1.1 could power an upload.
- [x] **3.3 Per-listing stats for the owner.** ✅ Done — **MIGRATION REQUIRED
      (`drizzle/0003`, new `listing_views_daily` table).** Views and leads per
      listing over a rolling 30 days: totals across the top of `/agencia`, two
      columns in the listings table, and a figures-plus-30-day-bars card at the
      top of every edit page (admin and agency, same component).
      Four decisions worth keeping:
      **(a) One row per listing per day, not per view** — an owner asks "how
      many people saw my ad this week", never "who saw it at 14:03", and a
      row-per-view would be the fastest-growing table in the schema for an
      answer nobody wants. **(b) Counted after the response** via Next's
      `after()`, so stats never cost the visitor latency and a failed counter
      never breaks a page that rendered fine. **(c) Crawlers excluded**
      (`view-tracking.ts`) — an owner who sees "420 views" and gets no calls
      concludes the portal is broken; if most of those were Googlebot the
      number lied. **(d) UPDATE-then-INSERT, not `ON DUPLICATE KEY UPDATE`**,
      which is MySQL-only and the schema's first rule is that the Postgres
      escape hatch stays open; the insert race is caught and retried as an
      update.
      Verified against a real database and a real browser: 3 human views
      counted and 3 bot views ignored end-to-end, 8 concurrent first-views of
      the same listing produce one row and lose none of the 8, views older than
      the window excluded, another agency's scope sees nothing, and the panel
      renders 188 views / 3 leads with a 30-bar trend.
- [x] **3.4 `/admin/leads` — every lead the site captured.** ✅ Done — third
      `/admin` tab: type filter chips with counts, search by name / WhatsApp /
      email, the owning agency (or “Interno” when the lead is yours), which
      vertical captured it, the listing it came from, and a one-tap WhatsApp
      reply. This is the only place `routed_to = 'internal'` leads (valuation,
      seller) are visible at all — no agency panel shows them.
      Note: `/admin` reached eight tabs, past what fits one row on a phone.
      **Grouped 2026-08-21** rather than appended: `PanelTab.group` splits the
      row into the daily work (revisión / propiedades / consultas) and a
      quieter "Administración" row for the records behind it (guías, importar,
      inmobiliarias, agentes, usuarios). A second row, not a disclosure — the
      panel ships no client JS, so a collapsed menu could not remember its
      state, and a menu that hides where you are is worse than one that is
      merely quieter. `/agencia` is untouched: `group` defaults to `"main"`.

### Step 4 — Finish M4 (search, filters & map)

- [x] **Map API: bounding-box endpoint.** ✅ `GET /api/mapa?bbox=…` plus the
      same filter vocabulary the category URLs use, so pins and grid can never
      disagree. `src/lib/map-queries.ts` owns the rule that matters:
      **coordinates are rounded to 3 decimals (~110 m) before they leave the
      module**, because `lat`/`lng` and `address_text` are "never shown publicly
      at full precision" (schema §2.1) — a pin on the exact building tells a
      stranger which house is empty and for sale. A listing with no coordinates
      of its own borrows its barrio/city centroid and is flagged
      `approximate: true` (dashed pin) rather than being invented into a
      position or dropped. Capped at 400 pins, and a box wider than 12° is
      refused (422) rather than answered with the country.
- [x] **Split list/map UI, mobile map.** ✅ `?vista=mapa` on any category page —
      a query param, not a route, so the canonical URL is untouched and no thin
      duplicate gets indexed. Price pills + cluster chips, filters carried
      across the switch, maplibre still lazy-loaded so the list view (what
      crawlers and most visitors see) never downloads the map engine.
      **Clustering is ~50 lines of screen-space grid bucketing, not
      `supercluster`:** MapLibre's built-in clustering draws counts with a
      `symbol` layer, which needs a `glyphs` font URL the free raster OSM style
      does not have — so the "cheap" path was a dependency on someone else's
      font server. HTML markers style with plain CSS instead.
- [x] **Typed query layer over `idx_search` covering every facet combination.**
      ✅ Done 2026-08-21. `src/lib/facets.ts` (pure: the type, the query-string
      names, `parseFacetParams` and its inverse) + `src/lib/facet-sql.ts`
      (`server-only`: `facetConds`, `verticalConds`, `publishedFacetWhere`).
      The category grid, its count, the map endpoint, the home rails, the
      operation hub, similar listings and the sitemap all build their WHERE
      there. Two things fell out of it: the map now honours the page's location
      (`?ciudad=`/`&barrio=` — without it, panning an Asunción page surfaced
      Luque pins its own grid would never list), and `VerticalConfig.filters`
      is finally read (see the consumption-layer note under D6). Verified by
      `npm run verify:facets`, which is pure and runs in the pre-push hook.
- [x] **EXPLAIN audit — done, and it found a real index bug.** ⚠️ **MIGRATION
      REQUIRED (`drizzle/0002`).** `idx_search` was
      `(status, operation, property_type, location_id, price_usd)`, but the URL
      scheme queries operation + location *always* and property_type only on
      `/{operacion}/{ciudad}/{tipo}` — so a city landing page could use only
      the `(status, operation)` prefix and scanned every listing of that
      operation (`key_len 2`, ~1 800 rows at 3 000 listings). Reordered to
      `(status, operation, location_id, property_type, price_usd)` so the
      optional column is last, and added `idx_recent`
      `(status, operation, location_id, published_at)` for the default
      `published_at desc` ordering, which no index covered.
      Verified on a local DB with 3 000 listings spread across the seeded
      locations: rows examined on a city page **1 800 → 163**, and the query
      itself **1.50 ms → 0.75 ms** (A/B on the same data, with a control run).
      Remaining honestly: an `IN (...)` location list plus `ORDER BY` still
      filesorts — inherent to a range predicate, and cheap now that the range
      is small.
      _Left for the map work:_ a typed facet layer and the bounding-box
      endpoint below.

### Step 5 — Performance (already diagnosed, just needs doing)

- [x] `React.cache()` around `resolve()` / `countCategory()` (category page)
      and `load()` (detail page). ✅ Done with 1.2, which is what made it
      urgent: reading the `Host` header is a dynamic API, so those routes no
      longer keep a full route cache between requests and every hit is a real
      render. Note `cache()` keys on **argument identity** — the cached
      `subtreeIds()` exists so `countFor()` receives the same array reference
      from both callers and actually hits.
- [x] Parallelise `getListingByPublicId` (`src/lib/queries.ts`): ✅ done —
      `images`, `chain`, `agency` and `agent` depend only on the listing row,
      never on each other, and now run in one `Promise.all` instead of four
      serial round-trips.
- [x] Fix the false-parallel block in `app/propiedad/[slug]/page.tsx`: ✅ done —
      `await citySubtreeIds(city.id)` sat *inside* the `Promise.all` array
      literal, so it ran to completion before the other two branches started.
      Hoisted above the block.
- [x] In `getFilteredCategoryListings` the rows select and the count select do
      not depend on each other — ✅ now issued together in one `Promise.all`.
- [x] Load the small `locations` table once and walk the parent chain in
      memory — ✅ done. One cached read per request serves every
      `locationChain()` *and* `citySubtreeIds()` call, replacing one round-trip
      per hierarchy level plus one per subtree lookup.
- [x] **Counters were reading whole result sets.** ✅ Fixed — `countCategory`,
      `countPublished`, the filtered count, `countReviewQueue`,
      `countSuperAdmins`, `countListingsByStatus` and `countLeadsByType` all
      selected every matching row and took `rows.length` in JavaScript, so
      MySQL streamed the full result to Node to be thrown away. Now `COUNT(*)`
      and `GROUP BY`, index-only per EXPLAIN. Measured ~2× faster at 3 000
      listings, and it stops scaling with inventory.
- [x] `getPanelLeads` read every owned listing id into Node and sent them back
      as an `IN (...)` list — ✅ now one inner join with the scope predicate.

### Step 6 — M6 (scale supply + SEO)

- [x] **3.5 Import one listing from its link — the agent claims it.** ✅ Done at
      `/agencia/importar` (fourth agency tab).
      **This replaces the "InfoCasas / Clasipar scrape adapters" item below, on
      purpose.** Crawling a competitor's catalogue and republishing it breaches
      their terms, copies listing text and photos that belong to the agency or
      the portal, and fills the site with duplicates carrying someone else's
      watermarks — and the risk lands on us, not them. Pulling *one* listing, at
      the request of the agent who owns it, who ticks an attestation, is the same
      utility with none of that: it is a migration tool for supply we are
      recruiting anyway.
      How it works: paste a link → we fetch and parse → **a review form**
      pre-filled with what we read, blanks left blank on purpose → the
      attestation → a `draft` in that agent's own scope that still goes through
      the review queue. Nothing is published from a URL, and `is_verified` stays
      false. The source URL lands on `listing_sources` and in `review_notes`, so
      when you approve it you can see where it came from.
      Parsing is JSON-LD first, then OpenGraph, then generic text patterns —
      **no per-site CSS selectors**, which is both more robust and the part that
      would make this feel like scraping. Amount parsing follows PY convention
      (`Gs. 1.250.000.000`, `US$ 85.000` — dots are thousands).
      **Photos are not copied.** The agent uploads their own from the edit page;
      that keeps other portals' watermarks off the site.
      The security-critical piece is `src/lib/safe-fetch.ts`: fetching a
      user-supplied URL server-side is SSRF, so http/https only, DNS resolved
      and every address checked public, re-checked after each redirect hop, 2 MB
      cap, 10 s timeout. Verified against loopback, link-local (cloud metadata),
      all three RFC1918 ranges, IPv6 loopback, `file://`, `gopher://` and
      `0.0.0.0` — all refused.
      _Known limit — closed 2026-08-21:_ the fetcher now allows 12 URL reads per
      account per five minutes (`allowRequest`, the same fixed-window limiter
      the lead endpoint uses), keyed on the user rather than the IP so one
      office's shared connection cannot lock out its colleagues. A refusal is
      an honest message in the form, not a generic parse failure.
- [ ] ~~InfoCasas / Clasipar scrape adapters~~ — **deliberately not built**, see
      3.5 above. If you ever want bulk supply from a portal, the route is a
      *partnership* with a feed, not a crawler.
- [ ] Watermark scoring for imported photos (still relevant once photos arrive
      from anywhere but a direct upload).
- [x] **`/precios` pages + internal link modules.** ✅ Done, and **no API key
      needed** — this half of the SEO surface is built from medians we compute
      ourselves (`cron:medians`), so it works the moment that cron runs.
      `/precios` lists cities with defensible data; `/precios/{ciudad}` shows
      median price and price/m² per (type × operation) with a link into the
      matching category page, plus a plain-language method note.
      The honesty rule is load-bearing: a city aggregate is a
      **sample-weighted** mean of its barrio medians (not a median of medians,
      which would treat a barrio with 40 listings and one with 2 as equals), a
      group under 8 listings renders **with a caveat** rather than silently, and
      a page whose every group is thin is `noindex`. The sitemap uses the same
      rule, so page and sitemap can never disagree — that agreement is what
      keeps programmatic pages out of doorway territory, and it matters more
      here than on a category page because a median *looks* authoritative.
      Link modules: category page → its city's prices, listing detail → same,
      price row → the category page it summarises, footer → `/precios`.
- [ ] Barrio guides via the Claude API (top 30). Needs `ANTHROPIC_API_KEY` in
      prod `[YOU]`. Note the guides are the *only* part of §4.4 that needs it.
- [ ] **[YOU]** GATE: Screaming Frog crawl — zero indexable thin pages, zero
      canonical conflicts.

### Step 7 — M7 (monetization & feeders)

- [x] **Valuation lead magnet (`/tasacion`).** ✅ Done, no key or price decision
      needed — it runs on the medians `cron:medians` already computes, and it
      produces *seller* leads, which are future listings.
      Four restraints are the design, because this is the one screen that puts a
      number on a property nobody has seen:
      **(a) A range, never a single number** — a point estimate off a median
      price/m² is false precision, and an owner who anchors on it and lists 20%
      high sits unsold for months. **(b) The band widens as data thins** (±12%
      at 60+ comparables, ±25% under 15). **(c) Under 8 comparables it refuses
      outright** and offers a human instead — no estimate beats one we would not
      defend. **(d)** The copy states it is built from *asking* prices, not
      closing prices, and is not an official appraisal.
      The estimate is free and shown *before* any contact field: gating the
      number behind a phone number earns one lead and loses the trust that
      brings someone back to publish. The lead is created only if they ask,
      lands as `routed_to = 'internal'` (yours, in `/admin/leads`), and carries
      the full valuation context so the follow-up starts informed.
      Also repointed the homepage's "¿Cuánto vale tu casa?" card, which until now
      pointed at the same outbound WhatsApp link as the publish card because no
      tool existed.
- [ ] Featured listings + preventa promotion — **needs you first**: pricing, and
      a decision on whether money changes hands in-app (a payment integration)
      or by invoice/transfer with an admin toggle. The toggle version is a small
      build on top of `listings.featured_until`, which already exists.
- [ ] **[YOU]** Decide the first feeder domain to switch on and the pricing for
      featured placement.

---

## Known dialect dependency

`scripts/compute-medians.ts` uses `.onDuplicateKeyUpdate()`, which is
MySQL-only, against the standing "no MySQL-only tricks" rule. It is one call in
a nightly cron (not a request path), so it is cheap to port when needed — but it
is the one place the Postgres escape hatch is currently nailed shut. The views
counter deliberately avoids the same trick; see `recordListingView`.

## Verification you can re-run

- **The map was driven in a real browser (Playwright + Chromium), not just
  typechecked — and that is the only reason it works.** Two bugs were invisible
  from the code: (1) `maplibre-gl.css` sets `.maplibregl-map { position:
  relative }` and its stylesheet is injected *after* `globals.css`, so
  `inset: 0` silently stopped sizing the map container — it collapsed to
  height 0 and, because maplibre also sets `overflow: hidden`, every marker
  inside became unclickable (`document.elementFromPoint` at a cluster chip
  returned the wrapper, and a real mouse click did nothing); (2) on a phone the
  search and filter cards filled the entire first screen, so tapping "Mapa"
  showed no map until you scrolled past both. Both fixed and re-verified:
  container 1098×620, hit test lands on the chip, a genuine click zooms
  (chips 33 → 11, pins 10 → 31), price pill links to the right listing.
  Note OSM raster tiles cannot load from inside the dev sandbox (the proxy
  blocks `tile.openstreetmap.org`), so screenshots show pins over a blank
  backdrop; pins and clustering are ours and work regardless.

- `npm run verify:scopes` — exercises the panel's ownership guards against a
  local database: sign-up shape (roles, unverified flags, the `agents` link),
  the validation refusals, **cross-tenant isolation** (an agency cannot read,
  edit or restatus an independent's listing), slug immutability on rename, and
  that a password change revokes only that user's sessions. It refuses to run
  unless `DATABASE_URL` points at localhost, and it cleans up its own rows.
  This is the only automated check in the repo — if you touch
  `listingScopeWhere`, `panelScope` or any panel query, run it.

## Pending migration

**`drizzle/0011` (Batch 3 layer 3, the English columns) is generated and NOT
applied to production.** It adds `listings.title_en` and
`listings.translation_hash` — two additive nullable columns, no data touched,
no index. Same standing hazard as 0010 and for the same reason (deployed code
selects every column in `schema.ts`), so it lands in the same window as its
merge. It is otherwise inert: nothing reads the columns yet, and
`npm run cron:translate` does nothing at all without `ANTHROPIC_API_KEY`.
0010 and 0011 apply in one `db:migrate` run, in order.

**`drizzle/0010` (F38, the display coordinate) is generated and NOT applied to
production.** It adds `listings.display_lat` / `display_lng`, backfills them
from `coalesce(listing coord, location centroid)`, and moves `idx_geo` onto
them. Unlike 0002 it is **not** optional-when-convenient, for the standing
reason: deployed code selects every column in `schema.ts`, so from the moment
the code is live and before the migration runs, every query that reads a
listing row 500s — the map, the panels, the detail page. **Apply it in the same
window as the merge**, same runbook as 0009 below (`db:status --probe`, then
`db:migrate`, then `db:status` again). The backfill is a single indexed
`UPDATE … JOIN` over the whole table; at this inventory it completes
immediately. After it, `npm run cron:geo -- --dry` should report `0 listing(s)
plotted at a stale position`.

Verified on a scratch MySQL-compatible server on 2026-08-26: 0010 applied
cleanly on top of 0000–0009, the backfill put centroid-borrowing rows on their
barrio and coordinate-carrying rows on their own point, and `cron:geo` was a
no-op on a second run. `EXPLAIN` on the bbox query went from `ALL` (full scan +
block-nested-loop join) to `range` on `idx_geo`, key_len 13, 130 index entries
at 3 000 listings — with the same 100 rows in the result set both ways.


**`drizzle/0002` is generated but NOT applied to production.** It reorders
`idx_search` and adds `idx_recent` on `listings` (see the EXPLAIN audit in step
4). Deployed code does not select new columns, so the app runs fine either way
— the only cost of waiting is that category pages keep the slower plan. Run
`npm run db:migrate` against prod when convenient; it is a DROP INDEX plus two
CREATE INDEX on a small table, so it completes immediately.

**`drizzle/0009` (PR #69, the D8 `owner` lead lane) must be applied to
production alongside that merge.** It is one additive `ALTER TABLE` appending
`owner` to the `leads.routed_to` enum — no data is touched, already-applied
migrations are skipped, safe to run twice. Unlike 0002 this one is **not**
optional-when-convenient: from the moment #69's code is live, a buyer inquiry
on an FSBO listing writes `routed_to = 'owner'`, and until the enum knows that
value the insert fails and the lead is lost. Runbook (founder's machine —
Hostinger deploys code only, it never runs migrations):

```powershell
# PowerShell, from a checkout of current main
$env:DATABASE_URL = "mysql://<prod user>:<prod password>@<prod host>:3306/<prod db>"

npm run db:status -- --probe   # 1. look: what is actually pending?
npm run db:migrate             # 2. apply everything pending, in order
npm run db:status -- --probe   # 3. prove the owner lane inserts
```

Run it just before or immediately after merging #69. `db:migrate` applies
every pending migration in order, so this run also clears 0002 above.

**Read step 1's output before running step 2 — it is not a formality.** This
file has claimed different pending sets at different times (the [YOU] block
above still lists 0003 as pending, which cannot be true if 0008 is applied:
0008 drops an index on the table 0003 creates). `db:migrate` decides what to
run from `__drizzle_migrations`, not from this file, and README step 2
documents pasting a migration into phpMyAdmin as an accepted path — which
applies the SQL and records nothing. So the tracking table can under-report,
and a `db:migrate` that trusts it would replay a `CREATE TABLE` that already
exists. MySQL autocommits DDL, so a replay that fails halfway leaves the run
partly applied with no rollback.

`npm run db:status` (`scripts/check-migrations.ts`) is the look-before-you-fire
step: read-only, it hashes each `drizzle/*.sql` the same way drizzle's migrator
does (sha256 over the whole file) and matches it against what prod recorded, so
it reports the real pending set rather than a remembered one. It also flags a
recorded hash with **no** matching file — prod ran SQL this checkout does not
have — which is the one case where `db:migrate` is the wrong tool and a human
has to reconcile first.

**Since 2026-08-26 it also answers the question the migration list is only a
proxy for: does this database have what the deployed code selects?** It reads
`src/db/schema.ts` through drizzle's own metadata, diffs it against
`information_schema`, and names every missing table, missing column and
missing enum value. That matters because drizzle emits `SELECT` with every
column of a table spelled out, so one absent column is not a broken feature —
it is a 500 on every page that reads that table. Run it **before** merging a
schema PR and **again right after** `db:migrate`; "no drift" is the only
green there is. It also reconciles the two lists and says which way they
disagree:

- **0 pending but columns missing** → a migration's row was recorded without
  its SQL (or the SQL was rolled back). `db:migrate` will do nothing; this
  needs hand-written DDL.
- **pending but nothing missing** → the SQL was pasted into phpMyAdmin without
  recording a row. `db:migrate` would replay it; read each pending file first.

Verified against a scratch server in all four states: clean, a database behind
on 0010/0011 (four columns named), a hand-applied schema with the tracking
table behind, and a missing table.

Two things it prints that shape the recovery, not just the fix:

- **`sql_mode`.** Strict mode makes the bad insert an error, so the lead never
  reached the table and is gone. Non-strict makes MySQL store `''` and warn,
  which is the shape a "leads vanish quietly" report takes — and those rows are
  recoverable. `db:status` counts `routed_to = ''` rows for exactly that.
- **`--probe`** inserts one `routed_to = 'owner'` lead inside a transaction and
  always rolls it back (in a `finally`, so a throw cannot leave a row behind).
  Reading the enum definition proves the column changed; the probe proves an
  insert the app would make now succeeds.

Verified end to end against a scratch MySQL on 2026-08-22: with 0000–0008
applied and 0009 pending, `db:status --probe` reported `PENDING 0009` and the
probe failed with `Data truncated for column 'routed_to'` — the production
symptom exactly. After `db:migrate`, the same command reported 10/10 applied
and the probe inserted cleanly. `db:migrate` run twice was a no-op.

## 2026-08-21 session — facet layer, vertical filters, en.ts

Three things landed, all unblocked by any founder decision, none touching
`schema.ts`. No migration. Nothing a visitor sees changes today.

**1. One typed facet layer (closes the last open M4 item).** The same four
filters were spelled out three times — the category page's `parseFilters`,
`/api/mapa`'s zod schema, and the `mapQuery` object the page handed the map.
`src/lib/facets.ts` is now the vocabulary (pure, so the client-side filter bar
shares it) and `src/lib/facet-sql.ts` the WHERE builder (`server-only`).

Two behaviour changes came out of it:

- **The map honours the page's location.** It used to answer the viewport
  alone, so panning a "Casas en venta en Asunción" page surfaced Luque pins
  the grid would never list. `/api/mapa` now takes `?ciudad=`/`&barrio=` and
  resolves the same subtree the page does.
- **`VerticalConfig.filters` is consumed** — the gap this file recorded under
  D6 as blocking the English flip. A door's hard filters are ANDed into every
  public listing query; a door may narrow what a visitor asked for, never
  widen it.

Consequences handled: the home payload and the sitemap entries are cached, so
the vertical key joins their cache keys (`app/page.tsx` carried a comment
asking for exactly this). `currentVertical()` falls back to the `Host` header,
because the middleware matcher excludes `/sitemap.xml` and `/robots.txt` —
the two routes whose whole job is to speak for one domain.

**2. `src/i18n/en.ts` (Batch 3 layer 2).** Written for foreign buyers per D6,
not transliterated: *cuota* → "estimated monthly payment", *en pozo* →
"pre-construction", *quinta* → "country house". `Dictionary` had to change
with it — it was `typeof esDictionary`, and `as const` made the contract
include the literal Spanish sentences, which is why `en` used to resolve to
the Spanish dictionary. It is now `Widen<typeof esDictionary>`: leaves widened
to `string`, structure untouched, both dictionaries checked with `satisfies`.

**3. A cooldown on the link importer** (the known limit recorded under 3.5):
12 fetches per account per five minutes.

**Two new pure checks, both in the pre-push hook:** `npm run verify:facets`
and `npm run verify:i18n`. The second exists because the type system has a
blind spot that matters here — TypeScript lets a function taking fewer
arguments satisfy one taking more, so `titlePaged: (title) => title` would
compile and silently drop the page number from every paginated title. Both
were confirmed to fail on a deliberately broken input, not just to pass.

**Honest limit on all of it:** no database was reachable this session (the
sandbox blocks Docker Hub), so nothing here was exercised against real rows.
`npm run typecheck`, `npm run build`, `verify:import`, `verify:facets` and
`verify:i18n` all pass. `npm run verify:scopes` was not run — it needs a
localhost database, and this change does not touch panel scoping.

**Next in these lanes, for whoever picks it up:**
- Batch 3 layer 3 — the translation batch job filling `title_en` /
  `description_en` (MIGRATION for `title_en`, needs `ANTHROPIC_API_KEY`).
- The rest of the D6 consumption layer, re-checked 2026-08-21: theme **tokens**
  exist (`src/design/themes.ts`, consumed in `app/layout.tsx`; the overrides map
  is deliberately empty), and the `copy` branch turns out **not** to block the
  flip — locale already selects the foreign-buyer copy, and `copy`'s only
  distinct consumers are unowned feeder domains. What is left of the flip
  precondition is the **translation job** (`title_en` / `description_en` have
  no writer) and the founder's separate-visual-identity design pass, which is
  design work rather than wiring.

## 2026-08-21, second session — hreflang, SEO invariants, /admin tabs

Three merged PRs (#71, #72, #73). No migration, no `schema.ts`, no founder
decision consumed — the four decisions the previous handoff asked for (D5, D8,
D9, D10) came back **blank**, so everything gated on them is untouched. Nothing
a visitor sees changes today.

**1. hreflang, built ahead of the flip (#71).** D6's checklist item 4 was the
only code item on that list with no implementation, and an unbuilt item on a
checklist is the one that gets improvised on the day. `src/lib/alternates.ts`
derives a page's language map from the same `verticals.ts` entries the flip
edits, so checklist items 2–3 now turn the tags on by themselves. Wired into
home, the operation hubs, indexable category pages and `/propiedad`.

It emits nothing today **on purpose**: both doors are `locale: "es"` and serve
the same rows, so there is no translation to declare — and calling two Spanish
URLs language variants of each other would contradict what
`listingCanonicalOrigin()` already says about them. Duplicates are a canonical
problem; hreflang is for translations. Two more rules it encodes, both "never
annotate a URL we asked Google to ignore": `/propiedad` alternates are gated on
`hostOwnsListingDetail()` (a feeder is not a language version of anything), and
a category page emits them only when it is genuinely indexable.

**2. The vertical table's traps are now a failing check (#73).** `npm run
verify:seo` (pure, in the pre-push hook) refuses a push where two served doors
would own their `/propiedad` pages in the same language — the one-line edit
that turns `inmobiliaria.com.py` into a duplicate of the primary — plus
duplicate vertical keys (`currentVertical()` resolves by first match), host
keys spelled in a form `resolveVertical()` never looks up, shared brand names,
and a primary whose row disagrees with `origin.ts`. It also drives
`alternates.ts` against a **synthetic post-flip table**, so flip-day output is
proven before the flip. Both halves were confirmed to fail on deliberately
broken input, not only to pass.

**3. `/admin`'s tab row is grouped (#72).** It had reached eight tabs, past
what fits one row on a phone, and 3.4 asked for the next addition to group
rather than append. `PanelTab.group` splits it: the daily work (revisión,
propiedades, consultas) on the first row, the records behind it under a quieter
"Administración" row. A second row rather than a disclosure — the panel ships
no client JS, so a collapsed menu cannot remember its state. Tabs also gained
`aria-current`. `/agencia` is untouched.

**Two D6 status claims were wrong and are corrected in place** (#73), checked
in code rather than remembered: per-vertical theme **tokens** exist
(`src/design/themes.ts`, consumed by `app/layout.tsx`; the empty overrides map
is deliberate), and the `copy` branch does **not** block the flip — locale
already selects the foreign-buyer copy, and `copy`'s only distinct consumers
are the unowned feeder domains. **The flip precondition is now one item: the
translation job.**

## 2026-08-26 session — F38, the translation job, sitemap chunking

Three PRs, in dependency order. **Two of them carry migrations** and per D11
neither auto-merges.

1. **F38 — the display coordinate** (MIGRATION 0010). The map's bounding box
   filtered `coalesce(listings.lat, locations.lat)`, which is not sargable, so
   `idx_geo` was unused and every pan scanned the published set.
   `listings.display_lat/display_lng` are now materialised at write time by
   `src/lib/geo.ts`, `idx_geo` covers them, and the bbox query dropped the
   `locations` join. Measured: `ALL` + block-nested-loop join → `range` on
   `idx_geo`, key_len 13, 130 index entries at 3 000 listings, identical result
   set. `npm run cron:geo` is the repair for the one staleness a write hook
   cannot see — a centroid moving.
2. **Batch 3 layer 3 — the translation job** (MIGRATION 0011). `title_en` and
   `translation_hash` added; `npm run cron:translate` fills the English
   columns via the Claude API. Not a publish hook, on purpose — see D6 above
   and `src/lib/translate.ts`. Exercised end to end against a stub Messages
   API: dry run, write, no-op re-run, edit detection, `--limit`, and a mid-batch
   failure that isolates to its row and leaves it flagged for the next run.
   **The flip precondition is met in code but not in data** — the job has never
   run against production, so coverage is 0%. `cron:translate` prints coverage
   on every run; D6's "only once translation coverage looks solid" is that
   number.
3. **F43 — sitemap chunking.** Separate PR; no migration.

**Honest limit, same as the previous session:** no database was reachable (the
sandbox blocks Docker Hub), so nothing was exercised against real rows — and
`/admin`'s new tab row was rendered from its own markup plus the real
`globals.css` in Chromium (390px and 1200px), not from the running panel, which
needs a login and a database. `typecheck`, `build`, `verify:import`,
`verify:facets`, `verify:i18n` and `verify:seo` all pass. `verify:scopes` was
not run: it needs a localhost database, and none of this touches panel scoping.

**What is left that no decision blocks.** Honestly assessed this session: very
little. Batch 3 layer 3 (the translation job) needs a migration *and*
`ANTHROPIC_API_KEY`; barrio guides need the same key *and* a content decision
(D6's blog note); F38 and F61 need migrations; F1, D5, D8, D9 need answers.
The unblocked remainder is the founder's separate-visual-identity design pass
for `inmobiliaria.com.py` — design work, and the founder said he wants to talk
it through, possibly with a different model, before it starts.

## D21 — Site-mode switch: marketplace vs. single-agency (PLAN ONLY, do not build yet)

Decided in principle 2026-08-21: when this repo becomes a template for other
real-estate listing sites, the "one agency's own site, only my team publishes"
variant is a **config switch in this codebase, never a second repo**. Two
reasons, both structural:

1. The repo is already "one engine, multiple doors" — `verticals.ts` decides
   brand, locale, filters and indexability per host. A `siteMode` is the same
   idea one level up, and the engine (listings, categories, SEO, facets,
   leads, panels, import, cuotas) is identical in both modes. The difference
   is only what gets *switched off*.
2. A forked template is a bug-fix debt that compounds: every SEO fix, facet,
   and security patch has to land twice, and the copies drift within weeks.

**Hard gate: nothing under D21 starts until the Spanish marketplace is
finished** (founder call, 2026-08-21) — the switch must land on a stable
engine, not a moving one. Until then this section is a design record, not a
work item.

Shape when it does start — keep the switch **coarse, at few choke points**,
never `if (mode …)` scattered through components:

- `siteMode: "marketplace" | "agency"` declared per vertical in
  `verticals.ts`, defaulting to `"marketplace"` so every existing host is
  untouched. `verify:seo` learns the new field so a misspelled mode fails the
  pre-push hook rather than silently serving the wrong product.
- **PR 1 — the flag and the doors.** Declare the mode; gate the public entry
  points on it: `/registro` (invite-only in agency mode — the invite flow
  already exists), `/publicar` (staff only), and the FSBO loop (D8 surfaces
  hidden). Route guards at the handful of `require*Context()` choke points in
  `src/lib/auth/guards.ts`, not per page.
- **PR 2 — the directory surfaces.** In agency mode there is exactly one
  agency, so `/inmobiliaria` + `/inmobiliarias`, `/agente` directory pages and
  their sitemap/nav entries switch to a single "nuestro equipo" surface (or
  off). Same `hostOwnsListingDetail()`-style rule as today: a host's sitemap
  only lists what that host actually serves.
- **PR 3 (only if a real customer needs it) — cosmetics.** Home copy, footer,
  JSON-LD `Organization` vs `RealEstateAgent`, hiding marketplace-only trust
  UI. Nothing here blocks PRs 1–2.

Explicitly out of scope for the switch: multi-tenancy changes (the schema
already scopes by agency), payments, and any new panel — agency mode reuses
`/agencia` exactly as is.

## Standing rules

- Every PR that touches `src/db/schema.ts` ⇒ generate a migration
  (`npm run db:generate`) **and** flag MIGRATION REQUIRED; the deploy is not
  done until `npm run db:migrate` ran against prod. Deployed code selects every
  column in the schema, so a DB behind on migrations 500s whole page trees.
- Never edit `drizzle.config.ts`, `src/db/index.ts` or `DATABASE_URL` handling
  unless the task *is* the DB connection. `src/db/index.ts` builds the pool at
  module load, so a malformed `DATABASE_URL` crashes the process at startup
  (503) rather than failing a single page.
- Run `npm run build` locally before pushing — Hostinger auto-deploys `main`
  and there is no staging.
- No MySQL-only tricks; the Postgres escape hatch stays open.
- Indexability decisions go through `getIndexability()` — never duplicated.
- All lead/OTP traffic goes through `src/lib/crm.ts`.
- Local-facing copy is Paraguayan voseo from `src/i18n/es.ts`.
