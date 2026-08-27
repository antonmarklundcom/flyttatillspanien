/**
 * Verify the (single) dictionary is internally sound — pure, no database.
 *
 * There is one served locale, `sv` (docs/SPAIN-PORTAL-DESIGN.md, i18n
 * handoff): the two-dictionary side-by-side comparison this script used to
 * run (es vs en, on propia.node) has nothing to compare against until a
 * second locale is reintroduced. It keeps its shape and its exit code so a
 * future `en.ts` addition only has to add the comparison back, not rebuild
 * the harness: walk the tree, no empty strings, no leftover placeholder text
 * from the portal this codebase started as.
 *
 * Run: npm run verify:i18n   (also part of npm run verify:local)
 */
import { getDictionary } from "../src/i18n";

let failures = 0;

function fail(path: string, detail: string) {
  failures += 1;
  console.log(`  FAIL  ${path} — ${detail}`);
}

/** Leftover Paraguay/propia.node vocabulary that must not survive into sv.ts. */
const STALE_PATTERNS: RegExp[] = [
  /\bpropia\b/i,
  /\bparaguay\b/i,
  /\basunción\b/i,
  /\bguaran[íi]/i,
  /\bcuota\b/i,
  /\bUS\$/,
];

function walk(value: unknown, path: string): void {
  if (typeof value === "string") {
    if (value.trim() === "") {
      fail(path, "empty string");
      return;
    }
    for (const pattern of STALE_PATTERNS) {
      if (pattern.test(value)) {
        fail(path, `matches stale pattern ${pattern} — "${value}"`);
      }
    }
    return;
  }
  if (typeof value === "function") return; // arity has nothing to compare against with one locale
  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(item, `${path}[${i}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      walk((value as Record<string, unknown>)[key], `${path}.${key}`);
    }
  }
}

console.log("\ni18n: sv dictionary is internally sound");

const sv = getDictionary("sv");
walk(sv, "dict");

if (failures === 0) {
  console.log("  ok    no empty strings, no stale Paraguay/propia.node copy");
}

console.log(
  failures === 0
    ? "\nAll i18n checks passed.\n"
    : `\n${failures} i18n check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
