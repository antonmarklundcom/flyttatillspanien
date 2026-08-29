"use client";

import { useState } from "react";
import { sv } from "@/i18n/sv";
import { waLink } from "@/lib/wa";

/**
 * Full contact form for a listing. Records the lead through /api/leads (MySQL
 * first, then the CRM webhook) and then, when the listing carries a seller
 * channel, offers to continue there — a lead is captured either way.
 *
 * **Email is the required field and the phone is optional** (design doc §3.7).
 * A Swedish buyer fills in a form and expects an email reply; the WhatsApp
 * continuation below is the SPANISH AGENCY's channel, offered as an extra,
 * never as the thing the buyer has to use.
 *
 * Success is only claimed when the POST actually succeeded (res.ok) or the
 * seller is reachable another way; a total failure shows an error instead of
 * a false success. The WhatsApp continuation is a rendered <a> the visitor
 * taps, not a post-await window.open — popup blockers (iOS Safari especially)
 * eat window.open calls that don't happen synchronously in the tap handler.
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
          phone: phone.trim() || undefined,
          message: fullMessage,
          utm: readUtm(),
        }),
      });
      captured = res.ok;
    } catch {
      // Network failure — handled below; WhatsApp may still reach the seller.
    }
    // Without a seller channel to fall back to, a failed capture means nobody
    // got the message — say so instead of lying with a success state.
    setState(captured || waHref ? "sent" : "error");
  }

  const fieldsRow = (
    <div className={`contact-form__row${variant === "panel" ? " contact-form__row--split" : ""}`}>
      <label className="contact-form__field">
        <span className="contact-form__label">Nombre</span>
        <input
          className="contact-form__input"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ingresa tu nombre"
        />
      </label>
      <label className="contact-form__field">
        <span className="contact-form__label">Email</span>
        <input
          className="contact-form__input"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Ingresa tu email"
        />
      </label>
    </div>
  );

  return (
    <form className={`contact-form contact-form--${variant}`} onSubmit={onSubmit}>
      {fieldsRow}

      <label className="contact-form__field">
        <span className="contact-form__label">Teléfono</span>
        <div className="contact-form__phone">
          <span className="contact-form__phone-prefix" aria-hidden>
            🇸🇪 +46
          </span>
          {/* Optional: the reply goes to the address above. Asking a buyer
              for a number before anyone has anything to call them about is
              what the email-first flip exists to stop. */}
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
        <span className="contact-form__label">Mensaje</span>
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
          ? "¡Mensaje enviado!"
          : state === "sending"
            ? "Enviando…"
            : "Enviar Mensaje"}
      </button>

      {state === "sent" && waHref && (
        <a
          className="contact-form__submit contact-form__submit--wa"
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          💬 Continuar en WhatsApp
        </a>
      )}
      {state === "error" && (
        <p className="contact-form__error" role="alert">
          No pudimos enviar tu consulta. Probá de nuevo en unos segundos.
        </p>
      )}

      <div className="contact-form__footer">
        {/* Only claim direct delivery when there is a seller channel to
            deliver to. With no contact on the listing the lead lands in the
            operator's inbox instead, and promising otherwise is a lie the
            buyer can't check (audit F4). */}
        {waHref && (
          <span className="contact-form__note">
            ✓ Tu consulta llega directamente al vendedor
          </span>
        )}
        {waHref && (
          <div className="contact-form__altlinks">
            <a
              className="contact-form__altlink"
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              💬 WhatsApp
            </a>
            <a className="contact-form__altlink" href={`tel:${contactWhatsapp}`}>
              📞 Ver teléfono
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
