import { cache } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { brandName } from "@/lib/brand-server";
import {
  getAgentBySlug,
  getAgentListings,
  countAgentListings,
  getAgencyById,
} from "@/lib/queries";
import { agentUrl, agencyUrl } from "@/lib/urls";
import { listingCanonicalOrigin, siteOrigin } from "@/lib/origin";
import { getIndexability } from "@/lib/indexability";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/jsonld";
import { listingUrl } from "@/lib/urls";
import { svAgentProfile, agentInquiryPrefillFor } from "@/i18n/sv";
import { JsonLd } from "@/components/JsonLd";
import { ListingCard } from "@/components/ListingCard";
import { ContactForm } from "@/components/ContactForm";
import { safeImageUrl } from "@/lib/external-image";

// Mirrors app/inmobiliaria/[slug]/page.tsx: DB-backed profile, no static
// caching — the founder's inventory changes, not slow-to-stale content.

type Params = { params: Promise<{ slug: string }> };

/** Shared resolution for metadata + page: the agent row + its listing count. */
const resolve = cache(async function resolve(slug: string) {
  const agent = await getAgentBySlug(slug);
  if (!agent) return null;
  const listingCount = await countAgentListings(agent.id);
  return { agent, listingCount };
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const brand = await brandName();
  const { slug } = await params;
  const r = await resolve(slug);
  if (!r) return { title: svAgentProfile.notFoundTitle };
  const { agent, listingCount } = r;
  const ix = getIndexability({ listingCount });
  const canonical = `${await siteOrigin()}${agentUrl(agent.slug)}`;
  return {
    title: svAgentProfile.metaTitle(agent.name),
    description: svAgentProfile.metaDescription(brand, agent.name, listingCount),
    alternates: { canonical },
    robots: { index: ix.state === "index", follow: true },
  };
}

export default async function AgentProfilePage({ params }: Params) {
  const brand = await brandName();
  const { slug } = await params;
  const r = await resolve(slug);
  if (!r) notFound();
  const { agent, listingCount } = r;

  // A brand-new agent with zero listings has nothing to show — same
  // gone-or-noindex rule every other thin page in the site follows
  // (src/lib/indexability.ts), so this page and the sitemap can never disagree.
  const ix = getIndexability({ listingCount });
  if (ix.state === "gone") notFound();

  const [listings, agency] = await Promise.all([
    getAgentListings({ agentId: agent.id, limit: 24 }),
    agent.agencyId ? getAgencyById(agent.agencyId) : Promise.resolve(null),
  ]);
  const origin = await siteOrigin();
  // ItemList entries are listing detail URLs — canonical host may differ (F9).
  const listingOrigin = await listingCanonicalOrigin();
  const canonical = `${origin}${agentUrl(agent.slug)}`;
  const initials = agent.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const crumbs = [
    { name: "Inicio", url: "/" },
    { name: agent.name, url: agentUrl(agent.slug) },
  ];

  return (
    <main className="listing-main">
      {ix.state === "index" && (
        <JsonLd
          data={[
            breadcrumbJsonLd(origin, crumbs),
            itemListJsonLd(
              listingOrigin,
              listings.map((l) => ({ title: l.title, url: listingUrl(l) })),
            ),
          ]}
        />
      )}

      <nav className="breadcrumb-nav" aria-label="Ruta de navegación">
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Link className="breadcrumb-nav__link" href="/">
            Inicio
          </Link>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span aria-hidden>›</span>
          <span className="breadcrumb-nav__current" aria-current="page">
            {agent.name}
          </span>
        </span>
      </nav>

      <header className="agent-profile__header">
        {safeImageUrl(agent.photoUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="agent-profile__logo" src={safeImageUrl(agent.photoUrl) ?? undefined} alt={agent.name} referrerPolicy="no-referrer" />
        ) : (
          <div className="agent-profile__avatar" aria-hidden>
            {initials || "A"}
          </div>
        )}
        <div>
          <h1 className="agent-profile__name">
            {agent.name}
            {agent.isVerified && (
              <span className="agent-profile__verified" title={svAgentProfile.verified}>
                ✓
              </span>
            )}
          </h1>
          <p className="agent-profile__meta">
            {svAgentProfile.kind} ·{" "}
            {listingCount > 0
              ? svAgentProfile.listingCount(listingCount)
              : svAgentProfile.noListings}
          </p>
          {agency && (
            <p className="agent-profile__agency">
              {svAgentProfile.agencyPrefix}{" "}
              <Link href={agencyUrl(agency.slug)}>{agency.name}</Link>
            </p>
          )}
          <div className="agent-profile__contact">
            <a className="contact-form__altlink" href="#contacto">
              {svAgentProfile.contactLink}
            </a>
          </div>
        </div>
      </header>

      {listings.length > 0 ? (
        <section className="similar-listings" style={{ borderTop: "none", paddingTop: 0 }}>
          <h2 className="similar-listings__title">{svAgentProfile.listingsTitle}</h2>
          <div className="similar-listings__grid">
            {listings.map((card) => (
              <ListingCard key={card.id} card={card} />
            ))}
          </div>
        </section>
      ) : (
        <p className="agent-profile__empty">{svAgentProfile.empty}</p>
      )}

      {/* Always rendered now: the form itself is the channel (the lead is
          stored and mailed), and the agent's own number is only the optional
          WhatsApp continuation on top of it. Gating the whole panel on a phone
          number was correct while WhatsApp was the only way to reach anyone. */}
      <section className="contact-panel" id="contacto">
        <h2 className="contact-panel__title">{svAgentProfile.contactTitle}</h2>
        <p className="contact-panel__subtitle">{svAgentProfile.contactSubtitle}</p>
        <ContactForm
          contactWhatsapp={agent.phone}
          leadType="buyer"
          prefillMessage={agentInquiryPrefillFor(brand, agent.name, canonical)}
          variant="panel"
        />
      </section>
    </main>
  );
}
