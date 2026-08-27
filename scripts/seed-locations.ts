/**
 * Seed the locations hierarchy — the tree that drives every programmatic SEO
 * page (/kopa/{ort}, area guides). Spain tree per
 * docs/SPAIN-PORTAL-DESIGN.md §"Seeded regions".
 *
 * Scope v1: the coastal comunidades where a Swedish buyer actually looks —
 * Costa del Sol, Costa Blanca, Costa Cálida, the Balearics, the Canaries,
 * the Costa Brava/Barcelona, and Madrid. Not the full Spanish municipal
 * census — pages only exist where listings will (the same rule the
 * inherited Paraguay seed stated). New locations are added by editing TREE
 * and re-running; the script is idempotent (upsert by full_slug), so
 * re-runs never duplicate and safely backfill lat/lng.
 *
 *   npx tsx scripts/seed-locations.ts
 *
 * Five levels against Paraguay's four (pais/comunidad/provincia/municipio/
 * zona). **`full_slug` is the URL path only — municipio[/zona], never the
 * full ancestry**: comunidad and provincia are grouping/tax-resolution
 * levels that live in `parent_id` only. `joinSlug` therefore resets at
 * municipio — a municipio's full_slug is its own slug, not joined onto its
 * province's — while pais/comunidad/provincia keep an internal hierarchical
 * full_slug purely so the UNIQUE constraint has something distinct to key
 * on; nothing ever resolves a page by their full_slug.
 *
 * `acquisitionRegion` is set on every node to its comunidad's ISO-3166-2:ES
 * code (matches `acquisition_costs.region`, seeded by
 * scripts/seed-acquisition-costs.ts) and copied down the whole subtree at
 * seed time — see src/lib/geo.ts / CLAUDE.md's F38 reasoning for why this is
 * materialized rather than resolved by walking parent_id in a query.
 *
 * Coordinates are approximate centroids, good enough for map default
 * centering; per-listing lat/lng comes from the importer.
 */
import { db } from "../src/db";
import { locations } from "../src/db/schema";
import { slugify, joinSlug } from "../src/lib/slug";

type Level = "pais" | "comunidad" | "provincia" | "municipio" | "zona";

interface Node {
  name: string;
  level: Level;
  lat?: number;
  lng?: number;
  /** Set on comunidad nodes; copied down to every descendant at seed time. */
  acquisitionRegion?: string;
  children?: Node[];
}

const TREE: Node[] = [
  {
    name: "España",
    level: "pais",
    children: [
      {
        name: "Andalucía",
        level: "comunidad",
        acquisitionRegion: "AN",
        children: [
          {
            name: "Málaga",
            level: "provincia",
            children: [
              { name: "Marbella", level: "municipio", lat: 36.5099, lng: -4.8863, children: [
                { name: "Nueva Andalucía", level: "zona", lat: 36.5027, lng: -4.9535 },
                { name: "Golden Mile", level: "zona", lat: 36.5145, lng: -4.9105 },
                { name: "San Pedro de Alcántara", level: "zona", lat: 36.4869, lng: -4.9975 },
                { name: "Puerto Banús", level: "zona", lat: 36.4874, lng: -4.9526 },
                { name: "Elviria", level: "zona", lat: 36.4877, lng: -4.7893 },
                { name: "Nagüeles", level: "zona", lat: 36.5057, lng: -4.9298 },
              ] },
              { name: "Estepona", level: "municipio", lat: 36.4285, lng: -5.1449 },
              { name: "Mijas", level: "municipio", lat: 36.5966, lng: -4.6388 },
              { name: "Fuengirola", level: "municipio", lat: 36.5411, lng: -4.6247 },
              { name: "Benalmádena", level: "municipio", lat: 36.5988, lng: -4.5166 },
              { name: "Torremolinos", level: "municipio", lat: 36.6203, lng: -4.5 },
              { name: "Málaga", level: "municipio", lat: 36.7213, lng: -4.4214 },
              { name: "Nerja", level: "municipio", lat: 36.75, lng: -3.8756 },
              { name: "Manilva", level: "municipio", lat: 36.3789, lng: -5.2506 },
            ],
          },
          {
            name: "Almería",
            level: "provincia",
            children: [
              { name: "Mojácar", level: "municipio", lat: 37.1436, lng: -1.8524 },
              { name: "Vera", level: "municipio", lat: 37.2494, lng: -1.8635 },
              { name: "Roquetas de Mar", level: "municipio", lat: 36.7643, lng: -2.6144 },
            ],
          },
        ],
      },
      {
        name: "Comunitat Valenciana",
        level: "comunidad",
        acquisitionRegion: "VC",
        children: [
          {
            name: "Alicante",
            level: "provincia",
            children: [
              { name: "Torrevieja", level: "municipio", lat: 37.9776, lng: -0.6822 },
              { name: "Orihuela Costa", level: "municipio", lat: 37.9382, lng: -0.7382 },
              { name: "Alfaz del Pi", level: "municipio", lat: 38.5911, lng: -0.1097 },
              { name: "Altea", level: "municipio", lat: 38.5994, lng: -0.0511 },
              { name: "Calpe", level: "municipio", lat: 38.6447, lng: 0.0443 },
              { name: "Jávea", level: "municipio", lat: 38.7897, lng: 0.1654 },
              { name: "Dénia", level: "municipio", lat: 38.8408, lng: 0.1054 },
              { name: "Guardamar del Segura", level: "municipio", lat: 38.0917, lng: -0.6547 },
              { name: "Santa Pola", level: "municipio", lat: 38.1917, lng: -0.5631 },
            ],
          },
        ],
      },
      {
        name: "Región de Murcia",
        level: "comunidad",
        acquisitionRegion: "MC",
        children: [
          {
            name: "Murcia",
            level: "provincia",
            children: [
              { name: "San Javier", level: "municipio", lat: 37.8039, lng: -0.8347 },
              { name: "Los Alcázares", level: "municipio", lat: 37.7439, lng: -0.8497 },
              { name: "Cartagena", level: "municipio", lat: 37.6257, lng: -0.9966 },
              { name: "Mazarrón", level: "municipio", lat: 37.5989, lng: -1.3157 },
            ],
          },
        ],
      },
      {
        name: "Illes Balears",
        level: "comunidad",
        acquisitionRegion: "IB",
        children: [
          {
            name: "Illes Balears",
            level: "provincia",
            children: [
              { name: "Palma", level: "municipio", lat: 39.5696, lng: 2.6502, children: [
                { name: "Santa Catalina", level: "zona", lat: 39.5717, lng: 2.6360 },
                { name: "Portixol", level: "zona", lat: 39.5642, lng: 2.6685 },
                { name: "Son Vida", level: "zona", lat: 39.5896, lng: 2.6132 },
                { name: "Old Town", level: "zona", lat: 39.5701, lng: 2.6493 },
              ] },
              { name: "Calvià", level: "municipio", lat: 39.5652, lng: 2.5057 },
              { name: "Andratx", level: "municipio", lat: 39.5425, lng: 2.4256 },
              { name: "Pollença", level: "municipio", lat: 39.8735, lng: 3.0176 },
              { name: "Alcúdia", level: "municipio", lat: 39.8528, lng: 3.122 },
              { name: "Santanyí", level: "municipio", lat: 39.3506, lng: 3.1276 },
            ],
          },
        ],
      },
      {
        name: "Canarias",
        level: "comunidad",
        acquisitionRegion: "CN",
        children: [
          {
            name: "Las Palmas",
            level: "provincia",
            children: [
              { name: "Mogán", level: "municipio", lat: 27.8836, lng: -15.7594 },
              { name: "San Bartolomé de Tirajana", level: "municipio", lat: 27.9256, lng: -15.5736 },
            ],
          },
          {
            name: "Santa Cruz de Tenerife",
            level: "provincia",
            children: [
              { name: "Adeje", level: "municipio", lat: 28.1225, lng: -16.726 },
              { name: "Arona", level: "municipio", lat: 28.0997, lng: -16.681 },
            ],
          },
        ],
      },
      {
        name: "Catalunya",
        level: "comunidad",
        acquisitionRegion: "CT",
        children: [
          {
            name: "Girona",
            level: "provincia",
            children: [
              { name: "Lloret de Mar", level: "municipio", lat: 41.6997, lng: 2.8456 },
              { name: "Roses", level: "municipio", lat: 42.262, lng: 3.1762 },
              { name: "Castell-Platja d'Aro", level: "municipio", lat: 41.8172, lng: 3.0644 },
            ],
          },
          {
            name: "Barcelona",
            level: "provincia",
            children: [
              { name: "Barcelona", level: "municipio", lat: 41.3874, lng: 2.1686 },
              { name: "Sitges", level: "municipio", lat: 41.2379, lng: 1.8057 },
            ],
          },
        ],
      },
      {
        name: "Comunidad de Madrid",
        level: "comunidad",
        acquisitionRegion: "MD",
        children: [
          {
            name: "Madrid",
            level: "provincia",
            children: [{ name: "Madrid", level: "municipio", lat: 40.4168, lng: -3.7038 }],
          },
        ],
      },
    ],
  },
];

let upserted = 0;

async function insertNode(
  node: Node,
  parentId: number | null,
  /** Internal hierarchical slug — used for pais/comunidad/provincia uniqueness only. */
  internalParentFullSlug: string,
  region: string | undefined,
): Promise<void> {
  const slug = slugify(node.name);
  const effectiveRegion = node.acquisitionRegion ?? region;

  // full_slug is the public URL path, which starts fresh at municipio: a
  // municipio's full_slug is its own slug (never prefixed by its province),
  // and a zona's is joined onto its municipio's. pais/comunidad/provincia
  // keep an internal hierarchical slug purely to satisfy the UNIQUE
  // constraint — nothing ever resolves a page by their full_slug.
  const fullSlug =
    node.level === "municipio" ? slug : joinSlug(internalParentFullSlug, slug);

  await db
    .insert(locations)
    .values({
      parentId: parentId ?? undefined,
      level: node.level,
      name: node.name,
      slug,
      fullSlug,
      lat: node.lat != null ? node.lat.toString() : undefined,
      lng: node.lng != null ? node.lng.toString() : undefined,
      acquisitionRegion: effectiveRegion,
    })
    .onDuplicateKeyUpdate({
      set: {
        name: node.name,
        level: node.level,
        lat: node.lat != null ? node.lat.toString() : undefined,
        lng: node.lng != null ? node.lng.toString() : undefined,
        acquisitionRegion: effectiveRegion,
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
  upserted++;

  for (const child of node.children ?? []) {
    // A zona joins onto its municipio's own full_slug; a provincia's
    // children (municipios) ignore this and start fresh instead (handled by
    // the `node.level === "municipio"` branch above, for the child call).
    await insertNode(child, row.id, fullSlug, effectiveRegion);
  }
}

async function main() {
  for (const root of TREE) {
    await insertNode(root, null, "", undefined);
  }
  console.log(`seeded ${upserted} locations`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
