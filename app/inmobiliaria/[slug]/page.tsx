import { cache } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { brandName } from "@/lib/brand-server";
import {
  getAgencyBySlug,
  getAgencyListings,
  countAgencyListings,
} from "@/lib/queries";
import { agencyUrl } from "@/lib/urls";
import { listingCanonicalOrigin, siteOrigin } from "@/lib/origin";
import { getIndexability, robotsFor } from "@/lib/indexability";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/jsonld";
import { listingUrl } from "@/lib/urls";
import { JsonLd } from "@/components/JsonLd";
import { ListingCard } from "@/components/ListingCard";
import { waLink } from "@/lib/wa";
import { safeImageUrl } from "@/lib/external-image";

// Same shape as the listing detail page: DB-backed, so no static caching —
// this is the founder's inventory changing, not content that goes stale slowly.

type Params = { params: Promise<{ slug: string }> };

/** Shared resolution for metadata + page: the agency row + its listing count. */
const resolve = cache(async function resolve(slug: string) {
  const agency = await getAgencyBySlug(slug);
  if (!agency) return null;
  const listingCount = await countAgencyListings(agency.id);
  return { agency, listingCount };
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const brand = await brandName();
  const { slug } = await params;
  const r = await resolve(slug);
  if (!r) return { title: `Inmobiliaria no encontrada` };
  const { agency, listingCount } = r;
  const ix = getIndexability({ listingCount });
  const canonical = `${await siteOrigin()}${agencyUrl(agency.slug)}`;
  return {
    title: `${agency.name} — Propiedades en venta y alquiler`,
    description: `${listingCount} ${listingCount === 1 ? "propiedad" : "propiedades"} publicadas por ${agency.name} en ${brand}.`,
    alternates: { canonical },
    robots: { index: ix.state === "index", follow: true },
  };
}

export default async function AgencyProfilePage({ params }: Params) {
  const brand = await brandName();
  const { slug } = await params;
  const r = await resolve(slug);
  if (!r) notFound();
  const { agency, listingCount } = r;

  // A brand-new agency with zero listings has nothing to show — same
  // gone-or-noindex rule every other thin page in the site follows
  // (src/lib/indexability.ts), so this page and the sitemap can never disagree.
  const ix = getIndexability({ listingCount });
  if (ix.state === "gone") notFound();

  const listings = await getAgencyListings({ agencyId: agency.id, limit: 24 });
  const origin = await siteOrigin();
  // The ItemList's entries are listing detail URLs, which may be canonical on
  // a different host than the one serving this profile (audit F9).
  const listingOrigin = await listingCanonicalOrigin();
  const initials = agency.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const crumbs = [
    { name: "Inicio", url: "/" },
    { name: agency.name, url: agencyUrl(agency.slug) },
  ];

  return (
    <main className="listing-main">
      {ix.state === "index" && (
        <JsonLd
          data={[
            breadcrumbJsonLd(origin, crumbs),
            itemListJsonLd(
              listingOrigin,
              listings.map((l) => ({ title: l.title, url: listingUrl(l) })),
            ),
          ]}
        />
      )}

      <nav className="breadcrumb-nav" aria-label="Ruta de navegación">
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Link className="breadcrumb-nav__link" href="/">
            Inicio
          </Link>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span aria-hidden>›</span>
          <span className="breadcrumb-nav__current" aria-current="page">
            {agency.name}
          </span>
        </span>
      </nav>

      <header className="agency-profile__header">
        {safeImageUrl(agency.logoUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="agency-profile__logo" src={safeImageUrl(agency.logoUrl) ?? undefined} alt={agency.name} referrerPolicy="no-referrer" />
        ) : (
          <div className="agency-profile__avatar" aria-hidden>
            {initials || "I"}
          </div>
        )}
        <div>
          <h1 className="agency-profile__name">
            {agency.name}
            {agency.isVerified && (
              <span className="agency-profile__verified" title="Verificado">
                ✓
              </span>
            )}
          </h1>
          <p className="agency-profile__meta">
            Inmobiliaria ·{" "}
            {listingCount > 0
              ? `${listingCount} ${listingCount === 1 ? "propiedad publicada" : "propiedades publicadas"}`
              : "Sin propiedades publicadas por el momento"}
          </p>
          {(agency.phone || agency.email) && (
            <div className="agency-profile__contact">
              {waLink(agency.phone) && (
                <a
                  className="contact-form__altlink"
                  href={waLink(agency.phone)!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  💬 WhatsApp
                </a>
              )}
              {agency.email && (
                <a className="contact-form__altlink" href={`mailto:${agency.email}`}>
                  ✉️ {agency.email}
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      {listings.length > 0 ? (
        <section className="similar-listings" style={{ borderTop: "none", paddingTop: 0 }}>
          <h2 className="similar-listings__title">Propiedades publicadas</h2>
          <div className="similar-listings__grid">
            {listings.map((card) => (
              <ListingCard key={card.id} card={card} />
            ))}
          </div>
        </section>
      ) : (
        <p className="agency-profile__empty">
          Esta inmobiliaria todavía no tiene propiedades publicadas.
        </p>
      )}
    </main>
  );
}
