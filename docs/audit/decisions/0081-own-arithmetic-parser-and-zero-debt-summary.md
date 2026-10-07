# 0081: The amount field's arithmetic is the app's own parser, not mathjs; the debt summaries read 100% when nothing is borrowed

**Status:** Accepted. Released: code `11197ee`, docs `9546e57`, hash backfill `b43e8d2`, merged into `main` as `47f3949` (PR #56); Vercel `dpl_EU8geC3hBk9HQUgxD8hoYBEfieVD` READY in `icn1`. No migration.
- **Amends** ADR `0010`: the deferred shell modals no longer carry `vendor-math`, which is gone; they keep deferring the entry forms' chunks.
- **Amends** ADR `0080`: `useDebts().metrics.progressPercent` reads 100 when there are debts and none borrowed anything, as each debt's card does.
- **Closes** finding 6 of `AGY_AUDIT300926.md` (the 2026-09-30 architecture audit).

**Date:** 2026-10-07

## Context

1. **Finding 6.** `safeEvaluateMath` (`src/utils/mathEvaluator.ts`) called `evaluate` from `mathjs/number` after a character check. That one call pulled in `vendor-math`, 375,725 B raw and 109,561 B gzipped, fetched the first time Quick Add, the Add transaction form, the repay form, a transfer or an edit opens. The field needs `+ - * /`, brackets and decimals; its operator keys are exactly `+ - * / ( )`.
2. **What mathjs did beyond that.** The character check also let `%` and `^` through. mathjs read `%` as percent or as modulo depending on position: `50%` is 0.5 and `100+10%` is 110, but `5%+5%` is 0, `100%-5` is 0 and `4/2%` is 200. A note such as "ส่วนลด 10% 60" seeded ฿10 (10 mod 60). mathjs also multiplies a bracket beside a number, with its own grouping: `6/2(3)` is 9, `6/(2)(3)` is 1, `26/(53)7` is 0.07 (26 / 371), and `+(4)8` is refused while `(4)8` is 32.
3. **The ฿0 summary.** ADR `0080` left the summaries (`DebtSummaryCard`, the Dashboard's Debt payoff card) at 0% for a ledger whose debts borrowed nothing, while each such debt's card reads 100%. The owner decided (2026-10-07) that the summary reads 100% too.

## Decision

1. **`evaluateArithmetic`, a recursive-descent parser in `mathEvaluator.ts`,** replaces mathjs. It tokenises numbers (`12`, `12.5`, `.5`, `5.`), `+ - * /` and brackets, and computes in plain doubles: `+` and `-` left to right, then `*` and `/` left to right, then unary signs, then brackets. The operations are the ones `mathjs/number` ran, in the same order, so each result is the same double. There is no `eval`, no `Function` and no name lookup. Anything else throws, which `safeEvaluateMath` reports as "Incomplete or malformed math expression", as before. Brackets nested past the stack also throw, inside the same `try`.
   - **A bracket after a number or a bracket multiplies** (`2(3)` is 6, `(1+2)(3)` is 9), because the operator keys can type that.
   - **Where mathjs grouped an unwritten product its own way, the parser refuses** rather than pick a figure: a number after a bracket (`(2)3`, `2(3)4`) and a bracket product after a division in the same term (`6/2(3)`, `26/(53)7`). The person sees an error, never a different amount.
   - **`5./2` and `5.*2` stay refused,** as mathjs refused them (it read `./` and `.*` as element-wise operators).
2. **`%` and `^` are no longer accepted.** The character check, the field's "has a calculation" and "unfinished" tests and `parseExpressInput`'s three anchors drop both. `50%` now says "Invalid characters in calculation" instead of 0.5, and "ส่วนลด 10% 60" seeds ฿60 with "ส่วนลด 10%" left as words.
3. **`roundToTwoDecimals` and the messages are unchanged.** "Empty expression", "Invalid characters in calculation", "Calculation did not produce a valid number" (division by zero) and "Incomplete or malformed math expression" come from the same places.
4. **`mathjs` leaves `package.json`,** with seven packages only it used (`complex.js`, `escape-latex`, `fraction.js`, `javascript-natural-sort`, `seedrandom`, `tiny-emitter`, `typed-function`); `@babel/runtime` and `decimal.js` stay as test-only dependencies. `vite.config.ts` loses its `vendor-math` rule.
5. **`useDebts` passes 100 when there is at least one debt,** and 0 with none; with no debts neither page shows the summary (the Debt payoff page shows its empty state, the Dashboard "No active debts.").

## Verification

- **Red first:** in the first version of `unit/math-evaluator.test.ts`, the eight tests for `%`, `^` and the note failed on the mathjs code, and the other 70 (the arithmetic, the bracket products, the messages, the character check) passed on it, as a record of what mathjs did. The six refused bracket products were added after the run below found mathjs's own grouping; mathjs gave figures for five of them, which is what the tests now refuse. `unit/debts-page.test.tsx`'s ฿0 pin, changed to read "Paid off100.0%", failed on the unchanged hook (`'Paid off0.0%−฿250.00 repaid'`).
- **Against mathjs, before removing it:** a one-off run, deleted before commit, compared the old and new `safeEvaluateMath` on 1,000,000 random strings over the field's alphabet (762,500 distinct). The parser never gave a figure mathjs did not. 3,169 strings mathjs answered (3,127 with a number, 42 with not-a-number) are now refused; every one is a number after a bracket or a bracket product after a division. The first version of the run used a generator that repeated itself after a few thousand values; it was replaced (mulberry32) before any figure here was taken.
- **Bundle** (gzip -9, both sides built with `.env`): all app JS 1,380,029 / 417,344 to 1,004,186 / 307,785 B (−375,843 / −109,559). `vendor-math` (375,725 / 109,561) is gone; the parser adds 561 / 252 B to the `InlineMathInput` chunk; the entry is 191,656 / 55,089 to 191,611 / 55,071 (its preload list no longer names `vendor-math`). Precache 59 to 58 entries.
- **Gate:** in the refactor log.
