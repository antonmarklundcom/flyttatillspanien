/**
 * Display formatting — sv-SE conventions (a thin non-breaking space as the
 * thousands separator, comma decimal). EUR is the only stored price
 * (docs/SPAIN-PORTAL-DESIGN.md §2); SEK is always an approximation, computed
 * at render from the cached `fx_rates` row and never stored on a listing.
 */
const nfInt = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });

const FX_MAX_AGE_DAYS = Number(process.env.FX_MAX_AGE_DAYS ?? 7);

/** "€ 285 000" */
export function formatEur(amount: number | string): string {
  return `€ ${nfInt.format(Math.round(Number(amount)))}`;
}

/**
 * "≈ 3 250 000 kr", rounded to the nearest 10 000 kr so it visibly reads as
 * an estimate rather than a quoted price. Returns null — no SEK line at all —
 * when there is no rate, or the newest rate is older than FX_MAX_AGE_DAYS: a
 * missing SEK figure is a small disappointment, a confidently wrong one is a
 * complaint (docs/SPAIN-PORTAL-DESIGN.md §2, "the staleness guard").
 */
export function formatSek(
  eur: number | string,
  rate: { rate: number | string; observedOn: string } | null,
): string | null {
  if (!rate) return null;
  const observed = new Date(`${rate.observedOn}T00:00:00Z`).getTime();
  const ageDays = (Date.now() - observed) / (1000 * 60 * 60 * 24);
  if (!Number.isFinite(ageDays) || ageDays > FX_MAX_AGE_DAYS) return null;

  const sek = Number(eur) * Number(rate.rate);
  if (!Number.isFinite(sek)) return null;
  const rounded = Math.round(sek / 10_000) * 10_000;
  return `≈ ${nfInt.format(rounded)} kr`;
}

/** "EUR/SEK 11,42 · 27 aug 2026" — the disclosure line under a detail-page price. */
export function formatRateNote(rate: number | string, observedOn: string): string {
  const nf2 = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const date = new Date(`${observedOn}T00:00:00Z`);
  const dateStr = new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
  return `EUR/SEK ${nf2.format(Number(rate))} · ${dateStr}`;
}

/** Public R2 URL for a stored image key (empty base → key passthrough). */
export function imageUrl(r2Key: string | null): string | null {
  if (!r2Key) return null;
  const base = process.env.R2_PUBLIC_BASE_URL ?? "";
  return base ? `${base.replace(/\/$/, "")}/${r2Key}` : r2Key;
}

/**
 * Card-sized derivative of a stored key (~480px). Mirrors `thumbKey()` in
 * lib/images.ts — the two must agree, since one writes the object and the
 * other addresses it.
 *
 * Only keys we uploaded have a thumb: imported placeholders are still remote
 * URLs, so those fall back to the original rather than 404ing a grid of cards.
 */
export function imageThumbUrl(r2Key: string | null): string | null {
  if (!r2Key) return null;
  if (!/\.webp$/.test(r2Key)) return imageUrl(r2Key);
  return imageUrl(r2Key.replace(/\.webp$/, "-thumb.webp"));
}
