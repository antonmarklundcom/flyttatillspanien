# flyttatillspanien.se — gap analysis against propia.node and the plan to become the best Spanish-property site for Swedes

Written 2026-09-23 against `flyttatillspanien@714d515` (main) and
`propia.node@4f71193` (main). This plan edits nothing in propia.node. It
replaces nothing in `AGENTS.md` or `CLAUDE.md`: every rule there still applies
to every phase below.

Model rule for every phase: builders run on **Opus or Sonnet**. Fable is never used
for a phase, a subagent, a session or a Routine without Anton's explicit approval
in that conversation (`AGENTS.md` §6).

---

## 0. Summary in five lines

1. flyttatillspanien was copied from propia.node on **2026-08-27** (`81503bf`). Since
   then propia.node has merged roughly **150 commits (PRs #81–#192)**. Of the ones
   that apply to a one-door Swedish site, about a third are here; the rest are missing.
2. The missing work splits into **real bugs that will bite at launch** (§2.1), and
   **polish and operations work** propia paid for once and this repo can copy (§2.2–2.4).
3. The site's real advantage is already built and is strong: the **legal and compliance
   block, EUR with a live SEK conversion, and the acquisition-cost estimate**. None of the
   competitors (Hemnet Utland, Svensk Fast Spanien, Fastighetsbyrån, Kyero, Idealista,
   thinkSpain) combine all three in Swedish (§3).
4. What is holding it back is the **shopping experience** (gallery, filters, saving,
   alerts, map), **Spanish URL slugs** on a Swedish site, and **supply**: there is no
   feed intake for the XML exports every Spanish agency already produces (§4).
5. Launch is still blocked on **founder-only items** (hosting, SMTP, a real mailbox, the
   placeholder acquisition-cost rates, the GDPR review). Code cannot unblock those (§5, Phase 0).

---

## 1. How this was checked

- `git log --since=2026-08-25` on propia.node, then each commit compared with the
  matching files in this repo (grep and read, not memory).
- `docs/port-plan-2026-09.md` (the 2026-09-11 port plan): **PR-1 (rate-limit sign-up),
  PR-2 (AGENTS.md + `db-credential.ts`) and PR-3 (rollback transaction) have landed.
  PR-4 through PR-7 have not** (see §2.2).
- Separate web research on competitors, demand and regulation (§3). Claims that could
  not be verified are marked as unverified. Treat them as questions, not facts.

---

## 2. What is missing compared with propia.node

Status key: **MISSING** = applies here, not ported. **PARTIAL** = partly ported.
**N/A** = does not apply to a one-door, EUR/SEK, Swedish-only site.

### 2.1 Bugs and hardening — these bite at launch

| propia change | Status here | What is wrong in this repo today |
| --- | --- | --- |
| #161 `b445e83` absolute image URLs pass through `imageUrl()` | **MISSING** | `src/lib/format.ts:105` prefixes `R2_PUBLIC_BASE_URL` onto *every* key. Imported photos store their remote `https://…` URL as `r2_key`, so the moment R2 is configured **every imported photo breaks**. |
| #84 `91a7a71` rate limiter per-window buckets | **MISSING** | `src/lib/rate-limit.ts` has one shared `buckets` Map and `sweep(now, windowMs)` evicts by the *caller's* window. A 5-minute caller evicts the hourly OTP counter, so the OTP throttle added in PR-1 can be bypassed. |
| #81 `07de6c2` bounded webhook timeout | **MISSING** | `src/lib/crm.ts:118` makes a bare `fetch` with no `AbortSignal.timeout`. A dead webhook holds a Node process. |
| #156 `9341602` tasación CRM push through `after()` | **MISSING** | `app/tasacion/actions.ts:75` does `await getCrm().pushLead(...)` inside the request. `/api/leads` already uses `after()`. |
| #87 `4699184` OTP cooldown as a clock | **MISSING** | `PublishWizard` prints raw seconds, so hitting the hourly cap shows "3600s". |
| #160 `eb1d055` hardened image backfill | **MISSING** | `scripts/backfill-images.ts` has no `safe-fetch` byte cap and selects every row with no paging. |
| #162 `3340f6c` resync in one transaction | **MISSING** | `src/lib/import/resync.ts` has no transaction, so a crash leaves a half-paused batch with no job row. |
| #159 `c50ecc5` sort tie-break + Playwright | **MISSING** | `sortOrder()` (`src/lib/queries.ts:210`) has no `id` tie-break, so listings can repeat or vanish between pages. There is no Playwright setup. |
| #187 `c075c9f` `verify:rate-limit` | **MISSING** | No regression check for the limiter. It would have caught the bug above. |
| #179 `d6fab62` JSON-LD nonce hydration | **MISSING** | `src/components/JsonLd.tsx` has no `suppressHydrationWarning`. |
| #182 `a64e776` `/favicon.ico` + apple-touch icon | **MISSING** | Only `app/icon.svg` exists, so `/favicon.ico` returns 404. |
| #168 `e667877` project-card locale | **MISSING** | `src/components/ProjectCard.tsx:16` formats dates with `"es-PY"`, so Swedish visitors see Spanish month names. |
| — (found in this pass) | **BUG** | `src/components/PriceAlert.tsx` shows the button label **"Avisame"** to Swedish visitors and sends `[Alerta de precio] Avisame si baja` as the lead text. The strings are not in `sv.ts`. |
| #141 `7328a82` `/guias` degrades on schema drift | likely MISSING | No catch in `app/guias/page.tsx`. Low risk with no production DB yet. |
| #165 `d13873b` rollback portable to MariaDB | not verified | Only matters for the sandbox. |

### 2.2 Operations and tooling

| propia change | Status here | Note |
| --- | --- | --- |
| Port-plan **PR-4**: `verify:import` rollback fixture scoped to its agency | **MISSING** | `scripts/verify-import.ts:569` still asserts unscoped. This is the "6 rows not 3" item in `KNOWN-ISSUES.md`. |
| Port-plan **PR-5** / #93 #96 C4d: translate chain DeepL → Gemini → Claude, bounded runs | **MISSING** | `src/lib/translate.ts` is Claude-only. `cron:translate` defaults to `limit = Infinity` with no provider deadlines. DeepL supports es→sv, so the free 1M-character credit applies here too. |
| Port-plan **PR-6** / #135 O1: one runner per job in `src/lib/ops/` | **PARTIAL** | Only `src/lib/ops/types.ts` and `scripts/ops-cli.ts` / `db-credential.ts` exist. No runners have been extracted. |
| Port-plan **PR-7**: `src/lib/ops/migrations.ts` | **MISSING** | Needed by the ops page. |
| #136 O2 `/admin/operaciones`, health panel, `ops_runs` | **MISSING** | Needs a migration. Lets Anton run `cron:fx`, `cron:geo`, `cron:translate` etc. from `/admin` instead of a shell. |
| #164 `7b5f1d2` invalidate caches after an ops job | MISSING | Comes with O2. |
| #163 `0ad9fb2` medians replaced atomically | MISSING | Port together with the medians runner. |
| #171 `fcd8a1a` scoped `staff` role | **MISSING** | Auth + schema, so the founder merges it. Only needed once a second person does moderation. |
| #173–#175, #186 sample photos, `seed:demo-seller`, "sample listing" chip | **MISSING** | Useful if the site goes public before real inventory exists: an honest demo marker instead of fake-looking offers. |
| `cron:fx -- --rate N` manual rate | **N/A** | This repo already has a manual override in `/admin/referens` (`setManualFxRate()`). |
| #190 `cron:price-usd` | **N/A** | SEK is never stored, so there is nothing to re-derive. |
| #157 `2c8a135` notify the FSBO owner on a routed lead | **MISSING** | Here this should be an **email** to the private seller (email-first), not a webhook-only alert. It is a real product gap: today a private seller only sees a lead if they open `/mis-avisos/consultas`. |
| `/mis-avisos` owner panel, `/admin/leads` forward | PORTED | Already here. |
| `db:status` drift, sitemap chunks, display coordinates, translate as a batch job | PORTED | Already here. |

### 2.3 Buyer-facing design and UX

| propia change | Status here | Note |
| --- | --- | --- |
| #172 "Ficha Clara": gallery **lightbox dialog**, sticky "show N listings" bar on mobile | **PARTIAL** | The mobile contact bar exists. There is **no full-screen gallery**, only a hero image and three thumbnails with a "+N" overlay. This is the single biggest thing a Hemnet user will miss. |
| #170 sidebar filters that apply instantly, with loading feedback | **MISSING** | `CategoryFilterBar` is a plain GET form above the grid. |
| #176 compact hub header, #178 type chips, #151 SEO body copy on hubs, #129 listings first | **MISSING** | The hub `<h1>` is `style={{ fontSize: 24 }}`. There are no type chips and no body copy, so the category pages have thin content for SEO. |
| C4e `beb00a9` emoji sweep (emoji replaced with line icons) | **MISSING** | The listing page still uses 📍🏙🔨📐🌳🚗🛏🚿💬, and the home page uses 📍🏢🏗. This undercuts the editorial design. |
| #177 / #184 small-text contrast to WCAG AA + e2e contrast specs | **MISSING** | No `tests/` directory. |
| #191 map localised, pins in the listing's own currency | **PARTIAL** | The map is localised. Pins should show **EUR, with SEK in the popup** when the rate is fresh. |
| #138 Premium Editorial home as a component | PARTIAL | Same visual language, built inline in a 686-line `app/page.tsx`. Refactor only if the home page is redesigned anyway. |
| #99 verified badge on cards | **N/A (deliberate)** | `ListingCard.tsx` documents why it is not shown: `is_verified` has two meanings here. Keep it that way until §5 Phase 5 decides. |

### 2.4 Things in propia.node that should NOT be ported

- Financing / cuotas (`seed:financing`, `cron:cuotas`, `/financiamiento`). This is blocked by
  D-mortgage: there is no public rate scale for non-resident mortgages.
- Every multi-door fix: #150 hub page-count leak, #115 rail leak, #167 mobile-menu links,
  hreflang work, landforsale, terreno. They only matter with more than one door, and nothing
  breaks with one.
- The rental family (`alquiler.com.py` / `rentparaguay.com`, `/servicios`) and the directory
  door (`inmobiliarios.com.py`, D1–D4). Those are separate businesses.
- D3 lead matching (`lead_matches`, `MatchPanel`) **as it is**. A Spain version is proposed in
  Phase 5, redesigned for buyer leads.
- `/vender` in its Paraguay form. A Swedish seller page *is* proposed (Phase 4), with different
  content.

---

## 3. What the market says

Full notes with sources were collected in this session. The points that change the plan:

- **Competitors.** Swedish brokers with Spain offices (Svensk Fastighetsförmedling Spanien,
  Fastighetsbyrån since 2011 in Nerja, Bjurfors, Mäklarhuset). **Hemnet Utland** has the
  traffic and brand trust but thin content. Scandinavian agencies on the coast have trust but
  are single-office. Guide sites (fastighetispanien.se, spanienfastigheter.se, sydkusten.es)
  rank for "köpa hus i Spanien" but have no live inventory. **Kyero** (machine-translated into
  Swedish, around 7 000 agents) was **bought by Idealista in 2024/25**, so the two biggest
  reach engines are now one company.
- **The gap this site can own.** Nobody combines (a) live EUR→SEK, (b) per-listing legal,
  energy and catastro facts, and (c) a per-region cost estimate, in Swedish, with
  Swedish-broker-grade guidance. That is what this repo already has.
- **Demand.** Foreigners made about 18% of Spanish home purchases in 2025 (about 137 000 over
  the two halves). The Swedish share could not be verified from Notariado data; the only
  figures found were a broker's own numbers. **Anton should pull the Notariado nationality
  table before quoting any Swedish number on the site.**
- **Viewing trips (visningsresor)** are a standard conversion tool at every Swedish competitor.
  This site has no lead type or flow for them.
- **Swedish buyers' recurring questions**: NIE, a Spanish bank account, annual **modelo 210 /
  IRNR** (19% for EU non-residents, due even when the property is not let), plusvalía
  municipal, **regional inheritance tax**, financing (Swedish banks do not appear to lend
  against Spanish property: *unverified, but nothing found*), and tourist licences.
- **Corrections to carry into any copy:**
  - The research found **no evidence that the 1976 Sweden–Spain tax treaty was terminated**.
    Any tax text on the site must be checked by a tax advisor, not written from memory.
  - The "100% tax on non-EU buyers" is really a *proposal* to double ITP for non-EU
    non-residents. It was not passed as of early 2026, and **Swedes are EU citizens and
    unaffected**. That is a useful, reassuring guide topic.
  - The Golden Visa was abolished on 2025-04-03.
- **Regulation to add to the publish gate or template:** besides RD 390/2021 (already
  enforced), **Andalucía's Decreto 218/2005** requires specific consumer information in housing
  adverts there. Marbella, Málaga and Nerja are all Andalucía, so the detail page and the import
  template should be checked against its list (Phase 4).

---

## 4. The five things that decide whether this becomes the best site

1. **Supply.** A portal with 40 seeded listings loses to Hemnet Utland on day one. Spanish
   agencies already export **Kyero v3 XML** (and Idealista/Fotocasa formats) to every portal.
   Taking that feed through the *existing* `planImport`/`commitImport` planner is the biggest
   lever this codebase has. The design doc already puts XML at v1.1 "through the same planner".
2. **Trust.** The compliance block, the "what the seller says vs what we verified" split, and
   honest SEK. Keep it, extend it (Decreto 218, nota simple storage), and put it on the cards,
   not only on the detail page.
3. **The complete cost in kronor.** Swedes are blindsided by acquisition costs, IBI, comunidad
   fees, modelo 210 and the currency. One "what it really costs you" panel in SEK, from data the
   site already has, is the feature to market.
4. **Hemnet-level browsing.** Gallery lightbox, instant filters, favourites, saved searches with
   e-mail alerts, and a map with price pins. Swedish buyers will judge the site by the Hemnet
   yardstick in the first ten seconds.
5. **Swedish SEO.** Swedish URLs, hub body copy, city and area pages, and a guide library built
   around the questions in §3. The site is not live yet, so renaming URLs now costs no redirects
   and no lost ranking. After launch it costs both.

---

## 5. The plan

Each phase is one or more PRs on `claude/<name>` branches cut from `origin/main`, gated by
`npm run verify:local`. Anything touching `src/db/schema.ts`, auth or payments is titled for
its risk (`MIGRATION REQUIRED —` for schema changes) and **Anton merges it**. The order is
chosen so the cheap, safe, launch-relevant work comes first.

### Phase 0 — Founder only (blocks launch, no code can do these)

- [ ] Hostinger Node app + MySQL, DNS for `flyttatillspanien.se`, then run `db:migrate`,
      `db:status`, `seed:locations`, `seed:costs` on your own machine (commands in the
      Phase 6 report, `docs/decisions-needed.md`). **Rotate the MySQL password** that was
      pasted into an earlier chat.
- [ ] A real mailbox for `CONTACT_EMAIL` and the SMTP env vars. Without them there are no
      OTP logins and no lead e-mails.
- [ ] **Verify the seven `acquisition_costs` rows** (ITP/AJD per comunidad plus notary,
      registry and legal fees) against official sources. They print money on every listing.
- [ ] GDPR / privacy-policy review (D22).
- [ ] Real photos for the four zone cards (they are Paraguay photos today).
- [ ] Cloudflare R2 bucket + `R2_*` env vars (code is ready). **Do this only after Phase 1's
      `imageUrl` fix**, or imported photos break.
- [ ] Decide the business model for agencies (§6, F1). It shapes Phase 5.

### Phase 1 — Bugs and hardening ports (Sonnet, one or two PRs, ~1 session)

Mechanical ports with propia's commit as the reference. No schema changes.

1. `imageUrl()` / `imageThumbUrl()`: pass absolute URLs through unchanged (#161).
2. `rate-limit.ts`: per-window buckets (#84), plus `verify:rate-limit` with a fake clock
   (#187), added to `verify:local` and the pre-push hook.
3. `crm.ts`: webhook timeout (#81). `app/tasacion/actions.ts`: push through `after()` (#156).
4. `PublishWizard`: OTP cooldown shown as `m:ss` (#87).
5. `sortOrder()`: `id` tie-break (#159, the SQL half).
6. `JsonLd.tsx`: `suppressHydrationWarning` (#179). `/favicon.ico` + apple-touch icon (#182).
7. `ProjectCard`: locale from the request, `sv-SE` (#168). `PriceAlert`: move every string into
   `svListing` / `sv.ts` and fix the Spanish lead text.
8. `resync.ts` in one transaction (#162). Hardened `backfill-images.ts` using `safe-fetch`,
   byte cap and paging (#160).
9. `/guias` returns an empty list instead of a 500 on schema drift (#141).
10. Port-plan **PR-4**: scope the `verify:import` rollback assertion to its agency, and close
    the `KNOWN-ISSUES.md` entry if the fixture was the cause. This touches
    `src/lib/import/jobs.ts` only if the investigation shows a real bug, and in that case
    **Anton merges it**.

### Phase 2 — Swedish URLs and SEO foundations (Opus director, Sonnet builders, ~1–2 sessions)

Do this **before launch**. Afterwards every rename costs a redirect and some ranking.

1. **Swedish route slugs**, with 308s from the old ones in `next.config.ts`:
   `/guias → /guider`, `/precios → /priser`, `/tasacion → /vardering`,
   `/publicar → /annonsera`, `/contacto → /kontakt`, `/preguntas-frecuentes → /vanliga-fragor`,
   `/como-funciona → /sa-fungerar-det`, `/privacidad → /integritet`, `/terminos → /villkor`,
   `/proyectos → /nyproduktion`, `/desarrolladoras → /byggherrar`, `/planes → /priser-for-maklare`,
   `/nosotros → /om-oss`, `/mis-avisos → /mina-annonser`, `/registro → /registrera`,
   `/login → /logga-in`. Keep one helper that spells each path, the same pattern as propia's
   `rentalPath()`, so no call site hard-codes a literal. The profile routes (`/inmobiliaria`,
   `/agente`) were deliberately kept Spanish (`CLAUDE.md` backlog 10); revisit them in the same
   PR as **`/maklare/{slug}`** because it is still free to do. Anton decides (F2).
   `/para-inmobiliarias` becomes the Spanish-language agency page (`/es/inmobiliarias`, noindex
   optional), next to `/for-maklare`.
2. **Hubs** (#176, #178, #151, #129): compact header, type chips (`/kop/hus`, `/kop/lagenhet`
   style links), listings first, and **200–400 words of real Swedish body copy** per operation
   hub and per top city ("Köpa lägenhet i Torrevieja" etc.). No invented facts; §3's caveats
   apply.
3. **City and area pages**: every municipio and zona hub gets the existing
   `guide_content_sv` block, market medians (`/priser`), flight time from Arlanda, Landvetter and
   Kastrup (a static table Anton confirms), and links to relevant guides.
4. `ItemList` / `BreadcrumbList` / `RealEstateListing` JSON-LD audit, sitemap `lastmod`, and
   OG images per listing.

### Phase 3 — Hemnet-level browsing (Sonnet builders, Opus review, ~2–3 sessions)

1. **"Ficha Clara" port** (#172, #170): full-screen gallery dialog with swipe and keyboard,
   sidebar filters that apply instantly with a loading state, sticky "Visa N bostäder" bar on
   mobile.
2. **Emoji → line-icon sweep** (C4e): one small icon set, dictionary icons as glyph names.
3. **Contrast to WCAG AA and Playwright** (#177, #159): `sort`, `listing-sidebar`, `contrast`
   specs against a local DB. Local only, never GitHub Actions.
4. **Map**: price pins in EUR with SEK in the popup when fresh (#191). "Search this area" on
   pan, using the existing `idx_geo` bbox query. No coalesce, no `IS NOT NULL` (`AGENTS.md` §4).
5. **Favourites (Sparade bostäder)**: start with localStorage, like `recently-viewed`, with no
   schema change. Move it to the account after Phase 5's decision.
6. **Compare up to three listings** side by side: price in EUR/SEK, €/m² against the median,
   total cost, and the legal status of each. This plays to the compliance data no competitor has.

### Phase 4 — The Swedish-buyer differentiators (Opus, some founder input)

1. **"Vad kostar det egentligen?" panel** on every listing, in SEK and EUR: price +
   acquisition cost (existing) + first-year running costs (IBI + comunidad × 12, both existing
   columns) + an *estimate* of the annual modelo 210 imputed-income tax. **The modelo 210 formula
   is money math: founder decision F3 before it ships.** Staleness rule as today: no fresh rate,
   no SEK.
2. **"Frågor att ställa innan du bokar" checklist**, generated from what the listing *does not*
   say: `legal_status = desconocido`, no `nota_simple_seen_at`, missing IBI or comunidad fee,
   `rustico` land, a holiday let without `tourist_licence`. Pure display logic, no new data,
   and very hard for competitors to copy without the columns.
3. **Köpprocessen guide hub** (Swedish): NIE, Spanish bank account, independent abogado,
   reservation contract, arras, escritura, modelo 210, plusvalía, and regional inheritance tax
   (Andalucía / Valencia / Baleares differ a lot). Every tax claim is checked by an advisor
   before publishing (§3), and each guide carries a "last reviewed" date.
4. **Visningsresa (viewing trip) lead type**: buyer picks a region, dates and budget, and the
   lead goes to the operator or to matching agencies. On the current schema this is a `buyer`
   lead with `utm.source: "visningsresa"` and a structured message, the way propia tags
   directory leads, so **no migration is needed** for v1.
5. **Video viewing request** on every listing ("Boka videovisning"). This is a lead flag, not
   a streaming feature.
6. **"Sälj din bostad i Spanien" landing page** for Swedes who already own there and want to
   sell to another Swede. This is a real supply source; propia's `/vender` is the structural
   reference. The FSBO flow (`/publicar`) already exists.
7. **FSBO owner e-mail on a new lead** (#157, adapted): send an e-mail through the existing SMTP
   transport, following the never-claim-delivery rule.
8. **Decreto 218/2005 (Andalucía) check**: compare the detail page and import template with the
   decree's list, and add a missing field only with a migration PR (Anton merges).

### Phase 5 — Supply and the agency side (Opus, schema PRs merged by Anton)

1. **Kyero v3 XML feed intake** through `planImport` / `commitImport`, with no second
   validation path. It covers: scheduled pull by feed URL per agency (permission column as today),
   catastral-exact dedup and phone-bucket fallback unchanged, the energy-rating publish gate
   applied, rollback trail as today. Then add Idealista and Fotocasa formats if agencies ask.
   **This is the most important build item in the plan.**
2. **Swedish-speaking agent filter and badge ("Svensktalande mäklare")**: `agents.languages`
   (migration). Also used by the lead routing below.
3. **Lead matching, Spain version**: take D3's shape (zones on agents, operator picks 1–3) but
   route **buyer** leads by comunidad/zona and language. `lead_matches` + `MatchPanel` port,
   migration, **Anton merges**.
4. **Relocation intermediaries as a first-class listing on buyer journeys** ("Få hjälp av en
   svensk köpombud"). `agencies.kind = "relocation"` already exists. This is copy, a directory
   filter and a lead CTA.
5. **Saved searches with e-mail alerts and account favourites** (migration: `saved_searches`,
   `favourites`; a `cron:alerts` runner in `src/lib/ops/` with `--dry`). This replaces today's
   `PriceAlert`, which is a lead form in disguise.
6. **Verified badge**: decide what "verified" means here (agency identity? nota simple seen?),
   then show it on cards (F4).
7. **`agencies.registry_number` UI** (D23) when agency outreach starts.

### Phase 6 — Running it without a terminal (Opus for schema, Sonnet for runners)

1. Port-plan **PR-6/PR-7**: one runner per job in `src/lib/ops/`; `scripts/*` become thin CLIs.
2. **`/admin/operaciones` + `ops_runs` + health panel** (#136, migration, **Anton merges**):
   run `cron:fx`, `cron:geo`, `cron:medians`, `cron:translate`, `cron:resync`, the Kyero pull
   and `cron:alerts` from `/admin`, with dry-run first. Cache invalidation after a real run (#164)
   and atomic medians (#163) come with it.
3. **Translate chain DeepL → Gemini → Claude, es→sv, bounded runs** (port-plan PR-5, C4d).
   Once feeds bring hundreds of Spanish descriptions, this is the cost line that matters.
4. `staff` role (#171) when a second person moderates. Auth + schema, so **Anton merges**.
5. Admin badges: review queue, leads in the last 24 h, feeds that failed last night.

### Phase 7 — Growth (ongoing, after launch)

- A guide library in Swedish around the search clusters in §3 ("köpa hus i Spanien",
  "[ort] lägenhet", "kostnader köpa bostad Spanien", "arvsskatt Spanien"), each linking to live
  listings and the cost panel.
- Newsletter with new listings per region, built on saved searches.
- Hemnet Utland syndication or partnership (a founder question: compete or feed).
- Google Business Profile for the brand once there is a real contact address.
- The English door (D21) only once the domain is bought. The flip checklist in `PLAN.md`
  already covers it.

---

## 6. Decisions only Anton can make

| # | Question | Blocks |
| --- | --- | --- |
| F1 | How do agencies pay: free at launch, a monthly subscription, pay-per-lead, or featured listings? | Phase 5 scope, `/for-maklare` and `/planes` copy |
| F2 | Rename `/inmobiliaria` and `/agente` to Swedish (`/maklare/…`) before launch? The recommendation is yes, while it is free. | Phase 2 |
| F3 | Is a modelo 210 *estimate* acceptable on listings, and with which formula and disclaimer? | Phase 4 item 1 |
| F4 | What does "verified" mean on this site? | Phase 5 item 6 |
| F5 | Which advisor reviews tax and legal guide copy (a Swedish-speaking abogado or asesor)? | Phase 4 item 3, Phase 7 |
| F6 | Reviews and ratings (D25): still parked? | nothing now |
| F7 | Flight-time table and "Swedish community" notes per area: who supplies the facts? | Phase 2 item 3 |

---

## 7. Suggested order and size

| Order | Phase | Size | Can start now? |
| --- | --- | --- | --- |
| 1 | Phase 1 — bugs and hardening | 1 session, Sonnet | Yes |
| 2 | Phase 2 — Swedish URLs + SEO foundations | 1–2 sessions | Yes (needs F2 for the profile routes only) |
| 3 | Phase 3 — Hemnet-level browsing | 2–3 sessions | Yes |
| 4 | Phase 4 — differentiators | 2 sessions | Yes for items 2, 4–7; F3 and F5 for items 1 and 3 |
| 5 | Phase 5 — supply | 2–3 sessions, schema PRs | Kyero intake yes; the rest after F1 and F4 |
| 6 | Phase 6 — ops console | 2 sessions, schema PR | After Phase 5's schema lands, to batch migrations |
| — | Phase 0 — founder items | parallel | Anton |

Phases 1–3 can run in parallel as separate PRs because they touch different files, except
where Phase 2's route renames and Phase 3's hub redesign both edit
`app/[operacion]/[...segments]/page.tsx`. Land Phase 2's rename first.
