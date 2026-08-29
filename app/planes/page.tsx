import type { Metadata } from "next";
import Link from "next/link";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { CtaBand, PageHero, Section } from "@/components/MarketingUI";

export const dynamic = "force-dynamic";

const TITLE = "Priser och planer";
const DESCRIPTION = (brand: string) => `Att annonsera på ${brand} är gratis, med obegränsat antal annonser och ingen provision på dina affärer. De betalda planerna lägger till utvald placering i sökresultaten och på förstasidan.`;

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
    name: "Privatperson",
    price: "Gratis",
    priceNote: "För dig som säljer eller hyr ut din egen bostad",
    pitch: "Annonsera din villa, lägenhet eller tomt utan kostnad eller provision.",
    features: [
      "Annonsering av dina bostäder",
      "Bilder, plats på kartan och fullständig beskrivning",
      "Förfrågningar direkt till din e-post",
      "Uppskattning av köpets tillkommande kostnader visas automatiskt",
      "Annons som indexeras av Google",
    ],
    cta: { label: "Annonsera gratis", href: "/publicar" },
  },
  {
    key: "destacado",
    name: "Mäklarbyrå",
    price: "Gratis",
    priceNote: "Proffsplan, kostnadsfri under lanseringen",
    pitch:
      "För mäklarbyråer och agenter som annonserar sin objektlista löpande.",
    features: [
      "Allt i planen Privatperson, med obegränsat antal annonser",
      "Publik profil för mäklarbyrån och varje mäklare",
      "Verifieringsmärke på profilen och i annonserna",
      "Import av objektlistan från fil eller länk",
      "Panel med förfrågningar per bostad",
      "Konton för hela teamet",
    ],
    cta: { label: "Skapa mäklarkonto", href: "/registro" },
    featured: true,
  },
  {
    key: "partner",
    name: "Utvald placering",
    price: "Enligt överenskommelse",
    priceNote: "Utifrån objektlistans storlek och områden",
    pitch:
      "För dig som vill ha prioriterad synlighet utöver att synas i sökresultaten.",
    features: [
      "Allt i planen Mäklarbyrå",
      "Utvalda annonser högre upp i sökresultaten för dina områden",
      "Plats på förstasidan och på ortssidorna",
      "Framträdande plats i mäklarbyrå-katalogen",
      "Stöd vid publicering och optimering av annonser",
      "Rapporter över besök och förfrågningar för din objektlista",
    ],
    cta: { label: "Prata med försäljning", href: "/contacto" },
  },
];

const FAQ = [
  {
    q: "Är det verkligen gratis att annonsera?",
    a: "Ja. Att annonsera bostäder, ta emot förfrågningar och ha en publik profil kostar inget. De betalda planerna gäller bara prioriterad synlighet.",
  },
  {
    q: "Tar ni provision på försäljningen eller uthyrningen?",
    a: "Nej. Vi tar ingen procentandel av någon affär: vi är inte en del av förhandlingen.",
  },
  {
    q: "Tar ni betalt för varje förfrågan jag får?",
    a: "Nej. Det finns ingen kostnad per lead eller kontakt, i någon plan.",
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
        kicker="Priser"
        title="Att annonsera är gratis. Det var alltid poängen."
        subtitle="Ingen provision på dina affärer och ingen kostnad per mottagen förfrågan. Vill du dessutom synas mer har vi en plan för det."
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
          Betalda planer faktureras i euro och har ingen bindningstid.
          Skriv till oss så tar vi fram ett förslag utifrån storleken på din
          objektlista.
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
