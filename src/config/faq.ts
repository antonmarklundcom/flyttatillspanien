/**
 * FAQ content, grouped by audience. Lives here (not inline in the homepage)
 * because three surfaces need the same answers: the homepage accordion, the
 * /preguntas-frecuentes page, and the FAQPage JSON-LD both of them emit.
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
 * homepage accordion, /preguntas-frecuentes and the FAQPage JSON-LD all read
 * from the same call, so the markup can never claim an answer the page does
 * not show.
 */
export const faqSections = (brand: string): FaqSection[] => [
  {
    id: "general",
    title: "Om sidan",
    items: [
      {
        q: `Vad är ${brand}?`,
        a: `${brand} är en bostadsportal med spansk fastigheter för svenska köpare. Du kan söka villor, lägenheter och tomter till salu och uthyrning, jämföra priser per område och kontakta säljare och mäklarbyråer direkt.`,
      },
      {
        q: "Är det gratis att söka bostäder?",
        a: "Ja, att söka och kontakta är helt gratis. Vi tar ingen provision från köparen eller hyresgästen, och det krävs ingen registrering för att se objekten.",
      },
      {
        q: "Tar ni provision på affären?",
        a: "Nej. Vi är platsen där parterna hittar varandra, inte en mäklarbyrå: vi deltar inte i förhandlingen och tar ingen procentandel av köpet eller hyran. Om objektet publiceras av en mäklarbyrå avtalar du deras arvode direkt med dem.",
      },
    ],
  },
  {
    id: "comprar",
    title: "Köpa och hyra",
    items: [
      {
        q: "Hur kontaktar jag en säljare eller mäklarbyrå?",
        a: "Varje objekt har ett formulär och en kontaktknapp som öppnar en direktkonversation med den som publicerat, med länken till bostaden redan inkluderad.",
      },
      {
        q: "Vad kostar det totalt att köpa en bostad i Spanien?",
        a: "Utöver utropspriset tillkommer skatt (ITP vid andrahandsköp, IVA plus AJD vid nyproduktion), notarie, lagfart och juridisk hjälp — normalt 10–14% på toppen. Vi visar en uppskattning per comunidad på varje objekt.",
      },
      {
        q: "Visas priserna i euro eller kronor?",
        a: "Priset är alltid i euro, den enda valuta bostaden faktiskt är prissatt i. Vi visar en ungefärlig kronomräkning bredvid, tydligt märkt som en uppskattning baserad på den senaste växelkursen.",
      },
      {
        q: "Hur vet jag om ett objekt fortfarande är tillgängligt?",
        a: "Publicerade objekt granskas och uppdateras löpande, och de som gått ut avpubliceras. Ändå är det första du bör fråga om det fortfarande är tillgängligt."
      },
    ],
  },
  {
    id: "publicar",
    title: "Publicera och sälja",
    items: [
      {
        q: "Hur publicerar jag min bostad?",
        a: "Gå in på \"Publicera bostad\", skapa ditt konto och lägg till bilder, pris och läge. Att publicera är gratis och din annons blir synlig i sökningar och på Google.",
      },
      {
        q: "Kan jag publicera som mäklarbyrå eller agent?",
        a: "Ja. Mäklarbyråer och agenter har en egen panel, massimport av utbud, en offentlig profil med alla sina objekt och förfrågningar direkt till sig. Börja under \"För mäklarbyråer\".",
      },
      {
        q: "Hur lång tid tar det innan min annons syns?",
        a: "Annonsen blir synlig så snart den publicerats. Indexering i Google beror på sökmotorn och tar oftast från några dagar till ett par veckor.",
      },
      {
        q: "Vad är min bostad värd?",
        a: "Vårt värderingsverktyg online ger dig gratis ett uppskattat intervall utifrån priserna publicerade i samma område och bostadstyp. Det är en utgångspunkt för att sätta pris, inte en officiell värdering.",
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
