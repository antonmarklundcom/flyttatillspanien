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

const TITLE = "Mäklare";
const DESCRIPTION = (brand: string) => `Mäklare som publicerar objekt på ${brand}: deras aktiva utbud, vilka områden de jobbar i och direktkontakt via WhatsApp.`;

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE} i Spanien`,
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
        title="Mäklare i Spanien"
        subtitle="Att jobba med en mäklare som kan området gör sökandet snabbare. Varje profil visar deras aktiva utbud och en direkt kontaktväg."
      />

      <Section>
        {agents.length === 0 ? (
          <div className="mk-empty">
            <p>Det finns inga mäklare med publicerade objekt ännu.</p>
            <Link className="mk-btn mk-btn--accent" href="/para-inmobiliarias">
              Publicera som mäklare
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
                      {a.agencyName ?? "Fristående mäklare"}
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

                <span className="mk-agency__cta">Se utbud →</span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {agents.some((a) => a.agencySlug) && (
        <Section tone="muted" width="narrow">
          <p className="mk-note">
            Letar du efter kontoret snarare än personen? Se{" "}
            <Link href="/inmobiliarias">katalogen över mäklarbyråer</Link>, med
            hela deras utbud.
          </p>
        </Section>
      )}

      <CtaBand
        title="Är du mäklare?"
        text="Skapa din profil, publicera ditt utbud och få förfrågningarna direkt till din WhatsApp. Helt gratis."
        primary={{ label: "Skapa min profil", href: "/para-inmobiliarias" }}
        secondary={{ label: "Se planer", href: "/planes" }}
      />
    </main>
  );
}
