/**
 * The portal's own contact identity — the ONE place the support email and
 * WhatsApp number live (audit F10: the email used to be a literal in 8
 * user-facing files, including JSON-LD and the privacy policy).
 *
 * Both values come from env so each deploy/market can set its own without a
 * code change. NEXT_PUBLIC_ prefix because client components (Newsletter
 * signup) also read them — Next inlines these at build time.
 *
 * **Neither has a fallback, on purpose.** A hard-coded default address is a
 * compose window aimed at a mailbox nobody owns — worse than showing no
 * address at all. Every consumer must treat both as possibly-null and fall
 * back to the on-site lead form.
 *
 * **CONTACT_EMAIL is required before launch**, which is a config decision and
 * not a type change: Sweden is email-first, and a Swedish consumer portal with
 * no address on its contact page is not credible. CONTACT_WHATSAPP stays
 * genuinely optional — here it is the AGENCY-side channel (Spanish agencies
 * live on WhatsApp), not the buyer's.
 */
export const CONTACT_EMAIL: string | null =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || null;

/**
 * Portal WhatsApp as typed (display form). Null = don't render WA CTAs.
 * Agency-side channel; a Swedish buyer is answered by email.
 */
export const CONTACT_WHATSAPP: string | null =
  process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || null;
