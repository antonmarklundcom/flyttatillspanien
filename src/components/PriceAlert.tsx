"use client";

import { useState } from "react";
import { sv } from "@/i18n/sv";

/**
 * "Meddela mig om priset sänks" price alert. There's no alerting engine yet,
 * so this is honest about what it does: it captures the request as a lead
 * (leadType buyer/renter, message flags the price alert) so the team can
 * follow up manually — the same channel every other inquiry uses. When a
 * real alert engine ships it reads these same leads.
 *
 * /api/leads requires a valid `email` (leads.email is NOT NULL) and only
 * takes an optional `phone` — there is no `whatsapp` key. This form collects
 * an email, matching every other lead-capture surface on the portal.
 */
export function PriceAlert({
  listingPublicId,
  listingTitle,
  leadType,
}: {
  listingPublicId: string;
  listingTitle: string;
  leadType: "buyer" | "renter";
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("sending");
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leadType,
          listingPublicId,
          email: email.trim(),
          message: `[Prisbevakning] Meddela mig om priset sänks: ${listingTitle}`,
        }),
      });
      setState("done");
    } catch {
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <span className="price-alert price-alert--done">{sv.priceAlertDone}</span>
    );
  }

  if (!open) {
    return (
      <button className="price-alert" onClick={() => setOpen(true)}>
        🔔 {sv.priceAlert}
      </button>
    );
  }

  return (
    <form className="price-alert__form" onSubmit={onSubmit}>
      <input
        className="price-alert__input"
        type="email"
        autoFocus
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={sv.priceAlertEmailPlaceholder}
        aria-label={sv.priceAlertEmailPlaceholder}
      />
      <button
        className="price-alert__submit"
        type="submit"
        disabled={state === "sending"}
      >
        {state === "sending" ? sv.priceAlertSending : sv.priceAlertSubmit}
      </button>
    </form>
  );
}
