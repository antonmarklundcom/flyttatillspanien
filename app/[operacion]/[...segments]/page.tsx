import { cache } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { tokens } from "@/design/tokens";
import Link from "next/link";
import { svPrecios } from "@/i18n/sv";
import { currentLocale, dict } from "@/i18n/server";
import type { Dictionary } from "@/i18n";
import { brandName } from "@/lib/brand-server";
import {
  resolveCity,
  resolveBarrio,
  citySubtreeIds,
  getFilteredCategoryListings,
  countCategory,
  listCities,
  type CategoryFilters,
  type LocationRow,
} from "@/lib/queries";
import {
  facetSearchParams,
  hasUserFacets,
  parseFacetParams,
  FACET_PARAM,
} from "@/lib/facets";
import { currentVertical } from "@/lib/vertical-context";
import type { VerticalConfig } from "@/config/verticals";
import {
  parseOperation,
  parseCategorySegments,
  categoryUrl,
  operationSlug,
  typePlural,
  parseTypePlural,
} from "@/lib/urls";
import { getIndexability } from "@/lib/indexability";
import { formatEur } from "@/lib/format";
import {
  bestMedianFor,
  getCityPrices as cityPricesFor,
  medianFor,
} from "@/lib/precios-queries";
import { itemListJsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { siteOrigin, listingCanonicalOrigin } from "@/lib/origin";
import { languageAlternates } from "@/lib/alternates";
import { JsonLd } from "@/components/JsonLd";
import { ListingCard } from "@/components/ListingCard";
import { CategoryFilterBar } from "@/components/CategoryFilterBar";
import { CategoryMapLazy } from "@/components/CategoryMapLazy";
import { SearchBar } from "@/components/SearchBar";
import { listingUrl } from "@/lib/urls";
import type { Operation, PropertyType } from "@/lib/import/types";

// Already rendered per request (searchParams drive the filter bar); the Host
// header now feeds the canonical URL too — see src/lib/origin.ts.

type Params = {
  params: Promise<{ operacion: string; segments: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Grid page size — also the offset unit for ?page=N (F33). */
const PAGE_SIZE = 48;

/** ?page=N → N (integer ≥ 1); anything else is page 1, never an error. */
function parsePage(v: string | string[] | undefined): number {
  if (typeof v !== "string") return 1;
  const n = Number(v);
  return Number.isInteger(n) && n >= 2 ? n : 1;
}

/**
 * The visitor's own narrowing (?precio_min=&precio_max=&dormitorios=&orden=).
 *
 * Parsed by the shared facet layer rather than here: the map endpoint reads
 * the same query string, and two parsers is how the grid and the map start
 * disagreeing about what was asked for. Operation and type come from the
 * path on this page, so they are dropped from what the parser returns.
 */
function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): CategoryFilters {
  const f = parseFacetParams(sp);
  return {
    priceMin: f.priceMin,
    priceMax: f.priceMax,
    minBedrooms: f.minBedrooms,
    sort: f.sort,
  };
}

interface Resolved {
  operation: Operation;
  city: LocationRow;
  barrio: LocationRow | null;
  type: PropertyType | null;
  locationIds: number[];
  canonicalPath: string;
  parentUrl?: string;
  /** True only when parentUrl (the 0-result redirect target) drops the tipo filter. */
  parentDropsType: boolean;
  title: string;
}

/**
 * generateMetadata and the page body run the same resolution and the same
 * counts on every request. cache() makes the second caller free — note that
 * it keys on argument identity, which is why locationIds must come from the
 * cached subtreeIds() (same array reference) for countFor() to hit.
 */
const subtreeIds = cache(citySubtreeIds);

const countFor = cache(
  (
    operation: Operation,
    locationIds: number[],
    type: PropertyType | null,
    vertical: VerticalConfig,
  ) =>
    countCategory({
      operation,
      locationIds,
      type: type ?? undefined,
      vertical,
    }),
);

/** Shared resolution for metadata + page (structure + DB lookups, no listings). */
const resolve = cache(async function resolve(
  operacion: string,
  segments: string[],
): Promise<Resolved | null> {
  // The title is the one piece of resolution that is copy rather than
  // structure, so this reaches for the dictionary. cache() keys on the two
  // string arguments, and the locale cannot change within a request, so the
  // lookup does not need to join the key.
  const t = (await dict()).category;
  const operation = parseOperation(operacion);
  if (!operation) return null;
  const shape = parseCategorySegments(segments);
  if (!shape) return null;

  const city = await resolveCity(shape.citySlug);
  if (!city) return null;

  let barrio: LocationRow | null = null;
  let type: PropertyType | null = null;
  let locationIds: number[];
  let parentUrl: string | undefined;
  let parentDropsType = false;

  if (shape.kind === "city") {
    locationIds = await subtreeIds(city.id);
  } else if (shape.kind === "city-type") {
    type = shape.type;
    locationIds = await subtreeIds(city.id);
    parentUrl = categoryUrl({ operation, citySlug: city.slug });
    parentDropsType = true;
  } else {
    type = shape.type;
    barrio = await resolveBarrio(city.id, shape.barrioSlug);
    if (!barrio) return null;
    locationIds = [barrio.id];
    parentUrl = categoryUrl({
      operation,
      citySlug: city.slug,
      type: shape.type,
    });
  }

  const where = barrio ? `${barrio.name}, ${city.name}` : city.name;
  const typeLabel = type ? t.typeLabel[type] : t.typeLabelAny;
  const title = t.title(typeLabel, t.operationLabel[operation], where);

  return {
    operation,
    city,
    barrio,
    type,
    locationIds,
    canonicalPath: categoryUrl({
      operation,
      citySlug: city.slug,
      barrioSlug: barrio?.slug,
      type: type ?? undefined,
    }),
    parentUrl,
    parentDropsType,
    title,
  };
});

export async function generateMetadata({
  params,
  searchParams,
}: Params): Promise<Metadata> {
  const brand = await brandName();
  const t = (await dict()).category;
  const { operacion, segments } = await params;
  const r = await resolve(operacion, segments);
  if (!r) return { title: t.metaNotFound };

  const page = parsePage((await searchParams).page);
  const vertical = await currentVertical();
  const count = await countFor(r.operation, r.locationIds, r.type, vertical);
  const parentIndexable = r.barrio
    ? (await countFor(
        r.operation,
        await subtreeIds(r.city.id),
        r.type,
        vertical,
      )) >= 3
    : undefined;
  const ix = getIndexability({
    listingCount: count,
    parentIndexable,
    parentUrl: r.parentUrl,
  });

  // Deep pages (?page=2+) self-canonicalise and stay out of the index while
  // their links are still followed — page 1 remains the only indexed URL for
  // the category (F33).
  const canonical =
    page > 1
      ? `${await siteOrigin()}${r.canonicalPath}?page=${page}`
      : `${await siteOrigin()}${r.canonicalPath}`;

  // hreflang belongs on indexed canonical URLs only: a ?page=2 self-canonical
  // and a thin category are both noindex here, and pairing a noindex URL with
  // its translation asks Google to weigh a page we asked it to ignore.
  const indexed = ix.state === "index" && page === 1;

  return {
    title: page > 1 ? t.titlePaged(r.title, page) : r.title,
    description: t.metaDescription(count, r.title, brand),
    alternates: {
      canonical,
      languages: indexed
        ? languageAlternates({ path: r.canonicalPath, scope: "site" })
        : undefined,
    },
    robots: indexed
        ? { index: true, follow: true }
        : { index: false, follow: true },
  };
}

export default async function CategoryPage({ params, searchParams }: Params) {
  const [d, locale] = await Promise.all([dict(), currentLocale()]);
  const t: Dictionary["category"] = d.category;
  const { operacion, segments } = await params;
  const sp = await searchParams;
  const r = await resolve(operacion, segments);
  if (!r) notFound();

  // The door this request came through. Its `filters` (VerticalConfig) narrow
  // the grid, the count that decides indexability and the map's pins alike —
  // one vertical, one listing set, no surface disagreeing with another.
  const vertical = await currentVertical();

  const baseQuery = {
    operation: r.operation,
    locationIds: r.locationIds,
    type: r.type ?? undefined,
    vertical,
  };

  // Indexability is always computed from the canonical (unfiltered) count —
  // a visitor's price/bedroom filter must never change whether this page
  // is indexable or gate it behind the 404/redirect below.
  const count = await countFor(r.operation, r.locationIds, r.type, vertical);
  const parentIndexable = r.barrio
    ? (await countFor(
        r.operation,
        await subtreeIds(r.city.id),
        r.type,
        vertical,
      )) >= 3
    : undefined;
  const ix = getIndexability({
    listingCount: count,
    parentIndexable,
    parentUrl: r.parentUrl,
  });

  if (ix.state === "gone") {
    if (ix.redirectTo) {
      // Tell the parent page which sub-category was empty so it can explain
      // the bounce instead of silently swapping what the visitor asked for.
      const to =
        r.type && r.parentDropsType
          ? `${ix.redirectTo}?tipo_vacio=${typePlural(r.type)}`
          : ix.redirectTo;
      redirect(to);
    }
    notFound();
  }

  // Set only when we just redirected here from an empty city+tipo URL
  // (see the "gone" branch above) — explains the bounce instead of
  // silently swapping what the visitor asked for.
  const tipoVacio =
    typeof sp.tipo_vacio === "string" ? parseTypePlural(sp.tipo_vacio) : null;

  const filters = parseFilters(sp);
  const page = parsePage(sp.page);
  const hasActiveFilters = hasUserFacets(filters);
  const [{ listings, filteredCount }, cities] = await Promise.all([
    getFilteredCategoryListings(
      { ...baseQuery, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
      filters,
    ),
    listCities(),
  ]);
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));

  /** Same URL with ?page=N; page 1 drops the param (it's the canonical). */
  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (typeof value === "string" && key !== "page") params.set(key, value);
    }
    if (n > 1) params.set("page", String(n));
    const qs = params.toString();
    return qs ? `${r.canonicalPath}?${qs}` : r.canonicalPath;
  };

  // Does this city have a price page worth linking to? Cheap: one aggregate.
  const cityPrices = await cityPricesFor(r.city.slug);
  const cityHasPrices = (cityPrices?.reliableSample ?? 0) > 0;

  /**
   * The payload above was already being fetched and then reduced to a boolean.
   * Stating the actual median is what turns the module from a question into a
   * credibility signal (audit I8) — and it costs nothing extra.
   *
   * A page with a type in its path gets that type's median; a bare city page
   * gets the best-evidenced type for the operation, named so the copy never
   * implies it covers everything.
   */
  const contextCell = r.type
    ? medianFor(cityPrices, r.operation, r.type)
    : bestMedianFor(cityPrices, r.operation);

  // Breadcrumbs are this host's own pages; the ItemList points at listing
  // detail pages, which may be canonical on a different host entirely.
  const [origin, listingOrigin] = await Promise.all([
    siteOrigin(),
    listingCanonicalOrigin(),
  ]);

  const crumbs = [
    { name: t.breadcrumbHome, url: "/" },
    { name: r.city.name, url: categoryUrl({ operation: r.operation, citySlug: r.city.slug }) },
    ...(r.barrio ? [{ name: r.barrio.name, url: r.canonicalPath }] : []),
  ];

  /**
   * Map view is opt-in via ?vista=mapa. A query param rather than a route so
   * the canonical URL is unchanged and no thin duplicate page gets indexed —
   * the map is a way to browse this page, not a page of its own.
   */
  const mapView = sp.vista === "mapa";

  // The map centres on the barrio when the path names one, else the city.
  const centre = r.barrio?.lat && r.barrio?.lng ? r.barrio : r.city;
  const mapCentre =
    centre.lat && centre.lng
      ? { lat: Number(centre.lat), lng: Number(centre.lng) }
      : null;

  /**
   * Forwarded to /api/mapa so the pins are the grid's rows.
   *
   * Built by the shared facet layer, which is also what the endpoint parses it
   * back with — and it carries the location too. Without `ciudad`/`barrio` the
   * map answered the viewport alone, so panning an Asunción page surfaced pins
   * this page's grid would never list.
   */
  const mapQuery: Record<string, string> = {
    ...facetSearchParams(filters, {
      operationSlug: operationSlug(r.operation),
      typeSlug: r.type ? typePlural(r.type) : undefined,
    }),
    [FACET_PARAM.city]: r.city.slug,
    ...(r.barrio ? { [FACET_PARAM.barrio]: r.barrio.slug } : {}),
  };

  const controls = (
    <>
      <SearchBar
        cities={cities}
        defaultOperation={r.operation}
        defaultCitySlug={r.city.slug}
        defaultType={r.type ?? ""}
        locale={locale}
      />

      <CategoryFilterBar
        basePath={r.canonicalPath}
        precioMin={typeof sp.precio_min === "string" ? sp.precio_min : undefined}
        precioMax={typeof sp.precio_max === "string" ? sp.precio_max : undefined}
        dormitorios={typeof sp.dormitorios === "string" ? sp.dormitorios : undefined}
        orden={typeof sp.orden === "string" ? sp.orden : undefined}
        vista={mapView ? "mapa" : undefined}
        tipoVacio={typeof sp.tipo_vacio === "string" ? sp.tipo_vacio : undefined}
        hasActiveFilters={hasActiveFilters}
      />
    </>
  );

  /** Keep every active filter when switching views. */
  const viewHref = (view: "lista" | "mapa") => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (typeof value === "string" && key !== "vista") params.set(key, value);
    }
    if (view === "mapa") params.set("vista", "mapa");
    const qs = params.toString();
    return qs ? `${r.canonicalPath}?${qs}` : r.canonicalPath;
  };

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "1rem" }}>
      {ix.state === "index" && (
        <JsonLd
          data={[
            breadcrumbJsonLd(origin, crumbs),
            itemListJsonLd(
              listingOrigin,
              listings.map((l) => ({ title: l.title, url: listingUrl(l) })),
            ),
          ]}
        />
      )}

      <h1 style={{ fontSize: 24 }}>{r.title}</h1>
      <p style={{ color: tokens.color.inkSecondary, marginTop: 4 }}>
        {count > 0 ? t.count(count) : d.common.emptyState}
      </p>

      {tipoVacio && (
        <p className="category-redirect-notice">
          {t.emptyTypeNotice(
            t.typeLabel[tipoVacio].toLowerCase(),
            t.operationLabel[r.operation],
            r.city.name,
          )}
        </p>
      )}

      {/* In map view the controls go BELOW the map: on a phone the search and
          filter cards fill the whole first screen, so a visitor who tapped
          "Mapa" would have to scroll past both to reach what they asked for. */}
      {!mapView && controls}

      {mapCentre && (
        <nav className="view-switch" aria-label={t.viewSwitchLabel}>
          <a
            className={`view-switch__option${!mapView ? " view-switch__option--active" : ""}`}
            href={viewHref("lista")}
          >
            {t.viewList}
          </a>
          <a
            className={`view-switch__option${mapView ? " view-switch__option--active" : ""}`}
            href={viewHref("mapa")}
          >
            {t.viewMap}
          </a>
        </nav>
      )}

      {mapView && mapCentre ? (
        <CategoryMapLazy
          centerLat={mapCentre.lat}
          centerLng={mapCentre.lng}
          zoom={r.barrio ? 14 : 12}
          query={mapQuery}
        />
      ) : filteredCount === 0 ? (
        <div className="filter-empty">
          {t.filterEmpty}
          <br />
          <a className="filter-empty__clear" href={r.canonicalPath}>
            {t.filterEmptyClear}
          </a>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 16,
            marginTop: 16,
          }}
        >
          {listings.map((card) => (
            <ListingCard key={card.id} card={card} />
          ))}
        </div>
      )}

      {/* Crawlable pagination (F33): before this, only the first 48 listings
          of a category were reachable by link — the rest sat in the sitemap
          with no internal link pointing at them. Plain <a>: pages 2+ are
          noindex,follow, so these links pass discovery, not index weight. */}
      {!mapView && filteredCount > PAGE_SIZE && (
        <nav className="pagination" aria-label={t.paginationLabel}>
          {page > 1 && (
            <a className="pagination__link" href={pageHref(page - 1)}>
              {t.paginationPrev}
            </a>
          )}
          <span className="pagination__status">
            {t.paginationStatus(page, totalPages)}
          </span>
          {page < totalPages && (
            <a className="pagination__link" href={pageHref(page + 1)}>
              {t.paginationNext}
            </a>
          )}
        </nav>
      )}

      {/* Internal link module: market context for this city. Only rendered
          when the medians job has something defensible to show, so we never
          link into an empty page. */}
      {cityHasPrices && (
        <aside className="precios-cta">
          <span>
            {contextCell
              ? svPrecios.contextMedian({
                  typeLabel: t.typeLabel[contextCell.propertyType],
                  operationLabel:
                    svPrecios.contextOperationLabel[contextCell.operation] ??
                    contextCell.operation,
                  city: r.city.name,
                  median:
                    contextCell.medianPriceEur != null
                      ? formatEur(contextCell.medianPriceEur)
                      : "—",
                  perM2:
                    contextCell.medianPriceM2Eur != null
                      ? formatEur(contextCell.medianPriceM2Eur)
                      : null,
                  sample: contextCell.sampleSize,
                })
              : svPrecios.relatedPrices(r.city.name)}
          </span>
          <Link className="panel-btn" href={`/precios/${r.city.slug}`}>
            {svPrecios.relatedPricesCta}
          </Link>
        </aside>
      )}

      {mapView && controls}
    </main>
  );
}
