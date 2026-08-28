/**
 * The Swedish dictionary — every visitor-facing string on the site.
 *
 * The site is Swedish-only: one door, `locale: "sv"` (src/config/verticals.ts).
 * Spanish survives in this codebase as a SOURCE-DATA language (the DB enums,
 * the agency feed's own prose) and never as a served locale. `en.ts` returns as
 * a file addition on the day an English domain is bought — the `Widen<>`
 * machinery in `index.ts` exists to keep it that cheap.
 *
 * Three rules for anything added here:
 *
 *  - **Explain, do not launder.** The reason this site is worth more to a Swede
 *    than Idealista with Google Translate is that it names the things a Swedish
 *    buyer has no vocabulary for — nota simple, licencia de primera ocupación,
 *    ITP. Keep the Spanish term and gloss it; never translate it into a Swedish
 *    word that implies a Swedish process.
 *  - **Never state a fact the data does not.** "Seller states" and "we have
 *    verified" are two different sentences and the schema keeps them in two
 *    different columns; the copy must not collapse them.
 *  - **Numbers are not copy.** Amounts and dates are formatted from the request
 *    locale (`sv-SE`) in `src/lib/format.ts`, not written out here.
 *
 * Copy that names the brand takes it as an argument rather than baking one
 * host's name in.
 */

export const sv = {
  searchPlaceholder: "Var vill du bo?",
  publishCta: "Annonsera gratis",
  contactEmail: "Kontakta via e-post",
  priceAlert: "Meddela mig om priset sänks",
  wizardNext: "Nästa →",
  wizardPrev: "Föregående",
  valuationMagnet: "Vad är din bostad värd? Ta reda på det gratis",
  emptyState:
    "Det finns inga bostäder här ännu — skapa en bevakning så hör vi av oss",
  inquiryPrefill: "Hej, jag är intresserad av den här bostaden.",
  quickQuestions: ["Är den ledig?", "Kan jag boka visning?", "Vad krävs?"],
} as const;

/**
 * Pre-launch notice (src/config/site-status.ts). Says the two things a
 * visitor needs: the listings are samples, and nothing here is an offer.
 * Deliberately plain — a disclosure that reads as marketing isn't one.
 */
export const svSiteNotice = {
  label: "Sajten är under uppbyggnad",
  body: (brand: string) =>
    `Vi förbereder lanseringen av ${brand}. Bostäderna du ser är testexempel: de är varken riktiga objekt till salu eller kommersiella erbjudanden, och uppgifterna och bilderna behöver inte motsvara någon befintlig bostad.`,
} as const;

/** Valuation tool — the seller-side magnet. Honest by design. */
export const svTasacion = {
  title: "Vad är din bostad värd?",
  subtitle: (brand: string) =>
    `Vi ger dig ett uppskattat intervall utifrån de priser som publiceras på ${brand}. Gratis, utan registrering och utan att någon ringer dig om du inte ber om det.`,
  cityLabel: "Ort",
  typeLabel: "Bostadstyp",
  operationLabel: "Du vill",
  operationSale: "Sälja",
  operationRent: "Hyra ut",
  areaLabel: "Boarea (m²)",
  areaHint:
    "Byggd yta (superficie construida) — samma mått som spanska annonser anger. Gäller det en tomt: ange tomtens m².",
  submit: "Beräkna",
  calculating: "Beräknar…",
  resultTitle: "Uppskattat intervall",
  resultRange: (low: string, high: string) => `Mellan ${low} och ${high}`,
  resultBasis: (n: number, perM2: string, city: string, period: string) =>
    `Beräknat på ${n} jämförbara annonser i ${city} (${period}), med ett medianpris på ${perM2} per m².`,
  resultBandNote: (pct: number) =>
    `Intervallet är ±${pct}%: ju färre jämförbara annonser, desto bredare gör vi det. Vi är hellre ärliga än exakta.`,
  disclaimer:
    "Viktigt: detta är en referens beräknad på utropspriser, inte på slutpriser, och det är ingen officiell värdering. Det som avgör det verkliga värdet är bostadens skick, det exakta läget och marknadsläget just nu.",
  errorBadArea: "Kontrollera antalet m²: ange ett tal mellan 10 och 100 000.",
  errorUnknownCity: "Välj en ort i listan.",
  errorNoData:
    "Vi har ännu inga jämförbara annonser för den bostadstypen på den orten. Skriv till oss så tittar vi på det manuellt.",
  errorThinData:
    "Vi har för få jämförbara annonser där för att kunna ge en siffra vi kan stå för. Skriv till oss så tittar vi på det manuellt.",
  errorGeneric: "Vi kunde inte beräkna intervallet. Försök igen.",
  nextTitle: "Vill du annonsera bostaden eller få rådgivning?",
  nextBody:
    "Lämna din e-postadress så hör vi av oss. Du kan också annonsera själv, gratis.",
  nameLabel: "Ditt namn",
  emailLabel: "Din e-postadress",
  contactSubmit: "Jag vill bli kontaktad",
  contactSent:
    "Klart! Vi hör av oss via e-post. Under tiden kan du annonsera din bostad själv.",
  contactError: "Vi kunde inte skicka dina uppgifter. Försök igen.",
  publishCta: "Annonsera min bostad",
  publishCtaHint:
    "Vi tar med uppgifterna du fyllde i här, så du slipper skriva dem två gånger.",
  seePrices: "Se priser i området",
} as const;

/** Price pages — market data in plain Swedish, caveats included. */
export const svPrecios = {
  indexTitle: "Bostadspriser i Spanien",
  indexSubtitle: (brand: string) =>
    `Medianpris per ort, beräknat på annonserna som publiceras på ${brand}. Välj en ort för att se uppdelningen per bostadstyp.`,
  indexEmpty:
    "Vi har ännu inte tillräckligt många publicerade annonser för att räkna fram tillförlitliga priser.",
  cityTitle: (city: string) => `Bostadspriser i ${city}`,
  citySubtitle: (brand: string, city: string, period: string) =>
    `Medianpris för köp och hyra i ${city}, enligt annonserna som publiceras på ${brand}${period ? ` (${period})` : ""}.`,
  tableType: "Typ",
  tableOperation: "Affär",
  tableMedian: "Medianpris",
  tableMedianM2: "Per m²",
  tableSample: "Annonser",
  seeListings: "Se annonser",
  fewSamples:
    "Få annonser — se det som en referens, inte som ett marknadspris.",
  methodTitle: "Så räknar vi",
  methodBody: (brand: string) =>
    `Vi använder medianen (inte medelvärdet) av de priser som publiceras på ${brand}, per ort och bostadstyp. Medianen tål enstaka extrempriser bättre. En grupp med färre än 8 annonser visas med en varning: det är en referens, inte ett marknadspris. Priserna är dessutom utropspriser, inte slutpriser. Ytan vi räknar på är byggd yta (superficie construida) — samma mått som spanska portaler anger, så att siffrorna går att jämföra.`,
  emptyCity:
    "Vi har ännu inte tillräckligt många annonser på den här orten för att räkna fram ett pris.",
  backToPrices: "← Alla priser",
  relatedPrices: (city: string) => `Vad kostar en bostad i ${city}?`,
  relatedPricesCta: "Se medianpriser",

  /**
   * Market context stated as a number rather than a question (audit I8).
   * Rendered only for a sample of MIN_RELIABLE_SAMPLE or more — see
   * medianFor() in precios-queries.ts.
   */
  contextMedian: (params: {
    typeLabel: string;
    operationLabel: string;
    city: string;
    median: string;
    perM2: string | null;
    sample: number;
  }) =>
    `Median för ${params.operationLabel} av ${params.typeLabel.toLowerCase()} i ${params.city}: ${params.median}` +
    (params.perM2 ? ` · ${params.perM2}/m²` : "") +
    ` (${params.sample} annonser)`,
  /** This listing's own price per m², next to the zone median. */
  contextThisListing: (perM2: string) => `Den här bostaden: ${perM2}/m²`,
  contextOperationLabel: {
    venta: "köp",
    alquiler: "uthyrning",
    alquiler_vacacional: "korttidsuthyrning",
  } as Record<string, string>,
} as const;

/**
 * Panel / auth copy (admin + agency). This is the internal surface (login,
 * review queue, agency dashboard) — never indexed, but Swedish all the same,
 * because the operator and the Swedish relocation agencies read the same
 * language as the site. A Spanish agency's panel locale is a later question
 * (`users.locale` already carries `es`); nothing switches on it at MVP.
 */
export const svPanel = {
  loginTitle: "Logga in i din panel",
  loginSubtitle: "Använd din e-postadress och ditt lösenord.",
  emailLabel: "E-post",
  passwordLabel: "Lösenord",
  loginSubmit: "Logga in",
  loginError: "Fel e-postadress eller lösenord.",
  loginLocked:
    "För många försök. Vänta några minuter innan du försöker igen.",
  logout: "Logga ut",
  loginToRegister: "Har du inget konto än? Registrera dig",

  // Registrering (mäklarbyråer och mäklare)
  registerTitle: "Skapa ditt konto",
  registerSubtitle:
    "Lägg upp dina bostäder själv. Det är gratis: vi granskar varje annons innan den publiceras.",
  registerKindLabel: "Hur arbetar du?",
  registerKindAgency: "Jag har en mäklarbyrå",
  registerKindIndependent: "Jag är fristående mäklare",
  registerAgencyNameLabel: "Mäklarbyråns namn",
  registerYourNameLabel: "För- och efternamn",
  registerPhoneLabel: "Telefon (valfritt)",
  registerPasswordLabel: "Lösenord",
  registerPasswordHint: "Minst 8 tecken.",
  registerSubmit: "Skapa konto",
  registerToLogin: "Har du redan ett konto? Logga in",
  registerPendingNote:
    "Ditt konto blir aktivt direkt. Verifieringen (✓ på din profil) godkänner vi manuellt efter att vi granskat dina uppgifter.",
  registerErrorName: "Skriv ditt fullständiga namn.",
  registerErrorEmail: "Kontrollera e-postadressen.",
  registerErrorEmailTaken:
    "Det finns redan ett konto med den e-postadressen. Prova att logga in.",
  registerErrorPassword: "Lösenordet behöver minst 8 tecken.",
  registerErrorAgencyName: "Skriv mäklarbyråns namn.",
  registerErrorGeneric: "Vi kunde inte skapa kontot. Försök igen.",

  // Registrering via inbjudan från en byrå
  registerKindInvite: (agencyName: string) => `Gå med i ${agencyName}`,
  registerInviteNote: (agencyName: string, role: string) =>
    `${agencyName} har bjudit in dig till sitt team som ${role}. Skapa ditt konto så hamnar dina annonser under den byrån.`,
  registerErrorInvite:
    "Den inbjudan fungerar inte längre: den kan ha gått ut eller redan använts. Be byrån skicka en ny.",

  // Inbjudan accepterad med ett konto som redan finns
  inviteTitle: "Inbjudan till en mäklarbyrå",
  inviteJoinBody: (agencyName: string, role: string) =>
    `${agencyName} bjuder in dig till sitt team som ${role}.`,
  inviteJoinNote:
    "Annonserna du publicerat hittills är fortfarande dina. Nya kommer att ligga under byrån.",
  inviteJoinSubmit: (agencyName: string) => `Gå med i ${agencyName}`,
  inviteBackToPanel: "← Tillbaka till din panel",
  inviteInvalid:
    "Den inbjudan fungerar inte längre: den kan ha gått ut eller redan använts. Be byrån skicka en ny.",
  inviteAlreadyInAgency:
    "Du tillhör redan en mäklarbyrå. Be dem ta bort dig innan du går med i en annan.",
  inviteNotForAdmin:
    "Du använder sajtens administratörskonto; det går inte att koppla till en byrå.",
  inviteNoProfile:
    "Ditt konto har ännu ingen mäklarprofil. Skriv till oss så aktiverar vi den.",

  // Profil (byrå + mäklare)
  profileTab: "Din profil",
  profileAgencyTitle: "Uppgifter om byrån",
  profileAgencyReadOnly:
    "Bara byråns administratörskonto kan ändra de här uppgifterna.",
  profileAgentTitle: "Din publika profil",
  profileAccountTitle: "Ditt konto",
  profileNoAgency:
    "Du arbetar som fristående mäklare, så det finns inga byråuppgifter att redigera.",
  profileLogoLabel: "Logotyp (URL)",
  profilePhotoLabel: "Foto (URL)",
  profilePhoneLabel: "Telefon",
  profileEmailLabel: "Kontakt-e-post",
  profileKindLabel: "Typ av verksamhet",
  profileKindInmobiliaria: "Spansk mäklarbyrå",
  profileKindRelocation: "Svensk relocation-partner",
  profileKindDeveloper: "Byggherre",
  profileTaxIdLabel: "Organisationsnummer / CIF",
  profileTaxIdHint:
    "CIF/NIF för ett spanskt bolag, organisationsnummer för ett svenskt.",
  profileRegistryLabel: "Mäklarregisternummer",
  profileRegistryHint:
    "Bara vissa regioner har ett obligatoriskt mäklarregister (AICAT i Katalonien, egna register i Madrid och Andalusien). Att fältet är tomt är normalt.",
  profileSave: "Spara",
  profileSaved: "Uppgifterna är uppdaterade.",
  profileAgencySaved: "Byråns uppgifter är uppdaterade.",
  profileAccountSaved: "Ditt konto är uppdaterat.",
  profilePasswordChanged:
    "Lösenordet är uppdaterat. Vi har loggat ut dina övriga sessioner.",
  profileEmailTaken: "Den e-postadressen används redan av ett annat konto.",
  profileForbidden: "Du har inte behörighet att ändra de uppgifterna.",
  profileInvalid: "Kontrollera uppgifterna du fyllt i.",
  profileBadPassword:
    "Ditt nuvarande lösenord stämmer inte. För att ändra e-post eller lösenord behöver vi bekräfta det.",
  currentPasswordLabel: "Nuvarande lösenord",
  currentPasswordHint:
    "Behövs bara om du byter e-postadress eller sätter ett nytt lösenord.",
  profileVerifiedNote: (brand: string) => `Profil verifierad av ${brand}.`,
  profilePendingNote: "Verifiering väntar på godkännande.",

  // Byråns team — bara för den ansvarige
  teamTab: "Ditt team",
  teamTitle: "Ditt team",
  teamHint:
    "De som står här delar byråns annonser och förfrågningar. Bara den ansvarige kan bjuda in, befordra eller ta bort någon.",
  teamEmpty: "Det finns ingen annan i ditt team ännu.",
  teamRoleLabel: "Roll",
  teamRoleAgent: "Mäklare",
  teamRoleAdmin: "Ansvarig",
  teamRoleSuperAdmin: "Sajtadministratör",
  teamRoleNoLogin: "Utan konto",
  teamNoLoginHint:
    "Profil utan konto: den hanteras av sajtadministratören.",
  teamPromote: "Gör till ansvarig",
  teamDemote: "Gör till mäklare",
  teamRemove: "Ta bort från teamet",
  teamRemoveWarning:
    "Personen slutar se byråns annonser och förfrågningar och arbetar vidare som fristående mäklare. Kontot raderas inte, och annonserna personen lagt upp stannar hos byrån.",
  teamRemoveConfirm: "Ja, ta bort från teamet",
  teamRoleSaved: "Rollen är uppdaterad.",
  teamMemberRemoved: "Personen ingår inte längre i ditt team.",
  teamJoined: "Klart! Du är med i teamet.",
  teamLastAdminError:
    "Byrån måste ha minst en ansvarig. Utse någon annan innan du gör den här ändringen.",
  teamSelfRoleError: "Du kan inte ändra din egen roll.",
  teamSelfRemoveError: "Du kan inte ta bort dig själv från teamet.",

  // Inbjudningar
  teamInviteTitle: "Bjud in en mäklare",
  teamInviteHint: (days: number) =>
    `Skapa en länk och skicka den till personen. Den fungerar en gång och går ut efter ${days} dagar. Den som öppnar den ser din byrås namn innan kontot skapas.`,
  teamInviteCreate: "Skapa länk",
  teamInviteCreated: "Länken är skapad. Kopiera den och skicka den vidare.",
  teamInviteRevoke: "Återkalla",
  teamInviteRevoked: "Länken är återkallad.",
  teamInvitesEmpty: "Det finns inga väntande inbjudningar.",
  teamInviteUrlLabel: (role: string, expires: string) =>
    `Länk för att lägga till en ${role.toLowerCase()} — går ut ${expires}`,

  // Admin
  adminReviewTitle: "Granskningskö",
  adminReviewEmpty: "Inga annonser väntar på granskning. 🎉",
  approve: "Godkänn",
  reject: "Neka",
  rejectReasonLabel: "Anledning till nekandet",
  rejectReasonPlaceholder:
    "Berätta för annonsören varför (t.ex. bilder med vattenstämpel)",
  adminAgenciesTitle: "Byråer och mäklare",
  adminAgencyNewTitle: "Skapa byrå",
  adminAgencyNewHint:
    "Skapar byråns profil. Den börjar overifierad: använd knappen i listan för att ge den ✓. Det skapar ingen användare — det gör du under Användare, med ”Koppla”. Byrån syns i den publika katalogen först när den har en publicerad annons.",
  agencyNameLabel: "Byråns namn",
  agencyPhoneLabel: "Telefon",
  agencyEmailLabel: "Kontakt-e-post",
  agencyKindLabel: "Typ av verksamhet",
  planLabel: "Plan",
  createAgency: "Skapa byrå",
  agencyCreated: "Byrån är skapad. Den är fortfarande overifierad.",
  agencyInvalid: "Kontrollera uppgifterna: namnet är obligatoriskt.",
  verify: "Verifiera",
  unverify: "Ta bort verifiering",
  verifiedBadge: "✓ Verifierad",
  notVerifiedBadge: "Overifierad",

  // Admin — användare
  adminUsersTitle: "Användare",
  /** Labels for the two panel tab rows — see PanelBar's `group`. */
  navMain: "Panelens sektioner",
  navManage: "Administration",
  adminUsersEmpty: "Det finns inga användare ännu.",
  adminUsersNewTitle: "Skapa användare",
  adminUsersListTitle: "Panelens användare",
  nameLabel: "Namn",
  roleLabel: "Roll",
  localeLabel: "Språk",
  agencyLabel: "Byrå",
  agencyNone: "Fristående",
  newPasswordLabel: "Nytt lösenord",
  newPasswordHint: "Lämna tomt för att behålla det nuvarande.",
  createUser: "Skapa användare",
  saveUser: "Spara",
  deleteUser: "Radera",
  linkAgency: "Koppla",
  noPasswordBadge: "Utan lösenord",
  userEmailTaken: "Den e-postadressen används redan av ett annat konto.",
  userSelfRoleError: "Du kan inte ändra din egen roll.",
  userSelfDeleteError: "Du kan inte radera ditt eget konto.",
  userLastAdminError: "Du kan inte ta bort den sista administratören.",
  userCreated: "Användaren är skapad.",
  userSaved: "Användaren är uppdaterad.",
  userDeleted: "Användaren är raderad.",
  userPasswordReset:
    "Lösenordet är uppdaterat. Användarens öppna sessioner har loggats ut.",
  userAgencyLinked: "Kopplingen till byrån är uppdaterad.",

  /**
   * Identity verification (users.identity_*). Operator-only on purpose: the
   * portal stores the last four characters of a sighted document, never the
   * full NIE/DNI, and never anything a user typed about themselves.
   */
  identityTitle: "Identitetskontroll",
  identityHint:
    "Fyll bara i det här efter att du sett ID-handlingen. Vi sparar de fyra sista tecknen — aldrig hela numret — så att du känner igen vilken handling som ligger till grund för kontrollen.",
  identityDocTypeLabel: "Typ av handling",
  identityLast4Label: "Fyra sista tecknen",
  identityVerifiedLabel: "Kontrollerad",
  identityUnverified: "Inte kontrollerad",
  identitySaved: "Identitetskontrollen är sparad.",

  // Admin — mäklare och byråer
  adminAgentsTitle: "Mäklare",
  adminAgentsHint:
    "Här flyttar du en mäklare mellan byråer, eller gör hen fristående. Annonser som redan är upplagda stannar hos byrån som publicerade dem.",
  adminAgentsEmpty: "Det finns inga mäklare ännu.",
  adminAgentMove: "Flytta",
  adminAgentMoved: "Mäklaren är uppdaterad.",
  adminAgentLastAdminError:
    "Den mäklaren är enda ansvarig för sin byrå. Utse någon annan innan du flyttar hen.",
  adminAgentProtectedError:
    "Det kontot är sajtens administratörskonto: det flyttas inte mellan byråer.",
  adminAgentProtectedHint:
    "Sajtens administratörskonto. Rollen ändras under Användare.",
  adminAgentNoLoginHint:
    "Den här profilen har inget konto än: du kan flytta den mellan byråer, men rollen börjar gälla först när det finns en inloggning.",
  adminAgencyNoAdminOption: (name: string) => `${name} (utan ansvarig)`,
  adminAgenciesWithoutAdmin: (names: string) =>
    `De här byråerna saknar ansvarig: ${names}. Ge någon rollen ”Ansvarig” så att de kan hantera sitt team.`,

  // Admin — alla förfrågningar
  adminLeadsTitle: "Förfrågningar",
  adminLeadsHint:
    "Alla förfrågningar som kommer in via sajten, oavsett byrå eller mäklare. De som är märkta ”Intern” är dina att arbeta med.",
  adminLeadsEmpty: "Det finns inga förfrågningar med det filtret.",
  adminLeadsSearchLabel: "Sök på namn, e-post eller telefon",

  // Admin — alla bostäder
  adminListingsTitle: "Bostäder",
  adminListingsEmpty: "Det finns inga bostäder med det filtret.",
  searchListingsLabel: "Sök på titel eller kod",
  searchSubmit: "Sök",
  filterAll: "Alla",
  editListing: "Redigera",
  viewListing: "Visa annons",
  backToListings: "← Tillbaka till bostäder",

  // Redigeringsformulär för annons (delas av admin + byrå)
  listingTitleLabel: "Annonsens rubrik",
  listingDescriptionLabel: "Beskrivning",
  listingOperationLabel: "Affär",
  listingTypeLabel: "Bostadstyp",
  listingPriceLabel: "Pris (€)",
  listingBedroomsLabel: "Sovrum",
  listingBathroomsLabel: "Badrum",
  listingParkingLabel: "Parkeringsplatser",
  listingBuiltLabel: "Byggd yta (m²)",
  listingBuiltHint:
    "Superficie construida — måttet spanska portaler anger, och det enda vi jämför och filtrerar på.",
  listingUsableLabel: "Användbar yta (m²)",
  listingUsableHint:
    "Superficie útil — innerytan, utan väggar och gemensamma ytor. Visas bara, filtreras aldrig.",
  listingPlotLabel: "Tomt (m²)",
  listingYearBuiltLabel: "Byggår",
  listingLocationLabel: "Läge",
  listingVideoLabel: "Video (URL)",
  saveListing: "Spara ändringar",
  deleteListing: "Radera annons",
  deleteListingWarning:
    "Annonsen raderas permanent tillsammans med sina bilder. Vill du bara ta bort den från sajten, använd statusen ”Borttagen”.",
  listingSaved: "Annonsen är uppdaterad.",
  listingDeleted: "Annonsen är raderad.",
  listingNotFound: "Vi hittar inte den annonsen.",
  listingInvalid: "Kontrollera uppgifterna: obligatoriska fält saknas.",

  /**
   * The Spain legal block, as the operator edits it. Two of these are the
   * portal's own attestation rather than the seller's claim, and the labels
   * have to keep saying so.
   */
  legalTitle: "Juridik och energi",
  energyRatingLabel: "Energiklass",
  energyRatingHint:
    "Obligatorisk i annonsen enligt spansk lag (RD 390/2021). ”Under handläggning” och ”Undantagen” är giltiga svar — tomt är det inte, och annonsen kan inte publiceras utan ett val här.",
  energyEmissionsLabel: "Utsläppsklass",
  energyKwhLabel: "Energiförbrukning (kWh/m² och år)",
  energyCo2Label: "Utsläpp (kg CO₂/m² och år)",
  catastralLabel: "Referencia catastral",
  catastralHint:
    "Fastighetsregistrets 20-teckenkod. Det starkaste äkthetsbeviset en annons kan bära — och det som gör att samma bostad inte kan läggas upp två gånger.",
  legalStatusLabel: "Juridisk status (säljarens uppgift)",
  chargesStatusLabel: "Inteckningar och belastningar (säljarens uppgift)",
  notaSimpleLabel: "Nota simple granskad av oss",
  notaSimpleHint:
    "Sätts bara av oss, aldrig av annonsören: det är portalens egen kontroll, och hela poängen är att säljaren inte kan sätta den själv.",
  ibiLabel: "IBI, kommunal fastighetsskatt (€/år)",
  communityLabel: "Samfällighetsavgift (€/månad)",
  isVpoLabel: "VPO — prisreglerad bostad",
  isVpoHint:
    "Vivienda de Protección Oficial: prisreglerad, med begränsad återförsäljning, och i praktiken inte köpbar för en utländsk köpare utan hemvist i Spanien.",
  landClassificationLabel: "Markklassificering",
  buildableM2Label: "Byggrätt (m²)",
  touristLicenceLabel: "Turistuthyrningslicens",
  touristLicenceHint:
    "Registreringsnumret från regionen (VFT/… i Andalusien, VT-… i Valencia). Flera regioner kräver att det står i annonsen.",

  // Foton (delas av admin + byrå)
  photosTitle: "Bilder",
  photosEmpty: "Den här annonsen har inga bilder ännu.",
  photosHint:
    "Första bilden är omslaget: det är den som syns i listorna. Du kan ladda upp flera samtidigt (JPG, PNG, WebP eller HEIC, upp till 12 MB styck).",
  photosAddLabel: "Lägg till bilder",
  photosUpload: "Ladda upp",
  photosCover: "Omslag",
  photosMakeCover: "Gör till omslag",
  photosMoveUp: "Flytta framåt",
  photosMoveDown: "Flytta bakåt",
  photosDelete: "Radera",
  photosDeleteConfirm: "Radera den här bilden? Det går inte att ångra.",
  photosUploaded: "Bilderna är uppladdade.",
  photosDeleted: "Bilden är raderad.",
  photosReordered: "Ordningen är uppdaterad.",
  photosNoFiles: "Du valde ingen bild.",
  photosTooManyFiles:
    "Det är för många bilder på en gång. Ladda upp högst 20 åt gången.",
  photosRejected: "Några bilder kunde inte laddas upp.",
  photosNotConfigured:
    "Bildlagringen är inte konfigurerad ännu (R2-nycklarna saknas). Säg till administratören.",
  photosPlaceholderNote:
    "Exempelbild från importen — byt ut den mot riktiga bilder på bostaden.",

  // Byrå
  agencyListingsTitle: "Dina bostäder",
  agencyAddListingCta: "Annonsera bostad",
  agencyListingsEmpty: "Du har inga bostäder upplagda ännu.",
  agencyLeadsTitle: "Inkomna förfrågningar",
  agencyLeadsEmpty: "Du har inte fått några förfrågningar ännu.",
  agencyWelcome:
    "Välkommen! Ditt konto är klart. Lägg upp din första bostad så granskar vi den innan den publiceras.",
  agencyNoLink:
    "Din användare är ännu inte kopplad till en byrå. Skriv till oss så aktiverar vi det.",
  statusLabel: "Status",

  // Importera från en länk
  importTab: "Importera",
  importTitle: "Hämta din annons från en annan portal",
  importSubtitle:
    "Klistra in länken till DIN annons så fyller vi i formuläret åt dig. Den blir ett utkast: du granskar uppgifterna, lägger till bilder och skickar den till publicering.",
  importUrlLabel: "Länk till din annons",
  importFetch: "Läs länken",
  importReading: "Läser…",
  importOwnershipLabel:
    "Jag intygar att den här annonsen är min (eller att byrån gett mig tillstånd att publicera den) och att jag får använda dess text och bilder.",
  importOwnershipRequired:
    "Vi behöver att du bekräftar att annonsen är din innan vi importerar den.",
  importReviewTitle: "Granska det vi läste in",
  importReviewHint:
    "Rätta det som behövs. Det vi inte kunde läsa lämnade vi tomt med flit: hellre ett tomt fält än en påhittad uppgift.",
  importCreate: "Skapa utkast",
  importPhotosNote:
    "Bilderna kopieras inte automatiskt. Ladda upp dem när du redigerar annonsen — så har du dina egna bilder, utan en annan portals vattenstämpel.",
  importCreated:
    "Utkastet är skapat. Granska det, lägg till bilder och skicka det till publicering.",
  importDuplicate: "Den länken har importerats tidigare:",
  importDuplicateFlash:
    "Den länken har importerats tidigare — ingen dubblettannons skapades.",
  importLocationLabel: "Läge (bekräfta eller rätta)",

  // Massimport (/admin/importar)
  adminImportTitle: "Importera kalkylblad",
  adminImportSubtitle:
    "Ladda upp en byrås kalkylblad (.csv eller .xlsx). Först visar vi vad som händer med varje rad; först därefter skrivs något.",
  importRollbackHint:
    "Varje sats går att återställa efteråt: bostäderna den skapade raderas och de den ändrade återställs. De som redan fått förfrågningar eller är publicerade behålls, och vi talar om vilka.",
  importJobsTitle: "Importerade satser",
  importJobsEmpty: "Du har inte importerat något kalkylblad ännu.",
  importJobRollback: "Återställ den här satsen",
  importJobRolledBack: "Satsen är återställd.",
  importJobRollbackFailed: "Vi kunde inte återställa den satsen.",
  importPermissionMissing: "Inget registrerat tillstånd",
  importErrorBadUrl:
    "Den länken ser inte giltig ut. Kopiera hela, med https://",
  importErrorBlocked: "Vi kan bara läsa publika länkar på internet.",
  importErrorUnreachable:
    "Vi kunde inte öppna den sidan. Den kan vara nere eller blockera externa läsare — lägg upp annonsen manuellt.",
  importErrorNotHtml: "Den länken är ingen webbsida med en annons.",
  importErrorTooLarge: "Den sidan är för stor för att läsa.",
  importErrorGeneric:
    "Vi kunde inte läsa den länken. Prova att lägga upp annonsen manuellt.",
  importErrorRateLimited:
    "Du importerar för tätt. Vänta några minuter och försök igen.",
  importLegalNote:
    "Vi importerar en annons i taget, på begäran av den som äger den. Vi kopierar inte andra portalers kataloger.",

  // Statistik per annons
  statsViews: "Visningar",
  statsLeads: "Förfrågningar",
  statsWindow: "Senaste 30 dagarna",
  statsSummary: "Under de senaste 30 dagarna",
  statsNoData:
    "Det finns inga registrerade visningar ännu. Statistiken börjar räknas när annonsen är publicerad.",
  statsViewsHint:
    "Visningar av människor: vi räknar bort sökmotorer och robotar så att siffran betyder något.",
  saveStatus: "Spara",
  contactLead: "Svara via e-post",
  /**
   * Operator alerts. Outbound, to the person running the portal — never
   * rendered on a page, but copy all the same, so it lives here.
   */
  alertNewLeadTitle: "Ny förfrågan på portalen",
  alertNewLeadDetail: (params: {
    leadType: string;
    name: string | null;
    email: string;
    listingTitle: string | null;
  }) =>
    [
      `${params.leadType} · ${params.name ?? "Utan namn"} (${params.email})`,
      params.listingTitle ? `Annons: ${params.listingTitle}` : null,
    ]
      .filter(Boolean)
      .join(" — "),
  alertReviewTitle: "En annons väntar på granskning",
  alertReviewDetail: (title: string, verified: boolean) =>
    `${title}${verified ? " · e-post verifierad" : " · e-post inte verifierad"}`,
  /** Leads that arrived in the last 24 h — the badge on the leads tab. */
  adminLeadsRecent: (n: number) =>
    n === 1
      ? "1 ny förfrågan de senaste 24 timmarna"
      : `${n} nya förfrågningar de senaste 24 timmarna`,
  /**
   * FSBO leads land in the operator's inbox because a private seller has no
   * inbox of their own yet; these two are how the lead gets to them.
   */
  leadOwnerRouted: "Privatperson",
  forwardLead: "Vidarebefordra till säljaren",
  forwardLeadMessage: (params: {
    listingTitle: string | null;
    name: string | null;
    email: string;
    message: string | null;
  }) =>
    [
      `Du har fått en förfrågan${params.listingTitle ? ` om din annons: ${params.listingTitle}` : ""}.`,
      `Från: ${params.name ?? "Utan namn"} (${params.email})`,
      params.message ? `Meddelande: ${params.message}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  // Read-only status rows (audit F25): the status <select> used to pre-set
  // "Utkast" on a row under review, so one save silently cancelled the review.
  statusPendingNote:
    "Under granskning: vi publicerar den så snart vi godkänt den. Du behöver inte göra något.",
  statusRejectedNote:
    "Inte godkänd. Rätta den under ”Redigera” och skicka in den igen.",
  statusRejectedReason: "Anledning",
  /**
   * Publishing is not a status an agency sets any more (audit F1). Says so
   * once, where the status control is, so "Under granskning" reads as the way
   * to publish rather than as a step that leads nowhere.
   */
  statusReviewNote:
    "För att publicera en annons sätter du den till ”Under granskning”: vi granskar den och publicerar den. Det är det som gör att vi kan lova köparen att varje annons passerat en människa.",
  /** The publish gate (schema.ts, energy_rating). Server-side, not form-only. */
  statusEnergyRequired:
    "Annonsen kan inte publiceras utan energiklass: spansk lag kräver att den står i själva annonsen. Välj ”Under handläggning” eller ”Undantagen” om certifikatet inte är klart.",
} as const;

/**
 * The private seller's panel.
 *
 * Separate from `svPanel` because the reader is different: the agency panel
 * talks to a professional about their inventory, this talks to somebody selling
 * one home. No "bestånd", no "portfölj" — "din annons".
 */
export const svOwner = {
  panelTitle: "Dina annonser",
  listingsTab: "Dina annonser",
  leadsTab: "Förfrågningar",

  listingsTitle: "Dina annonser",
  listingsEmpty:
    "Du har inte publicerat någon annons ännu. När du publicerar en dyker den upp här.",
  addListingCta: "Annonsera en bostad",

  /**
   * Same rule as the agency panel (audit F1): nobody publishes their own
   * listing. Worded for someone who has never used a portal panel.
   */
  statusReviewNote:
    "För att din annons ska bli publicerad sätter du den till ”Under granskning”: vi granskar den och publicerar den. Det är det som gör att vi kan lova köparen att varje annons passerat en människa.",

  editListing: "Redigera",
  backToListings: "← Tillbaka till dina annonser",
  viewListing: "Visa den publicerade annonsen",
  saveStatus: "Spara",
  statusLabel: "Status",

  leadsTitle: "Förfrågningar om dina annonser",
  leadsEmpty:
    "Du har inte fått några förfrågningar ännu. När någon är intresserad av din bostad dyker deras uppgifter upp här.",
  contactLead: "Svara via e-post",

  /** The seller sees the interested buyer's address; say what to do with it. */
  leadsNote:
    "De här personerna har lämnat sina kontaktuppgifter för att prata med dig. Svara så snart du kan: förfrågningar svalnar fort.",
} as const;

/** The publish wizard. */
export const svPublish = {
  pageTitle: "Annonsera din bostad",
  pageSubtitle:
    "Lägg upp den i tre steg. Vi sparar automatiskt medan du fyller i, så du kan avsluta när du vill.",

  /** Shown when the valuation tool carried operation, type, city and m² over. */
  prefillNote:
    "Vi har fyllt i det du redan angav i värderingen. Kontrollera och gå vidare — allt går att ändra.",

  stepLabels: ["Detaljer", "Läge", "Pris och publicering"] as const,

  // Steg 1
  operationLabel: "Vad vill du göra?",
  propertyTypeLabel: "Bostadstyp",
  titleLabel: "Annonsens rubrik",
  titlePlaceholder: "Nyrenoverad villa i Nueva Andalucía",
  descriptionLabel: "Beskrivning",
  descriptionPlaceholder:
    "Berätta vad som gör bostaden speciell: skick, extrautrymmen, vad som finns i närheten…",
  bedroomsLabel: "Sovrum",
  bathroomsLabel: "Badrum",
  parkingLabel: "Parkeringsplatser",
  builtLabel: "Byggd yta (m²)",
  builtHint:
    "Superficie construida — måttet spanska annonser anger. Det är det vi jämför och filtrerar på.",
  usableLabel: "Användbar yta (m²)",
  usableHint: "Superficie útil, om du vet den. Visas bara, filtreras inte.",
  plotLabel: "Tomt (m²)",
  yearBuiltLabel: "Byggår",

  // Steg 2
  locationLabel: "Läge",
  locationPlaceholder: "Skriv din ort eller ditt område",
  locationHint: "Välj området om det finns i listan, annars orten.",
  projectLabel: "Projekt i närheten (valfritt)",
  projectPlaceholder: "Sök efter ett bygg- eller bostadsprojekt",
  projectHint:
    "Koppla din nyproduktionsbostad till projektet så syns den på projektets sida.",

  // Steg 3
  priceLabel: "Pris (€)",
  priceHint:
    "Ange priset i euro. Sajten räknar själv om till kronor med en daterad växelkurs — skriv aldrig in ett kronbelopp här.",
  videoLabel: "Video (valfritt)",
  photosTitle: "Bilder",
  photosHint:
    "Första bilden är omslaget. Du kan lägga till dem nu eller senare, från din panel.",
  photosPickLabel: "Välj bilder",
  photosUploading: "Laddar upp…",
  photosDelete: "Radera",
  photosDraftFirst:
    "Fyll i uppgifterna om bostaden och gå vidare: så snart utkastet sparas kan du ladda upp bilder.",
  photosStorageOff:
    "Bildlagringen är inte tillgänglig ännu. Du kan publicera ändå och lägga till bilder senare.",
  photosFailed: "Vi kunde inte ladda upp några av bilderna. Försök igen.",
  photosTooMany:
    "Det är för många bilder på en gång. Ladda upp högst 20 åt gången.",

  /**
   * The Spain legal fields as the seller answers them. `desconocido` is the
   * honest default everywhere: the site never implies a clean status nobody
   * told it about. `nota_simple_seen_at` is deliberately NOT on this form —
   * it is the portal's own attestation and a seller cannot set it.
   */
  legalTitle: "Juridik och energi",
  legalIntro:
    "De här uppgifterna är ofta det en svensk köpare inte vet att den ska fråga om. Vet du inte svaret: välj ”Vet ej”. Det är ärligare än en gissning, och köparen ser att frågan är ställd.",
  energyRatingLabel: "Energiklass",
  energyRatingHint:
    "Spansk lag kräver att energiklassen står i annonsen. Har du sökt certifikat men inte fått det: välj ”Under handläggning”. Utan ett svar här går annonsen inte att publicera.",
  catastralLabel: "Referencia catastral (valfritt)",
  catastralHint:
    "Fastighetsregistrets 20-teckenkod. Den står på ditt IBI-besked och i lagfarten, och den är det starkaste äkthetsbeviset din annons kan bära.",
  legalStatusLabel: "Bostadens juridiska status",
  chargesStatusLabel: "Inteckningar och belastningar",
  ibiLabel: "IBI, kommunal fastighetsskatt (€/år)",
  communityLabel: "Samfällighetsavgift (€/månad)",
  touristLicenceLabel: "Turistuthyrningslicens",
  touristLicenceHint:
    "Krävs för korttidsuthyrning i flera regioner, och måste stå i annonsen där den krävs.",

  // Publicering
  publishTitle: "Publicera din annons",
  publishSubtitle:
    "Lämna din e-postadress så att intresserade kan nå dig. Vi granskar annonsen innan den publiceras.",

  // OTP
  otpTitle: "Bekräfta din e-postadress för att publicera",
  otpSubtitle:
    "Vi skickar en kod till din e-post. Verifierade annonser visar ✓ och inger mer förtroende.",
  emailLabel: "E-postadress",
  codeLabel: "Sexsiffrig kod",
  sendCode: "Skicka kod",
  sending: "Skickar…",
  resend: "Skicka koden igen",
  resendIn: "Skicka igen om",
  publish: "Publicera annons",
  publishing: "Publicerar…",

  // Navigering
  back: "Tillbaka",
  next: "Nästa",
  saving: "Sparar…",

  // Klart
  doneTitle: "Din annons är inskickad!",
  doneBody:
    "Vi granskar den nu. Så snart vi godkänt den publiceras den på sajten. Du kan följa status och lägga till bilder från din panel.",
  doneCta: "Till min panel",

  errors: {
    operation: "Välj om bostaden ska säljas eller hyras ut.",
    propertyType: "Välj bostadstyp.",
    title: "Skriv en rubrik på minst 8 tecken.",
    price: "Ange ett giltigt pris i euro.",
    location: "Välj ett läge i listan.",
    energyRating:
      "Välj energiklass — spansk lag kräver den i annonsen. ”Under handläggning” och ”Undantagen” är giltiga svar.",
    invalidEmail: "Kontrollera e-postadressen.",
    otpMismatch: "Koden stämmer inte. Försök igen.",
    otpTooMany: "För många försök. Begär en ny kod.",
    not_found: "Vi hittar inte ditt utkast. Ladda om sidan.",
    generic: "Något gick fel. Försök igen.",
  } as Record<string, string>,
} as const;

/** Swedish labels for listing statuses shown in the panel. */
export const listingStatusLabel: Record<string, string> = {
  draft: "Utkast",
  pending_review: "Under granskning",
  published: "Publicerad",
  paused: "Pausad",
  sold: "Såld",
  rented: "Uthyrd",
  removed: "Borttagen",
};

/**
 * Per-listing inquiry prefill: names the property and links back to it, so the
 * seller knows exactly which listing the message is about (and the portal gets
 * attribution in the message itself).
 */
export function inquiryPrefillFor(
  brand: string,
  title: string,
  url: string,
): string {
  return `Hej, jag såg den här bostaden på ${brand} och är intresserad: ${title}\n${url}`;
}

/** Public agent profile page — mirrors the agency profile. */
export const svAgentProfile = {
  notFoundTitle: "Mäklaren hittades inte",
  kind: "Mäklare",
  verified: "Verifierad",
  listingsTitle: "Publicerade bostäder",
  listingCount: (n: number) =>
    n === 1 ? "1 publicerad bostad" : `${n} publicerade bostäder`,
  noListings: "Inga publicerade bostäder just nu",
  empty: "Den här mäklaren har inga publicerade bostäder ännu.",
  contactTitle: "Vill du kontakta mäklaren?",
  contactSubtitle: "Skicka ett meddelande så svarar hen direkt.",
  contactLink: "✉ Skicka meddelande",
  agencyPrefix: "Arbetar på",
  metaTitle: (agentName: string) => `${agentName} — bostäder i Spanien`,
  metaDescription: (brand: string, agentName: string, n: number) =>
    `${n === 1 ? "1 publicerad bostad" : `${n} publicerade bostäder`} av ${agentName} på ${brand}.`,
} as const;

/**
 * Agent-profile inquiry prefill: names the agent and links back to their
 * profile, mirroring inquiryPrefillFor above for listings.
 */
export function agentInquiryPrefillFor(
  brand: string,
  agentName: string,
  url: string,
): string {
  return `Hej, jag såg din profil på ${brand} och vill komma i kontakt med dig: ${agentName}\n${url}`;
}

/* ========================================================================== *
 * Buyer-facing surfaces
 *
 * The half of the site a visitor actually reads — home, the operation hubs,
 * the category grid, the search and filter bars, the listing card and the
 * property detail page.
 *
 * Read these through `getDictionary(locale)` (src/i18n/index.ts) rather than
 * importing them directly, so a second dictionary can be added without
 * touching a single call site.
 * ========================================================================== */

/** Hero search bar — affär / ort / typ / budget. */
export const svSearchBar = {
  operationLabel: "Affär",
  operationBuy: "Köpa",
  operationRent: "Hyra",
  cityLabel: "Ort",
  cityAny: "Alla orter",
  typeLabel: "Typ",
  typeAny: "Alla typer",
  budgetLabel: "Budget",
  budgetAny: "Ingen gräns",
  /** Locale-aware on purpose: the thousands separator is not universal. */
  budgetUpTo: (amount: number, locale: string) =>
    `Upp till € ${amount.toLocaleString(locale)}`,
  submit: "Sök",
} as const;

/** Category page filter bar — a plain GET form, no client JS. */
export const svFilters = {
  priceMinLabel: "Lägsta pris (€)",
  priceMinPlaceholder: "Inget minimum",
  priceMaxLabel: "Högsta pris (€)",
  priceMaxPlaceholder: "Inget maximum",
  bedroomsLabel: "Sovrum",
  bedroomsAny: "Spelar ingen roll",
  sortLabel: "Sortera efter",
  sortRecent: "Senast inlagda",
  sortPriceAsc: "Lägsta pris",
  sortPriceDesc: "Högsta pris",
  submit: "Filtrera",
  clear: "Rensa filter",
} as const;

/** Listing card — the grid tile. */
export const svCard = {
  operationBadge: {
    venta: "Till salu",
    alquiler: "Uthyres",
    alquiler_vacacional: "Korttidsuthyrning",
  } as Record<string, string>,
  featured: "Utvald",
  noPhoto: "Bild kommer",
  bedroomsShort: (n: number) => `${n} sovrum`,
  bathrooms: (n: number) => `${n} badrum`,
  area: (m2: number) => `${m2} m²`,
  /** The SEK line is an approximation and always says so (src/lib/format.ts). */
  approxNote: "cirkapris i kronor",
  /** Energy rating is legally required in the ad; the card shows the letter. */
  energy: (rating: string) => `Energiklass ${rating}`,
  energyPending: "Energicertifikat under handläggning",
  energyExempt: "Undantagen från energicertifikat",
  /** Set when the Swedish text came from cron:translate, not from a human. */
  machineTranslated: "Maskinöversatt från spanska",
} as const;

/** Home page. */
export const svHome = {
  metaDescription:
    "Villor, lägenheter och tomter till salu och uthyres i Spanien — priser i euro, ungefärligt pris i kronor, och de juridiska uppgifterna en svensk köpare behöver.",
  publishEmailPrefill: (brand: string) =>
    `Hej, jag vill annonsera en bostad på ${brand}.`,

  heroKicker: "Spanien · för svenska köpare",
  heroTitleLead: "Hitta din bostad i ",
  heroTitleHighlight: "Spanien",
  heroSubtitle:
    "Villor, lägenheter och tomter längs kusten och på öarna — med pris i euro, ungefärligt pris i kronor och en uppskattning av vad köpet kostar utöver priset.",
  heroSeeListings: "Se bostäder",
  heroSellCta: "Sälja min bostad",
  heroStatCount: (total: string) => `${total} publicerade bostäder`,
  heroStatCountEmpty: "Bostäder i hela Spanien",
  heroStatUpdated: "Uppdateras dagligen",

  zonesKicker: "Områden",
  zonesTitle: "Var vill du bo",
  zonesAll: "Se alla områden →",
  /**
   * The one translatable half of an area card. Name, slug and photograph are
   * structural and stay in `app/page.tsx`; the strapline is copy, so it lives
   * here keyed by the municipio slug the locations seed creates.
   */
  zoneCardSub: {
    marbella: "Costa del Sol — störst utbud",
    torrevieja: "Costa Blanca, stor svensk närvaro",
    palma: "Mallorca, året runt-stad",
    javea: "Costa Blanca norr, lugnare tempo",
  } as Record<string, string>,

  howTitle: "Så fungerar det",
  howSubtitle:
    "Söka, jämföra och ta kontakt. Gratis, utan registrering och utan provision.",
  howMore: "Läs hela guiden →",
  howSteps: [
    {
      icon: "🔎",
      title: "Sök på område och budget",
      text: "Filtrera på ort, område, bostadstyp och prisintervall. Se resultatet som lista eller på kartan.",
    },
    {
      icon: "📊",
      title: "Se vad köpet faktiskt kostar",
      text: "Varje bostad till salu visar en uppskattning av skatter och avgifter ovanpå priset — den post svenska köpare oftast inte räknat med.",
    },
    {
      icon: "💬",
      title: "Ta kontakt direkt",
      text: "Skriv till den som lagt upp annonsen, från samma sida och utan mellanhänder eller kostnad.",
    },
  ],

  sellKicker: "Sälja",
  sellTitle: "Sälj till köpare som redan letar",
  sellText:
    "Annonsera din bostad gratis och nå svenska köpare som söker i Spanien. Vi ger dig ett uppskattat prisintervall utifrån publicerade annonser i ditt område, så att du vet var du står innan du bestämmer dig.",
  sellImageAlt: "Interiör i en bostad i Spanien",
  sellValuationCta: "Begär värdering",
  sellPublishCta: "Annonsera en bostad →",

  investKicker: "Investera",
  investTitle: "Investera i spansk bostad med siffror, inte magkänsla",
  investText:
    "Vi publicerar medianpriset per m² för varje ort, beräknat på annonserna i portalen, och en uppskattning av köpkostnaderna per region — överlåtelseskatten skiljer sig från 6 % till 10 % beroende på var i Spanien bostaden ligger.",
  investImageAlt: "Kustlandskap i Spanien i skymningen",
  investPricesCta: "Se priser per område",
  investCostsCta: "Vad kostar ett köp? →",

  projectsTitle: "🏗 Nyproduktion i Spanien",
  projectsSubtitle:
    "Kontrollerad nyproduktion — bostäder på ritning, under byggnation och inflyttningsklara.",

  citiesTitle: "Utforska per ort",

  rowMore: "Se alla →",
  rowRecommended: "Rekommenderade bostäder",
  rowHousesForSale: "Villor till salu — Costa del Sol",
  rowFlatsForSale: "Lägenheter till salu — Costa Blanca",
  rowRentals: "Uthyres i Spanien",
  rowLand: "Tomter",

  developersTitle: "Utvalda byggherrar",
  developersSubtitle: "Se vilka som bygger projekten.",
  developerProjectCount: (n: number) =>
    `${n} ${n === 1 ? "projekt" : "projekt"}`,

  pricesTitle: "📊 Referenspriser per ort",
  pricesMore: "Se alla →",
  pricesSubtitle:
    "Medianpris per m² beräknat på publicerade annonser. För att veta om en annons ligger i linje med sitt område innan du förhandlar.",
  pricesSample: (n: string) => `${n} annonser analyserade`,

  values: [
    {
      icon: "✅",
      title: "Direktkontakt",
      text: "Du talar direkt med säljaren eller byrån, utan mellanhänder.",
    },
    {
      icon: "🧾",
      title: "Hela kostnaden, inte bara priset",
      text: "Överlåtelseskatt, notarie, register och juridik — uppskattat per region, ovanpå utropspriset.",
    },
    {
      icon: "🇸🇪",
      title: "Skrivet för svenska köpare",
      text: "Priser i euro med ungefärligt kronbelopp, och de spanska begrepp som avgör affären förklarade i stället för bortöversatta.",
    },
  ],

  discoverTitle: (brand: string) => `Upptäck mer på ${brand}`,
  discoverCards: [
    {
      icon: "🏡",
      title: "Annonsera din bostad gratis",
      text: "Lägg upp bilder, pris och läge på några minuter. Ingen provision, ingen annonsavgift.",
      cta: "Annonsera nu",
      href: "/publicar",
    },
    {
      icon: "💰",
      title: sv.valuationMagnet,
      text: "Vi ger dig ett uppskattat intervall utifrån publicerade priser i området. Gratis och utan registrering.",
      cta: "Beräkna gratis",
      href: "/tasacion",
    },
    {
      icon: "📊",
      title: "Marknadspriser",
      text: "Medianpris per m² på varje ort, beräknat på portalens publicerade annonser.",
      cta: "Se priser",
      href: "/precios",
    },
    {
      icon: "📋",
      title: "Att köpa i Spanien",
      text: "Vad ett köp kostar utöver priset, vilka papper som gäller och vad de spanska begreppen betyder.",
      cta: "Läs guiden",
      href: "/guias",
    },
  ],

  proKicker: "För mäklare och byråer",
  proTitle: "Säljer du bostäder till svenska köpare?",
  proText:
    "Lägg upp hela ditt bestånd, visa upp byrån med en verifierad profil och få förfrågningarna direkt. Ingen kostnad per annons, ingen kostnad per förfrågan och ingen provision på dina affärer.",
  proBullets: [
    "✓ Obegränsat antal annonser i gratisplanen",
    "✓ Publik profil för byrån och för varje mäklare",
    "✓ Import av beståndet från kalkylblad eller länk",
    "✓ Panel med förfrågningarna för varje bostad",
  ],
  proMore: "Läs mer",
  proPlans: "Se planer →",
  proAgencyCardTitle: "Katalog över byråer",
  proAgencyCardText: "Se vilka som redan lägger upp sitt bestånd på portalen.",
  proProjectsCardTitle: "Byggherrar och projekt",
  proProjectsCardText:
    "Nyproduktion — på ritning, under byggnation och inflyttningsklart.",

  ctaTitle: "Annonsera din bostad gratis",
  ctaText:
    "Nå svenska köpare som letar bostad i Spanien. Enkelt, snabbt och utan kostnad.",
  ctaButton: "Annonsera nu",
  ctaEmail: "eller skriv till oss",

  newsletterTitle: "Bostadstips från Spanien, en gång i veckan",
  newsletterText:
    "Utvalda bostäder, signaler från marknaden och det senaste från branschen — i din inkorg. Ingen spam, avsluta när du vill.",

  faqTitle: "Vanliga frågor",
  faqSubtitle: (brand: string) => `Allt du behöver veta om ${brand}.`,
  faqMore: "Se alla frågor →",
} as const;

/** National operation hubs: /kopa, /hyra, /korttidshyra. */
export const svHub = {
  copy: {
    venta: {
      h1: "Bostäder till salu i Spanien",
      lead: "Villor, lägenheter, tomter och lokaler till salu i hela Spanien. Varje annons visar priset i euro, ungefärligt pris i kronor och vad köpet kostar utöver priset.",
      label: "Till salu",
      cityLabel: "Köpa i",
    },
    alquiler: {
      h1: "Bostäder att hyra i Spanien",
      lead: "Lägenheter, villor, kontor och lokaler att hyra långsiktigt i hela Spanien. Direktkontakt med ägaren eller byrån, utan provision från portalen.",
      label: "Uthyres",
      cityLabel: "Hyra i",
    },
    alquiler_vacacional: {
      h1: "Korttidsuthyrning i Spanien",
      lead: "Semesterboenden och korttidsuthyrning i hela Spanien. Där regionen kräver en turistuthyrningslicens visar vi numret i annonsen.",
      label: "Korttidsuthyrning",
      cityLabel: "Hyra korttid i",
    },
  } as Record<
    string,
    { h1: string; lead: string; label: string; cityLabel: string }
  >,
  breadcrumbHome: "Start",
  count: (total: string) => `${total} publicerade bostäder`,
  byTypeTitle: "Efter bostadstyp",
  byTypeSubtitle: (opLabel: string) =>
    `Välj vad du letar efter. Siffrorna är annonser publicerade i dag under ${opLabel}.`,
  byCityTitle: "Efter ort",
  byCitySubtitle:
    "Alla orter med aktivt utbud, sorterade efter antal annonser.",
  latestTitle: "Senast publicerade",
  latestNoteLead: "Letar du i ett bestämt område? Gå in på",
  latestNoteTail: "och filtrera på område, pris och antal sovrum.",
  emptyBody: (opLabel: string) =>
    `Det finns inga publicerade bostäder under ${opLabel} ännu.`,
  emptyCta: "Lägg upp den första",
  ctaTitleSale: "Säljer du en bostad?",
  ctaTitleRent: "Har du en bostad att hyra ut?",
  ctaText:
    "Annonsera den gratis och nå dem som letar i ditt område.",
  ctaPrimary: "Annonsera gratis",
  ctaSecondary: "Vad är den värd?",
} as const;

/** Category grid: /[affar]/[...segments]. */
export const svCategory = {
  operationLabel: {
    venta: "till salu",
    alquiler: "uthyres",
    alquiler_vacacional: "korttidsuthyrning",
  } as Record<string, string>,
  typeLabel: {
    villa: "Villor",
    apartamento: "Lägenheter",
    atico: "Takvåningar",
    adosado: "Radhus",
    duplex: "Etagelägenheter",
    finca: "Lantegendomar",
    terreno: "Tomter",
    local: "Lokaler",
  } as Record<string, string>,
  typeLabelAny: "Bostäder",
  /** "Villor till salu i Nueva Andalucía, Marbella" */
  title: (typeLabel: string, opLabel: string, where: string) =>
    `${typeLabel} ${opLabel} i ${where}`,
  titlePaged: (title: string, page: number) => `${title} — sida ${page}`,
  metaNotFound: "Hittades inte",
  metaDescription: (count: number, title: string, brand: string) =>
    `${count} ${title.toLowerCase()} på ${brand}. Pris i euro, ungefärligt pris i kronor och vad köpet kostar utöver priset.`,
  breadcrumbHome: "Start",
  count: (n: number) =>
    `${n} ${n === 1 ? "tillgänglig bostad" : "tillgängliga bostäder"}.`,
  emptyTypeNotice: (typeLabel: string, opLabel: string, city: string) =>
    `Det finns inga ${typeLabel.toLowerCase()} ${opLabel} i ${city} just nu. Vi visar alla bostäder i ${city} i stället.`,
  viewSwitchLabel: "Vy",
  viewList: "Lista",
  viewMap: "Karta",
  filterEmpty: "Inga bostäder matchar de här filtren.",
  filterEmptyClear: "Rensa filter",
  paginationLabel: "Sidnavigering",
  paginationPrev: "← Föregående",
  paginationNext: "Nästa →",
  paginationStatus: (page: number, total: number) =>
    `Sida ${page} av ${total}`,
} as const;

/** Property detail: /bostad/[slug]. */
export const svListing = {
  metaNotFound: "Bostaden hittades inte",
  metaTitle: (title: string, price: string) => `${title} — ${price}`,
  ogTitle: (title: string, brand: string) => `${title} — ${brand}`,
  stateLabel: {
    obra_nueva: "Nyproduktion, inflyttningsklar",
    sobre_plano: "Köp på ritning",
    en_construccion: "Under byggnation",
    segunda_mano: "Befintlig bostad",
  } as Record<string, string>,
  breadcrumbHome: "Start",
  breadcrumbLabel: "Brödsmulor",

  galleryEmpty: "Bilder kommer",
  galleryThumbAlt: (title: string, n: number) => `${title} — bild ${n}`,
  galleryMore: (n: number) => `+${n} bilder`,

  factBedrooms: (n: number) => `${n} sovrum`,
  factBathrooms: (n: number) => `${n} badrum`,
  factParking: (n: number) => `${n} p-platser`,
  factArea: (m2: number) => `${m2} m²`,

  priceRentLabel: "Hyra",
  priceRentPeriod: "/mån",
  /** The kronor line and its disclosure — see src/lib/format.ts. */
  priceSekNote: "Ungefärligt pris i kronor, omräknat från euro.",

  /**
   * The acquisition-cost block — what the purchase costs on top of the price.
   * `null` from `acquisitionCost()` means this whole block does not render;
   * there is never a zero and never a "contact us for an estimate".
   */
  acquisitionTitle: "Vad köpet kostar utöver priset",
  acquisitionIntro: (region: string) =>
    `Uppskattning för ${region}. Överlåtelseskatten sätts av regionen, så samma köp kostar olika mycket i olika delar av Spanien.`,
  acquisitionLineLabel: {
    itp: "Överlåtelseskatt (ITP)",
    iva: "Moms (IVA)",
    ajd: "Stämpelskatt (AJD)",
    notary: "Notarie",
    registry: "Fastighetsregister",
    legal: "Juridiskt ombud och gestoría",
  } as Record<string, string>,
  acquisitionTotal: "Summa tillkommande kostnader",
  acquisitionGrandTotal: "Pris plus kostnader",
  acquisitionBasisNew:
    "Beräknat som nyproduktion: moms och stämpelskatt i stället för överlåtelseskatt.",
  acquisitionBasisResale:
    "Beräknat som befintlig bostad: överlåtelseskatt (ITP).",
  acquisitionFoot:
    "En uppskattning, inte en offert. Notarie- och registeravgifter är trappade och juridiskt arvode avtalas per uppdrag. Skattesatserna ändras med regionens budget — kontrollera dem alltid innan du skriver på.",

  detailsTitle: "☰ Uppgifter om bostaden",
  detailBarrio: "Område",
  detailCity: "Ort",
  detailType: "Typ",
  detailState: "Skick",
  detailBuilt: "Byggd yta",
  detailUsable: "Användbar yta",
  detailPlot: "Tomt",
  detailYearBuilt: "Byggår",
  detailParking: "Parkering",

  /**
   * The legal block. Two lines that must never merge: what the seller states,
   * and what the portal has verified.
   */
  legalTitle: "⚖️ Juridik och energi",
  legalSellerSays: "Säljaren uppger",
  legalWeVerified: "Vi har kontrollerat",
  legalStatusLabel: {
    escritura_registrada: "Lagfaren och inskriven i fastighetsregistret",
    obra_nueva_lpo: "Nyproduktion med inflyttningstillstånd (LPO)",
    sin_lpo: "Saknar inflyttningstillstånd (licencia de primera ocupación)",
    en_regularizacion: "Under regularisering (AFO/DAFO eller motsvarande)",
    desconocido: "Säljaren har inte uppgett detta",
  } as Record<string, string>,
  legalStatusWarning:
    "En bostad utan inflyttningstillstånd kan vara svår att belåna, hyra ut och sälja vidare. Låt ett eget ombud kontrollera saken innan du betalar handpenning.",
  chargesStatusLabel: {
    libre_de_cargas: "Fri från inteckningar och belastningar",
    con_hipoteca: "Belastad med inteckning",
    con_cargas: "Har andra belastningar",
    desconocido: "Säljaren har inte uppgett detta",
  } as Record<string, string>,
  notaSimpleSeen: (date: string) =>
    `Vi har läst en nota simple från fastighetsregistret (${date}).`,
  notaSimpleUnseen:
    "Vi har ännu inte sett någon nota simple för den här bostaden. Uppgiften ovan är säljarens, inte vår kontroll.",
  catastralLabel: "Referencia catastral",
  catastralHint:
    "Fastighetens officiella beteckning i det spanska fastighetsregistret. Du kan slå upp den själv hos Sede Electrónica del Catastro.",
  energyTitle: "Energi",
  energyRatingLabel: "Energiklass",
  energyEmissionsLabel: "Utsläppsklass",
  energyPending: "Certifikatet är under handläggning",
  energyExempt: "Bostaden är undantagen från kravet på energicertifikat",
  energyConsumption: (kwh: string) => `${kwh} kWh/m² och år`,
  energyCo2: (co2: string) => `${co2} kg CO₂/m² och år`,
  vpoWarning:
    "VPO — prisreglerad bostad. Priset och vidareförsäljningen är begränsade i lag, och i praktiken kan en utländsk köpare utan hemvist i Spanien sällan köpa den.",
  landClassificationLabel: {
    urbano: "Detaljplanerad mark (suelo urbano)",
    urbanizable: "Planlagd för framtida bebyggelse (suelo urbanizable)",
    rustico: "Jordbruksmark (suelo rústico)",
  } as Record<string, string>,
  landRusticWarning:
    "På jordbruksmark får man i regel inte bygga bostadshus. Kontrollera alltid med kommunen vad marken faktiskt tillåter innan du köper.",
  touristLicenceLabel: "Turistuthyrningslicens",
  touristLicenceNone:
    "Ingen licens angiven. Korttidsuthyrning kräver registrering i flera regioner.",

  runningCostsTitle: "🧾 Löpande kostnader",
  ibiLabel: "IBI, kommunal fastighetsskatt",
  ibiPeriod: "/år",
  communityLabel: "Samfällighetsavgift",
  communityPeriod: "/mån",
  runningCostsNote:
    "Samfällighetsavgiften i ett område med pool och trädgårdar överstiger ofta fastighetsskatten. Den är den kostnad svenska köpare oftast missar.",

  amenitiesTitle: "✨ Bekvämligheter",
  descriptionTitle: "📄 Beskrivning",
  machineTranslatedNote:
    "Den här beskrivningen är maskinöversatt från säljarens spanska text. Vid tveksamhet gäller originalet.",
  showOriginal: "Visa originaltexten på spanska",
  locationTitle: "📍 Ungefärligt läge",

  sellerFallback: (brand: string) => `Publicerad på ${brand}`,
  sellerVerified: "Verifierad",
  sellerKindAgency: "Mäklarbyrå",
  sellerKindAgent: "Mäklare",
  /** FSBO: the listing was published by its owner, not by a professional. */
  sellerKindOwner: "Privatperson",
  /**
   * A relocation partner is on the buyer's side and earns from the
   * introduction. Materially different to a selling agent, so the card labels
   * it rather than blurring it into "byrå".
   */
  sellerKindRelocation: "Relocation-partner",
  sellerRelocationNote:
    "Företräder köparen, inte säljaren, och får ersättning för förmedlingen.",

  contactTitle: "Intresserad av den här bostaden?",
  contactSubtitle:
    "Hör av dig i dag för mer information eller för att boka en visning.",

  similarTitle: "Liknande bostäder",
  fromAgencyTitleLead: "Fler från",
  fromAgencyFallback: "den här byrån",

  moreInBarrio: (barrio: string) => `📍 Fler bostäder i ${barrio}`,
  moreInCity: (city: string) => `🏙 Alla bostäder i ${city}`,

  ctaBarContact: "Kontakta säljaren",
  ctaBarConsult: "Skicka förfrågan",

  publishedToday: "Publicerad i dag",
  publishedYesterday: "Publicerad i går",
  publishedDaysAgo: (n: number) => `Publicerad för ${n} dagar sedan`,
  publishedWeeksAgo: (n: number) => `Publicerad för ${n} veckor sedan`,
  publishedMonthsAgo: (n: number) => `Publicerad för ${n} månader sedan`,
} as const;
