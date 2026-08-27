/**
 * Verify the hreflang layer and the vertical table's SEO invariants — pure,
 * no database, no network.
 *
 * `src/lib/alternates.ts` emits nothing today: flyttatillspanien.se is the
 * only enabled door and `Locale`/`VerticalConfig.locale` are both narrowed to
 * `"sv"` (docs/SPAIN-PORTAL-DESIGN.md §1 — no disabled English entry until
 * that domain is bought). The inherited propia.node version of this script
 * built a synthetic two-locale table (the PY→EN flip, PLAN.md D6) to exercise
 * `alternatesFor()`'s multi-door logic; that is impossible to construct
 * honestly here without widening `Locale` beyond what the codebase actually
 * serves, which is exactly the premature-second-door mistake CLAUDE.md warns
 * against. So this version checks what a one-door table can prove for real,
 * and the multi-door exercise returns verbatim the day `Locale` widens to
 * `"sv" | "en"` for a real English domain.
 *
 * Run: npm run verify:seo   (also part of npm run verify:local)
 */
import { VERTICALS, CANONICAL_HOST } from "../src/config/verticals";
import { languageAlternates, servedDoors } from "../src/lib/alternates";

let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\nhreflang: the live table (one door, one locale)");

check(
  "no language alternates while there is only one served door",
  languageAlternates({ path: "/", scope: "site" }) === undefined,
  JSON.stringify(languageAlternates({ path: "/", scope: "site" })),
);
check(
  "…and none on listing detail either",
  languageAlternates({ path: "/bostad/villa-abc1234567", scope: "listing" }) ===
    undefined,
);
check(
  "the primary host is a served door even if its row said enabled: false",
  servedDoors(CANONICAL_HOST).some((d) => d.host === CANONICAL_HOST),
);
check(
  "there is exactly one served door today",
  servedDoors(CANONICAL_HOST).length === 1,
  "a second entry here without a second real domain is the propia.com.py mistake CLAUDE.md warns against",
);

/**
 * The vertical table is hand-written TypeScript, so the traps below all
 * compile. Each one is a live SEO regression that no page would report: the
 * site keeps rendering and Google quietly does the wrong thing with it. These
 * stay meaningful with one door — they are what makes adding a second one
 * later a safe, mechanical change rather than an SEO incident.
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
 * The duplicate-content trap that made `inmobiliaria.com.py` ship
 * `ownsListingDetail: false` on propia.node: two hosts serving the same rows
 * in the same language, each self-canonicalising its detail pages, is two
 * domains publishing identical content. With one door today this is
 * trivially satisfied — it stays here so a second door added later cannot
 * reintroduce it silently.
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
  brands.join(" / ") + " — the domain IS the brand, so two doors sharing a name means one of them is wearing the other's",
);

/**
 * `origin.ts` treats the primary host as owning its detail pages whatever its
 * row says. If the row disagrees, the code is right and the table is lying to
 * the next reader.
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
