import type { Metadata } from "next";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { languageAlternates } from "@/lib/alternates";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { getPortalStats } from "@/lib/directory-queries";
import { svForMaklare } from "@/i18n/sv";
import {
  CtaBand,
  FeatureGrid,
  PageHero,
  Section,
  StatRow,
} from "@/components/MarketingUI";

/**
 * The Swedish-language "list with us" pitch to Spanish agencies (design doc
 * §1): a `.es` door for agency acquisition is a one-page problem, not a
 * second vertical, and this route is that page. `/es/inmobiliarias`, the
 * Spanish-language sibling, is backlog (§10) until agency outreach starts.
 */

const PATH = "/for-maklare";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: svForMaklare.metaTitle(brand),
    description: svForMaklare.metaDescription(brand),
    alternates: {
      canonical: `${await siteOrigin()}${PATH}`,
      languages: languageAlternates({ path: PATH, scope: "site" }),
    },
    openGraph: {
      title: svForMaklare.metaTitle(brand),
      description: svForMaklare.metaDescription(brand),
    },
  };
}

export default async function ForMaklarePage() {
  const brand = await brandName();
  const [origin, stats] = await Promise.all([siteOrigin(), getPortalStats()]);

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Start", url: "/" },
            { name: svForMaklare.heroKicker, url: PATH },
          ]),
        ]}
      />

      <PageHero
        kicker={svForMaklare.heroKicker}
        title={svForMaklare.heroTitle}
        subtitle={svForMaklare.heroSubtitle(brand)}
        tone="dark"
        actions={
          <>
            <a className="mk-btn mk-btn--accent" href="/registro?kind=agency">
              {svForMaklare.heroCta}
            </a>
            <a className="mk-btn mk-btn--ghost" href="/login">
              {svForMaklare.heroSecondaryCta}
            </a>
          </>
        }
      />

      {stats.listings > 0 && (
        <Section tone="muted">
          <StatRow
            stats={[
              { value: stats.listings.toLocaleString("sv-SE"), label: "Publicerade bostäder" },
              { value: stats.cities.toLocaleString("sv-SE"), label: "Orter med utbud" },
              { value: stats.agencies.toLocaleString("sv-SE"), label: "Byråer som annonserar" },
            ]}
          />
        </Section>
      )}

      <Section title={svForMaklare.whyTitle} width="narrow">
        <p className="mk-section__subtitle">{svForMaklare.whyText}</p>
      </Section>

      <Section tone="muted">
        <FeatureGrid items={[...svForMaklare.features]} columns={3} />
      </Section>

      <CtaBand
        title={svForMaklare.ctaTitle}
        text={svForMaklare.ctaText}
        primary={{ label: svForMaklare.ctaPrimary, href: "/registro?kind=agency" }}
        secondary={{ label: svForMaklare.ctaSecondary, href: "/agencia/importar" }}
      />
    </main>
  );
}
