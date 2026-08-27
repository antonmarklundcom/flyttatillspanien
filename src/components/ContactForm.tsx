"use client";

import { useState } from "react";
import { sv, svContactForm } from "@/i18n/sv";
import { waLink } from "@/lib/wa";

/**
 * Full contact form for a listing (ARCHITECTURE.md §3 sticky WhatsApp
 * contact, extended to match the form-first pattern sellers expect).
 * Records the lead through /api/leads (MySQL first, then GHL) and then
 * hands the visitor a WhatsApp link with the same message — a lead is
 * captured even if the visitor never sends the WhatsApp message.
 *
 * Success is only claimed when the POST actually succeeded (res.ok) or the
 * seller is reachable by WhatsApp anyway; a total failure shows an error
 * with the WhatsApp fallback instead of a false "¡Mensaje enviado!". The
 * WhatsApp continuation is a rendered <a> the visitor taps, not a
 * post-await window.open — popup blockers (iOS Safari especially) eat
 * window.open calls that don't happen synchronously in the tap handler.
 *
 * Two layouts from the same component: "card" (stacked, for the sticky
 * sidebar) and "panel" (two-column, for the full-width bottom section).
 */
export function ContactForm({
  listingPublicId,
  contactWhatsapp,
  leadType,
  prefillMessage,
  variant = "card",
}: {
  /** Omit for non-listing inquiries (e.g. a project page). */
  listingPublicId?: string;
  contactWhatsapp: string | null;
  leadType: "buyer" | "renter";
  prefillMessage: string;
  variant?: "card" | "panel";
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(prefillMessage);
  const [questions, setQuestions] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  function toggleQuestion(q: string) {
    setQuestions((prev) => {
      const next = prev.includes(q) ? prev.filter((x) => x !== q) : [...prev, q];
      return next;
    });
  }

  const fullMessage =
    questions.length > 0 ? `${message}\n\n${questions.join(" ")}` : message;
  const waHref = waLink(contactWhatsapp, fullMessage);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // /api/leads requires a valid email (leads.email is NOT NULL — Sweden is
    // email-first) and takes the phone number, if any, as `phone`. Sending
    // the old `whatsapp` key here would silently mismatch the API's schema.
    // This is the BUYER's own callback number — a Swedish visitor inquiring
    // about a Spanish listing — so the prefix is Sweden's, not Spain's.
    const buyerPhone = phone.trim() ? `+46${phone.trim()}` : undefined;
    setState("sending");
    let captured = false;
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leadType,
          listingPublicId,
          name: name || undefined,
          email,
          phone: buyerPhone,
          message: fullMessage,
          utm: readUtm(),
        }),
      });
      captured = res.ok;
    } catch {
      // Network failure — handled below; WhatsApp may still reach the seller.
    }
    // Without a WhatsApp fallback a failed capture means nobody got the
    // message — say so instead of lying with a success state.
    setState(captured || waHref ? "sent" : "error");
  }

  const fieldsRow = (
    <div className={`contact-form__row${variant === "panel" ? " contact-form__row--split" : ""}`}>
      <label className="contact-form__field">
        <span className="contact-form__label">{svContactForm.nameLabel}</span>
        <input
          className="contact-form__input"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={svContactForm.namePlaceholder}
        />
      </label>
      <label className="contact-form__field">
        <span className="contact-form__label">{svContactForm.emailLabel}</span>
        <input
          className="contact-form__input"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={svContactForm.emailPlaceholder}
        />
      </label>
    </div>
  );

  return (
    <form className={`contact-form contact-form--${variant}`} onSubmit={onSubmit}>
      {fieldsRow}

      <label className="contact-form__field">
        <span className="contact-form__label">{svContactForm.phoneLabel}</span>
        <div className="contact-form__phone">
          <span className="contact-form__phone-prefix" aria-hidden>
            🇸🇪 +46
          </span>
          <input
            className="contact-form__input contact-form__input--phone"
            type="tel"
            minLength={6}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="70 123 45 67"
          />
        </div>
      </label>

      <div className="contact-form__chips">
        {sv.quickQuestions.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => toggleQuestion(q)}
            className={`contact-form__chip${questions.includes(q) ? " contact-form__chip--on" : ""}`}
          >
            {q}
          </button>
        ))}
      </div>

      <label className="contact-form__field">
        <span className="contact-form__label">{svContactForm.messageLabel}</span>
        <textarea
          className="contact-form__textarea"
          rows={variant === "panel" ? 3 : 4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>

      <button
        className="contact-form__submit"
        type="submit"
        disabled={state === "sending"}
      >
        {state === "sent"
          ? svContactForm.submitSent
          : state === "sending"
            ? svContactForm.submitSending
            : svContactForm.submitIdle}
      </button>

      {state === "sent" && waHref && (
        <a
          className="contact-form__submit contact-form__submit--wa"
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          {svContactForm.continueWhatsapp}
        </a>
      )}
      {state === "error" && (
        <p className="contact-form__error" role="alert">
          {svContactForm.errorGeneric}
        </p>
      )}

      <div className="contact-form__footer">
        {/* Only claim direct delivery when there is a seller channel to
            deliver to. With no contact on the listing the lead lands in the
            operator's inbox instead, and promising otherwise is a lie the
            buyer can't check (audit F4). */}
        {waHref && (
          <span className="contact-form__note">{svContactForm.directNote}</span>
        )}
        {waHref && (
          <div className="contact-form__altlinks">
            <a
              className="contact-form__altlink"
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              {svContactForm.whatsappLink}
            </a>
            <a className="contact-form__altlink" href={`tel:${contactWhatsapp}`}>
              {svContactForm.showPhone}
            </a>
          </div>
        )}
      </div>
    </form>
  );
}

function readUtm(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
    const v = p.get(k);
    if (v) utm[k] = v;
  }
  return utm;
}
