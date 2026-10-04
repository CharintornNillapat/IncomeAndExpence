# 0058: A dialog isolates the page in the commit that shows it

**Status:** Accepted. Implemented on branch `phase-82-modal-inert-and-dialog-settle` (commit `4d9e34e`, docs `234eb2e`, hash backfill `9fbfe81`), merged into `main` as `bef52be` (PR #32). Vercel `dpl_9gzWuPDm3Hs3BtSHMjg6BngFs1HJ` is READY in production (`icn1`).
- **Amends** ADR `0047`: the background is still marked beside the dialog, never on `#root`; what changes is when.
- **Amends** audit 008's return of focus to the opener: the same opener, given focus in the closing commit.
- **Amended by** ADR `0059`: when React re-runs an open dialog's effects (StrictMode in development), focus goes back to the control that had it inside the panel.

**Date:** 2026-10-04

## Context

`Modal` recorded the opener, pushed itself on the dialog stack, marked the page behind it `inert` and moved focus inside in two passive effects. React runs a passive effect after the commit, and when the update was not a discrete event it runs it in a later task, after the browser may already have painted. Quick Add opens that way: its lazy chunk resolves, then the modal mounts on a default-priority update. So the first frame could show the dialog over a page that a screen reader could still enter and that took focus.

`account-and-mobile-nav.spec.ts`'s "the page behind Quick Add is inert while it is open" read that state once, as soon as the dialog's note field was visible. The spec this fixes was the flaky test on WebKit CI in 4 of the last 12 successful runs (`37170048902`, `37174477163`, `37178250544`, `37207717828`), each failing on the single read that saw the background not yet inert.

The second item was a WebKit click that waits 15 s for its button to be "visible, enabled and stable" and never gets there (Phases 63 and 81).

## Decision

### The background and focus move in the commit (layout effects)

- **The opener effect and the stack effect are `useLayoutEffect`**, in the same order: the opener is read before the stack effect moves focus into the panel. The background is inert and focus is inside before the browser paints the dialog.
- **Focus goes back to the opener in a second layout effect, on close.** A layout effect's cleanup runs in the commit's mutation step. React then puts focus back on the element that had it before the commit if it is still on the page, and a closing dialog's controls are, for the exit tween. A focus in the cleanup alone was undone (the unit suite showed 7 failures that way). The closing effect runs in the layout step, after that, and before paint. The cleanup still releases the background, and still focuses the opener, which is enough when the dialog unmounts.
- **A child that focuses itself** with `autoFocus` or its own layout effect keeps focus; one that focuses in a passive effect runs after `Modal` and takes it, as before.
- **No server render.** The app renders only in the browser, so `useLayoutEffect` needs no isomorphic guard.
- **The Tab trap and Escape listeners stay passive effects:** they answer events, which cannot arrive before the effects run.

### The spec retries, without moving focus while it waits

The spec polls a read-only check (the background inert, the dialog not, focus inside) with `expect.poll`, then makes one focus attempt on the background. Polling the old check would have called `focus()` on the background each time: one call before the background was inert would move focus out of the dialog for good.

### The WebKit stall gets no app change

**The WebKit "stable" stall is WebKit on Windows not painting, not the app.** Three failures were traced (`account-and-mobile-nav` after Quick Add closed, `smart-rules` on the first click after load, `categories` on a page form): in each the screencast's frames stop and no frame arrives until the 15 s timeout. Playwright's stable check measures the box on animation frames and logs "element is not stable" and retries when it moves; no failure logged a retry, so no frame ran at all. Two of the three had no dialog open. Linux WebKit on CI showed no such stall in the last 12 runs. Nothing in the app moves the button, so nothing in the app is changed for it. A change to the dialog's exit (no tween, a different overlay) would have been a guess, and two of the three stalls had no dialog.

**Rejected:**
- **Applying the marks during `Modal`'s render:** render must stay free of DOM writes, and a render React discards would leave marks behind.
- **A `MutationObserver` on the dialog's arrival:** a callback is a microtask after the commit, later than a layout effect for the same result.
- **Local retries or `force: true` clicks for WebKit:** retries hide a real failure in a local gate (ADR `0055`), and `force` skips the actionability checks every other click relies on.

## Verification

- **Unit:** `unit/modal-focus.test.tsx`, one new test (827 -> 828). It runs outside `act`, opens and closes the dialog on a default-priority update, and reads the page from a `MutationObserver` callback, which runs after the commit and before any passive effect. At open the background is inert, the dialog is not, and focus is inside; at close nothing is inert and focus is on the opener.
- **Negative controls:**
  - `main`'s `Modal`: the new test fails at open (background not inert, focus not inside), as CI's flaky reads did; the other 25 pass.
  - Both effects as layout effects but focus returned only in the cleanup: 7 tests fail (focus stays on the closing dialog's control).
- **E2E, stress:** the dialog spec (`account-and-mobile-nav.spec.ts`) 150/150 on WebKit (10 repeats); the inert test 30/30 across the three browsers (10 repeats); `debts-page` and `transaction-edit` 120/120 on WebKit (two runs of 10 repeats); the classifier spec 90/90 on WebKit.
- **E2E, full, 4 workers:** run 1 440/441 in 7.5 m (WebKit, the high-confidence classification test: the badge never appeared, no trace); run 2 440/441 in 11.1 m with traces on (WebKit, a Categories click stalled on "stable"); run 3 441/441 in 8.1 m, first pass. The whole WebKit project twice with traces on: 292/294, both failures the stall.
- **Lint** clean; **unit** 828/828 in 32 files.
- **Bundle** (the branch built with `.env` against production's files, which are `main`'s build byte for byte): the entry `index-*.js` 189,481 -> 189,653 B (+172 B, +61 B gzip), where `Modal` lives. Every other chunk is identical once hashed chunk names are normalised.

## Consequences

- **A new effect in `Modal` that changes what the page lets a person reach belongs in a layout effect;** an effect that only listens for events can stay passive.
- **Never focus in a layout cleanup and expect it to stick while the dialog stays mounted;** React's focus restore after the mutation step undoes it.
- **Still open:** WebKit on Windows stops painting a page now and then (about once in a few hundred runs here; not seen on CI's Linux WebKit). A failure's trace shows it: the screencast's last frame comes before the action, and none follow. The classifier test's one failure in run 1 has no trace and has not recurred in 90 repeats.
