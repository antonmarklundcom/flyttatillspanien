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

const TITLE = "Nyproduktion";
const DESCRIPTION =
  "Nybyggda lägenheter, villaområden och tomtprojekt under uppförande i Spanien: i projektstadiet, under byggnation eller klara för inflyttning.";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE} i Spanien`,
    description: DESCRIPTION,
    alternates: { canonical: `${await siteOrigin()}/proyectos` },
    openGraph: { title: `${TITLE} — ${brand}`, description: DESCRIPTION },
  };
}

const WHY = [
  {
    icon: "💸",
    title: "Förhandsköpspris",
    text: "Att köpa i projektstadiet kostar oftast betydligt mindre än den färdiga enheten, och mellanskillnaden byggs in i värdet allt eftersom bygget fortskrider.",
  },
  {
    icon: "🗓",
    title: "Byggherrens betalningsplan",
    text: "Många projekt finansierar byggskedet i delbetalningar, utan bank inblandad fram till tillträdet.",
  },
  {
    icon: "🎨",
    title: "Du väljer enheten",
    text: "Ju tidigare du går in, desto fler val av våningsplan, läge och materialval finns kvar.",
  },
  {
    icon: "🔍",
    title: "Vad du bör kontrollera",
    text: "Byggherrens meritlista, bygglov, avtalat tillträdesdatum och vad som gäller vid förseningar. Be alltid om avtalet innan du reserverar.",
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
            { name: "Start", url: "/" },
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
        kicker="Nyproduktion"
        title="Projekt under uppförande i Spanien"
        subtitle="Lägenheter i projektstadiet, villaområden och tomtprojekt — med byggskede, tillträdesdatum och priset enheterna börjar på."
      />

      <Section>
        {projects.length === 0 ? (
          <div className="mk-empty">
            <p>Det finns inga publicerade projekt på portalen ännu.</p>
            <Link className="mk-btn mk-btn--accent" href="/contacto">
              Publicera mitt projekt
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
          title="Byggherrar"
          subtitle="Vilka som bygger de publicerade projekten."
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
                  {d.projectCount === 1 ? "projekt" : "projekt"}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Att köpa i projektstadiet: bra att veta">
        <FeatureGrid items={WHY} columns={4} />
      </Section>

      <CtaBand
        title="Bygger du projekt?"
        text="Publicera ditt projekt med alla enheter, betalningsplan och byggframsteg."
        primary={{ label: "Publicera mitt projekt", href: "/contacto" }}
        secondary={{ label: "Se planer", href: "/planes" }}
      />
    </main>
  );
}
