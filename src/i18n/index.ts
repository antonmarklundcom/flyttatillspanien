/**
 * The dictionary layer.
 *
 * `sv.ts` holds the strings; this module is how a surface *reaches* them.
 * The point of the indirection is that reintroducing a second locale (English,
 * once that domain is bought — see docs/SPAIN-PORTAL-DESIGN.md) means editing
 * this file alone — no page, no component, and no call site changes again.
 *
 * **Client-safe on purpose.** This module must never import `next/headers`,
 * directly or transitively — `SearchBar` and five other client components
 * consume it, the same constraint `src/lib/brand.ts` lives under. The
 * request-scoped half (reading the `x-locale` header the middleware sets)
 * lives in `./server.ts`, which is `server-only`.
 *
 * Two ways in, and picking the wrong one is the mistake to avoid:
 *
 * - `dict()` from `@/i18n/server` — async, request-scoped, correct on every
 *   public page. Use it anywhere a visitor sees the result.
 * - `getDictionary(locale)` below — pure. For client components (which get
 *   their locale as a prop) and for callers that already hold a locale.
 */
import {
  sv,
  svCard,
  svCategory,
  svFilters,
  svHome,
  svHub,
  svListing,
  svSearchBar,
} from "./sv";

export type Locale = "sv";

/**
 * The only served locale. flyttatillspanien.se is Swedish-only until a second
 * domain (English, for other Nordic/foreign buyers) is bought — see
 * docs/SPAIN-PORTAL-DESIGN.md §1. This is the fallback for a request that
 * reached a page without the middleware's `x-locale` header.
 */
export const DEFAULT_LOCALE: Locale = "sv";

const svDictionary = {
  common: sv,
  searchBar: svSearchBar,
  filters: svFilters,
  card: svCard,
  home: svHome,
  hub: svHub,
  category: svCategory,
  listing: svListing,
} as const;

/**
 * Literal string types widened to `string`, structure kept exactly.
 *
 * `sv.ts` declares its namespaces `as const`, so `typeof svDictionary` types
 * `searchPlaceholder` as the literal Swedish sentence — a shape only the
 * Swedish dictionary can ever satisfy. Widening the leaves is what turns it
 * into "the same keys, with strings in them", which is the contract a second
 * locale is supposed to meet. Structure is not widened: an object stays that
 * object's keys, a function keeps its parameters, so a key dropped or a
 * signature changed on one side is still a type error. Kept even with one
 * locale so a future `en.ts` is a file addition, not a refactor.
 */
type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends (...args: infer A) => infer R
        ? (...args: A) => Widen<R>
        : T extends readonly (infer U)[]
          ? readonly Widen<U>[]
          : { [K in keyof T]: Widen<T[K]> };

/**
 * The shape every locale must satisfy. Derived from the Swedish dictionary
 * rather than hand-written, so a key added to `sv.ts` and forgotten in a
 * future `en.ts` is a type error — a missing key cannot ship as a blank
 * string on a live page.
 */
export type Dictionary = Widen<typeof svDictionary>;

const DICTIONARIES: Record<Locale, Dictionary> = {
  sv: svDictionary,
};

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/** Narrow an arbitrary header value to a locale we actually have. */
export function parseLocale(value: string | null | undefined): Locale {
  return value === "sv" ? value : DEFAULT_LOCALE;
}
