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

const TITLE = "Om oss";
const DESCRIPTION = (brand: string) => `${brand} är bostadsportalen för svenskar som vill köpa eller hyra i Spanien: att söka är gratis, att annonsera är gratis, och varje annons visar referenspris för området och vad köpet kostar utöver priset.`;

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
    title: "Fakta före annonser",
    text: "En portal ska inte bara vara en anslagstavla. Vi visar referenspriser per område och per kvadratmeter, en uppskattning av vad köpet kostar utöver priset på varje bostad till salu och energiklass och juridisk status på varje objekt — så att du kan jämföra, inte bara titta.",
  },
  {
    icon: "🤝",
    title: "Direktkontakt, ingen mellanhand",
    text: "Din förfrågan går direkt till den som annonserar — mäklarbyrå, privatperson eller relocation-partner. Vi tar inte betalt per lead, säljer inga kontaktuppgifter och lägger oss inte i förhandlingen.",
  },
  {
    icon: "🇪🇸",
    title: "Byggt för att köpa i Spanien, från Sverige",
    text: "Pris i euro med en ungefärlig kronsumma bredvid, spanska bostadstyper förklarade på svenska, och de avgifter — överlåtelseskatt, moms, stämpelskatt, notarie, lagfart — som ingen svensk bostadsaffär förberett dig på.",
  },
  {
    icon: "📐",
    title: "Siffror du kan granska",
    text: "Våra uppskattningar bygger på publicerade annonser och på de regionala skattesatser vi lagt in för varje spansk region, och vi säger alltid vad de bygger på. Är underlaget svagt visar vi hellre ingenting än en gissning.",
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
        kicker="Vilka vi är"
        title="Att leta bostad i Spanien borde vara begripligt"
        subtitle={`${brand} föddes ur en konkret frustration: som svensk köpare möter du spanska avgifter och juridiska begrepp du inte vuxit upp med, utan att något ställe förklarar vad du faktiskt betalar för. Vi byggde portalen vi själva hade velat använda.`}
      />

      {stats.listings > 0 && (
        <Section>
          <StatRow
            stats={[
              {
                value: stats.listings.toLocaleString("sv-SE"),
                label: "Publicerade bostäder",
              },
              {
                value: stats.cities.toLocaleString("sv-SE"),
                label: "Orter med utbud",
              },
              {
                value: stats.agencies.toLocaleString("sv-SE"),
                label: "Annonserande mäklarbyråer",
              },
              {
                value: stats.projects.toLocaleString("sv-SE"),
                label: "Projekt under utveckling",
              },
            ]}
          />
        </Section>
      )}

      <Section title="Vad vi tror på" tone="muted">
        <FeatureGrid items={PRINCIPLES} columns={2} />
      </Section>

      <Section title="Hur vi tjänar pengar" width="narrow">
        <Prose>
          <p>
            Vi säger det direkt, eftersom det avgör hur allt annat fungerar.
            Att söka är gratis för dig som köpare, och att annonsera är gratis
            för den som säljer eller hyr ut — mäklarbyråer inkluderade. Vi tar
            ingen provision på affärer och inget för mottagna förfrågningar.
          </p>
          <p>
            Våra intäkter kommer från den prioriterade synlighet som vissa
            mäklarbyråer och byggherrar köper till — utvalda annonser,
            placeringar på förstasidan och på ortssidorna. Det betyder att en
            annons kan hamna högre upp för att annonsören betalat för det, och
            då syns det tydligt. Det som aldrig ändras för pengar är priset,
            ytan eller någon annan uppgift om bostaden.
          </p>
          <h2>Vad vi inte gör</h2>
          <p>
            Vi är ingen mäklarbyrå och representerar ingen av parterna. Vi
            deltar inte i förhandlingar, hanterar inga handpenningar eller
            kontrakt, och kontrollerar inte självständigt äganderätten till
            varje objekt. Kontrollera alltid dokumentationen med en spansk
            jurist eller notarie innan du betalar eller skriver under något.
          </p>
          <h2>Var uppgifterna kommer ifrån</h2>
          <p>
            Annonserna läggs in av ägare, mäklarbyråer och agenter via
            portalens panel. Referenspriserna beräknas på de publicerade
            annonserna för varje ort och bostadstyp, och vi visar bara siffran
            när underlaget är tillräckligt stort. Uppskattningen av vad ett
            köp kostar utöver priset bygger på de regionala skattesatser vi
            lagt in för varje spansk region — orienterande, inte en exakt
            offert.
          </p>
        </Prose>
      </Section>

      <CtaBand
        title="Vill du annonsera din bostad?"
        text="Lägg upp den på några minuter och nå svenska köpare som letar i ditt område."
        primary={{ label: "Annonsera gratis", href: "/publicar" }}
        secondary={{ label: "Kontakta oss", href: "/contacto" }}
      />
    </main>
  );
}
