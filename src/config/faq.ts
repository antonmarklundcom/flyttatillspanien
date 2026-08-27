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
    title: "Sobre el portal",
    items: [
      {
        q: `¿Qué es ${brand}?`,
        a: `${brand} es un portal inmobiliario de Paraguay donde podés buscar casas, departamentos y terrenos en venta y alquiler, comparar precios por zona y contactar directamente a vendedores e inmobiliarias por WhatsApp.`,
      },
      {
        q: "¿Es gratis buscar propiedades?",
        a: "Sí, buscar y contactar es 100% gratis. No cobramos comisión al comprador ni al inquilino, y no hace falta registrarse para ver los avisos.",
      },
      {
        q: "¿Cobran comisión por la operación?",
        a: "No. Somos el lugar donde se encuentran las partes, no una inmobiliaria: no participamos de la negociación ni cobramos porcentaje sobre la venta o el alquiler. Si el aviso es de una inmobiliaria, sus honorarios los acuerda cada parte con ella.",
      },
    ],
  },
  {
    id: "comprar",
    title: "Comprar y alquilar",
    items: [
      {
        q: "¿Cómo contacto a un vendedor o inmobiliaria?",
        a: "Cada aviso tiene un formulario y un botón de WhatsApp que abre un chat directo con quien publicó, con el enlace de la propiedad ya incluido en el mensaje.",
      },
      {
        q: "¿Qué es la cuota estimada que aparece en los avisos?",
        a: "Para propiedades en venta calculamos una cuota mensual aproximada usando las condiciones de los programas de financiamiento vigentes en Paraguay. Es una referencia para saber de entrada si el número te cierra — no es una oferta de crédito ni una aprobación.",
      },
      {
        q: "¿Los precios están en guaraníes o en dólares?",
        a: "Mostramos el precio en la moneda en la que fue publicado y la conversión de referencia en la otra, porque en Paraguay se opera en ambas.",
      },
      {
        q: "¿Cómo sé si un aviso sigue disponible?",
        a: "Los avisos publicados se revisan y actualizan de forma continua, y los vencidos se despublican. Igual, lo primero que conviene preguntar por WhatsApp es si sigue disponible.",
      },
    ],
  },
  {
    id: "publicar",
    title: "Publicar y vender",
    items: [
      {
        q: "¿Cómo publico mi propiedad?",
        a: "Entrá a «Publicar propiedad», creá tu cuenta y cargá fotos, precio y ubicación. Publicar es gratis y tu aviso queda visible en las búsquedas y en Google.",
      },
      {
        q: "¿Puedo publicar como inmobiliaria o agente?",
        a: "Sí. Las inmobiliarias y agentes tienen panel propio, carga masiva de cartera, perfil público con todos sus avisos y las consultas les llegan directo. Empezá en la sección «Para inmobiliarias».",
      },
      {
        q: "¿Cuánto tarda en aparecer mi aviso?",
        a: "El aviso queda visible apenas lo publicás. La indexación en Google depende del buscador y suele tomar de unos días a un par de semanas.",
      },
      {
        q: "¿Cuánto vale mi propiedad?",
        a: "Nuestra herramienta de tasación online te da un rango estimado gratis a partir de los precios publicados en la misma zona y tipo de propiedad. Es un punto de partida para fijar el precio, no una tasación oficial.",
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
