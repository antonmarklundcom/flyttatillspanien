import type { PropertyType } from "./import/types";

/**
 * Swedish label per property type, in the order shown in selects. DB values
 * stay in Spanish (docs/SPAIN-PORTAL-DESIGN.md §3.1) since that is the
 * language of every agency feed the importer will read; labels here are what
 * the Swedish-facing panel and category pages show.
 */
export const PROPERTY_TYPE_OPTIONS: { value: PropertyType; label: string }[] = [
  { value: "villa", label: "Villor" },
  { value: "apartamento", label: "Lägenheter" },
  { value: "atico", label: "Takvåningar" },
  { value: "adosado", label: "Radhus" },
  { value: "duplex", label: "Etagelägenheter" },
  { value: "finca", label: "Lantegendomar" },
  { value: "terreno", label: "Tomter" },
  { value: "local", label: "Lokaler" },
];

/** Same labels, keyed by type — for breadcrumbs and other lookups. */
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = Object.fromEntries(
  PROPERTY_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<PropertyType, string>;
