/**
 * Deciding whether a detail-page render counts as a view.
 *
 * Two things this exists to prevent:
 *
 * 1. **Inflated numbers.** An owner who sees "420 views" and gets no calls
 *    concludes the portal does not work. If most of those were Googlebot, the
 *    number lied. Known crawlers are excluded, so the figure means people.
 * 2. **Work in the visitor's critical path.** The counter runs after the
 *    response is sent (Next's `after()`), so a slow write never delays a page,
 *    and a failed write is logged-and-forgotten rather than a 500 on a listing
 *    that renders perfectly well.
 */
import "server-only";

/**
 * Substrings that identify a bot in a User-Agent. Deliberately short and
 * lowercase — matching broadly is the safe direction here: counting a human as
 * a bot loses one view, counting a bot as a human corrupts the metric an
 * agency makes decisions on.
 */
const BOT_TOKENS = [
  "bot",
  "crawl",
  "spider",
  "slurp",
  "curl",
  "wget",
  "python-requests",
  "headlesschrome",
  "lighthouse",
  "pagespeed",
  "preview",
  "monitor",
  "uptime",
  "facebookexternalhit",
  "whatsapp",
  "telegram",
  "embedly",
  "semrush",
  "ahrefs",
  "screaming frog",
];

export function isBotUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return true; // no UA at all is not a browser
  const ua = userAgent.toLowerCase();
  return BOT_TOKENS.some((token) => ua.includes(token));
}
