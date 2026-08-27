/**
 * English dictionary (Batch 3, layer 2).
 *
 * The audience is not "the Spanish site, in English". Per PLAN.md D6 the
 * English door is `realestateinparaguay.com`, pitched at **foreign buyers and
 * investors** — someone who has never been to Asunción, does not know what a
 * *quinta* or *entrega inmediata* is, and cannot be assumed to know that a
 * foreigner may own property in Paraguay outright. So this is a translation of
 * intent, not of sentences: the same key can carry different emphasis here.
 *
 * Three rules it follows:
 *
 * 1. **Nothing is invented.** Where the Spanish copy states a fact about the
 *    product (free to publish, no commission, medians computed from asking
 *    prices), the English says the same fact. Where it names a number, the
 *    number comes from the same place.
 * 2. **Local nouns are explained, not dropped.** *Barrio* stays as
 *    "neighbourhood", *cuota* becomes "estimated monthly payment", *en pozo*
 *    becomes "pre-construction" — the terms a foreign buyer's own market uses.
 * 3. **No brand is baked in.** Copy that names the site takes `brand` as an
 *    argument, exactly as the Spanish does, because the domain is the brand
 *    and each door carries its own name.
 *
 * This file is inert until a host declares `locale: "en"` in `verticals.ts` —
 * both live hosts are `"es"` today, and the flip is a whole checklist (D6),
 * never a one-line change. What it does buy immediately is that `Dictionary`
 * has two implementations, so a key added to one and forgotten in the other
 * is a type error rather than a blank string on a live page.
 */

export const en = {
  searchPlaceholder: "Where do you want to live?",
  publishCta: "List for free",
  contactWhatsapp: "Contact on WhatsApp",
  priceAlert: "Alert me if the price drops",
  wizardNext: "Next →",
  wizardPrev: "Back",
  valuationMagnet: "What is your property worth? Find out free",
  emptyState:
    "No properties here yet — set up an alert and we will let you know",
  rentalsHero: "Your next place is waiting.",
  foreignToggle: "Show your property to the world",
  foreignToggleDetail:
    "🌎 Your property will also be shown to overseas buyers on our English site — at no extra cost.",
  inquiryPrefill: "Hi, I am interested in this property.",
  quickQuestions: ["Still available?", "Can I visit?", "What is required?"],
} as const;

export const enSearchBar = {
  operationLabel: "I want to",
  operationBuy: "Buy",
  operationRent: "Rent",
  cityLabel: "City",
  cityAny: "All cities",
  typeLabel: "Type",
  typeAny: "All types",
  budgetLabel: "Budget",
  budgetAny: "No limit",
  /** Locale-aware on purpose: the thousands separator is not universal. */
  budgetUpTo: (amount: number, locale: string) =>
    `Up to US$ ${amount.toLocaleString(locale)}`,
  submit: "Search",
} as const;

/** Category page filter bar — a plain GET form, no client JS. */
export const enFilters = {
  priceMinLabel: "Min. price (US$)",
  priceMinPlaceholder: "No minimum",
  priceMaxLabel: "Max. price (US$)",
  priceMaxPlaceholder: "No maximum",
  bedroomsLabel: "Bedrooms",
  bedroomsAny: "Any",
  sortLabel: "Sort by",
  sortRecent: "Most recent",
  sortPriceAsc: "Lowest price",
  sortPriceDesc: "Highest price",
  submit: "Filter",
  clear: "Clear filters",
} as const;

/** Listing card — the grid tile. */
export const enCard = {
  operationBadge: {
    venta: "For sale",
    alquiler: "For rent",
    alquiler_temporal: "Short-term rental",
  } as Record<string, string>,
  featured: "Featured",
  noPhoto: "Photo coming soon",
  bedroomsShort: (n: number) => `${n} bed`,
  bathrooms: (n: number) => `${n} ${n === 1 ? "bath" : "baths"}`,
  area: (m2: number) => `${m2} m²`,
} as const;

/** Home page. */
export const enHome = {
  metaDescription:
    "Houses, apartments and land for sale and rent across Paraguay, with estimated monthly payments and financing.",
  publishWaPrefill: (brand: string) =>
    `Hi, I would like to list a property on ${brand}.`,

  heroKicker: "Asunción · Paraguay",
  heroTitleLead: "Find your property in ",
  heroTitleHighlight: "Paraguay",
  heroSubtitle:
    "Houses, apartments and land for sale and rent — with estimated monthly payments and financing.",
  heroSeeListings: "Browse properties",
  heroSellCta: "Sell my property",
  heroStatCount: (total: string) => `${total} properties listed`,
  heroStatCountEmpty: "Properties across Paraguay",
  heroStatUpdated: "Updated daily",

  zonesKicker: "Areas",
  zonesTitle: "Where do you want to live",
  zonesAll: "See all areas →",
  /**
   * The one translatable half of a zone card. Name, slug and photograph are
   * structural and stay in `app/page.tsx`; the strapline is copy, so it lives
   * here keyed by slug. Written for someone who has never been: each line says
   * what the area *is*, not only what it is called.
   */
  zoneCardSub: {
    asuncion: "The capital — the widest choice",
    "san-bernardino": "Lake Ypacaraí, weekend houses",
    luque: "A growing area next to the capital",
    encarnacion: "On the Paraná river, high quality of life",
  } as Record<string, string>,

  howTitle: "How it works",
  howSubtitle: "Search, compare and contact. Free, no sign-up, no commission.",
  howMore: "Read the full guide →",
  howSteps: [
    {
      icon: "🔎",
      title: "Search by area and budget",
      text: "Filter by city, neighbourhood, property type and price range. See the results as a list or on the map.",
    },
    {
      icon: "📊",
      title: "Compare against the market",
      text: "Every property for sale shows its estimated monthly payment, and we publish the median price per m² for each city.",
    },
    {
      icon: "💬",
      title: "Contact directly",
      text: "Message whoever listed the property on WhatsApp, straight from the listing — no middleman, no fee.",
    },
  ],

  sellKicker: "Selling",
  sellTitle: "Sell with people who know the market",
  sellText:
    "List your property for free and reach buyers across Paraguay. We give you an estimated price range built from the listings published in your area, so you know where you stand before you decide.",
  sellImageAlt: "Interior of a house in Paraguay",
  sellValuationCta: "Request a valuation",
  sellPublishCta: "List a property →",

  investKicker: "Investing",
  investTitle: "Invest in Paraguay on data, not on hunches",
  investText:
    "We publish the median price per m² for each city, calculated from the listings on the portal, and the estimated monthly payment on every property for sale under the financing programmes currently available.",
  investImageAlt: "Asunción at sunset",
  investPricesCta: "See prices by area",
  investFinancingCta: "How financing works →",

  projectsTitle: "🏗 New developments in Paraguay",
  projectsSubtitle:
    "Verified new-build — apartments pre-construction, under construction and ready to move in.",

  citiesTitle: "Browse by city",

  rowMore: "See all →",
  rowRecommended: "Recommended properties",
  rowHousesForSale: "Houses for sale — Asunción and around",
  rowFlatsForSale: "Apartments for sale — Asunción",
  rowRentals: "Rentals in Asunción",
  rowLand: "Land",

  developersTitle: "Featured developers",
  developersSubtitle: "See who builds the country's developments.",
  developerProjectCount: (n: number) =>
    `${n} ${n === 1 ? "development" : "developments"}`,

  pricesTitle: "📊 Reference prices by city",
  pricesMore: "See all →",
  pricesSubtitle:
    "Median price per m², calculated from published listings. So you can tell whether a listing is in line with its area before you negotiate.",
  pricesSample: (n: string) => `${n} listings analysed`,

  values: [
    {
      icon: "✅",
      title: "Direct contact",
      text: "You speak to the seller or the agency directly, with no middleman.",
    },
    {
      icon: "💳",
      title: "Estimated monthly payment",
      text: "Every property for sale shows its monthly payment under current financing.",
    },
    {
      icon: "🇵🇾",
      title: "Built for Paraguay",
      text: "Prices in guaraníes and dollars, real neighbourhoods, and WhatsApp first.",
    },
  ],

  discoverTitle: (brand: string) => `Discover more on ${brand}`,
  discoverCards: [
    {
      icon: "🏡",
      title: "List your property for free",
      text: "Add photos, price and location in minutes. No commission, no listing fee.",
      cta: "List now",
      href: "/publicar",
    },
    {
      icon: "💰",
      title: en.valuationMagnet,
      text: "We give you an estimated range from the prices published in the area. Free, and no sign-up.",
      cta: "Calculate free",
      href: "/tasacion",
    },
    {
      icon: "📊",
      title: "Market prices",
      text: "Median price per m² in each city, calculated from the portal's published listings.",
      cta: "See prices",
      href: "/precios",
    },
    {
      icon: "🏦",
      title: "Financing and monthly payments",
      text: "Which programmes exist in Paraguay, what they ask for, and how we estimate each listing's monthly payment.",
      cta: "Read the guide",
      href: "/financiamiento",
    },
  ],

  proKicker: "For agencies and agents",
  proTitle: "Do you sell property every day?",
  proText:
    "List your whole portfolio, show your agency with a verified profile, and get enquiries straight to your WhatsApp. No fee per listing, no fee per lead, and no commission on your deals.",
  proBullets: [
    "✓ Unlimited listings on the free plan",
    "✓ A public profile for the agency and for each agent",
    "✓ Portfolio import from a spreadsheet or a link",
    "✓ A dashboard with the enquiries on every property",
  ],
  proMore: "Learn more",
  proPlans: "See plans →",
  proAgencyCardTitle: "Agency directory",
  proAgencyCardText: "See who already lists their portfolio on the portal.",
  proProjectsCardTitle: "Developers and developments",
  proProjectsCardText: "New-build, pre-construction and ready to move in.",

  ctaTitle: "List your property for free",
  ctaText:
    "Reach thousands of buyers and tenants across Paraguay. Simple, fast and free.",
  ctaButton: "List now",
  ctaWhatsapp: "or message us on WhatsApp",

  newsletterTitle: "Property opportunities, once a week",
  newsletterText:
    "Curated properties, market signals and news from the sector — in your inbox. No spam, unsubscribe whenever you like.",

  faqTitle: "Frequently asked questions",
  faqSubtitle: (brand: string) => `Everything you need to know about ${brand}.`,
  faqMore: "See all questions →",
} as const;

/** National operation hubs: /venta, /alquiler, /alquiler-temporal. */
export const enHub = {
  copy: {
    venta: {
      h1: "Property for sale in Paraguay",
      lead: "Houses, apartments, land and commercial units for sale across the country. Every listing shows its estimated monthly payment, so you know from the start whether the number works for you.",
      label: "For sale",
      cityLabel: "Buy in",
    },
    alquiler: {
      h1: "Property for rent in Paraguay",
      lead: "Apartments, houses, offices and commercial units for rent across the country. Contact the owner or the agency directly — the portal takes no commission.",
      label: "For rent",
      cityLabel: "Rent in",
    },
    alquiler_temporal: {
      h1: "Short-term rentals in Paraguay",
      lead: "Short stays and seasonal rentals across the country.",
      label: "Short-term rental",
      cityLabel: "Short-term rentals in",
    },
  } as Record<
    string,
    { h1: string; lead: string; label: string; cityLabel: string }
  >,
  breadcrumbHome: "Home",
  count: (total: string) => `${total} properties listed`,
  byTypeTitle: "By property type",
  byTypeSubtitle: (opLabel: string) =>
    `Choose what you are looking for. The totals are listings published today under ${opLabel}.`,
  byCityTitle: "By city",
  byCitySubtitle:
    "Every city with active inventory, ordered by number of listings.",
  latestTitle: "Latest listings",
  latestNoteLead: "Looking in one particular area? Go to",
  latestNoteTail: "and filter by neighbourhood, price and bedrooms.",
  emptyBody: (opLabel: string) =>
    `There are no properties listed under ${opLabel} yet.`,
  emptyCta: "List the first one",
  ctaTitleSale: "Selling a property?",
  ctaTitleRent: "Have a property to rent out?",
  ctaText: "List it free and reach the people searching in your area.",
  ctaPrimary: "List for free",
  ctaSecondary: "What is it worth?",
} as const;

/** Category grid: /[operacion]/[...segments]. */
export const enCategory = {
  operationLabel: {
    venta: "for sale",
    alquiler: "for rent",
    alquiler_temporal: "for short-term rent",
  } as Record<string, string>,
  typeLabel: {
    casa: "Houses",
    departamento: "Apartments",
    terreno: "Land",
    duplex: "Duplexes",
    comercial: "Commercial units",
    oficina: "Offices",
    deposito: "Warehouses",
    quinta: "Country houses",
  } as Record<string, string>,
  typeLabelAny: "Properties",
  /**
   * "Houses for sale in Villa Morra, Asunción".
   *
   * English puts the operation between the type and the place, where Spanish
   * repeats "en" — which is why this is a function per locale and not a
   * template assembled at the call site.
   */
  title: (typeLabel: string, opLabel: string, where: string) =>
    `${typeLabel} ${opLabel} in ${where}`,
  titlePaged: (title: string, page: number) => `${title} — page ${page}`,
  metaNotFound: "Not found",
  metaDescription: (count: number, title: string, brand: string) =>
    `${count} ${title.toLowerCase()} on ${brand}. Find your next property with estimated monthly payments and financing.`,
  breadcrumbHome: "Home",
  count: (n: number) =>
    `${n} ${n === 1 ? "property" : "properties"} available.`,
  emptyTypeNotice: (typeLabel: string, opLabel: string, city: string) =>
    `There are no ${typeLabel.toLowerCase()} ${opLabel} in ${city} right now. Here is everything available in ${city}.`,
  viewSwitchLabel: "View",
  viewList: "List",
  viewMap: "Map",
  filterEmpty: "No properties match these filters.",
  filterEmptyClear: "Clear filters",
  paginationLabel: "Pagination",
  paginationPrev: "← Previous",
  paginationNext: "Next →",
  paginationStatus: (page: number, total: number) => `Page ${page} of ${total}`,
} as const;

/** Property detail: /propiedad/[slug]. */
export const enListing = {
  metaNotFound: "Property not found",
  metaTitle: (title: string, price: string) => `${title} — ${price}`,
  ogTitle: (title: string, brand: string) => `${title} — ${brand}`,
  stateLabel: {
    entrega_inmediata: "Ready to move in",
    en_construccion: "Under construction",
    en_pozo: "Pre-construction",
    usado: "Resale",
  } as Record<string, string>,
  breadcrumbHome: "Home",
  breadcrumbLabel: "Breadcrumb",

  galleryEmpty: "Photos coming soon",
  galleryThumbAlt: (title: string, n: number) => `${title} — photo ${n}`,
  galleryMore: (n: number) => `+${n} photos`,

  factBedrooms: (n: number) => `${n} bed`,
  factBathrooms: (n: number) => `${n} ${n === 1 ? "bath" : "baths"}`,
  factParking: (n: number) => `${n} parking spaces`,
  factArea: (m2: number) => `${m2} m²`,

  priceRentLabel: "Rent",
  priceRentPeriod: "/month",

  financingHead: (program: string) => `💳 With ${program}`,
  financingStateProgram: " (government programme)",
  financingCuotaLabel: "Estimated monthly payment",
  financingTermsLabel: "Terms",
  financingTerms: (rate: string, years: number) =>
    `${rate}% rate · ${years} years`,
  financingFoot:
    "An indicative estimate for this property — approval depends on the bank and on the programme.",

  detailsTitle: "☰ Property details",
  detailBarrio: "Neighbourhood",
  detailCity: "City",
  detailType: "Type",
  detailState: "Condition",
  detailArea: "Built area",
  detailLand: "Land",
  detailParking: "Parking",

  amenitiesTitle: "✨ Property features",
  descriptionTitle: "📄 Description",
  locationTitle: "📍 Approximate location",

  sellerFallback: (brand: string) => `Listed on ${brand}`,
  sellerVerified: "Verified",
  sellerKindAgency: "Agency",
  sellerKindAgent: "Agent",
  /** FSBO: the listing was published by its owner, not by a professional. */
  sellerKindOwner: "Private seller",

  contactTitle: "Interested in this property?",
  contactSubtitle:
    "Get in touch today for more information or to arrange a viewing.",

  similarTitle: "Similar properties",
  fromAgencyTitleLead: "More from",
  fromAgencyFallback: "this agency",

  moreInBarrio: (barrio: string) => `📍 More properties in ${barrio}`,
  moreInCity: (city: string) => `🏙 All properties in ${city}`,

  ctaBarWhatsapp: "Contact on WhatsApp",
  ctaBarConsult: "Enquire",

  publishedToday: "Listed today",
  publishedYesterday: "Listed yesterday",
  publishedDaysAgo: (n: number) => `Listed ${n} days ago`,
  publishedWeeksAgo: (n: number) => `Listed ${n} weeks ago`,
  publishedMonthsAgo: (n: number) => `Listed ${n} months ago`,
} as const;
