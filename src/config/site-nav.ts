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
 * Top level mirrors how buyers in this market already read a portal — the
 * same shape as the incumbents (Venta / Alquiler / Proyectos / Empresas /
 * Datos), so nobody has to learn our vocabulary. What differs is what sits
 * behind each tab: "Datos" is a real market-data hub rather than a blog
 * category, because published medians and cuota maths are the thing this
 * portal has and they don't.
 *
 * Every group label links to a real page — no dead "#" parents.
 */
export const HEADER_NAV: NavGroup[] = [
  {
    label: "Venta",
    href: "/venta",
    links: [
      {
        label: "Todo en venta",
        href: "/venta",
        desc: "Todas las ciudades y tipos",
      },
      {
        label: "Casas en venta",
        href: "/venta/asuncion/casas",
        desc: "Asunción y área metropolitana",
      },
      {
        label: "Departamentos en venta",
        href: "/venta/asuncion/departamentos",
        desc: "Desde monoambientes a penthouses",
      },
      {
        label: "Terrenos",
        href: "/venta/asuncion/terrenos",
        desc: "Lotes y loteamientos",
      },
      {
        label: "Dúplex",
        href: "/venta/asuncion/duplex",
        desc: "Dúplex y townhouses",
      },
    ],
  },
  {
    label: "Alquiler",
    href: "/alquiler",
    links: [
      {
        label: "Todo en alquiler",
        href: "/alquiler",
        desc: "Todas las ciudades y tipos",
      },
      {
        label: "Departamentos en alquiler",
        href: "/alquiler/asuncion/departamentos",
        desc: "Amoblados y sin amoblar",
      },
      {
        label: "Casas en alquiler",
        href: "/alquiler/asuncion/casas",
        desc: "Familiares y barrios cerrados",
      },
      {
        label: "Oficinas",
        href: "/alquiler/asuncion/oficinas",
        desc: "Espacios corporativos",
      },
      {
        label: "Locales comerciales",
        href: "/alquiler/asuncion/comerciales",
        desc: "Sobre avenida y en shopping",
      },
    ],
  },
  {
    label: "Proyectos",
    href: "/proyectos",
    links: [
      {
        label: "Todos los proyectos",
        href: "/proyectos",
        desc: "Edificios, condominios y loteamientos",
      },
      {
        label: "Desarrolladoras",
        href: "/desarrolladoras",
        desc: "Quién construye cada proyecto",
      },
      {
        label: "Departamentos en pozo",
        href: "/venta/asuncion/departamentos",
        desc: "Preventa con plan de pagos",
      },
    ],
  },
  {
    label: "Empresas",
    href: "/inmobiliarias",
    links: [
      {
        label: "Inmobiliarias",
        href: "/inmobiliarias",
        desc: "Directorio con cartera activa",
      },
      {
        label: "Agentes",
        href: "/agentes",
        desc: "Perfiles y zonas donde trabajan",
      },
      {
        label: "Desarrolladoras",
        href: "/desarrolladoras",
        desc: "Constructoras y obra nueva",
      },
      {
        label: "Publicá tu cartera",
        href: "/para-inmobiliarias",
        desc: "Cuenta profesional gratuita",
      },
      {
        label: "Planes y precios",
        href: "/planes",
        desc: "Gratis para empezar",
      },
    ],
  },
  {
    label: "Datos",
    href: "/datos",
    links: [
      {
        label: "Datos del mercado",
        href: "/datos",
        desc: "Todos los números en un lugar",
      },
      {
        label: "Precios por ciudad",
        href: "/precios",
        desc: "Medianas de m² del mercado real",
      },
      {
        label: "¿Cuánto vale tu propiedad?",
        href: "/tasacion",
        desc: "Tasación online gratis",
      },
      {
        label: "Financiamiento y cuotas",
        href: "/financiamiento",
        // Che Róga Porã is off by default (scripts/seed-financing.ts), so the
        // nav must not advertise a programme no listing currently quotes.
        desc: "AFD, bancos y cuota estimada",
      },
      {
        label: "Cómo funciona",
        href: "/como-funciona",
        desc: "Comprar, alquilar y vender paso a paso",
      },
    ],
  },
  // No dropdown: the editorial section is one destination, the same way the
  // incumbents' "Noticias" is a plain tab.
  { label: "Guías", href: "/guias", links: [] },
];

/** Footer column: buying and renting entry points. */
export const FOOTER_BUY: NavLink[] = [
  { label: "Todo en venta", href: "/venta" },
  { label: "Todo en alquiler", href: "/alquiler" },
  { label: "Casas en venta", href: "/venta/asuncion/casas" },
  { label: "Departamentos en venta", href: "/venta/asuncion/departamentos" },
  { label: "Terrenos", href: "/venta/asuncion/terrenos" },
  { label: "Proyectos nuevos", href: "/proyectos" },
];

/** Footer column: the tools, i.e. the reasons to come back between searches. */
export const FOOTER_TOOLS: NavLink[] = [
  { label: "Datos del mercado", href: "/datos" },
  { label: "Precios por ciudad", href: "/precios" },
  { label: "Tasación gratis", href: "/tasacion" },
  { label: "Financiamiento y cuotas", href: "/financiamiento" },
  { label: "Cómo funciona", href: "/como-funciona" },
  { label: "Guías y notas", href: "/guias" },
  { label: "Preguntas frecuentes", href: "/preguntas-frecuentes" },
];

/** Footer column: the sell-side. This is the revenue lane — keep it visible. */
export const FOOTER_PRO: NavLink[] = [
  { label: "Publicar una propiedad", href: "/publicar" },
  { label: "Para inmobiliarias y agentes", href: "/para-inmobiliarias" },
  { label: "Planes y precios", href: "/planes" },
  { label: "Inmobiliarias", href: "/inmobiliarias" },
  { label: "Agentes", href: "/agentes" },
  { label: "Desarrolladoras", href: "/desarrolladoras" },
  { label: "Crear cuenta", href: "/registro" },
  { label: "Ingresar", href: "/login" },
];

/** Footer column: who we are — the "is this a real business?" answers. */
export const FOOTER_COMPANY: NavLink[] = [
  { label: "Sobre nosotros", href: "/nosotros" },
  { label: "Contacto", href: "/contacto" },
  { label: "Términos y condiciones", href: "/terminos" },
  { label: "Política de privacidad", href: "/privacidad" },
];

/** Curated cities — a fixed list, not a DB query (the footer is on every page). */
export const FOOTER_LOCATIONS: NavLink[] = [
  { label: "Propiedades en Asunción", href: categoryUrl({ operation: "venta", citySlug: "asuncion" }) },
  { label: "Propiedades en Luque", href: categoryUrl({ operation: "venta", citySlug: "luque" }) },
  { label: "Propiedades en San Lorenzo", href: categoryUrl({ operation: "venta", citySlug: "san-lorenzo" }) },
  { label: "Propiedades en Lambaré", href: categoryUrl({ operation: "venta", citySlug: "lambare" }) },
  { label: "Propiedades en Ciudad del Este", href: categoryUrl({ operation: "venta", citySlug: "ciudad-del-este" }) },
  { label: "Propiedades en Encarnación", href: categoryUrl({ operation: "venta", citySlug: "encarnacion" }) },
];

export const FOOTER_TYPES: NavLink[] = PROPERTY_TYPE_OPTIONS.slice(0, 6).map(
  (t) => ({
    label: t.label,
    href: categoryUrl({ operation: "venta", citySlug: "asuncion", type: t.value }),
  }),
);

/**
 * Static (non-category) pages that belong in the sitemap. Category, listing,
 * price and profile URLs are derived from the DB in src/lib/sitemap.ts; these
 * are the hand-authored ones, listed once so adding a page here is enough.
 */
export const STATIC_SITEMAP_PATHS: string[] = [
  "/",
  "/venta",
  "/alquiler",
  "/alquiler-temporal",
  "/proyectos",
  "/desarrolladoras",
  "/inmobiliarias",
  "/agentes",
  "/datos",
  "/guias",
  "/precios",
  "/tasacion",
  "/financiamiento",
  "/como-funciona",
  "/preguntas-frecuentes",
  "/para-inmobiliarias",
  "/planes",
  "/nosotros",
  "/contacto",
  "/terminos",
  "/privacidad",
];
