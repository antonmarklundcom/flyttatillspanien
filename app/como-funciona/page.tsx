import type { Metadata } from "next";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import {
  CtaBand,
  FeatureGrid,
  PageHero,
  Section,
  StepList,
} from "@/components/MarketingUI";

export const dynamic = "force-dynamic";

const TITLE = "Cómo funciona";
const DESCRIPTION = (brand: string) => `Cómo comprar, alquilar y publicar una propiedad en ${brand}: buscar por zona, comparar precios de referencia, ver la cuota estimada y contactar directo por WhatsApp.`;

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE}`,
    description: DESCRIPTION(brand),
    alternates: { canonical: `${await siteOrigin()}/como-funciona` },
    openGraph: { title: `${TITLE} — ${brand}`, description: DESCRIPTION(brand) },
  };
}

const BUY_STEPS = [
  {
    title: "Buscá por zona, tipo y presupuesto",
    text: "Elegí ciudad o barrio y filtrá por tipo de propiedad, dormitorios, superficie y rango de precio. Los resultados se pueden ver también sobre el mapa.",
  },
  {
    title: "Compará con el precio de la zona",
    text: "Antes de decidir, mirá la mediana de precio por m² de esa ciudad en la sección de precios. Sirve para saber si el aviso está caro, barato o en línea con el mercado.",
  },
  {
    title: "Mirá la cuota estimada",
    text: "En cada propiedad en venta mostramos la cuota mensual aproximada según las condiciones de financiamiento vigentes, para que sepas de entrada si el número te cierra.",
  },
  {
    title: "Contactá directo por WhatsApp",
    text: "Escribile a quien publicó desde la misma ficha. El mensaje va con el enlace de la propiedad incluido, así no hay confusión sobre cuál es.",
  },
  {
    title: "Verificá la documentación antes de pagar",
    text: "Pedí título, certificado de condominio si corresponde y estado de deudas municipales, y hacé la verificación con un escribano antes de cualquier seña.",
  },
];

const SELL_STEPS = [
  {
    title: "Estimá el precio",
    text: "Usá la tasación online gratuita para tener un rango de partida basado en los avisos publicados de tu zona y tipo de propiedad.",
  },
  {
    title: "Creá tu cuenta y cargá el aviso",
    text: "Registro con tu WhatsApp y carga guiada: fotos, ubicación en el mapa, superficie, ambientes y precio. Toma unos minutos.",
  },
  {
    title: "Publicá gratis",
    text: "El aviso queda visible en las búsquedas del portal y, con el tiempo, en Google. Sin costo de publicación y sin comisión sobre la operación.",
  },
  {
    title: "Recibí y respondé consultas",
    text: "Las consultas llegan a tu WhatsApp y quedan registradas en tu panel, junto con las visitas que tuvo cada aviso.",
  },
];

const RENT_TIPS = [
  {
    icon: "📄",
    title: "Qué suelen pedir",
    text: "En Paraguay lo habitual es un depósito de garantía, uno o dos meses adelantados y un garante propietario o seguro de caución. Confirmalo con el propietario antes de reservar.",
  },
  {
    icon: "🧾",
    title: "Qué mirar en el contrato",
    text: "Plazo, ajuste anual, quién paga expensas y servicios, y en qué estado se entrega y se devuelve el inmueble. Pedí inventario con fotos al recibir.",
  },
  {
    icon: "🏢",
    title: "Costos que se olvidan",
    text: "Expensas del edificio, IVA si el propietario factura, y en departamentos la cochera y el baulera pueden cobrarse aparte.",
  },
];

export default async function ComoFuncionaPage() {
  const origin = await siteOrigin();

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Inicio", url: "/" },
            { name: TITLE, url: "/como-funciona" },
          ]),
        ]}
      />

      <PageHero
        kicker="Guía"
        title="Cómo funciona el portal"
        subtitle="Tres caminos según lo que vengas a hacer: comprar, alquilar o publicar. Todo el proceso es gratuito y el contacto siempre es directo entre las partes."
      />

      <Section
        id="comprar"
        title="Si venís a comprar"
        subtitle="De la búsqueda a la firma, con los pasos donde conviene frenar y verificar."
      >
        <StepList steps={BUY_STEPS} />
      </Section>

      <Section
        id="alquilar"
        tone="muted"
        title="Si venís a alquilar"
        subtitle="La búsqueda funciona igual que en venta. Lo que cambia es lo que conviene tener listo antes de reservar."
      >
        <FeatureGrid items={RENT_TIPS} />
      </Section>

      <Section
        id="publicar"
        title="Si venís a publicar"
        subtitle="Para propietarios particulares. Si sos inmobiliaria o agente, tenés cuenta profesional con carga masiva y perfil público."
      >
        <StepList steps={SELL_STEPS} />
      </Section>

      <CtaBand
        title="Empezá por donde te sirva"
        text="Buscar, tasar o publicar — las tres cosas son gratis."
        primary={{ label: "Ver propiedades", href: "/venta/asuncion" }}
        secondary={{ label: "Publicar la mía", href: "/publicar" }}
      />
    </main>
  );
}
