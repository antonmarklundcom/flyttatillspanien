import Link from "next/link";
import { formatEur, formatSek, imageThumbUrl, type FxRate } from "@/lib/format";
import { servedTitle, isMachineTranslated } from "@/lib/listing-copy";
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
 * "Bild kommer" stays on top of it.
 *
 * `fx` is fetched ONCE by the page and threaded through every card it renders
 * — `getFxRate()` is cheap (a one-row cached table) but a grid can hold 48
 * cards, and re-reading the cache 48 times per request is the same class of
 * mistake `attachCovers()` exists to avoid for photos. Pass `null` on a page
 * that has no fresh rate; the SEK line simply does not render.
 */
export async function ListingCard({ card, fx }: { card: Card; fx: FxRate | null }) {
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
  const sek = formatSek(card.priceEur, fx);

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
      {/* Legally required in any advertisement offering the property
          (RD 390/2021) — a card in a grid is one, so this is not detail-page
          only. `en_tramite`/`exento` get their own short label; a NULL rating
          never reaches this card because the publish gate blocks it. */}
      {card.energyRating && (
        <span className="ds-photo-card__chip ds-photo-card__chip--energy">
          {card.energyRating === "en_tramite"
            ? t.energyPending
            : card.energyRating === "exento"
              ? t.energyExempt
              : t.energy(card.energyRating)}
        </span>
      )}
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
        {isMachineTranslated(card) && (
          <div className="listing-card__machine-translated">
            {t.machineTranslated}
          </div>
        )}
        <div className="ds-photo-card__price">
          {formatEur(card.priceEur)}
          {sek && <span className="listing-card__sek"> · {sek}</span>}
        </div>
        {(card.isVpo ||
          card.legalStatus === "sin_lpo" ||
          card.legalStatus === "en_regularizacion") && (
          <div className="listing-card__caution">
            {card.isVpo ? t.vpo : t.legalCaution}
          </div>
        )}
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
