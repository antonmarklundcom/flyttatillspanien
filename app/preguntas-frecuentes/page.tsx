import type { Metadata } from "next";
import Link from "next/link";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { faqAll, faqSections } from "@/config/faq";
import { CtaBand, PageHero, Section } from "@/components/MarketingUI";

export const dynamic = "force-dynamic";

const TITLE = "Vanliga frågor";
const DESCRIPTION = (brand: string) => `Allt om ${brand}: hur du söker, hur du publicerar, vad den uppskattade köpkostnaden innebär, provisioner och hur du kontaktar en säljare eller mäklarbyrå.`;

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
            { name: "Start", url: "/" },
            { name: TITLE, url: "/preguntas-frecuentes" },
          ]),
          faqJsonLd(faqAll(brand)),
        ]}
      />

      <PageHero
        kicker="Hjälp"
        title="Vanliga frågor"
        subtitle="Hittar du inte svaret här, hör av dig så svarar vi."
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
          Mer information: <Link href="/como-funciona">så fungerar det</Link>,{" "}
          <Link href="/precios">priser och köpkostnad</Link>,{" "}
          <Link href="/para-inmobiliarias">för mäklarbyråer</Link>.
        </p>
      </Section>

      <CtaBand
        title="Hittade du inte det du sökte?"
        text="Hör av dig så svarar vi."
        primary={{ label: "Kontakta oss", href: "/contacto" }}
        secondary={{ label: "Se bostäder", href: "/kopa/marbella" }}
      />
    </main>
  );
}
