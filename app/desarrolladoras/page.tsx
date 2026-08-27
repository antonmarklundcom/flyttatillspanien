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

const TITLE = "Desarrolladoras";
const DESCRIPTION =
  "Desarrolladoras inmobiliarias que construyen en España: sus proyectos, en qué ciudades y en qué etapa de obra están.";

const STAGE_LABEL: Record<string, string> = {
  en_pozo: "En pozo",
  en_construccion: "En construcción",
  entrega_inmediata: "Entrega inmediata",
};

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE} inmobiliarias en España`,
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
            { name: "Inicio", url: "/" },
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
        kicker="Empresas"
        title="Desarrolladoras que construyen en España"
        subtitle="Quién está detrás de cada proyecto. Antes de reservar una unidad en pozo, mirá qué más construyó la desarrolladora y en qué etapa está cada obra."
      />

      <Section>
        {developers.length === 0 ? (
          <div className="mk-empty">
            <p>Todavía no hay desarrolladoras con proyectos publicados.</p>
            <Link className="mk-btn mk-btn--accent" href="/contacto">
              Publicar mi proyecto
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
                    {d.projectCount === 1 ? "proyecto" : "proyectos"}
                  </span>
                  {d.unitCount > 0 && (
                    <span>
                      {d.unitCount.toLocaleString("es-PY")}{" "}
                      {d.unitCount === 1 ? "unidad" : "unidades"}
                    </span>
                  )}
                </div>

                <span className="mk-agency__cta">Ver proyectos →</span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <CtaBand
        title="¿Desarrollás proyectos?"
        text="Publicá tu emprendimiento con todas sus unidades, etapa de obra y plan de pagos."
        primary={{ label: "Publicar mi proyecto", href: "/contacto" }}
        secondary={{ label: "Ver proyectos", href: "/proyectos" }}
      />
    </main>
  );
}
