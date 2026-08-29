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
const DESCRIPTION = (brand: string) => `Så här köper, hyr och annonserar du en bostad på ${brand}: sök efter område, jämför referenspriser, se vad köpet kostar utöver priset och ta kontakt direkt.`;

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
    title: "Sök efter område, typ och budget",
    text: "Välj ort eller område och filtrera på bostadstyp, antal sovrum, boarea och prisintervall. Resultaten går även att se på kartan.",
  },
  {
    title: "Jämför med områdets prisnivå",
    text: "Innan du bestämmer dig, titta på medianpriset per kvadratmeter för orten på prissidan. Det visar om annonsen ligger högt, lågt eller i linje med marknaden.",
  },
  {
    title: "Se vad köpet kostar utöver priset",
    text: "På varje bostad till salu visar vi en uppskattning av skatter, notarie, lagfart och juristarvode, så att du vet vad totalsumman blir redan från start.",
  },
  {
    title: "Ta kontakt direkt",
    text: "Skriv till den som annonserar direkt från annonssidan. Meddelandet går iväg med länken till bostaden, så det aldrig är oklart vilken det gäller.",
  },
  {
    title: "Kontrollera dokumentationen innan du betalar",
    text: "Be om lagfart (nota simple), energideklaration och uppgift om eventuella skulder på fastigheten, och låt en jurist eller notarie i Spanien granska allt innan någon handpenning betalas.",
  },
];

const SELL_STEPS = [
  {
    title: "Uppskatta priset",
    text: "Använd den kostnadsfria värderingen online för att få ett startintervall baserat på publicerade annonser i ditt område och för din bostadstyp.",
  },
  {
    title: "Skapa ditt konto och lägg upp annonsen",
    text: "Registrera dig med din e-post och fyll i uppgifterna steg för steg: bilder, plats på kartan, boarea, rum och pris. Tar bara några minuter.",
  },
  {
    title: "Annonsera gratis",
    text: "Annonsen blir synlig i portalens sökresultat och, med tiden, i Google. Ingen kostnad för att annonsera och ingen provision på affären.",
  },
  {
    title: "Ta emot och besvara förfrågningar",
    text: "Förfrågningarna når din e-post och sparas i din panel, tillsammans med hur många som besökt varje annons.",
  },
];

const RENT_TIPS = [
  {
    icon: "📄",
    title: "Vad som brukar krävas",
    text: "I Spanien är det vanligt med en deposition, en eller två månadshyror i förskott och ibland en borgensman eller kautionsförsäkring. Bekräfta villkoren med hyresvärden innan du bokar.",
  },
  {
    icon: "🧾",
    title: "Vad du bör läsa i kontraktet",
    text: "Hyrestid, årlig uppräkning, vem som betalar samfällighetsavgift och drift, och i vilket skick bostaden lämnas och ska återlämnas. Be om en inventarielista med bilder vid tillträdet.",
  },
  {
    icon: "🏢",
    title: "Kostnader som glöms bort",
    text: "Samfällighetsavgiften, moms om uthyraren fakturerar som näringsidkare, och i lägenheter kan parkering och förråd kosta extra.",
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
        subtitle="Tre vägar beroende på vad du är här för: köpa, hyra eller annonsera. Hela processen är gratis och kontakten sker alltid direkt mellan parterna."
      />

      <Section
        id="comprar"
        title="Ska du köpa"
        subtitle="Från sökning till underskrift, med stegen där det är värt att stanna upp och kontrollera."
      >
        <StepList steps={BUY_STEPS} />
      </Section>

      <Section
        id="alquilar"
        tone="muted"
        title="Ska du hyra"
        subtitle="Sökningen fungerar likadant som vid köp. Det som skiljer är vad som är bra att ha klart innan du bokar."
      >
        <FeatureGrid items={RENT_TIPS} />
      </Section>

      <Section
        id="publicar"
        title="Ska du annonsera"
        subtitle="För privatpersoner. Är du mäklarbyrå eller agent har du ett proffskonto med massimport och publik profil."
      >
        <StepList steps={SELL_STEPS} />
      </Section>

      <CtaBand
        title="Börja där det passar dig"
        text="Söka, värdera eller annonsera — alla tre är gratis."
        primary={{ label: "Se bostäder", href: "/kopa" }}
        secondary={{ label: "Annonsera min bostad", href: "/publicar" }}
      />
    </main>
  );
}
