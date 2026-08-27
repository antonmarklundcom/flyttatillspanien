/**
 * Display formatting — Paraguay conventions (es-PY: '.' thousands, ',' decimal).
 * Prices show in their native currency; USD is the internal filter unit but is
 * never what we show for a PYG-listed property.
 */
const nfInt = new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 });

export function formatUsd(amount: number | string): string {
  return `US$ ${nfInt.format(Math.round(Number(amount)))}`;
}

export function formatGs(amount: number | string): string {
  return `Gs ${nfInt.format(Math.round(Number(amount)))}`;
}

/** Native-currency price line for a listing. */
export function formatPrice(l: {
  priceAmount: string | number;
  priceCurrency: "USD" | "PYG";
}): string {
  return l.priceCurrency === "USD"
    ? formatUsd(l.priceAmount)
    : formatGs(l.priceAmount);
}

/** Compact cuota, e.g. "Gs 2,1 M/mes". Null-safe for missing cuota. */
export function formatCuota(cuotaGs: string | number | null): string | null {
  if (cuotaGs == null) return null;
  const n = Number(cuotaGs);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000) {
    const millions = (n / 1_000_000).toFixed(1).replace(".", ",");
    return `Gs ${millions} M/mes`;
  }
  return `${formatGs(n)}/mes`;
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
