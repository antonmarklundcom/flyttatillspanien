/**
 * The publish gate — the one rule that decides whether a listing row is
 * allowed to become an advertisement.
 *
 * **Spain's RD 390/2021 requires the energy rating to appear in any
 * advertisement offering a property for sale or rent.** Without it the ad is
 * not merely thin, it is non-compliant. So `energy_rating` is required to
 * reach `status: 'published'` — `en_tramite` (certificate applied for) and
 * `exento` (listed buildings, some rural, under 50 m²) are valid answers, and
 * silence is not.
 *
 * **Where this is enforced, and why not in the form.** The wizard is one write
 * path and the importer is the other, and the importer is where most listings
 * will come from. A check that lives in the form is bypassed by every row that
 * arrives through a spreadsheet. So the gate is called from the server-side
 * writers instead — the same placement and the same reasoning as
 * `commitImportAction`'s permission check:
 *
 *   - `approveListing()` (review queue → published)
 *   - `updateListing()` (panel edit, any scope, when status becomes published)
 *   - `commitImport(..., { publish: true })` (the importer's publish-on-commit)
 *
 * Draft and `pending_review` transitions are deliberately NOT gated: a lister
 * who has applied for a certificate must still be able to save and submit, and
 * refusing the submission would only push the missing field out of the review
 * queue where an operator can see it.
 *
 * Pure on purpose — no drizzle, no `server-only`. The rule is a predicate over
 * a row, so `npm run verify:import` can exercise it with no database, and the
 * three writers above stay the only places that know how to *apply* it.
 */

/** The columns the gate reads. A partial row is enough — pass what you have. */
export interface PublishGateRow {
  energyRating?: string | null;
}

/** Machine-readable reasons, so a caller can map one to its own copy. */
export type PublishBlock = "energy_rating_missing";

/**
 * Why this row may not be published, or an empty list when it may.
 *
 * A list rather than a boolean because the design doc's §3.8 table has more
 * MVP-adjacent candidates behind it (a `terreno` with no
 * `land_classification`, say). Adding one is then an entry here plus its
 * message, not a new shape at three call sites.
 */
export function publishBlocks(row: PublishGateRow): PublishBlock[] {
  const blocks: PublishBlock[] = [];
  if (!row.energyRating) blocks.push("energy_rating_missing");
  return blocks;
}

/** True when this row may move to `published`. */
export function canPublish(row: PublishGateRow): boolean {
  return publishBlocks(row).length === 0;
}

/**
 * Operator-facing explanation, in Swedish — these surface in `/admin` and in
 * the import report, both of which are staff-only. Kept here rather than in
 * `sv.ts` because it is the gate's own vocabulary: a new block must not be
 * able to ship without its reason.
 */
export const PUBLISH_BLOCK_MESSAGE: Record<PublishBlock, string> = {
  energy_rating_missing:
    "Energiklass saknas. Spansk lag (RD 390/2021) kräver att energiklassen " +
    "anges i annonsen — välj A–G, en_tramite eller exento innan annonsen " +
    "publiceras.",
};

/** One line naming every reason, or null when the row may be published. */
export function publishBlockReason(row: PublishGateRow): string | null {
  const blocks = publishBlocks(row);
  if (blocks.length === 0) return null;
  return blocks.map((b) => PUBLISH_BLOCK_MESSAGE[b]).join(" ");
}
