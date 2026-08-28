/**
 * French amortization — the surviving half of the Paraguayan cuota engine.
 *
 * `P·r / (1 − (1+r)^−n)` is not Paraguayan: it is twelve lines, pure, and
 * depends on nothing, so it is kept here **unused** rather than deleted and
 * rewritten later. Any future mortgage or payment-plan feature needs exactly
 * this and nothing else from the old engine.
 *
 * There is deliberately no Spanish mortgage calculator around it, and no stub
 * of one. A non-resident buyer gets roughly 60–70% LTV against a resident's
 * 80%, at a spread negotiated per applicant and per bank — there is no
 * published scale to seed, so any number the portal printed would be an
 * invention. What ships instead is `src/lib/acquisition-cost.ts`, which is
 * deterministic and needs no rate feed. A calculator returns when there is a
 * lender partner, which is a business decision, not an engineering one.
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
