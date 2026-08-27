import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/lib/queries";
import { listingUrl, categoryUrl } from "@/lib/urls";
import { formatUsd, formatPrice } from "@/lib/format";
import { inquiryPrefillFor } from "@/i18n/sv";
import { brandName } from "@/lib/brand-server";
import { ContactForm } from "@/components/ContactForm";
import { ProjectCard } from "@/components/ProjectCard";
import { ListingMapLazy } from "@/components/ListingMapLazy";
import { siteOrigin } from "@/lib/origin";
import { safeImageUrl } from "@/lib/external-image";

// Canonical URLs come from the Host header (src/lib/origin.ts), a dynamic
// API — so this route renders per request instead of on an ISR window.

type Params = { params: Promise<{ slug: string }> };

const STAGE_LABEL: Record<string, string> = {
  en_pozo: "En pozo",
  en_construccion: "En construcción",
  entrega_inmediata: "Entrega inmediata",
};

const TYPE_LABEL: Record<string, string> = {
  edificio: "Edificio",
  loteamiento: "Loteamiento",
  condominio: "Condominio",
  barrio_cerrado: "Barrio cerrado",
};

const STATE_LABEL: Record<string, string> = {
  entrega_inmediata: "Entrega inmediata",
  en_construccion: "En construcción",
  en_pozo: "En pozo",
  usado: "Usado",
};

function deliveryLabel(d: string | Date | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return `Entrega ${date.toLocaleDateString("es-PY", { month: "long", year: "numeric" })}`;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const brand = await brandName();
  const { slug } = await params;
  const detail = await getProjectBySlug(slug);
  if (!detail) return { title: `Proyecto no encontrado` };
  const { project, developer } = detail;
  return {
    // No brand here — the layout's title.template appends it (F22: this was
    // the one page in the repo that doubled it).
    title: `${project.name}${developer ? ` — ${developer.name}` : ""}`,
    description:
      project.descriptionEs?.slice(0, 160) ??
      `${project.name}: proyecto inmobiliario en Paraguay.`,
    alternates: {
      canonical: `${await siteOrigin()}/proyecto/${project.slug}`,
    },
  };
}

export default async function ProjectPage({ params }: Params) {
  const brand = await brandName();
  const { slug } = await params;
  const detail = await getProjectBySlug(slug);
  if (!detail) notFound();

  const { project, developer, location, units, otherProjects } = detail;
  const minPrice = units.length > 0 ? Number(units[0].priceUsd) : null;
  const delivery = deliveryLabel(project.deliveryDate);
  const canonical = `${await siteOrigin()}/proyecto/${project.slug}`;
  const waMessage = inquiryPrefillFor(brand, project.name, canonical);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "1rem" }}>
      <nav className="breadcrumb-nav" aria-label="Ruta de navegación">
        <Link className="breadcrumb-nav__link" href="/">
          Inicio
        </Link>
        {location && (
          <>
            <span aria-hidden>›</span>
            <Link
              className="breadcrumb-nav__link"
              href={categoryUrl({ operation: "venta", citySlug: location.slug })}
            >
              {location.name}
            </Link>
          </>
        )}
        <span aria-hidden>›</span>
        <span className="breadcrumb-nav__current">Proyectos</span>
        <span aria-hidden>›</span>
        <span className="breadcrumb-nav__current" aria-current="page">
          {project.name}
        </span>
      </nav>

      <h1 className="listing-title">{project.name}</h1>

      {/* Hero */}
      <div
        className={`project-hero${project.heroImageUrl ? "" : " project-hero--empty"}`}
      >
        {project.heroImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="media-cover-img"
            src={project.heroImageUrl}
            alt={project.name}
            loading="eager"
            fetchPriority="high"
          />
        )}
        {!project.heroImageUrl && (
          <>
            <span className="project-hero__icon" aria-hidden>
              🏗️
            </span>
            <span className="project-hero__label">Imágenes próximamente</span>
          </>
        )}
      </div>

      <div className="listing-detail__layout">
        <div>
          <ul className="listing-facts">
            {project.stage && (
              <li className="listing-facts__item listing-facts__item--stage">
                {STAGE_LABEL[project.stage] ?? project.stage}
              </li>
            )}
            {delivery && <li className="listing-facts__item">📅 {delivery}</li>}
            <li className="listing-facts__item">
              🏢 {TYPE_LABEL[project.projectType] ?? project.projectType}
            </li>
            {units.length > 0 && (
              <li className="listing-facts__item">
                🔑 {units.length} unidades disponibles
              </li>
            )}
          </ul>

          {minPrice != null && (
            <div className="listing-price">
              <span className="listing-price__label">Venta</span>{" "}
              <span className="listing-price__amount">
                desde {formatUsd(minPrice)}
              </span>
            </div>
          )}

          {project.descriptionEs && (
            <section className="listing-section">
              <h2 className="listing-section__title">🏙 Sobre el proyecto</h2>
              <p
                style={{
                  lineHeight: 1.6,
                  whiteSpace: "pre-line",
                  margin: 0,
                }}
              >
                {project.descriptionEs}
              </p>
            </section>
          )}

          {project.lat && project.lng && (
            <section className="listing-section">
              <h2 className="listing-section__title">📍 Ubicación</h2>
              {location && (
                <p className="listing-location__caption">{location.name}</p>
              )}
              <ListingMapLazy lat={Number(project.lat)} lng={Number(project.lng)} />
            </section>
          )}

          {units.length > 0 && (
            <section className="listing-section">
              <h2 className="listing-section__title">🔑 Unidades disponibles</h2>
              <div className="units-table__wrap">
                <table className="units-table">
                  <thead>
                    <tr>
                      <th>Unidad</th>
                      <th>Hab.</th>
                      <th>Baños</th>
                      <th>Área</th>
                      <th>Precio</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <Link className="units-table__link" href={listingUrl(u)}>
                            {u.title}
                          </Link>
                        </td>
                        <td>{u.bedrooms ?? "—"}</td>
                        <td>{u.bathrooms ?? "—"}</td>
                        <td>{u.areaM2 ? `${Math.round(Number(u.areaM2))} m²` : "—"}</td>
                        <td className="units-table__price">{formatPrice(u)}</td>
                        <td>
                          <span className="units-table__state">
                            {u.propertyState
                              ? STATE_LABEL[u.propertyState] ?? u.propertyState
                              : "Disponible"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <aside className="listing-detail__aside">
          <div className="seller-card__head">
            {safeImageUrl(developer?.logoUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="seller-card__logo"
                src={safeImageUrl(developer?.logoUrl) ?? undefined}
                referrerPolicy="no-referrer"
                alt={developer?.name ?? ""}
              />
            ) : (
              <div className="seller-card__avatar" aria-hidden>
                {(developer?.name ?? "P")
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase() ?? "")
                  .join("")}
              </div>
            )}
            <div>
              <div className="seller-card__name">
                {developer?.name ?? `Publicado en ${brand}`}
              </div>
              <div className="seller-card__kind">
                {developer ? "Desarrolladora" : brand}
              </div>
            </div>
          </div>
          <ContactForm
            contactWhatsapp={developer?.whatsapp ?? null}
            leadType="buyer"
            prefillMessage={waMessage}
            variant="card"
          />
        </aside>
      </div>

      {otherProjects.length > 0 && (
        <section className="similar-listings">
          <h2 className="similar-listings__title">
            Otros proyectos de {developer?.name ?? "esta desarrolladora"}
          </h2>
          <div className="home-row">
            {otherProjects.map((p) => (
              <ProjectCard key={p.id} card={p} />
            ))}
          </div>
        </section>
      )}

      <section className="contact-panel">
        <h2 className="contact-panel__title">¿Interesado en este proyecto?</h2>
        <p className="contact-panel__subtitle">
          Contactanos hoy para más información o para agendar una visita.
        </p>
        <ContactForm
          contactWhatsapp={developer?.whatsapp ?? null}
          leadType="buyer"
          prefillMessage={waMessage}
          variant="panel"
        />
      </section>
    </main>
  );
}
