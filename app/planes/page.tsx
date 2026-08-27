import type { Metadata } from "next";
import Link from "next/link";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { CtaBand, PageHero, Section } from "@/components/MarketingUI";

export const dynamic = "force-dynamic";

const TITLE = "Planes y precios";
const DESCRIPTION = (brand: string) => `Publicar en ${brand} es gratis, con avisos ilimitados y sin comisión sobre tus operaciones. Los planes pagos agregan destaque en las búsquedas y en la portada.`;

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE}`,
    description: DESCRIPTION(brand),
    alternates: { canonical: `${await siteOrigin()}/planes` },
    openGraph: { title: `${TITLE} — ${brand}`, description: DESCRIPTION(brand) },
  };
}

/**
 * Plan names mirror the `agencies.plan` enum (free / destacado / partner) so
 * the sales page and the data model can't drift apart.
 *
 * Paid tiers quote "a convenir" rather than a number on purpose: pricing is a
 * business decision that isn't set yet, and a published price we don't honour
 * is worse than an honest "hablemos".
 */
const PLANS: {
  key: string;
  name: string;
  price: string;
  priceNote: string;
  pitch: string;
  features: string[];
  cta: { label: string; href: string };
  featured?: boolean;
}[] = [
  {
    key: "free",
    name: "Particular",
    price: "Gratis",
    priceNote: "Para quien vende o alquila su propia propiedad",
    pitch: "Publicá tu casa, departamento o terreno sin costo ni comisión.",
    features: [
      "Publicación de tus propiedades",
      "Fotos, ubicación en el mapa y descripción completa",
      "Consultas directas a tu WhatsApp",
      "Cuota estimada calculada automáticamente",
      "Aviso indexable en Google",
    ],
    cta: { label: "Publicar gratis", href: "/publicar" },
  },
  {
    key: "destacado",
    name: "Inmobiliaria",
    price: "Gratis",
    priceNote: "Plan profesional, sin costo durante el lanzamiento",
    pitch:
      "Para inmobiliarias y agentes que publican cartera de forma habitual.",
    features: [
      "Todo lo del plan Particular, con avisos ilimitados",
      "Perfil público de la inmobiliaria y de cada agente",
      "Sello de verificado en el perfil y en los avisos",
      "Importación de cartera desde planilla o enlace",
      "Panel con consultas recibidas por propiedad",
      "Cuentas para todo el equipo",
    ],
    cta: { label: "Crear cuenta de inmobiliaria", href: "/registro" },
    featured: true,
  },
  {
    key: "partner",
    name: "Destacado",
    price: "A convenir",
    priceNote: "Según volumen de cartera y zonas",
    pitch:
      "Para quienes quieren visibilidad preferente además de estar publicados.",
    features: [
      "Todo lo del plan Inmobiliaria",
      "Avisos destacados arriba en los resultados de tu zona",
      "Espacio en la portada y en las páginas de ciudad",
      "Presencia destacada en el directorio de inmobiliarias",
      "Acompañamiento en la carga y optimización de avisos",
      "Reportes de visitas y consultas de tu cartera",
    ],
    cta: { label: "Hablar con ventas", href: "/contacto" },
  },
];

const FAQ = [
  {
    q: "¿Publicar es realmente gratis?",
    a: "Sí. Publicar propiedades, recibir consultas y tener perfil público no tiene costo. Los planes pagos son solo para visibilidad preferente.",
  },
  {
    q: "¿Cobran comisión sobre la venta o el alquiler?",
    a: "No. No cobramos porcentaje sobre ninguna operación: no somos parte de la negociación.",
  },
  {
    q: "¿Cobran por cada consulta que recibo?",
    a: "No. No hay costo por lead ni por contacto, en ningún plan.",
  },
  {
    q: "¿Puedo cambiar de plan después?",
    a: "Sí, en cualquier momento y sin permanencia. Escribinos y lo ajustamos.",
  },
];

export default async function PlanesPage() {
  const origin = await siteOrigin();

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Inicio", url: "/" },
            { name: TITLE, url: "/planes" },
          ]),
          faqJsonLd(FAQ),
        ]}
      />

      <PageHero
        kicker="Planes"
        title="Publicar es gratis. Siempre lo fue el punto."
        subtitle="Sin comisión sobre tus operaciones y sin costo por consulta recibida. Si además querés aparecer destacado, tenemos un plan para eso."
      />

      <Section>
        <div className="mk-plans">
          {PLANS.map((p) => (
            <div
              key={p.key}
              className={`mk-plan${p.featured ? " mk-plan--featured" : ""}`}
            >
              {p.featured && <div className="mk-plan__badge">Más elegido</div>}
              <h2 className="mk-plan__name">{p.name}</h2>
              <div className="mk-plan__price">{p.price}</div>
              <div className="mk-plan__price-note">{p.priceNote}</div>
              <p className="mk-plan__pitch">{p.pitch}</p>
              <ul className="mk-plan__features">
                {p.features.map((f) => (
                  <li key={f}>
                    <span aria-hidden>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                className={`mk-btn ${p.featured ? "mk-btn--accent" : "mk-btn--outline"} mk-plan__cta`}
                href={p.cta.href}
              >
                {p.cta.label}
              </Link>
            </div>
          ))}
        </div>

        <p className="mk-note">
          Los planes pagos se facturan en euros y no tienen permanencia
          mínima. Escribinos y armamos la propuesta según el tamaño de tu
          cartera.
        </p>
      </Section>

      <Section tone="muted" width="narrow" title="Preguntas sobre los planes">
        <div className="mk-faq">
          {FAQ.map((f) => (
            <details key={f.q} className="mk-faq__item">
              <summary className="mk-faq__q">{f.q}</summary>
              <p className="mk-faq__a">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <CtaBand
        title="¿Dudas sobre qué plan te conviene?"
        text="Contanos cuántas propiedades manejás y en qué zonas trabajás."
        primary={{ label: "Hablar con nosotros", href: "/contacto" }}
        secondary={{ label: "Ver qué incluye", href: "/para-inmobiliarias" }}
      />
    </main>
  );
}
