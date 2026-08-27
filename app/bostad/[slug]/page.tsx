import { cache } from "react";
import { after } from "next/server";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getListingByPublicId,
  getSimilarListings,
  getAgencyListings,
  getBestFinancingProgram,
  citySubtreeIds,
} from "@/lib/queries";
import {
  parseListingPublicId,
  listingUrl,
  categoryUrl,
  agencyUrl,
} from "@/lib/urls";
import { formatPrice, formatCuota, formatUsd, imageUrl, imageThumbUrl } from "@/lib/format";
import { isPlaceholderPhoto, TYPE_ICON } from "@/lib/photos";
import { brandName } from "@/lib/brand-server";
import { PROPERTY_TYPE_LABELS } from "@/lib/property-types";
import {
  listingJsonLd,
  breadcrumbJsonLd,
} from "@/lib/jsonld";
import { svPrecios, inquiryPrefillFor } from "@/i18n/sv";
import { currentLocale, dict } from "@/i18n/server";
import type { Dictionary } from "@/i18n";
import {
  hostOwnsListingDetail,
  listingCanonicalOrigin,
  siteOrigin,
} from "@/lib/origin";
import { languageAlternates } from "@/lib/alternates";
import { getCityPrices, medianFor } from "@/lib/precios-queries";
import { recordListingView } from "@/lib/stats-queries";
import { currentVertical } from "@/lib/vertical-context";
import { isBotUserAgent } from "@/lib/view-tracking";
import { waLink } from "@/lib/wa";
import { JsonLd } from "@/components/JsonLd";
import { ContactForm } from "@/components/ContactForm";
import { ListingCard } from "@/components/ListingCard";
import { ListingMapLazy } from "@/components/ListingMapLazy";
import { PriceAlert } from "@/components/PriceAlert";
import { RecentlyViewedRecorder } from "@/components/RecentlyViewed";
import { safeImageUrl } from "@/lib/external-image";

// Canonical URLs are derived from the Host header (one deployment, several
// domains — src/lib/origin.ts), which is a dynamic API, so this route can no
// longer be cached across requests: an ISR entry is not keyed by host and
// would serve one domain's canonical to another. The cache() below plus the
// parallelised loader in queries.ts pay for the lost ISR.

type Params = { params: Promise<{ slug: string }> };

// generateMetadata and the page body both need the listing; cache() collapses
// them into one set of queries per request.
const load = cache(async (slugParam: string) => {
  const publicId = parseListingPublicId(slugParam);
  if (!publicId) return null;
  return getListingByPublicId(publicId);
});

const subtreeIds = cache(citySubtreeIds);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const detail = await load(slug);
  if (!detail) return { title: (await dict()).listing.metaNotFound };
  const { listing } = detail;
  const [brand, t] = await Promise.all([
    brandName(),
    dict().then((d) => d.listing),
  ]);
  const canonical = `${await listingCanonicalOrigin()}${listingUrl(listing)}`;
  // Only a host that OWNS its detail pages is a language version of anything;
  // a feeder canonicalises this page away, and hreflang on a non-canonical URL
  // is a contradiction. Same predicate the sitemap gates on (origin.ts).
  const languages = (await hostOwnsListingDetail())
    ? languageAlternates({ path: listingUrl(listing), scope: "listing" })
    : undefined;
  const cover = imageUrl(detail.images[0]?.r2Key ?? null);
  return {
    title: t.metaTitle(listing.title, formatPrice(listing)),
    description: listing.descriptionEs?.slice(0, 160) ?? listing.title,
    alternates: { canonical, languages },
    openGraph: {
      // og:title doesn't inherit title.template — brand goes in by hand (F47).
      title: t.ogTitle(listing.title, brand),
      url: canonical,
      images: cover ? [cover] : undefined,
      type: "website",
    },
    robots: { index: true, follow: true },
  };
}

/**
 * amenities is display-only JSON with no enforced shape (schema §2.1): accept
 * an array of strings, or an object whose truthy keys are the amenities.
 */
function normalizeAmenities(raw: unknown): string[] {
  const pretty = (s: string) => {
    const t = s.replace(/[_-]+/g, " ").trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string").map(pretty);
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => Boolean(v))
      .map(([k]) => pretty(k));
  }
  return [];
}

export default async function ListingPage({ params }: Params) {
  const brand = await brandName();
  const { slug } = await params;
  const detail = await load(slug);
  if (!detail) notFound();

  const { listing, images, chain, agency, agent, ownerUser } = detail;
  const [d, locale] = await Promise.all([dict(), currentLocale()]);
  const t: Dictionary["listing"] = d.listing;
  const numberLocale = locale === "en" ? "en-US" : "es-PY";

  /**
   * Count the view after the response is sent: the owner's stats must never
   * cost the visitor latency, and a failed counter must never break a page
   * that rendered fine. Crawlers are excluded so the number means people
   * (see view-tracking.ts).
   */
  const userAgent = (await headers()).get("user-agent");
  if (!isBotUserAgent(userAgent)) {
    after(async () => {
      try {
        await recordListingView(listing.id);
      } catch {
        /* a dropped view is not worth an error page */
      }
    });
  }
  const cuota = formatCuota(listing.cuotaGs);
  /**
   * Contact chain, most specific first. `ownerUser` is the FSBO tail: a
   * listing published through /publicar belongs to a person, not an agency,
   * and without this link the card, the panel form and the mobile CTA bar all
   * rendered with no way to reach the seller (audit F4).
   */
  const contactWhatsapp =
    agent?.whatsapp ?? agency?.whatsapp ?? ownerUser?.whatsapp ?? null;
  const leadType = listing.operation === "venta" ? "buyer" : "renter";
  const area = listing.areaM2 ?? listing.landM2;
  const origin = await listingCanonicalOrigin();
  const servingOrigin = await siteOrigin();
  const canonical = `${origin}${listingUrl(listing)}`;
  const waMessage = inquiryPrefillFor(brand, listing.title, canonical);
  const waHref = waLink(contactWhatsapp, waMessage);

  const city = chain.find((c) => c.level === "municipio");
  const barrio = chain.find((c) => c.level === "zona");
  const typeLabel = PROPERTY_TYPE_LABELS[listing.propertyType];
  const typeUrl = city
    ? categoryUrl({ operation: listing.operation, citySlug: city.slug, type: listing.propertyType })
    : undefined;

  // Only include nodes with a genuinely routable URL in both the visible
  // nav and the JSON-LD (a bare barrio page isn't a valid route).
  const crumbs: { name: string; url?: string }[] = [
    { name: t.breadcrumbHome, url: "/" },
  ];
  if (city) {
    crumbs.push({
      name: city.name,
      url: categoryUrl({ operation: listing.operation, citySlug: city.slug }),
    });
  }
  if (typeUrl) crumbs.push({ name: typeLabel, url: typeUrl });
  if (barrio) {
    crumbs.push({
      name: barrio.name,
      url: city
        ? categoryUrl({
            operation: listing.operation,
            citySlug: city.slug,
            barrioSlug: barrio.slug,
            type: listing.propertyType,
          })
        : undefined,
    });
  }
  crumbs.push({ name: listing.title });

  // Ancestor crumbs are this host's own category pages; only the leaf lives
  // on the listing's canonical origin, so it goes in absolute (F32).
  const jsonLdCrumbs = crumbs
    .filter((c): c is { name: string; url: string } => Boolean(c.url))
    .concat([{ name: listing.title, url: canonical }]);

  const realImages = images.filter((im) => !isPlaceholderPhoto(im.r2Key));
  const visibleThumbs = realImages.slice(1, 4);
  const extraCount = realImages.length - 1 - visibleThumbs.length;

  // Approximate location only — barrio centroid, else city centroid. Never
  // the listing's own lat/lng (schema.ts: precise coords are "never shown
  // publicly at full precision").
  const approxLocation =
    barrio?.lat && barrio?.lng
      ? { lat: Number(barrio.lat), lng: Number(barrio.lng), label: `${barrio.name}, ${city?.name ?? ""}` }
      : city?.lat && city?.lng
        ? { lat: Number(city.lat), lng: Number(city.lng), label: city.name }
        : null;

  // citySubtreeIds must be awaited BEFORE the Promise.all array is built —
  // inside it, the await ran to completion before the other two branches were
  // even started, so the "parallel" block was three serial round-trips.
  const similarLocationIds = city ? await subtreeIds(city.id) : null;
  const vertical = await currentVertical();

  const [similar, fromAgency, financingProgram, cityPrices] = await Promise.all([
    city && similarLocationIds
      ? getSimilarListings({
          excludeId: listing.id,
          operation: listing.operation,
          type: listing.propertyType,
          locationIds: similarLocationIds,
          limit: 4,
          vertical,
        })
      : Promise.resolve([]),
    listing.agencyId
      ? getAgencyListings({ agencyId: listing.agencyId, excludeId: listing.id, limit: 4 })
      : Promise.resolve([]),
    listing.operation === "venta" && cuota
      ? getBestFinancingProgram()
      : Promise.resolve(null),
    // Market context for the internal link module below — independent of the
    // three above, so it belongs inside this block, not before it.
    city ? getCityPrices(city.slug) : Promise.resolve(null),
  ]);

  const cityHasPrices = (cityPrices?.reliableSample ?? 0) > 0;

  /**
   * Market context for this exact listing (audit I8). The medians payload was
   * already fetched and reduced to a boolean; naming the number turns a link
   * into a reason to click it. Only a sample of MIN_RELIABLE_SAMPLE or more
   * qualifies — see medianFor().
   */
  const contextCell = medianFor(cityPrices, listing.operation, listing.propertyType);
  // This listing's own price per m², for the reader to compare against. Land
  // is priced on the lot, everything else on built area — the same rule
  // /tasacion uses for its area question.
  const listingArea = Number(
    listing.propertyType === "terreno"
      ? (listing.landM2 ?? listing.areaM2)
      : (listing.areaM2 ?? listing.landM2),
  );
  const listingPerM2 =
    contextCell && Number.isFinite(listingArea) && listingArea > 0
      ? Number(listing.priceUsd) / listingArea
      : null;

  const amenities = normalizeAmenities(listing.amenities);
  const publishedAgo = listing.publishedAt
    ? formatPublishedAgo(listing.publishedAt, t)
    : null;

  // "Detalles de la propiedad" rows — only what we actually know.
  const details: { icon: string; label: string; value: string }[] = [];
  if (barrio) details.push({ icon: "📍", label: t.detailBarrio, value: barrio.name });
  if (city) details.push({ icon: "🏙", label: t.detailCity, value: city.name });
  details.push({ icon: TYPE_ICON[listing.propertyType], label: t.detailType, value: typeLabel });
  if (listing.propertyState)
    details.push({
      icon: "🔨",
      label: t.detailState,
      value: t.stateLabel[listing.propertyState] ?? listing.propertyState,
    });
  if (listing.areaM2)
    details.push({ icon: "📐", label: t.detailArea, value: t.factArea(Math.round(Number(listing.areaM2))) });
  if (listing.landM2)
    details.push({ icon: "🌳", label: t.detailLand, value: t.factArea(Math.round(Number(listing.landM2))) });
  if (listing.parking != null)
    details.push({ icon: "🚗", label: t.detailParking, value: String(listing.parking) });

  const sellerName =
    agency?.name ??
    agent?.name ??
    ownerUser?.name ??
    (ownerUser ? t.sellerKindOwner : t.sellerFallback(brand));
  const sellerInitials = sellerName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <main className="listing-main">
      <JsonLd
        data={[
          listingJsonLd(origin, detail),
          breadcrumbJsonLd(servingOrigin, jsonLdCrumbs),
        ]}
      />
      <RecentlyViewedRecorder
        entry={{
          href: listingUrl(listing),
          title: listing.title,
          price: formatPrice(listing),
          operation: listing.operation,
          // realImages already excludes placeholder keys, so a listing with no
          // real photo stores no img and the card renders the fallback.
          img: imageThumbUrl(realImages[0]?.r2Key ?? null),
          specs: [
            listing.bedrooms != null ? t.factBedrooms(listing.bedrooms) : null,
            listing.bathrooms != null ? t.factBathrooms(listing.bathrooms) : null,
            area ? t.factArea(Math.round(Number(area))) : null,
          ].filter((s): s is string => s !== null),
        }}
      />

      <nav className="breadcrumb-nav" aria-label={t.breadcrumbLabel}>
        {crumbs.map((c, i) => (
          <span key={`${c.name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {i > 0 && <span aria-hidden>›</span>}
            {c.url && i < crumbs.length - 1 ? (
              <Link className="breadcrumb-nav__link" href={c.url}>
                {c.name}
              </Link>
            ) : (
              <span className="breadcrumb-nav__current" aria-current={i === crumbs.length - 1 ? "page" : undefined}>
                {c.name}
              </span>
            )}
          </span>
        ))}
      </nav>

      <h1 className="listing-title">{listing.title}</h1>

      {/* Gallery */}
      {realImages.length === 0 ? (
        <div className="detail-gallery__empty">
          <span className="detail-gallery__empty-icon" aria-hidden>
            {TYPE_ICON[listing.propertyType]}
          </span>
          <span className="detail-gallery__empty-label">{t.galleryEmpty}</span>
        </div>
      ) : (
        <div
          className={`detail-gallery${visibleThumbs.length === 0 ? " detail-gallery--single" : ""}`}
        >
          <div className="detail-gallery__main">
            {/* eslint-disable-next-line @next/next/no-img-element -- the LCP
                element on the page that matters most for SEO; eager + high
                priority so the browser fetches it before it even reaches this
                point in the markup, instead of after CSS/JS discover it. */}
            <img
              className="media-cover-img"
              src={imageUrl(realImages[0].r2Key) ?? ""}
              alt={listing.title}
              loading="eager"
              fetchPriority="high"
            />
          </div>
          {visibleThumbs.length > 0 && (
            <div className="detail-gallery__thumbs">
              {visibleThumbs.map((im, i) => {
                const isLast = i === visibleThumbs.length - 1;
                return (
                  <div key={im.id} className="detail-gallery__thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="media-cover-img"
                      src={imageUrl(im.r2Key) ?? ""}
                      alt={t.galleryThumbAlt(listing.title, i + 2)}
                      loading="lazy"
                      decoding="async"
                    />
                    {isLast && extraCount > 0 && (
                      <div className="detail-gallery__more">{t.galleryMore(extraCount)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="listing-detail__layout">
        <div>
          {/* Facts strip: type · beds · baths · area · freshness */}
          <ul className="listing-facts">
            <li className="listing-facts__item">
              <span aria-hidden>{TYPE_ICON[listing.propertyType]}</span> {typeLabel.replace(/s$/, "")}
            </li>
            {listing.bedrooms != null && (
              <li className="listing-facts__item">🛏 {t.factBedrooms(listing.bedrooms)}</li>
            )}
            {listing.bathrooms != null && (
              <li className="listing-facts__item">
                🚿 {t.factBathrooms(listing.bathrooms)}
              </li>
            )}
            {listing.parking != null && (
              <li className="listing-facts__item">🚗 {t.factParking(listing.parking)}</li>
            )}
            {area && (
              <li className="listing-facts__item">📐 {t.factArea(Math.round(Number(area)))}</li>
            )}
            {publishedAgo && (
              <li className="listing-facts__item listing-facts__item--muted">
                🕓 {publishedAgo}
              </li>
            )}
          </ul>

          <div className="listing-price">
            {listing.operation !== "venta" ? (
              <>
                <span className="listing-price__label">{t.priceRentLabel}</span>{" "}
                <span className="listing-price__amount">{formatPrice(listing)}</span>
                <span className="listing-price__period">{t.priceRentPeriod}</span>
              </>
            ) : (
              <span className="listing-price__amount">{formatPrice(listing)}</span>
            )}
            <PriceAlert
              listingPublicId={listing.publicId}
              listingTitle={listing.title}
              leadType={leadType}
            />
          </div>

          {/* Financing module — the cuota differentiator (ARCHITECTURE.md §3) */}
          {cuota && financingProgram && (
            <div className="financing-box">
              <div className="financing-box__head">
                {t.financingHead(financingProgram.name)}
                {financingProgram.code === "che_roga_pora" &&
                  t.financingStateProgram}
              </div>
              <div className="financing-box__grid">
                <div>
                  <div className="financing-box__label">{t.financingCuotaLabel}</div>
                  <div className="financing-box__value">{cuota}</div>
                </div>
                <div>
                  <div className="financing-box__label">{t.financingTermsLabel}</div>
                  <div className="financing-box__value financing-box__value--muted">
                    {t.financingTerms(
                      Number(financingProgram.annualRate).toLocaleString(numberLocale),
                      Math.round(financingProgram.maxTermMonths / 12),
                    )}
                  </div>
                </div>
              </div>
              <div className="financing-box__foot">{t.financingFoot}</div>
            </div>
          )}
          {cuota && !financingProgram && (
            <div className="cuota-chip">💳 {cuota}</div>
          )}

          {details.length > 0 && (
            <section className="listing-section">
              <h2 className="listing-section__title">{t.detailsTitle}</h2>
              <dl className="listing-details-grid">
                {details.map((d) => (
                  <div className="listing-details-grid__row" key={d.label}>
                    <dt className="listing-details-grid__label">
                      <span aria-hidden>{d.icon}</span> {d.label}
                    </dt>
                    <dd className="listing-details-grid__value">{d.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {amenities.length > 0 && (
            <section className="listing-section">
              <h2 className="listing-section__title">{t.amenitiesTitle}</h2>
              <ul className="listing-amenities">
                {amenities.map((a) => (
                  <li className="listing-amenities__item" key={a}>
                    <span className="listing-amenities__check" aria-hidden>✓</span>
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {listing.descriptionEs && (
            <section className="listing-section">
              <h2 className="listing-section__title">{t.descriptionTitle}</h2>
              <p className="listing-description">{listing.descriptionEs}</p>
            </section>
          )}

          {approxLocation && (
            <section className="listing-section">
              <h2 className="listing-section__title">{t.locationTitle}</h2>
              <p className="listing-location__caption">{approxLocation.label}</p>
              <ListingMapLazy lat={approxLocation.lat} lng={approxLocation.lng} />
            </section>
          )}
        </div>

        {/* Sticky contact card */}
        <aside className="listing-detail__aside">
          <div className="seller-card__head">
            {safeImageUrl(agency?.logoUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="seller-card__logo" src={safeImageUrl(agency?.logoUrl) ?? undefined} alt={sellerName} referrerPolicy="no-referrer" />
            ) : (
              <div className="seller-card__avatar" aria-hidden>
                {sellerInitials || "P"}
              </div>
            )}
            <div>
              <div className="seller-card__name">
                {agency ? (
                  <Link href={agencyUrl(agency.slug)}>{sellerName}</Link>
                ) : (
                  sellerName
                )}
                {(agency?.isVerified ||
                  agent?.isVerified ||
                  (ownerUser != null && listing.isVerified)) && (
                  <span className="seller-card__verified" title={t.sellerVerified}>✓</span>
                )}
              </div>
              <div className="seller-card__kind">
                {agency
                  ? t.sellerKindAgency
                  : agent
                    ? t.sellerKindAgent
                    : ownerUser
                      ? t.sellerKindOwner
                      : brand}
              </div>
            </div>
          </div>
          <ContactForm
            listingPublicId={listing.publicId}
            contactWhatsapp={contactWhatsapp}
            leadType={leadType}
            prefillMessage={waMessage}
            variant="card"
          />
        </aside>
      </div>

      {/* Full-width contact panel, mirrors the sticky card for visitors
          who scrolled past it without noticing. */}
      <section className="contact-panel" id="contacto">
        <h2 className="contact-panel__title">{t.contactTitle}</h2>
        <p className="contact-panel__subtitle">{t.contactSubtitle}</p>
        <ContactForm
          listingPublicId={listing.publicId}
          contactWhatsapp={contactWhatsapp}
          leadType={leadType}
          prefillMessage={waMessage}
          variant="panel"
        />
      </section>

      {/* Market context for this city — the internal link into /precios.
          Rendered only when the medians job has a defensible number, so we
          never send a visitor (or a crawler) to an empty page. */}
      {city && cityHasPrices && (
        <aside className="precios-cta">
          <span>
            {contextCell ? (
              <>
                {svPrecios.contextMedian({
                  typeLabel: PROPERTY_TYPE_LABELS[contextCell.propertyType],
                  operationLabel:
                    svPrecios.contextOperationLabel[contextCell.operation] ??
                    contextCell.operation,
                  city: city.name,
                  median:
                    contextCell.medianPriceUsd != null
                      ? formatUsd(contextCell.medianPriceUsd)
                      : "—",
                  perM2:
                    contextCell.medianPriceM2Usd != null
                      ? formatUsd(contextCell.medianPriceM2Usd)
                      : null,
                  sample: contextCell.sampleSize,
                })}
                {listingPerM2 != null && (
                  <>
                    {" — "}
                    {svPrecios.contextThisListing(formatUsd(listingPerM2))}
                  </>
                )}
              </>
            ) : (
              svPrecios.relatedPrices(city.name)
            )}
          </span>
          <Link className="panel-btn" href={`/precios/${city.slug}`}>
            {svPrecios.relatedPricesCta}
          </Link>
        </aside>
      )}

      {similar.length > 0 && (
        <section className="similar-listings">
          <h2 className="similar-listings__title">{t.similarTitle}</h2>
          <div className="similar-listings__grid">
            {similar.map((card) => (
              <ListingCard key={card.id} card={card} />
            ))}
          </div>
        </section>
      )}

      {fromAgency.length > 0 && (
        <section className="similar-listings">
          <h2 className="similar-listings__title">
            {t.fromAgencyTitleLead}{" "}
            {agency ? (
              <Link href={agencyUrl(agency.slug)}>{agency.name}</Link>
            ) : (
              t.fromAgencyFallback
            )}
          </h2>
          <div className="similar-listings__grid">
            {fromAgency.map((card) => (
              <ListingCard key={card.id} card={card} />
            ))}
          </div>
        </section>
      )}

      {/* Internal-link chips back into the category tree */}
      {city && (
        <div className="listing-morelinks">
          {barrio && (
            <Link
              className="listing-morelinks__chip"
              href={categoryUrl({
                operation: listing.operation,
                citySlug: city.slug,
                barrioSlug: barrio.slug,
                type: listing.propertyType,
              })}
            >
              {t.moreInBarrio(barrio.name)}
            </Link>
          )}
          <Link
            className="listing-morelinks__chip"
            href={categoryUrl({ operation: listing.operation, citySlug: city.slug })}
          >
            {t.moreInCity(city.name)}
          </Link>
        </div>
      )}

      {/* Mobile-only contact bar. Below 860px the sidebar card is in the flow
          (globals.css), so this keeps the price and a one-tap contact within
          reach without covering the page the way the old sticky card did. */}
      <div className="listing-cta-bar">
        <div className="listing-cta-bar__price">
          <span className="listing-cta-bar__amount">
            {formatPrice(listing)}
            {listing.operation !== "venta" && t.priceRentPeriod}
          </span>
          {cuota && <span className="listing-cta-bar__cuota">💳 {cuota}</span>}
        </div>
        <div className="listing-cta-bar__actions">
          {waHref && (
            <a
              className="listing-cta-bar__btn listing-cta-bar__btn--whatsapp"
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.ctaBarWhatsapp}
            >
              💬
            </a>
          )}
          <a className="listing-cta-bar__btn listing-cta-bar__btn--primary" href="#contacto">
            {t.ctaBarConsult}
          </a>
        </div>
      </div>
    </main>
  );
}

/** "Publicado hace N días/semanas/meses" — coarse freshness, es-PY voseo-neutral. */
function formatPublishedAgo(
  publishedAt: Date | string,
  t: Dictionary["listing"],
): string | null {
  const ts = new Date(publishedAt).getTime();
  if (!Number.isFinite(ts)) return null;
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return t.publishedToday;
  if (days === 1) return t.publishedYesterday;
  if (days < 14) return t.publishedDaysAgo(days);
  if (days < 60) return t.publishedWeeksAgo(Math.floor(days / 7));
  return t.publishedMonthsAgo(Math.floor(days / 30));
}
