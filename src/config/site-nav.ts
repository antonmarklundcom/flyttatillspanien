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
import { categoryUrl } from "@/lib/urls";

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
 * Every group label links to a real page — no dead "#" parents. "Data" is a
 * real market-data hub rather than a blog category, because published
 * medians and the acquisition-cost estimate are the thing this portal has.
 */
export const HEADER_NAV: NavGroup[] = [
  {
    label: "Köpa",
    href: "/kopa",
    links: [
      {
        label: "Allt till salu",
        href: "/kopa",
        desc: "Alla orter och typer",
      },
      {
        label: "Villor till salu",
        href: "/kopa/marbella/villor",
        desc: "Costa del Sol och omnejd",
      },
      {
        label: "Lägenheter till salu",
        href: "/kopa/marbella/lagenheter",
        desc: "Från studios till takvåningar",
      },
      {
        label: "Tomter",
        href: "/kopa/marbella/tomter",
        desc: "Byggklara och lantegendomar",
      },
      {
        label: "Radhus och etagelägenheter",
        href: "/kopa/marbella/radhus",
        desc: "Radhus och etagelägenheter",
      },
    ],
  },
  {
    label: "Hyra",
    href: "/hyra",
    links: [
      {
        label: "All uthyrning",
        href: "/hyra",
        desc: "Alla orter och typer",
      },
      {
        label: "Lägenheter att hyra",
        href: "/hyra/marbella/lagenheter",
        desc: "Möblerade och omöblerade",
      },
      {
        label: "Villor att hyra",
        href: "/hyra/marbella/villor",
        desc: "Långtidsuthyrning",
      },
      {
        label: "Korttidshyra",
        href: "/korttidshyra/marbella",
        desc: "Semesterboende",
      },
    ],
  },
  {
    label: "Projekt",
    href: "/proyectos",
    links: [
      {
        label: "Alla projekt",
        href: "/proyectos",
        desc: "Nybyggnadsprojekt i hela Spanien",
      },
      {
        label: "Byggherrar",
        href: "/desarrolladoras",
        desc: "Vem bygger varje projekt",
      },
      {
        label: "Lägenheter på ritning",
        href: "/kopa/marbella/lagenheter",
        desc: "Förhandsbokning med betalplan",
      },
    ],
  },
  {
    label: "Företag",
    href: "/inmobiliarias",
    links: [
      {
        label: "Mäklarbyråer",
        href: "/inmobiliarias",
        desc: "Katalog med aktivt utbud",
      },
      {
        label: "Agenter",
        href: "/agentes",
        desc: "Profiler och områden de arbetar i",
      },
      {
        label: "Byggherrar",
        href: "/desarrolladoras",
        desc: "Byggföretag och nyproduktion",
      },
      {
        label: "Publicera ditt utbud",
        href: "/para-inmobiliarias",
        desc: "Gratis proffskonto",
      },
      {
        label: "Planer och priser",
        href: "/planes",
        desc: "Gratis att komma igång",
      },
    ],
  },
  {
    label: "Data",
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
        desc: "Medianpris per m² från den verkliga marknaden",
      },
      {
        label: "Vad är din bostad värd?",
        href: "/tasacion",
        desc: "Gratis värdering online",
      },
      {
        label: "Vad kostar det att köpa?",
        href: "/datos",
        desc: "Skatt, notarie och lagfart per comunidad",
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
  { label: "Allt till salu", href: "/kopa" },
  { label: "All uthyrning", href: "/hyra" },
  { label: "Villor till salu", href: "/kopa/marbella/villor" },
  { label: "Lägenheter till salu", href: "/kopa/marbella/lagenheter" },
  { label: "Tomter", href: "/kopa/marbella/tomter" },
  { label: "Nya projekt", href: "/proyectos" },
];

/** Footer column: the tools, i.e. the reasons to come back between searches. */
export const FOOTER_TOOLS: NavLink[] = [
  { label: "Marknadsdata", href: "/datos" },
  { label: "Priser per ort", href: "/precios" },
  { label: "Gratis värdering", href: "/tasacion" },
  { label: "Så fungerar det", href: "/como-funciona" },
  { label: "Guider och notiser", href: "/guias" },
  { label: "Vanliga frågor", href: "/preguntas-frecuentes" },
];

/** Footer column: the sell-side. This is the revenue lane — keep it visible. */
export const FOOTER_PRO: NavLink[] = [
  { label: "Publicera en bostad", href: "/publicar" },
  { label: "För mäklarbyråer och agenter", href: "/para-inmobiliarias" },
  { label: "Planer och priser", href: "/planes" },
  { label: "Mäklarbyråer", href: "/inmobiliarias" },
  { label: "Agenter", href: "/agentes" },
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

/** Curated municipios — a fixed list, not a DB query (the footer is on every page). */
export const FOOTER_LOCATIONS: NavLink[] = [
  { label: "Bostäder i Marbella", href: categoryUrl({ operation: "venta", citySlug: "marbella" }) },
  { label: "Bostäder i Estepona", href: categoryUrl({ operation: "venta", citySlug: "estepona" }) },
  { label: "Bostäder i Torrevieja", href: categoryUrl({ operation: "venta", citySlug: "torrevieja" }) },
  { label: "Bostäder i Palma", href: categoryUrl({ operation: "venta", citySlug: "palma" }) },
  { label: "Bostäder i Málaga", href: categoryUrl({ operation: "venta", citySlug: "malaga" }) },
  { label: "Bostäder i Madrid", href: categoryUrl({ operation: "venta", citySlug: "madrid" }) },
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
  "/kopa",
  "/hyra",
  "/korttidshyra",
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
