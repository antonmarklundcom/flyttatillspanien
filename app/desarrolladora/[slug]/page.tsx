import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { ProjectCard } from "@/components/ProjectCard";
import { getDeveloperBySlug } from "@/lib/directory-queries";
import { CtaBand, Section } from "@/components/MarketingUI";
import { waLink } from "@/lib/wa";
import { safeImageUrl } from "@/lib/external-image";

// DB-backed profile, same posture as the agency and agent profiles.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

const resolve = cache(getDeveloperBySlug);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const r = await resolve(slug);
  if (!r) return { title: `Desarrolladora no encontrada` };
  const { developer, projects } = r;
  const description = `${developer.name}: ${projects.length} ${
    projects.length === 1 ? "proyecto" : "proyectos"
  } en España. Etapa de obra, fecha de entrega y unidades disponibles.`;
  return {
    title: `${developer.name} — proyectos en España`,
    description,
    alternates: {
      canonical: `${await siteOrigin()}/desarrolladora/${developer.slug}`,
    },
    // A developer with no published project is a thin page — render it for
    // whoever has the link, but keep it out of the index (same rule as the
    // agency/agent profiles in src/lib/indexability.ts).
    robots:
      projects.length === 0
        ? { index: false, follow: true }
        : { index: true, follow: true },
  };
}

export default async function DesarrolladoraPage({ params }: Params) {
  const brand = await brandName();
  const { slug } = await params;
  const r = await resolve(slug);
  if (!r) notFound();
  const { developer, projects } = r;
  const origin = await siteOrigin();

  const totalUnits = projects.reduce((n, p) => n + p.availableUnits, 0);
  const waHref = waLink(
    developer.whatsapp,
    `Hola, vi los proyectos de ${developer.name} en ${brand}.`,
  );

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Inicio", url: "/" },
            { name: "Desarrolladoras", url: "/desarrolladoras" },
            { name: developer.name, url: `/desarrolladora/${developer.slug}` },
          ]),
          ...(projects.length > 0
            ? [
                itemListJsonLd(
                  origin,
                  projects.map((p) => ({
                    title: p.name,
                    url: `/proyecto/${p.slug}`,
                  })),
                ),
              ]
            : []),
        ]}
      />

      <section className="profile-hero">
        <div className="profile-hero__inner">
          {safeImageUrl(developer.logoUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="profile-hero__logo"
              src={safeImageUrl(developer.logoUrl) ?? undefined}
              referrerPolicy="no-referrer"
              alt={developer.name}
            />
          ) : (
            <div className="profile-hero__logo profile-hero__logo--fallback" aria-hidden>
              {developer.name.charAt(0)}
            </div>
          )}
          <div>
            <div className="profile-hero__kicker">Desarrolladora</div>
            <h1 className="profile-hero__title">{developer.name}</h1>
            <div className="profile-hero__meta">
              <span>
                {projects.length}{" "}
                {projects.length === 1 ? "proyecto" : "proyectos"}
              </span>
              {totalUnits > 0 && (
                <span>
                  {totalUnits.toLocaleString("es-PY")}{" "}
                  {totalUnits === 1 ? "unidad publicada" : "unidades publicadas"}
                </span>
              )}
            </div>
            <div className="profile-hero__actions">
              {waHref && (
                <a
                  className="mk-btn mk-btn--accent"
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Consultar por WhatsApp
                </a>
              )}
              {developer.website && (
                <a
                  className="mk-btn mk-btn--outline"
                  href={developer.website}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  Sitio web
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <Section title="Proyectos">
        {projects.length === 0 ? (
          <div className="mk-empty">
            <p>Esta desarrolladora todavía no tiene proyectos publicados.</p>
            <Link className="mk-btn mk-btn--accent" href="/proyectos">
              Ver todos los proyectos
            </Link>
          </div>
        ) : (
          <div className="mk-project-grid">
            {projects.map((p) => (
              <ProjectCard key={p.id} card={p} />
            ))}
          </div>
        )}
      </Section>

      <Section width="narrow">
        <p className="mk-note">
          Antes de reservar una unidad en pozo, pedí el permiso de
          construcción, la fecha de entrega contractual y qué pasa si la obra
          se atrasa. {brand} publica los proyectos pero no verifica de
          forma independiente el avance de obra ni los plazos informados.{" "}
          <Link href="/proyectos">Más sobre comprar en pozo</Link>.
        </p>
      </Section>

      <CtaBand
        title="Explorá toda la obra nueva"
        text="Edificios, condominios, barrios cerrados y loteamientos en desarrollo."
        primary={{ label: "Ver proyectos", href: "/proyectos" }}
        secondary={{ label: "Ver desarrolladoras", href: "/desarrolladoras" }}
      />
    </main>
  );
}
