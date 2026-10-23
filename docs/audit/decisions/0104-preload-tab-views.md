# 0104: Preload tab views at idle time via lazyView and use()

**Status:** Accepted
**Date:** 2026-10-23

## Context

The app code-splits its six top-level views (`DashboardView`, `TransactionsView`, `WalletsView`, `DebtsView`, `DiaryView`, `CategoriesView`) via dynamic `import()` wrapped in `React.lazy`. Under that setup, nothing requests a view chunk until the user first switches to its tab, at which point `<Suspense>` commits `ViewLoadingFallback` while the chunk is fetched and evaluated.

A measured experiment (React 19.2.8, jsdom) showed that early dynamic `import()` alone is insufficient when keeping `React.lazy`: a `React.lazy` component whose chunk has already loaded still suspends on its first render pass, committing the fallback skeleton, and React's fallback throttle keeps the skeleton mounted for about 260 ms before rendering the view.

However, React 19's `use()` hook returns a thenable's value synchronously on the initial render pass when `status === 'fulfilled'` and `value` are attached to the promise. A custom loader that marks the promise fulfilled upon settlement avoids suspending entirely when preloaded, rendering the tab view on the first pass with zero fallback commits.

## Options considered

**(a) Idle-time `import()` calls with the views kept on `React.lazy`.**
Rejected. As measured, `React.lazy` still suspends on its first render even when the chunk is already cached or resolved in module memory, committing the fallback and holding the skeleton visible for ~260 ms due to React's fallback throttle.

**(b) A small `lazyView` helper that wraps dynamic `import()` in a memoised promise read with `use()`, marking the promise fulfilled when settled.**
Chosen. `lazyView` tracks the promise, attaches `.then` to mark `status = 'fulfilled'` and `value = Component`, and exposes a `preload()` function. Reading the fulfilled promise with `use()` renders immediately without suspending if preloaded. If not preloaded or still in flight, it suspends within `<Suspense>` as normal.

**(c) `<link rel="modulepreload">` in `index.html`.**
Rejected. The inline script hash in `index.html` is pinned in `vercel.json`'s Content Security Policy (`script-src`), and Vite manages chunk hashing and entry preload lists during bundling.

**(d) Keep all views mounted simultaneously.**
Rejected. ADR 0005 already considered and rejected keeping all views mounted, to prevent 6 heavy view trees from concurrently subscribing to context and retaining memory. ADR 0005 is not reopened.

## Decision

**(b).** Implement `src/utils/lazyView.tsx` exporting:
1. `lazyView`: wraps a dynamic component loader in a memoised thenable, tagging `status = 'fulfilled'` and `value = Component` upon resolution. A rejection clears the memoisation so subsequent navigation attempts can retry.
2. `runWhenIdle`: schedules idle execution using `requestIdleCallback(fn, { timeout: 3000 })` when available, falling back to `setTimeout(fn, 1000)` on platforms lacking `requestIdleCallback` (e.g., Safari), returning a cleanup cancellation callback.

In `src/App.tsx`, convert the six view definitions from `React.lazy` to `lazyView`, and trigger their preloading during idle time via `useEffect(() => runWhenIdle(preloadViews), [])`. The shell modals (`QuickAddModal`, `TransferFundsModal`, `AddWalletModal`, `AccountModal`) remain on `React.lazy` per ADR 0010.

## Consequences

- Tab switches after idle time render instantly without flashing `ViewLoadingFallback`.
- First visit to a tab before the idle preload finishes (or under slow network conditions / offline cold start) still suspends and displays `ViewLoadingFallback`.
- If an idle preload fails (e.g., network drop), the error is caught and the memoised promise is cleared, allowing a subsequent tab click to retry fetching the chunk cleanly.
- The `key={activeTab}` unmount and remount behavior established in ADR 0005 remains intact.
- On cold initial load, idle time spends 5 additional chunk network requests. Because the service worker precaches application JS assets, repeat visits serve these from cache.

## Revisit if

A view chunk grows large enough that idle network usage becomes an issue on metered mobile connections (a `navigator.connection.saveData` or `effectiveType` gate was deliberately omitted to keep the implementation minimal).
