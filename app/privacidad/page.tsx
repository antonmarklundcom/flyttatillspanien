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
const LAST_UPDATED = "juli 2026";

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
 * TODO (founder, before launch): add the legal company name,
 * organisationsnummer and registered address of the responsible entity, and
 * confirm the text against GDPR with a lawyer.
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
          <p>Bara det som behövs för att portalen ska fungera:</p>
          <ul>
            <li>
              <strong>Kontaktuppgifter du lämnar</strong>: namn, telefonnummer,
              e-postadress och det meddelande du skriver när du frågar om en
              bostad, ber om en värdering eller ansöker om ett
              professionellt konto.
            </li>
            <li>
              <strong>Kontouppgifter</strong>, om du annonserar: namn, telefon,
              e-post, och uppgifter om mäklarbyrån eller agenten där det är
              relevant.
            </li>
            <li>
              <strong>Innehållet i dina annonser</strong>: bilder, plats,
              pris och beskrivning av de bostäder du publicerar.
            </li>
            <li>
              <strong>Grundläggande tekniska uppgifter</strong>: IP-adress,
              webbläsartyp och besökta sidor, i serverloggar vi använder för
              säkerhet och felsökning.
            </li>
            <li>
              <strong>Kampanjparametrar</strong> (utm_source och liknande)
              när du kommer från en annons eller en kampanjlänk, för att veta
              vilken kanal som fungerar.
            </li>
          </ul>
          <p>
            Vi begär eller lagrar inga kortuppgifter, personnummer eller
            finansiell information för att du ska kunna använda portalen.
          </p>

          <h2>2. Vad vi använder uppgifterna till</h2>
          <ul>
            <li>
              Koppla din förfrågan till den som publicerat bostaden (ditt
              namn, din kontaktväg och ditt meddelande delas med den
              personen eller mäklarbyrån: det är själva syftet med
              förfrågan).
            </li>
            <li>Besvara förfrågningar om värdering, annonsering eller support.</li>
            <li>Sköta ditt konto och visa dina annonser.</li>
            <li>
              Hålla webbplatsen säker och förebygga missbruk eller bedrägliga
              annonser.
            </li>
            <li>
              Ta fram sammanställd marknadsstatistik — till exempel
              medianpriser per område — som inte identifierar någon
              enskild person.
            </li>
          </ul>
          <p>
            Vi säljer inte dina personuppgifter och lämnar inte ut dem till
            tredje part för deras marknadsföring.
          </p>

          <h2>3. Vem vi delar uppgifterna med</h2>
          <ul>
            <li>
              <strong>Med den som publicerat bostaden</strong>, när du skickar
              en förfrågan om deras annons.
            </li>
            <li>
              <strong>Med våra teknikleverantörer</strong>, som behandlar
              uppgifter för vår räkning och bara för att leverera tjänsten:
              leverantören av hosting och databas, systemet för
              kundhantering (CRM) där inkomna förfrågningar registreras, och
              lagringstjänsten för annonsernas bilder.
            </li>
            <li>
              <strong>Med behöriga myndigheter</strong>, när det finns en
              rättslig skyldighet eller ett domstolsbeslut.
            </li>
          </ul>

          <h2>4. Cookies och lagring i din webbläsare</h2>
          <p>
            Vi använder en teknisk sessionscookie för att hålla dig inloggad
            i annonseringspanelen. Den är nödvändig för att sajten ska
            fungera och tas bort när du loggar ut eller när sessionen går
            ut.
          </p>
          <p>
            Listan över &quot;nyligen visade bostäder&quot; sparas enbart i
            din webbläsares lokala lagring (localStorage): den skickas inte
            till våra servrar och du kan rensa den genom att rensa
            webbplatsens data i din webbläsare.
          </p>
          <p>
            Portalens kartor laddar karttiles från OpenStreetMap. När de
            visas kopplar din webbläsare upp mot den tjänsten, som kan
            registrera anropet enligt sin egen policy.
          </p>

          <h2>5. Hur länge vi sparar uppgifterna</h2>
          <p>
            Förfrågningar och kontouppgifter sparas så länge kontot är
            aktivt och den tid som behövs för att hantera ärenden eller
            uppfylla rättsliga skyldigheter. Därefter raderas eller
            anonymiseras de. Den sammanställda marknadsstatistiken, som inte
            identifierar någon person, sparas tills vidare.
          </p>

          <h2>6. Dina rättigheter</h2>
          <p>
            Du kan när som helst begära att få tillgång till dina
            uppgifter, rätta dem om de är föråldrade eller felaktiga, eller
            begära att de raderas och att ditt konto avslutas. Hör av dig
            via <Link href="/contacto">kontaktsidan</Link>
            {CONTACT_EMAIL ? <> eller till {CONTACT_EMAIL}</> : null}. Vi
            svarar inom de tidsramar som gäller enligt EU:s
            dataskyddsförordning (GDPR).
          </p>
          <p>
            Tänk på att om du redan skickat en förfrågan till en mäklarbyrå
            finns dina uppgifter också kvar hos dem: den raderingen begär du
            direkt hos dem.
          </p>

          <h2>7. Säkerhet</h2>
          <p>
            Sajten levereras över en krypterad anslutning (HTTPS), lösenord
            lagras krypterade och åtkomsten till databasen är begränsad.
            Inget system är ofelbart: upptäcker vi en incident som påverkar
            dina uppgifter meddelar vi dig via de kontaktvägar vi har.
          </p>

          <h2>8. Minderåriga</h2>
          <p>
            Portalen riktar sig till personer över 18 år. Vi samlar
            medvetet inte in uppgifter om minderåriga.
          </p>

          <h2>9. Ändringar i denna policy</h2>
          <p>
            Om vi ändrar hur vi hanterar uppgifter uppdaterar vi den här
            sidan och dess datum för senaste uppdatering.
          </p>
        </Prose>
      </Section>
    </main>
  );
}
