import type { Metadata } from "next";
import Link from "next/link";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { citiesWithPrices } from "@/lib/precios-queries";
import {
  getPortalStats,
  listAcquisitionCosts,
} from "@/lib/directory-queries";
import {
  CtaBand,
  FeatureGrid,
  PageHero,
  Prose,
  Section,
  StatRow,
} from "@/components/MarketingUI";

export const dynamic = "force-dynamic";

const TITLE = "Marknadsdata för bostäder i Spanien";
const DESCRIPTION =
  "Referenspriser per ort, uppskattad total köpkostnad och gratis värdering online — siffrorna från den spanska bostadsmarknaden, beräknade på publicerade objekt.";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: `${await siteOrigin()}/datos` },
    openGraph: { title: `${TITLE} — ${brand}`, description: DESCRIPTION },
  };
}

const TOOLS = [
  {
    icon: "📊",
    title: "Priser per ort",
    text: "Medianpris per m² för köp och uthyrning, per ort och bostadstyp. Vi visar bara en siffra när urvalet är tillräckligt stort.",
  },
  {
    icon: "💰",
    title: "Gratis värdering online",
    text: "Ett uppskattat intervall för din bostad utifrån jämförbara objekt i ditt område. Utan registrering, på under en minut.",
  },
  {
    icon: "📄",
    title: "Total köpkostnad",
    text: "Skatt, notarie, lagfart och juridisk hjälp per comunidad — vad det verkligen kostar att köpa utöver utropspriset.",
  },
];

/**
 * Market-data hub — puts the medians job, the valuation tool and the
 * acquisition-cost estimate behind one entry point, and states plainly how
 * each number is produced.
 */
export default async function DatosPage() {
  const [origin, priceCities, costs, stats] = await Promise.all([
    siteOrigin(),
    citiesWithPrices(),
    listAcquisitionCosts(),
    getPortalStats(),
  ]);

  const totalSample = priceCities.reduce((n, c) => n + c.reliableSample, 0);
  const lowestItp = costs.length
    ? costs.reduce((min, c) => (Number(c.itpPct) < Number(min.itpPct) ? c : min))
    : null;

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
        title="Siffrorna från den spanska bostadsmarknaden"
        subtitle="Vad kostar kvadratmetern i varje område, vad kostar det totalt att köpa, och vad skulle du kunna begära för din bostad. Allt beräknat på publicerade objekt, med urvalet synligt."
      />

      <Section>
        <StatRow
          stats={[
            {
              value: stats.listings.toLocaleString("sv-SE"),
              label: "Analyserade publicerade objekt",
            },
            {
              value: priceCities.length.toLocaleString("sv-SE"),
              label: "Orter med referenspris",
            },
            {
              value: totalSample.toLocaleString("sv-SE"),
              label: "Objekt i prisunderlaget",
            },
            {
              value: lowestItp
                ? `${Number(lowestItp.itpPct).toLocaleString("sv-SE", {
                    maximumFractionDigits: 2,
                  })}%`
                : "—",
              label: "Lägsta överlåtelseskatt (ITP)",
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
          subtitle="Gå in på varje ort för att se medianen per m², per bostadstyp och affär."
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
            Talet på varje kort är urvalets storlek: hur många publicerade
            objekt medianen för den orten bygger på. Ju högre, desto mer
            tillförlitlig siffra.
          </p>
        </Section>
      )}

      <Section tone="muted" width="narrow" title="Så räknar vi fram siffrorna">
        <Prose>
          <h2>Referenspriser</h2>
          <p>
            Vi tar de publicerade objekten per ort och bostadstyp och räknar
            fram <strong>medianen</strong> av priset per m², inte
            medelvärdet: medianen påverkas inte av några enstaka väldigt dyra
            eller väldigt billiga objekt. Vi visar bara siffran för en grupp
            som har ett tillräckligt stort urval; annars visas ingen siffra
            alls hellre än en opålitlig.
          </p>
          <p>
            Viktigt: det är <em>utropspriser</em>, inte slutpriser. Räkna med
            att det slutliga priset kan avvika, i endera riktningen, beroende
            på förhandling och marknadsläge.
          </p>

          <h2>Total köpkostnad</h2>
          <p>
            Vi beräknar den uppskattade totala köpkostnaden per comunidad
            autónoma utifrån offentliga skattesatser (ITP vid andrahandsköp,
            IVA plus AJD vid nyproduktion) plus uppskattade avgifter för
            notarie, lagfart och juridisk hjälp. Se{" "}
            <Link href="/bostad">respektive objekt</Link> för beräkningen på
            just det priset.
          </p>
          <p>
            Uppskattningen ersätter inte rådgivning från en jurist eller
            gestoría inför ett köp, och siffrorna är märkta som preliminära
            tills de är verifierade mot varje comunidads publicerade skala.
          </p>

          <h2>Värdering</h2>
          <p>
            Värderingen online jämför din bostad med publicerade objekt i
            samma område, typ och storleksintervall, och ger dig ett
            intervall. Det är en utgångspunkt för att sätta pris, inte en
            officiell värdering — den görs av en auktoriserad värderare eller
            av den bank som ger lånet.
          </p>

          <h2>Hur ofta uppdateras det</h2>
          <p>
            Medianerna räknas om periodiskt utifrån det aktuella utbudet.
            Varje prissida anger perioden siffrorna avser.
          </p>
        </Prose>
      </Section>

      <Section width="narrow">
        <p className="mk-note">
          Är du journalist eller analytiker och vill citera dessa siffror? Det
          går bra, med källhänvisning och länk till motsvarande sida.{" "}
          <Link href="/contacto">Skriv till oss</Link> om du behöver ett
          specifikt utdrag ur marknaden.
        </p>
      </Section>

      <CtaBand
        title="Börja med din bostad"
        text="Se vad den är värd idag, enligt objekten publicerade i ditt område."
        primary={{ label: "Värdera gratis", href: "/tasacion" }}
        secondary={{ label: "Se priser per ort", href: "/precios" }}
      />
    </main>
  );
}
