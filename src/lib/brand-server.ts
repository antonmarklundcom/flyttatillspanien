import "server-only";
import { currentVertical } from "@/lib/vertical-context";
import { brandTaglineFor } from "@/lib/brand";

/**
 * Brand naming, request-scoped half. Split from `brand.ts` because that module
 * is reachable from client components (via `src/i18n/es.ts`) and this one
 * reads `next/headers`.
 *
 * Use `brandName()` on every public page — in `generateMetadata` and in the
 * component body alike. `BRAND_NAME` from `brand.ts` is the CANONICAL_HOST's
 * name and is only correct on staff surfaces.
 */

/** The brand of the host this visitor actually typed. */
export async function brandName(): Promise<string> {
  return (await currentVertical()).brand;
}

/** Brand + tagline together — the two things a page title and OG card need. */
export async function brandMeta(): Promise<{
  name: string;
  tagline: string;
  locale: "es" | "en";
}> {
  const v = await currentVertical();
  return { name: v.brand, tagline: brandTaglineFor(v.locale), locale: v.locale };
}
