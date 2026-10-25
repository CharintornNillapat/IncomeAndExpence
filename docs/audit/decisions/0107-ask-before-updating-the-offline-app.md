# 0107: Ask before updating the offline app

**Status:** Accepted
**Date:** 2026-10-25

## Context

In `vite.config.ts`, `registerType: 'autoUpdate'` was used with `vite-plugin-pwa`. Under `autoUpdate` mode, `vite-plugin-pwa` configures Workbox with `skipWaiting = true` and `clientsClaim = true`. A newly installed service worker takes control immediately, and the generated registration script listens for activation and invokes `window.location.reload()` automatically during active use.

This behavior creates visual and interactive disruption. Users actively recording transactions, reviewing budgets, or writing diary entries can have the page reload without warning, interrupting their workflow.

Furthermore, `src/components/ReloadPrompt.tsx` already contains an update notification banner that listens to `needRefresh` from `useRegisterSW`. In `autoUpdate` mode, `onNeedRefresh` is never called by the library runtime, rendering the "A new version is ready" notice and its Reload button dead code in production. Only the initial "Ready to use offline" notification could ever display.

## Decision

1. **Switch to prompt-driven service worker updates.** In `vite.config.ts`, change `registerType` from `'autoUpdate'` to `'prompt'`.
2. **User-controlled reload.** When a new version of the application deploys:
   - The new service worker installs in the background and remains in the `waiting` state.
   - `vite-plugin-pwa` fires `onNeedRefresh`, setting `needRefresh` to `true`.
   - `ReloadPrompt` renders the update notice ("A new version is ready") with the "Reload" button (`#pwa-reload-btn`).
   - Clicking "Reload" calls `updateServiceWorker(true)`, dispatching `SKIP_WAITING` to the waiting service worker. Upon activation, the page reloads cleanly under user direction.
   - Clicking "Dismiss" or the close button calls `close()`, hiding the notice and leaving the new service worker in the `waiting` state. The update will take effect the next time all open tabs of the app are closed, or when a waiting worker is detected on a subsequent visit.
3. **Hourly checks retained.** The hourly update check interval (`setInterval(() => r.update(), 60 * 60 * 1000)`) in `ReloadPrompt.tsx` remains in place to detect new service worker versions while the application stays open.

## Amends

- **ADR 0041 (toast placement and 44px hit boxes):** Retains toast placement (`bottom-[calc(5rem+env(safe-area-inset-bottom,0.5rem))] md:bottom-5 right-5`) and 44px button sizing (`#pwa-reload-btn`, `#pwa-dismiss-btn`). ADR 0041 addressed placement and accessibility, not update lifecycle policy; this ADR defines the update policy.
- **ADR 0042 (toast layering):** Retains `z-45` layering (above chrome at `z-40`, below `Modal` at `z-50`).

## Verification

- **Unit:** `unit/reload-prompt.test.tsx` verifies that `vite.config.ts` declares `registerType: 'prompt'` and no longer contains `registerType: 'autoUpdate'`. It also verifies `<ReloadPrompt />` rendering in prompt mode, that Reload calls `updateServiceWorker(true)`, and that Dismiss clears notification flags.
- **Production build inspection (Gate 5):** Inspection of `dist/sw.js` confirms that `SKIP_WAITING` message listener is present, while `clientsClaim` and immediate `self.skipWaiting()` invocations are absent (`SKIP_WAITING true`, `clientsClaim false`, `skipWaiting call false`).
- **E2E:** Playwright suite runs `tests/toast-layering.spec.ts` against the development service worker server on port 3100.

## Consequences

- The app no longer reloads automatically while the user is interacting with it.
- **Known edge:** Dismissing the prompt keeps the current session on the previous version until all tabs are closed or until the user accepts a subsequent prompt. Old precached assets remain available in cache, allowing lazy chunks of the current session to continue loading reliably.
- **First deploy transition:** The very first deployment of this change will still be received by clients running under the previous `autoUpdate` service worker, which reloads one final time according to the old policy. All subsequent updates will prompt before reloading.

## Not done

- Adding an idle timer or countdown for automatic reload.
- Adding changelog or release note text inside the prompt.
- Adding a Playwright test simulating two full service worker versions (requires two production builds and server deployment).
