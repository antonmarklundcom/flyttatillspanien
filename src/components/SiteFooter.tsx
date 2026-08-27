import Link from "next/link";
import {
  FOOTER_BUY,
  FOOTER_COMPANY,
  FOOTER_LOCATIONS,
  FOOTER_PRO,
  FOOTER_TOOLS,
  FOOTER_TYPES,
} from "@/config/site-nav";
import { brandName } from "@/lib/brand-server";
import { CONTACT_EMAIL, CONTACT_WHATSAPP } from "@/config/contact";
import { waLink } from "@/lib/wa";

/**
 * Global footer (portal shell). Two jobs at once: it is the site's second
 * navigation (every hand-authored page is reachable from here, so nothing is
 * orphaned) and it is the "is this a real business?" answer — contact details,
 * company pages and legal links, which a marketplace asking people to hand
 * over a property listing has to show.
 *
 * Locations are a fixed curated list (not a DB query) — the footer renders on
 * every page via the root layout, and a handful of known-good cities beats
 * coupling every page render to the locations table.
 */
function Column({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <div className="site-footer__col-title">{title}</div>
      <ul className="site-footer__links">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link className="site-footer__link" href={l.href}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function SiteFooter() {
  // Per-host wordmark: the domain is the brand (src/lib/brand.ts).
  const brand = await brandName();
  const year = new Date().getFullYear();
  const whatsapp = CONTACT_WHATSAPP;
  const waHref = waLink(whatsapp);

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__about">
          <div className="site-footer__brand">{brand}</div>
          <p className="site-footer__tagline">
            Spansk bostad för svenska köpare. Villor, lägenheter, tomter och
            nyproduktion till försäljning och uthyrning — med referenspriser
            per område och uppskattad total köpkostnad på varje bostad.
          </p>

          <ul className="site-footer__contact">
            {waHref && (
              <li>
                <a
                  className="site-footer__link"
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  💬 WhatsApp {whatsapp}
                </a>
              </li>
            )}
            {/* No portal mailbox exists yet, so the form is the contact path —
                showing a mailto: to an address nobody reads is worse than
                sending people somewhere that actually reaches us. */}
            <li>
              {CONTACT_EMAIL ? (
                <a className="site-footer__link" href={`mailto:${CONTACT_EMAIL}`}>
                  ✉️ {CONTACT_EMAIL}
                </a>
              ) : (
                <Link className="site-footer__link" href="/contacto">
                  ✉️ Kontakta oss
                </Link>
              )}
            </li>
            <li>
              <span className="site-footer__muted">📍 Marbella, Spanien</span>
            </li>
          </ul>
        </div>

        <Column title="Köpa och hyra" links={FOOTER_BUY} />
        <Column title="Verktyg" links={FOOTER_TOOLS} />
        <Column title="För proffs" links={FOOTER_PRO} />
        <Column title="Orter" links={FOOTER_LOCATIONS} />
        <Column title="Per typ" links={FOOTER_TYPES} />
      </div>

      <div className="site-footer__bottom">
        <span>
          © {year} {brand} — Hitta din bostad i Spanien.
        </span>
        <span className="site-footer__legal">
          {FOOTER_COMPANY.map((l) => (
            <Link key={l.href} className="site-footer__link" href={l.href}>
              {l.label}
            </Link>
          ))}
        </span>
      </div>

      <div className="site-footer__disclaimer">
        Referenspriserna, köpkostnadsuppskattningarna och värderingarna som
        publiceras är vägledande beräkningar baserade på portalens annonser och
        gällande offentliga skattesatser. De utgör inte en officiell
        värdering, ett låneerbjudande eller finansiell rådgivning. {brand}{" "}
        deltar inte i förhandlingar mellan parterna och verifierar inte
        självständigt äganderätten till varje publicerad bostad.
      </div>
    </footer>
  );
}
