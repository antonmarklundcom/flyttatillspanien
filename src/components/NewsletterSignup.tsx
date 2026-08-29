"use client";

import { useState } from "react";
import Link from "next/link";
import { CONTACT_EMAIL, CONTACT_WHATSAPP } from "@/config/contact";
import { waLink } from "@/lib/wa";

/**
 * "Nya bostäder i din inkorg" email capture. No newsletter infra exists yet
 * (no subscribers table, no ESP), so this hands the address to a channel a
 * human actually reads rather than pretending to submit to a backend that
 * doesn't exist. This form is read by Swedish buyers, so it tries the
 * portal's own mailbox first — CONTACT_WHATSAPP is the agency-facing
 * channel, not something to offer as the primary way to reach us here — and
 * falls back to WhatsApp only if no mailbox is configured.
 *
 * With neither configured there is nowhere to send it, so the form is not
 * rendered at all: a submit button that silently does nothing is a worse
 * promise than a link to the contact form, which does reach us.
 */
export function NewsletterSignup() {
  const [email, setEmail] = useState("");

  const subject = "Jag vill ha nya bostäder i min inkorg";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    if (CONTACT_EMAIL) {
      const body = encodeURIComponent(`Prenumerera på nya bostäder med den här adressen: ${email}`);
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
        subject,
      )}&body=${body}`;
      return;
    }
    const wa = waLink(CONTACT_WHATSAPP, `${subject}. Min e-post: ${email}`);
    if (wa) {
      window.open(wa, "_blank", "noopener,noreferrer");
    }
  }

  if (!CONTACT_WHATSAPP && !CONTACT_EMAIL) {
    return (
      <Link className="newsletter__submit" href="/contacto">
        Kontakta oss så hör vi av oss
      </Link>
    );
  }

  return (
    <form className="newsletter" onSubmit={onSubmit}>
      <input
        className="newsletter__input"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Din e-postadress"
        aria-label="E-post"
      />
      <button className="newsletter__submit" type="submit">
        Prenumerera
      </button>
    </form>
  );
}
