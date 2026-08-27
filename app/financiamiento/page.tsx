import type { Metadata } from "next";
import Link from "next/link";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { formatGs } from "@/lib/format";
import { listFinancingPrograms } from "@/lib/directory-queries";
import {
  CtaBand,
  FeatureGrid,
  PageHero,
  Prose,
  Section,
  StepList,
} from "@/components/MarketingUI";

// Programs come from the DB (seed:financing) and change with published terms.
export const dynamic = "force-dynamic";

const TITLE = "Financiamiento y cuotas";
const DESCRIPTION =
  "Cómo se financia una vivienda en Paraguay: programas vigentes, tasas de referencia, plazos y cómo calculamos la cuota estimada que ves en cada aviso.";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE}`,
    description: DESCRIPTION,
    alternates: { canonical: `${await siteOrigin()}/financiamiento` },
    openGraph: { title: `${TITLE} — ${brand}`, description: DESCRIPTION },
  };
}

const STEPS = [
  {
    title: "Calculá cuánto podés pagar por mes",
    text: "La regla práctica que usan la mayoría de las entidades: la cuota no debería superar entre el 25% y el 30% de tus ingresos mensuales comprobables.",
  },
  {
    title: "Juntá la entrega",
    text: "Casi todos los programas piden un porcentaje inicial. Es el punto que más demora la operación, así que conviene tenerlo definido antes de salir a buscar.",
  },
  {
    title: "Pedí una precalificación",
    text: "Con tus ingresos y tu historial, la entidad te dice hasta qué monto te presta. Buscar con ese número en la mano evita enamorarse de una propiedad fuera de alcance.",
  },
  {
    title: "Elegí la propiedad y presentá la carpeta",
    text: "Título, tasación de la entidad, comprobantes de ingreso e informe de deudas. La tasación oficial la hace la entidad, no el portal.",
  },
  {
    title: "Firma y desembolso",
    text: "Escritura ante escribano e inscripción. Sumá al presupuesto los gastos de escrituración, sellados e impuestos, que no entran en el crédito.",
  },
];

const CONCEPTS = [
  {
    icon: "💵",
    title: "Entrega inicial",
    text: "El porcentaje que ponés de tu bolsillo. Cuanto mayor sea, menor es la cuota y mejores las condiciones que conseguís.",
  },
  {
    icon: "📈",
    title: "Tasa anual",
    text: "El costo del dinero por año. Puede ser fija o variable; una diferencia de un punto sobre 20 años es mucha plata, así que compará.",
  },
  {
    icon: "🗓",
    title: "Plazo",
    text: "A más años, cuota más baja pero más intereses totales. Elegí el plazo más corto que te permita dormir tranquilo.",
  },
  {
    icon: "🏦",
    title: "Gastos administrativos",
    text: "Tasación, seguro de vida, seguro del inmueble y gastos de escrituración. No están en la cuota que mostramos y conviene presupuestarlos aparte.",
  },
];

const FAQ = [
  {
    q: "¿La cuota que muestran es la que voy a pagar?",
    a: "No necesariamente. Es una estimación calculada con las condiciones de referencia de los programas vigentes: mismo monto, mismo plazo y misma tasa para todos. Tu cuota real depende de la entidad, del plazo aprobado, de tu entrega inicial y de tu perfil crediticio.",
  },
  {
    q: "¿Cómo la calculan?",
    a: "Con la fórmula estándar de cuota fija (sistema francés) sobre el precio de la propiedad menos la entrega mínima del programa, al plazo máximo y a la tasa anual de ese programa. Entre los programas para los que la propiedad califica, mostramos el que da la cuota más baja. Recalculamos cuando cambian los precios o las condiciones cargadas.",
  },
  {
    q: "¿Ustedes otorgan créditos?",
    a: "No. No somos entidad financiera ni intermediamos créditos: el crédito lo otorga un banco, una financiera o una cooperativa. Publicamos la referencia para que puedas orientarte antes de golpear puertas.",
  },
  {
    q: "¿Se puede financiar un terreno o una propiedad en pozo?",
    a: "Suele poder financiarse, pero con condiciones distintas a las de una vivienda terminada: plazos más cortos y entrega mayor. En los proyectos en pozo, muchas veces el plan de pagos lo da la desarrolladora hasta la entrega.",
  },
];

export default async function FinanciamientoPage() {
  const [origin, programs] = await Promise.all([
    siteOrigin(),
    listFinancingPrograms(),
  ]);

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Inicio", url: "/" },
            { name: TITLE, url: "/financiamiento" },
          ]),
          faqJsonLd(FAQ),
        ]}
      />

      <PageHero
        kicker="Guía"
        title="Financiamiento de vivienda en Paraguay"
        subtitle="Qué programas existen, qué condiciones tienen y de dónde sale la cuota estimada que ves en cada propiedad en venta."
      />

      {programs.length > 0 && (
        <Section
          title="Programas que usamos como referencia"
          subtitle="Estas son las condiciones con las que calculamos la cuota estimada del portal."
        >
          <div className="mk-table-wrap">
            <table className="mk-table">
              <thead>
                <tr>
                  <th>Programa</th>
                  <th>Tasa anual</th>
                  <th>Plazo máximo</th>
                  <th>Monto máximo</th>
                  <th>Entrega mínima</th>
                </tr>
              </thead>
              <tbody>
                {programs.map((p) => (
                  <tr key={p.code}>
                    <td data-label="Programa">{p.name}</td>
                    <td data-label="Tasa anual">
                      {Number(p.annualRate).toLocaleString("es-PY", {
                        maximumFractionDigits: 2,
                      })}
                      %
                    </td>
                    <td data-label="Plazo máximo">
                      {Math.round(p.maxTermMonths / 12)} años
                    </td>
                    <td data-label="Monto máximo">
                      {p.maxAmountGs ? formatGs(p.maxAmountGs) : "—"}
                    </td>
                    <td data-label="Entrega mínima">
                      {Number(p.minDownPct).toLocaleString("es-PY", {
                        maximumFractionDigits: 2,
                      })}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mk-note">
            Datos de referencia cargados en el portal para el cálculo de cuotas.
            Las condiciones definitivas las fija cada entidad y pueden cambiar
            sin previo aviso — confirmalas siempre con el banco, la financiera o
            la cooperativa antes de tomar una decisión. Esta página no es una
            oferta de crédito.
          </p>
        </Section>
      )}

      <Section tone="muted" title="Los cuatro números que definen tu cuota">
        <FeatureGrid items={CONCEPTS} columns={4} />
      </Section>

      <Section title="El proceso, paso a paso">
        <StepList steps={STEPS} />
      </Section>

      <Section width="narrow" tone="muted" title="Cómo calculamos la cuota estimada">
        <Prose>
          <p>
            Usamos el sistema de cuota fija (francés): sobre el monto a
            financiar —el precio de la propiedad menos la entrega mínima del
            programa— aplicamos la tasa anual del programa dividida en cuotas
            mensuales, por el plazo máximo permitido. Cuando la propiedad
            califica para más de un programa, mostramos el que arroja la cuota
            más baja. El resultado es la cuota que ves en la ficha de cada
            propiedad en venta.
          </p>
          <p>
            Es deliberadamente conservador y uniforme: todos los avisos se
            calculan igual, para que las cuotas sean comparables entre sí. No
            incluye seguros, gastos administrativos ni gastos de escrituración,
            y no considera tu situación particular. Tomala como una señal de
            magnitud —«esto está en mi rango» o «esto no»— y no como una
            liquidación.
          </p>
        </Prose>

        <div className="mk-faq">
          {FAQ.map((f) => (
            <details key={f.q} className="mk-faq__item">
              <summary className="mk-faq__q">{f.q}</summary>
              <p className="mk-faq__a">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <Section width="narrow">
        <p className="mk-note">
          ¿Querés saber cuánto vale tu propiedad actual antes de dar el paso?
          Probá la <Link href="/tasacion">tasación online gratuita</Link> o mirá
          los <Link href="/precios">precios de referencia por ciudad</Link>.
        </p>
      </Section>

      <CtaBand
        title="Buscá con la cuota a la vista"
        text="Todas las propiedades en venta muestran su cuota mensual estimada."
        primary={{ label: "Ver propiedades en venta", href: "/venta/asuncion" }}
        secondary={{ label: "Tasar mi propiedad", href: "/tasacion" }}
      />
    </main>
  );
}
