/**
 * Pre-launch disclosure (D6 / launch sequencing).
 *
 * The site is publicly reachable on two domains before it holds real
 * inventory: the listing rows are seeded/imported samples and the photos are
 * still `picsum.photos` placeholders (PLAN.md). A visitor landing on a
 * polished-looking portal has no way to know that, and a listing that looks
 * like a real offer but isn't is the kind of thing that earns a complaint
 * rather than a lead. Hence a standing notice until real, permissioned
 * inventory is live.
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

/**
 * Whether self-service agency/independent-agent sign-up (`/registro`) is
 * open to the public. Defaults CLOSED: while there is one operator and no
 * outside agency has been onboarded, an open sign-up form is an unmoderated
 * front door into `/agencia` for nobody the founder has vetted.
 *
 * Closing this does NOT touch invite-based sign-up — `/agencia/equipo`
 * invites (a colleague joining an *existing* agency, via a single-use
 * token minted by an agency_admin) still work while this is closed, because
 * that path is already permissioned: the token is the credential, not an
 * open form. Only new, unaffiliated "agency" and "independent" accounts are
 * refused.
 *
 * Flip `NEXT_PUBLIC_AGENCY_SIGNUPS_OPEN=true` in the Hostinger env when
 * ready to open the marketplace to outside agencies — one line, no code
 * change, same pattern as `UNDER_CONSTRUCTION` above.
 */
export const AGENCY_SIGNUPS_OPEN =
  process.env.NEXT_PUBLIC_AGENCY_SIGNUPS_OPEN === "true";
