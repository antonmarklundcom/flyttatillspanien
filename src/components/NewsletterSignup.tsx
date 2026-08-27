"use client";

import { useState } from "react";
import Link from "next/link";
import { CONTACT_EMAIL, CONTACT_WHATSAPP } from "@/config/contact";
import { waLink } from "@/lib/wa";

/**
 * Bostadstips/newsletter email capture. No newsletter infra exists yet
 * (no subscribers table, no ESP), so this hands the address to a channel a
 * human actually reads rather than pretending to submit to a backend that
 * doesn't exist — email first (Sweden is email-first, CLAUDE.md "Backlog
 * state" #10), then WhatsApp if only that is configured.
 *
 * With neither configured there is nowhere to send it, so the form is not
 * rendered at all: a submit button that silently does nothing is a worse
 * promise than a link to the contact form, which does reach us.
 */
export function NewsletterSignup() {
  const [email, setEmail] = useState("");

  const subject = "Jag vill ha bostadstips och nyheter";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    if (CONTACT_EMAIL) {
      const body = encodeURIComponent(`Anmäl mig med den här e-postadressen: ${email}`);
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

  if (!CONTACT_EMAIL && !CONTACT_WHATSAPP) {
    return (
      <Link className="newsletter__submit" href="/contacto">
        Hör av dig så meddelar vi dig
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
        placeholder="Fyll i din e-postadress"
        aria-label="E-post"
      />
      <button className="newsletter__submit" type="submit">
        Prenumerera
      </button>
    </form>
  );
}
