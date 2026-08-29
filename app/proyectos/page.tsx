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

const TITLE = "Projekt och nyproduktion";
const DESCRIPTION =
  "Bostadshus, samfälligheter, gated communities och tomtprojekt under utveckling i Spanien: på ritning, under byggnation och inflyttningsklara.";

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
    title: "Förhandsbokningspris",
    text: "Att köpa på ritning kostar ofta betydligt mindre än den färdiga bostaden, och skillnaden byggs upp i värde allteftersom bygget fortskrider.",
  },
  {
    icon: "🗓",
    title: "Byggherrens betalplan",
    text: "Många projekt låter dig betala byggfasen i delbetalningar, utan bank inblandad fram till tillträdet.",
  },
  {
    icon: "🎨",
    title: "Du väljer bostaden",
    text: "Ju tidigare du går in, desto fler val av våningsplan, väderstreck och materialval finns kvar.",
  },
  {
    icon: "🔍",
    title: "Vad du bör kontrollera",
    text: "Byggherrens historik, bygglov, avtalat tillträdesdatum och vad som gäller vid försening. Be alltid om avtalet innan du bokar.",
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
        title="Projekt under utveckling i Spanien"
        subtitle="Lägenheter på ritning, samfälligheter, gated communities och tomtprojekt — med byggfas, tillträdesdatum och startpris för bostäderna."
      />

      <Section>
        {projects.length === 0 ? (
          <div className="mk-empty">
            <p>Det finns ännu inga publicerade projekt på portalen.</p>
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
          subtitle="Vilka som bygger bakom de publicerade projekten."
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

      <Section title="Att köpa på ritning: vad du bör veta">
        <FeatureGrid items={WHY} columns={4} />
      </Section>

      <CtaBand
        title="Bygger du projekt?"
        text="Publicera ditt projekt med alla enheter, betalplan och byggstatus."
        primary={{ label: "Publicera mitt projekt", href: "/contacto" }}
        secondary={{ label: "Se planer", href: "/planes" }}
      />
    </main>
  );
}
