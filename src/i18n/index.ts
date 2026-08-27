/**
 * The dictionary layer (Batch 3, layer 1).
 *
 * `es.ts` holds the strings; this module is how a surface *reaches* them.
 * The point of the indirection is that layer 2 adds `en.ts` by editing this
 * file alone — no page, no component, and no call site changes again.
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
  es,
  esCard,
  esCategory,
  esFilters,
  esHome,
  esHub,
  esListing,
  esSearchBar,
} from "./es";
import {
  en,
  enCard,
  enCategory,
  enFilters,
  enHome,
  enHub,
  enListing,
  enSearchBar,
} from "./en";

export type Locale = "es" | "en";

/**
 * Both live hosts are `locale: "es"` (verticals.ts) and the English door waits
 * on the D6 flip checklist — see CLAUDE.md. This is the fallback for a request
 * that reached a page without the middleware's `x-locale` header.
 */
export const DEFAULT_LOCALE: Locale = "es";

const esDictionary = {
  common: es,
  searchBar: esSearchBar,
  filters: esFilters,
  card: esCard,
  home: esHome,
  hub: esHub,
  category: esCategory,
  listing: esListing,
} as const;

/**
 * Literal string types widened to `string`, structure kept exactly.
 *
 * `es.ts` declares its namespaces `as const`, so `typeof esDictionary` types
 * `searchPlaceholder` as the literal `"¿Dónde querés vivir?"` — a shape only
 * the Spanish dictionary can ever satisfy. Widening the leaves is what turns
 * it into "the same keys, with strings in them", which is the contract a
 * second locale is supposed to meet. Structure is not widened: an object stays
 * that object's keys, a function keeps its parameters, so a key dropped or a
 * signature changed on one side is still a type error.
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
 * The shape every locale must satisfy. Derived from the Spanish dictionary
 * rather than hand-written, so a key added to `es.ts` and forgotten in `en.ts`
 * is a type error — a missing key cannot ship as a blank string on a live page.
 */
export type Dictionary = Widen<typeof esDictionary>;

/**
 * Both locales, checked against the shape at the point of assembly. `satisfies`
 * rather than an annotation: it rejects a missing or misspelled key without
 * widening what callers see.
 */
const enDictionary = {
  common: en,
  searchBar: enSearchBar,
  filters: enFilters,
  card: enCard,
  home: enHome,
  hub: enHub,
  category: enCategory,
  listing: enListing,
} satisfies Dictionary;

const DICTIONARIES: Record<Locale, Dictionary> = {
  es: esDictionary,
  en: enDictionary,
};

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/** Narrow an arbitrary header value to a locale we actually have. */
export function parseLocale(value: string | null | undefined): Locale {
  return value === "en" || value === "es" ? value : DEFAULT_LOCALE;
}
