import type { PropertyType } from "./import/types";
import { svCategory } from "@/i18n/sv";

/**
 * The property-type vocabulary as a select and as a lookup.
 *
 * The DB enum is Spanish (it is feed vocabulary — see schema.ts); the labels
 * are Swedish and come from the dictionary rather than being spelled out here,
 * so that a type's name has exactly one home. The ORDER is this module's own
 * contribution: it is the order a select shows, roughly most to least common
 * for a Swedish buyer of Spanish property.
 *
 * Client-safe, like `sv.ts` itself — the panel's type select is a client
 * component.
 */
export const PROPERTY_TYPE_ORDER: readonly PropertyType[] = [
  "villa",
  "apartamento",
  "atico",
  "adosado",
  "duplex",
  "finca",
  "terreno",
  "local",
];

export const PROPERTY_TYPE_OPTIONS: { value: PropertyType; label: string }[] =
  PROPERTY_TYPE_ORDER.map((value) => ({
    value,
    label: svCategory.typeLabel[value],
  }));

/** Same labels, keyed by type — for breadcrumbs and other lookups. */
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> =
  Object.fromEntries(
    PROPERTY_TYPE_OPTIONS.map((o) => [o.value, o.label]),
  ) as Record<PropertyType, string>;
