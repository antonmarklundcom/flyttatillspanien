import { categoryUrl } from "@/lib/urls";

/**
 * Highest-intent entry points into the category tree. Reused by the homepage
 * hero, the footer, and the 404/no-results page.
 *
 * Built through `categoryUrl()` rather than typed as paths: the operation
 * segment is decided in `src/lib/urls.ts`, and every city slug here has to
 * exist in `scripts/seed-locations.ts` or the link is a 404 in the one place a
 * visitor lands when they already failed to find something.
 */
export const POPULAR_SEARCHES = [
  {
    label: "Villor i Marbella",
    href: categoryUrl({ operation: "venta", citySlug: "marbella", type: "villa" }),
  },
  {
    label: "Lägenheter i Torrevieja",
    href: categoryUrl({ operation: "venta", citySlug: "torrevieja", type: "apartamento" }),
  },
  {
    label: "Bostäder på Mallorca",
    href: categoryUrl({ operation: "venta", citySlug: "palma" }),
  },
  {
    label: "Uthyres i Málaga",
    href: categoryUrl({ operation: "alquiler", citySlug: "malaga" }),
  },
];
