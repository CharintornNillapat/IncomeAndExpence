# 0009 — `AnimatedCounter` writes its animated value directly to the DOM, bypassing React

**Status:** Accepted
**Date:** 2026-09-20

## Context

`AnimatedCounter` (`src/components/AnimatedCounter.tsx`) animates a numeric value over `duration` seconds (default 1.2s) using framer-motion's imperative `animate()` API driving a `useMotionValue`. Before this decision, its `onUpdate` callback called `setDisplayValue(latest.toLocaleString(...))` on every animation-frame tick — roughly 60 times per second for the animation's duration, so ≈70-85 `setState` calls, each triggering a React re-render of the component, per animation.

`baseline-metrics.md`'s existing S1/S2 Profiler harness (captured in Phase 4, before this decision) already measured `AnimatedCounter` at **590 renders during S1 (cold load)** and **636 renders during S2 (one ledger write)** — an order of magnitude above every other component in that table, and the harness's own notes flag the *magnitude* as run-to-run noisy (236-596 across three runs for S1 alone) because it is driven by `requestAnimationFrame` timing rather than discrete state transitions. The noise does not change the finding: this is by a wide margin the single largest source of React render work in the app, and it fires on every dashboard load and every wallet-balance-changing write, because `AnimatedCounter` is mounted once per wallet card (`WalletAccountsGrid.tsx`, `WalletsView.tsx`), three times in `CashflowMetricsCards.tsx`, once in `TotalWealthHero.tsx`, and once, permanently, in `NavbarLedgerStatus.tsx` — a single write can restart 6+ of these simultaneously.

The component's *visual* behavior — a snappy, currency-formatted count-up animation — is correct and not in question. Only the mechanism producing it (a `setState` call per frame) is the problem.

## Options considered

**(a) Leave it as `setState` per frame.** Rejected — this is the status quo the audit report (`perf-audit-report.md`, §C) identifies as the largest single runtime cost in the app. Every render this produces does real work (reconciliation, `React.memo` prop comparisons on parents/siblings) for output nobody but this one `<span>` needs to see.

**(b) `useTransform(count, formatter)` rendered as a `motion.span`'s `children`, so framer-motion's own optimized subscription model drives the text instead of a raw `setState` call.** Rejected. `useTransform` still ultimately re-renders the subscribing React component on every source-value update *unless* the transformed value is rendered through a `motion.*` component's own prop (e.g. bound directly to a DOM attribute framer-motion writes outside React's render cycle). Framer-motion does not offer a built-in way to bind a `MotionValue<string>` to a plain text node's content the way it can bind a `MotionValue<number>` to `opacity` or `x` — text content is not one of the DOM properties framer-motion's animation engine writes directly. Routing the formatted string through `motion.span`'s children would still flow through React's reconciler once per frame, keeping the exact cost this decision exists to remove.

**(c) Write the formatted string directly to a ref'd `<span>`'s `textContent` inside `onUpdate`, rendering that span with zero React children.** Chosen.

## Decision

**(c).** `AnimatedCounter` replaces its `useState<string>` with a `useRef<HTMLSpanElement>(null)`. The `animate()` call's `onUpdate` callback writes `valueRef.current.textContent = latest.toLocaleString('en-US', CURRENCY_DISPLAY_OPTIONS)` directly, with no `setState` involved. The rendered `<span ref={valueRef} />` has no React children — an element with no children is never touched by reconciliation on an unrelated parent re-render, so the direct DOM writes persist untouched between animation frames and across any number of parent re-renders that don't change `value` itself.

A `useLayoutEffect` (deps `[]`, mount-only) seeds the span's initial text to `(0).toLocaleString('en-US', CURRENCY_DISPLAY_OPTIONS)` before first paint — the same `'0.00'` the old `useState` initializer produced — so there is no empty-span flash on mount while the animation effect arms. This mirrors the pre-refactor mount sequence exactly: the old code showed `'0.00'` synchronously (its `useState` initial value) before the animation's first `onUpdate` fired; the new code shows the same string via a layout effect that runs before the browser paints, at the same point in the commit lifecycle.

**`currencyPrefix`, `duration`, and the `[0.16, 1, 0.3, 1]` ease curve are unchanged** — this is a mechanism change only, not a behavior or timing change. `count` (the `useMotionValue`) and the `animate()`/cleanup (`controls.stop()` on unmount or `value`/`duration` change) are also unchanged.

**ADR 0004's currency-formatting exemption is untouched by this decision.** `AnimatedCounter` still calls `toLocaleString('en-US', CURRENCY_DISPLAY_OPTIONS)` — the same shared constant `formatCurrencyAmount` uses, per `utils/currency.ts`'s own comment — and still does not call `formatCurrencyAmount` itself, for the same reason ADR 0004 already recorded: it needs to format a `MotionValue`'s in-flight numeric ticks, not a single settled amount. Only *where* that formatted string is written (a ref'd DOM node instead of React state) changed.

## Consequences

- **Zero React re-renders during the animation.** The component still re-renders when its own props (`value`, `duration`) change — that render restarts the `animate()` call in the effect — but the ~70-85 intermediate frame updates during the animation itself no longer touch React at all.
- **The 6 call sites are unchanged**: `CashflowMetricsCards.tsx`, `TotalWealthHero.tsx`, `WalletAccountsGrid.tsx`, `NavbarLedgerStatus.tsx`, `WalletsView.tsx` all pass the same `value`/`currencyPrefix`/`duration` props as before; none needed to change.
- **`AnimatedCounter` can no longer be tested by asserting a `useState` value or by counting its own render count as a proxy for "did the number update."** Its committed text is read the same way a user or Playwright reads it — via the DOM (`toContainText`/`textContent`) — which every existing spec asserting on a counter's displayed value (`date-boundary.spec.ts`, `theme.spec.ts`, `wallets.spec.ts`, `transaction.spec.ts`) already does. None of those assertions depend on React's render count, so none needed to change.
- **A future contributor must not add a React child to the ref'd `<span>`.** Doing so would reintroduce exactly the cost this decision removes on the next parent re-render (reconciliation would diff and potentially overwrite the directly-written `textContent`). This is recorded as a `CLAUDE.md` constraint (Phase 37) rather than left only in this ADR, so it surfaces at the point someone edits the component, not only when they go looking for why it's structured this way.
- **The Profiler-based S1/S2 numbers in `baseline-metrics.md` are not re-captured by this phase's own gate** — the Playwright suite (`npm run lint`, targeted specs, full 102-run suite, `npm run build`) proves the refactor is behaviorally identical and doesn't regress anything Playwright can see, but the render-count claim (~590/636 → ~8-12) requires re-running the same disposable `<Profiler>` instrumentation branch the original numbers came from, which is not part of the standard CI-facing gate. See this phase's `refactor-log.md` entry for whether that re-measurement was performed and what it found.

## Revisit if

- Framer-motion ships a first-class way to bind a `MotionValue<string>` to a DOM node's text content declaratively (closing the gap option (b) hit) — re-evaluate whether the ref-based approach is still the simplest correct one, or whether the library's own primitive should replace it.
- A future consumer needs `AnimatedCounter` to expose its current formatted value to a parent (e.g., for an accessibility live-region announcement keyed off the settled value) — that would need either an `onSettled` callback fired from `animate()`'s own completion, or a `MutationObserver` on the ref, not a re-introduction of `setState` per frame.
