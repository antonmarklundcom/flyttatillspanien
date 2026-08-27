import type { PropertyType } from "./import/types";

/** Spanish label per property type, in the order shown in selects. */
export const PROPERTY_TYPE_OPTIONS: { value: PropertyType; label: string }[] = [
  { value: "casa", label: "Casas" },
  { value: "departamento", label: "Departamentos" },
  { value: "terreno", label: "Terrenos" },
  { value: "duplex", label: "Dúplex" },
  { value: "comercial", label: "Locales comerciales" },
  { value: "oficina", label: "Oficinas" },
  { value: "deposito", label: "Depósitos" },
  { value: "quinta", label: "Quintas" },
];

/** Same labels, keyed by type — for breadcrumbs and other lookups. */
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = Object.fromEntries(
  PROPERTY_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<PropertyType, string>;
