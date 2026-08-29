import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { esPrecios } from "@/i18n/es";
import { brandName } from "@/lib/brand-server";
import { formatUsd } from "@/lib/format";
import { getCityPrices, MIN_RELIABLE_SAMPLE } from "@/lib/precios-queries";
import { PROPERTY_TYPE_LABELS } from "@/lib/property-types";
import { categoryUrl } from "@/lib/urls";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import type { Operation } from "@/lib/import/types";

export const dynamic = "force-dynamic";

const OPERATION_LABEL: Record<Operation, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
  alquiler_temporal: "Alquiler temporal",
};

type Params = { params: Promise<{ ciudad: string }> };

// generateMetadata and the body need the same aggregate; cache() collapses them.
const load = cache(getCityPrices);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const brand = await brandName();
  const { ciudad } = await params;
  const prices = await load(ciudad);
  if (!prices) return { title: `No encontrado` };

  /**
   * Indexable only once at least one group is defensible. A price page with
   * three listings behind it is precisely the thin programmatic page the
   * indexability rule exists to keep out of the index — and here the stakes are
   * higher than on a category page, because the number *looks* authoritative.
   */
  const indexable = prices.reliableSample > 0;

  return {
    title: `${esPrecios.cityTitle(prices.city.name)}`,
    description: esPrecios.citySubtitle(brand, prices.city.name, prices.period),
    alternates: { canonical: `${await siteOrigin()}/precios/${prices.city.slug}` },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export default async function CityPricesPage({ params }: Params) {
  const brand = await brandName();
  const { ciudad } = await params;
  const [prices, origin] = await Promise.all([load(ciudad), siteOrigin()]);
  if (!prices) notFound();

  const { city, cells, period } = prices;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "1rem" }}>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Inicio", url: "/" },
            { name: esPrecios.indexTitle, url: "/precios" },
            { name: city.name, url: `/precios/${city.slug}` },
          ]),
        ]}
      />

      <p>
        <Link className="panel-btn" href="/precios">
          {esPrecios.backToPrices}
        </Link>
      </p>

      <h1 style={{ fontSize: 24 }}>{esPrecios.cityTitle(city.name)}</h1>
      <p style={{ color: "#55655F" }}>
        {esPrecios.citySubtitle(brand, city.name, period)}
      </p>

      {cells.length === 0 ? (
        <p className="panel-empty">{esPrecios.emptyCity}</p>
      ) : (
        <div className="panel-table__wrap">
          <table className="panel-table precios-table">
            <thead>
              <tr>
                <th>{esPrecios.tableType}</th>
                <th>{esPrecios.tableOperation}</th>
                <th className="panel-table__num">{esPrecios.tableMedian}</th>
                <th className="panel-table__num">{esPrecios.tableMedianM2}</th>
                <th className="panel-table__num">{esPrecios.tableSample}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cells.map((cell) => (
                <tr
                  key={`${cell.propertyType}-${cell.operation}`}
                  className={cell.reliable ? undefined : "precios-row--thin"}
                >
                  <td>{PROPERTY_TYPE_LABELS[cell.propertyType]}</td>
                  <td>{OPERATION_LABEL[cell.operation]}</td>
                  <td className="panel-table__num">
                    {cell.medianPriceEur != null
                      ? formatUsd(cell.medianPriceEur)
                      : "—"}
                  </td>
                  <td className="panel-table__num">
                    {cell.medianPriceM2Eur != null
                      ? formatUsd(cell.medianPriceM2Eur)
                      : "—"}
                  </td>
                  <td className="panel-table__num">
                    {cell.sampleSize}
                    {!cell.reliable && (
                      <span
                        className="precios-caveat"
                        title={esPrecios.fewSamples}
                      >
                        {" "}
                        ⚠
                      </span>
                    )}
                  </td>
                  <td>
                    {/* The link that makes this page worth indexing: market
                        context leading straight into the inventory. */}
                    <Link
                      href={categoryUrl({
                        operation: cell.operation,
                        citySlug: city.slug,
                        type: cell.propertyType,
                      })}
                    >
                      {esPrecios.seeListings}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cells.some((c) => !c.reliable) && (
        <p className="precios-thin-note">
          ⚠ {esPrecios.fewSamples} (&lt; {MIN_RELIABLE_SAMPLE})
        </p>
      )}

      <section className="precios-method">
        <h2 style={{ fontSize: 16, margin: "0 0 .5rem" }}>
          {esPrecios.methodTitle}
        </h2>
        <p style={{ margin: 0 }}>{esPrecios.methodBody(brand)}</p>
      </section>
    </main>
  );
}
