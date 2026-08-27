import type { Metadata } from "next";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd, organizationJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { getPortalStats } from "@/lib/directory-queries";
import { CONTACT_EMAIL, CONTACT_WHATSAPP } from "@/config/contact";
import {
  CtaBand,
  FeatureGrid,
  PageHero,
  Prose,
  Section,
  StatRow,
} from "@/components/MarketingUI";

export const dynamic = "force-dynamic";

const TITLE = "Sobre nosotros";
const DESCRIPTION = (brand: string) => `${brand} es el portal inmobiliario de Paraguay: buscar es gratis, publicar también, y cada aviso muestra precio de referencia de la zona y cuota estimada.`;

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE}`,
    description: DESCRIPTION(brand),
    alternates: { canonical: `${await siteOrigin()}/nosotros` },
    openGraph: { title: `${TITLE} — ${brand}`, description: DESCRIPTION(brand) },
  };
}

const PRINCIPLES = [
  {
    icon: "🔍",
    title: "Información antes que avisos",
    text: "Un portal no debería ser solo un tablón. Publicamos medianas de precio por ciudad y por m², cuota estimada en cada propiedad en venta y tasación online gratuita, para que quien busca pueda comparar y no solo mirar.",
  },
  {
    icon: "🤝",
    title: "Contacto directo, sin peaje",
    text: "Las consultas van directo de quien busca a quien publica. No cobramos por lead, no revendemos contactos y no nos metemos en la negociación.",
  },
  {
    icon: "🇵🇾",
    title: "Hecho para Paraguay",
    text: "Precios en guaraníes y dólares, barrios reales, WhatsApp como canal principal y programas de financiamiento locales — no un portal extranjero traducido.",
  },
  {
    icon: "📐",
    title: "Números que se pueden auditar",
    text: "Nuestras estimaciones salen de avisos publicados y de condiciones vigentes de financiamiento, y decimos siempre sobre qué muestra están calculadas. Si el dato es flojo, lo decimos en vez de inventarlo.",
  },
];

export default async function NosotrosPage() {
  const brand = await brandName();
  const [origin, stats] = await Promise.all([siteOrigin(), getPortalStats()]);
  const whatsapp = CONTACT_WHATSAPP;

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Inicio", url: "/" },
            { name: TITLE, url: "/nosotros" },
          ]),
          organizationJsonLd(origin, {
            name: brand,
            whatsapp,
            email: CONTACT_EMAIL ?? undefined,
          }),
        ]}
      />

      <PageHero
        kicker="Quiénes somos"
        title="Buscar propiedad en Paraguay debería ser transparente"
        subtitle={`${brand} nació de una molestia concreta: buscar casa en Paraguay significa recorrer avisos repetidos, sin precio de referencia, sin saber si el número cierra con lo que uno puede pagar por mes. Armamos el portal que nos hubiera gustado usar.`}
      />

      {stats.listings > 0 && (
        <Section>
          <StatRow
            stats={[
              {
                value: stats.listings.toLocaleString("es-PY"),
                label: "Propiedades publicadas",
              },
              {
                value: stats.cities.toLocaleString("es-PY"),
                label: "Zonas con inventario",
              },
              {
                value: stats.agencies.toLocaleString("es-PY"),
                label: "Inmobiliarias publicando",
              },
              {
                value: stats.projects.toLocaleString("es-PY"),
                label: "Proyectos en desarrollo",
              },
            ]}
          />
        </Section>
      )}

      <Section title="En qué creemos" tone="muted">
        <FeatureGrid items={PRINCIPLES} columns={2} />
      </Section>

      <Section title="Cómo ganamos plata" width="narrow">
        <Prose>
          <p>
            Preferimos decirlo de entrada, porque define cómo funciona todo lo
            demás. Buscar es gratis para quien busca y publicar es gratis para
            quien vende o alquila, incluidas las inmobiliarias. No cobramos
            comisión sobre las operaciones ni cobramos por consulta recibida.
          </p>
          <p>
            Nuestros ingresos vienen de la visibilidad preferente que contratan
            algunas inmobiliarias y desarrolladoras — avisos destacados,
            posiciones en la portada y en las páginas de ciudad. Eso significa
            que un aviso puede aparecer más arriba porque su publicante contrató
            destaque, y cuando pasa se muestra identificado como tal. Lo que
            nunca cambia por pagar es el precio, la superficie ni ningún otro
            dato de la propiedad.
          </p>
          <h2>Qué no hacemos</h2>
          <p>
            No somos una inmobiliaria y no representamos a ninguna de las
            partes. No participamos de las negociaciones, no intervenimos en las
            señas ni en los contratos y no verificamos de forma independiente la
            titularidad de cada inmueble publicado. Antes de cualquier pago o
            firma, verificá la documentación con un escribano.
          </p>
          <h2>De dónde salen los datos</h2>
          <p>
            Los avisos los cargan sus dueños, inmobiliarias y agentes desde el
            panel del portal. Las medianas de precio se calculan sobre los
            avisos publicados de cada ciudad y tipo de propiedad, y solo
            publicamos la cifra cuando la muestra alcanza un mínimo razonable.
            Las cuotas estimadas usan las condiciones de programas de
            financiamiento vigentes en Paraguay y son orientativas: la cuota
            real depende de la entidad, del plazo y de tu perfil crediticio.
          </p>
        </Prose>
      </Section>

      <CtaBand
        title="¿Querés publicar tu propiedad?"
        text="Cargala en minutos y llegá a quienes están buscando en tu zona."
        primary={{ label: "Publicar gratis", href: "/publicar" }}
        secondary={{ label: "Contactarnos", href: "/contacto" }}
      />
    </main>
  );
}
