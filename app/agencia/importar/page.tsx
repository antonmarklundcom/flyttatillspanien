import type { Metadata } from "next";
import { PanelBar } from "@/components/panel/PanelBar";
import { ImportByUrl } from "@/components/panel/ImportByUrl";
import { canManageTeam, requireAgencyContext } from "@/lib/auth/guards";
import { listPublishLocations } from "@/lib/publish-queries";
import { esPanel } from "@/i18n/es";
import { agencyTabs } from "../tabs";
import { confirmImportAction, readListingUrlAction } from "./actions";

export const metadata: Metadata = {
  title: `Importar aviso`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const FLASH: Record<string, { text: string; error?: boolean }> = {
  ownership: { text: esPanel.importOwnershipRequired, error: true },
  invalid: { text: esPanel.profileInvalid, error: true },
  duplicate: { text: esPanel.importDuplicateFlash, error: true },
};

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const [{ msg }, ctx] = await Promise.all([
    searchParams,
    requireAgencyContext(),
  ]);
  const locations = await listPublishLocations();
  const flash = msg ? FLASH[msg] : undefined;

  return (
    <>
      <PanelBar
        title="Panel de la inmobiliaria"
        role={ctx.user.role}
        userName={ctx.user.name}
        tabs={agencyTabs("import", canManageTeam(ctx))}
      />
      <main className="panel site-main">
        <h2 className="panel-section__title">{esPanel.importTitle}</h2>
        <p style={{ color: "#55655F", fontSize: 14, marginTop: 0 }}>
          {esPanel.importSubtitle}
        </p>

        {flash ? (
          <p className={flash.error ? "auth-error" : "panel-flash"}>
            {flash.text}
          </p>
        ) : null}

        <ImportByUrl
          locations={locations}
          readAction={readListingUrlAction}
          confirmAction={confirmImportAction}
        />
      </main>
    </>
  );
}
