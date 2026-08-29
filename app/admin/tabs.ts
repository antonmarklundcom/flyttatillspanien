import type { PanelTab } from "@/components/panel/PanelBar";
import { svPanel } from "@/i18n/sv";

/**
 * The /admin tabs, with the active one flagged and the review count badged.
 *
 * Two groups, not one list of eight (PanelBar's `group`): the first row is
 * what an operator opens because something arrived — a listing to review, a
 * lead to answer — and the second is the records behind it, edited when
 * something changes rather than every day.
 */
export function adminTabs(
  active:
    | "review"
    | "agencies"
    | "agents"
    | "users"
    | "listings"
    | "leads"
    | "posts"
    | "import",
  reviewCount: number,
  /** Draft count, badged on the editorial tab. Omitted where it isn't loaded. */
  draftPostCount?: number,
  /**
   * Leads from the last 24 h, badged on the Consultas tab. Omitted where it
   * isn't loaded — the badge is a nudge, not a number every screen must pay
   * a query for.
   */
  recentLeadCount?: number,
): PanelTab[] {
  return [
    {
      href: "/admin",
      label: svPanel.adminReviewTitle,
      count: reviewCount,
      active: active === "review",
    },
    {
      href: "/admin/propiedades",
      label: svPanel.adminListingsTitle,
      active: active === "listings",
    },
    {
      href: "/admin/leads",
      label: svPanel.adminLeadsTitle,
      count: recentLeadCount,
      active: active === "leads",
    },
    {
      href: "/admin/guias",
      group: "manage",
      label: "Guías y notas",
      count: draftPostCount,
      active: active === "posts",
    },
    {
      href: "/admin/importar",
      group: "manage",
      label: svPanel.adminImportTitle,
      active: active === "import",
    },
    {
      href: "/admin/inmobiliarias",
      group: "manage",
      label: svPanel.adminAgenciesTitle,
      active: active === "agencies",
    },
    {
      href: "/admin/agentes",
      group: "manage",
      label: svPanel.adminAgentsTitle,
      active: active === "agents",
    },
    {
      href: "/admin/usuarios",
      group: "manage",
      label: svPanel.adminUsersTitle,
      active: active === "users",
    },
  ];
}
