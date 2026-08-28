/**
 * Pre-launch disclosure.
 *
 * The site is publicly reachable before it holds real inventory: the listing
 * rows are seeded samples and the photos are still placeholders. A visitor
 * landing on a polished-looking portal has no way to know that, and a listing
 * that looks like a real offer but isn't is the kind of thing that earns a
 * complaint rather than a lead. Hence a standing notice until real,
 * permissioned inventory is live.
 *
 * Flip `UNDER_CONSTRUCTION` to false (or set
 * `NEXT_PUBLIC_UNDER_CONSTRUCTION=false` in the Hostinger env) on launch day —
 * one line, one deploy, no component to delete. It is a build-time constant,
 * so it needs the redeploy either way.
 */
export const UNDER_CONSTRUCTION =
  process.env.NEXT_PUBLIC_UNDER_CONSTRUCTION !== "false";

/**
 * Paths that are staff/agency surfaces rather than the public portal. The
 * notice is a disclosure to visitors; the people editing listings already know
 * the state of the site, and a permanent strip above every admin screen is
 * just noise. Matched as a prefix against `x-pathname` (set in middleware.ts).
 */
const INTERNAL_PREFIXES = ["/admin", "/agencia"];

export function isInternalPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return INTERNAL_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
