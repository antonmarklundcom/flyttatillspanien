import type { Metadata } from "next";
import Link from "next/link";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { agencyUrl } from "@/lib/urls";
import { listAgenciesForDirectory } from "@/lib/directory-queries";
import { CtaBand, PageHero, Section } from "@/components/MarketingUI";
import { safeImageUrl } from "@/lib/external-image";

export const dynamic = "force-dynamic";

const TITLE = "Mäklarkatalog";
const DESCRIPTION = (brand: string) => `Mäklarbyråer och agenter som annonserar sin objektlista på ${brand}. Se deras aktiva bostäder och ta kontakt direkt.`;

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE} för bostäder i Spanien`,
    description: DESCRIPTION(brand),
    alternates: { canonical: `${await siteOrigin()}/inmobiliarias` },
    openGraph: { title: `${TITLE} — ${brand}`, description: DESCRIPTION(brand) },
  };
}

export default async function InmobiliariasPage() {
  const [origin, agencies] = await Promise.all([
    siteOrigin(),
    listAgenciesForDirectory(),
  ]);

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Start", url: "/" },
            { name: TITLE, url: "/inmobiliarias" },
          ]),
          ...(agencies.length > 0
            ? [
                itemListJsonLd(
                  origin,
                  agencies.map((a) => ({
                    title: a.name,
                    url: agencyUrl(a.slug),
                  })),
                ),
              ]
            : []),
        ]}
      />

      <PageHero
        kicker="Katalog"
        title="Mäklarbyråer och agenter för bostäder i Spanien"
        subtitle="Varje profil visar mäklarbyråns aktiva objektlista och direktkontakt. Verifieringsmärket betyder att vi kontrollerat kontorets uppgifter."
      />

      <Section>
        {agencies.length === 0 ? (
          <div className="mk-empty">
            <p>
              Det finns ännu ingen mäklarbyrå med publicerad objektlista i
              katalogen.
            </p>
            <Link className="mk-btn mk-btn--accent" href="/para-inmobiliarias">
              Lägg till min mäklarbyrå
            </Link>
          </div>
        ) : (
          <div className="mk-agency-grid">
            {agencies.map((a) => (
              <Link
                key={a.id}
                className="mk-agency"
                href={agencyUrl(a.slug)}
              >
                <div className="mk-agency__head">
                  {safeImageUrl(a.logoUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="mk-agency__logo"
                      src={safeImageUrl(a.logoUrl) ?? undefined}
                      referrerPolicy="no-referrer"
                      alt={a.name}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div
                      className="mk-agency__logo mk-agency__logo--fallback"
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
                    {a.kind === "relocation" && (
                      <div className="mk-agency__cities">
                        Relocation-partner — företräder köparen
                      </div>
                    )}
                    {a.cities.length > 0 && (
                      <div className="mk-agency__cities">
                        {a.cities.join(" · ")}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mk-agency__meta">
                  <span>
                    {a.listingCount.toLocaleString("sv-SE")}{" "}
                    {a.listingCount === 1 ? "bostad" : "bostäder"}
                  </span>
                  {a.agentCount > 0 && (
                    <span>
                      {a.agentCount} {a.agentCount === 1 ? "mäklare" : "mäklare"}
                    </span>
                  )}
                </div>

                <span className="mk-agency__cta">Se objektlistan →</span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <CtaBand
        title="Har du en mäklarbyrå?"
        text="Annonsera hela din objektlista, få din verifierade profil och ta emot förfrågningarna direkt."
        primary={{ label: "Lägg till min mäklarbyrå", href: "/para-inmobiliarias" }}
        secondary={{ label: "Se planer", href: "/planes" }}
      />
    </main>
  );
}
