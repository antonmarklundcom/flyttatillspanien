import type { Metadata } from "next";
import Link from "next/link";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { agentUrl } from "@/lib/urls";
import { listAgentsForDirectory } from "@/lib/directory-queries";
import { CtaBand, PageHero, Section } from "@/components/MarketingUI";
import { safeImageUrl } from "@/lib/external-image";

export const dynamic = "force-dynamic";

const TITLE = "Fastighetsmäklare";
const DESCRIPTION = (brand: string) => `Mäklare som annonserar på ${brand}: deras aktiva objektlista, vilka områden de jobbar i och deras direktkontakt.`;

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE} för bostäder i Spanien`,
    description: DESCRIPTION(brand),
    alternates: { canonical: `${await siteOrigin()}/agentes` },
    openGraph: { title: `${TITLE} — ${brand}`, description: DESCRIPTION(brand) },
  };
}

export default async function AgentesPage() {
  const [origin, agents] = await Promise.all([
    siteOrigin(),
    listAgentsForDirectory(),
  ]);

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Start", url: "/" },
            { name: TITLE, url: "/agentes" },
          ]),
          ...(agents.length > 0
            ? [
                itemListJsonLd(
                  origin,
                  agents.map((a) => ({ title: a.name, url: agentUrl(a.slug) })),
                ),
              ]
            : []),
        ]}
      />

      <PageHero
        kicker="Företag"
        title="Fastighetsmäklare för bostäder i Spanien"
        subtitle="Att jobba med en mäklare som kan området kortar sökningen. Varje profil visar den aktiva objektlistan och direktkontakten."
      />

      <Section>
        {agents.length === 0 ? (
          <div className="mk-empty">
            <p>Det finns ännu inga mäklare med publicerade bostäder.</p>
            <Link className="mk-btn mk-btn--accent" href="/para-inmobiliarias">
              Annonsera som mäklare
            </Link>
          </div>
        ) : (
          <div className="mk-agency-grid">
            {agents.map((a) => (
              <Link key={a.id} className="mk-agency" href={agentUrl(a.slug)}>
                <div className="mk-agency__head">
                  {safeImageUrl(a.photoUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="mk-agency__logo mk-agency__logo--round"
                      src={safeImageUrl(a.photoUrl) ?? undefined}
                      referrerPolicy="no-referrer"
                      alt={a.name}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div
                      className="mk-agency__logo mk-agency__logo--fallback mk-agency__logo--round"
                      aria-hidden
                    >
                      {a.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="mk-agency__name">
                      {a.name}
                      {a.isVerified && (
                        <span className="mk-agency__verified" title="Verifierad">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="mk-agency__cities">
                      {a.agencyName ?? "Oberoende mäklare"}
                    </div>
                  </div>
                </div>

                {a.cities.length > 0 && (
                  <div className="mk-chips">
                    {a.cities.map((c) => (
                      <span key={c} className="mk-chip">
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mk-agency__meta">
                  <span>
                    {a.listingCount.toLocaleString("sv-SE")}{" "}
                    {a.listingCount === 1 ? "bostad" : "bostäder"}
                  </span>
                </div>

                <span className="mk-agency__cta">Se objektlistan →</span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {agents.some((a) => a.agencySlug) && (
        <Section tone="muted" width="narrow">
          <p className="mk-note">
            Letar du efter kontoret snarare än personen? Se{" "}
            <Link href="/inmobiliarias">mäklarkatalogen</Link>, med hela
            objektlistan för varje byrå.
          </p>
        </Section>
      )}

      <CtaBand
        title="Är du fastighetsmäklare?"
        text="Skapa din profil, annonsera din objektlista och ta emot förfrågningarna direkt. Utan kostnad."
        primary={{ label: "Skapa min profil", href: "/para-inmobiliarias" }}
        secondary={{ label: "Se planer", href: "/planes" }}
      />
    </main>
  );
}
