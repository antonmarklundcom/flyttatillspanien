import type { Metadata } from "next";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import {
  CtaBand,
  FeatureGrid,
  PageHero,
  Section,
  StepList,
} from "@/components/MarketingUI";

export const dynamic = "force-dynamic";

const TITLE = "Så fungerar det";
const DESCRIPTION = (brand: string) => `Så köper, hyr och publicerar du en bostad på ${brand}: sök per område, jämför referenspriser, se en uppskattad total köpkostnad och kontakta säljaren direkt via WhatsApp.`;

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE}`,
    description: DESCRIPTION(brand),
    alternates: { canonical: `${await siteOrigin()}/como-funciona` },
    openGraph: { title: `${TITLE} — ${brand}`, description: DESCRIPTION(brand) },
  };
}

const BUY_STEPS = [
  {
    title: "Sök på område, typ och budget",
    text: "Välj stad eller kommun och filtrera på bostadstyp, antal sovrum, boarea och prisintervall. Resultaten går även att se på kartan.",
  },
  {
    title: "Jämför med områdets prisnivå",
    text: "Innan du bestämmer dig, kolla medianpriset per kvadratmeter för orten under Priser. Det visar om objektet är dyrt, billigt eller i linje med marknaden.",
  },
  {
    title: "Se den uppskattade köpkostnaden",
    text: "På varje bostad till salu visar vi en uppskattning av vad som tillkommer utöver utropspriset — skatt (ITP eller IVA/AJD), notarie, lagfart och juridisk hjälp — så att du vet ungefär vad totalen landar på.",
  },
  {
    title: "Kontakta säljaren direkt via WhatsApp",
    text: "Skriv till den som publicerat objektet från samma sida. Meddelandet innehåller redan länken till bostaden, så det aldrig är oklart vilken det gäller.",
  },
  {
    title: "Kontrollera dokumentationen innan du betalar",
    text: "Be om lagfart (nota simple), eventuellt intyg om samfällighetsavgifter och att det inte finns obetalda kommunala skulder, och låt en notarie eller jurist granska allt innan du lämnar någon handpenning.",
  },
];

const SELL_STEPS = [
  {
    title: "Uppskatta priset",
    text: "Använd den kostnadsfria värderingen online för att få ett startintervall baserat på publicerade objekt i ditt område och av din bostadstyp.",
  },
  {
    title: "Skapa ditt konto och lägg upp annonsen",
    text: "Registrera dig med din e-postadress och fyll i uppgifterna steg för steg: bilder, plats på kartan, boarea, antal rum och pris. Tar bara några minuter.",
  },
  {
    title: "Publicera gratis",
    text: "Annonsen blir synlig i portalens sökningar och, med tiden, på Google. Ingen publiceringsavgift och ingen provision på affären.",
  },
  {
    title: "Ta emot och besvara förfrågningar",
    text: "Förfrågningarna når dig direkt, och de sparas i din panel tillsammans med hur många som besökt annonsen.",
  },
];

const RENT_TIPS = [
  {
    icon: "📄",
    title: "Vad som brukar krävas",
    text: "I Spanien är det vanligt med en deposition, en eller två månadshyror i förskott och en garant eller borgensförsäkring. Bekräfta alltid detta med hyresvärden innan du bokar.",
  },
  {
    icon: "🧾",
    title: "Vad du ska titta på i kontraktet",
    text: "Hyrestid, årlig uppräkning, vem som betalar samfällighetsavgift och drift, samt i vilket skick bostaden lämnas över och ska återlämnas. Be om en bildinventering vid tillträdet.",
  },
  {
    icon: "🏢",
    title: "Kostnader som glöms bort",
    text: "Samfällighetsavgift, moms om hyresvärden fakturerar som näringsidkare, och i lägenheter kan garage och förråd tillkomma separat.",
  },
];

export default async function ComoFuncionaPage() {
  const origin = await siteOrigin();

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Start", url: "/" },
            { name: TITLE, url: "/como-funciona" },
          ]),
        ]}
      />

      <PageHero
        kicker="Guide"
        title="Så fungerar portalen"
        subtitle="Tre vägar beroende på vad du ska göra: köpa, hyra eller publicera. Hela processen är kostnadsfri och kontakten sker alltid direkt mellan parterna."
      />

      <Section
        id="comprar"
        title="Ska du köpa"
        subtitle="Från sökning till signering, med stegen där det lönar sig att stanna upp och kontrollera."
      >
        <StepList steps={BUY_STEPS} />
      </Section>

      <Section
        id="alquilar"
        tone="muted"
        title="Ska du hyra"
        subtitle="Sökningen fungerar likadant som för köp. Det som skiljer är vad som är bra att ha klart innan du bokar."
      >
        <FeatureGrid items={RENT_TIPS} />
      </Section>

      <Section
        id="publicar"
        title="Ska du publicera"
        subtitle="För privatpersoner. Är du mäklarbyrå eller agent finns ett eget professionellt konto med massimport och offentlig profil."
      >
        <StepList steps={SELL_STEPS} />
      </Section>

      <CtaBand
        title="Börja där det passar dig"
        text="Att söka, värdera eller publicera — alla tre är gratis."
        primary={{ label: "Se bostäder", href: "/kopa/marbella" }}
        secondary={{ label: "Publicera min bostad", href: "/publicar" }}
      />
    </main>
  );
}
