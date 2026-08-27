import type { Metadata } from "next";
import Link from "next/link";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { faqAll, faqSections } from "@/config/faq";
import { CtaBand, PageHero, Section } from "@/components/MarketingUI";

export const dynamic = "force-dynamic";

const TITLE = "Preguntas frecuentes";
const DESCRIPTION = (brand: string) => `Todo sobre ${brand}: cómo buscar, cómo publicar, qué es la cuota estimada, comisiones y cómo contactar a un vendedor o inmobiliaria.`;

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE}`,
    description: DESCRIPTION(brand),
    alternates: { canonical: `${await siteOrigin()}/preguntas-frecuentes` },
    openGraph: { title: `${TITLE} — ${brand}`, description: DESCRIPTION(brand) },
  };
}

export default async function FaqPage() {
  const brand = await brandName();
  const sections = faqSections(brand);
  const origin = await siteOrigin();

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Inicio", url: "/" },
            { name: TITLE, url: "/preguntas-frecuentes" },
          ]),
          faqJsonLd(faqAll(brand)),
        ]}
      />

      <PageHero
        kicker="Ayuda"
        title="Preguntas frecuentes"
        subtitle="Si tu duda no está acá, escribinos y te respondemos por WhatsApp."
      />

      {sections.map((section, i) => (
        <Section
          key={section.id}
          id={section.id}
          width="narrow"
          tone={i % 2 === 1 ? "muted" : "default"}
          title={section.title}
        >
          <div className="mk-faq">
            {section.items.map((f) => (
              <details key={f.q} className="mk-faq__item">
                <summary className="mk-faq__q">{f.q}</summary>
                <p className="mk-faq__a">{f.a}</p>
              </details>
            ))}
          </div>
        </Section>
      ))}

      <Section width="narrow">
        <p className="mk-note">
          Más información: <Link href="/como-funciona">cómo funciona</Link>,{" "}
          <Link href="/financiamiento">financiamiento y cuotas</Link>,{" "}
          <Link href="/para-inmobiliarias">para inmobiliarias</Link>.
        </p>
      </Section>

      <CtaBand
        title="¿No encontraste lo que buscabas?"
        text="Escribinos y te contestamos por WhatsApp."
        primary={{ label: "Contactarnos", href: "/contacto" }}
        secondary={{ label: "Ver propiedades", href: "/venta/asuncion" }}
      />
    </main>
  );
}
