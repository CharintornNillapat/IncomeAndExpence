# 0108: Shell dialogs mount at idle, so a first open is instant

**Status:** Accepted
**Date:** 2026-10-25

## Context

Signed in on production, the entry popup that Navbar's "Add entry" button opens closes again right after the first page load. Investigation into this behavior revealed the following sequence and root cause:

1. **First open mounts a Suspense boundary.** In `src/App.tsx`, four shell dialogs (`QuickAddModal`, `TransferFundsModal`, `AddWalletModal`, `AccountModal`) are dynamic `React.lazy` imports wrapped in individual `<Suspense fallback={null}>` boundaries. Per ADR 0010, each sits behind a `hasOpened*` latch initialized to `false`, which flips to `true` only when an opener callback is invoked. When a user clicks "Add entry", the click flips `hasOpenedQuickAdd` from `false` to `true`, mounting the `<Suspense>` boundary for the first time. Even if the module chunk is already cached or in memory, `React.lazy` suspends on its initial render pass, causing the boundary to commit its `null` fallback.
2. **React Suspense reveal throttle delays appearance.** React (specifically `react-dom` 19.2.8) throttles retries that reveal Suspense fallback content to at least 300 ms after the most recent fallback commit (`globalMostRecentFallbackTime + 300 - now()`). Measurements on production builds showed that click-to-dialog on first open across browsers takes 333 to 375 ms (and 650 to 1,400 ms under 6x CPU mobile throttling), whereas subsequent opens of an already-mounted dialog take only 17 to 65 ms because only `isOpen` toggles without mounting a Suspense boundary.
3. **Repeat clicks land on the dialog scrim.** During this 300 ms silent gap, nothing changes visually on screen. When the user taps or clicks "Add entry" a second time in reaction to the lack of immediate visual feedback, the dialog has just mounted. The dialog backdrop/scrim (`Modal.tsx`) spans `fixed inset-0`. The second click hits the scrim outside the modal panel, which triggers `onClose` and closes the newly opened dialog immediately.
4. **Why this appears right after load and when signed in.** Only the very first open of a dialog encounters the unmounted Suspense boundary; subsequent opens toggle `isOpen` on an already-mounted component. Signed-in boots are busier (loading Supabase libraries, running cloud hydration queries, establishing realtime sockets), lengthening initial browser responsiveness and increasing the likelihood of a user tapping twice.
5. **Ruled out causes.** Tested against production builds with simulated signed-in sessions: a single click never closed the dialog across Chromium, WebKit, or Firefox at 1x or 6x CPU throttling. Expired token refreshes, background cloud hydration latencies, template presets in storage, and toast mounts ("Ready to use offline" or "A new version is ready") were all verified not to remount `MainApp` or dismiss open modals. The sole cause is the repeat tap landing on the scrim due to Suspense boundary reveal latency.
6. **Instant opening when pre-mounted.** When a modal is already mounted in the React tree in a closed state (`isOpen = false`), a click toggles `isOpen = true` synchronously within a React SyncLane update flushed in a microtask, committing immediately with zero boundary fallback and zero throttle (17 to 65 ms).

## Decision

The idle callback in `src/App.tsx` that preloads tab views (`preloadViews`) via `runWhenIdle` will also flip the four modal latches (`setHasOpenedQuickAdd(true)`, `setHasOpenedTransfer(true)`, `setHasOpenedAddWallet(true)`, `setHasOpenedAccount(true)`).

As a result, `QuickAddModal`, `TransferFundsModal`, `AddWalletModal`, and `AccountModal` mount in the background in a closed state during browser idle time shortly after first paint. When the user subsequently clicks any of their trigger buttons, the modal is already mounted; the click only flips `isOpen` to `true`, committing the modal in the click's own update instantly without hitting a Suspense boundary or React's 300 ms reveal throttle.

The modal open handlers retain their explicit `setHasOpened*(true)` calls as a safety fallback in the event that a user clicks a trigger before the idle callback has executed.

## Amends

- **ADR 0010 (deferred shell modal mounting):** The `hasOpened*` latches now flip at idle time as well as on first click, directly fulfilling the idle-time prefetch pattern suggested in ADR 0010's "Revisit if" section to eliminate first-tap latency while preserving exit transitions.
- **ADR 0104 (preload tab views):** The idle callback scheduled via `runWhenIdle` now mounts the four shell dialogs in addition to preloading the six tab views.

## Verification

- **Tests:** Four new automated Playwright tests in `tests/tab-preload.spec.ts` verify that each shell dialog (`QuickAddModal`, `TransferFundsModal`, `AddWalletModal`, and `AccountModal`) opens within the click's own macrotask without Suspense delay after idle preload. Verified red before the fix (failing due to Suspense latency) and green after across Chromium, Firefox, and WebKit.
- **Gates:** Full unit test suite (`npm run test:unit`) and Playwright test suite (`npm test`) passing with clean lint checks.

## Consequences

- Every page load (guest and signed in) fetches the four modal chunks during idle time (approximately 29 KB raw total: `QuickAddModal` 2,497 B, `TransferFundsModal` 6,986 B, `AddWalletModal` 2,955 B, `AccountModal` 16,577 B). Shared dependencies like `TransactionForm` are already fetched by the tab-view preload.
- Initial critical-path bundle size is unaffected; the entry chunk does not change.
- `QuickAddModal` and `TransferFundsModal` subscribe to finance context from idle time instead of from first open. While closed, `Modal` renders `null` through `Presence`, making re-renders on ledger writes cheap. This matches the exact behavior that previously occurred after a first open.
- The first open of any shell dialog is instant, preventing user confusion and double-tap scrim closures.

## Not done

- Eliminating the slow path for clicks that occur before the idle callback runs (idle callback typically fires ~240 ms after navigation; capped at 3 s by `runWhenIdle`).
- Adding a guard or delay on scrim clicks (closing on outside click is intended behavior).
- Adding loading spinners or state to trigger buttons.
- Importing `@supabase/supabase-js` during guest sessions (none of the four modal components imports Supabase at runtime).
