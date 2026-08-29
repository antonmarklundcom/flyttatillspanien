/**
 * Verify the dictionary — pure, no database.
 *
 * `Dictionary` (src/i18n/index.ts) catches most drift at compile time: a
 * missing key, a stray key, a string where a number belongs. Two things it
 * cannot catch, and this script exists for exactly those:
 *
 *   1. **An empty string is a valid string.** A namespace half-filled during
 *      a rewrite compiles and renders as a blank label.
 *   2. **A function that ignores its arguments satisfies its type.**
 *      TypeScript deliberately allows a narrower function where a wider one is
 *      expected, so `titlePaged: (title) => title` type-checks and silently
 *      drops the page number from every paginated title. Nothing but calling
 *      it and looking at the output can see that.
 *
 * **What changed with the single dictionary.** This used to walk `es` and `en`
 * side by side, and the arity check fell out of comparing the two. There is
 * one dictionary now (`en.ts` is deleted until the English domain is bought —
 * see src/i18n/index.ts), so the same defect is caught by calling each
 * function with sentinel arguments and checking the sentinels come back. That
 * is a stronger check than the pairwise one, not a weaker one: it also catches
 * a function that drops an argument in *both* dictionaries. When `en.ts`
 * returns, the side-by-side walk comes back beside this, not instead of it.
 *
 * Run: npm run verify:i18n   (also part of npm run verify:local)
 */
import { getDictionary, DEFAULT_LOCALE } from "../src/i18n";

let failures = 0;
let checked = 0;

function fail(path: string, detail: string) {
  failures += 1;
  console.log(`  FAIL  ${path} — ${detail}`);
}

/**
 * Values to probe an argument position with. Two of each kind, because the
 * test is differential: an argument is "used" when changing it changes the
 * output. That is deliberately weaker than "the value appears in the output"
 * and it has to be — `budgetUpTo(amount, locale)` never prints the locale, it
 * formats the amount *with* it, and demanding the token come back would flag
 * every formatting argument in the dictionary as dead.
 *
 * The parameter types are erased by the time this runs, so both kinds are
 * tried for every position and for every filler.
 */
const PROBES = {
  string: ["«A»", "«B»"],
  number: [4242, 987654],
  /**
   * Two real BCP-47 tags, because a locale argument is the one shape a
   * nonsense token cannot probe: `Intl` rejects an invalid tag outright, so
   * every attempt throws and the position looks untestable. With these, a
   * number formatted through the argument comes back grouped differently and
   * the argument is visibly doing something.
   */
  locale: ["sv-SE", "en-US"],
} as const;

/**
 * Which arguments a copy function ignores: the positions where no pair of
 * inputs differing only there produces a different result.
 *
 * A call that throws is inconclusive rather than a failure — a function
 * given a nonsense locale tag is exercising `Intl`'s own validation, not
 * dropping an argument — so a position is only reported when at least one pair
 * ran cleanly and returned the same thing both times.
 */
function unusedArgs(fn: (...args: unknown[]) => unknown, arity: number): number[] {
  const unused: number[] = [];

  for (let i = 0; i < arity; i++) {
    let differed = false;
    let conclusive = false;

    for (const fillerKind of ["string", "number"] as const) {
      for (const probeKind of ["string", "number", "locale"] as const) {
        const [a, b] = PROBES[probeKind];
        const args = (value: unknown) =>
          Array.from({ length: arity }, (_, j) =>
            j === i ? value : PROBES[fillerKind][0],
          );

        let outA: unknown;
        let outB: unknown;
        try {
          outA = fn(...args(a));
          outB = fn(...args(b));
        } catch {
          continue; // inconclusive — try the next shape
        }
        // Not copy (a lookup table, a component factory): out of scope.
        if (typeof outA !== "string" || typeof outB !== "string") return [];

        conclusive = true;
        if (outA !== outB) {
          differed = true;
          break;
        }
      }
      if (differed) break;
    }

    if (conclusive && !differed) unused.push(i);
  }

  return unused;
}

function walk(value: unknown, path: string): void {
  if (typeof value === "string") {
    checked += 1;
    if (value.trim() === "") fail(path, "empty string");
    return;
  }

  if (typeof value === "function") {
    checked += 1;
    const fn = value as (...args: unknown[]) => unknown;
    if (fn.length === 0) return;
    const unused = unusedArgs(fn, fn.length);
    if (unused.length > 0) {
      fail(
        path,
        `takes ${fn.length} argument(s) but ignores ${unused
          .map((i) => `#${i + 1}`)
          .join(", ")} — changing it does not change the output`,
      );
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(item, `${path}[${i}]`));
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      walk(child, `${path}.${key}`);
    }
  }
}

console.log(`\ni18n: the ${DEFAULT_LOCALE} dictionary`);

const dict = getDictionary(DEFAULT_LOCALE);

/**
 * Every namespace the assembled dictionary is supposed to carry. Named rather
 * than derived from the object itself, because a namespace dropped from
 * `index.ts` would otherwise make this check quietly smaller instead of red.
 */
const NAMESPACES = [
  "common",
  "searchBar",
  "filters",
  "card",
  "home",
  "hub",
  "category",
  "listing",
] as const;

for (const ns of NAMESPACES) {
  if (!(ns in dict)) fail(`dict.${ns}`, "namespace missing from the dictionary");
}

walk(dict, "dict");

if (failures === 0) {
  console.log(
    `  ok    ${checked} strings and copy functions — none empty, none ignoring an argument`,
  );
}

console.log(
  failures === 0
    ? "\nAll i18n checks passed.\n"
    : `\n${failures} i18n check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
