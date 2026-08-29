/**
 * Verify the hreflang layer and the vertical table's SEO invariants — pure,
 * no database, no network.
 *
 * `src/lib/alternates.ts` emits nothing today: there is exactly one door
 * (`flyttatillspanien.se`, `locale: "sv"`), and a language map needs two
 * locales. A check that only exercised the live table would therefore prove
 * the one thing that needs no proving. What has to be right is the behaviour
 * on the day an **English door** is bought and enabled (plan §8) — the release
 * that makes this a two-locale site. That configuration does not exist yet, so
 * the check builds it and runs the real rule against it.
 *
 * **Why the synthetic door needs a cast.** `VerticalConfig.locale` is
 * `"sv"` and `copy` is `"relocation"` — one member each, deliberately, because
 * `en.ts` is deleted until the domain is owned. A second-locale door is
 * therefore not expressible in the current types, which is precisely the state
 * this check exists to survive: the machinery (`Widen<>`, `alternatesFor`,
 * `servedDoors`) must already be correct on the day those unions widen, or the
 * widening turns into a refactor. The casts below are the check saying so out
 * loud, and they are the only place in the repo that does this.
 *
 * Run: npm run verify:seo   (also part of npm run verify:local)
 */
import { VERTICALS, CANONICAL_HOST } from "../src/config/verticals";
import {
  alternatesFor,
  languageAlternates,
  servedDoors,
  type Door,
} from "../src/lib/alternates";

let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\nhreflang: the live table (pre-flip)");

console.log("\nhreflang: the live table (one door)");

check(
  "no language alternates while there is a single served locale",
  languageAlternates({ path: "/", scope: "site" }) === undefined,
  JSON.stringify(languageAlternates({ path: "/", scope: "site" })),
);
check(
  "…and none on listing detail either",
  languageAlternates({ path: "/bostad/villa-abc1234567", scope: "listing" }) ===
    undefined,
);
check(
  "the primary host is a served door even if its row says enabled: false",
  servedDoors(CANONICAL_HOST).some((d) => d.host === CANONICAL_HOST),
);
check(
  "a host with no entry is not a served door",
  !servedDoors(CANONICAL_HOST).some((d) => d.host === "example.invalid"),
);

console.log("\nhreflang: the day an English door exists (plan §8)");

/**
 * The Swedish door as it is today, plus the English one as it would be. The
 * English host is a placeholder: the domain is not owned (plan §8), and
 * nothing but this check may name it — a `verticals.ts` entry for a domain
 * nobody owns is how broken canonicals ship sitewide.
 */
const FLIP_PRIMARY = CANONICAL_HOST;
const EN_HOST = "flyttatillspanien.example";
const flipDoors: Door[] = [
  {
    host: CANONICAL_HOST,
    config: { ...VERTICALS[CANONICAL_HOST], ownsListingDetail: true },
  },
  {
    host: EN_HOST,
    config: {
      ...VERTICALS[CANONICAL_HOST],
      key: "en",
      brand: "Move to Spain",
      // See the file header: a second locale is not expressible in the
      // current unions, and proving the machinery survives them widening is
      // the whole point of this fixture.
      locale: "en",
      ownsListingDetail: true,
    } as unknown as (typeof VERTICALS)[typeof CANONICAL_HOST],
  },
];

const home = alternatesFor(flipDoors, FLIP_PRIMARY, { path: "/", scope: "site" });
check("two locales produce a language map", home !== undefined);
check(
  "Swedish points at the primary",
  home?.["sv"] === `https://${CANONICAL_HOST}/`,
  home?.["sv"],
);
check(
  "English points at the English door",
  home?.["en"] === `https://${EN_HOST}/`,
  home?.["en"],
);
check(
  "x-default is the primary, the same host every unowned door canonicalises to",
  home?.["x-default"] === `https://${CANONICAL_HOST}/`,
  home?.["x-default"],
);
check(
  "no region tags — bare language codes only",
  Object.keys(home ?? {}).every((k) => k === "x-default" || /^[a-z]{2}$/.test(k)),
  Object.keys(home ?? {}).join(", "),
);

const cat = alternatesFor(flipDoors, FLIP_PRIMARY, {
  path: "/kopa/marbella/villor",
  scope: "site",
});
check(
  "the path is carried onto every door",
  cat?.["sv"] === `https://${CANONICAL_HOST}/kopa/marbella/villor` &&
    cat?.["en"] === `https://${EN_HOST}/kopa/marbella/villor`,
);

const listing = alternatesFor(flipDoors, FLIP_PRIMARY, {
  path: "/bostad/villa-abc1234567",
  scope: "listing",
});
check(
  "detail pages pair once both doors own their own",
  listing?.["en"] === `https://${EN_HOST}/bostad/villa-abc1234567`,
);

/**
 * The half-way state: the English door is live, but it still canonicalises its
 * detail pages back to the Swedish ones (which is what a door serving the same
 * rows in a machine translation should do until its own copy is real). Then it
 * is not a language version of them and must not be listed — the same rule
 * that keeps an unowned page type out of the sitemap.
 */
const halfFlipped: Door[] = [
  flipDoors[0],
  {
    host: EN_HOST,
    config: { ...flipDoors[1].config, ownsListingDetail: false },
  },
];
check(
  "a door that canonicalises its detail pages away is not a language version",
  alternatesFor(halfFlipped, FLIP_PRIMARY, {
    path: "/bostad/villa-abc1234567",
    scope: "listing",
  }) === undefined,
);
check(
  "…but its site pages still pair",
  alternatesFor(halfFlipped, FLIP_PRIMARY, { path: "/", scope: "site" }) !==
    undefined,
);

console.log("\nhreflang: ambiguity and overrides");

/** Two Swedish doors plus one English: the Swedish slot must be the primary. */
const threeDoors: Door[] = [
  {
    host: "villor.flyttatillspanien.example",
    config: { ...VERTICALS[CANONICAL_HOST], enabled: true },
  },
  ...flipDoors,
];
const tie = alternatesFor(threeDoors, FLIP_PRIMARY, { path: "/", scope: "site" });
check(
  "the primary wins the locale it shares with another door",
  tie?.["sv"] === `https://${CANONICAL_HOST}/`,
  tie?.["sv"],
);
check("one entry per locale, plus x-default", Object.keys(tie ?? {}).length === 3);

const overridden = alternatesFor(flipDoors, FLIP_PRIMARY, {
  path: "/kopa/marbella",
  scope: "site",
  // Not expressible while `Locale` is `"sv"` — same reason as the door above.
  pathByLocale: { en: "/for-sale/marbella" } as Partial<Record<"sv", string>>,
});
check(
  "a per-locale path override reaches only that locale",
  overridden?.["en"] === `https://${EN_HOST}/for-sale/marbella` &&
    overridden?.["sv"] === `https://${CANONICAL_HOST}/kopa/marbella`,
);

/** Google requires every version to list the same set, self included. */
const selfListed = Object.values(home ?? {}).includes(
  `https://${CANONICAL_HOST}/`,
);
check("the set is self-referential (host-independent by construction)", selfListed);

/**
 * The vertical table is hand-written TypeScript, so the traps below all
 * compile. Each one is a live SEO regression that no page would report: the
 * site keeps rendering and Google quietly does the wrong thing with it. They
 * are cheap to satisfy with one door and stay because adding the second one is
 * exactly when a half-applied edit is likely — so the half-applied state fails
 * a push instead of a quarter of indexing.
 */
console.log("\nvertical table: traps that are not type errors");

const servedNow = servedDoors(CANONICAL_HOST);

check(
  "CANONICAL_HOST has an entry",
  Boolean(VERTICALS[CANONICAL_HOST]),
  `${CANONICAL_HOST} is not a key of VERTICALS — every page would be branded with a domain nobody owns (audit F41)`,
);

for (const host of Object.keys(VERTICALS)) {
  check(
    `"${host}" is in the form VERTICALS is looked up by`,
    host === host.toLowerCase().replace(/^www\./, "").split(":")[0],
    "resolveVertical() lowercases, strips www. and drops the port before this lookup, so any other spelling silently never matches",
  );
}

const keys = Object.values(VERTICALS).map((v) => v.key);
check(
  "vertical keys are unique",
  new Set(keys).size === keys.length,
  "currentVertical() resolves the x-vertical header by finding the FIRST entry with that key — two hosts sharing one would serve whichever comes first in the file",
);

/**
 * The duplicate-content trap, and the reason `inmobiliaria.com.py` ships
 * `ownsListingDetail: false` today: two hosts serving the same rows in the
 * same language, each self-canonicalising its detail pages, is two domains
 * publishing identical content. Flipping that flag alone — without the locale
 * flip that makes one of them a translation — is the single-line edit that
 * causes it.
 */
const detailOwners = servedNow.filter(
  (d) => d.host === CANONICAL_HOST || d.config.ownsListingDetail,
);
const localesOwningDetail = detailOwners.map((d) => d.config.locale);
check(
  "no two served doors own their detail pages in the same language",
  new Set(localesOwningDetail).size === localesOwningDetail.length,
  detailOwners.map((d) => `${d.host} (${d.config.locale})`).join(" + "),
);

check(
  "a directory/projects door does not claim listing detail",
  servedNow.every((d) => !d.config.mode || d.config.mode === "portal" || !d.config.ownsListingDetail),
  "those doors render a different shell entirely and have no /bostad to be canonical for",
);

const brands = servedNow.map((d) => d.config.brand);
check(
  "every served door has its own brand name",
  brands.every(Boolean) && new Set(brands).size === brands.length,
  brands.join(" / ") + " — the domain IS the brand (CLAUDE.md), so two doors sharing a name means one of them is wearing the other's",
);

/**
 * `origin.ts` treats the primary host as owning its detail pages whatever its
 * row says. If the row disagrees, the code is right and the table is lying to
 * the next reader. Note the limit: CANONICAL_HOST comes from the environment,
 * and on flip day the env moves in hPanel — a local run of this check still
 * sees the code default, so it catches the mismatch only for whoever runs it
 * with the new value set.
 */
check(
  "the primary host's row agrees that it owns its detail pages",
  VERTICALS[CANONICAL_HOST]?.ownsListingDetail !== false,
  `${CANONICAL_HOST} is primary, so origin.ts self-canonicalises its /bostad pages regardless of the flag`,
);

console.log(
  failures === 0
    ? "\nseo: all checks passed\n"
    : `\nseo: ${failures} check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
