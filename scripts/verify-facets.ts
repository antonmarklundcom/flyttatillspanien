/**
 * Verify the shared facet layer — pure, no database.
 *
 * Two things here are worth a runnable check rather than a type:
 *
 *   1. **The parser and the builder are inverses.** `facets.ts` is the single
 *      vocabulary precisely so the category grid, its map and a future
 *      saved-search cannot read the same query string differently. A drift
 *      between `parseFacetParams` and `facetSearchParams` would reintroduce
 *      the divergence the file exists to prevent, and types cannot see it.
 *   2. **`VerticalConfig.filters` narrows, and only with real enum values.**
 *      The config is hand-written TypeScript with `string[]` fields, so a typo
 *      (`"villaa"` for `"villa"`) compiles. Rendered into SQL it would match
 *      nothing and read as "the whole site is empty" on that domain.
 *
 * Run: npm run verify:facets   (also part of npm run verify:local)
 */
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
import {
  facetSearchParams,
  hasUserFacets,
  parseFacetParams,
  parseLocationSlugs,
  type ListingFacets,
} from "../src/lib/facets";
import { publishedFacetWhere, verticalConds } from "../src/lib/facet-sql";
import { VERTICALS, type VerticalConfig } from "../src/config/verticals";
import { OPERATIONS, PROPERTY_TYPES } from "../src/lib/import/types";

let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const dialect = new MySqlDialect();
/** Render a condition to SQL text, so an assertion can look at what it does. */
function toText(cond: SQL | undefined): string {
  return cond ? dialect.sqlToQuery(cond).sql : "";
}

console.log("\nfacets: parsing");

const parsed = parseFacetParams({
  affar: "venta",
  typ: "villor",
  pris_min: "50000",
  pris_max: "500000",
  sovrum: "3",
  sortering: "pris_upp",
});
check("full query string parses", parsed.operation === "venta");
check("plural type segment maps to the enum", parsed.propertyType === "villa");
check("numbers parse", parsed.priceMin === 50000 && parsed.priceMax === 500000);
check("sort parses", parsed.sort === "pris_upp");

const junk = parseFacetParams({
  affar: "comprar",
  typ: "mansiones",
  pris_min: "abc",
  pris_max: "-5",
  sovrum: "0",
  sortering: "cheapest",
});
check(
  "unknown operation/type are dropped, not passed through",
  junk.operation === undefined && junk.propertyType === undefined,
);
check(
  "non-numeric, negative and zero are dropped",
  junk.priceMin === undefined &&
    junk.priceMax === undefined &&
    junk.minBedrooms === undefined,
);
check("unknown sort is dropped", junk.sort === undefined);
check(
  "repeated params (string[]) are ignored rather than coerced",
  parseFacetParams({ pris_min: ["1", "2"] }).priceMin === undefined,
);
check("empty string is not a filter", parseFacetParams({ sortering: "" }).sort === undefined);

const locs = parseLocationSlugs({ ort: "marbella", omrade: "nueva-andalucia" });
check(
  "location slugs read back",
  locs.citySlug === "marbella" && locs.barrioSlug === "nueva-andalucia",
);

check("no filters means no active filters", !hasUserFacets({}));
check("a path-level facet is not a visitor filter", !hasUserFacets({ operation: "venta" }));
check("a price floor is a visitor filter", hasUserFacets({ priceMin: 1 }));

console.log("\nfacets: parse ∘ build is the identity");

const roundTrips: ListingFacets[] = [
  {},
  { priceMin: 50000 },
  { priceMax: 90000, minBedrooms: 2 },
  { priceMin: 1, priceMax: 2, minBedrooms: 3, sort: "pris_ner" },
  { sort: "pris_upp" },
];
for (const f of roundTrips) {
  const back = parseFacetParams(facetSearchParams(f));
  const same =
    back.priceMin === f.priceMin &&
    back.priceMax === f.priceMax &&
    back.minBedrooms === f.minBedrooms &&
    back.sort === f.sort;
  check(`round-trip ${JSON.stringify(f)}`, same, JSON.stringify(back));
}

const withPath = parseFacetParams(
  facetSearchParams(
    { priceMin: 1000 },
    { operationSlug: "hyra", typeSlug: "lagenheter" },
  ),
);
check(
  "operation/type survive the round-trip as enum values",
  withPath.operation === "alquiler" && withPath.propertyType === "apartamento",
);

console.log("\nfacet-sql: the published gate");

check(
  "publishedFacetWhere always constrains status",
  toText(publishedFacetWhere()).includes("`status`"),
);
check(
  "every facet maps to its own column",
  (() => {
    const t = toText(
      publishedFacetWhere({
        operation: "venta",
        propertyType: "villa",
        locationIds: [1, 2],
        minBedrooms: 3,
      }),
    );
    return (
      t.includes("`operation`") &&
      t.includes("`property_type`") &&
      t.includes("`location_id` in") &&
      t.includes("`bedrooms`")
    );
  })(),
  toText(
    publishedFacetWhere({
      operation: "venta",
      propertyType: "villa",
      locationIds: [1, 2],
      minBedrooms: 3,
    }),
  ),
);
check(
  "price filters run on price_eur",
  (() => {
    const t = toText(publishedFacetWhere({ priceMin: 1, priceMax: 2 }));
    return t.includes("price_eur");
  })(),
);

console.log("\nfacet-sql: a door's hard filters");

const noFilters: VerticalConfig = {
  key: "sv",
  brand: "x",
  locale: "sv",
  copy: "relocation",
  enabled: false,
  ownsListingDetail: false,
};
check("a vertical with no filters adds no conditions", verticalConds(noFilters).length === 0);

check(
  "one operation renders as equality",
  verticalConds({ ...noFilters, filters: { operation: ["alquiler"] } }).length === 1,
);
check(
  "two operations render as one IN",
  verticalConds({ ...noFilters, filters: { operation: ["alquiler", "venta"] } })
    .length === 1,
);
check(
  "a typo in the config narrows nothing rather than everything",
  verticalConds({ ...noFilters, filters: { property_type: ["villas"] } }).length === 0,
);

const narrowed = toText(
  publishedFacetWhere(
    { operation: "venta" },
    { ...noFilters, filters: { operation: ["alquiler"] } },
  ),
);
check(
  "a door's filter is ANDed with the visitor's, never merged over it",
  narrowed.includes("`operation`") && (narrowed.match(/`operation`/g) ?? []).length === 2,
  narrowed,
);

console.log("\nverticals.ts: every declared filter value is a real enum member");

for (const [host, v] of Object.entries(VERTICALS)) {
  const bad = [
    ...(v.filters?.operation ?? []).filter(
      (o) => !(OPERATIONS as readonly string[]).includes(o),
    ),
    ...(v.filters?.property_type ?? []).filter(
      (t) => !(PROPERTY_TYPES as readonly string[]).includes(t),
    ),
  ];
  check(`${host} declares only known enum values`, bad.length === 0, bad.join(", "));
}

console.log(
  failures === 0
    ? "\nAll facet checks passed.\n"
    : `\n${failures} facet check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
