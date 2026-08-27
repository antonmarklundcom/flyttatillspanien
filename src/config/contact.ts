/**
 * The portal's own contact identity — the ONE place the support email and
 * WhatsApp number live (audit F10: the email used to be a literal in 8
 * user-facing files, including JSON-LD and the privacy policy).
 *
 * Both values come from env so each deploy/market can set its own without a
 * code change. NEXT_PUBLIC_ prefix because client components (Newsletter
 * signup) also read them — Next inlines these at build time.
 *
 * **Neither has a fallback, on purpose** (founder decision, 2026-08-17). The
 * old default was `hola@propia.com.py`, on a domain nobody owns, so every
 * mailto: on the site opened a compose window addressed to a black hole —
 * worse than showing no address at all. Until a real mailbox exists, the
 * contact channels are the on-site lead form (`/contacto`, `/publicar`,
 * the form on every listing) and WhatsApp. Every consumer must therefore
 * treat both of these as possibly-null and fall back to the form.
 */
export const CONTACT_EMAIL: string | null =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || null;

/** Portal WhatsApp as typed (display form). Null = don't render WA CTAs. */
export const CONTACT_WHATSAPP: string | null =
  process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || null;
