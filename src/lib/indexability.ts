/**
 * The thin-page rule (ARCHITECTURE.md §4.3) — single source of truth.
 *
 * BOTH the page templates and the sitemap generator call this function.
 * Never duplicate this logic anywhere else: this rule is what separates
 * programmatic SEO from a doorway-page penalty.
 */

export type Indexability =
  | { state: "index" } // in sitemap, indexable
  | { state: "noindex" } // renders (facet landings), noindex,follow, NOT in sitemap
  | { state: "gone"; redirectTo?: string }; // 404 (via notFound()), or redirect to parent

export interface PageSignals {
  /** Published listings matching this page's (location × type × operation). */
  listingCount: number;
  /** Barrio pages also require the parent city page to be indexable. */
  parentIndexable?: boolean;
  /** Parent page URL for the 0-count redirect (e.g. barrio/tipo → barrio). */
  parentUrl?: string;
}

const MIN_INDEXABLE = 3;

export function getIndexability(page: PageSignals): Indexability {
  if (page.listingCount === 0) {
    return { state: "gone", redirectTo: page.parentUrl };
  }
  if (page.listingCount < MIN_INDEXABLE) {
    return { state: "noindex" };
  }
  if (page.parentIndexable === false) {
    return { state: "noindex" };
  }
  return { state: "index" };
}

/** Robots meta value for a resolved indexability state. */
export function robotsFor(ix: Indexability): string {
  return ix.state === "index" ? "index,follow" : "noindex,follow";
}
