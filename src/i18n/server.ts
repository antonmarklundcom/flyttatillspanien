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
 * The locale comes from the `x-locale` header `middleware.ts` has been
 * setting since the vertical routing layer landed. Until now nothing read
 * it; this is its first consumer.
 */

/** The locale of the host this visitor actually typed. */
export async function currentLocale(): Promise<Locale> {
  return parseLocale((await headers()).get("x-locale"));
}

/** The dictionary for this request. Use on every public page. */
export async function dict(): Promise<Dictionary> {
  return getDictionary(await currentLocale());
}
