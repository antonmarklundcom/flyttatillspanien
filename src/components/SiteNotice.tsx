import { headers } from "next/headers";
import { UNDER_CONSTRUCTION, isInternalPath } from "@/config/site-status";
import { esSiteNotice } from "@/i18n/es";
import { brandName } from "@/lib/brand-server";

/**
 * Standing pre-launch disclosure, above the header on every public page.
 *
 * Not dismissible on purpose: a visitor who dismisses it and then reads a
 * sample listing as a real offer is exactly the outcome the notice exists to
 * prevent. It costs one strip of vertical space until launch day.
 *
 * `role="status"` rather than `alert` — this is standing context, not a
 * response to something the visitor just did, so it should not interrupt a
 * screen reader mid-sentence.
 */
export async function SiteNotice() {
  if (!UNDER_CONSTRUCTION) return null;
  const pathname = (await headers()).get("x-pathname");
  if (isInternalPath(pathname)) return null;
  const brand = await brandName();

  return (
    <div className="site-notice" role="status">
      <p className="site-notice__inner">
        <strong className="site-notice__label">{esSiteNotice.label}</strong>
        <span>{esSiteNotice.body(brand)}</span>
      </p>
    </div>
  );
}
