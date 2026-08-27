import type { Metadata } from "next";
import { PanelBar } from "@/components/panel/PanelBar";
import { requireSuperAdmin } from "@/lib/auth/guards";
import {
  countReviewQueue,
  listAgencies,
  listAgents,
} from "@/lib/panel-queries";
import { svPanel } from "@/i18n/sv";
import { adminTabs } from "../tabs";
import {
  toggleAgencyVerifiedAction,
  toggleAgentVerifiedAction,
} from "../actions";
import { createAgencyAction } from "./actions";

export const metadata: Metadata = {
  title: `Mäklarbyråer och agenter`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function VerifiedPill({ on }: { on: boolean }) {
  return (
    <span className={`panel-verified${on ? "" : " panel-verified--off"}`}>
      {on ? svPanel.verifiedBadge : svPanel.notVerifiedBadge}
    </span>
  );
}

/** Plan values as the founder reads them, not as the enum spells them. */
const PLAN_OPTIONS: { value: "free" | "premium" | "partner"; label: string }[] = [
  { value: "free", label: "Gratis" },
  { value: "premium", label: "Premium" },
  { value: "partner", label: "Partner" },
];

function planLabel(plan: string): string {
  return PLAN_OPTIONS.find((p) => p.value === plan)?.label ?? plan;
}

/** Flash messages keyed by the ?msg= code createAgencyAction redirects with. */
const FLASH: Record<string, { text: string; error?: boolean }> = {
  agency_created: { text: svPanel.agencyCreated },
  invalid: { text: svPanel.agencyInvalid, error: true },
};

export default async function AdminAgenciesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const [{ msg }, user] = await Promise.all([searchParams, requireSuperAdmin()]);
  const [reviewCount, agencies, agents] = await Promise.all([
    countReviewQueue(),
    listAgencies(),
    listAgents(),
  ]);

  const flash = msg ? FLASH[msg] : undefined;

  return (
    <>
      <PanelBar
        title="Panel de administración"
        role={user.role}
        userName={user.name}
        tabs={adminTabs("agencies", reviewCount)}
      />
      <main className="panel site-main">
        {flash ? (
          <p className={flash.error ? "auth-error" : "panel-flash"}>{flash.text}</p>
        ) : null}

        <h2 className="panel-section__title">{svPanel.adminAgencyNewTitle}</h2>
        <article className="panel-card">
          <p className="panel-card__meta">{svPanel.adminAgencyNewHint}</p>
          <form action={createAgencyAction} className="panel-form">
            <label className="panel-form__field">
              <span className="auth-field__label">{svPanel.agencyNameLabel}</span>
              <input
                className="auth-field__input"
                name="name"
                type="text"
                required
                minLength={2}
              />
            </label>
            <label className="panel-form__field">
              <span className="auth-field__label">{svPanel.agencyEmailLabel}</span>
              <input className="auth-field__input" name="email" type="email" />
            </label>
            <label className="panel-form__field">
              <span className="auth-field__label">{svPanel.agencyWhatsappLabel}</span>
              <input className="auth-field__input" name="phone" type="tel" />
            </label>
            <label className="panel-form__field">
              <span className="auth-field__label">{svPanel.planLabel}</span>
              <select className="panel-select" name="plan" defaultValue="free">
                {PLAN_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="panel-form__field panel-form__field--action">
              <button className="panel-btn panel-btn--primary" type="submit">
                {svPanel.createAgency}
              </button>
            </div>
          </form>
        </article>

        <h2 className="panel-section__title" style={{ marginTop: 32 }}>
          {svPanel.adminAgenciesTitle}
        </h2>
        {agencies.length === 0 ? (
          <p className="panel-empty">{svPanel.adminAgenciesEmpty}</p>
        ) : (
          <div className="panel-table__wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>{svPanel.colName}</th>
                  <th>{svPanel.colPlan}</th>
                  <th>{svPanel.colContact}</th>
                  <th>{svPanel.colStatus}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {agencies.map((a) => (
                  <tr key={a.id}>
                    <td className="panel-table__name">{a.name}</td>
                    <td>{planLabel(a.plan)}</td>
                    <td>{a.phone ?? a.email ?? "—"}</td>
                    <td>
                      <VerifiedPill on={a.isVerified} />
                    </td>
                    <td>
                      <form action={toggleAgencyVerifiedAction}>
                        <input type="hidden" name="agencyId" value={a.id} />
                        <input
                          type="hidden"
                          name="verified"
                          value={a.isVerified ? "0" : "1"}
                        />
                        <button className="panel-btn" type="submit">
                          {a.isVerified ? svPanel.unverify : svPanel.verify}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="panel-section__title" style={{ marginTop: 32 }}>
          {svPanel.adminAgentsTitle}
        </h2>
        {agents.length === 0 ? (
          <p className="panel-empty">{svPanel.adminAgentsEmpty}</p>
        ) : (
          <div className="panel-table__wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>{svPanel.colName}</th>
                  <th>{svPanel.colAgency}</th>
                  <th>{svPanel.colContact}</th>
                  <th>{svPanel.colStatus}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id}>
                    <td className="panel-table__name">{a.name}</td>
                    <td>{a.agencyName ?? svPanel.adminIndependentAgent}</td>
                    <td>{a.phone ?? "—"}</td>
                    <td>
                      <VerifiedPill on={a.isVerified} />
                    </td>
                    <td>
                      <form action={toggleAgentVerifiedAction}>
                        <input type="hidden" name="agentId" value={a.id} />
                        <input
                          type="hidden"
                          name="verified"
                          value={a.isVerified ? "0" : "1"}
                        />
                        <button className="panel-btn" type="submit">
                          {a.isVerified ? svPanel.unverify : svPanel.verify}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
