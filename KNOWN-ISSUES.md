# KNOWN-ISSUES.md

Small, non-blocking defects and deferred details found while building. Not a
backlog of *scope* — that is `plan.md` §10. Each entry says what is wrong,
where, and who should fix it.

Format: `- [phase found] area — what, and what would fix it.`

## Open

- [3, decided] `src/lib/urls.ts` — `agencyUrl()`/`agentUrl()` keep the Spanish
  segments `/inmobiliaria/{slug}` and `/agente/{slug}`. Phase 3 had the choice
  (§4.6 build log left it open) and decided to keep them rather than move the
  route directories: the design doc's handoff names only `/propiedad → /bostad`
  and the operation segments as required renames, these two profile routes
  are not SEO-load-bearing category pages, and moving them adds redirect risk
  for zero design-doc benefit. `/bostad` (the one rename the handoff actually
  requires) is done — see the Phase 3 build log.

- [1] `src/i18n/sv.ts` — the dictionary is **working-draft Swedish**: correct
  language, correct intent, no Spanish left, no empty strings, but not the final
  editorial voice. Phase 5 owns the editorial pass (plan §6.3). The roughest
  namespaces, in the order they most repay a rewrite: `svPanel` (largest, most
  mechanical), `svHome` (marketing register, several straplines are literal
  translations of Paraguayan copy that was written for a different market),
  `svPrecios` and `svTasacion` (the caveat sentences are long and read like
  translations). `svListing`'s legal block and `svPublish`'s legal step were
  written from scratch for Spain and are the closest to final.

- [1] `src/i18n/sv.ts` — the namespace identifiers keep their inherited Spanish
  suffixes (`svTasacion`, `svPrecios`, `svPublish`) so that the rename stayed
  mechanical and diffable. Renaming them to `svValuation`/`svPrices` touches
  every consumer and belongs with whichever phase is already editing those
  pages, not with a schema phase.

- [1] `scripts/seed-acquisition-costs.ts` — **every rate is a PLACEHOLDER** and
  `source_url` is NULL on all seven rows on purpose (a source link next to an
  unverified number makes the number look verified). These print money figures
  on a detail page. Verifying each comunidad's published ITP/AJD scale, and the
  notary/registry/legal estimates, is a research task for the founder, not a
  code task. Same status the Paraguayan AFD rate had upstream.

- [1] `scripts/seed-locations.ts` — the Palma zona is seeded as `Old Town`, the
  name the design doc's seed table gives. It is the one English name in an
  otherwise Spanish/Catalan location set (`casc-antic`/`casco-antiguo` would be
  the local form). Kept verbatim rather than silently deviating from the seed
  table; renaming it is a one-line change plus a redirect if it has ever been
  indexed.

- [1] Stale Paraguay narration survives in code comments wherever the file
  otherwise compiles unchanged. Phase 1 cleared the routing/SEO/theme libs
  (`alternates.ts`, `design/themes.ts`) and the config layer; Phase 2 owns the
  same problem in `crm.ts`, `otp.ts`, `auth/password.ts` and `wa.ts` (plan
  §5.2.4). **Phase 5's leftover-Paraguay grep only covers the four doc files**,
  so a stale comment anywhere else survives as false documentation unless the
  phase that touches the file fixes it.

- [2] The importer's operator-facing skip reasons are a mix of English
  ("unresolved location '…'") and inherited Spanish ("precio de venta
  sospechosamente bajo"), while everything else the operator reads is Swedish.
  They are produced in `src/lib/import/upsert.ts` and surface in the import
  report. Moving them into `sv.ts` is the fix; Phase 2 corrected the one that
  was factually wrong (it quoted US$) and left the language to whichever phase
  is already editing that copy. `PUBLISH_BLOCK_MESSAGE` is the shape to follow.

- [2] `/admin` and `/agencia` still carry inline Spanish labels
  (`LEAD_TYPE_LABEL`, `ROUTED_LABEL`, `OPERATION_OPTIONS`, the panel's inline
  Spanish `listingStatusLabel` neighbours). Phase 2 changed only what stopped
  compiling or stated something false; the panels are Phase 4's and the
  editorial pass is Phase 5's. They compile and they are not wrong about the
  data — they are just in the wrong language. (`/datos`'s prose and its
  `toLocaleString("es-PY")` calls, part of this item when it was written, were
  fixed in Phase 3 — that page is a public content page, not part of the
  panel.)

- [2] `scripts/check-migrations.ts` still probes for "migration 0009" by name
  when it reports on the `leads.routed_to` owner lane. Phase 1 regenerated the
  twelve inherited migrations as a single `0000_spain_schema.sql`, so the
  sentence names a file that does not exist. The check itself reads
  `information_schema` and is correct; only its narration is stale.

- [2] `npm audit` reports four high-severity advisories, all in transitive
  dependencies of `next` (`postcss`, `sharp`) rather than anything this repo
  imports directly, and `package.json` already pins an override for `postcss`.
  Resolving them means moving Next itself, which is not a change to make in the
  middle of a phased build with no staging environment.

- [2] `src/lib/import/from-url.ts` reads a price only when the page says euros,
  and leaves it blank with a note otherwise. That is deliberate — inventing an
  exchange rate on a scrape is worse than an empty field — but it means the
  English-language Spanish portals that quote in £ or $ hand the agent a form
  with no price in it. If claim-by-link ever becomes a volume path, reading the
  page's own currency and asking the agent to confirm a converted figure is the
  upgrade, not silently converting.

- [1] Local development pulls `mysql:8.4` from Docker Hub. In this build
  environment the Hub blob CDN (`production.cloudfront.docker.com`) is blocked by
  the outbound proxy, and the image had to come from `mirror.gcr.io/library/mysql:8.4`
  and be tagged locally. `docker-compose.yml` deliberately still names `mysql:8.4`,
  which is what works on an unrestricted machine; anyone hitting a 403 while
  pulling can do the same two commands. Not a code defect.

- [3] `public/img/zona-{marbella,torrevieja,palma,javea}.webp` (the home page's
  zone cards) are the four inherited Paraguay zone photos, copied and renamed
  rather than replaced — none of them actually depict their new city. Real
  location photography (or an image-generation pass) is a founder/content task,
  not a code task; the four old Paraguay-named files were deleted so nothing
  keeps two copies.

- [3] The publish wizard (`PublishWizard.tsx` / `app/publicar/actions.ts`)
  collects `referencia_catastral`, `energy_rating`, `legal_status`,
  `charges_status` and `tourist_licence`, but **not** `ibi_annual_eur` /
  `community_monthly_eur` — `DraftPayload` and `saveDraft()`'s `DraftInput`
  (`src/lib/publish-queries.ts`) never gained fields for them in Phase 2, and
  extending that file is query-layer/core-logic territory a Sonnet phase's
  hard limits (§4.7) put out of reach. The columns exist and the detail page
  already renders them when present (via CSV import or a future `/admin`
  edit) — a self-published FSBO listing just cannot state them yet. Whichever
  phase next has license to touch `publish-queries.ts` should add the two
  fields following the exact `referenciaCatastral`/`energyRating` pattern
  already there.

- [3] `svListing.priceRentPeriod` ("/mån") renders under the price for every
  non-`venta` operation, `alquiler_vacacional` (a holiday let) included — a
  short-term rental is conventionally priced per night or per week, not per
  month. This is an inherited simplification (the same line propia.node used
  for its one rental type); giving holiday lets their own period unit is a
  small product decision, not a bug fix, so `scripts/seed-dev-listings.ts`'s
  `alquiler_vacacional` rows use monthly-scale prices to match what the page
  currently prints rather than pretending the fixture disagrees with the
  page.

- [3] `projects` has no `description_sv` column (only `listings` gained the
  `title_sv`/`description_sv`/`translation_hash_sv` triple in Phase 1) — the
  project detail page (`app/proyecto/[slug]/page.tsx`) and its metadata can
  only ever show `descriptionEs`. Adding the column is schema work, out of a
  Sonnet phase's reach; noted here rather than worked around with an invented
  Swedish string.

- [3] `projects.projectType` (`edificio`/`loteamiento`/`condominio`/
  `barrio_cerrado`) is an inherited enum the design doc never revisits for
  Spain — `loteamiento` and `barrio_cerrado` are Latin-American development
  types with no clean Spanish real-estate equivalent. `svProject.typeLabel` in
  `src/i18n/sv.ts` gives each a working Swedish gloss so the page never prints
  a raw enum value, but they are not a researched taxonomy; a founder call on
  whether `projects` needs its own Spain-shaped type set (or whether the
  feature is even in scope before real project data exists) is a design
  question, not a Phase 3 fix. The same file also had `STAGE_LABEL`/
  `STATE_LABEL` maps keyed to the old Paraguay stage enum
  (`en_pozo`/`entrega_inmediata`/`usado`) that would have printed raw enum
  values against the real `sobre_plano`/`en_construccion`/`obra_nueva`/
  `segunda_mano` schema — fixed by reusing `svListing.stateLabel`, the same
  class of bug `app/desarrolladoras/page.tsx` had.

- [3] `/for-maklare` (this phase's purpose-built Swedish agency pitch) and
  `/para-inmobiliarias` (the inherited page, content-corrected but not
  redesigned) now both exist and pitch the same thing. Primary nav
  (`HEADER_NAV`, `FOOTER_PRO`) points at `/for-maklare`; `/para-inmobiliarias`
  is still in `STATIC_SITEMAP_PATHS` and reachable by direct link, but no
  longer linked from the header or footer. Consolidating or redirecting one
  into the other is an editorial call for Phase 5, not a Phase 3 fix.
