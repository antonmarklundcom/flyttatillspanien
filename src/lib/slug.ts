/**
 * Slug helper (shared by locations, listings, agencies, projects).
 *
 * Deterministic and ASCII-only so URLs are stable and diff-clean: strips
 * Spanish diacritics (Ñemby → nemby, Asunción → asuncion), lowercases, and
 * collapses everything else to single hyphens. Used at write time; slugs are
 * never recomputed for an existing row (that would break inbound SEO links).
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // drop combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

/** Join a parent full-slug with a child slug ('' parent → child alone). */
export function joinSlug(parentFullSlug: string, childSlug: string): string {
  return parentFullSlug ? `${parentFullSlug}/${childSlug}` : childSlug;
}
