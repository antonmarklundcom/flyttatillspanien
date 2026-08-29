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

const TITLE = "Kontakt";
const DESCRIPTION = (brand: string) => `Skriv till oss: annonsering av bostäder, konton för mäklarbyråer, projekt och support för ${brand}.`;

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
        kicker="Kontakt"
        title="Hör av dig"
        subtitle="Vi svarar på frågor om annonsering, konton för mäklarbyråer, projekt och allt annat som rör portalen."
      />

      <Section>
        <div className="mk-contact">
          <div className="mk-contact__form">
            <h2 className="mk-section__title mk-section__title--sub">
              Skicka din fråga
            </h2>
            <LeadForm
              leadType="seller"
              reasons={[
                { value: "seller", label: "Jag vill annonsera en bostad" },
                {
                  value: "agent_signup",
                  label: "Jag är mäklarbyrå eller mäklare",
                },
                {
                  value: "developer",
                  label: "Jag är byggherre / har ett projekt",
                },
                { value: "buyer", label: "Annan fråga" },
              ]}
              companyField
            />
          </div>

          <aside className="mk-contact__aside">
            <div className="mk-card">
              <h3 className="mk-card__title">Direktkanaler</h3>
              <ul className="mk-card__list">
                {/* Only shown once a real mailbox is configured — the form on
                    the left is the channel until then. */}
                {CONTACT_EMAIL && (
                  <li>
                    <a href={`mailto:${CONTACT_EMAIL}`}>✉️ {CONTACT_EMAIL}</a>
                  </li>
                )}
                <li>📝 Kontaktformulär (vi svarar här)</li>
                {waHref && (
                  <li>
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      💬 WhatsApp för mäklarbyråer {whatsapp}
                    </a>
                  </li>
                )}
              </ul>
            </div>

            <div className="mk-card">
              <h3 className="mk-card__title">
                Fråga om en specifik bostad?
              </h3>
              <p className="mk-card__text">
                Frågor om en annons besvaras av den som publicerat den, inte
                av oss. Gå in på bostaden och använd formuläret på sidan — då
                svarar säljaren eller mäklarbyrån direkt.
              </p>
              <Link className="mk-card__link" href="/kopa">
                Se bostäder →
              </Link>
            </div>

            <div className="mk-card">
              <h3 className="mk-card__title">Genvägar</h3>
              <ul className="mk-card__list">
                <li>
                  <Link href="/publicar">Annonsera en bostad</Link>
                </li>
                <li>
                  <Link href="/para-inmobiliarias">
                    Konto för mäklarbyråer
                  </Link>
                </li>
                <li>
                  <Link href="/tasacion">Värdera min bostad gratis</Link>
                </li>
                <li>
                  <Link href="/preguntas-frecuentes">Vanliga frågor</Link>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </Section>
    </main>
  );
}
