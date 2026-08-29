import type { PanelTab } from "@/components/panel/PanelBar";
import { svOwner } from "@/i18n/sv";

/**
 * The /mis-avisos tabs. Deliberately two: a private seller has no team, no
 * import and no agency profile — offering those would be offering a
 * professional's panel to somebody selling one house (PLAN.md D8).
 */
export function ownerTabs(active: "listings" | "leads"): PanelTab[] {
  return [
    {
      href: "/mis-avisos",
      label: svOwner.listingsTab,
      active: active === "listings",
    },
    {
      href: "/mis-avisos/consultas",
      label: svOwner.leadsTab,
      active: active === "leads",
    },
  ];
}
