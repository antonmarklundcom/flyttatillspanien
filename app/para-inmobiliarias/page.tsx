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

const TITLE = "För mäklarbyråer och agenter";
const DESCRIPTION = (brand: string) => `Annonsera hela din objektlista på ${brand}, ta emot förfrågningar från svenska köpare och synas i mäklarkatalogen. Det är gratis att komma igång.`;

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
    title: "Din objektlista, samlad på ett ställe",
    text: "Lägg upp bostad för bostad eller importera hela objektlistan från en fil eller från länken till din annons. Inget tak på antal annonser i den kostnadsfria planen.",
  },
  {
    icon: "💬",
    title: "Förfrågningarna går direkt till dig",
    text: "Varje annons visar din kontaktväg. Vi lägger oss inte i konversationen, tar inget betalt per kontakt och säljer inte dina leads vidare till konkurrenter.",
  },
  {
    icon: "🏢",
    title: "Publik profil för din mäklarbyrå",
    text: "Din sida med logotyp, team av mäklare och alla dina aktiva annonser — en länk du kan dela och som dessutom rankar i Google.",
  },
  {
    icon: "📊",
    title: "Verklig marknadsdata",
    text: "Medianpriser per ort och per kvadratmeter, beräknade på publicerade annonser. Konkreta argument inför nästa säljpresentation.",
  },
  {
    icon: "💳",
    title: "Köpets kostnader uträknade på varje annons",
    text: "Vi visar automatiskt vad köpet kostar utöver priset — skatter, notarie och lagfart. Köparen förstår direkt om totalsumman håller för budgeten.",
  },
  {
    icon: "👥",
    title: "Konton för hela teamet",
    text: "Varje mäklare med sitt eget konto och sin publika profil, allt under mäklarbyråns konto. Du ser aktiviteten för hela kontoret.",
  },
];

const STEPS = [
  {
    title: "Skapa ditt konto",
    text: "Registrera dig med din e-post på under två minuter. Vi begär inget kort.",
  },
  {
    title: "Lägg upp din objektlista",
    text: "Publicera en och en via panelen, eller importera flera på en gång. Vi hjälper dig gärna med den första uppladdningen.",
  },
  {
    title: "Vi verifierar din mäklarbyrå",
    text: "Vi kontrollerar uppgifterna och aktiverar verifieringsmärket på din profil och alla dina annonser.",
  },
  {
    title: "Ta emot och hantera förfrågningar",
    text: "Förfrågningarna når dig via e-post och sparas i din panel, tillsammans med vilken bostad de gäller.",
  },
];

const FAQ = [
  {
    q: "Vad kostar det att annonsera som mäklarbyrå?",
    a: "Proffsplanen är gratis och inkluderar obegränsat antal annonser, publik profil och en panel med förfrågningar. De betalda planerna lägger till utvald placering i sökresultaten och fasta platser på förstasidan; du hittar dem på prissidan.",
  },
  {
    q: "Tar ni provision på mina affärer?",
    a: "Nej. Vi deltar inte i förhandlingen och tar ingen procentandel av någon försäljning eller uthyrning du sluter. Det som avtalas mellan dig och din kund är mellan er.",
  },
  {
    q: "Kan jag importera min objektlista från en annan portal eller en fil?",
    a: "Ja. Från panelen kan du importera annonser från en fil eller genom att klistra in länken till en befintlig annons, och sedan justera det som behövs innan du publicerar.",
  },
  {
    q: "Vad händer med mina leads?",
    a: "De är dina. Förfrågningarna på dina annonser går direkt till dig och sparas i din panel. Vi säljer dem inte och delar dem inte med andra mäklarbyråer.",
  },
  {
    q: "Och om jag är oberoende agent utan mäklarbyrå?",
    a: "Du kan annonsera ändå. Du får en egen agentprofil, med foto, kontaktuppgifter och dina annonser, utan att vara knuten till ett kontor.",
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
            { name: "Start", url: "/" },
            { name: TITLE, url: "/para-inmobiliarias" },
          ]),
          faqJsonLd(FAQ),
        ]}
      />

      <PageHero
        tone="dark"
        kicker="För branschfolk"
        title="Din objektlista, framför dem som letar"
        subtitle={`Annonsera alla dina bostäder på ${brand}, ta emot förfrågningarna direkt och synas i portalens mäklarkatalog. Det är gratis att komma igång och vi begär inget kort.`}
        actions={
          <>
            <Link className="mk-btn mk-btn--accent" href="/registro">
              Skapa konto gratis
            </Link>
            <Link className="mk-btn mk-btn--ghost" href="#contacto">
              Prata med oss
            </Link>
          </>
        }
      />

      {(stats.listings > 0 || stats.agencies > 0) && (
        <Section>
          <StatRow
            stats={[
              {
                value: stats.listings.toLocaleString("sv-SE"),
                label: "Publicerade bostäder",
              },
              {
                value: stats.cities.toLocaleString("sv-SE"),
                label: "Orter med aktivt utbud",
              },
              {
                value: stats.agencies.toLocaleString("sv-SE"),
                label: "Annonserande mäklarbyråer",
              },
              { value: "0 kr", label: "Kostnad per mottagen förfrågan" },
            ]}
          />
        </Section>
      )}

      <Section
        title="Det här ingår när du annonserar hos oss"
        subtitle="Allt det här ingår i den kostnadsfria planen. Inget tak på antal annonser, ingen kostnad per förfrågan."
      >
        <FeatureGrid items={BENEFITS} />
      </Section>

      <Section
        tone="muted"
        title="Så kommer du igång"
        subtitle="Från skapat konto till publicerad objektlista, oftast samma dag."
      >
        <StepList steps={STEPS} />
      </Section>

      <Section title="Frågor från mäklarbyråer" width="narrow">
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
        title="Berätta om din objektlista"
        subtitle="Lämna dina uppgifter så hör vi av oss för att aktivera ditt mäklarkonto och hjälpa dig med den första uppladdningen."
      >
        <LeadForm
          leadType="agent_signup"
          companyField
          submitLabel="Jag vill annonsera min objektlista"
          messagePlaceholder="Hur många bostäder har du publicerade i dag? I vilka områden jobbar du?"
          successTitle="Klart! Vi hör av oss snart."
          successText="Någon i teamet kontaktar dig för att aktivera ditt mäklarkonto."
        />
      </Section>

      <CtaBand
        title="Kom igång i dag, utan kostnad"
        text="Skapa ditt konto, lägg upp din första bostad och se hur många förfrågningar som kommer in."
        primary={{ label: "Skapa konto gratis", href: "/registro" }}
        secondary={{ label: "Se planer", href: "/planes" }}
      />
    </main>
  );
}
