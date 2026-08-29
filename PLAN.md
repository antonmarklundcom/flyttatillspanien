# PLAN.md — live build status

Living tracker for flyttatillspanien.se's own decisions and launch status.
**Update this file in every session that finishes a step** — mark items
done, add new blockers. `[C]` = Claude does it (code/session work). `[YOU]`
= founder must do it (hosting, accounts, real-world data — things code
cannot reach).

> **Not the same file as `plan.md` (lower-case).** That file is the
> phased-build script (Phases 1–6) that sequenced the Paraguay→Spain
> rebuild; it is a script that finishes, not a living tracker. This file —
> `PLAN.md` — is this project's own decision/status record, in the style
> the original Paraguay-era version of this file used (lettered decisions,
> a milestone table, a `[YOU]` section). Everything below is Spain/Sweden
> content; the Paraguay-era decisions this file used to carry (D1–D20,
> covering GHL, Guaraní financing rates, the `inmobiliaria.com.py` domain
> flip) are superseded in full by the rebuild and are not reproduced here —
> `plan.md` §9's build log is the historical record of that rebuild, and
> `docs/SPAIN-PORTAL-DESIGN.md` is the design decision set behind it.

_Last updated: 2026-08-29 (Phase 5 merging — all of this file's scope done:
the four-doc rewrite, the `sv.ts` editorial pass, `guide_content_sv` seeded
for all 41 municipios, `verify:seo`/`verify:i18n` green. Phase 6 (Hostinger
deploy) is next and has not started)._

---

## Where we actually are

- **Not live.** Phases 1–4 of the rebuild (`plan.md`) are merged: the Spain
  schema, config, core query/import/auth logic, public pages, and the
  admin/agency panels all exist and are verified against a local MySQL 8.4.
  Phase 5 (SEO/content/docs/the editorial Swedish pass) is in progress.
  **Phase 6 (Hostinger deploy) has not started** — there is no production
  domain, no production database, and no live traffic.
- **Local build is green.** `npm run verify:local` (typecheck + build + the
  four pure verify scripts) passes; `npm run verify:scopes` and
  `verify:import`'s DB-backed half pass against a local database, with one
  known exception (below).
- **Every `acquisition_costs` rate is a placeholder.** Seven comunidad rows
  exist (`AN`, `VC`, `MC`, `IB`, `CN`, `CT`, `MD`), each marked PLACEHOLDER
  with `source_url` NULL. These print real money figures on every detail
  page and must be verified against each comunidad's published ITP/AJD
  scale before launch — see the launch checklist in `README.md`.
- **`CONTACT_EMAIL` and SMTP are not yet configured anywhere.** The site is
  null-safe without them (no compose window to a mailbox nobody owns), but
  production OTP and lead mail do not send until they exist — a Phase 6/
  launch blocker, not a code gap.
- **A known, pre-existing defect**: `DATABASE_URL=<local> npm run
  verify:import`'s rollback exercise fails — `rollbackImportJob()`'s
  `updated`-outcome path leaves two generations of a row instead of
  restoring one. Confirmed present since before Phase 4 (`KNOWN-ISSUES.md`);
  needs a session with core-logic license (`src/lib/import/jobs.ts`) to
  trace, which is out of a Sonnet-phase's reach per `plan.md` §4.7. Does not
  block the pre-push hook, which never sets `DATABASE_URL`.

## Decisions record

Numbered `D21` onward — the Spain rebuild restarted the letter/number
sequence rather than reusing `D1`–`D20`, which were Paraguay-specific
(GHL, the `.com.py` domain flip, Guaraní financing) and no longer apply.
**One exception: `D8`.** `src/db/schema.ts`'s own comment on
`leads.routed_to` names the `owner` enum member "the FSBO lane (PLAN.md
D8)" — that comment is schema code, out of a Sonnet phase's reach to
rewrite (`plan.md` §4.7), so the letter stays live rather than being
freed for reuse or silently orphaned.

- [x] **D8 — FSBO owner panel: build it, don't leave private sellers'
      leads stuck in the operator's internal queue.** Carried over
      unchanged in substance from the Paraguay build, where it shipped
      before this repo was copied: `leads.routed_to` has an `owner` lane
      for a listing with no agent and no agency (published via
      `/publicar`), and `getPanelLeads(scope)` includes `owner`-routed
      leads for any scope, safely, because the query's own ownership
      guard already restricts the result to that scope's own listings —
      a private seller's own panel session sees their leads with no
      separate build. No dedicated "owner" panel route exists or is
      needed; the FSBO publisher uses the same panel shape an agent does.
      Contact is by email end to end now (§1 email-first decision, not
      WhatsApp), so there is no operator-forward step to maintain either.

- [x] **D-mortgage — lender partnership before mortgage quoting.** A Spanish
      mortgage calculator is backlog, not MVP. A **non-resident** buyer's
      loan-to-value and rate are negotiated per applicant, per bank — there
      is no published scale to seed (unlike Paraguay's old AFD programme,
      which had public terms to quote from), so any printed rate would be
      an invention, not a fact. What ships instead is the acquisition-cost
      estimate (ITP/IVA+AJD, notario, registro, gestoría — roughly 10–14%
      on top of the asking price): deterministic, needs no rate feed, and
      closer to the number that actually blindsides a Swedish buyer coming
      from a market where the acquisition tax is near zero. A mortgage
      calculator returns only once there is a real lender partnership to
      quote a real rate — that is a business/founder decision about
      partnerships, not an engineering one, and it is not to be
      re-litigated every time a competitor's payment slider comes up.
      Recorded per `docs/SPAIN-PORTAL-DESIGN.md` §4; also flagged as a
      backlog item in `CLAUDE.md`.

- [ ] **D21 — English-door domain: when to buy it, and the flip.** The
      genuine second-audience door (Norwegian/Danish/Finnish/Dutch buyers of
      Spanish property, who read English) is deliberately **not** in
      `verticals.ts` — the founder does not own the domain, and an unowned
      domain in the code becomes a fallback nobody meant to build (the exact
      lesson the old `propia.com.py` entry taught the Paraguay build). Not
      before the domain is bought. When it is, the flip is: add one
      `VerticalConfig` entry with `locale: "en"`, widen `VerticalKey` to
      `"sv" | "en"`, reintroduce `src/i18n/en.ts` as a fresh file (not a
      restore — it was deleted, not archived), and add
      `title_en`/`description_en`/`translation_hash_en` columns alongside
      the existing Swedish pair, following the exact suffix pattern already
      used for `_sv`. `languageAlternates()` and `verify:seo` already handle
      the two-door case correctly and need no change on flip day itself.

- [ ] **D22 — GDPR / privacy-policy legal review.** The privacy copy is
      translated to Swedish and the Paraguay-specific content is gone, but
      whether the *substance* is adequate for a Swedish consumer site under
      GDPR — lawful basis for `users.identity_doc_type`/`identity_ref_last4`/
      `identity_verified_at`, retention wording for lead data — is a review
      by the founder or a lawyer, not something a build phase can certify.
      Blocks nothing in code; blocks launch.

- [ ] **D23 — `agencies.registry_number` UI.** The column exists
      (v1.1 per the design doc's MVP/wait table) but has no consumer: no
      form collects it, no profile page renders it. Most of Spain has no
      mandatory estate-agent registry, so its absence must never render as
      a red flag once a UI exists. Not a launch blocker — a founder call on
      when agency outreach makes it worth building.

- [ ] **D24 — Full NIE/DNI capture.** Deliberately not built
      (`ARCHITECTURE.md` §5): the portal's real need (identity check) is
      satisfied by a one-time document check, not a stored national ID
      number, and storing the full number would need a documented lawful
      basis and a data-processing agreement this project does not have.
      If a real business need for full capture ever appears, it is a
      founder decision plus a DPA — not something to add to the schema on
      an engineering judgment call alone.

- [ ] **D25 — Reviews / ratings.** Inherited backlog item from the Paraguay
      build, never built there either. Needs a migration and a moderation /
      anti-fake-review design before it is worth starting. **Ask the founder
      before starting** — this is a product-trust decision, not a
      quick add.

- [x] **D26 — Email transport: SMTP now, transactional provider later.**
      Resolved at plan review (2026-08-28, `plan.md` §1): nodemailer over
      SMTP against a Hostinger mailbox on the same account the site deploys
      to, behind the existing `crm.ts`-style interface. A move to a
      transactional provider (Resend/Postmark) once real lead volume exists
      is a founder call on deliverability, not an architecture change — the
      interface boundary is what keeps that swap a config change.

- [x] **D27 — `alquiler_vacacional` at MVP.** Resolved at plan review
      (2026-08-28): the enum member ships live, `tourist_licence` is
      collected in the wizard and rendered on the detail page. The design
      doc's original "only if it ships" condition on the `tourist_licence`
      column is met.

## Milestone status (the six-phase rebuild, `plan.md`)

| Phase | Scope | Status |
| --- | --- | --- |
| 1 — Schema, config & core libs | Spain schema, single-vertical config, env vars, `sv.ts`, seed/cron scripts | ✅ merged (`plan.md` §9, 2026-08-28) |
| 2 — Core logic | Query layer on `price_eur`, catastral-exact + fallback dedup, publish gate, email-first leads/OTP, `verify:*` fixtures | ✅ merged (2026-08-29) |
| 3 — Public pages | Home, category pages, `/bostad/[slug]`, publish wizard, `/for-maklare`, `seed:dev` | ✅ merged (2026-08-29) |
| 4 — Admin & agency panels | Energy/legal/charges editing, `nota_simple_seen_at`, FX/acquisition-cost override UI, agency `kind` selector, identity verification | ✅ merged (2026-08-29) |
| 5 — SEO, content & docs | `verify:seo` fixtures, guide content seed, the `sv.ts` editorial pass, this file + `ARCHITECTURE.md` + `README.md` + `CLAUDE.md` rewrite | 🔶 in progress |
| 6 — Deploy | Hostinger app + MySQL, production env, cron registration, domain, smoke test | ⏳ not started |

Real-world go-live also needs the items in the `[YOU]` section below, none of
which a phase session can complete on its own.

## [YOU] — production items code cannot reach

- [ ] **Hostinger account + Node.js-capable plan**, confirmed before Phase 6
      starts. If missing, Phase 6 stops and reports rather than guessing an
      upgrade.
- [ ] **`flyttatillspanien.se` domain DNS access**, to point at the
      Hostinger app once it exists.
- [ ] **Production `DATABASE_URL`.** Same footgun the Paraguay build hit:
      the MySQL username is not the database name on Hostinger — verify
      both independently rather than assuming one from the other.
- [ ] **`CONTACT_EMAIL` real mailbox** — launch blocker (`ARCHITECTURE.md`
      §6): the site works without it (null-safe) but is not launch-credible.
- [ ] **SMTP credentials** (`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/
      `EMAIL_FROM`) — launch blocker: no OTP login and no lead mail send
      without them. Can be the same Hostinger mailbox as `CONTACT_EMAIL`,
      created in hPanel → Emails.
- [ ] **Cloudflare R2 account + bucket + `R2_*` envs.** Code is complete and
      gated on `isR2Configured()` — nothing to build, just an account to
      create and envs to set, then `npm run backfill:images` once.
- [ ] **Verify every `acquisition_costs` rate** against each comunidad's
      published ITP/AJD scale and realistic notary/registry/legal
      percentages before launch — every seeded row is currently a
      PLACEHOLDER and these print real money figures on the site.
- [ ] **GDPR/privacy-policy legal review** — see D22.
- [ ] **ECB FX feed reachability from the Hostinger box**, ongoing via
      `cron:fx`. No API key needed, but outbound HTTPS from the Hostinger
      box to `ecb.europa.eu` needs confirming — it was blocked by this
      build environment's own outbound proxy during Phase 1/3 and the cron
      failed gracefully (writes nothing, previous rate stands) rather than
      crashing, which is the correct behaviour either way.
- [ ] **Zone-card photography.** `public/img/zona-{marbella,torrevieja,palma,javea}.webp`
      are the four inherited Paraguay zone photos, renamed rather than
      replaced — none of them actually depict their new city
      (`KNOWN-ISSUES.md`). Real location photography or an image-generation
      pass is a founder/content task.

## Open business questions (parked, not build work)

Carried from `plan.md` §8 — the build phases record these as explicitly out
of scope; they stay open here until a founder decision closes them.

- **D21** — English-door domain timing.
- **D22** — GDPR/privacy-policy legal review.
- **D23** — `agencies.registry_number` UI.
- **D24** — Full NIE/DNI capture.
- **D25** — Reviews/ratings.
- Basura (rubbish-collection annual fee) as its own column — v1.1, small,
  rarely present in agency feeds.
- Nota simple / escritura document **storage** — needs the R2 account (see
  the `[YOU]` list above) plus a retention policy; storage, not just the
  `nota_simple_seen_at` flag, which already exists.
- `/es/inmobiliarias` — the Spanish-language sibling to `/for-maklare`,
  hand-written outside the dictionary system, `noindex` optional. Waits
  until agency outreach actually starts.

## Known, tracked defects

Full list with reproduction detail lives in `KNOWN-ISSUES.md` — this section
is a pointer, not a duplicate. Headline items as of this update:

- `verify:import`'s DB-backed rollback exercise fails on the `updated`
  outcome path (pre-existing, out of Sonnet-phase reach — see "Where we
  actually are" above).
- `sv.ts` is working-draft Swedish pending Phase 5's editorial pass;
  `svPanel`, `svHome`, `svPrecios`, `svTasacion` are the roughest namespaces.
- Zone-card photography is inherited Paraguay imagery (see `[YOU]` above).
