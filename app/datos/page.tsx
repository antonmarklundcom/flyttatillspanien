import type { Metadata } from "next";
import Link from "next/link";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { citiesWithPrices } from "@/lib/precios-queries";
import { getPortalStats } from "@/lib/directory-queries";
import {
  CtaBand,
  FeatureGrid,
  PageHero,
  Prose,
  Section,
  StatRow,
} from "@/components/MarketingUI";

export const dynamic = "force-dynamic";

const TITLE = "Data om bostadsmarknaden";
const DESCRIPTION =
  "Referenspriser per ort, en uppskattning av vad köpet kostar utöver priset och gratis värdering online: siffrorna för den spanska bostadsmarknaden, beräknade på publicerade annonser.";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE} i Spanien`,
    description: DESCRIPTION,
    alternates: { canonical: `${await siteOrigin()}/datos` },
    openGraph: { title: `${TITLE} — ${brand}`, description: DESCRIPTION },
  };
}

const TOOLS = [
  {
    icon: "📊",
    title: "Priser per ort",
    text: "Medianpris per kvadratmeter för köp och uthyrning, per ort och bostadstyp. Vi visar bara siffran när underlaget är tillräckligt stort.",
  },
  {
    icon: "💰",
    title: "Gratis värdering online",
    text: "Ett uppskattat intervall för din bostad utifrån jämförbara annonser i ditt område. Inget konto krävs, och det tar under en minut.",
  },
  {
    icon: "🏦",
    title: "Vad köpet kostar utöver priset",
    text: "De regionala skattesatserna och avgifterna, och hur ett försäljningspris blir en uppskattad totalsumma att räkna med.",
  },
];

/**
 * Market-data hub — the "Datos" tab competitors have and this portal spread
 * across three unrelated URLs. It doesn't invent a new dataset: it puts the
 * medians job, the valuation tool and the financing programs behind one
 * entry point, and states plainly how each number is produced.
 */
export default async function DatosPage() {
  const [origin, priceCities, stats] = await Promise.all([
    siteOrigin(),
    citiesWithPrices(),
    getPortalStats(),
  ]);

  const totalSample = priceCities.reduce(
    (n: number, c: { reliableSample: number }) => n + c.reliableSample,
    0,
  );

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Start", url: "/" },
            { name: "Data", url: "/datos" },
          ]),
        ]}
      />

      <PageHero
        kicker="Data"
        title="Siffrorna för den spanska bostadsmarknaden"
        subtitle="Vad kvadratmetern kostar i varje ort, vad köpet kostar utöver priset och vad du skulle kunna begära för din bostad. Allt beräknat på publicerade annonser, med underlaget synligt."
      />

      <Section>
        <StatRow
          stats={[
            {
              value: stats.listings.toLocaleString("sv-SE"),
              label: "Analyserade publicerade annonser",
            },
            {
              value: priceCities.length.toLocaleString("sv-SE"),
              label: "Orter med referenspris",
            },
            {
              value: totalSample.toLocaleString("sv-SE"),
              label: "Annonser i prisunderlaget",
            },
          ]}
        />
      </Section>

      <Section tone="muted" title="Verktyg">
        <FeatureGrid items={TOOLS} />
        <div className="mk-cta__actions" style={{ marginTop: 24 }}>
          <Link className="mk-btn mk-btn--outline" href="/precios">
            Se priser per ort
          </Link>
          <Link className="mk-btn mk-btn--outline" href="/tasacion">
            Värdera min bostad
          </Link>
        </div>
      </Section>

      {priceCities.length > 0 && (
        <Section
          title="Referenspris per ort"
          subtitle="Gå in på varje ort för att se medianen per kvadratmeter, per bostadstyp och per affärstyp."
        >
          <div className="hub-grid hub-grid--cities">
            {priceCities.map((c) => (
              <Link
                key={c.slug}
                className="hub-tile"
                href={`/precios/${c.slug}`}
              >
                <span className="hub-tile__label">{c.name}</span>
                <span className="hub-tile__count">
                  {c.reliableSample.toLocaleString("sv-SE")}
                </span>
              </Link>
            ))}
          </div>
          <p className="mk-note">
            Siffran på varje kort är underlagets storlek: hur många
            publicerade annonser medianen för orten bygger på. Ju större
            den är, desto mer tillförlitlig är siffran.
          </p>
        </Section>
      )}

      <Section tone="muted" width="narrow" title="Så räknar vi fram siffrorna">
        <Prose>
          <h2>Referenspriser</h2>
          <p>
            Vi tar de publicerade annonserna för varje ort och bostadstyp och
            räknar ut <strong>medianen</strong> för priset per kvadratmeter,
            inte medelvärdet: medianen påverkas inte lika mycket av några
            enstaka väldigt dyra eller billiga annonser. Vi visar bara
            siffran för en grupp när underlaget är tillräckligt stort;
            understiger det gränsen visar vi ingen siffra alls hellre än en
            otillförlitlig.
          </p>
          <p>
            Viktigt: det är utropspriser, inte slutpriser. Räkna med att den
            faktiska affären kan landa under det publicerade priset, så se
            siffrorna som förhandlingens tak snarare än golv.
          </p>

          <h2>Värdering</h2>
          <p>
            Den kostnadsfria värderingen online jämför din bostad med
            publicerade annonser i samma område, av samma typ och med
            liknande boarea, och ger ett intervall. Det är en utgångspunkt
            för att sätta pris, inte en officiell värdering — den görs av en
            auktoriserad värderingsman eller av långivaren.
          </p>

          <h2>Hur ofta siffrorna uppdateras</h2>
          <p>
            Medianerna räknas om regelbundet utifrån det aktiva utbudet, och
            kostnadsuppskattningarna uppdateras när priser eller
            skattesatser ändras. Varje prissida anger vilken period siffran
            gäller för.
          </p>
        </Prose>
      </Section>

      <Section width="narrow">
        <p className="mk-note">
          Är du journalist eller analytiker och vill citera de här
          siffrorna? Det går bra, med källhänvisning och länk till
          respektive sida. <Link href="/contacto">Hör av dig</Link> om du
          behöver ett specifikt utdrag ur marknadsdatan.
        </p>
      </Section>

      <CtaBand
        title="Börja med din egen bostad"
        text="Se vad den är värd i dag, utifrån publicerade annonser i ditt område."
        primary={{ label: "Värdera gratis", href: "/tasacion" }}
        secondary={{ label: "Se priser per ort", href: "/precios" }}
      />
    </main>
  );
}
