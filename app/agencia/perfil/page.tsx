import type { Metadata } from "next";
import { PanelBar } from "@/components/panel/PanelBar";
import { canManageTeam, requireAgencyContext } from "@/lib/auth/guards";
import {
  getAgencyProfile,
  getOwnAgentProfile,
} from "@/lib/profile-queries";
import { BRAND_NAME } from "@/lib/brand";
import { esPanel } from "@/i18n/es";
import { agencyTabs } from "../tabs";
import {
  updateAccountAction,
  updateAgencyProfileAction,
  updateAgentProfileAction,
} from "./actions";

export const metadata: Metadata = {
  title: `Tu perfil`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const FLASH: Record<string, { text: string; error?: boolean }> = {
  saved: { text: esPanel.profileSaved },
  agency_saved: { text: esPanel.profileAgencySaved },
  account_saved: { text: esPanel.profileAccountSaved },
  password: { text: esPanel.profilePasswordChanged },
  taken: { text: esPanel.profileEmailTaken, error: true },
  invalid: { text: esPanel.profileInvalid, error: true },
  bad_password: { text: esPanel.profileBadPassword, error: true },
  forbidden: { text: esPanel.profileForbidden, error: true },
};

function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span
      className={`panel-profile__badge${verified ? "" : " panel-profile__badge--pending"}`}
    >
      {verified ? esPanel.profileVerifiedNote(BRAND_NAME) : esPanel.profilePendingNote}
    </span>
  );
}

export default async function AgencyProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const [{ msg }, ctx] = await Promise.all([
    searchParams,
    requireAgencyContext(),
  ]);

  const [agency, agent] = await Promise.all([
    ctx.agencyId != null ? getAgencyProfile(ctx.agencyId) : null,
    getOwnAgentProfile(ctx.user.id),
  ]);

  const flash = msg ? FLASH[msg] : undefined;
  const canEditAgency = ctx.user.role === "agency_admin";

  return (
    <>
      <PanelBar
        title="Panel de la inmobiliaria"
        role={ctx.user.role}
        userName={ctx.user.name}
        tabs={agencyTabs("profile", canManageTeam(ctx))}
      />
      <main className="panel site-main">
        {flash ? (
          <p className={flash.error ? "auth-error" : "panel-flash"}>
            {flash.text}
          </p>
        ) : null}

        <div className="panel-profile">
          {/* The company record — agency-admin only. */}
          <article className="panel-card">
            <h2 style={{ fontSize: 18, margin: "0 0 .5rem" }}>
              {esPanel.profileAgencyTitle}
            </h2>

            {agency == null ? (
              <p style={{ color: "#55655F", margin: 0 }}>
                {esPanel.profileNoAgency}
              </p>
            ) : (
              <>
                <p style={{ margin: "0 0 1rem" }}>
                  <VerifiedBadge verified={agency.isVerified} />
                </p>

                {!canEditAgency && (
                  <p style={{ color: "#55655F", fontSize: 13 }}>
                    {esPanel.profileAgencyReadOnly}
                  </p>
                )}

                <form action={updateAgencyProfileAction} className="panel-form">
                  <label
                    className="panel-form__field"
                    style={{ flexBasis: "100%" }}
                  >
                    <span className="auth-field__label">
                      {esPanel.nameLabel}
                    </span>
                    <input
                      className="auth-field__input"
                      name="name"
                      type="text"
                      defaultValue={agency.name}
                      maxLength={160}
                      required
                      disabled={!canEditAgency}
                    />
                  </label>

                  <label className="panel-form__field">
                    <span className="auth-field__label">
                      {esPanel.profileWhatsappLabel}
                    </span>
                    <input
                      className="auth-field__input"
                      name="whatsapp"
                      type="tel"
                      inputMode="tel"
                      defaultValue={agency.whatsapp ?? ""}
                      maxLength={30}
                      disabled={!canEditAgency}
                    />
                  </label>

                  <label className="panel-form__field">
                    <span className="auth-field__label">
                      {esPanel.profileEmailLabel}
                    </span>
                    <input
                      className="auth-field__input"
                      name="email"
                      type="email"
                      defaultValue={agency.email ?? ""}
                      maxLength={190}
                      disabled={!canEditAgency}
                    />
                  </label>

                  <label
                    className="panel-form__field"
                    style={{ flexBasis: "100%" }}
                  >
                    <span className="auth-field__label">
                      {esPanel.profileLogoLabel}
                    </span>
                    <input
                      className="auth-field__input"
                      name="logoUrl"
                      type="url"
                      defaultValue={agency.logoUrl ?? ""}
                      maxLength={500}
                      placeholder="https://…"
                      disabled={!canEditAgency}
                    />
                  </label>

                  {canEditAgency && (
                    <button
                      className="panel-btn panel-btn--primary"
                      type="submit"
                    >
                      {esPanel.profileSave}
                    </button>
                  )}
                </form>
              </>
            )}
          </article>

          {/* The caller's own public agent profile. */}
          {agent && (
            <article className="panel-card">
              <h2 style={{ fontSize: 18, margin: "0 0 .5rem" }}>
                {esPanel.profileAgentTitle}
              </h2>
              <p style={{ margin: "0 0 1rem" }}>
                <VerifiedBadge verified={agent.isVerified} />
              </p>

              <form action={updateAgentProfileAction} className="panel-form">
                <label
                  className="panel-form__field"
                  style={{ flexBasis: "100%" }}
                >
                  <span className="auth-field__label">{esPanel.nameLabel}</span>
                  <input
                    className="auth-field__input"
                    name="name"
                    type="text"
                    defaultValue={agent.name}
                    maxLength={140}
                    required
                  />
                </label>

                <label className="panel-form__field">
                  <span className="auth-field__label">
                    {esPanel.profileWhatsappLabel}
                  </span>
                  <input
                    className="auth-field__input"
                    name="whatsapp"
                    type="tel"
                    inputMode="tel"
                    defaultValue={agent.whatsapp ?? ""}
                    maxLength={30}
                  />
                </label>

                <label
                  className="panel-form__field"
                  style={{ flexBasis: "100%" }}
                >
                  <span className="auth-field__label">
                    {esPanel.profilePhotoLabel}
                  </span>
                  <input
                    className="auth-field__input"
                    name="photoUrl"
                    type="url"
                    defaultValue={agent.photoUrl ?? ""}
                    maxLength={500}
                    placeholder="https://…"
                  />
                </label>

                <button className="panel-btn panel-btn--primary" type="submit">
                  {esPanel.profileSave}
                </button>
              </form>
            </article>
          )}

          {/* The login itself. */}
          <article className="panel-card">
            <h2 style={{ fontSize: 18, margin: "0 0 1rem" }}>
              {esPanel.profileAccountTitle}
            </h2>

            <form action={updateAccountAction} className="panel-form">
              <label className="panel-form__field">
                <span className="auth-field__label">{esPanel.nameLabel}</span>
                <input
                  className="auth-field__input"
                  name="name"
                  type="text"
                  defaultValue={ctx.user.name ?? ""}
                  maxLength={140}
                  required
                />
              </label>

              <label className="panel-form__field">
                <span className="auth-field__label">{esPanel.emailLabel}</span>
                <input
                  className="auth-field__input"
                  name="email"
                  type="email"
                  defaultValue={ctx.user.email ?? ""}
                  maxLength={190}
                  required
                />
              </label>

              <label className="panel-form__field">
                <span className="auth-field__label">
                  {esPanel.newPasswordLabel}
                </span>
                <input
                  className="auth-field__input"
                  name="password"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                />
                <span className="auth-field__hint">
                  {esPanel.newPasswordHint}
                </span>
              </label>

              {/* Re-auth (audit F21). Not `required`: the name can be edited on
                  its own, and the server is what decides whether this field
                  was needed — the form is not the gate. */}
              <label className="panel-form__field">
                <span className="auth-field__label">
                  {esPanel.currentPasswordLabel}
                </span>
                <input
                  className="auth-field__input"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                />
                <span className="auth-field__hint">
                  {esPanel.currentPasswordHint}
                </span>
              </label>

              <button className="panel-btn panel-btn--primary" type="submit">
                {esPanel.profileSave}
              </button>
            </form>
          </article>
        </div>
      </main>
    </>
  );
}
