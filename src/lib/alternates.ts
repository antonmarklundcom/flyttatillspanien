/**
 * hreflang — the language-alternate layer (PLAN.md D6, flip-day item 4).
 *
 * One deployment serves several doors, and on flip day two of them serve the
 * *same* content in two languages: `inmobiliaria.com.py` in Spanish and
 * `realestateinparaguay.com` in English. Two language versions that do not
 * point at each other compete in search instead of pairing; Google picks one
 * and the other's audience never sees it. That pairing is `hreflang`, and it
 * has to ship in the same release as the locale flip — which is why the
 * mechanism lands now, ahead of the flip, rather than being invented under
 * time pressure on the day.
 *
 * **It emits nothing today, on purpose.** Both enabled hosts are `locale:
 * "es"` and serve identical rows, so there is no translation to declare — and
 * annotating two Spanish URLs as language variants of each other would tell
 * Google the opposite of what `listingCanonicalOrigin()` tells it. Duplicates
 * are a canonical problem; hreflang is for translations. So the rule below is
 * "fewer than two distinct locales ⇒ no tags", and the day
 * `verticals.ts` says `locale: "en"` on one host, every wired page starts
 * emitting the pair with no further code change.
 *
 * Pure on purpose (no `next/headers`), the same split as `facets.ts` /
 * `facet-sql.ts`: the set of language versions is a property of the *content*,
 * not of the host that served it. Google requires every version to list the
 * same set, self included, so the map is deliberately identical on both hosts.
 * The one thing a caller must still decide with the request in hand is whether
 * this page is a canonical version at all — see `scope` and the note on
 * `hostOwnsListingDetail()` below.
 *
 * Verified by `npm run verify:seo` (pure, in the pre-push hook), which drives
 * it against a synthetic post-flip vertical table so the behaviour on flip day
 * is proven before the flip.
 */
import { CANONICAL_HOST, VERTICALS, type VerticalConfig } from "@/config/verticals";
import type { Locale } from "@/i18n";

/**
 * Which page types a host owns.
 *
 * - `"site"` — every page type an enabled door renders itself (home, the
 *   operation hubs, category pages).
 * - `"listing"` — `/propiedad/{slug}`, which only some hosts own (§2.8). A
 *   feeder canonicalises its detail pages back to the primary, so it is not a
 *   language version of anything and must not appear in the set. This mirrors
 *   `ownsListingDetail()` in `origin.ts`; the two read the same flag.
 */
export type AlternateScope = "site" | "listing";

export interface AlternateInput {
  /** Path as served, with its leading slash: "/", "/venta/asuncion", … */
  path: string;
  scope: AlternateScope;
  /**
   * Per-locale path overrides, for content whose URL is not the same string on
   * every door. Nothing needs this today — every URL in this app is built from
   * Spanish slugs plus an opaque `public_id` (`src/lib/urls.ts`), so the same
   * path resolves to the same listing on every host. If the English door ever
   * localises its slugs, this is the hook that keeps hreflang pointing at each
   * version's own canonical URL instead of a redirect.
   */
  pathByLocale?: Partial<Record<Locale, string>>;
}

export interface Door {
  host: string;
  config: VerticalConfig;
}

/**
 * The doors that speak for themselves: enabled verticals, plus the primary
 * host (served even if its own row still said `enabled: false` — the same
 * exception `origin.ts` makes, for the same reason).
 */
export function servedDoors(primaryHost: string): Door[] {
  return Object.entries(VERTICALS)
    .filter(([host, config]) => config.enabled || host === primaryHost)
    .map(([host, config]) => ({ host, config }));
}

function ownsScope(door: Door, primaryHost: string, scope: AlternateScope): boolean {
  if (scope === "site") return true;
  return door.host === primaryHost || door.config.ownsListingDetail;
}

/**
 * One door per locale. Two hosts sharing a locale is the state today
 * (both Spanish) and it is not an hreflang relationship — it is the duplicate
 * the canonical tag already resolves — so the winner is the one the canonical
 * points at: the primary host if it is in the set, otherwise declaration
 * order. Deterministic either way; hreflang that changes between renders is
 * worse than none.
 */
function doorPerLocale(doors: Door[], primaryHost: string): Map<Locale, Door> {
  const byLocale = new Map<Locale, Door>();
  for (const door of doors) {
    const locale = door.config.locale;
    const held = byLocale.get(locale);
    if (!held || door.host === primaryHost) byLocale.set(locale, door);
  }
  return byLocale;
}

/**
 * The `alternates.languages` map for a page, or `undefined` when there is
 * nothing honest to declare (a single language across every door — today).
 *
 * Keys are bare language codes rather than `es-PY`/`en-US`: the Spanish door
 * is written for Paraguay but serves any Spanish speaker, and the English door
 * is aimed at foreign buyers who are not in one country. Region-tagging either
 * would narrow who Google shows them to, for no gain.
 *
 * `x-default` names the version for a visitor whose language matches neither —
 * the primary host, which is also what every unowned host canonicalises to.
 */
export function languageAlternates(
  input: AlternateInput,
): Record<string, string> | undefined {
  return alternatesFor(servedDoors(CANONICAL_HOST), CANONICAL_HOST, input);
}

/**
 * The same rule, over an explicitly supplied set of doors.
 *
 * Exported so `npm run verify:seo` can drive the *post-flip* configuration —
 * `realestateinparaguay.com` in English, `inmobiliaria.com.py` primary — while
 * this deployment is still pre-flip. `CANONICAL_HOST` is read from the
 * environment at module load, so a check that only ever saw the live table
 * could confirm nothing except that today emits nothing, which is the one
 * outcome that does not need proving.
 */
export function alternatesFor(
  doors: Door[],
  primaryHost: string,
  input: AlternateInput,
): Record<string, string> | undefined {
  const owning = doors.filter((d) => ownsScope(d, primaryHost, input.scope));
  const byLocale = doorPerLocale(owning, primaryHost);
  if (byLocale.size < 2) return undefined;

  const urlFor = (door: Door) =>
    `https://${door.host}${input.pathByLocale?.[door.config.locale] ?? input.path}`;

  const languages: Record<string, string> = {};
  for (const [locale, door] of byLocale) languages[locale] = urlFor(door);

  const primary =
    owning.find((d) => d.host === primaryHost) ?? byLocale.values().next().value;
  if (primary) languages["x-default"] = urlFor(primary);

  return languages;
}
