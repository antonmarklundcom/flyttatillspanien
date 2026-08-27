/**
 * Verify the dictionaries stay the same shape — pure, no database.
 *
 * `Dictionary` (src/i18n/index.ts) catches most drift at compile time: a
 * missing key, a stray key, a string where a number belongs. It cannot catch
 * one thing, because TypeScript deliberately allows it — **a function that
 * takes fewer arguments is assignable to one that takes more**. So a
 * translator who writes `titlePaged: (title) => title` satisfies the type and
 * silently drops the page number from every paginated title.
 *
 * This walks both dictionaries side by side and checks what the type system
 * will not: same keys at every level, same kind of value, same arity, same
 * array lengths, and no empty string anywhere. It is the cheapest possible
 * stand-in for looking at an English page, which nobody can do until a host
 * declares `locale: "en"`.
 *
 * Run: npm run verify:i18n   (also part of npm run verify:local)
 */
import { getDictionary } from "../src/i18n";

let failures = 0;

function fail(path: string, detail: string) {
  failures += 1;
  console.log(`  FAIL  ${path} — ${detail}`);
}

function kind(v: unknown): string {
  if (Array.isArray(v)) return "array";
  if (v === null) return "null";
  return typeof v;
}

/**
 * `es` is the reference: it is the dictionary the site actually serves, and
 * every key exists because a page reads it.
 */
function compare(ref: unknown, other: unknown, path: string): void {
  if (kind(ref) !== kind(other)) {
    fail(path, `es is ${kind(ref)}, en is ${kind(other)}`);
    return;
  }

  if (typeof ref === "function") {
    const a = ref as (...args: unknown[]) => unknown;
    const b = other as (...args: unknown[]) => unknown;
    if (a.length !== b.length) {
      fail(path, `takes ${a.length} argument(s) in es, ${b.length} in en`);
    }
    return;
  }

  if (Array.isArray(ref)) {
    const b = other as unknown[];
    if (ref.length !== b.length) {
      fail(path, `${ref.length} item(s) in es, ${b.length} in en`);
      return;
    }
    ref.forEach((item, i) => compare(item, b[i], `${path}[${i}]`));
    return;
  }

  if (typeof ref === "object" && ref !== null) {
    const a = ref as Record<string, unknown>;
    const b = other as Record<string, unknown>;
    for (const key of Object.keys(a)) {
      if (!(key in b)) {
        fail(`${path}.${key}`, "present in es, missing in en");
        continue;
      }
      compare(a[key], b[key], `${path}.${key}`);
    }
    for (const key of Object.keys(b)) {
      if (!(key in a)) fail(`${path}.${key}`, "present in en, missing in es");
    }
    return;
  }

  if (typeof ref === "string" && (other as string).trim() === "") {
    fail(path, "empty string in en");
  }
}

console.log("\ni18n: es and en are the same shape");

const es = getDictionary("es");
const en = getDictionary("en");

if (es === en) {
  fail("dictionaries", "getDictionary('en') returns the Spanish dictionary");
} else {
  compare(es, en, "dict");
}

if (failures === 0) {
  console.log("  ok    every key, arity and array length matches");
}

console.log(
  failures === 0
    ? "\nAll i18n checks passed.\n"
    : `\n${failures} i18n check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
