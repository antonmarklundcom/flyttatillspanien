import type { Metadata } from "next";
import Link from "next/link";
import { PanelBar } from "@/components/panel/PanelBar";
import { requireSuperAdmin } from "@/lib/auth/guards";
import {
  countLeadsByType,
  countRecentLeads,
  countReviewQueue,
  listAllLeads,
  type AdminLeadRow,
} from "@/lib/panel-queries";
import { svPanel } from "@/i18n/sv";
import { listingUrl } from "@/lib/urls";
import { waLink } from "@/lib/wa";
import { adminTabs } from "../tabs";

export const metadata: Metadata = {
  title: `Consultas`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const LEAD_TYPES = [
  "all",
  "buyer",
  "renter",
  "seller",
  "valuation",
  "developer",
  "agent_signup",
] as const;

const LEAD_TYPE_LABEL: Record<string, string> = {
  all: svPanel.filterAll,
  buyer: "Compra",
  renter: "Alquiler",
  seller: "Venta",
  valuation: "Tasación",
  developer: "Desarrolladora",
  agent_signup: "Alta de agente",
};

/** Who the lead was routed to — 'internal' means it is yours to work. */
const ROUTED_LABEL: Record<string, string> = {
  agency: "Inmobiliaria",
  agent: "Agente",
  owner: "Particular",
  internal: "Interno",
  developer: "Desarrolladora",
};

function waReplyHref(phone: string | null): string | null {
  return phone ? waLink(phone) ?? `https://wa.me/${phone.replace(/\D/g, "")}` : null;
}

function mailReplyHref(email: string): string {
  return `mailto:${email}`;
}

/**
 * Hand an FSBO lead to the person who published the listing. Null for every
 * other lead: an agency works its own inbox, and an internal lead is the
 * founder's to answer directly.
 */
function forwardHref(lead: AdminLeadRow) {
  if (!lead.ownerPhone) return null;
  const href = waLink(
    lead.ownerPhone,
    svPanel.forwardLeadMessage({
      listingTitle: lead.listingTitle,
      name: lead.name,
      whatsapp: lead.phone ?? lead.email,
      message: lead.message,
    }),
  );
  if (!href) return null;
  return (
    <a
      className="panel-btn"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {svPanel.forwardLead}
    </a>
  );
}

function formatWhen(d: Date): string {
  return new Intl.DateTimeFormat("es-PY", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; q?: string }>;
}) {
  const [{ tipo, q }, user] = await Promise.all([
    searchParams,
    requireSuperAdmin(),
  ]);

  const activeType = LEAD_TYPES.includes(tipo as (typeof LEAD_TYPES)[number])
    ? (tipo as (typeof LEAD_TYPES)[number])
    : "all";

  const [reviewCount, recentLeads, counts, rows] = await Promise.all([
    countReviewQueue(),
    countRecentLeads(),
    countLeadsByType(),
    listAllLeads({ type: activeType, q }),
  ]);

  return (
    <>
      <PanelBar
        title="Panel de administración"
        role={user.role}
        userName={user.name}
        tabs={adminTabs("leads", reviewCount, undefined, recentLeads)}
      />
      <main className="panel site-main">
        <h2 className="panel-section__title">{svPanel.adminLeadsTitle}</h2>
        <p style={{ color: "#55655F", fontSize: 13, marginTop: 0 }}>
          {svPanel.adminLeadsHint}
        </p>
        {/* Says what the tab badge is counting — a bare number next to
            "Consultas" would read as the all-time total. */}
        {recentLeads > 0 ? (
          <p className="panel-note">{svPanel.adminLeadsRecent(recentLeads)}</p>
        ) : null}

        <nav className="panel-chips">
          {LEAD_TYPES.map((t) => {
            const href =
              t === "all"
                ? "/admin/leads"
                : `/admin/leads?tipo=${t}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
            const count = counts[t] ?? 0;
            return (
              <Link
                key={t}
                href={href}
                className={`panel-chip${t === activeType ? " panel-chip--active" : ""}`}
              >
                {LEAD_TYPE_LABEL[t]}
                <span className="panel-tab__count">{count}</span>
              </Link>
            );
          })}
        </nav>

        {/* Same shape as the listings search on /admin/propiedades. */}
        <form action="/admin/leads" className="panel-form">
          {activeType !== "all" ? (
            <input type="hidden" name="tipo" value={activeType} />
          ) : null}
          <label className="panel-form__field" style={{ flexBasis: "280px" }}>
            <span className="auth-field__label">
              {svPanel.adminLeadsSearchLabel}
            </span>
            <input
              className="auth-field__input"
              name="q"
              type="search"
              defaultValue={q ?? ""}
            />
          </label>
          <div className="panel-form__field panel-form__field--action">
            <button className="panel-btn" type="submit">
              {svPanel.searchSubmit}
            </button>
          </div>
        </form>

        {rows.length === 0 ? (
          <p className="panel-empty">{svPanel.adminLeadsEmpty}</p>
        ) : (
          rows.map((lead) => (
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
                    <span>{lead.email}</span>
                    {lead.phone ? <span>{lead.phone}</span> : null}
                    {/* Who owns the follow-up: an agency, a particular
                        seller who has no panel yet, or you. */}
                    <span>
                      {lead.agencyName ??
                        (lead.ownerPhone
                          ? `${svPanel.leadOwnerRouted}: ${lead.ownerName ?? lead.ownerPhone}`
                          : (ROUTED_LABEL[lead.routedTo] ?? lead.routedTo))}
                    </span>
                    {/* Which door captured it — matters once feeders are on. */}
                    <span>{lead.vertical}</span>
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
                <div className="panel-card__actions">
                  <a
                    className="panel-btn panel-btn--whatsapp"
                    href={mailReplyHref(lead.email)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {svPanel.contactLead}
                  </a>
                  {waReplyHref(lead.phone) && (
                    <a
                      className="panel-btn"
                      href={waReplyHref(lead.phone)!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WhatsApp
                    </a>
                  )}
                  {/* A particular seller has no inbox of their own (PLAN.md
                      D8), so the lead only reaches them if it is forwarded. */}
                  {forwardHref(lead)}
                </div>
              </div>

              {lead.message ? (
                <div className="panel-card__body">{lead.message}</div>
              ) : null}
            </article>
          ))
        )}
      </main>
    </>
  );
}
