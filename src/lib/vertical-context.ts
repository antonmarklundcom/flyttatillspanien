import { headers } from "next/headers";
import { VERTICALS, resolveVertical, type VerticalConfig } from "@/config/verticals";
import { rawHostFrom } from "./host";

/**
 * Read the vertical the middleware resolved for this request.
 *
 * Without the header, fall back to the Host header — and only then to
 * `resolveVertical(null)`, the CANONICAL_HOST entry. The middleware matcher
 * deliberately excludes `/sitemap.xml` and `/robots.txt`, so on exactly the
 * two routes whose whole job is to speak for one domain, `x-vertical` is
 * absent; reading the host there is what stops them describing the primary's
 * listing set to a feeder's crawler. `origin.ts` resolves those same routes
 * from the host for the same reason, so the two now agree by construction.
 */
export async function currentVertical(): Promise<VerticalConfig> {
  const h = await headers();
  const key = h.get("x-vertical");
  const v = key
    ? Object.values(VERTICALS).find((v) => v.key === key)
    : undefined;
  return v ?? resolveVertical(rawHostFrom(h));
}
