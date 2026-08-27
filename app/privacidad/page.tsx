import type { Metadata } from "next";
import Link from "next/link";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { PageHero, Prose, Section } from "@/components/MarketingUI";
import { CONTACT_EMAIL } from "@/config/contact";

export const dynamic = "force-dynamic";

const TITLE = "Integritetspolicy";
const LAST_UPDATED = "augusti 2026";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE}`,
    description: `Hur ${brand} samlar in, använder och skyddar dina personuppgifter.`,
    alternates: { canonical: `${await siteOrigin()}/privacidad` },
  };
}

/**
 * Describes what the app actually does today: leads stored in MySQL and
 * forwarded to the CRM, a session cookie for logged-in publishers, viewing
 * history kept in the browser's localStorage, OpenStreetMap tiles on map
 * views. Keep this page in sync when a new data flow is added — a privacy
 * policy that describes a different product than the one shipped is worse
 * than none.
 *
 * TODO (founder, before launch): add the legal company name, org.nr and
 * registered address of the responsible entity, and confirm the text with a
 * Spanish/EU data-protection lawyer (GDPR applies as the data controller is
 * processing data of EU/Swedish residents about Spanish property).
 */
export default async function PrivacidadPage() {
  const origin = await siteOrigin();

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Start", url: "/" },
            { name: TITLE, url: "/privacidad" },
          ]),
        ]}
      />

      <PageHero
        title={TITLE}
        subtitle={`Senast uppdaterad: ${LAST_UPDATED}`}
      />

      <Section width="narrow">
        <Prose>
          <h2>1. Vilka uppgifter vi samlar in</h2>
          <p>Bara det som krävs för att portalen ska fungera:</p>
          <ul>
            <li>
              <strong>Kontaktuppgifter du lämnar</strong>: namn, e-postadress,
              telefonnummer och meddelandet du skriver när du frågar om en
              bostad, ber om en värdering eller ansöker om ett professionellt
              konto.
            </li>
            <li>
              <strong>Kontouppgifter</strong>, om du publicerar: namn, telefon,
              e-post och uppgifter om mäklarbyrån eller agenten där det gäller.
            </li>
            <li>
              <strong>Innehållet i dina annonser</strong>: bilder, plats, pris
              och beskrivning av bostäderna du publicerar.
            </li>
            <li>
              <strong>Grundläggande tekniska uppgifter</strong>: IP-adress,
              webbläsartyp och besökta sidor, i serverloggar som vi använder
              för säkerhet och felsökning.
            </li>
            <li>
              <strong>Kampanjparametrar</strong> (utm_source och liknande) när
              du kommer från en annons eller en kampanjlänk, för att veta
              vilken kanal som fungerar.
            </li>
          </ul>
          <p>
            Vi frågar inte efter och lagrar inte kortuppgifter, personnummer/
            identitetshandlingar eller annan finansiell information för att
            använda portalen.
          </p>

          <h2>2. Vad vi använder dem till</h2>
          <ul>
            <li>
              Att koppla din förfrågan till den som publicerat bostaden (ditt
              namn, din kontaktväg och ditt meddelande delas med den personen
              eller mäklarbyrån — det är själva syftet med förfrågan).
            </li>
            <li>Att besvara dina förfrågningar om värdering, publicering eller support.</li>
            <li>Att driva ditt konto och visa dina annonser.</li>
            <li>
              Att upprätthålla säkerheten på sajten och förebygga missbruk
              eller bedrägliga annonser.
            </li>
            <li>
              Att ta fram aggregerad marknadsstatistik — till exempel
              medianpriser per område — som inte identifierar någon enskild
              person.
            </li>
          </ul>
          <p>
            Vi säljer inte dina personuppgifter och lämnar inte ut dem till
            tredje part för deras marknadsföring.
          </p>

          <h2>3. Vem vi delar dem med</h2>
          <ul>
            <li>
              <strong>Den som publicerat bostaden</strong>, när du skickar en
              förfrågan om deras annons.
            </li>
            <li>
              <strong>Våra tekniska leverantörer</strong>, som behandlar
              uppgifter för vår räkning och bara för att kunna leverera
              tjänsten: leverantören av hosting och databas,
              kundhanteringssystemet (CRM) där inkomna förfrågningar
              registreras, och tjänsten som lagrar annonsernas bilder.
            </li>
            <li>
              <strong>Behöriga myndigheter</strong>, när det finns en rättslig
              skyldighet eller ett domstolsbeslut.
            </li>
          </ul>

          <h2>4. Cookies och lagring i din webbläsare</h2>
          <p>
            Vi använder en teknisk sessionscookie för att hålla dig inloggad i
            publiceringspanelen. Den är nödvändig för att sajten ska fungera
            och tas bort när du loggar ut eller när den går ut.
          </p>
          <p>
            Listan över "nyligen visade bostäder" sparas enbart i din
            webbläsares lokala lagring (localStorage): den skickas inte till
            våra servrar, och du kan rensa den genom att rensa webbplatsdata i
            din webbläsare.
          </p>
          <p>
            Kartorna på portalen laddar karttiles från OpenStreetMap. När de
            visas ansluter din webbläsare till den tjänsten, som kan
            registrera anropet enligt sin egen policy.
          </p>

          <h2>5. Hur länge vi sparar uppgifterna</h2>
          <p>
            Förfrågningar och kontouppgifter sparas så länge kontot är aktivt
            och så länge det behövs för att hantera klagomål eller uppfylla
            rättsliga skyldigheter. Därefter raderas eller anonymiseras de.
            Den aggregerade marknadsstatistiken, som inte identifierar någon
            person, sparas på obestämd tid.
          </p>

          <h2>6. Dina rättigheter</h2>
          <p>
            Du kan när som helst be oss om att få tillgång till dina
            uppgifter, rätta dem om de är felaktiga eller inaktuella, eller
            begära att de raderas och att ditt konto avslutas. Hör av dig via{" "}
            <Link href="/contacto">kontaktsidan</Link>
            {CONTACT_EMAIL ? <> eller till {CONTACT_EMAIL}</> : null}. Vi
            svarar inom de tidsfrister som gäller enligt tillämplig
            dataskyddslagstiftning, inklusive EU:s dataskyddsförordning (GDPR,
            förordning (EU) 2016/679).
          </p>
          <p>
            Tänk på att om du redan skickat en förfrågan till en mäklarbyrå
            finns de uppgifterna även hos dem: en begäran om radering i det
            fallet riktar du direkt till dem.
          </p>

          <h2>7. Säkerhet</h2>
          <p>
            Sajten levereras via krypterad anslutning (HTTPS), lösenord lagras
            krypterade och åtkomsten till databasen är begränsad. Inget system
            är felfritt: upptäcker vi en incident som påverkar dina uppgifter
            informerar vi dig via de kontaktvägar vi har.
          </p>

          <h2>8. Minderåriga</h2>
          <p>
            Portalen riktar sig till personer över 18 år. Vi samlar inte
            medvetet in uppgifter om minderåriga.
          </p>

          <h2>9. Ändringar i denna policy</h2>
          <p>
            Om vi ändrar hur vi behandlar uppgifterna uppdaterar vi den här
            sidan och datumet för senaste uppdatering.
          </p>
        </Prose>
      </Section>
    </main>
  );
}
