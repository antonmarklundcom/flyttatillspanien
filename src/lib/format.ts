/**
 * Display formatting — Swedish conventions (`sv-SE`: U+00A0 thousands
 * separator, comma decimal).
 *
 * **EUR is the price. SEK is always an approximation and always marked as
 * one.** The euro figure comes off the row; the kronor figure is computed here
 * from the cached ECB rate and never stored, because a stored snapshot goes
 * stale invisibly and a card confidently printing an eighteen-month-old kronor
 * number is a lie rather than a rounding error.
 *
 * Numbers are not copy: the locale below is a NUMBER locale derived from the
 * request, not something the dictionary owns. The words around these figures
 * live in `src/i18n/sv.ts`.
 */

/** U+00A0 groups thousands in sv-SE — not a plain space. Tests care. */
const nfInt = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });
const nfRate = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dfDay = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * How old the newest EUR/SEK observation may be before every kronor figure
 * disappears from the site. Read from the environment so an operator can widen
 * it during a long ECB outage without a deploy; 7 days is the default and the
 * documented value.
 */
export function fxMaxAgeDays(): number {
  const raw = Number(process.env.FX_MAX_AGE_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : 7;
}

/** The newest EUR/SEK observation, as the query layer hands it over. */
export interface FxRate {
  rate: number;
  /** 'YYYY-MM-DD' — an ECB reference date is a publication day, not an instant. */
  observedOn: string;
}

/**
 * Whether a rate is recent enough to print.
 *
 * A cached rate can be stale for reasons the app cannot see: ECB is down, the
 * cron was never installed on the box, the XML format changed. Same spirit as
 * `sendOtp` refusing to log a delivery that did not happen — silence beats a
 * confident wrong number.
 */
export function isFxFresh(fx: FxRate | null, now: Date = new Date()): boolean {
  if (!fx) return false;
  const observed = Date.parse(`${fx.observedOn}T00:00:00Z`);
  if (!Number.isFinite(observed)) return false;
  const ageDays = (now.getTime() - observed) / 86_400_000;
  return ageDays <= fxMaxAgeDays();
}

/** The price line. `€ 285 000`. */
export function formatEur(amount: number | string): string {
  return `€ ${nfInt.format(Math.round(Number(amount)))}`;
}

/**
 * The kronor approximation — `≈ 3 250 000 kr` — or `null` when there is no
 * fresh rate, in which case the caller omits the line entirely.
 *
 * Rounded to the nearest 10 000 kr on purpose: an unrounded figure reads as a
 * quoted price and churns between renders as the rate moves, while a rounded
 * one is visibly an estimate. A missing SEK figure is a small disappointment;
 * a confidently wrong one is a complaint.
 */
export function formatSek(
  priceEur: number | string,
  fx: FxRate | null,
  now: Date = new Date(),
): string | null {
  if (!isFxFresh(fx, now)) return null;
  const eur = Number(priceEur);
  const rate = Number(fx!.rate);
  if (!Number.isFinite(eur) || !Number.isFinite(rate) || rate <= 0) return null;
  const sek = Math.round((eur * rate) / 10_000) * 10_000;
  if (sek <= 0) return null;
  return `≈ ${nfInt.format(sek)} kr`;
}

/**
 * The disclosure that has to sit under any converted price:
 * `EUR/SEK 11,42 · 27 aug 2026`. The detail page prints it; cards do not —
 * no room there, and the detail page carries the disclosure for both.
 */
export function formatRateNote(fx: FxRate | null): string | null {
  if (!fx) return null;
  const rate = Number(fx.rate);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const observed = new Date(`${fx.observedOn}T00:00:00Z`);
  if (Number.isNaN(observed.getTime())) return null;
  return `EUR/SEK ${nfRate.format(rate)} · ${dfDay.format(observed)}`;
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
