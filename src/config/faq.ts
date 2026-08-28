/**
 * FAQ content, grouped by audience. Lives here (not inline in the homepage)
 * because three surfaces need the same answers: the homepage accordion, the
 * FAQ page, and the FAQPage JSON-LD both of them emit.
 * Duplicated answers with drifting wording are a rich-result liability.
 */

export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqSection {
  id: string;
  title: string;
  items: FaqItem[];
}

/**
 * Brand-parameterised because the wordmark differs per host (src/lib/brand.ts)
 * and these answers name it. Server components pass the resolved brand; the
 * homepage accordion, the FAQ page and the FAQPage JSON-LD all read from the
 * same call, so the markup can never claim an answer the page does not show.
 *
 * These answers are the site's promises in plain Swedish. Two of them carry
 * the whole editorial premise — that the portal names the Spanish legal and
 * tax facts a Swedish buyer has no vocabulary for — so they say what the site
 * does and does not verify, rather than what it would be nicer to imply.
 */
export const faqSections = (brand: string): FaqSection[] => [
  {
    id: "general",
    title: "Om portalen",
    items: [
      {
        q: `Vad är ${brand}?`,
        a: `${brand} är en bostadsportal för svenskar som vill köpa eller hyra i Spanien. Här söker du bland villor, lägenheter och tomter, ser priset i euro med ett ungefärligt kronbelopp, får en uppskattning av vad köpet kostar utöver priset och tar kontakt direkt med säljaren eller mäklaren.`,
      },
      {
        q: "Kostar det något att söka?",
        a: "Nej, att söka och ta kontakt är helt gratis. Vi tar ingen provision från köparen eller hyresgästen, och du behöver inget konto för att se annonserna.",
      },
      {
        q: "Tar ni provision på affären?",
        a: "Nej. Vi är platsen där parterna hittar varandra, inte en mäklare: vi deltar inte i förhandlingen och tar ingen andel av köpeskillingen eller hyran. Är annonsen en mäklarbyrås kommer du överens om deras arvode direkt med dem.",
      },
    ],
  },
  {
    id: "kopa",
    title: "Köpa och hyra",
    items: [
      {
        q: "Hur kontaktar jag en säljare eller mäklare?",
        a: "Varje annons har ett formulär som går direkt till den som lagt upp bostaden, med länken till objektet redan i meddelandet. Vi mellanlandar inte i konversationen.",
      },
      {
        q: "Vad kostar ett bostadsköp i Spanien utöver priset?",
        a: "Räkna med ungefär 10–14 % ovanpå utropspriset: överlåtelseskatt (ITP) på en begagnad bostad, eller moms och stämpelskatt (IVA + AJD) på nyproduktion, plus notarie, fastighetsregister och juridiskt ombud. Skattesatsen sätts av regionen och skiljer sig från 6 % till 10 % beroende på var i Spanien bostaden ligger, så varje annons visar en uppskattning för just sin region. Det är en uppskattning, inte en offert.",
      },
      {
        q: "Varför står priset i euro?",
        a: "Bostaden säljs i euro, så det är priset. Kronbeloppet vi visar bredvid är en omräkning med Europeiska centralbankens dagliga referenskurs, avrundad så att det syns att den är ungefärlig. Är kursen äldre än en vecka visar vi inget kronbelopp alls — hellre ingen siffra än en gammal.",
      },
      {
        q: "Vad betyder de juridiska uppgifterna i annonsen?",
        a: "En del av spanska bostäder saknar inflyttningstillstånd (licencia de primera ocupación) eller ligger på mark där man inte får bygga bostad. Vi visar därför vad säljaren uppger om bostadens juridiska status och om inteckningar — och separat om vi själva har sett en nota simple från fastighetsregistret. De två raderna är inte samma sak, och vi slår aldrig ihop dem. Låt alltid ett eget ombud kontrollera saken innan du betalar handpenning.",
      },
      {
        q: "Hur vet jag att en annons fortfarande är aktuell?",
        a: "Publicerade annonser granskas och uppdateras löpande, och de som försvunnit från källan pausas automatiskt. Men det första du bör fråga är ändå om bostaden fortfarande är ledig.",
      },
    ],
  },
  {
    id: "annonsera",
    title: "Annonsera och sälja",
    items: [
      {
        q: "Hur annonserar jag min bostad?",
        a: "Gå till ”Annonsera bostad”, skapa ett konto och fyll i bilder, pris och läge. Det är gratis, och vi granskar annonsen innan den publiceras.",
      },
      {
        q: "Kan jag annonsera som mäklarbyrå eller mäklare?",
        a: "Ja. Byråer och mäklare får en egen panel, kan importera hela beståndet från ett kalkylblad, får en publik profil med alla sina annonser och tar emot förfrågningarna direkt. Börja under ”För mäklare”.",
      },
      {
        q: "Varför måste jag ange energiklass?",
        a: "Spansk lag (RD 390/2021) kräver att energiklassen står i själva annonsen när en bostad bjuds ut till försäljning eller uthyrning. Har du sökt certifikat men inte fått det ännu väljer du ”Under handläggning”; vissa byggnader är undantagna. Utan ett svar går annonsen inte att publicera.",
      },
      {
        q: "Vad är min bostad värd?",
        a: "Vårt värderingsverktyg ger dig ett uppskattat intervall gratis, utifrån publicerade priser för samma bostadstyp i samma område. Det är en utgångspunkt för att sätta pris, inte en officiell värdering.",
      },
    ],
  },
];

/** Flattened — for JSON-LD and for the homepage's shorter accordion. */
export const faqAll = (brand: string): FaqItem[] =>
  faqSections(brand).flatMap((s) => s.items);

/** The six highest-intent questions, for the homepage. */
export const faqHome = (brand: string): FaqItem[] => {
  const s = faqSections(brand);
  return [
    s[0].items[0],
    s[0].items[1],
    s[2].items[0],
    s[1].items[0],
    s[1].items[1],
    s[2].items[1],
  ];
};
