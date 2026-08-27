import type { Metadata } from "next";
import Link from "next/link";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { ProjectCard } from "@/components/ProjectCard";
import { listAllProjects } from "@/lib/directory-queries";
import { getFeaturedDevelopers } from "@/lib/queries";
import {
  CtaBand,
  FeatureGrid,
  PageHero,
  Section,
} from "@/components/MarketingUI";
import { safeImageUrl } from "@/lib/external-image";

export const dynamic = "force-dynamic";

const TITLE = "Proyectos y obra nueva";
const DESCRIPTION =
  "Edificios, condominios, barrios cerrados y loteamientos en desarrollo en Paraguay: en pozo, en construcción y con entrega inmediata.";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE} en Paraguay`,
    description: DESCRIPTION,
    alternates: { canonical: `${await siteOrigin()}/proyectos` },
    openGraph: { title: `${TITLE} — ${brand}`, description: DESCRIPTION },
  };
}

const WHY = [
  {
    icon: "💸",
    title: "Precio de preventa",
    text: "Comprar en pozo suele costar bastante menos que la unidad terminada, y la diferencia se capitaliza a medida que avanza la obra.",
  },
  {
    icon: "🗓",
    title: "Plan de pagos de la desarrolladora",
    text: "Muchos proyectos financian la etapa de construcción en cuotas, sin banco de por medio hasta la entrega.",
  },
  {
    icon: "🎨",
    title: "Elegís la unidad",
    text: "Cuanto antes entrás, más opciones de piso, orientación y terminaciones quedan disponibles.",
  },
  {
    icon: "🔍",
    title: "Qué verificar",
    text: "Trayectoria de la desarrolladora, permiso de construcción, fecha de entrega contractual y qué pasa si se atrasa. Pedí siempre el contrato antes de reservar.",
  },
];

export default async function ProyectosPage() {
  const [origin, projects, developers] = await Promise.all([
    siteOrigin(),
    listAllProjects(),
    getFeaturedDevelopers(12),
  ]);

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Inicio", url: "/" },
            { name: TITLE, url: "/proyectos" },
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

      <PageHero
        kicker="Obra nueva"
        title="Proyectos en desarrollo en Paraguay"
        subtitle="Departamentos en pozo, condominios, barrios cerrados y loteamientos — con la etapa de obra, la fecha de entrega y el precio desde el que arrancan las unidades."
      />

      <Section>
        {projects.length === 0 ? (
          <div className="mk-empty">
            <p>Todavía no hay proyectos publicados en el portal.</p>
            <Link className="mk-btn mk-btn--accent" href="/contacto">
              Publicar mi proyecto
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

      {developers.length > 0 && (
        <Section
          tone="muted"
          title="Desarrolladoras"
          subtitle="Quiénes están construyendo los proyectos publicados."
        >
          <div className="mk-devs">
            {developers.map((d) => (
              <div key={d.id} className="mk-dev">
                {safeImageUrl(d.logoUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="mk-dev__logo"
                    src={safeImageUrl(d.logoUrl) ?? undefined}
                    referrerPolicy="no-referrer"
                    alt={d.name}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="mk-dev__logo mk-dev__logo--fallback" aria-hidden>
                    {d.name.charAt(0)}
                  </div>
                )}
                <div className="mk-dev__name">{d.name}</div>
                <div className="mk-dev__count">
                  {d.projectCount}{" "}
                  {d.projectCount === 1 ? "proyecto" : "proyectos"}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Comprar en pozo: lo que conviene saber">
        <FeatureGrid items={WHY} columns={4} />
      </Section>

      <CtaBand
        title="¿Desarrollás proyectos?"
        text="Publicá tu emprendimiento con todas sus unidades, plan de pagos y avance de obra."
        primary={{ label: "Publicar mi proyecto", href: "/contacto" }}
        secondary={{ label: "Ver planes", href: "/planes" }}
      />
    </main>
  );
}
