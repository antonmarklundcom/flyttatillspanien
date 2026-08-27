/**
 * WhatsApp click-to-chat links. wa.me only accepts a full international
 * number (E.164 digits, no leading 0, no symbols) — a locally typed
 * "0981 234 567" stripped to digits produces a dead wa.me/0981234567.
 * Every wa.me href in the app is built here so the +595 normalisation
 * lives in exactly one place. Pure module: imported by client components
 * (ContactForm) and server pages alike.
 */

/** Paraguay country calling code — the default when a number has none. */
const DEFAULT_COUNTRY_CODE = "595";

/**
 * Normalise a phone as typed/stored into wa.me digits, e.g.
 * "0981 234-567" → "595981234567". Returns null when there are no digits
 * to work with. Numbers already carrying 595 (with or without +/00) pass
 * through unchanged.
 */
export function waPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith(DEFAULT_COUNTRY_CODE)) return d;
  d = d.replace(/^0+/, "");
  if (!d) return null;
  return DEFAULT_COUNTRY_CODE + d;
}

/** wa.me deep link, optionally with a prefilled message. Null when the
 * phone is empty/unusable — callers gate rendering on the result. */
export function waLink(
  phone: string | null | undefined,
  text?: string,
): string | null {
  const digits = waPhone(phone);
  if (!digits) return null;
  return text
    ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${digits}`;
}
