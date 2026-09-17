# 0002 — Rejected: hand-rolled selector subscriptions via `useSyncExternalStore`

**Status:** Proposed
**Date:** 2026-09-17

## Context

React 19 is in use. `useSyncExternalStore`-style selector subscriptions would give true per-selector re-render granularity — closer to what Redux/Zustand provide — without changing the "no second state library" rule on its face. Worth ruling in or out explicitly before committing to ADR `0001`'s value-split approach.

## Options considered

**Adopt `useSyncExternalStore` with per-field selectors**, so a component reading only `wallets` never re-renders when `transactions` changes, regardless of context shape.

**Reject it**, in favor of the value split in `0001`.

## Decision

**Reject, for now.** Three concrete reasons:

1. **It needs a dependency anyway.** `useSyncExternalStoreWithSelector` — the version with selector memoization and an equality function — is **not** exported from `react`. It lives in the separate `use-sync-external-store/shim/with-selector` package. Bare `useSyncExternalStore` has neither: a selector returning `wallets.filter(...)` would re-render on every store notification (new array each time), and a selector returning an object would loop infinitely without a custom equality check.
2. **It is a second state library, written in-house.** Hand-rolling the listener store and its selector cache inside `FinanceContext.tsx` satisfies the letter of "do not add Redux/Zustand" while violating its spirit, and gives up React's automatic batching semantics for store notifications along the way.
3. **The cost/benefit is wrong at this size.** After ADR `0001`'s split lands (T13/T14), the remaining re-renders are components displaying data that actually changed — not spurious re-renders from an over-broad subscription. There is no measured problem left for selectors to solve.

## Consequences

- `use(Context)` (React 19's other new primitive) is also not adopted here for the same underlying reason: it permits conditional/in-loop context reads, but does not change subscription granularity. A component calling `use(FinanceContext)` still re-renders on every value change.
- If a future measurement shows otherwise, this is the documented escape hatch — see Revisit-if.

## Revisit if

Post-Phase-5 (ADR `0001`) re-render counts, measured via the S1-S5 scenarios in `baseline-metrics.md`, remain above target for a specific component that only reads a narrow slice. At that point, re-evaluate `use-sync-external-store/shim/with-selector` as an explicit, reviewed dependency addition — not a hand-rolled equivalent.
