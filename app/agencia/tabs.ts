import type { PanelTab } from "@/components/panel/PanelBar";
import { svPanel } from "@/i18n/sv";

/**
 * The /agencia tabs, active one flagged.
 *
 * `showTeam` is passed by pages that already know the caller is the agency's
 * responsable (`agency_admin` with an agency): an agent inside the agency has
 * no team to manage, and /agencia/equipo bounces them anyway — this only keeps
 * the nav honest about it.
 */
export function agencyTabs(
  active: "listings" | "leads" | "profile" | "import" | "team",
  showTeam = false,
): PanelTab[] {
  return [
    {
      href: "/agencia",
      label: svPanel.agencyListingsTitle,
      active: active === "listings",
    },
    {
      href: "/agencia/importar",
      label: svPanel.importTab,
      active: active === "import",
    },
    {
      href: "/agencia/leads",
      label: svPanel.agencyLeadsTitle,
      active: active === "leads",
    },
    ...(showTeam
      ? [
          {
            href: "/agencia/equipo",
            label: svPanel.teamTab,
            active: active === "team",
          },
        ]
      : []),
    {
      href: "/agencia/perfil",
      label: svPanel.profileTab,
      active: active === "profile",
    },
  ];
}
