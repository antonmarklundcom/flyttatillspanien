import type { Metadata } from "next";
import Link from "next/link";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { listDevelopersForDirectory } from "@/lib/directory-queries";
import { CtaBand, PageHero, Section } from "@/components/MarketingUI";
import { safeImageUrl } from "@/lib/external-image";

export const dynamic = "force-dynamic";

const TITLE = "Byggherrar";
const DESCRIPTION =
  "Byggherrar som bygger i Spanien: deras projekt, i vilka orter och i vilken byggfas de befinner sig.";

const STAGE_LABEL: Record<string, string> = {
  sobre_plano: "Köp på ritning",
  en_construccion: "Under byggnation",
  obra_nueva: "Nyproduktion, inflyttningsklar",
};

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE} för bostäder i Spanien`,
    description: DESCRIPTION,
    alternates: { canonical: `${await siteOrigin()}/desarrolladoras` },
    openGraph: { title: `${TITLE} — ${brand}`, description: DESCRIPTION },
  };
}

export default async function DesarrolladorasPage() {
  const [origin, developers] = await Promise.all([
    siteOrigin(),
    listDevelopersForDirectory(),
  ]);

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Start", url: "/" },
            { name: TITLE, url: "/desarrolladoras" },
          ]),
          ...(developers.length > 0
            ? [
                itemListJsonLd(
                  origin,
                  developers.map((d) => ({
                    title: d.name,
                    url: `/desarrolladora/${d.slug}`,
                  })),
                ),
              ]
            : []),
        ]}
      />

      <PageHero
        kicker="Företag"
        title="Byggherrar som bygger i Spanien"
        subtitle="Vem som står bakom varje projekt. Innan du bokar en enhet på ritning, kolla vad byggherren byggt tidigare och i vilken fas varje bygge är."
      />

      <Section>
        {developers.length === 0 ? (
          <div className="mk-empty">
            <p>Det finns ännu inga byggherrar med publicerade projekt.</p>
            <Link className="mk-btn mk-btn--accent" href="/contacto">
              Publicera mitt projekt
            </Link>
          </div>
        ) : (
          <div className="mk-agency-grid">
            {developers.map((d) => (
              <Link
                key={d.id}
                className="mk-agency"
                href={`/desarrolladora/${d.slug}`}
              >
                <div className="mk-agency__head">
                  {safeImageUrl(d.logoUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="mk-agency__logo"
                      src={safeImageUrl(d.logoUrl) ?? undefined}
                      referrerPolicy="no-referrer"
                      alt={d.name}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div
                      className="mk-agency__logo mk-agency__logo--fallback"
                      aria-hidden
                    >
                      {d.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="mk-agency__name">{d.name}</div>
                    {d.cities.length > 0 && (
                      <div className="mk-agency__cities">
                        {d.cities.slice(0, 3).join(" · ")}
                      </div>
                    )}
                  </div>
                </div>

                {d.stages.length > 0 && (
                  <div className="mk-chips">
                    {d.stages.map((s) => (
                      <span key={s} className="mk-chip">
                        {STAGE_LABEL[s] ?? s}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mk-agency__meta">
                  <span>
                    {d.projectCount}{" "}
                    {d.projectCount === 1 ? "projekt" : "projekt"}
                  </span>
                  {d.unitCount > 0 && (
                    <span>
                      {d.unitCount.toLocaleString("sv-SE")}{" "}
                      {d.unitCount === 1 ? "enhet" : "enheter"}
                    </span>
                  )}
                </div>

                <span className="mk-agency__cta">Se projekt →</span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <CtaBand
        title="Bygger du projekt?"
        text="Publicera ditt projekt med alla enheter, byggfas och betalplan."
        primary={{ label: "Publicera mitt projekt", href: "/contacto" }}
        secondary={{ label: "Se projekt", href: "/proyectos" }}
      />
    </main>
  );
}
