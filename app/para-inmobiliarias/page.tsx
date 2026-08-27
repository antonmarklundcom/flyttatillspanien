import type { Metadata } from "next";
import Link from "next/link";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { getPortalStats } from "@/lib/directory-queries";
import { LeadForm } from "@/components/LeadForm";
import {
  CtaBand,
  FeatureGrid,
  PageHero,
  Section,
  StatRow,
  StepList,
} from "@/components/MarketingUI";

// Reads live portal counts; the DB isn't reachable at build time on Hostinger.
export const dynamic = "force-dynamic";

const TITLE = "Para inmobiliarias y agentes";
const DESCRIPTION = (brand: string) => `Publica toda tu cartera en ${brand}, el portal para compradores suecos de propiedad en España. Recibe consultas por WhatsApp y muestra tu inmobiliaria en el directorio. Empezar es gratis.`;

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE}`,
    description: DESCRIPTION(brand),
    alternates: { canonical: `${await siteOrigin()}/para-inmobiliarias` },
    openGraph: { title: `${TITLE} — ${brand}`, description: DESCRIPTION(brand) },
  };
}

const BENEFITS = [
  {
    icon: "📇",
    title: "Toda tu cartera, en un solo lugar",
    text: "Sube propiedad por propiedad o importa tu cartera entera desde una hoja de cálculo o pegando el enlace de tu anuncio. Sin límite de anuncios en el plan gratuito.",
  },
  {
    icon: "💬",
    title: "Las consultas llegan directas a ti",
    text: "Cada anuncio lleva tu WhatsApp. No intermediamos la conversación, no cobramos por contacto y no revendemos tus leads a la competencia.",
  },
  {
    icon: "🏢",
    title: "Perfil público de tu inmobiliaria",
    text: "Tu página con logo, equipo de agentes y todos tus anuncios activos — un enlace que puedes compartir y que además posiciona en Google.",
  },
  {
    icon: "📊",
    title: "Datos reales del mercado",
    text: "Medianas de precio por zona y por m² calculadas sobre los anuncios publicados. Argumentos concretos para tu próxima captación.",
  },
  {
    icon: "💶",
    title: "Coste de compra estimado en cada anuncio",
    text: "Mostramos automáticamente una estimación del coste total de compra (ITP/IVA, notaría, registro) según la comunidad autónoma. El comprador sueco entiende desde el principio qué se suma al precio.",
  },
  {
    icon: "👥",
    title: "Cuentas para todo tu equipo",
    text: "Cada agente con su usuario y su perfil público, todo bajo la cuenta de la inmobiliaria. Tú ves la actividad de toda la oficina.",
  },
];

const STEPS = [
  {
    title: "Crea tu cuenta",
    text: "Alta en menos de dos minutos. No pedimos tarjeta.",
  },
  {
    title: "Sube tu cartera",
    text: "Publica una por una desde el panel, o importa varias a la vez. Te ayudamos con la primera carga si quieres.",
  },
  {
    title: "Verificamos tu inmobiliaria",
    text: "Revisamos los datos y activamos el sello de verificado en tu perfil y en todos tus anuncios.",
  },
  {
    title: "Recibe y gestiona consultas",
    text: "Las consultas te llegan por WhatsApp y quedan registradas en tu panel, junto con la propiedad que las originó.",
  },
];

const FAQ = [
  {
    q: "¿Cuánto cuesta publicar como inmobiliaria?",
    a: "El plan Profesional es gratuito e incluye anuncios ilimitados, perfil público y panel con consultas. Los planes de pago añaden destacados en las búsquedas y posiciones fijas en la portada; puedes verlos en la página de planes.",
  },
  {
    q: "¿Cobráis comisión sobre mis operaciones?",
    a: "No. No participamos en la negociación ni cobramos porcentaje sobre ninguna venta o alquiler que cierres. Lo que acordéis tú y tu cliente es cosa vuestra.",
  },
  {
    q: "¿Puedo importar mi cartera desde otro portal o desde una hoja de cálculo?",
    a: "Sí. Desde el panel puedes importar anuncios a partir de una hoja de cálculo o pegando el enlace de una publicación existente, y luego ajustar lo que haga falta antes de publicar.",
  },
  {
    q: "¿Qué pasa con mis leads?",
    a: "Son tuyos. Las consultas de tus anuncios van directas a tu WhatsApp y quedan en tu panel. No los vendemos ni los compartimos con otras inmobiliarias.",
  },
  {
    q: "¿Y si soy agente independiente, sin inmobiliaria?",
    a: "También puedes publicar. Tienes tu propio perfil de agente, con tu foto, tu WhatsApp y tus anuncios, sin necesidad de estar vinculado a una oficina.",
  },
];

export default async function ParaInmobiliariasPage() {
  const brand = await brandName();
  const [origin, stats] = await Promise.all([siteOrigin(), getPortalStats()]);

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Inicio", url: "/" },
            { name: TITLE, url: "/para-inmobiliarias" },
          ]),
          faqJsonLd(FAQ),
        ]}
      />

      <PageHero
        tone="dark"
        kicker="Para profesionales del sector"
        title="Tu cartera, frente a compradores suecos"
        subtitle={`Publica todas tus propiedades en ${brand}, el portal de propiedad española pensado para compradores suecos. Recibe las consultas directas en tu WhatsApp y muestra tu inmobiliaria en el directorio del portal. Empezar es gratis y no pedimos tarjeta.`}
        actions={
          <>
            <Link className="mk-btn mk-btn--accent" href="/registro">
              Crear cuenta gratis
            </Link>
            <Link className="mk-btn mk-btn--ghost" href="#contacto">
              Hablar con nosotros
            </Link>
          </>
        }
      />

      {(stats.listings > 0 || stats.agencies > 0) && (
        <Section>
          <StatRow
            stats={[
              {
                value: stats.listings.toLocaleString("es-ES"),
                label: "Propiedades publicadas",
              },
              {
                value: stats.cities.toLocaleString("es-ES"),
                label: "Zonas con inventario activo",
              },
              {
                value: stats.agencies.toLocaleString("es-ES"),
                label: "Inmobiliarias publicando",
              },
              { value: "0 €", label: "Coste por consulta recibida" },
            ]}
          />
        </Section>
      )}

      <Section
        title="Lo que incluye publicar con nosotros"
        subtitle="Todo esto entra en el plan gratuito. Sin límite de anuncios, sin coste por consulta."
      >
        <FeatureGrid items={BENEFITS} />
      </Section>

      <Section
        tone="muted"
        title="Cómo empezar"
        subtitle="De crear la cuenta a tener la cartera publicada, normalmente el mismo día."
      >
        <StepList steps={STEPS} />
      </Section>

      <Section title="Preguntas de inmobiliarias" width="narrow">
        <div className="mk-faq">
          {FAQ.map((f) => (
            <details key={f.q} className="mk-faq__item">
              <summary className="mk-faq__q">{f.q}</summary>
              <p className="mk-faq__a">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <Section
        id="contacto"
        tone="muted"
        width="narrow"
        title="Hablemos de tu cartera"
        subtitle="Déjanos tus datos y te escribimos por WhatsApp para activar tu cuenta y ayudarte con la primera carga."
      >
        <LeadForm
          leadType="agent_signup"
          companyField
          submitLabel="Quiero publicar mi cartera"
          messagePlaceholder="¿Cuántas propiedades tienes publicadas hoy? ¿En qué zonas trabajas?"
          successTitle="¡Listo! Te escribimos enseguida."
          successText="Un integrante del equipo te contacta por WhatsApp para activar tu cuenta de inmobiliaria."
        />
      </Section>

      <CtaBand
        title="Empieza hoy, sin coste"
        text="Crea tu cuenta, sube tu primera propiedad y mira cuántas consultas llegan."
        primary={{ label: "Crear cuenta gratis", href: "/registro" }}
        secondary={{ label: "Ver planes", href: "/planes" }}
      />
    </main>
  );
}
