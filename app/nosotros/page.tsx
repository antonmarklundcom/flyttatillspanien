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
const DESCRIPTION = (brand: string) => `${brand} är bostadsportalen med spanska fastigheter för svenska köpare: att söka är gratis, att publicera också, och varje objekt visar referenspris för området och total köpkostnad.`;

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
    text: "En portal ska inte bara vara en anslagstavla. Vi publicerar medianpriser per ort och m², total köpkostnad för varje bostad till salu och gratis värdering online, så att den som söker kan jämföra, inte bara titta.",
  },
  {
    icon: "🤝",
    title: "Direktkontakt, utan mellanhand",
    text: "Förfrågningar går direkt från den som söker till den som publicerar. Vi tar ingen avgift per lead, säljer inte vidare kontakter och lägger oss inte i förhandlingen.",
  },
  {
    icon: "🇸🇪",
    title: "Gjort för svenska köpare",
    text: "Priser i euro med ungefärlig kronomräkning, riktiga områden, juridiken tydligt redovisad och på svenska — inte en utländsk portal med Google Translate.",
  },
  {
    icon: "📐",
    title: "Siffror som går att granska",
    text: "Våra uppskattningar bygger på publicerade objekt och offentliga skattesatser, och vi anger alltid vilket underlag de bygger på. Är underlaget svagt säger vi det, hellre än att hitta på.",
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
            { name: "Start", url: "/" },
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
        title="Att söka bostad i Spanien borde vara transparent"
        subtitle={`${brand} föddes ur en konkret frustration: att söka hus i Spanien som svensk köpare innebär spanska sajter, otydlig juridik och ingen aning om vad det egentligen kostar utöver utropspriset. Vi byggde portalen vi själva hade velat använda.`}
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
                label: "Områden med utbud",
              },
              {
                value: stats.agencies.toLocaleString("sv-SE"),
                label: "Mäklarbyråer som publicerar",
              },
              {
                value: stats.projects.toLocaleString("sv-SE"),
                label: "Projekt under uppförande",
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
            Vi föredrar att säga det direkt, eftersom det avgör hur allt annat
            fungerar. Att söka är gratis för den som söker och att publicera är
            gratis för den som säljer eller hyr ut, mäklarbyråer inräknat. Vi
            tar ingen provision på affärerna och ingen avgift per mottagen
            förfrågan.
          </p>
          <p>
            Våra intäkter kommer från den utökade synlighet som vissa
            mäklarbyråer och byggherrar köper — utvalda objekt, placeringar på
            förstasidan och på ortssidorna. Det betyder att ett objekt kan
            hamna högre upp för att utgivaren betalat för utökad synlighet, och
            det märks alltid tydligt när det gör det. Det som aldrig ändras för
            att någon betalar är priset, ytan eller någon annan uppgift om
            bostaden.
          </p>
          <h2>Vad vi inte gör</h2>
          <p>
            Vi är ingen mäklarbyrå och företräder ingen av parterna. Vi deltar
            inte i förhandlingar, blandar oss inte i handpenningar eller avtal
            och kontrollerar inte självständigt äganderätten till varje
            publicerad bostad. Innan någon betalning eller signering, kontrollera
            dokumentationen med en notarie eller jurist.
          </p>
          <h2>Var uppgifterna kommer ifrån</h2>
          <p>
            Objekten läggs upp av sina ägare, mäklarbyråer och agenter via
            portalens panel. Medianpriserna beräknas på de publicerade objekten
            per ort och bostadstyp, och vi publicerar bara siffran när urvalet
            når en rimlig miniminivå. Den uppskattade köpkostnaden bygger på
            offentliga skattesatser per comunidad och är vägledande: den
            faktiska kostnaden beror på notarie, gestoría och din egen
            situation.
          </p>
        </Prose>
      </Section>

      <CtaBand
        title="Vill du publicera din bostad?"
        text="Lägg upp den på några minuter och nå de som söker i ditt område."
        primary={{ label: "Publicera gratis", href: "/publicar" }}
        secondary={{ label: "Kontakta oss", href: "/contacto" }}
      />
    </main>
  );
}
