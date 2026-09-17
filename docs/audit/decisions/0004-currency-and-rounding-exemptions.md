# 0004 — Currency-formatting and rounding exemptions: keep, narrow, or remove

**Status:** Proposed (deliberately left open — needs a user decision, not a default)
**Date:** 2026-09-17

## Context

`CLAUDE.md` names two explicit exemptions from `formatCurrencyAmount`: `AnimatedCounter` ("an animation primitive with its own decimals prop and separately styled prefix") and `mathEvaluator`'s `formattedValue` ("raw input-field text"). Both exemptions are real today, but their actual code has drifted in ways worth a deliberate look:

- `AnimatedCounter.tsx:30-35` hand-rolls the same `toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` call that `formatCurrencyAmount` (`currency.ts:22-25`) already performs, then glues `฿` on separately at `:43`. It is not doing anything `formatCurrencyAmount` couldn't do — the exemption exists for the animation mechanics (a `framer-motion` `animate()` driving a numeric `useMotionValue`), not for the formatting itself. This component formats **every headline number in the app**: `Navbar.tsx:155-158`, `TotalWealthHero.tsx:43-47`, `WalletAccountsGrid.tsx:108-112`, `CashflowMetricsCards.tsx:37-41/68-72/114-118`, `WalletsView.tsx:105-109`.
- `InlineMathInput.tsx:132,179` render `{currencyPrefix}{formattedResult}`, where `formattedResult` comes from `mathEvaluator.ts:62`'s `rounded.toFixed(2)` — no thousands separator. So typing `12345` shows `฿12345.00` in the amount field's live-preview line, while every other surface in the app shows `฿12,345.00`. The CLAUDE.md exemption text says this is "raw input-field text," which is true of what the user is *typing*, but `:132`/`:179` are rendering a computed *result* of that input, not the raw text itself — arguably a different case than the one the exemption was written for.

Neither of these is a bug per se — both were deliberate, documented choices — but both are worth confirming or narrowing rather than silently "fixing," since a fix here is a visible formatting change on the app's most-viewed numbers.

## Options considered

**(a) Leave both exemptions exactly as documented and coded.** No change.

**(b) Narrow the `AnimatedCounter` exemption**: keep the component's own animation-driven number rendering (that part genuinely can't call `formatCurrencyAmount` directly, since it needs the raw numeric value mid-animation), but route its final string formatting through `formatCurrencyAmount`'s number-formatting logic instead of a second `toLocaleString` call, so the two can't drift independently in the future even though the rendering mechanism stays separate.

**(c) Narrow the `InlineMathInput` exemption**: keep raw input-field text (what the user is typing) unformatted, but format the *computed result* preview with `formatCurrencyAmount` so it shows `฿12,345.00` consistently with the rest of the app.

**(d) Remove both exemptions entirely and force every currency display through `formatCurrencyAmount`.** Rejected outright — `AnimatedCounter` and `InlineMathInput` have genuine mechanical reasons (animation state, live-typing state) to hold intermediate values outside that helper; the question is only about the final rendered string.

## Decision

**Deferred to the user.** This ADR intentionally does not pick (a), (b), or (c). The distinction is real (mechanism vs. final string) but the choice of whether `฿12345.00` vs `฿12,345.00` in the math-input preview is a bug worth fixing, or an accepted minor inconsistency in an admittedly-raw input surface, is a product call, not an engineering one. Do not implement (b) or (c) without this ADR's status changing to `Accepted` with the chosen option recorded.

## Consequences

- If (b) is chosen: `AnimatedCounter.tsx:30-35,43` changes for the first time since these exemptions were documented — a visual regression test (screenshot or exact-text assertion) should be added across all 5 consuming surfaces before merging, since none of them currently assert on formatted currency text.
- If (c) is chosen: `InlineMathInput.tsx:132,179` changes; `transaction.spec.ts:109` ("should evaluate inline math expressions correctly in amount field") already exercises this component and should be checked for an exact-string assertion that would need updating.
- If (a): no code change, but this audit note stands as the recorded answer to "why does the math input show unformatted numbers" for the next person who notices.

## Revisit if

A user-facing bug report cites the inconsistent formatting directly, or a new surface is added that reuses `mathEvaluator`'s `formattedValue` for something other than raw input-field text.
