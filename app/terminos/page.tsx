import type { Metadata } from "next";
import Link from "next/link";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { PageHero, Prose, Section } from "@/components/MarketingUI";

export const dynamic = "force-dynamic";

const TITLE = "Användarvillkor";
const LAST_UPDATED = "juli 2026";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE}`,
    description: `Villkor för att använda portalen ${brand}.`,
    alternates: { canonical: `${await siteOrigin()}/terminos` },
    robots: { index: true, follow: true },
  };
}

/**
 * Baseline terms covering how the portal actually behaves: intermediation
 * disclaimer, user-generated listing content, the estimative nature of the
 * median/valuation/acquisition-cost figures, and takedown.
 *
 * TODO (founder, before launch): replace the operator paragraph with the real
 * company name and organisationsnummer once the company is constituted, and
 * have a lawyer review this text — it is a reasonable starting point, not
 * legal advice.
 */
export default async function TerminosPage() {
  const brand = await brandName();
  const origin = await siteOrigin();

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Start", url: "/" },
            { name: TITLE, url: "/terminos" },
          ]),
        ]}
      />

      <PageHero
        title={TITLE}
        subtitle={`Senast uppdaterad: ${LAST_UPDATED}`}
      />

      <Section width="narrow">
        <Prose>
          <h2>1. Vilka vi är och vad tjänsten är</h2>
          <p>
            {brand} är en bostadsportal som förmedlar kontakt mellan personer
            som säljer eller hyr ut bostäder i Spanien och personer i Sverige
            som söker en bostad där. Vi är ingen mäklarbyrå, vi är inga
            fastighetsmäklare och vi representerar ingen av parterna. Vi
            deltar inte i förhandlingen, i handpenningen, i betalningen eller
            i undertecknandet av något avtal.
          </p>

          <h2>2. Godkännande</h2>
          <p>
            Genom att använda webbplatsen godkänner du dessa villkor. Om du
            inte accepterar dem ska du inte använda portalen. Vi kan
            uppdatera villkoren; det som gäller är alltid den version som är
            publicerad på den här sidan, med sitt uppdateringsdatum.
          </p>

          <h2>3. Att använda portalen</h2>
          <p>
            Att söka bostäder och kontakta den som annonserar är gratis och
            kräver inget konto. För att annonsera en bostad krävs ett konto.
            Du ansvarar för att uppgifterna på ditt konto stämmer och för
            aktiviteten som sker från det, inklusive att skydda dina
            inloggningsuppgifter.
          </p>
          <p>Det är förbjudet att bland annat:</p>
          <ul>
            <li>
              annonsera bostäder du inte har rätt att erbjuda eller
              ägarens tillstånd att publicera;
            </li>
            <li>
              publicera falsk, vilseledande eller duplicerad information,
              eller bilder som inte motsvarar den annonserade bostaden;
            </li>
            <li>
              publicera diskriminerande, kränkande innehåll eller innehåll
              som strider mot gällande lag;
            </li>
            <li>
              samla in data från sajten automatiserat (scraping), sälja
              vidare den eller använda den för att massutskicka kontakt till
              andra användare;
            </li>
            <li>
              försöka kringgå sajtens säkerhet eller störa dess funktion.
            </li>
          </ul>

          <h2>4. Innehåll som användare publicerar</h2>
          <p>
            Annonser, bilder, priser och beskrivningar läggs in av
            användarna själva — ägare, mäklarbyråer, agenter och byggherrar.
            De ansvarar ensamma för innehållet, för att det stämmer och för
            att de har rätt att använda de bilder de laddar upp. Genom att
            publicera ger du oss en icke-exklusiv, kostnadsfri licens att
            visa, ändra storlek på och sprida innehållet inom portalen och i
            marknadsföringen av portalen.
          </p>
          <p>
            Vi kontrollerar inte självständigt äganderätten till bostäderna,
            att priserna stämmer eller villkoren i de erbjudanden som
            publiceras. Vi kan moderera, ändra formatet på, avpublicera eller
            ta bort annonser som bryter mot dessa villkor, är föråldrade
            eller är dubbletter, utan att det ger rätt till ersättning.
          </p>

          <h2>5. Uppskattningar, referenspriser och kostnadsberäkningar</h2>
          <p>
            Portalen publicerar uppskattade värden: medianpriser per område,
            en ungefärlig kronsumma vid sidan av eurobeloppet, och en
            uppskattning av vad ett köp kostar utöver priset (skatter,
            notarie, lagfart och juristarvode). Dessa beräknas automatiskt
            utifrån publicerade annonser och de regionala skattesatser vi
            har lagt in.
          </p>
          <p>
            Siffrorna är vägledande. De utgör ingen officiell värdering,
            inget lånelöfte, ingen investeringsrekommendation och ingen
            finansiell rådgivning, och kan avvika betydligt från de
            verkliga kostnaderna i en specifik affär. Vi beviljar inga lån
            och förmedlar inga lån.
          </p>

          <h2>6. Ansvar</h2>
          <p>
            Portalen tillhandahålls i befintligt skick. Vi gör en rimlig
            ansträngning för att hålla den tillgänglig och uppdaterad, men vi
            garanterar varken att tjänsten är kontinuerligt tillgänglig eller
            felfri. I den utsträckning lagen tillåter ansvarar vi inte för
            skador som uppstår ur affärer som ingåtts mellan användare, ur
            information som publicerats av tredje part eller ur beslut som
            fattats utifrån portalens uppskattningar.
          </p>
          <p>
            Innan du betalar eller skriver under några dokument bör du låta
            en jurist eller notarie i Spanien kontrollera bostadens
            dokumentation och motpartens identitet.
          </p>

          <h2>7. Immateriella rättigheter</h2>
          <p>
            Namnet, logotypen, designen, programvaran och det innehåll
            portalen tagit fram — inklusive rapporterna om referenspriser —
            tillhör oss och får inte återges utan tillstånd, förutom citat
            med källhänvisning och länk till källan.
          </p>

          <h2>8. Planer och betalning</h2>
          <p>
            Att annonsera bostäder är gratis. Tjänster för prioriterad
            synlighet är valfria och tecknas separat, med de villkor,
            löptid och pris som anges vid avtalstillfället. Vi tar ingen
            provision på affärer som sluts mellan parterna.
          </p>

          <h2>9. Anmälan och borttagning av innehåll</h2>
          <p>
            Om en annons kränker dina rättigheter, innehåller falska
            uppgifter eller använder dina bilder utan tillstånd, hör av dig
            via <Link href="/contacto">kontaktsidan</Link> med länk till
            annonsen och vad det gäller. Vi granskar anmälningar och tar
            bort innehåll när det är befogat.
          </p>

          <h2>10. Tillämplig lag</h2>
          <p>
            Dessa villkor för användning av portalen styrs av svensk lag.
            En eventuell tvist om själva fastighetsköpet i Spanien regleras
            i stället av spansk rätt och avtalet mellan köpare och säljare.
          </p>
        </Prose>
      </Section>
    </main>
  );
}
