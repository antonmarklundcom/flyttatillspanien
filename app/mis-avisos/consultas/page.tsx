import type { Metadata } from "next";
import Link from "next/link";
import { PanelBar } from "@/components/panel/PanelBar";
import { requireOwnerContext } from "@/lib/auth/guards";
import { getPanelLeads } from "@/lib/panel-queries";
import { svOwner } from "@/i18n/sv";
import { listingUrl } from "@/lib/urls";
import { waLink } from "@/lib/wa";
import { ownerTabs } from "../tabs";

export const metadata: Metadata = {
  title: `Consultas`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const LEAD_TYPE_LABEL: Record<string, string> = {
  buyer: "Compra",
  renter: "Alquiler",
  seller: "Venta",
  valuation: "Tasación",
  developer: "Desarrolladora",
  agent_signup: "Alta de agente",
};

/** wa.me deep link to reply to the lead's own WhatsApp number. */
function waReplyHref(whatsapp: string): string {
  return waLink(whatsapp) ?? `https://wa.me/${whatsapp.replace(/\D/g, "")}`;
}

function formatWhen(d: Date): string {
  return new Intl.DateTimeFormat("es-PY", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function OwnerLeadsPage() {
  const { user, scope } = await requireOwnerContext();
  // Scope-guarded: the WHERE clause joins through the caller's own listings,
  // so this reads their leads and cannot read anyone else's.
  const leads = await getPanelLeads(scope);

  return (
    <>
      <PanelBar
        title={svOwner.panelTitle}
        role={user.role}
        userName={user.name}
        tabs={ownerTabs("leads")}
      />
      <main className="panel site-main">
        <h2 className="panel-section__title">{svOwner.leadsTitle}</h2>

        {leads.length === 0 ? (
          <p className="panel-empty">{svOwner.leadsEmpty}</p>
        ) : (
          <>
            <p className="panel-note">{svOwner.leadsNote}</p>
            {leads.map((lead) => (
              <article className="panel-card" key={lead.id}>
                <div className="panel-card__head">
                  <div>
                    <h3 className="panel-card__title">
                      {lead.name ?? "Consulta"}
                    </h3>
                    <div className="panel-card__meta">
                      <span>
                        {LEAD_TYPE_LABEL[lead.leadType] ?? lead.leadType}
                      </span>
                      <span>{formatWhen(lead.createdAt)}</span>
                      {lead.email ? <span>{lead.email}</span> : null}
                      {lead.listingTitle &&
                      lead.listingPublicId &&
                      lead.listingSlug ? (
                        <Link
                          href={listingUrl({
                            slug: lead.listingSlug,
                            publicId: lead.listingPublicId,
                          })}
                          target="_blank"
                        >
                          {lead.listingTitle}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <a
                    className="panel-btn panel-btn--whatsapp"
                    href={waReplyHref(lead.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {svOwner.contactLead}
                  </a>
                </div>

                {lead.message ? (
                  <div className="panel-card__body">{lead.message}</div>
                ) : null}
              </article>
            ))}
          </>
        )}
      </main>
    </>
  );
}
