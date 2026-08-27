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
const DESCRIPTION = (brand: string) => `Publicá tu cartera completa en ${brand}, recibí consultas por WhatsApp y mostrá tu inmobiliaria en el directorio. Empezar es gratis.`;

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
    title: "Tu cartera completa, en un solo lugar",
    text: "Cargá propiedad por propiedad o importá tu cartera entera desde una planilla o desde el enlace de tu aviso. Sin límite de avisos en el plan gratuito.",
  },
  {
    icon: "💬",
    title: "Las consultas llegan directo a vos",
    text: "Cada aviso lleva tu WhatsApp. No intermediamos la conversación, no te cobramos por contacto y no revendemos tus leads a la competencia.",
  },
  {
    icon: "🏢",
    title: "Perfil público de tu inmobiliaria",
    text: "Tu página con logo, equipo de agentes y todos tus avisos activos — un enlace que podés compartir y que además posiciona en Google.",
  },
  {
    icon: "📊",
    title: "Datos reales del mercado",
    text: "Medianas de precio por ciudad y por m² calculadas sobre avisos publicados. Argumentos concretos para la próxima captación.",
  },
  {
    icon: "💳",
    title: "Cuota estimada en cada aviso",
    text: "Mostramos automáticamente la cuota mensual aproximada con financiamiento vigente. El comprador entiende de entrada si le cierra el número.",
  },
  {
    icon: "👥",
    title: "Cuentas para tu equipo",
    text: "Cada agente con su usuario y su perfil público, todo bajo la cuenta de la inmobiliaria. Vos ves la actividad de toda la oficina.",
  },
];

const STEPS = [
  {
    title: "Creá tu cuenta",
    text: "Registro con tu WhatsApp en menos de dos minutos. No pedimos tarjeta.",
  },
  {
    title: "Cargá tu cartera",
    text: "Publicá una por una desde el panel, o importá varias de una vez. Nosotros te ayudamos con la primera carga si querés.",
  },
  {
    title: "Verificamos tu inmobiliaria",
    text: "Revisamos los datos y activamos el sello de verificado en tu perfil y en todos tus avisos.",
  },
  {
    title: "Recibí y gestioná consultas",
    text: "Las consultas te llegan por WhatsApp y quedan registradas en tu panel, con la propiedad que las originó.",
  },
];

const FAQ = [
  {
    q: "¿Cuánto cuesta publicar como inmobiliaria?",
    a: "El plan Profesional es gratuito e incluye avisos ilimitados, perfil público y panel con consultas. Los planes pagos agregan destaque en las búsquedas y posiciones fijas en la portada; podés verlos en la página de planes.",
  },
  {
    q: "¿Cobran comisión sobre mis operaciones?",
    a: "No. No participamos de la negociación ni cobramos porcentaje sobre ninguna venta o alquiler que cierres. Lo que se acuerde entre vos y tu cliente es entre ustedes.",
  },
  {
    q: "¿Puedo importar mi cartera desde otro portal o desde una planilla?",
    a: "Sí. Desde el panel podés importar avisos a partir de una planilla o pegando el enlace de una publicación existente, y después ajustar lo que haga falta antes de publicar.",
  },
  {
    q: "¿Qué pasa con mis leads?",
    a: "Son tuyos. Las consultas de tus avisos van directo a tu WhatsApp y quedan en tu panel. No los vendemos ni los compartimos con otras inmobiliarias.",
  },
  {
    q: "¿Y si soy agente independiente, sin inmobiliaria?",
    a: "También podés publicar. Tenés perfil de agente propio, con tu foto, tu WhatsApp y tus avisos, sin necesidad de estar vinculado a una oficina.",
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
        title="Tu cartera, frente a quien la está buscando"
        subtitle={`Publicá todas tus propiedades en ${brand}, recibí las consultas directo en tu WhatsApp y mostrá tu inmobiliaria en el directorio del portal. Empezar es gratis y no pedimos tarjeta.`}
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
                value: stats.listings.toLocaleString("es-PY"),
                label: "Propiedades publicadas",
              },
              {
                value: stats.cities.toLocaleString("es-PY"),
                label: "Zonas con inventario activo",
              },
              {
                value: stats.agencies.toLocaleString("es-PY"),
                label: "Inmobiliarias publicando",
              },
              { value: "Gs. 0", label: "Costo por consulta recibida" },
            ]}
          />
        </Section>
      )}

      <Section
        title="Lo que incluye publicar con nosotros"
        subtitle="Todo esto entra en el plan gratuito. Sin límite de avisos, sin costo por consulta."
      >
        <FeatureGrid items={BENEFITS} />
      </Section>

      <Section
        tone="muted"
        title="Cómo empezás"
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
        subtitle="Dejanos tus datos y te escribimos por WhatsApp para activar tu cuenta y ayudarte con la primera carga."
      >
        <LeadForm
          leadType="agent_signup"
          companyField
          submitLabel="Quiero publicar mi cartera"
          messagePlaceholder="¿Cuántas propiedades tenés publicadas hoy? ¿En qué zonas trabajás?"
          successTitle="¡Listo! Te escribimos enseguida."
          successText="Un integrante del equipo te contacta por WhatsApp para activar tu cuenta de inmobiliaria."
        />
      </Section>

      <CtaBand
        title="Empezá hoy, sin costo"
        text="Creá tu cuenta, cargá tu primera propiedad y mirá cuántas consultas llegan."
        primary={{ label: "Crear cuenta gratis", href: "/registro" }}
        secondary={{ label: "Ver planes", href: "/planes" }}
      />
    </main>
  );
}
