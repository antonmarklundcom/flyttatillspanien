/**
 * Structured data (ARCHITECTURE.md §4). RealEstateListing + Offer on detail
 * pages, BreadcrumbList everywhere, ItemList on categories. Emitted as a
 * <script type="application/ld+json"> the templates inline. Grounded only in
 * DB fields — never invented values.
 *
 * `origin` is passed in rather than read from the environment: with one
 * deployment behind several domains it is a per-request value (src/lib/origin.ts),
 * and JSON-LD that disagrees with the page's own canonical is a crawl error.
 */
import type { ListingDetail } from "./queries";
import { imageUrl } from "./format";
import { listingUrl } from "./urls";

export function breadcrumbJsonLd(
  origin: string,
  items: { name: string; url: string }[],
): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      // An already-absolute url passes through: the listing detail page's
      // ancestors belong to the serving host while its leaf may be canonical
      // on another domain (audit F32) — one origin can't cover both.
      item: /^https?:\/\//.test(it.url) ? it.url : `${origin}${it.url}`,
    })),
  };
}

export function listingJsonLd(origin: string, detail: ListingDetail): object {
  const { listing, images, chain } = detail;
  const isLand = listing.propertyType === "terreno";

  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: listing.title,
    description: listing.descriptionEs ?? undefined,
    url: `${origin}${listingUrl(listing)}`,
    image: images
      .map((im) => imageUrl(im.r2Key))
      .filter((u): u is string => !!u),
    datePosted: listing.publishedAt?.toISOString(),
    offers: {
      "@type": "Offer",
      price: Number(listing.priceUsd),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: chain.find((c) => c.level === "municipio")?.name,
      addressRegion: chain.find((c) => c.level === "comunidad")?.name,
      addressCountry: "PY",
    },
    ...(listing.lat && listing.lng
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: Number(listing.lat),
            longitude: Number(listing.lng),
          },
        }
      : {}),
    ...(isLand
      ? {
          about: {
            "@type": "LandParcel",
            ...(listing.landM2
              ? { area: { "@type": "QuantitativeValue", value: Number(listing.landM2), unitCode: "MTK" } }
              : {}),
          },
        }
      : {
          about: {
            "@type": "Residence",
            ...(listing.bedrooms != null
              ? { numberOfRooms: listing.bedrooms }
              : {}),
            ...(listing.areaM2
              ? { floorSize: { "@type": "QuantitativeValue", value: Number(listing.areaM2), unitCode: "MTK" } }
              : {}),
          },
        }),
  };
}

export function itemListJsonLd(
  origin: string,
  urls: { title: string; url: string }[],
): object {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: urls.length,
    itemListElement: urls.map((u, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: u.title,
      url: `${origin}${u.url}`,
    })),
  };
}

/**
 * FAQPage — emitted by the homepage and /preguntas-frecuentes from the same
 * FAQ_SECTIONS source, so the markup can never claim an answer the page
 * doesn't show (which is what gets rich results revoked).
 */
export function faqJsonLd(items: { q: string; a: string }[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}

/**
 * Organization — the entity behind the portal. Only fields we can stand
 * behind: name, site URL, contact channel. No invented address, founding
 * date, employee count or aggregate rating.
 */
export function organizationJsonLd(
  origin: string,
  opts: { name: string; whatsapp?: string | null; email?: string },
): object {
  const contactPoint: Record<string, unknown>[] = [];
  if (opts.whatsapp) {
    contactPoint.push({
      "@type": "ContactPoint",
      contactType: "customer support",
      telephone: opts.whatsapp,
      areaServed: "PY",
      availableLanguage: ["es"],
    });
  }
  if (opts.email) {
    contactPoint.push({
      "@type": "ContactPoint",
      contactType: "sales",
      email: opts.email,
      areaServed: "PY",
      availableLanguage: ["es"],
    });
  }
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: opts.name,
    url: origin,
    ...(contactPoint.length > 0 ? { contactPoint } : {}),
  };
}
