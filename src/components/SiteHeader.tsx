import Link from "next/link";
import { BRAND_KICKER } from "@/lib/brand";
import { brandName } from "@/lib/brand-server";
import { HEADER_NAV } from "@/config/site-nav";
import { MobileMenu } from "@/components/MobileMenu";

/**
 * Global top bar (portal shell). Brand + grouped nav + a "publish" CTA.
 *
 * The nav is grouped rather than flat: a portal has more entry points than fit
 * in a row (categories, projects, price data, valuation, the professional
 * lane), and burying /precios or /para-inmobiliarias in the footer is how they
 * stay unvisited. Dropdowns are pure CSS (:hover / :focus-within) so this stays
 * a server component; the phone drawer is the one client piece.
 *
 * The CTA opens the publish wizard (/publicar); requireUser there bounces
 * guests to /login with next=/publicar, so the button lands everyone in the
 * right place.
 */
export async function SiteHeader() {
  // The wordmark IS the domain, so it has to follow the host rather than a
  // build-time constant — see src/lib/brand.ts.
  const brand = await brandName();
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="site-header__brand" href="/">
          {/* Architectural line icon, 0.95–1.15 stroke, no fill, square corners
              — the icon rule from the design system. */}
          <svg
            className="site-header__brand-mark"
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.15"
            aria-hidden
          >
            <path d="M3.2 10.4L12 3.6l8.8 6.8" />
            <path d="M5.6 9.8v10.6h12.8V9.8" />
            <path d="M10 20.4v-5.6h4v5.6" />
          </svg>
          <span>
            <span className="site-header__brand-name">{brand}</span>
            <span className="site-header__brand-sub">{BRAND_KICKER}</span>
          </span>
        </Link>

        <nav className="site-header__nav" aria-label="Principal">
          {HEADER_NAV.map((group) => (
            <div key={group.label} className="site-header__group">
              <Link className="site-header__link" href={group.href}>
                {group.label}
                {group.links.length > 0 && (
                  <span className="site-header__caret" aria-hidden>
                    ▾
                  </span>
                )}
              </Link>
              {group.links.length > 0 && (
              <div className="site-header__panel">
                {group.links.map((l) => (
                  <Link
                    key={l.href + l.label}
                    className="site-header__panel-link"
                    href={l.href}
                  >
                    <span className="site-header__panel-label">{l.label}</span>
                    {l.desc && (
                      <span className="site-header__panel-desc">{l.desc}</span>
                    )}
                  </Link>
                ))}
              </div>
              )}
            </div>
          ))}
        </nav>

        <div className="site-header__actions">
          <Link className="site-header__login" href="/login">
            Logga in
          </Link>
          {/* Two labels, one shown at a time — on a 320px screen the full label
              plus the brand no longer fit on one line (globals.css @560px). */}
          <Link className="site-header__cta" href="/publicar">
            <span className="site-header__cta-full">Publicera bostad</span>
            <span className="site-header__cta-short">Publicera</span>
          </Link>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
