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

const TITLE = "Agentes inmobiliarios";
const DESCRIPTION = (brand: string) => `Agentes inmobiliarios que publican en ${brand}: su cartera activa, las zonas donde trabajan y su contacto directo por WhatsApp.`;

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE} en España`,
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
            { name: "Inicio", url: "/" },
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
        kicker="Empresas"
        title="Agentes inmobiliarios en España"
        subtitle="Trabajar con un agente que conoce la zona acorta la búsqueda. Cada perfil muestra su cartera activa y su contacto directo."
      />

      <Section>
        {agents.length === 0 ? (
          <div className="mk-empty">
            <p>Todavía no hay agentes con propiedades publicadas.</p>
            <Link className="mk-btn mk-btn--accent" href="/para-inmobiliarias">
              Publicar como agente
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
                        <span className="mk-agency__verified" title="Verificado">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="mk-agency__cities">
                      {a.agencyName ?? "Agente independiente"}
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
                    {a.listingCount.toLocaleString("es-PY")}{" "}
                    {a.listingCount === 1 ? "propiedad" : "propiedades"}
                  </span>
                </div>

                <span className="mk-agency__cta">Ver cartera →</span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {agents.some((a) => a.agencySlug) && (
        <Section tone="muted" width="narrow">
          <p className="mk-note">
            ¿Buscás la oficina y no la persona? Mirá el{" "}
            <Link href="/inmobiliarias">directorio de inmobiliarias</Link>, con
            la cartera completa de cada una.
          </p>
        </Section>
      )}

      <CtaBand
        title="¿Sos agente inmobiliario?"
        text="Creá tu perfil, publicá tu cartera y recibí las consultas directo en tu WhatsApp. Sin costo."
        primary={{ label: "Crear mi perfil", href: "/para-inmobiliarias" }}
        secondary={{ label: "Ver planes", href: "/planes" }}
      />
    </main>
  );
}
