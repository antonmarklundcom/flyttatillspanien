import Link from "next/link";
import { formatEur, imageThumbUrl } from "@/lib/format";
import { servedTitle } from "@/lib/listing-copy";
import { listingUrl } from "@/lib/urls";
import { isPlaceholderPhoto } from "@/lib/photos";
import type { ListingCard as Card } from "@/lib/queries";
import { dict } from "@/i18n/server";

/**
 * Category-grid / homepage card, in the editorial system: **the photo is the
 * card**. No white frame, no soft shadow, no body panel — the image fills the
 * tile and the text sits on it over a bottom-up gradient. Hover pushes the
 * photo to 1.06 over 1.1s; nothing else moves.
 *
 * A listing with no usable photo gets the house image rather than an icon on a
 * grey rectangle: in a grid where every neighbour is a photograph, an empty
 * tile reads as broken. `listing-fallback.webp` is deliberately abstract (a
 * wall and a palm shadow) so it can't be mistaken for the property itself, and
 * "Foto próximamente" stays on top of it.
 */
export async function ListingCard({ card }: { card: Card }) {
  const t = (await dict()).card;
  // Thumb, not the full 1600px original: a category page renders ~20 of these
  // on a phone. Falls back to the stored key for imported rows that have no
  // derivative yet (see imageThumbUrl).
  const cover = isPlaceholderPhoto(card.coverKey)
    ? null
    : imageThumbUrl(card.coverKey);
  // `built_m2` is the compared figure; `plot_m2` only stands in for the types
  // with no building on them (design doc §3.1).
  const area = card.builtM2 ?? card.plotM2;
  const title = servedTitle(card);
  // new Date() re-wrap: cards that crossed an unstable_cache boundary carry
  // featuredUntil as an ISO string, and string > Date is silently false.
  const isFeatured =
    card.featuredUntil != null && new Date(card.featuredUntil) > new Date();

  const specs = [
    card.bedrooms != null ? t.bedroomsShort(card.bedrooms) : null,
    card.bathrooms != null ? t.bathrooms(card.bathrooms) : null,
    area ? t.area(Math.round(Number(area))) : null,
  ].filter((s): s is string => s !== null);

  return (
    <Link className="ds-photo-card listing-card" href={listingUrl(card)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized R2
          thumb derivative (imageThumbUrl); next/image would only add a proxy hop. */}
      <img
        className="ds-photo-card__img"
        src={cover ?? "/img/listing-fallback.webp"}
        alt={title}
        loading="lazy"
        decoding="async"
      />
      <div className="ds-photo-card__scrim" />

      <span className="ds-photo-card__chip">
        {t.operationBadge[card.operation]}
      </span>
      {/* No "Verifierad" here: listings.is_verified means "the publisher
          proved they can read the account's inbox", which is not the
          admin-granted verified badge the profile pages show (audit F57).
          The card stays silent rather than showing a flag with two meanings. */}
      {isFeatured && (
        <span className="listing-card__flags">
          <span className="listing-card__flag">{t.featured}</span>
        </span>
      )}
      {!cover && (
        <span className="listing-card__nophoto">{t.noPhoto}</span>
      )}

      <div className="ds-photo-card__body">
        {/* No location line: ListingCard carries locationId, not a name, and
            resolving it here would add a query per grid. The title already
            names the barrio in practice. */}
        <div className="listing-card__title">{title}</div>
        <div className="ds-photo-card__price">{formatEur(card.priceEur)}</div>
        {specs.length > 0 && (
          <div className="listing-card__specs">
            {specs.map((s) => (
              <span className="listing-card__spec" key={s}>
                <span className="listing-card__tick" aria-hidden />
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
