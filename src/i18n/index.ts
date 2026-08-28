/**
 * The dictionary layer.
 *
 * `sv.ts` holds the strings; this module is how a surface *reaches* them. The
 * point of the indirection is that a second locale is added by editing this
 * file alone — no page, no component, and no call site changes again.
 *
 * **One dictionary today, and that is a decision.** The site is Swedish-only
 * (one door, `locale: "sv"`). `en.ts` is deleted rather than kept disabled:
 * keeping it preserved `verify:i18n`'s strongest check — two dictionaries
 * walked side by side for missing keys, wrong arity and empty strings — but
 * doubled the cost of every copy change for a door no host serves and no
 * domain exists for. It comes back the day an English domain is bought, and
 * the machinery below is what keeps that a file addition rather than a
 * refactor. Do not delete `Widen<>` or the `satisfies` assembly because one
 * locale makes them look redundant; that is exactly when they get deleted and
 * exactly when they are cheapest to keep.
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
 * The only served locale. This is the fallback for a request that reached a
 * page without the middleware's `x-locale` header.
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
 * `searchPlaceholder` as the literal `"Var vill du bo?"` — a shape only the
 * Swedish dictionary can ever satisfy. Widening the leaves is what turns it
 * into "the same keys, with strings in them", which is the contract a second
 * locale is supposed to meet. Structure is not widened: an object stays that
 * object's keys, a function keeps its parameters, so a key dropped or a
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
 * The shape every locale must satisfy. Derived from the Swedish dictionary
 * rather than hand-written, so a key added to `sv.ts` and forgotten in a
 * future `en.ts` is a type error — a missing key cannot ship as a blank string
 * on a live page.
 */
export type Dictionary = Widen<typeof svDictionary>;

/**
 * Every locale, checked against the shape at the point of assembly.
 * `satisfies` rather than an annotation: it rejects a missing or misspelled
 * key without widening what callers see. With one locale this checks the
 * source dictionary against a type derived from itself, which is trivially
 * true — it is here so that adding the second one is a two-line edit.
 */
const DICTIONARIES: Record<Locale, Dictionary> = {
  sv: svDictionary satisfies Dictionary,
};

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/** Narrow an arbitrary header value to a locale we actually have. */
export function parseLocale(value: string | null | undefined): Locale {
  return value === "sv" ? value : DEFAULT_LOCALE;
}
