import "server-only";
import { headers } from "next/headers";
import {
  getDictionary,
  parseLocale,
  type Dictionary,
  type Locale,
} from "./index";

/**
 * Dictionary lookup, request-scoped half. Split from `./index.ts` because
 * that module is reachable from client components and this one reads
 * `next/headers` — the same split as `brand.ts` / `brand-server.ts`.
 *
 * The locale comes from the `x-locale` header `middleware.ts` sets. With one
 * served locale it always resolves to `sv`; the indirection stays because it
 * is what makes a second door a config change rather than a refactor.
 */

/** The locale of the host this visitor actually typed. */
export async function currentLocale(): Promise<Locale> {
  return parseLocale((await headers()).get("x-locale"));
}

/** The dictionary for this request. Use on every public page. */
export async function dict(): Promise<Dictionary> {
  return getDictionary(await currentLocale());
}
