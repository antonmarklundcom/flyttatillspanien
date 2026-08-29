import type { Metadata } from "next";
import Link from "next/link";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { citiesWithPrices } from "@/lib/precios-queries";
import { getPortalStats } from "@/lib/directory-queries";
import {
  CtaBand,
  FeatureGrid,
  PageHero,
  Prose,
  Section,
  StatRow,
} from "@/components/MarketingUI";

export const dynamic = "force-dynamic";

const TITLE = "Datos del mercado inmobiliario";
const DESCRIPTION =
  "Precios de referencia por ciudad, cuotas de financiamiento vigentes y tasación online: los números del mercado inmobiliario paraguayo, calculados sobre avisos publicados.";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE} de Paraguay`,
    description: DESCRIPTION,
    alternates: { canonical: `${await siteOrigin()}/datos` },
    openGraph: { title: `${TITLE} — ${brand}`, description: DESCRIPTION },
  };
}

const TOOLS = [
  {
    icon: "📊",
    title: "Precios por ciudad",
    text: "Mediana de precio por m² en venta y en alquiler, por ciudad y tipo de propiedad. Solo publicamos la cifra cuando la muestra alcanza un mínimo razonable.",
  },
  {
    icon: "💰",
    title: "Tasación online gratis",
    text: "Un rango estimado para tu propiedad a partir de los avisos comparables de tu zona. Sin registro y en menos de un minuto.",
  },
  {
    icon: "🏦",
    title: "Financiamiento y cuotas",
    text: "Las condiciones de los programas vigentes y cómo se convierte un precio de venta en una cuota mensual estimada.",
  },
];

/**
 * Market-data hub — the "Datos" tab competitors have and this portal spread
 * across three unrelated URLs. It doesn't invent a new dataset: it puts the
 * medians job, the valuation tool and the financing programs behind one
 * entry point, and states plainly how each number is produced.
 */
export default async function DatosPage() {
  const [origin, priceCities, stats] = await Promise.all([
    siteOrigin(),
    citiesWithPrices(),
    getPortalStats(),
  ]);

  const totalSample = priceCities.reduce(
    (n: number, c: { reliableSample: number }) => n + c.reliableSample,
    0,
  );

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Inicio", url: "/" },
            { name: "Datos", url: "/datos" },
          ]),
        ]}
      />

      <PageHero
        kicker="Datos"
        title="Los números del mercado inmobiliario paraguayo"
        subtitle="Cuánto vale el m² en cada ciudad, qué cuota sale con los programas vigentes y cuánto pedirías por tu propiedad. Todo calculado sobre avisos publicados, con la muestra a la vista."
      />

      <Section>
        <StatRow
          stats={[
            {
              value: stats.listings.toLocaleString("es-PY"),
              label: "Avisos publicados analizados",
            },
            {
              value: priceCities.length.toLocaleString("es-PY"),
              label: "Ciudades con precio de referencia",
            },
            {
              value: totalSample.toLocaleString("es-PY"),
              label: "Avisos en la muestra de precios",
            },
          ]}
        />
      </Section>

      <Section tone="muted" title="Herramientas">
        <FeatureGrid items={TOOLS} />
        <div className="mk-cta__actions" style={{ marginTop: 24 }}>
          <Link className="mk-btn mk-btn--outline" href="/precios">
            Ver precios por ciudad
          </Link>
          <Link className="mk-btn mk-btn--outline" href="/tasacion">
            Tasar mi propiedad
          </Link>
        </div>
      </Section>

      {priceCities.length > 0 && (
        <Section
          title="Precio de referencia por ciudad"
          subtitle="Entrá a cada ciudad para ver la mediana por m², por tipo de propiedad y por operación."
        >
          <div className="hub-grid hub-grid--cities">
            {priceCities.map((c) => (
              <Link
                key={c.slug}
                className="hub-tile"
                href={`/precios/${c.slug}`}
              >
                <span className="hub-tile__label">{c.name}</span>
                <span className="hub-tile__count">
                  {c.reliableSample.toLocaleString("es-PY")}
                </span>
              </Link>
            ))}
          </div>
          <p className="mk-note">
            El número de cada tarjeta es el tamaño de la muestra: cuántos
            avisos publicados sostienen la mediana de esa ciudad. Cuanto mayor
            sea, más confiable es el dato.
          </p>
        </Section>
      )}

      <Section tone="muted" width="narrow" title="Cómo se calculan estos números">
        <Prose>
          <h2>Precios de referencia</h2>
          <p>
            Tomamos los avisos publicados de cada ciudad y tipo de propiedad y
            calculamos la <strong>mediana</strong> de precio por m², no el
            promedio: la mediana no se deforma por unos pocos avisos muy caros
            o muy baratos. Solo publicamos la cifra de un grupo cuando tiene
            una muestra mínima; por debajo de eso, el número no se muestra en
            lugar de mostrar algo poco confiable.
          </p>
          <p>
            Importante: son precios <em>de publicación</em>, no de cierre. En
            Paraguay lo habitual es que la operación cierre por debajo del
            precio publicado, así que tomalos como el techo de la negociación.
          </p>

          <h2>Tasación</h2>
          <p>
            La tasación online compara tu propiedad con los avisos publicados de
            la misma zona, tipo y rango de superficie, y devuelve un rango. Es
            un punto de partida para fijar precio, no una tasación oficial: esa
            la hace un tasador matriculado o la entidad que otorga el crédito.
          </p>

          <h2>Con qué frecuencia se actualizan</h2>
          <p>
            Las medianas se recalculan periódicamente sobre el inventario
            vigente y las cuotas se recalculan cuando cambian los precios o las
            condiciones de los programas. Cada página de precios indica el
            período sobre el que está calculada.
          </p>
        </Prose>
      </Section>

      <Section width="narrow">
        <p className="mk-note">
          ¿Sos periodista o analista y querés citar estos datos? Podés hacerlo
          con atribución y enlace a la página correspondiente.{" "}
          <Link href="/contacto">Escribinos</Link> si necesitás un corte
          específico del mercado.
        </p>
      </Section>

      <CtaBand
        title="Empezá por tu propiedad"
        text="Mirá cuánto vale hoy, según los avisos publicados en tu zona."
        primary={{ label: "Tasar gratis", href: "/tasacion" }}
        secondary={{ label: "Ver precios por ciudad", href: "/precios" }}
      />
    </main>
  );
}
