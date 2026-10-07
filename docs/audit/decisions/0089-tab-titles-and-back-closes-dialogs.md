# 0089: The title names the open tab; Back closes the top dialog

**Status:** Accepted. Code `c8afa5a`, docs `9952c1c`, draft PR #64; not merged. No migration.
- **Completes** audit finding 14 (ADR `0088`): a history entry and a bookmark now carry the tab's name.
- **Amends** ADR `0043` (what closes a dialog: Back joins Escape and the close button) and ADR `0088` (a tab change from inside a dialog replaces the dialog's history entry).

**Date:** 2026-10-08

## Context

1. Since ADR `0088` every tab has its own URL, but every page was titled "FinLife Tracker", so the browser's history list and a bookmark could not tell the tabs apart.
2. Back changed the tab under an open dialog: on a phone, the way out of a bottom sheet took the page away and left the sheet open over the next tab.
3. The local WebKit stall (ADR `0058`) hit the two Phase 112 specs 2 times in 90.

## Decision

1. **`document.title` is `titleForTab(activeTab)`** (`src/utils/tabRoute.ts`): "FinLife Tracker" for the Dashboard, and "<label> · FinLife Tracker" for the rest, with the navigation's own labels ("Debt payoff · FinLife Tracker"). `App.tsx` sets it in an effect on the tab, so Back and Forward restore it with the tab.
2. **Every open dialog has a history entry of its own, on the same URL** (`src/utils/modalHistory.ts`, used by `Modal`, so every dialog has it):
   - **Back closes the top dialog only, through its `onClose`,** as Escape does, so focus returns to the opener. No dialog refuses its `onClose`, so Back always closes. The tab and the URL stay.
   - **A dialog closed any other way takes its entry off** (`history.back()`, a microtask after the close), so the next Back changes the tab instead of being spent on nothing.
   - **A dialog that opens over an entry whose dialog has just closed replaces it** instead of pushing above it: Quick Add handing off to Transfer leaves one entry, and so does StrictMode's effect re-run of a new dialog.
   - **A tab change from inside a dialog replaces the dialog's entry** (`handleTabChange`): Quick Add's Repay debt link and the More sheet's tabs, so Back returns to the tab the dialog was opened on.
   - **Removing an entry lands a task or more later, and that landing is the app's own** (`isOwnTraversal`): no dialog takes it for Back, and a dialog that opens meanwhile gets its entry once it has landed. Without this, the next dialog opened right after a close was closed by the landing.
   - **Forward onto a closed dialog's entry steps back off it,** and a reload on a dialog entry clears it, since no dialog is open after a reload. Forward never reopens a dialog.
3. **No change to the specs for the WebKit stall.** The two Phase 112 specs, now 11 tests, passed 330 of 330 on WebKit (30 repeats) before any change, so there was nothing a change could be measured against. The three earlier stalls each began with a click during a 200 ms tween (a tab slide, Quick Add's entrance and exit). That is the next thing to test if the stall returns: wait for running finite animations to end before the click in the shared helpers.

## Not changed

- **A Back that skips more than one entry** (a long press on the Back button) closes only the top dialog.
- **The firewall, the proxies and the routing of ADR `0088`** are as they were.

## Tests

- **`unit/modal-history.test.tsx` (new, 6),** under `StrictMode` with jsdom's real history: one entry per dialog on the same URL; Back closes it; a close by its button leaves no entry; Back closes only the top of two; a hand-off leaves one entry; a dialog opened while a closed one's entry is coming off stays open with its own entry. Controls: without the release, the button test fails; without the own-traversal check, the last test fails. 8 existing unit tests (the CSV import's) failed on the version without that check, which is how it was found.
- **`unit/tab-route.test.ts`:** `titleForTab` for every tab (+6).
- **`tests/routing.spec.ts` (+5):** the title follows the tab and Back restores it; Back closes Quick Add, keeps the tab and returns focus to its button, and the next Back changes the tab; a close by the button leaves no Back step; Quick Add handing off to Transfer leaves one; Quick Add's Repay debt link takes the dialog's place. The title, Back and hand-off tests failed first; the other two guard against a stray entry.
- **Gate:** lint clean; unit 1296/1296 in 56 files; Playwright, first run 485 passed, 6 skipped, 1 failed of 492 (7.1 m): a WebKit click in the unchanged `transaction.spec.ts` waiting on "stable", with no trace kept; second run 486 passed, 6 skipped, no failure (11.6 m, traces on); schema drift run `37697554162`: no drift, 19 migrations.
- **WebKit:** the two Phase 112 specs (11 tests now) passed 330 of 330 on WebKit before any change, so no spec was changed for the stall. The first full run's one failure (the `transaction` spec's Clear search click) had the stall's shape; that spec and `wallets-page` passed 100 of 100 on WebKit on this branch, as on `main` in Phase 112, and the second full run was clean.
- **Bundle:** the entry +1,615 / +485 B gzip (`Modal` and `modalHistory` are in it); all app JS the same; cold start still three scripts.
