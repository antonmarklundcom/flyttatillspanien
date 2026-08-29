import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PanelBar } from "@/components/panel/PanelBar";
import { requireAgencyContext } from "@/lib/auth/guards";
import { svPanel } from "@/i18n/sv";
import {
  invitePath,
  listAgencyInvites,
  INVITE_TTL_DAYS,
  type AgencyInviteRow,
} from "@/lib/agency-invites";
import { listAgencyTeam, type TeamMember } from "@/lib/team-queries";
import { agencyTabs } from "../tabs";
import {
  createInviteAction,
  removeMemberAction,
  revokeInviteAction,
  setMemberRoleAction,
} from "./actions";

export const metadata: Metadata = {
  title: `Tu equipo`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const FLASH: Record<string, { text: string; error?: boolean }> = {
  invite_created: { text: svPanel.teamInviteCreated },
  invite_revoked: { text: svPanel.teamInviteRevoked },
  role_saved: { text: svPanel.teamRoleSaved },
  member_removed: { text: svPanel.teamMemberRemoved },
  joined: { text: svPanel.teamJoined },
  last_admin: { text: svPanel.teamLastAdminError, error: true },
  self_role: { text: svPanel.teamSelfRoleError, error: true },
  self_remove: { text: svPanel.teamSelfRemoveError, error: true },
  forbidden: { text: svPanel.profileForbidden, error: true },
  invalid: { text: svPanel.profileInvalid, error: true },
};

/**
 * The origin to paste into WhatsApp — taken from the request, not from
 * siteOrigin().
 *
 * siteOrigin() answers "which domain owns this page for SEO" and falls back to
 * PRIMARY_ORIGIN (= CANONICAL_HOST) for any host that is not an enabled
 * vertical — including preview deploys and *.hostingersite.com, which is not
 * where the founder is actually looking (CLAUDE.md, "Domains"). An invite link
 * has to open in a browser, so it is built from the request's own host.
 */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "")
    .split(",")[0]
    .trim();
  if (!host) return "";
  const proto =
    (h.get("x-forwarded-proto") ?? "").split(",")[0].trim() ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  return `${proto}://${host}`;
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function roleName(role: string | null): string {
  if (role === "agency_admin") return svPanel.teamRoleAdmin;
  if (role === "agent") return svPanel.teamRoleAgent;
  return svPanel.teamRoleNoLogin;
}

export default async function AgencyTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const [{ msg }, ctx] = await Promise.all([
    searchParams,
    requireAgencyContext(),
  ]);

  // Team management belongs to the responsable. An agent — or an independent
  // account with no agency at all — has nothing to manage here.
  if (ctx.user.role !== "agency_admin" || ctx.agencyId == null) {
    redirect("/agencia");
  }

  const [team, invites, origin] = await Promise.all([
    listAgencyTeam(ctx.agencyId),
    listAgencyInvites(ctx.agencyId),
    requestOrigin(),
  ]);

  const flash = msg ? FLASH[msg] : undefined;
  const openInvites = invites.filter(
    (i) => i.usedAt == null && i.expiresAt.getTime() > Date.now(),
  );
  const adminCount = team.filter((m) => m.role === "agency_admin").length;

  return (
    <>
      <PanelBar
        title="Panel de la inmobiliaria"
        role={ctx.user.role}
        userName={ctx.user.name}
        tabs={agencyTabs("team", true)}
      />
      <main className="panel site-main">
        {flash ? (
          <p className={flash.error ? "auth-error" : "panel-flash"}>
            {flash.text}
          </p>
        ) : null}

        <h2 className="panel-section__title">{svPanel.teamInviteTitle}</h2>
        <article className="panel-card">
          <p className="panel-card__meta">
            {svPanel.teamInviteHint(INVITE_TTL_DAYS)}
          </p>
          <form action={createInviteAction} className="panel-form">
            <label className="panel-form__field">
              <span className="auth-field__label">{svPanel.teamRoleLabel}</span>
              <select className="panel-select" name="role" defaultValue="agent">
                <option value="agent">{svPanel.teamRoleAgent}</option>
                <option value="agency_admin">{svPanel.teamRoleAdmin}</option>
              </select>
            </label>
            <div className="panel-form__field panel-form__field--action">
              <button className="panel-btn panel-btn--primary" type="submit">
                {svPanel.teamInviteCreate}
              </button>
            </div>
          </form>

          {openInvites.length === 0 ? (
            <p className="panel-card__meta">{svPanel.teamInvitesEmpty}</p>
          ) : (
            openInvites.map((invite) => (
              <InviteRow key={invite.id} invite={invite} origin={origin} />
            ))
          )}
        </article>

        <h2 className="panel-section__title" style={{ marginTop: 32 }}>
          {svPanel.teamTitle}
        </h2>
        <p className="panel-card__meta">{svPanel.teamHint}</p>

        {team.length === 0 ? (
          <p className="panel-empty">{svPanel.teamEmpty}</p>
        ) : (
          <div className="panel-table__wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>{svPanel.nameLabel}</th>
                  <th>{svPanel.emailLabel}</th>
                  <th>{svPanel.teamRoleLabel}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {team.map((member) => (
                  <MemberRow
                    key={member.agentId}
                    member={member}
                    isSelf={member.userId === ctx.user.id}
                    onlyAdmin={
                      member.role === "agency_admin" && adminCount <= 1
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}

function InviteRow({
  invite,
  origin,
}: {
  invite: AgencyInviteRow;
  origin: string;
}) {
  const url = `${origin}${invitePath(invite.token)}`;
  return (
    <div className="panel-form" style={{ alignItems: "flex-end" }}>
      <label className="panel-form__field" style={{ flexBasis: "100%" }}>
        <span className="auth-field__label">
          {svPanel.teamInviteUrlLabel(
            invite.role === "agency_admin"
              ? svPanel.teamRoleAdmin
              : svPanel.teamRoleAgent,
            fmtDate(invite.expiresAt),
          )}
        </span>
        {/* Read-only so the link can be selected and copied without a client
            component — the panel has no client JS anywhere else either. */}
        <input className="auth-field__input" type="text" value={url} readOnly />
      </label>
      <div className="panel-form__field panel-form__field--action">
        <form action={revokeInviteAction}>
          <input type="hidden" name="inviteId" value={invite.id} />
          <button className="panel-btn" type="submit">
            {svPanel.teamInviteRevoke}
          </button>
        </form>
      </div>
    </div>
  );
}

function MemberRow({
  member,
  isSelf,
  onlyAdmin,
}: {
  member: TeamMember;
  isSelf: boolean;
  onlyAdmin: boolean;
}) {
  const isAdmin = member.role === "agency_admin";
  // No login attached (an imported profile) — there is no users.role to move,
  // and no account to detach; the founder handles those from /admin.
  const manageable = member.userId != null && member.role !== "admin";

  return (
    <tr>
      <td className="panel-table__name">
        {member.name}
        {isSelf ? <span className="panel-card__meta"> · vos</span> : null}
      </td>
      <td>{member.email ?? "—"}</td>
      <td>{roleName(member.role)}</td>
      <td>
        {!manageable ? (
          <span className="panel-card__meta">{svPanel.teamNoLoginHint}</span>
        ) : (
          <div className="panel-actions">
            {isSelf ? null : (
              <form action={setMemberRoleAction}>
                <input type="hidden" name="userId" value={member.userId!} />
                <input
                  type="hidden"
                  name="role"
                  value={isAdmin ? "agent" : "agency_admin"}
                />
                <button className="panel-btn" type="submit" disabled={onlyAdmin}>
                  {isAdmin ? svPanel.teamDemote : svPanel.teamPromote}
                </button>
              </form>
            )}

            {isSelf || onlyAdmin ? null : (
              <details>
                <summary className="panel-btn panel-btn--danger">
                  {svPanel.teamRemove}
                </summary>
                <form action={removeMemberAction} className="panel-reject">
                  <p className="panel-card__meta">{svPanel.teamRemoveWarning}</p>
                  <input type="hidden" name="userId" value={member.userId!} />
                  <button className="panel-btn panel-btn--danger" type="submit">
                    {svPanel.teamRemoveConfirm}
                  </button>
                </form>
              </details>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
