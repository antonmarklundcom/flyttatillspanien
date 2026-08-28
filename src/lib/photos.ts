import type { PropertyType } from "./import/types";

/**
 * INTERIM: the demo dataset seeds random picsum.photos covers that have
 * nothing to do with the actual property (vans, bridges, fruit). Treat those
 * as "no real photo yet" everywhere a cover/gallery image is rendered, rather
 * than showing misleading stock. Real R2 keys never match this pattern.
 * Remove once real photos are imported for every listing.
 */
export function isPlaceholderPhoto(key: string | null | undefined): boolean {
  return !key || /picsum\.photos/i.test(key);
}

/** Icon shown on the "photo coming soon" placeholder, per property type. */
export const TYPE_ICON: Record<PropertyType, string> = {
  villa: "🏠",
  apartamento: "🏢",
  atico: "🏙",
  adosado: "🏘",
  duplex: "🏘",
  finca: "🌾",
  terreno: "🌳",
  local: "🏬",
};
