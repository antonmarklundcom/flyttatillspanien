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
import { svDeveloper } from "@/i18n/sv";

// DB-backed profile, same posture as the agency and agent profiles.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

const resolve = cache(getDeveloperBySlug);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const r = await resolve(slug);
  if (!r) return { title: svDeveloper.notFoundTitle };
  const { developer, projects } = r;
  return {
    title: svDeveloper.metaTitle(developer.name),
    description: svDeveloper.metaDescription(developer.name, projects.length),
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
    developer.phone,
    svDeveloper.waPrefill(developer.name, brand),
  );

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: svDeveloper.breadcrumbHome, url: "/" },
            { name: svDeveloper.breadcrumbDevelopers, url: "/desarrolladoras" },
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
            <div className="profile-hero__kicker">{svDeveloper.kicker}</div>
            <h1 className="profile-hero__title">{developer.name}</h1>
            <div className="profile-hero__meta">
              <span>{svDeveloper.projectCount(projects.length)}</span>
              {totalUnits > 0 && <span>{svDeveloper.unitCount(totalUnits)}</span>}
            </div>
            <div className="profile-hero__actions">
              {waHref && (
                <a
                  className="mk-btn mk-btn--accent"
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {svDeveloper.contactWhatsapp}
                </a>
              )}
              {developer.website && (
                <a
                  className="mk-btn mk-btn--outline"
                  href={developer.website}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  {svDeveloper.website}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <Section title={svDeveloper.projectsTitle}>
        {projects.length === 0 ? (
          <div className="mk-empty">
            <p>{svDeveloper.empty}</p>
            <Link className="mk-btn mk-btn--accent" href="/proyectos">
              {svDeveloper.emptyCta}
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
          {svDeveloper.preBookingNote(brand)}{" "}
          <Link href="/proyectos">{svDeveloper.preBookingLinkText}</Link>.
        </p>
      </Section>

      <CtaBand
        title={svDeveloper.ctaTitle}
        text={svDeveloper.ctaText}
        primary={{ label: svDeveloper.ctaPrimary, href: "/proyectos" }}
        secondary={{ label: svDeveloper.ctaSecondary, href: "/desarrolladoras" }}
      />
    </main>
  );
}
