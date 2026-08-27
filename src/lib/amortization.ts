/**
 * Amortization maths — the surviving half of the inherited Paraguayan cuota
 * engine (docs/SPAIN-PORTAL-DESIGN.md §4). `frenchAmortization()` is not
 * Paraguayan or Spanish: P·r / (1 − (1+r)^−n) is the standard formula for any
 * fixed-rate, fixed-term loan. It is unused today — there is no published
 * non-resident mortgage rate scale to seed a Spanish quote from, so any number
 * this fed into the UI would be an invention (see CLAUDE.md backlog item on
 * the Spanish mortgage calculator). Kept, not deleted, because any future
 * mortgage or payment-plan feature needs exactly it. Do not build a stub
 * around it — it returns when there is a lender partnership, which is a
 * founder decision, not a code task.
 */

/** French amortization: P·r / (1 − (1+r)^−n), r = monthly rate. */
export function frenchAmortization(
  principal: number,
  annualRatePct: number,
  termMonths: number,
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
}
