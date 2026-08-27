import type { PanelTab } from "@/components/panel/PanelBar";
import { esOwner } from "@/i18n/es";

/**
 * The /mis-avisos tabs. Deliberately two: a private seller has no team, no
 * import and no agency profile — offering those would be offering a
 * professional's panel to somebody selling one house (PLAN.md D8).
 */
export function ownerTabs(active: "listings" | "leads"): PanelTab[] {
  return [
    {
      href: "/mis-avisos",
      label: esOwner.listingsTab,
      active: active === "listings",
    },
    {
      href: "/mis-avisos/consultas",
      label: esOwner.leadsTab,
      active: active === "leads",
    },
  ];
}
