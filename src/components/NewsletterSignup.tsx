"use client";

import { useState } from "react";
import Link from "next/link";
import { CONTACT_EMAIL, CONTACT_WHATSAPP } from "@/config/contact";
import { waLink } from "@/lib/wa";

/**
 * "Oportunidades inmobiliarias" email capture. No newsletter infra exists yet
 * (no subscribers table, no ESP), so this hands the address to a channel a
 * human actually reads rather than pretending to submit to a backend that
 * doesn't exist — WhatsApp first, then a mailbox if one is configured.
 *
 * With neither configured there is nowhere to send it, so the form is not
 * rendered at all: a submit button that silently does nothing is a worse
 * promise than a link to the contact form, which does reach us.
 */
export function NewsletterSignup() {
  const [email, setEmail] = useState("");

  const subject = "Quiero recibir oportunidades inmobiliarias";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    const wa = waLink(CONTACT_WHATSAPP, `${subject}. Mi email: ${email}`);
    if (wa) {
      window.open(wa, "_blank", "noopener,noreferrer");
      return;
    }
    if (CONTACT_EMAIL) {
      const body = encodeURIComponent(`Suscribime con este email: ${email}`);
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
        subject,
      )}&body=${body}`;
    }
  }

  if (!CONTACT_WHATSAPP && !CONTACT_EMAIL) {
    return (
      <Link className="newsletter__submit" href="/contacto">
        Escribinos y te avisamos
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
        placeholder="Ingresa tu email"
        aria-label="Email"
      />
      <button className="newsletter__submit" type="submit">
        Suscribirme
      </button>
    </form>
  );
}
