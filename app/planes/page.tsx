import type { Metadata } from "next";
import Link from "next/link";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { CtaBand, PageHero, Section } from "@/components/MarketingUI";

export const dynamic = "force-dynamic";

const TITLE = "Planer och priser";
const DESCRIPTION = (brand: string) => `Att publicera på ${brand} är gratis, med obegränsat antal annonser och ingen provision på dina affärer. De betalda planerna lägger till extra synlighet i sökresultaten och på förstasidan.`;

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
 * Paid tiers quote "kontakta oss" rather than a number on purpose: pricing is
 * a business decision that isn't set yet, and a published price we don't
 * honour is worse than an honest "hör av dig".
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
    name: "Privatperson",
    price: "Gratis",
    priceNote: "För dig som säljer eller hyr ut din egen bostad",
    pitch: "Publicera din villa, lägenhet eller tomt utan kostnad eller provision.",
    features: [
      "Publicering av dina bostäder",
      "Bilder, plats på kartan och fullständig beskrivning",
      "Förfrågningar direkt till dig",
      "Uppskattad köpkostnad beräknas automatiskt",
      "Annonsen indexeras av Google",
    ],
    cta: { label: "Publicera gratis", href: "/publicar" },
  },
  {
    key: "destacado",
    name: "Mäklarbyrå",
    price: "Gratis",
    priceNote: "Professionell plan, kostnadsfri under lanseringen",
    pitch:
      "För mäklarbyråer och agenter som publicerar utbud löpande.",
    features: [
      "Allt i planen Privatperson, med obegränsat antal annonser",
      "Offentlig profil för mäklarbyrån och för varje agent",
      "Verifieringsmärke på profilen och på annonserna",
      "Import av utbud från kalkylark eller länk",
      "Panel med inkomna förfrågningar per objekt",
      "Konton för hela teamet",
    ],
    cta: { label: "Skapa mäklarbyråkonto", href: "/registro" },
    featured: true,
  },
  {
    key: "partner",
    name: "Framhävd",
    price: "Kontakta oss",
    priceNote: "Beroende på utbudets storlek och områden",
    pitch:
      "För dig som vill ha förstärkt synlighet utöver att bara vara publicerad.",
    features: [
      "Allt i planen Mäklarbyrå",
      "Framhävda annonser högre upp i ditt områdes sökresultat",
      "Plats på förstasidan och på ortssidorna",
      "Framhävd placering i katalogen över mäklarbyråer",
      "Stöd med uppläggning och optimering av annonser",
      "Rapporter över besök och förfrågningar för ditt utbud",
    ],
    cta: { label: "Prata med säljteamet", href: "/contacto" },
  },
];

const FAQ = [
  {
    q: "Är det verkligen gratis att publicera?",
    a: "Ja. Att publicera bostäder, ta emot förfrågningar och ha en offentlig profil kostar ingenting. De betalda planerna handlar bara om extra synlighet.",
  },
  {
    q: "Tar ni provision på försäljningen eller uthyrningen?",
    a: "Nej. Vi tar ingen procentandel av någon affär: vi är inte en del av förhandlingen.",
  },
  {
    q: "Kostar det något per förfrågan jag får?",
    a: "Nej. Det finns ingen kostnad per lead eller kontakt, oavsett plan.",
  },
  {
    q: "Kan jag byta plan senare?",
    a: "Ja, när som helst och utan bindningstid. Hör av dig så justerar vi det.",
  },
];

export default async function PlanesPage() {
  const origin = await siteOrigin();

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Start", url: "/" },
            { name: TITLE, url: "/planes" },
          ]),
          faqJsonLd(FAQ),
        ]}
      />

      <PageHero
        kicker="Planer"
        title="Att publicera är gratis. Det var alltid poängen."
        subtitle="Ingen provision på dina affärer och ingen kostnad per mottagen förfrågan. Vill du dessutom synas extra har vi en plan för det."
      />

      <Section>
        <div className="mk-plans">
          {PLANS.map((p) => (
            <div
              key={p.key}
              className={`mk-plan${p.featured ? " mk-plan--featured" : ""}`}
            >
              {p.featured && <div className="mk-plan__badge">Mest valda</div>}
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
          De betalda planerna faktureras i euro och har ingen minsta
          bindningstid. Hör av dig så tar vi fram ett förslag utifrån
          storleken på ditt utbud.
        </p>
      </Section>

      <Section tone="muted" width="narrow" title="Frågor om planerna">
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
        title="Osäker på vilken plan som passar dig?"
        text="Berätta hur många bostäder du hanterar och i vilka områden du jobbar."
        primary={{ label: "Prata med oss", href: "/contacto" }}
        secondary={{ label: "Se vad som ingår", href: "/para-inmobiliarias" }}
      />
    </main>
  );
}
