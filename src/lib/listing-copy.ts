/**
 * Which words a listing is shown in, and whether a machine wrote them.
 *
 * Spanish arrives from the agency feed and Swedish is derived
 * (`npm run cron:translate`), except when a Swedish relocation agent writes
 * the listing themselves — `source_lang` is what tells those apart. The rule
 * the design doc sets is short and applies to every surface: read
 * `title_sv ?? title`, and where the Swedish came from the cron rather than
 * from a human, say so. A machine translation presented as the agency's own
 * words is a trust problem the moment one is wrong about a room count.
 *
 * One home for that rule so the card, the detail page and the metadata cannot
 * drift apart — a page that fell back to `title` alone would print the
 * agency's Spanish under a Swedish heading, and one that dropped the marker
 * would launder a machine's guess into the seller's claim.
 *
 * Pure: no drizzle, no `server-only`. Client components render cards.
 */

/** The subset of a listing row this module reads. */
export interface ListingCopyRow {
  sourceLang: "es" | "sv";
  title: string;
  titleSv?: string | null;
  descriptionEs?: string | null;
  descriptionSv?: string | null;
}

/** The heading to render. Falls back to the source title until the cron runs. */
export function servedTitle(row: ListingCopyRow): string {
  return row.titleSv?.trim() || row.title;
}

/** The body copy to render, or null when there is none in either language. */
export function servedDescription(row: ListingCopyRow): string | null {
  const sv = row.descriptionSv?.trim();
  if (sv) return sv;
  return row.descriptionEs?.trim() || null;
}

/**
 * True when what the visitor is about to read was produced by
 * `cron:translate` rather than typed by a person — i.e. the source was
 * Spanish and a Swedish version exists. A Swedish-authored listing
 * (`source_lang = 'sv'`) is never marked, and neither is a Spanish listing
 * still waiting for its translation, because in that case the visitor is
 * reading the agency's own words.
 */
export function isMachineTranslated(row: ListingCopyRow): boolean {
  return row.sourceLang === "es" && Boolean(row.titleSv?.trim());
}
