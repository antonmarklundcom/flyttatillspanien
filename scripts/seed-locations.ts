/**
 * Seed the locations hierarchy — the tree that drives every programmatic SEO
 * page (/kopa/{ort}/{typ}, area guides) and, via `acquisition_region`, the
 * purchase-cost estimate on every detail page.
 *
 * Scope v1: the coastal and island markets Swedes actually buy in, plus
 * Madrid and Barcelona. Not Spain's 8 000-municipio census tree — pages only
 * exist where listings will. New locations are added by editing TREE and
 * re-running; the script is idempotent (upsert by full_slug), so re-runs never
 * duplicate and safely backfill lat/lng and acquisition_region.
 *
 *   npm run seed:locations
 *
 * Two rules encoded here that are easy to get wrong:
 *
 *  1. **`full_slug` is the URL path, and the URL path starts at municipio.**
 *     comunidad and provincia are grouping and tax-resolution levels that live
 *     in `parent_id`; putting them in the path would produce
 *     `espana/andalucia/malaga/marbella/nueva-andalucia` for no ranking
 *     benefit. The column is still NOT NULL UNIQUE, so the levels above
 *     municipio get a level-prefixed key (`provincia/malaga`) that can never
 *     collide with a real path — it is an identity, not an address, and
 *     nothing renders it.
 *  2. **`acquisition_region` is copied down the tree at seed time**, not
 *     resolved by walking `parent_id` later: a tree walk inside a query is not
 *     sargable and would sit in the path of every listing render (audit F38).
 *
 * Coordinates are approximate centroids (OSM), good enough for map default
 * centering; per-listing lat/lng comes from the importer.
 */
import { db } from "../src/db";
import { locations } from "../src/db/schema";
import { slugify, joinSlug } from "../src/lib/slug";

type Level = "pais" | "comunidad" | "provincia" | "municipio" | "zona";

interface Node {
  name: string;
  level: Level;
  /** ISO-3166-2:ES subdivision, set on a comunidad and inherited downward. */
  region?: string;
  lat?: number;
  lng?: number;
  children?: Node[];
}

const TREE: Node[] = [
  {
    name: "España",
    level: "pais",
    lat: 40.4,
    lng: -3.7,
    children: [
      {
        name: "Andalucía",
        level: "comunidad",
        region: "AN",
        lat: 37.5,
        lng: -4.8,
        children: [
          {
            name: "Málaga",
            level: "provincia",
            lat: 36.75,
            lng: -4.5,
            children: [
              {
                name: "Marbella",
                level: "municipio",
                lat: 36.5101,
                lng: -4.8825,
                children: [
                  { name: "Nueva Andalucía", level: "zona", lat: 36.506, lng: -4.952 },
                  { name: "Golden Mile", level: "zona", lat: 36.506, lng: -4.906 },
                  { name: "San Pedro de Alcántara", level: "zona", lat: 36.486, lng: -4.989 },
                  { name: "Puerto Banús", level: "zona", lat: 36.488, lng: -4.952 },
                  { name: "Elviria", level: "zona", lat: 36.489, lng: -4.753 },
                  { name: "Nagüeles", level: "zona", lat: 36.515, lng: -4.901 },
                ],
              },
              { name: "Estepona", level: "municipio", lat: 36.4276, lng: -5.147 },
              { name: "Mijas", level: "municipio", lat: 36.5959, lng: -4.6374 },
              { name: "Fuengirola", level: "municipio", lat: 36.5397, lng: -4.625 },
              { name: "Benalmádena", level: "municipio", lat: 36.5988, lng: -4.5163 },
              { name: "Torremolinos", level: "municipio", lat: 36.6203, lng: -4.4998 },
              { name: "Málaga", level: "municipio", lat: 36.7213, lng: -4.4214 },
              { name: "Nerja", level: "municipio", lat: 36.744, lng: -3.8759 },
              { name: "Manilva", level: "municipio", lat: 36.3763, lng: -5.25 },
            ],
          },
          {
            name: "Almería",
            level: "provincia",
            lat: 37.0,
            lng: -2.3,
            children: [
              { name: "Mojácar", level: "municipio", lat: 37.1394, lng: -1.8514 },
              { name: "Vera", level: "municipio", lat: 37.247, lng: -1.8697 },
              { name: "Roquetas de Mar", level: "municipio", lat: 36.7642, lng: -2.6148 },
            ],
          },
        ],
      },
      {
        name: "Comunitat Valenciana",
        level: "comunidad",
        region: "VC",
        lat: 39.4,
        lng: -0.4,
        children: [
          {
            name: "Alicante",
            level: "provincia",
            lat: 38.5,
            lng: -0.5,
            children: [
              { name: "Torrevieja", level: "municipio", lat: 37.9787, lng: -0.6822 },
              { name: "Orihuela Costa", level: "municipio", lat: 37.927, lng: -0.748 },
              { name: "Alfaz del Pi", level: "municipio", lat: 38.5793, lng: -0.103 },
              { name: "Altea", level: "municipio", lat: 38.5989, lng: -0.0517 },
              { name: "Calpe", level: "municipio", lat: 38.6447, lng: 0.0446 },
              { name: "Jávea", level: "municipio", lat: 38.7891, lng: 0.1662 },
              { name: "Dénia", level: "municipio", lat: 38.8407, lng: 0.1057 },
              { name: "Guardamar del Segura", level: "municipio", lat: 38.0894, lng: -0.6534 },
              { name: "Santa Pola", level: "municipio", lat: 38.1917, lng: -0.5622 },
            ],
          },
        ],
      },
      {
        name: "Región de Murcia",
        level: "comunidad",
        region: "MC",
        lat: 37.99,
        lng: -1.13,
        children: [
          {
            name: "Murcia",
            level: "provincia",
            lat: 37.99,
            lng: -1.13,
            children: [
              { name: "San Javier", level: "municipio", lat: 37.806, lng: -0.837 },
              { name: "Los Alcázares", level: "municipio", lat: 37.743, lng: -0.851 },
              { name: "Cartagena", level: "municipio", lat: 37.6257, lng: -0.9966 },
              { name: "Mazarrón", level: "municipio", lat: 37.599, lng: -1.314 },
            ],
          },
        ],
      },
      {
        name: "Illes Balears",
        level: "comunidad",
        region: "IB",
        lat: 39.6,
        lng: 2.9,
        children: [
          {
            name: "Illes Balears",
            level: "provincia",
            lat: 39.6,
            lng: 2.9,
            children: [
              {
                name: "Palma",
                level: "municipio",
                lat: 39.5696,
                lng: 2.6502,
                children: [
                  { name: "Santa Catalina", level: "zona", lat: 39.572, lng: 2.636 },
                  { name: "Portixol", level: "zona", lat: 39.561, lng: 2.669 },
                  { name: "Son Vida", level: "zona", lat: 39.585, lng: 2.618 },
                  { name: "Old Town", level: "zona", lat: 39.571, lng: 2.649 },
                ],
              },
              { name: "Calvià", level: "municipio", lat: 39.565, lng: 2.506 },
              { name: "Andratx", level: "municipio", lat: 39.539, lng: 2.42 },
              { name: "Pollença", level: "municipio", lat: 39.877, lng: 3.016 },
              { name: "Alcúdia", level: "municipio", lat: 39.853, lng: 3.121 },
              { name: "Santanyí", level: "municipio", lat: 39.355, lng: 3.129 },
            ],
          },
        ],
      },
      {
        name: "Canarias",
        level: "comunidad",
        region: "CN",
        lat: 28.3,
        lng: -16.0,
        children: [
          {
            name: "Las Palmas",
            level: "provincia",
            lat: 28.1,
            lng: -15.4,
            children: [
              { name: "Mogán", level: "municipio", lat: 27.883, lng: -15.723 },
              { name: "San Bartolomé de Tirajana", level: "municipio", lat: 27.925, lng: -15.573 },
            ],
          },
          {
            name: "Santa Cruz de Tenerife",
            level: "provincia",
            lat: 28.3,
            lng: -16.6,
            children: [
              { name: "Adeje", level: "municipio", lat: 28.1227, lng: -16.726 },
              { name: "Arona", level: "municipio", lat: 28.0996, lng: -16.681 },
            ],
          },
        ],
      },
      {
        name: "Catalunya",
        level: "comunidad",
        region: "CT",
        lat: 41.8,
        lng: 1.6,
        children: [
          {
            name: "Girona",
            level: "provincia",
            lat: 42.0,
            lng: 2.8,
            children: [
              { name: "Lloret de Mar", level: "municipio", lat: 41.7, lng: 2.845 },
              { name: "Roses", level: "municipio", lat: 42.262, lng: 3.176 },
              { name: "Castell-Platja d'Aro", level: "municipio", lat: 41.817, lng: 3.068 },
            ],
          },
          {
            name: "Barcelona",
            level: "provincia",
            lat: 41.6,
            lng: 1.9,
            children: [
              { name: "Barcelona", level: "municipio", lat: 41.3874, lng: 2.1686 },
              { name: "Sitges", level: "municipio", lat: 41.235, lng: 1.811 },
            ],
          },
        ],
      },
      {
        name: "Comunidad de Madrid",
        level: "comunidad",
        region: "MD",
        lat: 40.4,
        lng: -3.7,
        children: [
          {
            name: "Madrid",
            level: "provincia",
            lat: 40.4,
            lng: -3.7,
            children: [
              { name: "Madrid", level: "municipio", lat: 40.4168, lng: -3.7038 },
            ],
          },
        ],
      },
    ],
  },
];

const counts: Record<Level, number> = {
  pais: 0,
  comunidad: 0,
  provincia: 0,
  municipio: 0,
  zona: 0,
};

/** The URL path starts at municipio; above it, an identity key that cannot collide. */
function fullSlugFor(node: Node, slug: string, parentPath: string): string {
  return node.level === "municipio" || node.level === "zona"
    ? joinSlug(parentPath, slug)
    : `${node.level}/${slug}`;
}

async function insertNode(
  node: Node,
  parentId: number | null,
  parentPath: string,
  inheritedRegion: string | null,
): Promise<void> {
  const slug = slugify(node.name);
  const fullSlug = fullSlugFor(node, slug, parentPath);
  const region = node.region ?? inheritedRegion;

  await db
    .insert(locations)
    .values({
      parentId: parentId ?? undefined,
      level: node.level,
      name: node.name,
      slug,
      fullSlug,
      acquisitionRegion: region ?? undefined,
      lat: node.lat != null ? node.lat.toString() : undefined,
      lng: node.lng != null ? node.lng.toString() : undefined,
    })
    .onDuplicateKeyUpdate({
      set: {
        name: node.name,
        level: node.level,
        acquisitionRegion: region ?? undefined,
        lat: node.lat != null ? node.lat.toString() : undefined,
        lng: node.lng != null ? node.lng.toString() : undefined,
      },
    });

  // Re-read to get the id (insert...onDuplicateKeyUpdate doesn't return it
  // portably across MySQL configs). full_slug is UNIQUE, so this is exact.
  const [row] = await db.query.locations.findMany({
    where: (l, { eq }) => eq(l.fullSlug, fullSlug),
    columns: { id: true },
    limit: 1,
  });
  if (!row) throw new Error(`failed to read back location ${fullSlug}`);
  counts[node.level]++;

  // Only URL levels extend the path; a provincia does not prefix its municipios.
  const childPath =
    node.level === "municipio" || node.level === "zona" ? fullSlug : parentPath;

  for (const child of node.children ?? []) {
    await insertNode(child, row.id, childPath, region ?? null);
  }
}

async function main() {
  for (const root of TREE) {
    await insertNode(root, null, "", null);
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(
    `seeded ${total} locations: ${counts.pais} pais, ${counts.comunidad} comunidades, ` +
      `${counts.provincia} provincias, ${counts.municipio} municipios, ${counts.zona} zonas`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
