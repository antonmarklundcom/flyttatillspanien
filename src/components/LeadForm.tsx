"use client";

import { useState } from "react";

export type LeadFormType =
  | "buyer"
  | "renter"
  | "seller"
  | "developer"
  | "agent_signup";

export interface LeadFormReason {
  value: LeadFormType;
  label: string;
}

/**
 * Standalone lead form for the marketing pages (/contacto,
 * /para-inmobiliarias). ContactForm.tsx is the listing-scoped version — it
 * always carries a listingPublicId and can hand off to the seller's own
 * channel. These leads have no listing and no counterparty: they come to us,
 * so this one just posts to /api/leads (MySQL first, then the CRM webhook)
 * and confirms inline.
 *
 * Email is required by the API and is the field that actually gets a reply
 * (design doc §3.7); the phone is optional.
 */
export function LeadForm({
  leadType,
  reasons,
  submitLabel = "Skicka förfrågan",
  messagePlaceholder = "Berätta vad vi kan hjälpa dig med",
  companyField = false,
  successTitle = "Tack! Vi har fått ditt meddelande.",
  successText = "Vi svarar via e-post inom en arbetsdag.",
}: {
  /** Used when `reasons` is not given, or as the initial selection. */
  leadType: LeadFormType;
  /** Renders a reason selector that switches the lead type. */
  reasons?: LeadFormReason[];
  submitLabel?: string;
  messagePlaceholder?: string;
  /** Adds an "inmobiliaria / empresa" line, folded into the message. */
  companyField?: boolean;
  successTitle?: string;
  successText?: string;
}) {
  const [type, setType] = useState<LeadFormType>(leadType);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Email is the required identity now (design doc §3.7) and the phone is
    // optional, so it is the address this gates on. Deliberately permissive,
    // like every other address check in this repo.
    const address = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(address)) {
      setError("Ange en giltig e-postadress.");
      return;
    }
    setError(null);
    setSending(true);

    const body = [
      companyField && company ? `Mäklarbyrå / företag: ${company}` : null,
      message,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leadType: type,
          name: name || undefined,
          email: address,
          phone: phone.trim() || undefined,
          message: body || undefined,
          utm: readUtm(),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSent(true);
    } catch {
      setError(
        "Vi kunde inte skicka ditt meddelande. Försök igen om en stund.",
      );
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="lead-form lead-form--done" role="status">
        <div className="lead-form__done-icon" aria-hidden>
          ✅
        </div>
        <h3 className="lead-form__done-title">{successTitle}</h3>
        <p className="lead-form__done-text">{successText}</p>
      </div>
    );
  }

  return (
    <form className="lead-form" onSubmit={onSubmit}>
      {reasons && reasons.length > 0 && (
        <label className="lead-form__field">
          <span className="lead-form__label">Anledning till kontakt</span>
          <select
            className="lead-form__input"
            value={type}
            onChange={(e) => setType(e.target.value as LeadFormType)}
          >
            {reasons.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="lead-form__row">
        <label className="lead-form__field">
          <span className="lead-form__label">Namn</span>
          <input
            className="lead-form__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ditt namn"
            autoComplete="name"
          />
        </label>
        <label className="lead-form__field">
          <span className="lead-form__label">
            E-post <span aria-hidden>*</span>
          </span>
          <input
            className="lead-form__input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="din@epost.se"
            autoComplete="email"
          />
        </label>
      </div>

      <div className="lead-form__row">
        <label className="lead-form__field">
          <span className="lead-form__label">Telefon (valfritt)</span>
          <input
            className="lead-form__input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+46 70 123 45 67"
            autoComplete="tel"
          />
        </label>
        {companyField && (
          <label className="lead-form__field">
            <span className="lead-form__label">Mäklarbyrå / företag</span>
            <input
              className="lead-form__input"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Företagsnamn"
              autoComplete="organization"
            />
          </label>
        )}
      </div>

      <label className="lead-form__field">
        <span className="lead-form__label">Meddelande</span>
        <textarea
          className="lead-form__input lead-form__textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={messagePlaceholder}
          rows={4}
        />
      </label>

      {error && (
        <p className="lead-form__error" role="alert">
          {error}
        </p>
      )}

      <button className="lead-form__submit" type="submit" disabled={sending}>
        {sending ? "Skickar…" : submitLabel}
      </button>

      <p className="lead-form__fineprint">
        Genom att skicka godkänner du våra{" "}
        <a href="/terminos">användarvillkor</a> och vår{" "}
        <a href="/privacidad">integritetspolicy</a>. Vi använder dina
        uppgifter bara för att svara dig.
      </p>
    </form>
  );
}

/** UTM params from the landing URL, if the visitor arrived with any. */
function readUtm(): Record<string, string> | undefined {
  if (typeof window === "undefined") return undefined;
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ]) {
    const v = params.get(key);
    if (v) utm[key] = v;
  }
  return Object.keys(utm).length > 0 ? utm : undefined;
}
