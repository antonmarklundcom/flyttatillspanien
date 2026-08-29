import type { Metadata } from "next";
import { svTasacion } from "@/i18n/sv";
import { brandName } from "@/lib/brand-server";
import { listCities } from "@/lib/queries";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { ValuationTool } from "@/components/ValuationTool";
import { estimateAction, requestValuationContactAction } from "./actions";

// Reads the city list and (through the actions) live medians.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${svTasacion.title}`,
    description: svTasacion.subtitle(brand),
    alternates: { canonical: `${await siteOrigin()}/tasacion` },
  };
}

export default async function TasacionPage() {
  const brand = await brandName();
  const [cities, origin] = await Promise.all([listCities(), siteOrigin()]);

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "1rem" }}>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Inicio", url: "/" },
            { name: svTasacion.title, url: "/tasacion" },
          ]),
        ]}
      />

      <h1 style={{ fontSize: 26 }}>{svTasacion.title}</h1>
      <p style={{ color: "#55655F" }}>{svTasacion.subtitle(brand)}</p>

      <ValuationTool
        cities={cities.map((c) => ({ slug: c.slug, name: c.name }))}
        estimate={estimateAction}
        requestContact={requestValuationContactAction}
      />
    </main>
  );
}
