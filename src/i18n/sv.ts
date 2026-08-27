/**
 * Canonical Swedish strings (docs/SPAIN-PORTAL-DESIGN.md, i18n handoff) — the
 * i18n sv base. Buyer-facing copy for flyttatillspanien.se: Spanish property,
 * Swedish buyers. Currency is EUR (SEK shown only as an approximation, see
 * src/lib/format.ts). Contact is email-first for buyers; WhatsApp/phone stays
 * the agency-side channel.
 */

export const sv = {
  searchPlaceholder: "Var vill du bo?",
  publishCta: "Publicera gratis",
  contactWhatsapp: "Kontakta via WhatsApp",
  priceAlert: "Meddela mig om priset sänks",
  wizardNext: "Nästa →",
  wizardPrev: "Föregående",
  valuationMagnet: "Vad är din bostad värd? Ta reda på det gratis",
  emptyState:
    "Inga bostäder här ännu — skapa en bevakning så hör vi av oss",
  rentalsHero: "Din nästa plats väntar på dig.",
  inquiryPrefill: "Hej, jag är intresserad av den här bostaden.",
  quickQuestions: ["Är den kvar?", "Kan jag boka visning?", "Vilka villkor gäller?"],
} as const;

export const svContactForm = {
  nameLabel: "Namn",
  namePlaceholder: "Fyll i ditt namn",
  emailLabel: "E-post",
  emailPlaceholder: "Fyll i din e-postadress",
  phoneLabel: "Telefon (valfritt)",
  messageLabel: "Meddelande",
  submitIdle: "Skicka meddelande",
  submitSending: "Skickar…",
  submitSent: "Meddelandet är skickat!",
  continueWhatsapp: "💬 Fortsätt i WhatsApp",
  errorGeneric: "Vi kunde inte skicka din förfrågan. Försök igen om en liten stund.",
  directNote: "✓ Din förfrågan går direkt till säljaren",
  whatsappLink: "💬 WhatsApp",
  showPhone: "📞 Visa telefonnummer",
} as const;

/**
 * Pre-launch notice (src/config/site-status.ts). Says the two things a
 * visitor needs: the listings are samples, and nothing here is an offer.
 * Deliberately plain — a disclosure that reads as marketing isn't one.
 */
export const svSiteNotice = {
  label: "Sidan är under uppbyggnad",
  body: (brand: string) =>
    `Vi förbereder lanseringen av ${brand}. Bostäderna du ser är testexempel: de är inga riktiga objekt till salu och inga kommersiella erbjudanden, och uppgifter och bilder kan sakna motsvarighet i verkligheten.`,
} as const;

/** Valuation tool (/vardering) — the seller-side magnet. Honest by design. */
export const svTasacion = {
  title: "Vad är din bostad värd?",
  subtitle: (brand: string) =>
    `Vi ger dig ett uppskattat intervall baserat på priserna publicerade på ${brand}. Gratis, utan registrering och utan att någon ringer dig om du inte själv ber om det.`,
  cityLabel: "Ort",
  typeLabel: "Bostadstyp",
  operationLabel: "Du vill",
  operationSale: "Sälja",
  operationRent: "Hyra ut",
  areaLabel: "Boyta (m²)",
  areaHint: "Byggnadsyta. Om det är en tomt, ange tomtens yta i m².",
  submit: "Beräkna",
  calculating: "Beräknar…",
  resultTitle: "Uppskattat intervall",
  resultRange: (low: string, high: string) => `Mellan ${low} och ${high}`,
  resultBasis: (n: number, perM2: string, city: string, period: string) =>
    `Beräknat på ${n} jämförbara objekt i ${city} (${period}), med ett medianpris på ${perM2} per m².`,
  resultBandNote: (pct: number) =>
    `Intervallet är ±${pct}%: ju färre jämförbara objekt, desto bredare intervall. Vi vill hellre vara ärliga än exakta.`,
  disclaimer:
    "Viktigt: det här är en referens beräknad på utropspriser, inte slutpriser, och det är ingen officiell värdering. Det verkliga värdet avgörs av objektets skick, exakta läge och marknadsläget just nu.",
  errorBadArea: "Kontrollera ytan: ange ett tal mellan 10 och 100 000.",
  errorUnknownCity: "Välj en ort från listan.",
  errorNoData:
    "Vi har ännu inga jämförbara objekt för den bostadstypen på den orten. Skriv till oss så tittar vi manuellt.",
  errorThinData:
    "Vi har för få jämförbara objekt där för att ge dig ett tillförlitligt tal. Skriv till oss så tittar vi manuellt.",
  errorGeneric: "Vi kunde inte beräkna intervallet. Försök igen.",
  nextTitle: "Vill du publicera den eller få rådgivning?",
  nextBody:
    "Lämna din e-post så kontaktar vi dig. Du kan också publicera bostaden själv, gratis.",
  nameLabel: "Ditt namn",
  whatsappLabel: "Din e-post",
  contactSubmit: "Jag vill bli kontaktad",
  contactSent:
    "Klart! Vi hör av oss. Under tiden kan du publicera din bostad själv.",
  contactError: "Vi kunde inte skicka dina uppgifter. Försök igen.",
  publishCta: "Publicera min bostad",
  publishCtaHint: "Vi tar med uppgifterna du redan fyllt i, så du slipper skriva dem två gånger.",
  seePrices: "Se priser i området",
} as const;

/** Price pages (/priser) — market data, caveats included. */
export const svPrecios = {
  indexTitle: "Bostadspriser i Spanien",
  indexSubtitle: (brand: string) =>
    `Medianpris per ort, beräknat på objekten publicerade på ${brand}. Välj en ort för att se detaljer per bostadstyp.`,
  indexEmpty: "Vi har ännu inte tillräckligt många publicerade objekt för att räkna fram tillförlitliga priser.",
  cityTitle: (city: string) => `Bostadspriser i ${city}`,
  citySubtitle: (brand: string, city: string, period: string) =>
    `Medianpris för köp och uthyrning i ${city}, enligt objekten publicerade på ${brand}${period ? ` (${period})` : ""}.`,
  tableType: "Typ",
  tableOperation: "Affär",
  tableMedian: "Medianpris",
  tableMedianM2: "Per m²",
  tableSample: "Objekt",
  seeListings: "Se objekt",
  fewSamples: "Få objekt — se det som en fingervisning, inte ett marknadspris.",
  methodTitle: "Så räknar vi",
  methodBody: (brand: string) =>
    `Vi använder medianen (inte medelvärdet) av priserna publicerade på ${brand}, per ort och bostadstyp. Medianen påverkas mindre av extrempriser. En grupp med färre än 8 objekt visas med en varning: det är en referens, inte ett marknadspris. Publicerade priser är inte slutpriser.`,
  emptyCity: "Vi har ännu inte tillräckligt med objekt i den här orten för att beräkna ett pris.",
  backToPrices: "← Alla priser",
  relatedPrices: (city: string) => `Vad kostar en bostad i ${city}?`,
  relatedPricesCta: "Se medianpriser",

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
    ` (${params.sample} objekt)`,
  contextThisListing: (perM2: string) => `Denna bostad: ${perM2}/m²`,
  contextOperationLabel: {
    venta: "köp",
    alquiler: "uthyrning",
    alquiler_vacacional: "korttidshyra",
  } as Record<string, string>,
} as const;

/**
 * Panel / auth copy (admin + agency). This is the internal surface (login,
 * review queue, agency dashboard) — never indexed, in Swedish since staff and
 * agencies use the panel in Swedish or English.
 */
export const svPanel = {
  loginTitle: "Logga in på din panel",
  loginSubtitle: "Använd din e-post och ditt lösenord.",
  emailLabel: "E-post",
  passwordLabel: "Lösenord",
  loginSubmit: "Logga in",
  loginError: "Fel e-post eller lösenord.",
  loginLocked: "För många försök. Vänta några minuter innan du försöker igen.",
  logout: "Logga ut",
  loginToRegister: "Har du inget konto än? Registrera dig",

  // Registrering (mäklarbyråer och agenter)
  registerTitle: "Skapa ditt konto",
  registerSubtitle:
    "Lägg upp dina bostäder själv. Det är gratis: vi granskar varje objekt innan det publiceras.",
  registerKindLabel: "Hur arbetar du?",
  registerKindAgency: "Jag har en mäklarbyrå",
  registerKindIndependent: "Jag är fristående agent",
  registerAgencyNameLabel: "Mäklarbyråns namn",
  registerYourNameLabel: "Ditt för- och efternamn",
  registerWhatsappLabel: "Telefon/WhatsApp (valfritt)",
  registerPasswordLabel: "Lösenord",
  registerPasswordHint: "Minst 8 tecken.",
  registerSubmit: "Skapa konto",
  registerToLogin: "Har du redan ett konto? Logga in",
  registerPendingNote:
    "Ditt konto är aktivt direkt. Verifieringen (✓ på din profil) godkänner vi manuellt efter att vi granskat dina uppgifter.",
  registerErrorName: "Skriv ditt fullständiga namn.",
  registerErrorEmail: "Kontrollera e-postadressen.",
  registerErrorEmailTaken: "Det finns redan ett konto med den e-postadressen. Försök logga in.",
  registerErrorPassword: "Lösenordet behöver minst 8 tecken.",
  registerErrorAgencyName: "Skriv mäklarbyråns namn.",
  registerErrorGeneric: "Vi kunde inte skapa kontot. Försök igen.",
  registerClosedTitle: "Registreringen är stängd just nu",
  registerClosedBody:
    "Vi tar just nu bara in mäklarbyråer vi kontaktar direkt. Hör av dig till oss så tar vi kontakt när vi öppnar upp.",

  // Registrering via mäklarbyråns inbjudan
  registerKindInvite: (agencyName: string) => `Gå med i ${agencyName}`,
  registerInviteNote: (agencyName: string, role: string) =>
    `${agencyName} har bjudit in dig att gå med i teamet som ${role}. Skapa ditt konto så hamnar dina objekt hos den mäklarbyrån.`,
  registerErrorInvite:
    "Den inbjudan gäller inte längre: den kan ha gått ut eller redan använts. Be mäklarbyrån skicka en ny.",

  // Inbjudan accepterad med ett befintligt konto
  inviteTitle: "Inbjudan till en mäklarbyrå",
  inviteJoinBody: (agencyName: string, role: string) =>
    `${agencyName} bjuder in dig att gå med i teamet som ${role}.`,
  inviteJoinNote:
    "Dina redan publicerade objekt förblir dina. Nya objekt registreras i mäklarbyråns namn.",
  inviteJoinSubmit: (agencyName: string) => `Gå med i ${agencyName}`,
  inviteBackToPanel: "← Tillbaka till din panel",
  inviteInvalid:
    "Den inbjudan gäller inte längre: den kan ha gått ut eller redan använts. Be mäklarbyrån skicka en ny.",
  inviteAlreadyInAgency: "Du tillhör redan en mäklarbyrå. Be dem ta bort dig innan du går med i en annan.",
  inviteNotForAdmin: "Du använder sidans administratörskonto; det går inte att koppla till mäklarbyråer.",
  inviteNoProfile: "Ditt konto saknar ännu en agentprofil. Skriv till oss för att aktivera den.",

  // Profil (mäklarbyrå + agent)
  profileTab: "Din profil",
  profileAgencyTitle: "Mäklarbyråns uppgifter",
  profileAgencyReadOnly: "Endast mäklarbyråns administratörskonto kan ändra dessa uppgifter.",
  profileAgentTitle: "Din offentliga profil",
  profileAccountTitle: "Ditt konto",
  profileNoAgency: "Du arbetar som fristående agent, så det finns ingen mäklarbyrå att redigera.",
  profileLogoLabel: "Logotyp (URL)",
  profilePhotoLabel: "Foto (URL)",
  profileWhatsappLabel: "Telefon/WhatsApp",
  profileEmailLabel: "Kontakt-e-post",
  profileSave: "Spara",
  profileSaved: "Uppgifterna uppdaterade.",
  profileAgencySaved: "Mäklarbyråns uppgifter uppdaterade.",
  profileAccountSaved: "Ditt konto har uppdaterats.",
  profilePasswordChanged: "Lösenordet uppdaterat. Vi har loggat ut övriga öppna sessioner.",
  profileEmailTaken: "Den e-postadressen används redan av ett annat konto.",
  profileForbidden: "Du har inte behörighet att ändra dessa uppgifter.",
  profileInvalid: "Kontrollera de angivna uppgifterna.",
  profileBadPassword:
    "Ditt nuvarande lösenord stämmer inte. För att ändra e-post eller lösenord behöver vi bekräfta det.",
  currentPasswordLabel: "Nuvarande lösenord",
  currentPasswordHint: "Behövs bara om du ändrar e-post eller anger ett nytt lösenord.",
  profileVerifiedNote: (brand: string) => `Profil verifierad av ${brand}.`,
  profilePendingNote: "Verifiering väntar på godkännande.",

  // Mäklarbyråns team (/agencia/equipo) — endast för ansvarig
  teamTab: "Ditt team",
  teamTitle: "Ditt team",
  teamHint:
    "De som visas här delar mäklarbyråns objekt och förfrågningar. Endast den ansvarige kan bjuda in, befordra eller ta bort.",
  teamEmpty: "Det finns ingen mer i ditt team ännu.",
  teamRoleLabel: "Roll",
  teamRoleAgent: "Agent",
  teamRoleAdmin: "Ansvarig",
  teamRoleSuperAdmin: "Sidans administratör",
  teamRoleNoLogin: "Inget konto",
  teamNoLoginHint: "Profil utan konto: hanteras av sidans administratör.",
  teamPromote: "Gör till ansvarig",
  teamDemote: "Sätt som agent",
  teamRemove: "Ta bort från teamet",
  teamRemoveWarning:
    "Personen slutar se mäklarbyråns objekt och förfrågningar och blir återigen fristående agent. Kontot raderas inte, och objekten personen lagt upp blir kvar hos mäklarbyrån.",
  teamRemoveConfirm: "Ja, ta bort från teamet",
  teamRoleSaved: "Rollen uppdaterad.",
  teamMemberRemoved: "Den personen tillhör inte längre ditt team.",
  teamJoined: "Klart! Du är nu med i teamet.",
  teamLastAdminError: "Mäklarbyrån måste ha minst en ansvarig. Utse någon annan innan du gör den här ändringen.",
  teamSelfRoleError: "Du kan inte ändra din egen roll.",
  teamSelfRemoveError: "Du kan inte ta bort dig själv från teamet.",

  // Inbjudningar
  teamInviteTitle: "Bjud in en agent",
  teamInviteHint: (days: number) =>
    `Skapa en länk och skicka den. Den gäller en gång och går ut om ${days} dagar. Den som öppnar den ser mäklarbyråns namn innan kontot skapas.`,
  teamInviteCreate: "Skapa länk",
  teamInviteCreated: "Länk skapad. Kopiera den och skicka till personen.",
  teamInviteRevoke: "Återkalla",
  teamInviteRevoked: "Länken återkallad.",
  teamInvitesEmpty: "Inga väntande inbjudningar.",
  teamInviteUrlLabel: (role: string, expires: string) =>
    `Länk för att lägga till en ${role.toLowerCase()} — går ut ${expires}`,

  // Admin
  adminReviewTitle: "Granskningskö",
  adminReviewEmpty: "Inga objekt väntar på granskning. 🎉",
  approve: "Godkänn",
  reject: "Avvisa",
  rejectReasonLabel: "Anledning till avvisning",
  rejectReasonPlaceholder: "Berätta för utgivaren varför (t.ex. bilder med vattenstämpel)",
  adminAgenciesTitle: "Mäklarbyråer och agenter",
  adminAgencyNewTitle: "Skapa mäklarbyrå",
  adminAgencyNewHint:
    "Skapar mäklarbyråns profil. Startar overifierad: använd knappen i listan för att ge den ✓. Skapar inte en användare — det görs under Användare, med \"Koppla\". Syns i den offentliga katalogen först när den har ett publicerat objekt.",
  agencyNameLabel: "Mäklarbyråns namn",
  agencyWhatsappLabel: "Telefon/WhatsApp",
  agencyEmailLabel: "Kontakt-e-post",
  planLabel: "Plan",
  createAgency: "Skapa mäklarbyrå",
  agencyCreated: "Mäklarbyrå skapad. Den är fortfarande overifierad.",
  agencyInvalid: "Kontrollera uppgifterna: namn krävs.",
  verify: "Verifiera",
  unverify: "Ta bort verifiering",
  verifiedBadge: "✓ Verifierad",
  notVerifiedBadge: "Ej verifierad",

  // Admin — användare
  adminUsersTitle: "Användare",
  navMain: "Panelens sektioner",
  navManage: "Administration",
  adminUsersEmpty: "Inga användare ännu.",
  adminUsersNewTitle: "Skapa användare",
  adminUsersListTitle: "Panelens användare",
  nameLabel: "Namn",
  roleLabel: "Roll",
  localeLabel: "Språk",
  agencyLabel: "Mäklarbyrå",
  agencyNone: "Fristående",
  newPasswordLabel: "Nytt lösenord",
  newPasswordHint: "Lämna tomt för att inte ändra det.",
  createUser: "Skapa användare",
  saveUser: "Spara",
  deleteUser: "Radera",
  linkAgency: "Koppla",
  noPasswordBadge: "Inget lösenord",
  userEmailTaken: "Den e-postadressen används redan av ett annat konto.",
  userSelfRoleError: "Du kan inte ändra din egen roll.",
  userSelfDeleteError: "Du kan inte radera ditt eget konto.",
  userLastAdminError: "Du kan inte ta bort den sista administratören.",
  userCreated: "Användare skapad.",
  userSaved: "Användare uppdaterad.",
  userDeleted: "Användare raderad.",
  userPasswordReset: "Lösenordet uppdaterat. Användarens öppna sessioner har loggats ut.",
  userAgencyLinked: "Kopplingen till mäklarbyrån uppdaterad.",

  // Admin — agenter och mäklarbyråer
  adminAgentsTitle: "Agenter",
  adminAgentsHint:
    "Flytta en agent från en mäklarbyrå till en annan, eller sätt som fristående. Objekt som redan lagts upp stannar hos den mäklarbyrå som publicerade dem.",
  adminAgentsEmpty: "Inga agenter ännu.",
  adminAgentMove: "Flytta",
  adminAgentMoved: "Agent uppdaterad.",
  adminAgentLastAdminError: "Den agenten är den enda ansvariga för sin mäklarbyrå. Utse någon annan innan du flyttar dem.",
  adminAgentProtectedError: "Det kontot är sidans administratörskonto: det flyttas inte mellan mäklarbyråer.",
  adminAgentProtectedHint: "Sidans administratörskonto. Rollen ändras under Användare.",
  adminAgentNoLoginHint: "Den här profilen saknar konto ännu: du kan flytta den mellan mäklarbyråer, men rollen gäller först när den har ett konto.",
  adminAgencyNoAdminOption: (name: string) => `${name} (ingen ansvarig)`,
  adminAgenciesWithoutAdmin: (names: string) =>
    `Dessa mäklarbyråer saknar ansvarig: ${names}. Utse någon med rollen "Ansvarig" så att de kan hantera sitt team.`,

  // Admin — alla förfrågningar
  adminLeadsTitle: "Förfrågningar",
  adminLeadsHint:
    "Alla förfrågningar som kommer in via sidan, från vilken mäklarbyrå eller agent som helst. De märkta \"Intern\" är dina att hantera.",
  adminLeadsEmpty: "Inga förfrågningar med det filtret.",
  adminLeadsSearchLabel: "Sök på namn, telefon eller e-post",

  // Admin — alla bostäder
  adminListingsTitle: "Bostäder",
  adminListingsEmpty: "Inga bostäder med det filtret.",
  searchListingsLabel: "Sök på titel eller kod",
  searchSubmit: "Sök",
  filterAll: "Alla",
  editListing: "Redigera",
  viewListing: "Visa objekt",
  backToListings: "← Tillbaka till bostäder",

  // Listing edit form (shared: admin + agency)
  listingTitleLabel: "Objektets titel",
  listingDescriptionLabel: "Beskrivning",
  listingOperationLabel: "Affär",
  listingTypeLabel: "Bostadstyp",
  listingPriceLabel: "Pris",
  listingCurrencyLabel: "Valuta",
  listingBedroomsLabel: "Sovrum",
  listingBathroomsLabel: "Badrum",
  listingParkingLabel: "Parkering",
  listingAreaLabel: "Boyta (m²)",
  listingLandLabel: "Tomt (m²)",
  listingLocationLabel: "Läge",
  listingVideoLabel: "Video (URL)",
  listingForeignLabel: "Visa även för köpare utomlands",
  saveListing: "Spara ändringar",
  deleteListing: "Radera objekt",
  deleteListingWarning:
    "Raderas permanent, tillsammans med bilderna. Om du bara vill dölja det från sidan, använd statusen \"Borttagen\".",
  listingSaved: "Objekt uppdaterat.",
  listingDeleted: "Objekt raderat.",
  listingNotFound: "Vi hittade inte det objektet.",
  listingInvalid: "Kontrollera uppgifterna: obligatoriska fält saknas.",

  // Bilder (shared: admin + agency)
  photosTitle: "Bilder",
  photosEmpty: "Det här objektet saknar ännu bilder.",
  photosHint:
    "Den första bilden är omslaget: den som visas i listorna. Du kan ladda upp flera samtidigt (JPG, PNG, WebP eller HEIC, upp till 12 MB var).",
  photosAddLabel: "Lägg till bilder",
  photosUpload: "Ladda upp",
  photosCover: "Omslag",
  photosMakeCover: "Gör till omslag",
  photosMoveUp: "Flytta tidigare",
  photosMoveDown: "Flytta senare",
  photosDelete: "Radera",
  photosDeleteConfirm: "Radera den här bilden? Går inte att ångra.",
  photosUploaded: "Bilder uppladdade.",
  photosDeleted: "Bild raderad.",
  photosReordered: "Ordningen uppdaterad.",
  photosNoFiles: "Du valde inga bilder.",
  photosTooManyFiles: "Det är för många bilder på en gång. Ladda upp max 20 åt gången.",
  photosRejected: "Vissa bilder kunde inte laddas upp.",
  photosNotConfigured: "Bildlagringen är ännu inte konfigurerad (R2-nycklar saknas). Meddela administratören.",
  photosPlaceholderNote: "Exempelbild från importen — byt ut mot riktiga bilder på bostaden.",

  // Agency
  agencyListingsTitle: "Dina bostäder",
  agencyAddListingCta: "Publicera bostad",
  agencyListingsEmpty: "Du har ännu inga upplagda bostäder.",
  agencyLeadsTitle: "Mottagna förfrågningar",
  agencyLeadsEmpty: "Du har ännu inte fått några förfrågningar.",
  agencyWelcome:
    "Välkommen! Ditt konto är klart. Lägg upp din första bostad så granskar vi den innan publicering.",
  agencyNoLink: "Din användare är ännu inte kopplad till en mäklarbyrå. Skriv till oss för att aktivera det.",
  statusLabel: "Status",

  // Importera från en länk (3.5)
  importTab: "Importera",
  importTitle: "Hämta ditt objekt från en annan sida",
  importSubtitle:
    "Klistra in länken till DITT objekt så fyller vi i formuläret åt dig. Det blir ett utkast: du granskar uppgifterna, lägger till bilder och skickar in det för publicering.",
  importUrlLabel: "Länk till ditt objekt",
  importFetch: "Läs länken",
  importReading: "Läser…",
  importOwnershipLabel:
    "Jag intygar att det här objektet är mitt (eller att mäklarbyrån gett mig tillstånd att publicera det) och att jag får använda dess text och bilder.",
  importOwnershipRequired: "Vi behöver att du bekräftar att objektet är ditt innan vi importerar det.",
  importReviewTitle: "Granska det vi läste in",
  importReviewHint:
    "Rätta det som behövs. Det vi inte kunde läsa lämnades avsiktligt tomt: vi föredrar ett tomt fält framför en påhittad uppgift.",
  importCreate: "Skapa utkast",
  importPhotosNote:
    "Bilderna kopieras inte automatiskt. Ladda upp dem från objektets redigeringsvy — så behåller du dina egna bilder, utan en annan sidas vattenstämpel.",
  importCreated: "Utkast skapat. Granska det, lägg till bilder och skicka in för publicering.",
  importDuplicate: "Den länken har redan importerats tidigare:",
  importDuplicateFlash: "Den länken har redan importerats tidigare — inget dubblettobjekt skapades.",
  importLocationLabel: "Läge (bekräfta eller rätta)",

  // Massimport (/admin/importar)
  adminImportTitle: "Importera kalkylblad",
  adminImportSubtitle:
    "Ladda upp en mäklarbyrås fil (.csv eller .xlsx). Vi visar först vad som kommer hända med varje rad; först därefter skrivs något.",
  importRollbackHint:
    "Varje batch kan återställas efteråt: objekt den skapade tas bort och objekt den ändrade återställs. De som redan fått förfrågningar eller är publicerade behålls, och vi meddelar vilka.",
  importJobsTitle: "Importerade batcher",
  importJobsEmpty: "Du har ännu inte importerat något kalkylblad.",
  importJobRollback: "Återställ den här batchen",
  importJobRolledBack: "Batchen återställd.",
  importJobRollbackFailed: "Vi kunde inte återställa den batchen.",
  importPermissionMissing: "Inget registrerat tillstånd",
  importErrorBadUrl: "Den länken verkar inte giltig. Kopiera den helt, med https://",
  importErrorBlocked: "Vi kan bara läsa offentliga länkar på internet.",
  importErrorUnreachable:
    "Vi kunde inte öppna den sidan. Den kan vara nere eller blockera externa läsare — lägg upp objektet manuellt.",
  importErrorNotHtml: "Den länken är inte en webbsida med ett objekt.",
  importErrorTooLarge: "Den sidan är för stor för att läsas.",
  importErrorGeneric: "Vi kunde inte läsa den länken. Prova att lägga upp objektet manuellt.",
  importErrorRateLimited: "Du importerar för ofta. Vänta några minuter och försök igen.",
  importLegalNote: "Vi importerar ett objekt i taget, på uppdrag av dess ägare. Vi kopierar inte kataloger från andra sidor.",

  // Statistik per objekt (3.3)
  statsViews: "Visningar",
  statsLeads: "Förfrågningar",
  statsWindow: "Senaste 30 dagarna",
  statsSummary: "Senaste 30 dagarna",
  statsNoData: "Inga visningar registrerade ännu. Statistiken börjar räknas när objektet publiceras.",
  statsViewsHint: "Mänskliga besök: vi räknar inte bort sökmotorer och bottar för att siffran ska betyda något.",
  saveStatus: "Spara",
  contactLead: "Svara via WhatsApp",
  alertNewLeadTitle: "Ny förfrågan på sidan",
  alertNewLeadDetail: (params: {
    leadType: string;
    name: string | null;
    whatsapp: string;
    listingTitle: string | null;
  }) =>
    [
      `${params.leadType} · ${params.name ?? "Inget namn"} (${params.whatsapp})`,
      params.listingTitle ? `Objekt: ${params.listingTitle}` : null,
    ]
      .filter(Boolean)
      .join(" — "),
  alertReviewTitle: "Ett objekt väntar på granskning",
  alertReviewDetail: (title: string, verified: boolean) =>
    `${title}${verified ? " · verifierad kontakt" : " · overifierad kontakt"}`,
  adminLeadsRecent: (n: number) =>
    n === 1 ? "1 ny förfrågan de senaste 24 timmarna" : `${n} nya förfrågningar de senaste 24 timmarna`,
  leadOwnerRouted: "Privatperson",
  forwardLead: "Vidarebefordra till säljaren",
  forwardLeadMessage: (params: {
    listingTitle: string | null;
    name: string | null;
    whatsapp: string;
    message: string | null;
  }) =>
    [
      `Du har en förfrågan${params.listingTitle ? ` om ditt objekt: ${params.listingTitle}` : ""}.`,
      `Från: ${params.name ?? "Inget namn"} (${params.whatsapp})`,
      params.message ? `Meddelande: ${params.message}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  statusPendingNote: "Under granskning: vi publicerar det så snart vi godkänt det. Du behöver inte göra något.",
  statusRejectedNote: "Ej godkänt. Rätta det under \"Redigera\" och skicka in igen.",
  statusRejectedReason: "Anledning",
  statusReviewNote:
    "För att publicera ett objekt, sätt det till \"Under granskning\": vi granskar och publicerar det. Det är så vi kan garantera köparen att varje objekt har granskats av en person.",
} as const;

/**
 * The private seller's panel, /mina-annonser (PLAN.md D8).
 */
export const svOwner = {
  panelTitle: "Dina annonser",
  listingsTab: "Dina annonser",
  leadsTab: "Förfrågningar",

  listingsTitle: "Dina annonser",
  listingsEmpty: "Du har ännu inte publicerat någon annons. När du gör det ser du den här.",
  addListingCta: "Publicera en bostad",

  statusReviewNote:
    "För att din annons ska publiceras, sätt den till \"Under granskning\": vi granskar och publicerar den. Det är så vi kan garantera köparen att varje annons har granskats av en person.",

  editListing: "Redigera",
  backToListings: "← Tillbaka till dina annonser",
  viewListing: "Visa den publicerade annonsen",
  saveStatus: "Spara",
  statusLabel: "Status",

  leadsTitle: "Förfrågningar om dina annonser",
  leadsEmpty: "Du har ännu inte fått några förfrågningar. När någon är intresserad av din bostad visas uppgifterna här.",
  contactLead: "Svara via e-post",

  leadsNote: "Dessa personer lämnade sina uppgifter för att prata med dig. Svara så snart du kan: förfrågningar svalnar snabbt.",
} as const;

/** Swedish strings for the publish wizard. */
export const svPublish = {
  pageTitle: "Publicera din bostad",
  pageSubtitle: "Fyll i det i tre steg. Vi sparar automatiskt, så du kan avsluta när du vill.",

  prefillNote: "Vi har fyllt i det du redan angav i värderingen. Granska och fortsätt — du kan ändra alla uppgifter.",

  stepLabels: ["Detaljer", "Läge", "Pris och publicering"] as const,

  // Steg 1
  operationLabel: "Vad vill du göra?",
  propertyTypeLabel: "Bostadstyp",
  titleLabel: "Objektets titel",
  titlePlaceholder: "Nybyggd villa i Nueva Andalucía",
  descriptionLabel: "Beskrivning",
  descriptionPlaceholder: "Berätta vad som gör bostaden speciell: skick, extrafunktioner, närhet…",
  bedroomsLabel: "Sovrum",
  bathroomsLabel: "Badrum",
  parkingLabel: "Parkering",
  areaLabel: "Boyta (m²)",
  landLabel: "Tomt (m²)",

  // Steg 2
  locationLabel: "Läge",
  locationPlaceholder: "Skriv ort eller område",
  locationHint: "Välj område om det finns i listan; annars orten.",
  projectLabel: "Närliggande projekt (valfritt)",
  projectPlaceholder: "Sök en byggnad eller ett nybyggnadsprojekt",
  projectHint: "Koppla din förhandsbokade enhet till projektet så den visas på dess sida.",

  // Steg 3
  priceLabel: "Pris",
  cuotaWith: "med",
  videoLabel: "Video (valfritt)",
  photosTitle: "Bilder",
  photosHint: "Den första bilden är omslaget. Du kan lägga till dem nu eller senare, från din panel.",
  photosPickLabel: "Välj bilder",
  photosUploading: "Laddar upp…",
  photosDelete: "Radera",
  photosDraftFirst: "Fyll i bostadens uppgifter och gå vidare: så snart utkastet är sparat kan du ladda upp bilder.",
  photosStorageOff: "Bildlagringen är ännu inte tillgänglig. Du kan publicera ändå och lägga till bilder senare.",
  photosFailed: "Vissa bilder kunde inte laddas upp. Försök igen.",
  photosTooMany: "Det är för många bilder på en gång. Ladda upp max 20 åt gången.",
  foreignExposureLabel: "Visa även för köpare utomlands — kommer snart",

  // Publicering utan verifiering (ingen meddelandeleverantör konfigurerad)
  publishTitle: "Publicera din annons",
  publishSubtitle: "Lämna din e-post så att intresserade kan kontakta dig. Vi granskar annonsen innan den publiceras.",

  // OTP
  otpTitle: "Verifiera din e-post för att publicera",
  otpSubtitle: "Vi skickar en kod till din e-post. Verifierade annonser visar ✓-märket och skapar mer förtroende.",
  whatsappLabel: "E-postadress",
  codeLabel: "6-siffrig kod",
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
  doneTitle: "Din annons har skickats in!",
  doneBody:
    "Vi granskar den nu. Så snart vi godkänner den publiceras den på sidan. Du kan följa dess status och lägga till bilder från din panel.",
  doneCta: "Gå till min panel",

  errors: {
    operation: "Välj om det är köp eller uthyrning.",
    propertyType: "Välj bostadstyp.",
    title: "Ange en titel på minst 8 tecken.",
    price: "Ange ett giltigt pris.",
    location: "Välj ett läge från listan.",
    invalidNumber: "Kontrollera telefonnumret.",
    otpMismatch: "Koden stämmer inte. Försök igen.",
    otpTooMany: "För många försök. Begär en ny kod.",
    not_found: "Vi hittade inte ditt utkast. Ladda om sidan.",
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
 * Per-listing contact prefill: names the property and links back to it, so
 * the seller knows exactly which listing the message is about.
 */
export function inquiryPrefillFor(brand: string, title: string, url: string): string {
  return `Hej, jag såg den här bostaden på ${brand} och är intresserad: ${title}\n${url}`;
}

/** Public agent profile page (/agent/[slug]) — mirrors the agency profile. */
export const svAgentProfile = {
  notFoundTitle: "Agenten hittades inte",
  kind: "Agent",
  verified: "Verifierad",
  listingsTitle: "Publicerade bostäder",
  listingCount: (n: number) => (n === 1 ? "1 publicerad bostad" : `${n} publicerade bostäder`),
  noListings: "Inga publicerade bostäder för tillfället",
  empty: "Den här agenten har ännu inga publicerade bostäder.",
  contactTitle: "Vill du kontakta den här agenten?",
  contactSubtitle: "Lämna ett meddelande så svarar agenten direkt via WhatsApp.",
  whatsappLink: "💬 WhatsApp",
  agencyPrefix: "Arbetar på",
  metaTitle: (agentName: string) => `${agentName} — Bostäder till salu och uthyrning`,
  metaDescription: (brand: string, agentName: string, n: number) =>
    `${n === 1 ? "1 publicerad bostad" : `${n} publicerade bostäder`} av ${agentName} på ${brand}.`,
} as const;

/**
 * Agent-profile WhatsApp prefill: names the agent and links back to their
 * profile, mirroring inquiryPrefillFor above for listings.
 */
export function agentInquiryPrefillFor(brand: string, agentName: string, url: string): string {
  return `Hej, jag såg din profil på ${brand} och vill kontakta dig: ${agentName}\n${url}`;
}

/* ========================================================================== *
 * Buyer-facing surfaces
 *
 * Home, the operation hubs, the category grid, the search and filter bars,
 * the listing card and the property detail page — the half a visitor
 * actually reads. Read these through `getDictionary(locale)`
 * (src/i18n/index.ts) rather than importing them directly, so a second
 * dictionary (English) can be reintroduced without touching a call site.
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
  budgetUpTo: (amount: number, locale: string) => `Upp till € ${amount.toLocaleString(locale)}`,
  submit: "Sök",
} as const;

/** Category page filter bar — a plain GET form, no client JS. */
export const svFilters = {
  priceMinLabel: "Pris min. (€)",
  priceMinPlaceholder: "Ingen minimigräns",
  priceMaxLabel: "Pris max. (€)",
  priceMaxPlaceholder: "Ingen maxgräns",
  bedroomsLabel: "Sovrum",
  bedroomsAny: "Alla",
  sortLabel: "Sortera efter",
  sortRecent: "Senaste",
  sortPriceAsc: "Lägst pris",
  sortPriceDesc: "Högst pris",
  submit: "Filtrera",
  clear: "Rensa filter",
} as const;

/** Listing card — the grid tile. */
export const svCard = {
  operationBadge: {
    venta: "Till salu",
    alquiler: "Uthyrning",
    alquiler_vacacional: "Korttidshyra",
  } as Record<string, string>,
  featured: "Utvald",
  noPhoto: "Bild kommer snart",
  bedroomsShort: (n: number) => `${n} sovr.`,
  bathrooms: (n: number) => `${n} badrum`,
  area: (m2: number) => `${m2} m²`,
} as const;

/** Home page. */
export const svHome = {
  metaDescription:
    "Villor, lägenheter och tomter till salu och uthyrning på Costa del Sol, Costa Blanca och övriga Spanien — för svenska köpare.",
  publishWaPrefill: (brand: string) => `Hej, jag vill publicera en bostad på ${brand}.`,

  heroKicker: "Spanien · för svenska köpare",
  heroTitleLead: "Hitta din bostad i ",
  heroTitleHighlight: "Spanien",
  heroSubtitle: "Villor, lägenheter och tomter till salu och uthyrning — på svenska, med all juridik du behöver veta.",
  heroSeeListings: "Se bostäder",
  heroSellCta: "Sälj min bostad",
  heroStatCount: (total: string) => `${total} publicerade bostäder`,
  heroStatCountEmpty: "Bostäder i hela Spanien",
  heroStatUpdated: "Uppdateras dagligen",

  zonesKicker: "Områden",
  zonesTitle: "Var vill du bo",
  zonesAll: "Se alla områden →",
  /**
   * The one translatable half of a zone card. Name, slug and photograph are
   * structural and stay in `app/page.tsx`; the strapline is copy, keyed by
   * slug.
   */
  zoneCardSub: {
    marbella: "Costa del Sol — störst utbud",
    torrevieja: "Costa Blanca, prisvärt och soligt",
    palma: "Mallorca, hög standard",
    malaga: "Storstad med flygplats och kultur",
  } as Record<string, string>,

  howTitle: "Så fungerar det",
  howSubtitle: "Sök, jämför och kontakta. Gratis, utan registrering och utan provision.",
  howMore: "Se hela guiden →",
  howSteps: [
    {
      icon: "🔎",
      title: "Sök på område och budget",
      text: "Filtrera på ort, område, bostadstyp och prisintervall. Se resultaten i lista eller på kartan.",
    },
    {
      icon: "📄",
      title: "Se det juridiska läget direkt",
      text: "Energideklaration, lagfartsstatus och belastningar visas på varje objekt — det Idealista inte visar dig.",
    },
    {
      icon: "💬",
      title: "Kontakta direkt",
      text: "Skriv till den som publicerat, direkt från annonsen, utan mellanhänder eller kostnad.",
    },
  ],

  sellKicker: "Sälj",
  sellTitle: "Sälj till svenska köpare",
  sellText:
    "Publicera din bostad gratis och nå köpare från hela Sverige. Vi ger dig ett uppskattat prisintervall baserat på objekt i ditt område, så du vet var du står innan du bestämmer dig.",
  sellImageAlt: "Interiör i ett hus i Spanien",
  sellValuationCta: "Begär värdering",
  sellPublishCta: "Publicera en bostad →",

  investKicker: "Investera",
  investTitle: "Investera i Spanien med fakta, inte magkänsla",
  investText:
    "Vi publicerar medianpriset per m² för varje ort, beräknat på objekten på sidan, och en uppskattning av den totala köpkostnaden — skatt, notarie och lagfart inräknat.",
  investImageAlt: "Solnedgång vid Medelhavet",
  investPricesCta: "Se priser per område",
  investFinancingCta: "Vad kostar det att köpa? →",

  projectsTitle: "🏗 Nya projekt i Spanien",
  projectsSubtitle: "Verifierade nybyggnadsprojekt — lägenheter på ritning, under uppförande och inflyttningsklara.",

  citiesTitle: "Utforska efter ort",

  rowMore: "Se alla →",
  rowRecommended: "Rekommenderade bostäder",
  rowHousesForSale: "Villor till salu — Costa del Sol",
  rowFlatsForSale: "Lägenheter till salu — Costa Blanca",
  rowRentals: "Uthyrning i Spanien",
  rowLand: "Tomter",

  developersTitle: "Utvalda byggherrar",
  developersSubtitle: "Se vilka som bygger landets projekt.",
  developerProjectCount: (n: number) => `${n} ${n === 1 ? "projekt" : "projekt"}`,

  pricesTitle: "📊 Referenspriser per ort",
  pricesMore: "Se alla →",
  pricesSubtitle:
    "Medianpriser per m² beräknade på de publicerade objekten. För att veta om ett objekt ligger i linje med sitt område innan du förhandlar.",
  pricesSample: (n: string) => `${n} objekt analyserade`,

  values: [
    {
      icon: "✅",
      title: "Direktkontakt",
      text: "Du pratar direkt med säljaren eller mäklarbyrån, utan mellanhänder.",
    },
    {
      icon: "📄",
      title: "Juridiken tydlig",
      text: "Energideklaration, lagfartsstatus och belastningar redovisas öppet på varje objekt.",
    },
    {
      icon: "🇸🇪",
      title: "Gjort för svenska köpare",
      text: "Priser i euro med ungefärligt kronbelopp, på svenska, med fokus på det du behöver veta som utländsk köpare.",
    },
  ],

  discoverTitle: (brand: string) => `Upptäck mer på ${brand}`,
  discoverCards: [
    {
      icon: "🏡",
      title: "Publicera din bostad gratis",
      text: "Lägg till bilder, pris och läge på några minuter. Ingen provision, ingen publiceringsavgift.",
      cta: "Publicera nu",
      href: "/publicar",
    },
    {
      icon: "💰",
      title: sv.valuationMagnet,
      text: "Vi ger dig ett uppskattat intervall med priserna publicerade i området. Gratis och utan registrering.",
      cta: "Beräkna gratis",
      href: "/tasacion",
    },
    {
      icon: "📊",
      title: "Marknadspriser",
      text: "Medianpris per m² i varje ort, beräknat på sidans publicerade objekt.",
      cta: "Se priser",
      href: "/precios",
    },
  ],

  proKicker: "För mäklarbyråer och agenter",
  proTitle: "Säljer du bostäder varje dag?",
  proText:
    "Publicera hela ditt utbud, visa din mäklarbyrå med verifierad profil och få förfrågningar direkt till din inkorg. Ingen avgift per objekt, ingen avgift per lead och ingen provision på dina affärer.",
  proBullets: [
    "✓ Obegränsat antal objekt i gratisplanen",
    "✓ Offentlig profil för mäklarbyrån och varje agent",
    "✓ Import av utbud från kalkylblad eller länk",
    "✓ Panel med förfrågningar för varje objekt",
  ],
  proMore: "Läs mer",
  proPlans: "Se planer →",
  proAgencyCardTitle: "Mäklarbyråkatalog",
  proAgencyCardText: "Se vilka som redan publicerar sitt utbud på sidan.",
  proProjectsCardTitle: "Byggherrar och projekt",
  proProjectsCardText: "Nybyggnation, på ritning och inflyttningsklart.",

  ctaTitle: "Publicera din bostad gratis",
  ctaText: "Nå tusentals köpare och hyresgäster i hela Sverige. Enkelt, snabbt och kostnadsfritt.",
  ctaButton: "Publicera nu",
  ctaWhatsapp: "eller skriv till oss",

  newsletterTitle: "Bostadsmöjligheter, en gång i veckan",
  newsletterText:
    "Utvalda bostäder, marknadssignaler och det senaste från branschen — till din inkorg. Inget spam, avsluta när du vill.",

  faqTitle: "Vanliga frågor",
  faqSubtitle: (brand: string) => `Allt du behöver veta om ${brand}.`,
  faqMore: "Se alla frågor →",
} as const;

/** National operation hubs: /kopa, /hyra, /korttidshyra. */
export const svHub = {
  copy: {
    venta: {
      h1: "Bostäder till salu i Spanien",
      lead: "Villor, lägenheter, tomter och lokaler till salu i hela Spanien. Varje objekt visar sin juridiska status, så du vet direkt om siffrorna går ihop.",
      label: "Köp",
      cityLabel: "Köp i",
    },
    alquiler: {
      h1: "Bostäder att hyra i Spanien",
      lead: "Lägenheter, villor, kontor och lokaler att hyra i hela Spanien. Direktkontakt med ägaren eller mäklarbyrån, utan provision.",
      label: "Uthyrning",
      cityLabel: "Hyr i",
    },
    alquiler_vacacional: {
      h1: "Korttidshyra i Spanien",
      lead: "Korta vistelser och säsongsuthyrning i hela Spanien.",
      label: "Korttidshyra",
      cityLabel: "Hyr säsong i",
    },
  } as Record<string, { h1: string; lead: string; label: string; cityLabel: string }>,
  breadcrumbHome: "Start",
  count: (total: string) => `${total} publicerade bostäder`,
  byTypeTitle: "Efter bostadstyp",
  byTypeSubtitle: (opLabel: string) => `Välj vad du letar efter. Antalen är objekt publicerade idag för ${opLabel}.`,
  byCityTitle: "Efter ort",
  byCitySubtitle: "Alla orter med aktivt utbud, sorterade efter antal objekt.",
  latestTitle: "Senaste publiceringar",
  latestNoteLead: "Letar du i ett specifikt område? Gå till",
  latestNoteTail: "och filtrera på område, pris och sovrum.",
  emptyBody: (opLabel: string) => `Det finns ännu inga publicerade bostäder för ${opLabel}.`,
  emptyCta: "Publicera den första",
  ctaTitleSale: "Säljer du en bostad?",
  ctaTitleRent: "Har du en bostad att hyra ut?",
  ctaText: "Publicera den gratis och nå de som söker i ditt område.",
  ctaPrimary: "Publicera gratis",
  ctaSecondary: "Vad är den värd?",
} as const;

/** Category grid: /[affar]/[...segments]. */
export const svCategory = {
  operationLabel: {
    venta: "köp",
    alquiler: "uthyrning",
    alquiler_vacacional: "korttidshyra",
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
  title: (typeLabel: string, opLabel: string, where: string) => `${typeLabel} till ${opLabel} i ${where}`,
  titlePaged: (title: string, page: number) => `${title} — sida ${page}`,
  metaNotFound: "Hittades inte",
  metaDescription: (count: number, title: string, brand: string) =>
    `${count} ${title.toLowerCase()} på ${brand}. Hitta din nästa bostad i Spanien, med det juridiska läget tydligt redovisat.`,
  breadcrumbHome: "Start",
  count: (n: number) => `${n} ${n === 1 ? "bostad" : "bostäder"} tillgängliga.`,
  emptyTypeNotice: (typeLabel: string, opLabel: string, city: string) =>
    `Det finns inga ${typeLabel} för ${opLabel} i ${city} just nu. Vi visar alla bostäder i ${city}.`,
  viewSwitchLabel: "Vy",
  viewList: "Lista",
  viewMap: "Karta",
  filterEmpty: "Inga bostäder matchar dessa filter.",
  filterEmptyClear: "Rensa filter",
  paginationLabel: "Sidnumrering",
  paginationPrev: "← Föregående",
  paginationNext: "Nästa →",
  paginationStatus: (page: number, total: number) => `Sida ${page} av ${total}`,
} as const;

/** Property detail: /bostad/[slug]. */
export const svListing = {
  metaNotFound: "Bostaden hittades inte",
  metaTitle: (title: string, price: string) => `${title} — ${price}`,
  ogTitle: (title: string, brand: string) => `${title} — ${brand}`,
  stateLabel: {
    obra_nueva: "Nybyggd",
    sobre_plano: "På ritning",
    en_construccion: "Under uppförande",
    segunda_mano: "Begagnad",
  } as Record<string, string>,
  breadcrumbHome: "Start",
  breadcrumbLabel: "Brödsmulor",

  galleryEmpty: "Bilder kommer snart",
  galleryThumbAlt: (title: string, n: number) => `${title} — bild ${n}`,
  galleryMore: (n: number) => `+${n} bilder`,

  factBedrooms: (n: number) => `${n} sovr`,
  factBathrooms: (n: number) => `${n} badrum`,
  factParking: (n: number) => `${n} p-platser`,
  factArea: (m2: number) => `${m2} m²`,

  priceRentLabel: "Hyra",
  priceRentPeriod: "/mån",

  // Acquisition cost estimate (replaces the Paraguayan cuota block, see
  // src/lib/acquisition-cost.ts). Kept small: the detail page renders the
  // breakdown itself from acquisition-cost.ts, this is just labels.
  acquisitionCostHead: "Uppskattad total köpkostnad",
  acquisitionCostLabel: "Skatt, notarie, lagfart och juridisk hjälp",
  acquisitionCostFoot: "Uppskattning baserad på regionens offentliga skattesatser — kontrollera med en jurist innan köp.",

  detailsTitle: "☰ Bostadens detaljer",
  detailBarrio: "Område",
  detailCity: "Ort",
  detailType: "Typ",
  detailState: "Skick",
  detailArea: "Boyta",
  detailLand: "Tomt",
  detailParking: "Parkering",

  amenitiesTitle: "✨ Bostadens utrustning",
  descriptionTitle: "📄 Beskrivning",
  locationTitle: "📍 Ungefärligt läge",

  sellerFallback: (brand: string) => `Publicerad på ${brand}`,
  sellerVerified: "Verifierad",
  sellerKindAgency: "Mäklarbyrå",
  sellerKindAgent: "Agent",
  /** FSBO: the listing was published by its owner, not by a professional. */
  sellerKindOwner: "Privatperson",

  contactTitle: "Intresserad av den här bostaden?",
  contactSubtitle: "Kontakta oss idag för mer information eller för att boka en visning.",

  similarTitle: "Liknande bostäder",
  fromAgencyTitleLead: "Fler från",
  fromAgencyFallback: "den här mäklarbyrån",

  moreInBarrio: (barrio: string) => `📍 Fler bostäder i ${barrio}`,
  moreInCity: (city: string) => `🏙 Alla bostäder i ${city}`,

  ctaBarWhatsapp: "Kontakta",
  ctaBarConsult: "Fråga",

  publishedToday: "Publicerad idag",
  publishedYesterday: "Publicerad igår",
  publishedDaysAgo: (n: number) => `Publicerad för ${n} dagar sedan`,
  publishedWeeksAgo: (n: number) => `Publicerad för ${n} veckor sedan`,
  publishedMonthsAgo: (n: number) => `Publicerad för ${n} månader sedan`,
} as const;
