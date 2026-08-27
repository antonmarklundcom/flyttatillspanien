import type { Metadata } from "next";
import { PanelBar } from "@/components/panel/PanelBar";
import { requireSuperAdmin } from "@/lib/auth/guards";
import {
  countReviewQueue,
  listAgencies,
  listUsers,
  type PanelUserRow,
} from "@/lib/panel-queries";
import { esPanel } from "@/i18n/es";
import { roleLabel } from "@/lib/auth/roles";
import { adminTabs } from "../tabs";
import {
  createUserAction,
  deleteUserAction,
  linkAgencyAction,
  updateUserAction,
} from "./actions";

export const metadata: Metadata = {
  title: `Usuarios`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Roles offered in the picker, in ascending order of privilege. */
const ROLE_OPTIONS = [
  "consumer",
  "agent",
  "agency_admin",
  "developer",
  "admin",
] as const;

/** Flash messages keyed by the ?msg= code the actions redirect with. */
const FLASH: Record<string, { text: string; error?: boolean }> = {
  created: { text: esPanel.userCreated },
  saved: { text: esPanel.userSaved },
  deleted: { text: esPanel.userDeleted },
  password_reset: { text: esPanel.userPasswordReset },
  agency_linked: { text: esPanel.userAgencyLinked },
  email_taken: { text: esPanel.userEmailTaken, error: true },
  self_role: { text: esPanel.userSelfRoleError, error: true },
  self_delete: { text: esPanel.userSelfDeleteError, error: true },
  last_admin: { text: esPanel.userLastAdminError, error: true },
  invalid: { text: esPanel.loginError, error: true },
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const [{ msg }, user] = await Promise.all([searchParams, requireSuperAdmin()]);
  const [reviewCount, agencies, rows] = await Promise.all([
    countReviewQueue(),
    listAgencies(),
    listUsers(),
  ]);

  const flash = msg ? FLASH[msg] : undefined;
  const agencyOptions = agencies.map((a) => ({ id: a.id, name: a.name }));

  return (
    <>
      <PanelBar
        title="Panel de administración"
        role={user.role}
        userName={user.name}
        tabs={adminTabs("users", reviewCount)}
      />
      <main className="panel site-main">
        {flash ? (
          <p className={flash.error ? "auth-error" : "panel-flash"}>{flash.text}</p>
        ) : null}

        <h2 className="panel-section__title">{esPanel.adminUsersNewTitle}</h2>
        <article className="panel-card">
          <form action={createUserAction} className="panel-form">
            <label className="panel-form__field">
              <span className="auth-field__label">{esPanel.nameLabel}</span>
              <input className="auth-field__input" name="name" type="text" />
            </label>
            <label className="panel-form__field">
              <span className="auth-field__label">{esPanel.emailLabel}</span>
              <input
                className="auth-field__input"
                name="email"
                type="email"
                required
              />
            </label>
            <label className="panel-form__field">
              <span className="auth-field__label">{esPanel.passwordLabel}</span>
              <input
                className="auth-field__input"
                name="password"
                type="text"
                autoComplete="off"
                required
              />
            </label>
            <label className="panel-form__field">
              <span className="auth-field__label">{esPanel.roleLabel}</span>
              <select className="panel-select" name="role" defaultValue="agency_admin">
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </label>
            <label className="panel-form__field">
              <span className="auth-field__label">{esPanel.localeLabel}</span>
              <select className="panel-select" name="locale" defaultValue="es">
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </label>
            <div className="panel-form__field panel-form__field--action">
              <button className="panel-btn panel-btn--primary" type="submit">
                {esPanel.createUser}
              </button>
            </div>
          </form>
        </article>

        <h2 className="panel-section__title" style={{ marginTop: 32 }}>
          {esPanel.adminUsersListTitle}
        </h2>

        {rows.length === 0 ? (
          <p className="panel-empty">{esPanel.adminUsersEmpty}</p>
        ) : (
          rows.map((row) => (
            <UserCard
              key={row.id}
              row={row}
              isSelf={row.id === user.id}
              agencies={agencyOptions}
            />
          ))
        )}
      </main>
    </>
  );
}

function UserCard({
  row,
  isSelf,
  agencies,
}: {
  row: PanelUserRow;
  isSelf: boolean;
  agencies: { id: number; name: string }[];
}) {
  return (
    <article className="panel-card">
      <div className="panel-card__head">
        <div>
          <h3 className="panel-card__title">{row.name ?? row.email ?? `#${row.id}`}</h3>
          <div className="panel-card__meta">
            <span>{row.email ?? "—"}</span>
            <span>{roleLabel(row.role)}</span>
            <span>{row.agencyName ?? esPanel.agencyNone}</span>
            {row.hasPassword ? null : <span>{esPanel.noPasswordBadge}</span>}
            {isSelf ? <span>· vos</span> : null}
          </div>
        </div>
      </div>

      <div className="panel-card__body">
        <form action={updateUserAction} className="panel-form">
          <input type="hidden" name="userId" value={row.id} />
          <label className="panel-form__field">
            <span className="auth-field__label">{esPanel.nameLabel}</span>
            <input
              className="auth-field__input"
              name="name"
              type="text"
              defaultValue={row.name ?? ""}
            />
          </label>
          <label className="panel-form__field">
            <span className="auth-field__label">{esPanel.emailLabel}</span>
            <input
              className="auth-field__input"
              name="email"
              type="email"
              defaultValue={row.email ?? ""}
              required
            />
          </label>
          <label className="panel-form__field">
            <span className="auth-field__label">{esPanel.newPasswordLabel}</span>
            <input
              className="auth-field__input"
              name="password"
              type="text"
              autoComplete="off"
              placeholder={esPanel.newPasswordHint}
            />
          </label>
          <label className="panel-form__field">
            <span className="auth-field__label">{esPanel.roleLabel}</span>
            <select className="panel-select" name="role" defaultValue={row.role}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </label>
          <label className="panel-form__field">
            <span className="auth-field__label">{esPanel.localeLabel}</span>
            <select className="panel-select" name="locale" defaultValue={row.locale}>
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </label>
          <div className="panel-form__field panel-form__field--action">
            <button className="panel-btn panel-btn--primary" type="submit">
              {esPanel.saveUser}
            </button>
          </div>
        </form>

        <div className="panel-actions">
          <form action={linkAgencyAction} className="panel-form">
            <input type="hidden" name="userId" value={row.id} />
            <input type="hidden" name="name" value={row.name ?? ""} />
            <input type="hidden" name="email" value={row.email ?? ""} />
            <label className="panel-form__field">
              <span className="auth-field__label">{esPanel.agencyLabel}</span>
              <select
                className="panel-select"
                name="agencyId"
                defaultValue={row.agencyId ? String(row.agencyId) : ""}
              >
                <option value="">{esPanel.agencyNone}</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="panel-form__field panel-form__field--action">
              <button className="panel-btn" type="submit">
                {esPanel.linkAgency}
              </button>
            </div>
          </form>

          {isSelf ? null : (
            <details>
              <summary className="panel-btn panel-btn--danger">
                {esPanel.deleteUser}
              </summary>
              <form action={deleteUserAction} className="panel-reject">
                <input type="hidden" name="userId" value={row.id} />
                <input type="hidden" name="role" value={row.role} />
                <button className="panel-btn panel-btn--danger" type="submit">
                  {esPanel.deleteUser}
                </button>
              </form>
            </details>
          )}
        </div>
      </div>
    </article>
  );
}
