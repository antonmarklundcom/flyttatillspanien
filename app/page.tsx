import Link from "next/link";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { dict } from "@/i18n/server";
import type { Dictionary } from "@/i18n";
import { CACHE_TAGS, CACHE_TTL } from "@/lib/cache";
import { currentVertical } from "@/lib/vertical-context";
import { VERTICALS, type VerticalConfig, type VerticalKey } from "@/config/verticals";
import {
  getRecentListings,
  getRecentListingsBy,
  getFeaturedProjects,
  getFeaturedDevelopers,
  countPublished,
  listCities,
  type ListingCard as Card,
} from "@/lib/queries";
import { ListingCard } from "@/components/ListingCard";
import { ProjectCard } from "@/components/ProjectCard";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import { SearchBar } from "@/components/SearchBar";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { JsonLd } from "@/components/JsonLd";
import { POPULAR_SEARCHES } from "@/config/popular-searches";
import { faqHome } from "@/config/faq";
import { faqJsonLd } from "@/lib/jsonld";
import { citiesWithPrices } from "@/lib/precios-queries";
import { categoryUrl } from "@/lib/urls";
import { brandTaglineFor } from "@/lib/brand";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { languageAlternates } from "@/lib/alternates";
import { CONTACT_WHATSAPP } from "@/config/contact";
import { waLink } from "@/lib/wa";
import { safeImageUrl } from "@/lib/external-image";

/**
 * Zone cards on the home page. Each one needs a photograph, so this is a fixed
 * curated list rather than a DB query — a city with no image would render an
 * empty tile in a grid built entirely out of photographs.
 */
const ZONE_CARDS = [
  { name: "Asunción", slug: "asuncion", img: "/img/zona-asuncion.webp" },
  {
    name: "San Bernardino",
    slug: "san-bernardino",
    img: "/img/zona-san-bernardino.webp",
  },
  { name: "Luque", slug: "luque", img: "/img/zona-luque.webp" },
  { name: "Encarnación", slug: "encarnacion", img: "/img/zona-encarnacion.webp" },
] as const;

/** Curated, high-population cities — a fixed shortcut row (avoids querying
 * every seeded city, some of which have little to no live inventory yet). */
const CITY_SHORTCUTS = [
  "Asunción",
  "Luque",
  "San Lorenzo",
  "Lambaré",
  "Fernando de la Mora",
  "Ciudad del Este",
  "Encarnación",
];

/**
 * NOTE: no `export const revalidate` here — the page renders per request
 * (brand/origin come from the Host header, a dynamic API), which made a
 * route-level revalidate silently dead (audit F17/F37). The DB work is
 * cached below in getHomePayload instead: the render still runs per hit,
 * but its 10+ queries run once per 10 minutes.
 */
const getHomePayload = unstable_cache(
  async (verticalKey: VerticalKey) => {
    // Resolved from the key rather than passed as an object: the key is what
    // enters the cache key, and a config object would serialize its comments
    // and future fields into it too.
    const vertical: VerticalConfig | undefined = Object.values(VERTICALS).find(
      (v) => v.key === verticalKey,
    );
    const [
      recent,
      cities,
      total,
      ventaCasas,
      ventaDeptos,
      alquileres,
      terrenos,
      featuredProjects,
      featuredDevelopers,
      priceCities,
    ] = await Promise.all([
      getRecentListings(8, vertical),
      listCities(),
      countPublished(vertical),
      getRecentListingsBy({ operation: "venta", type: "casa", vertical }, 8),
      getRecentListingsBy(
        { operation: "venta", type: "departamento", vertical },
        8,
      ),
      getRecentListingsBy({ operation: "alquiler", vertical }, 8),
      getRecentListingsBy({ operation: "venta", type: "terreno", vertical }, 8),
      getFeaturedProjects(6),
      getFeaturedDevelopers(8),
      citiesWithPrices(),
    ]);
    return {
      recent,
      cities,
      total,
      ventaCasas,
      ventaDeptos,
      alquileres,
      terrenos,
      featuredProjects,
      featuredDevelopers,
      priceCities,
    };
  },
  ["home-payload"],
  // The vertical key is an argument, and `unstable_cache` folds arguments into
  // the cache key — so a door with hard filters gets its own entry instead of
  // being served another door's listing set. (Both live hosts declare no
  // filters today, so their two entries hold identical rows.)
  { revalidate: CACHE_TTL.listings, tags: [CACHE_TAGS.listings] },
);

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: { absolute: `${brand} — ${brandTaglineFor("es")}` },
    description: (await dict()).home.metaDescription,
    // Self-canonical so ?utm_*/?fbclid variants don't index as duplicates.
    // `languages` is empty while every door is Spanish — see alternates.ts.
    alternates: {
      canonical: await siteOrigin(),
      languages: languageAlternates({ path: "/", scope: "site" }),
    },
    // WhatsApp is how a link gets shared here, and it renders this card. 1200x630
    // is the size every network crops to.
    openGraph: {
      images: [{ url: "/img/og-share.webp", width: 1200, height: 630 }],
    },
  };
}

/**
 * Publish CTA — outbound WhatsApp when a portal number is configured, null
 * otherwise. It used to fall back to a mailto:, which pointed at an address
 * nobody owns; `/publicar` is the real form, so call sites route there
 * instead of opening a compose window into a black hole.
 */
function publishWaHref(brand: string, t: Dictionary["home"]): string | null {
  return waLink(CONTACT_WHATSAPP, t.publishWaPrefill(brand));
}

/**
 * Both discover cards used to point at the same outbound WhatsApp link,
 * because neither destination existed yet. The valuation card now has a real
 * one. The card list, like the three-step explainer, now lives in the
 * dictionary (`svHome.discoverCards` / `svHome.howSteps`) — hrefs and icons
 * travel with the copy because a translated card without its link is not a
 * card.
 *
 * The old `external?: boolean` field on the card list is gone with it: no card
 * ever set it, so the `target="_blank"` branch it guarded was dead.
 */

async function Row({
  title,
  href,
  cards,
}: {
  title: string;
  href: string;
  cards: Card[];
}) {
  if (cards.length === 0) return null;
  const t = (await dict()).home;
  return (
    <section className="home-section">
      <div className="home-section__head">
        <h2 className="home-section__title">{title}</h2>
        <Link className="home-section__more" href={href}>
          {t.rowMore}
        </Link>
      </div>
      <div className="home-row">
        {cards.map((card) => (
          <ListingCard key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}

export default async function Home() {
  const brand = await brandName();
  const d = await dict();
  const t = d.home;
  const tCommon = d.common;
  const faq = faqHome(brand);
  const vertical = await currentVertical();
  // Number formatting follows the request's locale, not the copy: the
  // thousands separator is not the same character everywhere.
  const numberLocale = vertical.locale === "en" ? "en-US" : "es-PY";
  const {
    recent,
    cities,
    total,
    ventaCasas,
    ventaDeptos,
    alquileres,
    terrenos,
    featuredProjects,
    featuredDevelopers,
    priceCities,
  } = await getHomePayload(vertical.key);

  const cityShortcuts = CITY_SHORTCUTS.map((name) =>
    cities.find((c) => c.name === name),
  ).filter((c): c is (typeof cities)[number] => Boolean(c));

  return (
    <main>
      <JsonLd data={[faqJsonLd(faq)]} />

      {/* Hero — full-bleed photograph, text on the gradient (design system
          §"Superposiciones sobre foto"). The search bar sits on the dark panel
          inside the hero rather than below it. */}
      <section className="home-hero">
        <img
          className="home-hero__photo"
          src="/img/hero-home.webp"
          alt=""
          fetchPriority="high"
        />
        <div className="home-hero__scrim" />
        <div className="home-hero__inner ds-container">
          <p className="ds-label">{t.heroKicker}</p>
          <h1 className="home-hero__title">
            {t.heroTitleLead}<span>{t.heroTitleHighlight}</span>
          </h1>
          <p className="home-hero__subtitle">{t.heroSubtitle}</p>

          <div className="home-hero__actions">
            <Link className="ds-btn ds-btn--primary" href="/venta/asuncion">
              {t.heroSeeListings}
            </Link>
            <Link className="ds-btn ds-btn--on-photo" href="/publicar">
              {t.heroSellCta}
            </Link>
          </div>

          <div className="home-hero__search">
            <SearchBar cities={cities} locale={vertical.locale} />
          </div>

          <div className="home-hero__chips">
            {POPULAR_SEARCHES.map((q) => (
              <Link key={q.href} href={q.href} className="home-hero__chip">
                {q.label}
              </Link>
            ))}
          </div>

          <div className="home-hero__stats">
            <span>
              {total > 0
                ? t.heroStatCount(total.toLocaleString(numberLocale))
                : t.heroStatCountEmpty}
            </span>
            <span>{t.heroStatUpdated}</span>
            {publishWaHref(brand, t) ? (
              <a
                href={publishWaHref(brand, t)!}
                target="_blank"
                rel="noopener noreferrer"
              >
                {tCommon.publishCta}
              </a>
            ) : (
              <Link href="/publicar">{tCommon.publishCta}</Link>
            )}
          </div>
        </div>
      </section>

      {/* Zonas — four photographed cards, the design's "tarjeta de zona".
          Cities are matched by name against the DB so a card never links to a
          category page that doesn't exist. */}
      <section className="ds-section ds-container" id="zonas">
        <div className="home-section__head">
          <div>
            <p className="ds-label">{t.zonesKicker}</p>
            <h2>{t.zonesTitle}</h2>
          </div>
          <Link className="ds-link-underline" href="/venta/asuncion">
            {t.zonesAll}
          </Link>
        </div>
        <div className="ds-grid" style={{ ["--ds-track" as string]: "220px" }}>
          {ZONE_CARDS.map((z) => (
            <Link key={z.slug} className="ds-photo-card ds-photo-card--zone" href={`/venta/${z.slug}`}>
              <img
                className="ds-photo-card__img"
                src={z.img}
                alt={z.name}
                loading="lazy"
                decoding="async"
              />
              <div className="ds-photo-card__scrim ds-photo-card__scrim--zone" />
              <div className="ds-photo-card__body">
                <div className="zone-card__name">{z.name}</div>
                <div className="zone-card__sub">{t.zoneCardSub[z.slug]}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Cómo funciona — the "what is this site" answer, before any listing */}
      <section className="home-how">
        <div className="home-how__inner">
          <h2 className="home-how__title">{t.howTitle}</h2>
          <p className="home-how__subtitle">{t.howSubtitle}</p>
          <div className="home-how__grid">
            {t.howSteps.map((s, i) => (
              <div key={s.title} className="home-how__step">
                <span className="home-how__num" aria-hidden>
                  {i + 1}
                </span>
                <span className="home-how__icon" aria-hidden>
                  {s.icon}
                </span>
                <h3 className="home-how__step-title">{s.title}</h3>
                <p className="home-how__step-text">{s.text}</p>
              </div>
            ))}
          </div>
          <Link className="home-how__more" href="/como-funciona">
            {t.howMore}
          </Link>
        </div>
      </section>

      {/* Editorial pair: the seller pitch on cream, the investor pitch on
          green. Two backgrounds per page is the system's rule, and these are
          the two. */}
      <section className="ds-section ds-container editorial">
        <div className="editorial__media">
          <img
            src="/img/editorial-vender.webp"
            alt={t.sellImageAlt}
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="editorial__body">
          <p className="ds-label">{t.sellKicker}</p>
          <h2>{t.sellTitle}</h2>
          <p className="editorial__text">{t.sellText}</p>
          <div className="editorial__actions">
            <Link className="ds-btn ds-btn--secondary" href="/tasacion">
              {t.sellValuationCta}
            </Link>
            <Link className="ds-link-underline" href="/publicar">
              {t.sellPublishCta}
            </Link>
          </div>
        </div>
      </section>

      <section className="ds-section ds-section--dark">
        <div className="ds-container editorial editorial--reverse">
          <div className="editorial__media">
            <img
              src="/img/editorial-invertir.webp"
              alt={t.investImageAlt}
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="editorial__body">
            <p className="ds-label">{t.investKicker}</p>
            <h2>{t.investTitle}</h2>
            <p className="editorial__text">{t.investText}</p>
            <div className="editorial__actions">
              <Link className="ds-btn ds-btn--outline-gold" href="/precios">
                {t.investPricesCta}
              </Link>
              <Link className="ds-link-underline ds-link-underline--dark" href="/precios">
                {t.investFinancingCta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Nuevos proyectos — renders only once real projects exist */}
      {featuredProjects.length > 0 && (
        <section className="home-projects" id="proyectos">
          <div className="home-projects__inner">
            <div className="home-section__head">
              <h2 className="home-section__title">{t.projectsTitle}</h2>
            </div>
            <p className="home-projects__subtitle">{t.projectsSubtitle}</p>
            <div className="home-row home-row--projects">
              {featuredProjects.map((p) => (
                <ProjectCard key={p.id} card={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* City shortcuts */}
      {cityShortcuts.length > 0 && (
        <section className="home-cities">
          <div className="home-cities__inner">
            <h2 className="home-cities__title">{t.citiesTitle}</h2>
            <div className="home-cities__row">
              {cityShortcuts.map((c) => (
                <Link
                  key={c.slug}
                  className="home-cities__chip"
                  href={categoryUrl({ operation: "venta", citySlug: c.slug })}
                >
                  📍 {c.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="home-body">
        <RecentlyViewed />
        <Row
          title={t.rowRecommended}
          href="/venta/asuncion"
          cards={recent}
        />
        <Row
          title={t.rowHousesForSale}
          href="/venta/asuncion/casas"
          cards={ventaCasas}
        />
        <Row
          title={t.rowFlatsForSale}
          href="/venta/asuncion/departamentos"
          cards={ventaDeptos}
        />
        <Row
          title={t.rowRentals}
          href="/alquiler/asuncion"
          cards={alquileres}
        />
        <Row
          title={t.rowLand}
          href="/venta/asuncion/terrenos"
          cards={terrenos}
        />

        {recent.length === 0 && (
          <p style={{ color: "var(--color-ink-secondary)", padding: "2rem 0" }}>
            {tCommon.emptyState}
          </p>
        )}
      </div>

      {/* Desarrolladoras destacadas — renders only once developers exist */}
      {featuredDevelopers.length > 0 && (
        <section className="home-devs">
          <div className="home-devs__inner">
            <div className="home-section__head">
              <h2 className="home-section__title">{t.developersTitle}</h2>
            </div>
            <p className="home-projects__subtitle">{t.developersSubtitle}</p>
            <div className="home-devs__grid">
              {featuredDevelopers.map((d) => (
                <div key={d.id} className="home-devs__card">
                  {safeImageUrl(d.logoUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="home-devs__logo" src={safeImageUrl(d.logoUrl) ?? undefined} alt={d.name} referrerPolicy="no-referrer" />
                  ) : (
                    <div className="home-devs__logo home-devs__logo--fallback" aria-hidden>
                      {d.name.charAt(0)}
                    </div>
                  )}
                  <div className="home-devs__name">{d.name}</div>
                  <div className="home-devs__count">
                    {t.developerProjectCount(d.projectCount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Market data — the reason to come back between searches. Renders only
          when the medians job has produced a defensible sample. */}
      {priceCities.length > 0 && (
        <section className="home-prices">
          <div className="home-prices__inner">
            <div className="home-section__head">
              <h2 className="home-section__title">{t.pricesTitle}</h2>
              <Link className="home-section__more" href="/precios">
                {t.pricesMore}
              </Link>
            </div>
            <p className="home-prices__subtitle">{t.pricesSubtitle}</p>
            <div className="home-prices__row">
              {priceCities.slice(0, 8).map((c) => (
                <Link
                  key={c.slug}
                  className="home-prices__card"
                  href={`/precios/${c.slug}`}
                >
                  <span className="home-prices__city">{c.name}</span>
                  <span className="home-prices__sample">
                    {t.pricesSample(c.reliableSample.toLocaleString(numberLocale))}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Value proposition strip */}
      <section className="home-values">
        <div className="home-values__inner">
          {t.values.map((v) => (
            <div key={v.title} className="home-values__item">
              <span className="home-values__icon" aria-hidden>
                {v.icon}
              </span>
              <div>
                <div className="home-values__title">{v.title}</div>
                <div className="home-values__text">{v.text}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Descubre más — secondary product surfaces */}
      <section className="home-discover">
        <div className="home-discover__inner">
          <h2 className="home-discover__title">{t.discoverTitle(brand)}</h2>
          <div className="home-discover__grid">
            {t.discoverCards.map((c) => (
              <a key={c.title} className="home-discover__card" href={c.href}>
                <span className="home-discover__icon" aria-hidden>
                  {c.icon}
                </span>
                <h3 className="home-discover__card-title">{c.title}</h3>
                <p className="home-discover__card-text">{c.text}</p>
                <span className="home-discover__card-cta">{c.cta} →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Professional lane — the revenue side of the marketplace. Guests see
          what publishing a whole portfolio gets them, not just one property. */}
      <section className="home-pro">
        <div className="home-pro__inner">
          <div className="home-pro__copy">
            <div className="home-pro__kicker">{t.proKicker}</div>
            <h2 className="home-pro__title">{t.proTitle}</h2>
            <p className="home-pro__text">{t.proText}</p>
            <ul className="home-pro__list">
              {t.proBullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <div className="home-pro__actions">
              <Link className="home-pro__button" href="/para-inmobiliarias">
                {t.proMore}
              </Link>
              <Link className="home-pro__link" href="/planes">
                {t.proPlans}
              </Link>
            </div>
          </div>
          <div className="home-pro__aside">
            <Link className="home-pro__card" href="/inmobiliarias">
              <span className="home-pro__card-icon" aria-hidden>
                🏢
              </span>
              <span className="home-pro__card-title">{t.proAgencyCardTitle}</span>
              <span className="home-pro__card-text">{t.proAgencyCardText}</span>
            </Link>
            <Link className="home-pro__card" href="/proyectos">
              <span className="home-pro__card-icon" aria-hidden>
                🏗
              </span>
              <span className="home-pro__card-title">{t.proProjectsCardTitle}</span>
              <span className="home-pro__card-text">{t.proProjectsCardText}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Publish CTA banner */}
      <section className="home-cta">
        <div className="home-cta__inner">
          <h2 className="home-cta__title">{t.ctaTitle}</h2>
          <p className="home-cta__text">{t.ctaText}</p>
          <div className="home-cta__actions">
            <Link className="home-cta__button" href="/publicar">
              {t.ctaButton}
            </Link>
            {/* Only rendered with a real number behind it: the label promises
                WhatsApp, so it must not quietly become something else. */}
            {publishWaHref(brand, t) && (
              <a
                className="home-cta__alt"
                href={publishWaHref(brand, t)!}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.ctaWhatsapp}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="home-newsletter">
        <div className="home-newsletter__inner">
          <div>
            <h2 className="home-newsletter__title">{t.newsletterTitle}</h2>
            <p className="home-newsletter__text">{t.newsletterText}</p>
          </div>
          <NewsletterSignup />
        </div>
      </section>

      {/* FAQ */}
      <section className="home-faq">
        <div className="home-faq__inner">
          <h2 className="home-faq__title">{t.faqTitle}</h2>
          <p className="home-faq__subtitle">{t.faqSubtitle(brand)}</p>
          {faq.map((f) => (
            <details key={f.q} className="home-faq__item">
              <summary className="home-faq__q">{f.q}</summary>
              <p className="home-faq__a">{f.a}</p>
            </details>
          ))}
          <Link className="home-faq__more" href="/preguntas-frecuentes">
            {t.faqMore}
          </Link>
        </div>
      </section>
    </main>
  );
}
