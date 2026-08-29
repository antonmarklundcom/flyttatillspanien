/**
 * Committed dev-listings fixture (plan.md §6 Phase 3 exit criteria).
 *
 * One published listing per operation/property-type combination that
 * realistically has a card to render, plus the specific landmine cases the
 * plan calls out by name: an `energy_rating: "en_tramite"` row, a
 * `legal_status: "sin_lpo"` row, at least one `alquiler_vacacional` row with
 * a `tourist_licence`, and one listing owned by each lister type
 * (`inmobiliaria` agency, `relocation` agency, private FSBO).
 *
 *   npm run seed:dev
 *
 * Idempotent: every seed listing carries a distinctive fake
 * `referencia_catastral` (never a real one — see the SEED_CATASTRAL_PREFIX
 * comment below) and upserts on `uq_catastral`, the listing table's one other
 * unique index besides `public_id`. `public_id`/`slug` are only set on first
 * insert (an update never rewrites them — recomputing a slug breaks inbound
 * links, same rule `saveDraft()` follows), so re-running this script never
 * changes a seeded listing's URL.
 *
 * Run after `npm run seed:locations && npm run seed:costs` — this script
 * resolves municipios/zonas by slug and expects them to already exist.
 * Phases 4 and 6 reuse this fixture for their own verification.
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { agencies, agents, listings, locations, users } from "../src/db/schema";
import { syncAllDisplayCoords } from "../src/lib/geo";
import { slugify } from "../src/lib/slug";
import { makePublicId } from "../src/lib/import/normalize";
import type {
  ChargesStatus,
  EnergyRating,
  LandClassification,
  LegalStatus,
  Operation,
  PropertyState,
  PropertyType,
} from "../src/lib/import/types";

/**
 * 20 chars, matching `referencia_catastral`'s column width — but never a
 * shape Spain's Catastro actually issues (a real reference always starts
 * with a cadastral-block digit, never four letters), so a seeded row can
 * never collide with, or be mistaken for, real imported data.
 */
const SEED_CATASTRAL_PREFIX = "SEED";
function catastral(n: number): string {
  return `${SEED_CATASTRAL_PREFIX}${String(n).padStart(16, "0")}`;
}

async function mustResolveMunicipio(slug: string): Promise<number> {
  const [row] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.slug, slug))
    .limit(1);
  if (!row) {
    throw new Error(
      `Location "${slug}" not found — run "npm run seed:locations" first.`,
    );
  }
  return row.id;
}

/** Upsert one agency by slug, returning its id. */
async function upsertAgency(input: {
  slug: string;
  name: string;
  kind: "inmobiliaria" | "relocation" | "developer";
  phone: string;
  email: string;
  isVerified?: boolean;
}): Promise<number> {
  const values = {
    name: input.name,
    slug: input.slug,
    kind: input.kind,
    countryCode: input.kind === "relocation" ? "SE" : "ES",
    phone: input.phone,
    email: input.email,
    isVerified: input.isVerified ?? false,
  };
  await db
    .insert(agencies)
    .values(values)
    .onDuplicateKeyUpdate({ set: values });
  const [row] = await db
    .select({ id: agencies.id })
    .from(agencies)
    .where(eq(agencies.slug, input.slug))
    .limit(1);
  return row!.id;
}

async function upsertAgent(input: {
  slug: string;
  name: string;
  agencyId: number;
  phone: string;
  isVerified?: boolean;
}): Promise<number> {
  const values = {
    name: input.name,
    slug: input.slug,
    agencyId: input.agencyId,
    phone: input.phone,
    isVerified: input.isVerified ?? false,
  };
  await db
    .insert(agents)
    .values(values)
    .onDuplicateKeyUpdate({ set: values });
  const [row] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.slug, input.slug))
    .limit(1);
  return row!.id;
}

/** Upsert the FSBO owner by email (users.email is the unique key). */
async function upsertOwner(input: {
  email: string;
  name: string;
  phone: string;
}): Promise<number> {
  const values = {
    name: input.name,
    email: input.email,
    phone: input.phone,
    emailVerifiedAt: new Date(),
    role: "consumer" as const,
  };
  await db
    .insert(users)
    .values(values)
    .onDuplicateKeyUpdate({ set: values });
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);
  return row!.id;
}

/** Which lister owns a seed row — exactly one of these three shapes. */
type Lister =
  | { kind: "agency"; agencyId: number; agentId?: number }
  | { kind: "owner"; ownerUserId: number };

interface SeedListing {
  n: number; // feeds catastral() and the deterministic public_id fallback
  operation: Operation;
  propertyType: PropertyType;
  title: string;
  titleSv?: string;
  descriptionEs?: string;
  descriptionSv?: string;
  sourceLang?: "es" | "sv";
  priceEur: number;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  builtM2?: number;
  usableM2?: number;
  plotM2?: number;
  yearBuilt?: number;
  propertyState?: PropertyState;
  locationSlug: string;
  energyRating: EnergyRating;
  legalStatus: LegalStatus;
  chargesStatus: ChargesStatus;
  notaSimpleSeen?: boolean;
  ibiAnnualEur?: number;
  communityMonthlyEur?: number;
  isVpo?: boolean;
  landClassification?: LandClassification;
  buildableM2?: number;
  touristLicence?: string;
  lister: Lister;
  isVerified?: boolean;
}

async function main() {
  // --- Locations (seed:locations must have run) --------------------------
  const marbella = await mustResolveMunicipio("marbella");
  const nuevaAndalucia = await mustResolveMunicipio("nueva-andalucia");
  const torrevieja = await mustResolveMunicipio("torrevieja");
  const palma = await mustResolveMunicipio("palma");
  const oldTown = await mustResolveMunicipio("old-town");

  // --- Listers -------------------------------------------------------------
  const inmobiliariaId = await upsertAgency({
    slug: "costa-del-sol-inmobiliaria",
    name: "Costa del Sol Inmobiliaria",
    kind: "inmobiliaria",
    phone: "+34600111222",
    email: "info@costasolinmobiliaria.example",
    isVerified: true,
  });
  const agentId = await upsertAgent({
    slug: "carlos-ruiz",
    name: "Carlos Ruiz",
    agencyId: inmobiliariaId,
    phone: "+34600111223",
    isVerified: true,
  });
  const relocationId = await upsertAgency({
    slug: "svensk-flytthjalp",
    name: "Svensk Flytthjälp",
    kind: "relocation",
    phone: "+46701234567",
    email: "kontakt@svenskflytthjalp.example",
    isVerified: true,
  });
  const ownerId = await upsertOwner({
    email: "seed.owner@example.com",
    name: "Anna Svensson",
    phone: "+46701112233",
  });

  const viaAgency = (n?: number): Lister => ({
    kind: "agency",
    agencyId: inmobiliariaId,
    agentId: n != null ? agentId : undefined,
  });
  const viaRelocation: Lister = { kind: "agency", agencyId: relocationId };
  const viaOwner: Lister = { kind: "owner", ownerUserId: ownerId };

  // --- Listings --------------------------------------------------------------
  const SEED: SeedListing[] = [
    // venta — one per property type (8)
    {
      n: 1,
      operation: "venta",
      propertyType: "villa",
      title: "Villa con vistas al mar en Nueva Andalucía",
      titleSv: "Havsutsiktsvilla i Nueva Andalucía",
      descriptionEs:
        "Villa de lujo reformada con piscina privada, jardín tropical y vistas panorámicas al mar. A 5 minutos de Puerto Banús.",
      sourceLang: "es",
      priceEur: 1_250_000,
      bedrooms: 5,
      bathrooms: 4,
      parking: 2,
      builtM2: 320,
      plotM2: 800,
      yearBuilt: 2015,
      propertyState: "segunda_mano",
      locationSlug: "nueva-andalucia",
      energyRating: "C",
      legalStatus: "escritura_registrada",
      chargesStatus: "libre_de_cargas",
      notaSimpleSeen: true,
      ibiAnnualEur: 2400,
      communityMonthlyEur: 350,
      lister: viaAgency(1),
      isVerified: true,
    },
    {
      n: 2,
      operation: "venta",
      propertyType: "apartamento",
      title: "Apartamento de obra nueva en Marbella centro",
      descriptionEs:
        "Apartamento de 2 dormitorios en promoción de obra nueva, a estrenar, con protección oficial (VPO).",
      priceEur: 385_000,
      bedrooms: 2,
      bathrooms: 2,
      builtM2: 95,
      usableM2: 82,
      yearBuilt: 2026,
      propertyState: "obra_nueva",
      locationSlug: "marbella",
      energyRating: "B",
      legalStatus: "obra_nueva_lpo",
      chargesStatus: "libre_de_cargas",
      ibiAnnualEur: 900,
      communityMonthlyEur: 180,
      isVpo: true,
      lister: viaAgency(),
    },
    {
      // Landmine case #1: energy certificate applied for, not yet issued —
      // the plan's exit criteria names this row explicitly.
      n: 3,
      operation: "venta",
      propertyType: "atico",
      title: "Ático con terraza en Nueva Andalucía",
      descriptionEs:
        "Ático de dos plantas con terraza de 40 m² y vistas al campo de golf. Certificado energético en trámite.",
      priceEur: 620_000,
      bedrooms: 3,
      bathrooms: 3,
      builtM2: 140,
      usableM2: 120,
      propertyState: "segunda_mano",
      locationSlug: "nueva-andalucia",
      energyRating: "en_tramite",
      legalStatus: "desconocido",
      chargesStatus: "desconocido",
      lister: viaAgency(1),
    },
    {
      n: 4,
      operation: "venta",
      propertyType: "adosado",
      title: "Adosado a dos minutos de la playa en Torrevieja",
      descriptionEs:
        "Casa adosada de tres dormitorios con patio privado, a 400 metros de la playa.",
      priceEur: 295_000,
      bedrooms: 3,
      bathrooms: 2,
      builtM2: 130,
      plotM2: 90,
      propertyState: "segunda_mano",
      locationSlug: "torrevieja",
      energyRating: "D",
      legalStatus: "escritura_registrada",
      chargesStatus: "con_hipoteca",
      lister: viaAgency(1),
    },
    {
      // FSBO, portal-verified nota simple — tests the "we have verified" branch.
      n: 5,
      operation: "venta",
      propertyType: "duplex",
      title: "Dúplex reformado cerca del centro de Torrevieja",
      descriptionEs:
        "Dúplex de dos dormitorios totalmente reformado, listo para entrar a vivir.",
      priceEur: 210_000,
      bedrooms: 2,
      bathrooms: 2,
      builtM2: 88,
      propertyState: "segunda_mano",
      locationSlug: "torrevieja",
      energyRating: "D",
      legalStatus: "escritura_registrada",
      chargesStatus: "libre_de_cargas",
      notaSimpleSeen: true,
      lister: viaOwner,
      isVerified: true,
    },
    {
      // Landmine case #2: no first-occupation licence — the exit criteria
      // names this row explicitly. Rustic land classification too.
      n: 6,
      operation: "venta",
      propertyType: "finca",
      title: "Finca rústica con casa de campo en Marbella",
      descriptionEs:
        "Finca de 1,2 hectáreas con casa de campo reformada. Suelo rústico — construcción sin licencia de primera ocupación.",
      priceEur: 890_000,
      bedrooms: 4,
      bathrooms: 3,
      builtM2: 210,
      plotM2: 12_000,
      propertyState: "segunda_mano",
      locationSlug: "marbella",
      energyRating: "exento",
      legalStatus: "sin_lpo",
      chargesStatus: "desconocido",
      landClassification: "rustico",
      lister: viaAgency(),
    },
    {
      n: 7,
      operation: "venta",
      propertyType: "terreno",
      title: "Terreno urbanizable en Marbella",
      descriptionEs: "Parcela urbanizable de 5 000 m² con capacidad edificable de 2 000 m².",
      priceEur: 450_000,
      plotM2: 5000,
      locationSlug: "marbella",
      energyRating: "exento",
      legalStatus: "desconocido",
      chargesStatus: "desconocido",
      landClassification: "urbanizable",
      buildableM2: 2000,
      lister: viaAgency(),
    },
    {
      n: 8,
      operation: "venta",
      propertyType: "local",
      title: "Local comercial en Palma centro",
      descriptionEs: "Local comercial a pie de calle, escaparate amplio, ideal para retail.",
      priceEur: 320_000,
      builtM2: 150,
      propertyState: "segunda_mano",
      locationSlug: "palma",
      energyRating: "E",
      legalStatus: "escritura_registrada",
      chargesStatus: "libre_de_cargas",
      lister: viaAgency(),
    },

    // alquiler — long-term rental, residential + commercial types (6)
    {
      n: 9,
      operation: "alquiler",
      propertyType: "villa",
      title: "Villa de alquiler con piscina en Marbella",
      descriptionEs: "Villa de cuatro dormitorios con piscina privada, disponible para alquiler anual.",
      priceEur: 4500,
      bedrooms: 4,
      bathrooms: 3,
      builtM2: 300,
      plotM2: 600,
      propertyState: "segunda_mano",
      locationSlug: "marbella",
      energyRating: "C",
      legalStatus: "escritura_registrada",
      chargesStatus: "desconocido",
      lister: viaRelocation,
    },
    {
      n: 10,
      operation: "alquiler",
      propertyType: "apartamento",
      title: "Apartamento de alquiler cerca de la playa en Torrevieja",
      descriptionEs: "Apartamento de dos dormitorios a 300 metros de la playa, alquiler todo el año.",
      priceEur: 950,
      bedrooms: 2,
      bathrooms: 1,
      builtM2: 70,
      propertyState: "segunda_mano",
      locationSlug: "torrevieja",
      energyRating: "D",
      legalStatus: "escritura_registrada",
      chargesStatus: "desconocido",
      lister: viaOwner,
    },
    {
      // Swedish-authored (a relocation agent writes it themselves) —
      // source_lang: "sv", never shows the "maskinöversatt" marker.
      n: 11,
      operation: "alquiler",
      propertyType: "atico",
      title: "Takvåning med havsutsikt i Palma",
      descriptionSv:
        "Ljus takvåning med stor terrass och havsutsikt, i gångavstånd till Palmas gamla stad. Uthyres helårsvis.",
      sourceLang: "sv",
      priceEur: 1800,
      bedrooms: 3,
      bathrooms: 2,
      builtM2: 110,
      propertyState: "segunda_mano",
      locationSlug: "palma",
      energyRating: "B",
      legalStatus: "escritura_registrada",
      chargesStatus: "libre_de_cargas",
      lister: viaRelocation,
    },
    {
      n: 12,
      operation: "alquiler",
      propertyType: "adosado",
      title: "Adosado de alquiler con patio en Torrevieja",
      descriptionEs: "Casa adosada de tres dormitorios con patio privado, alquiler anual.",
      priceEur: 1100,
      bedrooms: 3,
      bathrooms: 2,
      builtM2: 120,
      plotM2: 60,
      propertyState: "segunda_mano",
      locationSlug: "torrevieja",
      energyRating: "E",
      legalStatus: "escritura_registrada",
      chargesStatus: "desconocido",
      lister: viaAgency(1),
    },
    {
      n: 13,
      operation: "alquiler",
      propertyType: "duplex",
      title: "Dúplex de alquiler en Nueva Andalucía",
      descriptionEs: "Dúplex de dos dormitorios en zona tranquila, cerca de todos los servicios.",
      priceEur: 1600,
      bedrooms: 2,
      bathrooms: 2,
      builtM2: 95,
      propertyState: "segunda_mano",
      locationSlug: "nueva-andalucia",
      energyRating: "C",
      legalStatus: "escritura_registrada",
      chargesStatus: "desconocido",
      lister: viaAgency(1),
    },
    {
      n: 14,
      operation: "alquiler",
      propertyType: "local",
      title: "Local comercial de alquiler en Palma",
      descriptionEs: "Local comercial en zona céntrica, ideal para oficina o retail.",
      priceEur: 1200,
      builtM2: 80,
      propertyState: "segunda_mano",
      locationSlug: "palma",
      energyRating: "E",
      legalStatus: "escritura_registrada",
      chargesStatus: "desconocido",
      lister: viaAgency(),
    },

    // alquiler_vacacional — holiday let, with and without a tourist licence (6)
    {
      n: 15,
      operation: "alquiler_vacacional",
      propertyType: "villa",
      title: "Villa de vacaciones con piscina en Nueva Andalucía",
      descriptionEs: "Villa de lujo con piscina privada para alquiler vacacional. Licencia turística en regla.",
      priceEur: 3200,
      bedrooms: 4,
      bathrooms: 3,
      builtM2: 220,
      plotM2: 400,
      propertyState: "segunda_mano",
      locationSlug: "nueva-andalucia",
      energyRating: "B",
      legalStatus: "escritura_registrada",
      chargesStatus: "libre_de_cargas",
      touristLicence: "VFT/MA/12345",
      lister: viaRelocation,
    },
    {
      // No licence yet — the honest "not stated" state, per svListing.touristLicenceNone.
      n: 16,
      operation: "alquiler_vacacional",
      propertyType: "apartamento",
      title: "Apartamento de vacaciones en Palma, Old Town",
      descriptionEs: "Apartamento de dos dormitorios en el casco antiguo de Palma, alquiler vacacional.",
      priceEur: 1400,
      bedrooms: 2,
      bathrooms: 1,
      builtM2: 65,
      propertyState: "segunda_mano",
      locationSlug: "old-town",
      energyRating: "D",
      legalStatus: "desconocido",
      chargesStatus: "desconocido",
      lister: viaAgency(),
    },
    {
      n: 17,
      operation: "alquiler_vacacional",
      propertyType: "atico",
      title: "Ático de vacaciones cerca de la playa en Torrevieja",
      descriptionEs: "Ático con terraza a 200 metros de la playa, ideal para vacaciones.",
      priceEur: 1600,
      bedrooms: 2,
      bathrooms: 2,
      builtM2: 90,
      propertyState: "segunda_mano",
      locationSlug: "torrevieja",
      energyRating: "C",
      legalStatus: "escritura_registrada",
      chargesStatus: "libre_de_cargas",
      touristLicence: "VT-4567",
      lister: viaOwner,
    },
    {
      n: 18,
      operation: "alquiler_vacacional",
      propertyType: "adosado",
      title: "Adosado de vacaciones con jardín en Marbella",
      descriptionEs: "Adosado de tres dormitorios con jardín privado, para alquiler vacacional.",
      priceEur: 1900,
      bedrooms: 3,
      bathrooms: 2,
      builtM2: 140,
      plotM2: 100,
      propertyState: "segunda_mano",
      locationSlug: "marbella",
      energyRating: "D",
      legalStatus: "desconocido",
      chargesStatus: "desconocido",
      lister: viaAgency(1),
    },
    {
      n: 19,
      operation: "alquiler_vacacional",
      propertyType: "duplex",
      title: "Dúplex de vacaciones en Palma",
      descriptionEs: "Dúplex de dos dormitorios cerca del puerto, alquiler vacacional con licencia.",
      priceEur: 1300,
      bedrooms: 2,
      bathrooms: 1,
      builtM2: 85,
      propertyState: "segunda_mano",
      locationSlug: "palma",
      energyRating: "E",
      legalStatus: "escritura_registrada",
      chargesStatus: "desconocido",
      touristLicence: "VT-9910",
      lister: viaRelocation,
    },
    {
      // Landmine variant #3: regularisation under way, plus a rural holiday
      // let (a common Andalucían combination the design doc calls out).
      n: 20,
      operation: "alquiler_vacacional",
      propertyType: "finca",
      title: "Finca de vacaciones con piscina en Marbella",
      descriptionEs:
        "Finca rústica con piscina, alquiler vacacional. Regularización de la vivienda en trámite (DAFO).",
      priceEur: 2800,
      bedrooms: 3,
      bathrooms: 2,
      builtM2: 180,
      plotM2: 8000,
      propertyState: "segunda_mano",
      locationSlug: "marbella",
      energyRating: "exento",
      legalStatus: "en_regularizacion",
      chargesStatus: "desconocido",
      landClassification: "rustico",
      touristLicence: "VFT/MA/99887",
      lister: viaAgency(),
    },
  ];

  const LOCATION_ID: Record<string, number> = {
    marbella,
    "nueva-andalucia": nuevaAndalucia,
    torrevieja,
    palma,
    "old-town": oldTown,
  };

  let inserted = 0;
  let updated = 0;
  for (const s of SEED) {
    const locationId = LOCATION_ID[s.locationSlug];
    if (!locationId) throw new Error(`Unknown seed location slug "${s.locationSlug}"`);

    const existing = await db
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.referenciaCatastral, catastral(s.n)))
      .limit(1);

    const fields = {
      operation: s.operation,
      propertyType: s.propertyType,
      status: "published" as const,
      sourceLang: s.sourceLang ?? "es",
      title: s.title,
      titleSv: s.titleSv ?? null,
      descriptionEs: s.descriptionEs ?? null,
      descriptionSv: s.descriptionSv ?? null,
      priceEur: s.priceEur.toFixed(2),
      bedrooms: s.bedrooms ?? null,
      bathrooms: s.bathrooms ?? null,
      parking: s.parking ?? null,
      builtM2: s.builtM2 != null ? s.builtM2.toFixed(2) : null,
      usableM2: s.usableM2 != null ? s.usableM2.toFixed(2) : null,
      plotM2: s.plotM2 != null ? s.plotM2.toFixed(2) : null,
      yearBuilt: s.yearBuilt ?? null,
      propertyState: s.propertyState ?? null,
      locationId,
      agencyId: s.lister.kind === "agency" ? s.lister.agencyId : null,
      agentId: s.lister.kind === "agency" ? (s.lister.agentId ?? null) : null,
      ownerUserId: s.lister.kind === "owner" ? s.lister.ownerUserId : null,
      isVerified: s.isVerified ?? false,
      referenciaCatastral: catastral(s.n),
      energyRating: s.energyRating,
      legalStatus: s.legalStatus,
      chargesStatus: s.chargesStatus,
      notaSimpleSeenAt: s.notaSimpleSeen ? new Date() : null,
      ibiAnnualEur: s.ibiAnnualEur != null ? s.ibiAnnualEur.toFixed(2) : null,
      communityMonthlyEur:
        s.communityMonthlyEur != null ? s.communityMonthlyEur.toFixed(2) : null,
      isVpo: s.isVpo ?? false,
      landClassification: s.landClassification ?? null,
      buildableM2: s.buildableM2 != null ? s.buildableM2.toFixed(2) : null,
      touristLicence: s.touristLicence ?? null,
      publishedAt: new Date(),
    };

    if (existing.length > 0) {
      // Never rewrite public_id/slug on an update — recomputing a slug on an
      // existing row breaks any inbound link, the same rule saveDraft() follows.
      await db.update(listings).set(fields).where(eq(listings.id, existing[0].id));
      updated++;
    } else {
      await db.insert(listings).values({
        publicId: makePublicId(),
        slug: slugify(s.title) || "bostad",
        ...fields,
      });
      inserted++;
    }
  }

  // One pass at the end rather than per row — cheap at this size and it is
  // the same statement `npm run cron:geo` runs over the whole table.
  await syncAllDisplayCoords(db);

  console.log(
    `seed:dev — ${inserted} inserted, ${updated} updated (${SEED.length} total). ` +
      `Listers: 1 inmobiliaria (${inmobiliariaId}) with 1 agent, 1 relocation agency (${relocationId}), 1 FSBO owner (${ownerId}).`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
