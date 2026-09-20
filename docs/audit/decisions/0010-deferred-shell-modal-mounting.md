# 0010 — Shell modals mount on first open, behind `React.lazy` and a `hasOpened` latch

**Status:** Accepted
**Date:** 2026-09-20

## Context

`App.tsx` mounts four shell-level modals unconditionally: `AuthModal`, `QuickAddModal`, `TransferFundsModal`, `AddWalletModal` (ADR 0008 established this shell-level, self-subscribing pattern for the latter two). All four are eagerly imported at the top of `App.tsx`, so their code — and everything they import — lands in the entry chunk fetched before first paint, even though none of the four is visible or usable until a user taps a button.

`perf-audit-report.md` (§D, finding D12) identified the concrete cost: `mathjs/number` (`vendor-math`, 375.73 kB raw / **110.72 kB gzip** — unchanged since Phase 3/T7) is reachable eagerly *only* through `QuickAddModal → TransactionForm → InlineMathInput → mathEvaluator` and `TransferFundsModal → WalletTransferForm → InlineMathInput`. Removing these two modals (and `AddWalletModal`, which pulls in `AddWalletForm`) from the eager import graph takes the single largest vendor chunk in the app off the initial critical path — a bigger win than any plausible entry-chunk-only optimization.

`AuthModal` is explicitly **not** in this decision's scope. Its own eager dependencies (`zod`, `@supabase/supabase-js`) are already eager via `FinanceContext.tsx` regardless of `AuthModal`'s own import status, so deferring it would not remove any vendor weight from the critical path — only add a second `React.lazy` boundary for no bundle benefit.

## Why a bare `React.lazy` swap does not work

The naive fix — replace the three static imports with `React.lazy(() => import(...))` and leave the JSX at `App.tsx:253-261` unchanged — was checked against the actual code and found to be both **ineffective and broken**:

1. **It would not defer anything.** The three components are still rendered unconditionally (`<QuickAddModal isOpen={isQuickAddOpen} ... />`), just now behind a lazy wrapper. React resolves a lazy component's dynamic `import()` the moment it is rendered, not the moment its `isOpen` prop becomes `true`. The chunk fetch would still fire at first paint — buying nothing.
2. **It would throw.** A component wrapped in `React.lazy` that suspends needs a `<Suspense>` ancestor. The only `<Suspense>` boundary in `App.tsx` wraps `<main>` (`:211`), which does not cover the modals rendered after it (`:236-261`). Rendering an unwrapped lazy component that suspends throws immediately.

Both problems are solved by not rendering the modal element at all until its first `onOpen` call, and only then keeping it mounted permanently.

## Options considered

**(a) Gate the wrapper element on the bare `isOpen` boolean:** `{isOpen && <Suspense><QuickAddModal isOpen={isOpen} .../></Suspense>}`. Rejected. The moment `isOpen` flips back to `false` — including the delayed `false` `TransferFundsModal`'s own success flash sets via `flashTransferStatus(..., 1000, onClose)` (`TransferFundsModal.tsx:54`) — the wrapper element disappears from the React tree in the same commit. `Modal.tsx`'s internal `<AnimatePresence>{isOpen && ...}</AnimatePresence>` (`Modal.tsx:77-78`) never gets the chance to run its exit animation, because `AnimatePresence` itself is removed from the tree instantly rather than being given a render where `isOpen` is `false` and the exiting child is still mounted. The panel would vanish instantly instead of springing out, and `wallet-forms.spec.ts`'s assertion on the "Transfer completed successfully!" flash text would race against a component that no longer exists.

**(b) A `hasOpened` latch that flips `true` on first open and never flips back**, rendering `{hasOpened && <Suspense fallback={null}><Modal isOpen={isOpen} .../></Suspense>}`. Chosen. The wrapper (and therefore the dynamic import, `Suspense` boundary, and the modal's own internal `AnimatePresence`) mounts once, on first open, and stays mounted for the rest of the session — `isOpen` alone continues to drive open/close exactly as it did when these modals were unconditionally mounted. `Modal`'s exit animation and `TransferFundsModal`'s delayed close both keep working because the component doing that animating is never removed from the tree.

## Decision

**(b).** `App.tsx` gains three latches — `hasOpenedQuickAdd`, `hasOpenedTransfer`, `hasOpenedAddWallet` — each a plain `useState(false)`, each set to `true` inside the corresponding `handleOpen*` callback (alongside the existing `setIsOpen(true)` and, for transfer, `setTransferSourceWalletId`). `QuickAddModal`, `TransferFundsModal`, and `AddWalletModal` become `React.lazy` imports, matching the exact pattern the 7 view components already use (`.then(m => ({ default: m.X }))`). Each is rendered behind its own `<Suspense fallback={null}>`, itself gated by its latch:

```tsx
{hasOpenedQuickAdd && (
  <Suspense fallback={null}>
    <QuickAddModal isOpen={isQuickAddOpen} onClose={handleCloseQuickAdd} />
  </Suspense>
)}
```

`fallback={null}` (not `<ViewLoadingFallback />`) because the chunk fetch on first open is expected to resolve well within the time it takes a user to notice — these are small, focused component chunks, not full views — and a visible loading state would flash the moment a button is tapped, before the modal's own opening animation would otherwise begin.

**`AuthModal` and `ReloadPrompt` are unchanged — both stay eagerly mounted, for different reasons.** `AuthModal` is out of scope per the Context section above (no bundle weight to remove). `ReloadPrompt` is excluded on correctness grounds: `useRegisterSW` (`ReloadPrompt.tsx:9`) registers the PWA service worker as a side effect of mounting. Deferring its mount behind any gate — a latch, a lazy boundary, anything short of what already happens today — would delay or skip service-worker registration for users who never trigger whatever gate is chosen, which is the opposite of what a PWA needs.

## Consequences

- **`vendor-math` (110.72 kB gzip) leaves the initial critical path.** It remains reachable — the moment a user opens Quick Add or Transfer, its chunk (along with `TransactionForm`, `InlineMathInput`, `mathEvaluator`, and friends) fetches on demand.
- **First tap of Quick Add / Transfer / Add Wallet now costs one dynamic `import()`** that did not exist before. On a warm cache (repeat visits) this is effectively free; on a cold cache it is one additional network round-trip, paid once per session, in exchange for not paying it on every session regardless of whether these modals are ever opened.
- **The three latches are permanent for the session, by design.** Closing and reopening the same modal does not re-trigger the dynamic import or re-mount the wrapper — only `isOpen` toggles, exactly matching the pre-ADR-0008 behavior these modals already had (mount once, toggle visibility via `isOpen`).
- **Test timing risk is real but bounded and already mitigated elsewhere in this suite.** Every spec that opens one of these modals already retries via Playwright's auto-waiting assertions (`helpers.ts`'s `addQuickTransaction`, `wallet-forms.spec.ts`'s direct clicks) rather than asserting on a fixed timeout, so the extra dynamic-import resolution falls inside the existing retry window. Firefox under the Vite dev server is this suite's known slow-chunk-fetch case (`playwright.config.ts`'s generous Firefox timeouts, `CLAUDE.md`'s own note on this); the verification gate for this phase runs the affected specs with `--repeat-each=2` specifically to catch a flake this change could introduce that a single run would not.

## Revisit if

- A 4th shell-level modal is added whose own dependencies are already eager elsewhere (matching `AuthModal`'s situation here) — it does not need this pattern; only modals that uniquely reach otherwise-deferrable weight benefit from it.
- Vite or React ships a way to prefetch a lazy chunk on hover/focus of its trigger button without fully mounting the component — revisit whether an idle-time or hover-triggered prefetch would remove the first-tap latency this decision accepts, while keeping the chunk off the unconditional critical path. `perf-audit-report.md` names this as a possible follow-up, deliberately not bundled into this phase so the entry-chunk measurement stays attributable to the latch pattern alone.
