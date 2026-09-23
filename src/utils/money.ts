/**
 * Ledger money arithmetic.
 *
 * All wallet balances are `Decimal(15,2)` in the database, so every arithmetic
 * result is normalised back to whole cents to stop float drift accumulating in
 * the ledger.
 *
 * This lived as a module-private helper inside `FinanceContext.tsx` until the
 * transfer form needed to *predict* a post-transfer balance (ADR `0014`). The
 * preview has to show exactly what `addTransaction` will commit, and the
 * alternative - a second rounding implementation in the UI layer - is precisely
 * what `CLAUDE.md`'s "no inlined `Math.round(x*100)/100` at a ledger site" rule
 * exists to prevent.
 *
 * **Do not merge this with `roundToTwoDecimals` in `mathEvaluator.ts`.** They
 * are deliberately different: that one carries a magnitude-scaled epsilon nudge
 * so a half-cent *input expression* rounds up rather than down. This one is
 * plain cent rounding for balances that are already cent-precise.
 */
export function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}
