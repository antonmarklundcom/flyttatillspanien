import type { Metadata } from "next";
import { PanelBar } from "@/components/panel/PanelBar";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { countReviewQueue } from "@/lib/panel-queries";
import {
  listAgenciesWithAdminCount,
  listAgentsWithAgency,
  type AdminAgentRow,
  type AgencyAdminCount,
} from "@/lib/team-queries";
import { svPanel } from "@/i18n/sv";
import { adminTabs } from "../tabs";
import { moveAgentAction } from "./actions";

export const metadata: Metadata = {
  title: `Agentes`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const FLASH: Record<string, { text: string; error?: boolean }> = {
  agent_moved: { text: svPanel.adminAgentMoved },
  last_admin: { text: svPanel.adminAgentLastAdminError, error: true },
  protected: { text: svPanel.adminAgentProtectedError, error: true },
  invalid: { text: svPanel.profileInvalid, error: true },
};

function roleName(role: string | null): string {
  if (role === "agency_admin") return svPanel.teamRoleAdmin;
  if (role === "agent") return svPanel.teamRoleAgent;
  if (role === "admin") return svPanel.teamRoleSuperAdmin;
  return svPanel.teamRoleNoLogin;
}

/**
 * Move agents between inmobiliarias, or set them loose as independents.
 *
 * The founder's counterpart to /agencia/equipo: an agency's responsable manages
 * their own team, this page fixes the cases they can't — an agent who joined the
 * wrong company, an inmobiliaria that split, a profile imported before its
 * owner had a login.
 */
export default async function AdminAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const [{ msg }, user] = await Promise.all([searchParams, requireSuperAdmin()]);
  const [reviewCount, agents, agencies] = await Promise.all([
    countReviewQueue(),
    listAgentsWithAgency(),
    listAgenciesWithAdminCount(),
  ]);

  const flash = msg ? FLASH[msg] : undefined;
  const orphanAgencies = agencies.filter((a) => a.adminCount === 0);

  return (
    <>
      <PanelBar
        title="Panel de administración"
        role={user.role}
        userName={user.name}
        tabs={adminTabs("agents", reviewCount)}
      />
      <main className="panel site-main">
        {flash ? (
          <p className={flash.error ? "auth-error" : "panel-flash"}>
            {flash.text}
          </p>
        ) : null}

        <h2 className="panel-section__title">{svPanel.adminAgentsTitle}</h2>
        <p className="panel-card__meta">{svPanel.adminAgentsHint}</p>

        {/* Never silently invent a responsable when an agent is moved in —
            name the agencies that have none and let the founder decide. */}
        {orphanAgencies.length > 0 ? (
          <p className="auth-error">
            {svPanel.adminAgenciesWithoutAdmin(
              orphanAgencies.map((a) => a.name).join(", "),
            )}
          </p>
        ) : null}

        {agents.length === 0 ? (
          <p className="panel-empty">{svPanel.adminAgentsEmpty}</p>
        ) : (
          agents.map((agent) => (
            <AgentCard key={agent.agentId} agent={agent} agencies={agencies} />
          ))
        )}
      </main>
    </>
  );
}

function AgentCard({
  agent,
  agencies,
}: {
  agent: AdminAgentRow;
  agencies: AgencyAdminCount[];
}) {
  // A super-admin's own agents row is listed for completeness but never
  // re-roled from here (moveAgentToAgency refuses it too).
  const isSuperAdmin = agent.role === "admin";

  return (
    <article className="panel-card">
      <div className="panel-card__head">
        <div>
          <h3 className="panel-card__title">{agent.name}</h3>
          <div className="panel-card__meta">
            <span>{agent.email ?? svPanel.teamRoleNoLogin}</span>
            <span>{agent.agencyName ?? svPanel.agencyNone}</span>
            <span>{roleName(agent.role)}</span>
            {agent.phone ? <span>{agent.phone}</span> : null}
          </div>
        </div>
      </div>

      <div className="panel-card__body">
        {isSuperAdmin ? (
          <p className="panel-card__meta">{svPanel.adminAgentProtectedHint}</p>
        ) : (
          <form action={moveAgentAction} className="panel-form">
            <input type="hidden" name="agentId" value={agent.agentId} />
            <label className="panel-form__field">
              <span className="auth-field__label">{svPanel.agencyLabel}</span>
              <select
                className="panel-select"
                name="agencyId"
                defaultValue={agent.agencyId ? String(agent.agencyId) : ""}
              >
                <option value="">{svPanel.agencyNone}</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.adminCount === 0
                      ? svPanel.adminAgencyNoAdminOption(a.name)
                      : a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="panel-form__field">
              <span className="auth-field__label">{svPanel.teamRoleLabel}</span>
              <select
                className="panel-select"
                name="role"
                defaultValue={agent.role === "agency_admin" ? "agency_admin" : "agent"}
              >
                <option value="agent">{svPanel.teamRoleAgent}</option>
                <option value="agency_admin">{svPanel.teamRoleAdmin}</option>
              </select>
            </label>
            <div className="panel-form__field panel-form__field--action">
              <button className="panel-btn panel-btn--primary" type="submit">
                {svPanel.adminAgentMove}
              </button>
            </div>
            {agent.userId == null ? (
              <p className="panel-card__meta" style={{ flexBasis: "100%" }}>
                {svPanel.adminAgentNoLoginHint}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </article>
  );
}
