/**
 * Site navigation — the single source of truth for the header menu, the
 * mobile drawer and the footer columns.
 *
 * Kept in one module on purpose: header and footer used to drift (the footer
 * knew about /precios and /tasacion, the header didn't), which is how pages
 * end up reachable only sideways. Anything user-facing that isn't a category
 * URL gets an entry here, or it doesn't exist as far as visitors and crawlers
 * are concerned.
 */
import { PROPERTY_TYPE_OPTIONS } from "@/lib/property-types";
import { categoryUrl, operationSlug } from "@/lib/urls";

export interface NavLink {
  label: string;
  href: string;
  /** Shown in the desktop dropdown panel only — one line of context. */
  desc?: string;
}

export interface NavGroup {
  label: string;
  /** Where the group label itself points (a real page, never "#"). */
  href: string;
  /** Empty = a plain top-level link with no dropdown. */
  links: NavLink[];
}

/**
 * Top level mirrors how a Swedish buyer already reads a property portal, so
 * nobody has to learn our vocabulary. What differs is what sits behind
 * "Marknadsdata": published medians and the acquisition-cost figures are the
 * thing this portal has and Idealista does not bother telling a foreigner.
 *
 * **Category hrefs are built through `categoryUrl()` wherever the shape allows
 * it**, because the operation segment (`/kopa`, `/hyra`, `/korttidshyra`) is
 * decided in `src/lib/urls.ts` and a hand-typed copy here is how a nav full of
 * 404s ships. The literal paths that remain are static pages, which have no
 * builder.
 *
 * Every group label links to a real page — no dead "#" parents.
 */
export const HEADER_NAV: NavGroup[] = [
  {
    label: "Köpa",
    href: `/${operationSlug("venta")}`,
    links: [
      {
        label: "Allt till salu",
        href: `/${operationSlug("venta")}`,
        desc: "Alla orter och bostadstyper",
      },
      {
        label: "Villor till salu",
        href: categoryUrl({ operation: "venta", citySlug: "marbella", type: "villa" }),
        desc: "Costa del Sol",
      },
      {
        label: "Lägenheter till salu",
        href: categoryUrl({ operation: "venta", citySlug: "torrevieja", type: "apartamento" }),
        desc: "Costa Blanca",
      },
      {
        label: "Takvåningar",
        href: categoryUrl({ operation: "venta", citySlug: "palma", type: "atico" }),
        desc: "Mallorca",
      },
      {
        label: "Tomter",
        href: categoryUrl({ operation: "venta", citySlug: "javea", type: "terreno" }),
        desc: "Bygg själv — kontrollera alltid markens klassificering",
      },
    ],
  },
  {
    label: "Hyra",
    href: `/${operationSlug("alquiler")}`,
    links: [
      {
        label: "Allt uthyres",
        href: `/${operationSlug("alquiler")}`,
        desc: "Långtidsuthyrning i hela Spanien",
      },
      {
        label: "Lägenheter att hyra",
        href: categoryUrl({ operation: "alquiler", citySlug: "malaga", type: "apartamento" }),
        desc: "Möblerat och omöblerat",
      },
      {
        label: "Villor att hyra",
        href: categoryUrl({ operation: "alquiler", citySlug: "marbella", type: "villa" }),
        desc: "Familjeboende och urbanisationer",
      },
      {
        label: "Korttidsuthyrning",
        href: `/${operationSlug("alquiler_vacacional")}`,
        desc: "Semesterboende — licensnumret står i annonsen",
      },
      {
        label: "Lokaler",
        href: categoryUrl({ operation: "alquiler", citySlug: "barcelona", type: "local" }),
        desc: "Butik och kontor",
      },
    ],
  },
  {
    label: "Nyproduktion",
    href: "/proyectos",
    links: [
      {
        label: "Alla projekt",
        href: "/proyectos",
        desc: "Under byggnation och inflyttningsklart",
      },
      {
        label: "Byggherrar",
        href: "/desarrolladoras",
        desc: "Vem som bygger varje projekt",
      },
    ],
  },
  {
    label: "Mäklare",
    href: "/inmobiliarias",
    links: [
      {
        label: "Mäklarbyråer",
        href: "/inmobiliarias",
        desc: "Katalog med aktivt bestånd",
      },
      {
        label: "Mäklare",
        href: "/agentes",
        desc: "Profiler och områden de arbetar i",
      },
      {
        label: "Byggherrar",
        href: "/desarrolladoras",
        desc: "Byggbolag och nyproduktion",
      },
      {
        label: "Annonsera ditt bestånd",
        href: "/para-inmobiliarias",
        desc: "Kostnadsfritt proffskonto",
      },
      {
        label: "Planer och priser",
        href: "/planes",
        desc: "Gratis att komma igång",
      },
    ],
  },
  {
    label: "Marknadsdata",
    href: "/datos",
    links: [
      {
        label: "Marknadsdata",
        href: "/datos",
        desc: "Alla siffror på ett ställe",
      },
      {
        label: "Priser per ort",
        href: "/precios",
        desc: "Medianpris per m² på riktiga annonser",
      },
      {
        label: "Vad är din bostad värd?",
        href: "/tasacion",
        desc: "Gratis värdering online",
      },
      {
        label: "Så fungerar det",
        href: "/como-funciona",
        desc: "Köpa, hyra och sälja steg för steg",
      },
    ],
  },
  // No dropdown: the editorial section is one destination.
  { label: "Guider", href: "/guias", links: [] },
];

/** Footer column: buying and renting entry points. */
export const FOOTER_BUY: NavLink[] = [
  { label: "Allt till salu", href: `/${operationSlug("venta")}` },
  { label: "Allt uthyres", href: `/${operationSlug("alquiler")}` },
  {
    label: "Korttidsuthyrning",
    href: `/${operationSlug("alquiler_vacacional")}`,
  },
  {
    label: "Villor till salu",
    href: categoryUrl({ operation: "venta", citySlug: "marbella", type: "villa" }),
  },
  {
    label: "Lägenheter till salu",
    href: categoryUrl({ operation: "venta", citySlug: "torrevieja", type: "apartamento" }),
  },
  { label: "Nyproduktion", href: "/proyectos" },
];

/** Footer column: the tools, i.e. the reasons to come back between searches. */
export const FOOTER_TOOLS: NavLink[] = [
  { label: "Marknadsdata", href: "/datos" },
  { label: "Priser per ort", href: "/precios" },
  { label: "Gratis värdering", href: "/tasacion" },
  { label: "Så fungerar det", href: "/como-funciona" },
  { label: "Guider och analyser", href: "/guias" },
  { label: "Vanliga frågor", href: "/preguntas-frecuentes" },
];

/** Footer column: the sell-side. This is the revenue lane — keep it visible. */
export const FOOTER_PRO: NavLink[] = [
  { label: "Annonsera en bostad", href: "/publicar" },
  { label: "För mäklare och byråer", href: "/para-inmobiliarias" },
  { label: "Planer och priser", href: "/planes" },
  { label: "Mäklarbyråer", href: "/inmobiliarias" },
  { label: "Mäklare", href: "/agentes" },
  { label: "Byggherrar", href: "/desarrolladoras" },
  { label: "Skapa konto", href: "/registro" },
  { label: "Logga in", href: "/login" },
];

/** Footer column: who we are — the "is this a real business?" answers. */
export const FOOTER_COMPANY: NavLink[] = [
  { label: "Om oss", href: "/nosotros" },
  { label: "Kontakt", href: "/contacto" },
  { label: "Villkor", href: "/terminos" },
  { label: "Integritetspolicy", href: "/privacidad" },
];

/**
 * Curated municipios — a fixed list, not a DB query (the footer is on every
 * page). Slugs must exist in `scripts/seed-locations.ts`, or these are 404s.
 */
export const FOOTER_LOCATIONS: NavLink[] = [
  { label: "Bostäder i Marbella", href: categoryUrl({ operation: "venta", citySlug: "marbella" }) },
  { label: "Bostäder i Torrevieja", href: categoryUrl({ operation: "venta", citySlug: "torrevieja" }) },
  { label: "Bostäder i Palma", href: categoryUrl({ operation: "venta", citySlug: "palma" }) },
  { label: "Bostäder i Alicante", href: categoryUrl({ operation: "venta", citySlug: "javea" }) },
  { label: "Bostäder i Málaga", href: categoryUrl({ operation: "venta", citySlug: "malaga" }) },
  { label: "Bostäder i Barcelona", href: categoryUrl({ operation: "venta", citySlug: "barcelona" }) },
];

export const FOOTER_TYPES: NavLink[] = PROPERTY_TYPE_OPTIONS.slice(0, 6).map(
  (t) => ({
    label: t.label,
    href: categoryUrl({ operation: "venta", citySlug: "marbella", type: t.value }),
  }),
);

/**
 * Static (non-category) pages that belong in the sitemap. Category, listing,
 * price and profile URLs are derived from the DB in src/lib/sitemap.ts; these
 * are the hand-authored ones, listed once so adding a page here is enough.
 */
export const STATIC_SITEMAP_PATHS: string[] = [
  "/",
  `/${operationSlug("venta")}`,
  `/${operationSlug("alquiler")}`,
  `/${operationSlug("alquiler_vacacional")}`,
  "/proyectos",
  "/desarrolladoras",
  "/inmobiliarias",
  "/agentes",
  "/datos",
  "/guias",
  "/precios",
  "/tasacion",
  "/como-funciona",
  "/preguntas-frecuentes",
  "/para-inmobiliarias",
  "/planes",
  "/nosotros",
  "/contacto",
  "/terminos",
  "/privacidad",
];
