"use client";

import { useState } from "react";
import { es } from "@/i18n/sv";

/**
 * "Avisame si baja" price alert. There's no alerting engine yet, so this is
 * honest about what it does: it captures the request as a lead (leadType
 * buyer/renter, message flags the price alert) so the team can follow up
 * manually — the same channel every other inquiry uses. When a real alert
 * engine ships it reads these same leads.
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
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setState("sending");
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leadType,
          listingPublicId,
          whatsapp: phone.trim(),
          message: `[Alerta de precio] Avisame si baja: ${listingTitle}`,
        }),
      });
      setState("done");
    } catch {
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <span className="price-alert price-alert--done">
        ✓ Listo, te avisamos si baja
      </span>
    );
  }

  if (!open) {
    return (
      <button className="price-alert" onClick={() => setOpen(true)}>
        🔔 {es.priceAlert}
      </button>
    );
  }

  return (
    <form className="price-alert__form" onSubmit={onSubmit}>
      <input
        className="price-alert__input"
        type="tel"
        autoFocus
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Tu WhatsApp (+595 …)"
        aria-label="Tu número de WhatsApp"
      />
      <button
        className="price-alert__submit"
        type="submit"
        disabled={state === "sending"}
      >
        {state === "sending" ? "…" : "Avisame"}
      </button>
    </form>
  );
}
