/**
 * Validating an operator-supplied image URL before the public site renders it.
 *
 * `agencies.logo_url` and `agents.photo_url` are free-text columns typed into
 * a form and emitted as a raw `<img src>` on profile pages, listing cards and
 * the homepage. Registration is open, so "any 500-char string" meant a
 * self-registered agency could point every visitor's browser at a host it
 * controls and collect their IP, user-agent and referrer on every page view
 * (audit F30) — no XSS needed, just an `<img>` doing what an `<img>` does.
 *
 * Three layers, weakest to strongest:
 *
 *  1. **https only, and never an address.** http leaks the same data in clear
 *     and trips the CSP's upgrade-insecure-requests; a bare IP or a
 *     loopback/`.local`/`.internal` name is either a probe of our own network
 *     or an attempt to make visitors probe theirs.
 *  2. **`PROFILE_IMAGE_HOSTS`**, an optional comma-separated allowlist. Unset
 *     today because there is no image hosting for these yet — agencies paste a
 *     link to wherever their logo already lives. Set it the day that changes
 *     and this becomes a real allowlist with no code change.
 *  3. **`referrerPolicy="no-referrer"` at the render sites**, so a permitted
 *     third-party host still learns nothing about which page the visitor is on.
 *
 * The complete answer is proxying these through R2 like listing photos, which
 * is blocked on the same missing bucket as everything else in backlog item 1 —
 * so this is the constraint that holds until then, not a substitute for it.
 */

const BLOCKED_HOST = /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i;

function allowedHosts(): string[] {
  return (process.env.PROFILE_IMAGE_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns the URL when it is safe to render, or null. Null means "show the
 * initials placeholder" at every call site — never a broken image.
 */
export function safeImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (value.length === 0 || value.length > 500) return null;

  // A site-relative path is our own asset and needs none of the checks below.
  if (value.startsWith("/") && !value.startsWith("//")) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOST.test(host)) return null;
  // An IP literal is never a legitimate place to host a company logo, and it
  // is the shape both an internal-network probe and a throwaway logger take.
  if (/^[\d.]+$/.test(host) || host.includes(":")) return null;

  const allow = allowedHosts();
  if (allow.length > 0) {
    const ok = allow.some((a) => host === a || host.endsWith(`.${a}`));
    if (!ok) return null;
  }
  return url.toString();
}
