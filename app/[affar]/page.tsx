import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { brandName } from "@/lib/brand-server";
import { currentLocale, dict } from "@/i18n/server";
import { siteOrigin } from "@/lib/origin";
import { languageAlternates } from "@/lib/alternates";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { ListingCard } from "@/components/ListingCard";
import { SearchBar } from "@/components/SearchBar";
import { getRecentListingsBy, listCities } from "@/lib/queries";
import { currentVertical } from "@/lib/vertical-context";
import { getOperationHubData } from "@/lib/directory-queries";
import { PROPERTY_TYPE_LABELS } from "@/lib/property-types";
import { categoryUrl, parseOperation, operationSlug } from "@/lib/urls";
import { CtaBand, Section } from "@/components/MarketingUI";
import type { Operation, PropertyType } from "@/lib/import/types";

// Live counts per city and per type; no build-time DB on Hostinger.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ affar: string }> };

/**
 * National operation hub: /venta, /alquiler, /alquiler-temporal.
 *
 * The category route (`/[affar]/[...segments]`) needs at least one
 * segment, so these bare URLs used to 404 — even though they are exactly
 * where competitors put their top-level "Venta" and "Alquiler" tabs, and
 * where a search for "casas en venta paraguay" wants to land. This page is
 * the parent of the whole category tree: every city and every property type
 * for the operation, with real counts.
 *
 * Static routes win over dynamic ones in the App Router, so /precios,
 * /planes and friends are unaffected; anything that isn't an operation slug
 * falls through to notFound().
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const brand = await brandName();
  const { affar } = await params;
  const op = parseOperation(affar);
  if (!op) return { title: brand };
  const copy = (await dict()).hub.copy[op];
  return {
    title: `${copy.h1}`,
    description: copy.lead,
    alternates: {
      canonical: `${await siteOrigin()}/${operationSlug(op)}`,
      languages: languageAlternates({
        path: `/${operationSlug(op)}`,
        scope: "site",
      }),
    },
    // og:title doesn't inherit title.template, so the brand is explicit (F47).
    openGraph: { title: `${copy.h1} — ${brand}`, description: copy.lead },
  };
}

export default async function OperationHubPage({ params }: Params) {
  const { affar } = await params;
  const op = parseOperation(affar);
  if (!op) notFound();

  const [d, locale] = await Promise.all([dict(), currentLocale()]);
  const t = d.hub;
  const copy = t.copy[op];
  const numberLocale = locale === "en" ? "en-US" : "es-PY";
  // The door's own hard filters narrow this rail like every other listing
  // query on the domain (VerticalConfig.filters).
  const vertical = await currentVertical();
  const [origin, hub, cities, recent] = await Promise.all([
    siteOrigin(),
    getOperationHubData(op),
    listCities(),
    getRecentListingsBy({ operation: op, vertical }, 8),
  ]);

  const topCity = hub.cities[0]?.slug ?? "asuncion";

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: t.breadcrumbHome, url: "/" },
            { name: copy.label, url: `/${operationSlug(op)}` },
          ]),
        ]}
      />

      <section className="hub-hero">
        <div className="hub-hero__inner">
          <h1 className="hub-hero__title">{copy.h1}</h1>
          <p className="hub-hero__lead">{copy.lead}</p>
          {hub.total > 0 && (
            <div className="hub-hero__count">
              {t.count(hub.total.toLocaleString(numberLocale))}
            </div>
          )}
          <SearchBar cities={cities} locale={locale} />
        </div>
      </section>

      {hub.types.length > 0 && (
        <Section
          title={t.byTypeTitle}
          subtitle={t.byTypeSubtitle(copy.label.toLowerCase())}
        >
          <div className="hub-grid">
            {hub.types.map((row) => (
              <Link
                key={row.type}
                className="hub-tile"
                href={categoryUrl({
                  operation: op,
                  citySlug: topCity,
                  type: row.type as PropertyType,
                })}
              >
                <span className="hub-tile__label">
                  {PROPERTY_TYPE_LABELS[row.type as PropertyType] ?? row.type}
                </span>
                <span className="hub-tile__count">
                  {row.count.toLocaleString(numberLocale)}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {hub.cities.length > 0 && (
        <Section
          tone="muted"
          title={t.byCityTitle}
          subtitle={t.byCitySubtitle}
        >
          <div className="hub-grid hub-grid--cities">
            {hub.cities.map((c) => (
              <Link
                key={c.slug}
                className="hub-tile"
                href={categoryUrl({ operation: op, citySlug: c.slug })}
              >
                <span className="hub-tile__label">
                  {copy.cityLabel} {c.name}
                </span>
                <span className="hub-tile__count">
                  {c.count.toLocaleString(numberLocale)}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {recent.length > 0 && (
        <Section title={t.latestTitle}>
          <div className="mk-project-grid">
            {recent.map((card) => (
              <ListingCard key={card.id} card={card} />
            ))}
          </div>
          <p className="mk-note">
            {t.latestNoteLead}{" "}
            <Link href={categoryUrl({ operation: op, citySlug: topCity })}>
              {copy.cityLabel} {hub.cities[0]?.name ?? "Asunción"}
            </Link>{" "}
            {t.latestNoteTail}
          </p>
        </Section>
      )}

      {hub.total === 0 && (
        <Section>
          <div className="mk-empty">
            <p>{t.emptyBody(copy.label.toLowerCase())}</p>
            <Link className="mk-btn mk-btn--accent" href="/publicar">
              {t.emptyCta}
            </Link>
          </div>
        </Section>
      )}

      <CtaBand
        title={op === "venta" ? t.ctaTitleSale : t.ctaTitleRent}
        text={t.ctaText}
        primary={{ label: t.ctaPrimary, href: "/publicar" }}
        secondary={{ label: t.ctaSecondary, href: "/tasacion" }}
      />
    </main>
  );
}
