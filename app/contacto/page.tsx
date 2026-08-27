import type { Metadata } from "next";
import Link from "next/link";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd, organizationJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { LeadForm } from "@/components/LeadForm";
import { PageHero, Section } from "@/components/MarketingUI";
import { CONTACT_EMAIL, CONTACT_WHATSAPP } from "@/config/contact";
import { waLink } from "@/lib/wa";

export const dynamic = "force-dynamic";

const TITLE = "Contacto";
const DESCRIPTION = (brand: string) => `Escribinos por WhatsApp o dejanos tu consulta: publicación de propiedades, cuentas para inmobiliarias, proyectos y soporte de ${brand}.`;

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE}`,
    description: DESCRIPTION(brand),
    alternates: { canonical: `${await siteOrigin()}/contacto` },
    openGraph: { title: `${TITLE} — ${brand}`, description: DESCRIPTION(brand) },
  };
}

/**
 * Contact routing note: this page never handles a question about a specific
 * property. Those go to whoever published the aviso, through the form on the
 * listing page — so the copy sends people there instead of creating a support
 * queue we can't answer.
 */
export default async function ContactoPage() {
  const brand = await brandName();
  const origin = await siteOrigin();
  const whatsapp = CONTACT_WHATSAPP;
  const waHref = waLink(whatsapp);

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Inicio", url: "/" },
            { name: TITLE, url: "/contacto" },
          ]),
          organizationJsonLd(origin, {
            name: brand,
            whatsapp,
            email: CONTACT_EMAIL ?? undefined,
          }),
        ]}
      />

      <PageHero
        kicker="Contacto"
        title="Hablemos"
        subtitle="Respondemos consultas sobre publicación, cuentas de inmobiliaria, proyectos y todo lo que tenga que ver con el portal."
      />

      <Section>
        <div className="mk-contact">
          <div className="mk-contact__form">
            <h2 className="mk-section__title mk-section__title--sub">
              Dejanos tu consulta
            </h2>
            <LeadForm
              leadType="seller"
              reasons={[
                { value: "seller", label: "Quiero publicar una propiedad" },
                {
                  value: "agent_signup",
                  label: "Soy inmobiliaria o agente",
                },
                {
                  value: "developer",
                  label: "Soy desarrolladora / tengo un proyecto",
                },
                { value: "buyer", label: "Otra consulta" },
              ]}
              companyField
            />
          </div>

          <aside className="mk-contact__aside">
            <div className="mk-card">
              <h3 className="mk-card__title">Canales directos</h3>
              <ul className="mk-card__list">
                {waHref && (
                  <li>
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      💬 WhatsApp {whatsapp}
                    </a>
                  </li>
                )}
                {/* Only shown once a real mailbox is configured — the form on
                    the left is the channel until then. */}
                {CONTACT_EMAIL && (
                  <li>
                    <a href={`mailto:${CONTACT_EMAIL}`}>✉️ {CONTACT_EMAIL}</a>
                  </li>
                )}
                <li>📝 Formulario de contacto (respondemos por acá)</li>
                <li>📍 Marbella, España</li>
                <li>🕘 Lunes a viernes, 8:00 a 18:00</li>
              </ul>
            </div>

            <div className="mk-card">
              <h3 className="mk-card__title">
                ¿Consulta sobre una propiedad puntual?
              </h3>
              <p className="mk-card__text">
                Las consultas sobre un aviso las responde quien lo publicó, no
                nosotros. Entrá a la propiedad y usá el formulario o el botón de
                WhatsApp que están en la ficha — así te contesta directamente el
                vendedor o la inmobiliaria.
              </p>
              <Link className="mk-card__link" href="/kopa/marbella">
                Ver propiedades →
              </Link>
            </div>

            <div className="mk-card">
              <h3 className="mk-card__title">Atajos útiles</h3>
              <ul className="mk-card__list">
                <li>
                  <Link href="/publicar">Publicar una propiedad</Link>
                </li>
                <li>
                  <Link href="/para-inmobiliarias">
                    Cuenta para inmobiliarias
                  </Link>
                </li>
                <li>
                  <Link href="/tasacion">Tasar mi propiedad gratis</Link>
                </li>
                <li>
                  <Link href="/preguntas-frecuentes">Preguntas frecuentes</Link>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </Section>
    </main>
  );
}
