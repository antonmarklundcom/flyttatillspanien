import type { Metadata } from "next";
import Link from "next/link";
import { svPrecios } from "@/i18n/sv";
import { brandName } from "@/lib/brand-server";
import { citiesWithPrices } from "@/lib/precios-queries";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";

// Depends on the medians job's output; render per request (cheap, two queries).
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${svPrecios.indexTitle}`,
    description: svPrecios.indexSubtitle(brand),
    alternates: { canonical: `${await siteOrigin()}/precios` },
  };
}

export default async function PreciosIndexPage() {
  const brand = await brandName();
  const [cities, origin] = await Promise.all([citiesWithPrices(), siteOrigin()]);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "1rem" }}>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Inicio", url: "/" },
            { name: svPrecios.indexTitle, url: "/precios" },
          ]),
        ]}
      />

      <h1 style={{ fontSize: 24 }}>{svPrecios.indexTitle}</h1>
      <p style={{ color: "#55655F" }}>{svPrecios.indexSubtitle(brand)}</p>

      {cities.length === 0 ? (
        <p className="panel-empty">{svPrecios.indexEmpty}</p>
      ) : (
        <ul className="precios-city-list">
          {cities.map((c) => (
            <li key={c.slug}>
              <Link className="precios-city-link" href={`/precios/${c.slug}`}>
                <span>{c.name}</span>
                <span className="precios-city-link__count">
                  {c.reliableSample} {svPrecios.tableSample.toLowerCase()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="precios-method">
        <h2 style={{ fontSize: 16, margin: "0 0 .5rem" }}>
          {svPrecios.methodTitle}
        </h2>
        <p style={{ margin: 0 }}>{svPrecios.methodBody(brand)}</p>
      </section>
    </main>
  );
}
