/**
 * Single shared schema for every domain/door (ARCHITECTURE.md §2).
 *
 * Rules that keep the Postgres escape hatch open:
 *  - No stored procedures, no MySQL-specific JSON tricks in hot paths.
 *  - Geo = plain lat/lng bounding boxes (idx_geo), no spatial extensions.
 *  - All filtering on indexed scalar columns; JSON columns are display-only.
 */
import {
  bigint,
  boolean,
  char,
  date,
  datetime,
  decimal,
  index,
  int,
  json,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  text,
  tinyint,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

const id = () =>
  bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey();
const fk = (name: string) => bigint(name, { mode: "number", unsigned: true });
const createdAt = () =>
  datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);

/* ------------------------------------------------------------------ */
/* 2.1 Core: listings — wide, denormalized where it serves filtering   */
/* ------------------------------------------------------------------ */

export const listings = mysqlTable(
  "listings",
  {
    id: id(),
    publicId: char("public_id", { length: 10 }).notNull().unique(), // /bostad/{slug}-{public_id}
    slug: varchar("slug", { length: 180 }).notNull(),
    operation: mysqlEnum("operation", [
      "venta", // /kopa
      "alquiler", // /hyra — long let
      "alquiler_vacacional", // /korttidshyra — holiday let, licence-regulated
    ]).notNull(),
    propertyType: mysqlEnum("property_type", [
      "villa", // /villa — chalet independiente
      "apartamento", // /lagenhet
      "atico", // /takvaning — penthouse; a distinct price tier in Spain, not a flag on apartamento
      "adosado", // /radhus
      "duplex", // /etagelagenhet
      "finca", // /lantegendom — rural, and the type most likely to carry legal_status problems
      "terreno", // /tomt
      "local", // /lokal — commercial
    ]).notNull(),
    status: mysqlEnum("status", [
      "draft",
      "pending_review",
      "published",
      "paused",
      "sold",
      "rented",
      "removed",
    ])
      .notNull()
      .default("draft"),

    /**
     * Localised copy: the direction is inverted from the Paraguay original.
     * Spanish arrives from the agency feed and Swedish is derived — except
     * when a Swedish relocation agent writes the listing themselves, in
     * which case Swedish is the source. `sourceLang` records which.
     */
    sourceLang: mysqlEnum("source_lang", ["es", "sv"]).notNull().default("es"),
    title: varchar("title", { length: 180 }).notNull(), // in sourceLang
    descriptionEs: text("description_es"), // agency feed copy
    /**
     * The served Swedish copy. Written only by `npm run cron:translate`
     * (src/lib/translate.ts, inverted to es→sv) — never by a form, never in
     * the request path, and never by hand: an operator edit here would be
     * silently overwritten the next time the Spanish text changes. Unlike
     * propia.node's `title_en` (which nothing read), this pair IS served —
     * the card, detail page and metadata read `titleSv ?? title` from day
     * one, with a "maskinöversatt från spanska" marker when the row came
     * from the cron rather than a human source.
     */
    titleSv: varchar("title_sv", { length: 180 }),
    descriptionSv: text("description_sv"),
    /**
     * sha256 of the Spanish source the Swedish above was translated from.
     * Suffixed by target language on purpose: the unsuffixed
     * `translation_hash` only worked with exactly one target, and adding
     * English later without a suffix would re-translate everything nightly
     * or refresh nothing.
     */
    translationHashSv: char("translation_hash_sv", { length: 64 }),

    priceEur: decimal("price_eur", { precision: 12, scale: 2 }).notNull(), // the price, and the only filter column — SEK is computed at render, never stored

    bedrooms: tinyint("bedrooms", { unsigned: true }), // NULL = N/A (terreno); 0 = monoambiente
    bathrooms: tinyint("bathrooms", { unsigned: true }),
    parking: tinyint("parking", { unsigned: true }),
    // Spain distinguishes built vs. usable area, and the difference is
    // 10–15% — builtM2 is the ONLY faceted/indexed area column (what feeds
    // carry and Idealista shows); usableM2 is display-only.
    builtM2: decimal("built_m2", { precision: 10, scale: 2 }), // superficie construida
    usableM2: decimal("usable_m2", { precision: 10, scale: 2 }), // superficie útil — interior, excludes walls/shared area
    plotM2: decimal("plot_m2", { precision: 12, scale: 2 }), // parcela
    yearBuilt: smallint("year_built", { unsigned: true }),
    propertyState: mysqlEnum("property_state", [
      "obra_nueva", // new build, delivered
      "sobre_plano", // off-plan
      "en_construccion",
      "segunda_mano", // resale
    ]),
    amenities: json("amenities"), // display only, never filtered in SQL v1

    /**
     * The Catastro's 20-char identifier for the physical property.
     * Government-issued and globally unique, which makes it three things at
     * once: the strongest anti-fraud signal on the portal, a link target
     * into Sede Catastro, and an EXACT dedup key that needs none of
     * dedupKey()'s bucketing guesswork. The unique index over a NULLABLE
     * column is deliberate: MySQL treats NULLs in a unique index as
     * all-distinct, so many listings with no cadastral reference never
     * collide, while any two that share one ARE the same property. Do not
     * "fix" this in either direction.
     */
    referenciaCatastral: char("referencia_catastral", { length: 20 }),

    // Spain's RD 390/2021 requires the energy rating to appear in the
    // advertisement itself. Not a nice-to-have: a listing cannot move to
    // status "published" with energyRating NULL (gate lives in the server
    // action, not the form — see listing-edit.ts).
    energyRating: mysqlEnum("energy_rating", [
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "en_tramite",
      "exento",
    ]),
    energyEmissions: mysqlEnum("energy_emissions", ["A", "B", "C", "D", "E", "F", "G"]),
    energyKwhM2: decimal("energy_kwh_m2", { precision: 7, scale: 2 }),
    energyCo2M2: decimal("energy_co2_m2", { precision: 7, scale: 2 }),

    // The landmine field: a meaningful share of coastal/rural Spanish
    // property lacks a first-occupation licence or sits on unlicensed
    // rustic land. `desconocido` is the honest default — never a silent "fine".
    legalStatus: mysqlEnum("legal_status", [
      "escritura_registrada", // deeded and recorded in the Registro de la Propiedad
      "obra_nueva_lpo", // new build holding a licencia de primera ocupación
      "sin_lpo", // built, no first-occupation licence
      "en_regularizacion", // AFO/DAFO or equivalent under way (common on Andalucían rustic)
      "desconocido", // the lister did not state it
    ])
      .notNull()
      .default("desconocido"),

    // `chargesStatus` is the lister's declaration; `notaSimpleSeenAt` is the
    // portal's own verification. Two columns, not one enum, so the UI can say
    // "seller states: free of charges — not yet verified by us" rather than
    // laundering a claim into a fact.
    chargesStatus: mysqlEnum("charges_status", [
      "libre_de_cargas",
      "con_hipoteca",
      "con_cargas",
      "desconocido",
    ])
      .notNull()
      .default("desconocido"),
    notaSimpleSeenAt: datetime("nota_simple_seen_at"), // set by an operator only, never by the lister

    ibiAnnualEur: decimal("ibi_annual_eur", { precision: 9, scale: 2 }), // annual municipal property tax
    communityMonthlyEur: decimal("community_monthly_eur", { precision: 9, scale: 2 }), // comunidad fee — routinely exceeds IBI, the cost Swedish buyers most often miss

    isVpo: boolean("is_vpo").notNull().default(false), // Vivienda de Protección Oficial: price-capped, resale-restricted, effectively closed to non-resident foreign buyers

    landClassification: mysqlEnum("land_classification", ["urbano", "urbanizable", "rustico"]), // terreno/finca only — "rustico" usually means you cannot build
    buildableM2: decimal("buildable_m2", { precision: 12, scale: 2 }),

    touristLicence: varchar("tourist_licence", { length: 40 }), // the comunidad's registration number (VFT/…, VT-…) — only if alquiler_vacacional ships

    locationId: fk("location_id").notNull(), // deepest known level, ideally zona
    addressText: varchar("address_text", { length: 255 }), // never shown publicly at full precision
    lat: decimal("lat", { precision: 9, scale: 6 }),
    lng: decimal("lng", { precision: 9, scale: 6 }),
    /**
     * The position the map actually plots: the listing's own coordinate when
     * it has one, else its location's centroid. Materialised at write time
     * (src/lib/geo.ts) rather than computed per query, because
     * `coalesce(listings.lat, locations.lat)` in the WHERE is not sargable —
     * the bounding-box test could not use idx_geo and scanned every published
     * row (audit F38). Never written by hand: every writer that touches
     * `lat`, `lng` or `location_id` calls `syncDisplayCoords()`, and
     * `npm run cron:geo` repairs the whole table after a centroid moves.
     */
    displayLat: decimal("display_lat", { precision: 9, scale: 6 }),
    displayLng: decimal("display_lng", { precision: 9, scale: 6 }),

    agencyId: fk("agency_id"),
    agentId: fk("agent_id"),
    projectId: fk("project_id"), // links preventa units to a development
    ownerUserId: fk("owner_user_id"), // FSBO ("particular") listings from the ads funnel

    isVerified: boolean("is_verified").notNull().default(false),
    verifiedAt: datetime("verified_at"),
    reviewNotes: varchar("review_notes", { length: 280 }), // super-admin reject reason (review queue); cleared on approve
    featuredUntil: datetime("featured_until"), // paid placement

    videoUrl: varchar("video_url", { length: 500 }), // YouTube/social link v1; feeds the video engine

    publishedAt: datetime("published_at"),
    createdAt: createdAt(),
    updatedAt: datetime("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
      .$onUpdate(() => new Date()),
  },
  (t) => [
    /**
     * Category search. Column order follows how the URL scheme actually
     * queries (ARCHITECTURE.md §4): operation and location are always present,
     * property_type only on /{affar}/{ort}/{typ}.
     *
     * property_type used to sit *before* location_id, which meant a city
     * landing page — no type in the path — could only use the (status,
     * operation) prefix and scanned every listing of that operation
     * (verified with EXPLAIN: key_len 2, ~1 800 rows at 3 000 listings).
     * With location_id third, the optional column is the one at the end.
     */
    index("idx_search").on(
      t.status,
      t.operation,
      t.locationId,
      t.propertyType,
      t.priceEur,
    ),
    /**
     * The default category ordering is `published_at desc`, which no index
     * covered — every category page paid a filesort. Same prefix as
     * idx_search so the planner can seek, then read the sort from the index.
     */
    index("idx_recent").on(
      t.status,
      t.operation,
      t.locationId,
      t.publishedAt,
    ),
    index("idx_location").on(t.locationId, t.status, t.publishedAt),
    /**
     * The map's bounding box, and the only reader of the display coordinate.
     * It used to be on (status, lat, lng), which the bbox query could not use:
     * it filters the *displayed* position, and that went through a coalesce
     * onto the joined location. Materialising the column is what turns this
     * index back on (audit F38).
     */
    index("idx_geo").on(t.status, t.displayLat, t.displayLng),
    index("idx_agency").on(t.agencyId, t.status),
    index("idx_project").on(t.projectId, t.status),
    index("idx_fresh").on(t.status, t.publishedAt),
    /**
     * Homepage rows: getRecentListingsBy filters (status, operation[, type])
     * and sorts published_at with NO location — idx_recent's location_id in
     * third position blocks its published_at, so those queries paid a
     * filesort (audit F38).
     */
    index("idx_home_row").on(
      t.status,
      t.operation,
      t.propertyType,
      t.publishedAt,
    ),
    uniqueIndex("uq_catastral").on(t.referenciaCatastral),
  ],
);

export const listingImages = mysqlTable(
  "listing_images",
  {
    id: id(),
    listingId: fk("listing_id").notNull(),
    r2Key: varchar("r2_key", { length: 500 }).notNull(),
    position: tinyint("position", { unsigned: true }).notNull().default(0), // 0 = cover; importer reorders (watermark scoring)
    width: int("width", { unsigned: true }),
    height: int("height", { unsigned: true }),
    watermarkScore: tinyint("watermark_score", { unsigned: true }), // 0–100; watermarked photos never become the cover
    createdAt: createdAt(),
  },
  (t) => [index("idx_listing").on(t.listingId, t.position)],
);

/* ------------------------------------------------------------------ */
/* 2.2 Locations — the hierarchy that drives SEO pages                 */
/* ------------------------------------------------------------------ */

export const locations = mysqlTable(
  "locations",
  {
    id: id(),
    parentId: fk("parent_id"),
    level: mysqlEnum("level", [
      "pais",
      "comunidad",
      "provincia",
      "municipio",
      "zona",
    ]).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    // The URL path only — 'marbella/nueva-andalucia' — starting at municipio.
    // comunidad/provincia are grouping and tax-resolution levels that live in
    // parentId; putting them here would produce a public URL with no ranking
    // benefit and a lot of ugliness.
    fullSlug: varchar("full_slug", { length: 300 }).notNull().unique(),
    lat: decimal("lat", { precision: 9, scale: 6 }),
    lng: decimal("lng", { precision: 9, scale: 6 }),
    listingCounts: json("listing_counts"), // cached {venta:{villa:12,...}} refreshed hourly by cron; powers the thin-page rule
    // The comunidad autónoma this node belongs to, copied down the tree at
    // seed time. Materialised rather than resolved by walking parentId, for
    // the F38 reason: a tree walk inside a query is not sargable.
    acquisitionRegion: char("acquisition_region", { length: 2 }),
    guideContentSv: mediumtext("guide_content_sv"), // Claude-generated area guide (§4.4)
    guideUpdatedAt: datetime("guide_updated_at"),
  },
  (t) => [
    index("idx_parent").on(t.parentId, t.level),
    // resolveCity/resolveBarrio filter on (slug, level) — the hottest route's
    // first lookup was a full scan without this (audit F38).
    index("idx_slug").on(t.slug, t.level),
  ],
);

/* ------------------------------------------------------------------ */
/* 2.3 Supply side: agencies, agents, developers, projects             */
/* ------------------------------------------------------------------ */

export const agencies = mysqlTable("agencies", {
  id: id(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 180 }).notNull().unique(),
  logoUrl: varchar("logo_url", { length: 500 }),
  /**
   * Three lister types share this one table rather than forking
   * `listingScopeWhere` / `panelScope`. "inmobiliaria" = a Spanish agency;
   * "relocation" = a Swedish-facing intermediary who is NOT the property's
   * selling agent — they represent the buyer's side and earn from the
   * introduction, so the seller card must label it, never blur it into
   * "agency"; "developer" = a promotora selling its own project units.
   */
  kind: mysqlEnum("kind", ["inmobiliaria", "relocation", "developer"])
    .notNull()
    .default("inmobiliaria"),
  countryCode: char("country_code", { length: 2 }).notNull().default("ES"),
  // CIF/NIF for a Spanish company, organisationsnummer for a Swedish AB — one
  // column, disambiguated by taxIdCountry, rather than a per-country column
  // set that is always mostly NULL.
  taxId: varchar("tax_id", { length: 20 }),
  taxIdCountry: char("tax_id_country", { length: 2 }),
  // Estate-agent registry number where the comunidad operates one (AICAT in
  // Catalonia, the Madrid/Andalucía registries). NULL is correct and common —
  // most of Spain has no mandatory registration, so absence is not a red flag.
  registryNumber: varchar("registry_number", { length: 40 }),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 190 }),
  isVerified: boolean("is_verified").notNull().default(false),
  plan: mysqlEnum("plan", ["free", "premium", "partner"])
    .notNull()
    .default("free"),
  ghlSubAccountId: varchar("ghl_sub_account_id", { length: 80 }), // future: agency GHL sub-account (CRM product lane)
  createdAt: createdAt(),
});

export const agents = mysqlTable(
  "agents",
  {
    id: id(),
    agencyId: fk("agency_id"), // NULL = independent
    userId: fk("user_id"), // linked once they claim their profile
    name: varchar("name", { length: 140 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    photoUrl: varchar("photo_url", { length: 500 }),
    phone: varchar("phone", { length: 30 }),
    isVerified: boolean("is_verified").notNull().default(false),
  },
  (t) => [
    index("idx_agency").on(t.agencyId),
    index("idx_user").on(t.userId), // agency-context lookup: which agency a logged-in user belongs to
  ],
);

/**
 * Invitations that let an agency add a colleague without the founder wiring
 * rows by hand (the /agencia/equipo flow).
 *
 * The token IS the credential — it is the only thing the recipient presents —
 * so it is 64 hex chars of crypto randomness, unique, single-use (`used_at`)
 * and short-lived (`expires_at`). `role` is decided by the inviter, never by
 * the person accepting: the sign-up form has no role field, exactly as
 * lib/registration.ts refuses one.
 *
 * There is no `email` column on purpose: v1 hands the link over by hand, and
 * storing an address here would imply a delivery the app does not do.
 */
export const agencyInvites = mysqlTable(
  "agency_invites",
  {
    id: id(),
    token: char("token", { length: 64 }).notNull().unique(),
    agencyId: fk("agency_id").notNull(),
    invitedByUserId: fk("invited_by_user_id").notNull(),
    // Only an agency_admin may mint an agency_admin invite (enforced server-side).
    role: mysqlEnum("role", ["agent", "agency_admin"]).notNull().default("agent"),
    expiresAt: datetime("expires_at").notNull(),
    /** NULL = still open. Set once, in a WHERE-guarded UPDATE, so it can't be
     * redeemed twice by two concurrent submits. */
    usedAt: datetime("used_at"),
    usedByUserId: fk("used_by_user_id"),
    createdAt: createdAt(),
  },
  (t) => [
    // The panel's only query: this agency's invites, newest first.
    index("idx_agency_created").on(t.agencyId, t.createdAt),
  ],
);

export const developers = mysqlTable("developers", {
  id: id(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 180 }).notNull().unique(),
  logoUrl: varchar("logo_url", { length: 500 }),
  website: varchar("website", { length: 300 }),
  whatsapp: varchar("whatsapp", { length: 30 }),
});

export const projects = mysqlTable(
  "projects", // promociones / urbanizaciones
  {
    id: id(),
    developerId: fk("developer_id"),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull().unique(),
    projectType: mysqlEnum("project_type", [
      "edificio",
      "urbanizacion",
      "condominio",
      "barrio_cerrado",
    ]).notNull(),
    locationId: fk("location_id").notNull(),
    lat: decimal("lat", { precision: 9, scale: 6 }),
    lng: decimal("lng", { precision: 9, scale: 6 }),
    stage: mysqlEnum("stage", [
      "sobre_plano",
      "en_construccion",
      "obra_nueva",
    ]),
    deliveryDate: date("delivery_date"),
    descriptionEs: text("description_es"),
    heroImageUrl: varchar("hero_image_url", { length: 500 }),
  },
  (t) => [index("idx_loc").on(t.locationId)],
);

/* ------------------------------------------------------------------ */
/* 2.4 Provenance & dedup: listing_sources                             */
/* ------------------------------------------------------------------ */

export const listingSources = mysqlTable(
  "listing_sources",
  {
    id: id(),
    listingId: fk("listing_id").notNull(),
    source: mysqlEnum("source", [
      "manual",
      "fsbo_ads",
      "whiteglove",
      "import_idealista",
      "import_fotocasa",
      "import_kyero",
      "import_agency_site",
      "api",
    ]).notNull(),
    /**
     * Which agency's id-space this row belongs to. NOT an FK and NOT nullable
     * on purpose: it is half of `uq_source`, and MySQL treats NULLs in a unique
     * index as all-distinct — a nullable column here would silently switch the
     * "re-importing the same file changes nothing" guarantee off for every
     * unscoped row. **0 means unscoped** (an independent agent's claim, or a
     * white-glove batch not yet attributed to an agency).
     *
     * Without it, two agencies exporting rows numbered 1, 2, 3 under the same
     * `source` collide, and agency B's row 1 overwrites agency A's listing.
     */
    scopeAgencyId: bigint("scope_agency_id", { mode: "number", unsigned: true })
      .notNull()
      .default(0),
    sourceUrl: varchar("source_url", { length: 600 }),
    sourceExternalId: varchar("source_external_id", { length: 120 }),
    contentHash: char("content_hash", { length: 40 }).notNull(), // sha1(normalized title|price|m2|zona) → change detection
    /**
     * sha1(scope|normalized phone|price_bucket|m2_bucket|location_id|…) — the
     * fuzzy "is this the same property?" key. **Nullable**: NULL means we had
     * too little identity to fuzzy-match this row (in practice, no contact
     * phone), and the pipeline then refuses to merge it into anything, unless
     * `referenciaCatastral` is present on the listing, in which case dedup
     * uses that exact key instead and skips the fuzzy path entirely. See
     * `dedupKey()` in lib/import/normalize.ts for why the null matters.
     */
    dedupKey: char("dedup_key", { length: 40 }),
    firstSeenAt: datetime("first_seen_at").notNull(),
    lastSeenAt: datetime("last_seen_at").notNull(), // importer pauses listings whose source disappears
  },
  (t) => [
    uniqueIndex("uq_source").on(t.source, t.scopeAgencyId, t.sourceExternalId),
    index("idx_dedup").on(t.dedupKey),
    index("idx_listing").on(t.listingId),
  ],
);

/* ------------------------------------------------------------------ */
/* 2.4b Import batches: import_jobs + import_rows                      */
/* ------------------------------------------------------------------ */

/**
 * One intake batch — a spreadsheet upload, or a re-sync run.
 *
 * This exists so a bad import is survivable. `ImportReport` used to be printed
 * to a console and then lost, which meant there was no way to answer "what did
 * that upload actually do" or to undo it. The job row is also where the
 * permission trail lives: who at the agency granted it, when, and in what
 * words. That is a column rather than prose in `review_notes` so it can be
 * queried and shown next to the listings it produced.
 */
export const importJobs = mysqlTable(
  "import_jobs",
  {
    id: id(),
    agencyId: fk("agency_id"), // NULL = not attributed to an agency
    source: mysqlEnum("source", [
      "manual",
      "fsbo_ads",
      "whiteglove",
      "import_idealista",
      "import_fotocasa",
      "import_kyero",
      "import_agency_site",
      "api",
    ]).notNull(),
    kind: mysqlEnum("kind", ["csv", "xlsx", "url", "resync"]).notNull(),
    filename: varchar("filename", { length: 255 }),
    /**
     * `dry_run` never wrote anything and is kept only as a record of what was
     * checked. `committed` is the only state rollback accepts.
     */
    status: mysqlEnum("status", [
      "dry_run",
      "committed",
      "rolled_back",
      "failed",
    ]).notNull(),

    totalRows: int("total_rows").notNull().default(0),
    createdCount: int("created_count").notNull().default(0),
    updatedCount: int("updated_count").notNull().default(0),
    unchangedCount: int("unchanged_count").notNull().default(0),
    dedupedCount: int("deduped_count").notNull().default(0),
    skippedCount: int("skipped_count").notNull().default(0),

    /** The permission trail the caution paragraph in the brief asks for. */
    permissionGranted: boolean("permission_granted").notNull().default(false),
    permissionGrantedBy: varchar("permission_granted_by", { length: 160 }),
    permissionNote: varchar("permission_note", { length: 500 }),
    permissionGrantedAt: datetime("permission_granted_at"),

    createdByUserId: fk("created_by_user_id"),
    createdAt: createdAt(),
    finishedAt: datetime("finished_at"),
    rolledBackAt: datetime("rolled_back_at"),
    /** Why a rollback left rows behind (leads attached, listing published…). */
    rollbackNote: varchar("rollback_note", { length: 500 }),
  },
  (t) => [
    index("idx_agency_created").on(t.agencyId, t.createdAt),
    index("idx_status").on(t.status, t.createdAt),
  ],
);

/**
 * What one row of the batch did, and what it overwrote.
 *
 * `previousJson` is the undo buffer: for an `updated` row it holds the listing
 * columns as they were *before* the import touched them, so a rollback can put
 * them back rather than just deleting whatever the import made. Without it,
 * "rollback" would only be honest about rows the job created.
 */
export const importRows = mysqlTable(
  "import_rows",
  {
    id: id(),
    jobId: fk("job_id").notNull(),
    rowNumber: int("row_number").notNull(), // 1-based, as the spreadsheet shows it
    outcome: mysqlEnum("outcome", [
      "created",
      "updated",
      "unchanged",
      "deduped",
      "skipped",
      "paused", // resync jobs only
    ]).notNull(),
    listingId: fk("listing_id"),
    title: varchar("title", { length: 200 }),
    error: varchar("error", { length: 500 }),
    previousJson: json("previous_json"),
    /** Cleared when a rollback has already put this row back. */
    revertedAt: datetime("reverted_at"),
  },
  (t) => [
    index("idx_job").on(t.jobId, t.rowNumber),
    index("idx_listing").on(t.listingId),
  ],
);

/* ------------------------------------------------------------------ */
/* 2.5 Demand side: leads — GHL owns messaging, this table owns record */
/* ------------------------------------------------------------------ */

export const leads = mysqlTable(
  "leads",
  {
    id: id(),
    leadType: mysqlEnum("lead_type", [
      "buyer",
      "renter",
      "seller",
      "valuation",
      "developer",
      "agent_signup",
    ]).notNull(),
    vertical: varchar("vertical", { length: 40 }).notNull(), // which domain captured it — value is 'sv' today
    listingId: fk("listing_id"),
    projectId: fk("project_id"),
    name: varchar("name", { length: 140 }),
    // Sweden is email-first, unlike the inherited WhatsApp-first assumption:
    // a Swedish buyer expects an email reply, and being asked to WhatsApp a
    // stranger about a purchase this size reads as unserious. The channel
    // does not disappear — it moves from being the buyer's channel to being
    // the agency's.
    email: varchar("email", { length: 190 }).notNull(),
    phone: varchar("phone", { length: 30 }),
    message: text("message"),
    utm: json("utm"),
    /**
     * Which inbox owns this lead.
     *
     * `owner` is the FSBO lane: a listing with no agent and no agency,
     * published by a private seller. Before it existed those leads fell into
     * `internal` alongside valuation and seller leads, where only
     * /admin/leads could see them and the operator forwarded each one by
     * hand. The lane is what lets the seller's own panel find them.
     */
    routedTo: mysqlEnum("routed_to", [
      "agency",
      "agent",
      "internal",
      "developer",
      // Appended, not slotted next to `agent` where it reads better. MySQL
      // stores an ENUM as the ordinal of its value, so inserting a member in
      // the middle renumbers every member after it and makes the ALTER rewrite
      // and remap existing rows. Appending is a pure add: no stored row changes
      // meaning. Keep new lanes at the end.
      "owner",
    ]).notNull(),
    ghlContactId: varchar("ghl_contact_id", { length: 80 }), // set by the GHL webhook response
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_listing").on(t.listingId),
    index("idx_type").on(t.leadType, t.createdAt),
    // Panel inboxes default-sort on created_at with no type filter (F38).
    index("idx_created").on(t.createdAt),
  ],
);

/* ------------------------------------------------------------------ */
/* 2.6 Money math: market_medians + fx_rates + acquisition_costs       */
/* ------------------------------------------------------------------ */

export const marketMedians = mysqlTable(
  "market_medians",
  {
    id: id(),
    period: char("period", { length: 7 }).notNull(), // '2026-07'
    locationId: fk("location_id").notNull(),
    propertyType: varchar("property_type", { length: 20 }).notNull(),
    operation: varchar("operation", { length: 20 }).notNull(),
    medianPriceEur: decimal("median_price_eur", { precision: 12, scale: 2 }),
    medianPriceM2Eur: decimal("median_price_m2_eur", {
      precision: 10,
      scale: 2,
    }),
    sampleSize: int("sample_size", { unsigned: true }).notNull(), // context module renders only when >= 8
    // Listings that actually had an area — the m² median's real sample. The
    // price sample above counts every listing in the bucket, and using it to
    // judge the m² median claimed 40 data points behind a number derived from 2.
    sampleSizeM2: int("sample_size_m2", { unsigned: true }).notNull().default(0),
    source: mysqlEnum("source", ["own", "blended"]).notNull(),
  },
  (t) => [
    uniqueIndex("uq").on(t.period, t.locationId, t.propertyType, t.operation),
  ],
);

/**
 * ECB EUR/SEK reference rate — written only by `npm run cron:fx`. Same shape
 * as the old financing_programs table: tiny, cron-owned, read-only to the app.
 * If the newest row is older than FX_MAX_AGE_DAYS, `formatSek()` returns null
 * and every SEK line disappears from the site rather than showing a
 * confidently wrong figure — the EUR price is unaffected either way.
 */
export const fxRates = mysqlTable(
  "fx_rates",
  {
    base: char("base", { length: 3 }).notNull(), // 'EUR'
    quote: char("quote", { length: 3 }).notNull(), // 'SEK'
    rate: decimal("rate", { precision: 12, scale: 6 }).notNull(),
    // mode "string": an ECB reference date is 'YYYY-MM-DD', a publication day
    // and not an instant — mapping it to a Date invites a timezone bug in a
    // column that has no time in it.
    observedOn: date("observed_on", { mode: "string" }).notNull(),
    source: mysqlEnum("source", ["ecb", "manual"]).notNull().default("ecb"),
    fetchedAt: datetime("fetched_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.base, t.quote] })],
);

/**
 * Total acquisition cost per comunidad autónoma — ITP/IVA+AJD, notario,
 * registro, gestoría. Occupies the slot the old financing_programs table
 * vacated: a tiny, cron-independent reference table computed at render, never
 * cached on a listing column (there is no per-listing query to avoid — see
 * src/lib/acquisition-cost.ts). Seed rates ship as PLACEHOLDERS, marked
 * exactly as the inherited seed-financing.ts marked its AFD rate: these
 * numbers print money figures on every card, and verifying them against each
 * comunidad's published scale is a research task, not a code task.
 */
export const acquisitionCosts = mysqlTable("acquisition_costs", {
  region: char("region", { length: 2 }).primaryKey(), // ISO-3166-2:ES subdivision: 'AN','VC','CT','MD','IB','CN','MC'
  name: varchar("name", { length: 80 }).notNull(), // 'Andalucía'
  itpPct: decimal("itp_pct", { precision: 5, scale: 2 }).notNull(), // resale transfer tax
  ivaPct: decimal("iva_pct", { precision: 5, scale: 2 }).notNull().default("10.00"), // new build, state-set
  ajdPct: decimal("ajd_pct", { precision: 5, scale: 2 }).notNull(), // stamp duty, new build only, regional
  notaryPctEst: decimal("notary_pct_est", { precision: 5, scale: 2 }).notNull(),
  registryPctEst: decimal("registry_pct_est", { precision: 5, scale: 2 }).notNull(),
  legalPctEst: decimal("legal_pct_est", { precision: 5, scale: 2 }).notNull(),
  effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
  sourceUrl: varchar("source_url", { length: 400 }), // the comunidad's published scale — the reader must be able to check us
  active: boolean("active").notNull().default(true),
  updatedAt: datetime("updated_at"),
});

/* ------------------------------------------------------------------ */
/* 2.7 Users & OTP                                                     */
/* ------------------------------------------------------------------ */

export const users = mysqlTable("users", {
  id: id(),
  name: varchar("name", { length: 140 }),
  email: varchar("email", { length: 190 }).notNull().unique(), // Sweden is email-first — was nullable
  passwordHash: varchar("password_hash", { length: 255 }), // NULL = OTP-only account
  phone: varchar("phone", { length: 30 }).unique(),
  emailVerifiedAt: datetime("email_verified_at"),
  role: mysqlEnum("role", [
    "consumer",
    "agent",
    "agency_admin",
    "developer",
    "admin",
  ])
    .notNull()
    .default("consumer"),
  locale: mysqlEnum("locale", ["sv", "en", "es"]).notNull().default("sv"), // 'es' is for a Spanish agency's panel, not a public door — not wired to a switcher at MVP
  /**
   * Deliberately NOT a full NIE/DNI column. A national ID number is data
   * whose collection needs a documented lawful basis and retention policy
   * (GDPR Art. 9 / LOPDGDD); the portal's actual need — "is this person who
   * they say they are" — is answered by a one-time document check, not a
   * stored number. The number itself is the notary's business at the
   * escritura, under their own legal basis.
   */
  identityDocType: mysqlEnum("identity_doc_type", ["nie", "dni", "passport", "personnummer"]),
  identityRefLast4: char("identity_ref_last4", { length: 4 }), // last 4 chars ONLY — enough to recognise which document is on file
  identityVerifiedAt: datetime("identity_verified_at"), // set by an operator who sighted the document; NULL is the default state, rendered as such
  createdAt: createdAt(),
});

export const otpCodes = mysqlTable(
  "otp_codes",
  {
    id: id(),
    destination: varchar("destination", { length: 190 }).notNull(), // email address or phone number, per `channel`
    channel: mysqlEnum("channel", ["email", "sms"]).notNull().default("email"),
    code: char("code", { length: 6 }).notNull(),
    expiresAt: datetime("expires_at").notNull(), // 10-min expiry, resend cooldown
    attempts: tinyint("attempts").notNull().default(0),
    consumedAt: datetime("consumed_at"),
  },
  (t) => [index("idx_dest").on(t.destination, t.expiresAt)],
);

/**
 * Opaque server-side sessions. `id` is the sha256 hex of the random cookie
 * token, so the raw token never touches the database and the lookup is a
 * primary-key hit. Rows are deleted on logout and lazily on expiry.
 */
export const sessions = mysqlTable(
  "sessions",
  {
    id: char("id", { length: 64 }).primaryKey(), // sha256(token) hex
    userId: fk("user_id").notNull(),
    expiresAt: datetime("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_user").on(t.userId),
    // cron:sessions purges by expires_at (audit F39).
    index("idx_expires").on(t.expiresAt),
  ],
);

/* ------------------------------------------------------------------ */
/* 2.9 Listing views — the "is my ad working?" number                  */
/* ------------------------------------------------------------------ */

/**
 * Daily view counts per listing (ARCHITECTURE.md M5 §3.3).
 *
 * Aggregated per day rather than one row per view: an owner asks "how many
 * people saw my ad this week", never "who saw it at 14:03", and a row per view
 * would be the fastest-growing table in the schema for an answer nobody needs.
 * One small upsert per detail-page render instead, written after the response
 * (see recordListingView) so it never sits in the visitor's critical path.
 *
 * The composite primary key IS the uniqueness rule — one row per listing per
 * day, so the counter cannot fork.
 */
export const listingViewsDaily = mysqlTable(
  "listing_views_daily",
  {
    listingId: fk("listing_id").notNull(),
    // mode "string": a day key is 'YYYY-MM-DD', not an instant — mapping it to
    // a Date would invite a timezone bug in a column that has no time at all.
    day: date("day", { mode: "string" }).notNull(),
    views: int("views", { unsigned: true }).notNull().default(0),
  },
  // No secondary index: reads are "this listing, recent days first", which
  // the composite PRIMARY KEY (listing_id, day) already serves — the old
  // idx_listing_day duplicated it column-for-column (audit F49).
  (t) => [primaryKey({ columns: [t.listingId, t.day] })],
);

/* ------------------------------------------------------------------ */
/* 2.10 Editorial: posts — guides and market notes                     */
/* ------------------------------------------------------------------ */

/**
 * Editorial content, written in the super-admin panel (/admin/guias) and
 * served at /guias.
 *
 * Deliberately one flat table rather than a CMS: the founder writes these,
 * there is no editorial workflow to model, and a post is a title, a body and
 * a date. Body is stored as the plain text the author typed — a small
 * markdown subset (see src/lib/markdown.ts) rendered to React elements at
 * request time, never to raw HTML, so no stored value can inject markup.
 *
 * `category` exists so the same table can hold evergreen guides and dated
 * market notes without a second table; the public index groups on it.
 */
export const posts = mysqlTable(
  "posts",
  {
    id: id(),
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    title: varchar("title", { length: 200 }).notNull(),
    // Shown on cards and used as the meta description when set.
    excerpt: varchar("excerpt", { length: 400 }),
    body: mediumtext("body").notNull(),
    // Same R2 key convention as listing photos (posts/{slug}/{rand}.webp).
    coverR2Key: varchar("cover_r2_key", { length: 500 }),
    category: mysqlEnum("category", ["guia", "mercado", "noticia"])
      .notNull()
      .default("guia"),
    status: mysqlEnum("status", ["draft", "published"])
      .notNull()
      .default("draft"),
    authorUserId: fk("author_user_id"),
    // Set on first publish and kept thereafter, so re-publishing an edited
    // post does not reshuffle the index or churn the sitemap's lastmod.
    publishedAt: datetime("published_at"),
    updatedAt: datetime("updated_at"),
    createdAt: createdAt(),
  },
  (t) => [
    // The public index's only query: published, newest first.
    index("idx_status_published").on(t.status, t.publishedAt),
    index("idx_category").on(t.category, t.status),
  ],
);
