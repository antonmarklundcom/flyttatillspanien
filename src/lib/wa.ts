/**
 * WhatsApp click-to-chat links.
 *
 * **Whose channel this is.** Not the buyer's — Sweden is email-first, and the
 * lead form is what a Swedish buyer uses (design doc §3.7). Spanish agencies,
 * on the other hand, genuinely live on WhatsApp, so this is the AGENCY-side
 * channel: `agencies.phone`, `agents.phone`, `CONTACT_WHATSAPP`. It is offered
 * as a continuation next to a form, never as the only way to reach anyone.
 *
 * wa.me only accepts a full international number (E.164 digits, no leading 0,
 * no symbols) — a locally typed "952 12 34 56" stripped to digits produces a
 * dead wa.me/952123456. Every wa.me href in the app is built here so the
 * country-code normalisation lives in exactly one place. Pure module: imported
 * by client components (ContactForm) and server pages alike.
 */

/** Spain — the selling agencies. Sweden — the relocation partners. */
const ES = "34";
const SE = "46";

/**
 * Normalise a phone as typed/stored into wa.me digits, e.g.
 * "952 12 34 56" → "34952123456" and "070-123 45 67" → "46701234567".
 * Returns null when there are no digits to work with.
 *
 * Two national formats share this column, and the leading zero is what tells
 * them apart: Spain has no trunk prefix and exactly nine national digits, so a
 * number that starts with 0 is Swedish and nothing else. Anything longer with
 * no leading zero is already in international form and is left alone —
 * stapling 34 onto a relocation partner's +46 number would produce a wa.me
 * link to a number nobody owns.
 */
export function waPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2); // 0034…, 0046…

  if (d.startsWith("0")) {
    d = d.replace(/^0+/, ""); // Sweden's trunk prefix
    return d ? SE + d : null;
  }
  if (d.length === 9) return ES + d; // a Spanish national number
  return d.length > 0 ? d : null; // already international
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
