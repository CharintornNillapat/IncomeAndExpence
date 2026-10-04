# 0057: Warm the PWA test server before the run, and seed the amount field during render

**Status:** Accepted. Implemented on branch `phase-81-test-warmup-and-math-seed` (commit `a3b3365`, docs `05ee7ef`, backfill `ff23c04`, CI fix `b56c98b`, its docs `e141f05`), merged into `main` as `f1606bc` (PR #31). Vercel `dpl_Bzm9xE7SzNwfyomR92NSj2WG9hvv` is READY in production (`icn1`).
- **Closes** the two items ADR `0056` left open: the cold port-3100 near miss and `InlineMathInput`'s seed effect.

**Date:** 2026-10-04

## Part 1: the PWA server is warmed before any worker starts

### Context

`toast-layering.spec.ts` is the only spec on Playwright's second webServer, `vite --mode pwa-dev` on port 3100 (ADR `0042`). A webServer counts as ready when its HTML answers, but Vite compiles modules only when a browser asks for them, each server keeps its own transform cache, and vite-plugin-pwa builds its development service worker on first request. So the first test to open 3100 paid for all of it inside its own timeouts.

Measured on the 12-thread machine these phases run on (chromium, the spec alone unless stated):

| Run | Each test |
|---|---|
| Phase 80's full run, 4 workers | 28.5 s and 29.4 s |
| First run of the day, fresh servers | 33.9 s and 34.3 s |
| Later runs, fresh servers, no warm-up | 5.6 to 10.4 s |
| A second load on a warm server | 0.7 s |

A probe that timed each stage of a fresh load put the page's `load` event at 0.5 to 1.4 s and the toast at 3.5 to 5.0 s: most of a cold first load is the service worker's first build and install, not the navigation.

**Correction to ADR `0056`:** it measured the near miss "against the 30 s navigation timeout". The 34 s tests passed, so the navigation was not the limit at stake. What a cold load runs into is the spec's 45 s wait for the toast and the 60 s test timeout.

### Decision

- **`tests/global-setup.ts`, wired as `globalSetup` in `playwright.config.ts`.** Playwright starts both webServers, then runs it, then starts the workers. It opens `http://localhost:3100/` in a throwaway chromium and waits until the page has loaded and a service worker is active, with a 120 s limit (the webServers' own). It prints the time it took.
  - **The wait survives a reload:** an init script sets a flag when `navigator.serviceWorker.ready` resolves, in every page it loads, and `waitForFunction` polls for it (see "Found on CI").
- **A failure warns and carries on.** Every other spec runs on 3000, so a broken 3100 fails the two toast tests, not the whole run. A chromium that does not launch skips the warm-up the same way.
- **No timeout changes.** The spec keeps its 45 s toast wait, and the config keeps its 30 s navigation and 60 s test timeouts.

**Rejected:**
- **A longer timeout for the spec:** the cold cost stays inside a test and its tail keeps growing with load; a bound is not a fix.
- **A `beforeAll` warm-up in the spec:** it runs per worker, in the middle of the run, when the other workers are busy, which is when the cold load was slowest.
- **Vite's `server.warmup`:** it starts compiling at server start, but nothing waits for it to finish, and it puts a test concern in `vite.config.ts`.
- **Warming port 3000 too:** nothing on it is measured to need it.

## Part 2: `InlineMathInput` applies a seed during render

### Context

ADR `0056` left one effect with its shape: `InlineMathInput` put a `seed`'s text in the field, and reported its amount to the caller, in a passive effect after the render that carried it. Two consequences:
- **A keystroke in between was replaced.** React runs a discrete event's effects at the end of its commit, so seeds from typing a note or tapping a chip had no window. The reset after a save (an awaited result) and a voice transcript (not a React event) render at default priority, and their effects run in a later task; a keystroke handled before that task was overwritten by the seed.
- **Until the effect ran, the form's amount and the field's text disagreed.**

The field also kept four pieces of state (the amount, its formatted text, whether it is a formula, the error) that are all functions of its text, plus a `defaultValue` prop no caller passed, applied by a second effect.

### Decision

- **Everything the field shows is derived from its text.** `evaluateAmountInput(raw)` in `utils/mathEvaluator.ts` holds the field's rules with no state: the amount (positive or null), its formatted value, whether it is a formula, and the error (none while a formula is unfinished). The field computes it with `useMemo` over its text.
- **A new seed is applied during render.** The field keeps the last seed key it applied in state and, when the prop's key differs, sets the key and the text in the same render (the pattern ADR `0056` uses). The key it mounts with is not a seed, as before.
- **A seed is the caller's event, so the caller records its amount.** The field reports only what a person does (typing, an operator key, a quick amount, Use result). `TransactionForm`'s `seedAmount(value)` bumps the seed and records `evaluateAmountInput(value)` in the same handler, for the note parser, a template, a payoff chip and the reset after a save; `WalletTransferForm`'s Transfer all does the same.
- **Removed:** the two effects, the `defaultValue` prop, and the effect that mirrored the two callbacks into refs (a handler reads the current props).

**Rejected:**
- **Reporting from the field in a layout effect:** still after the render, and a layout effect that sets a parent's state forces a second synchronous render.
- **Reporting from the field during its render:** React refuses to update one component while rendering another.
- **Remounting the field with a `key`:** it loses focus and the error state on every keystroke (ADR `0013`).

## Verification

- **Unit:** `unit/inline-math-seed.test.tsx`, new, 25 tests:
  - `evaluateAmountInput` over twelve texts, from empty and unfinished to zero, negative and invalid;
  - a seed: the mount key is not one; a new key sets the text and badge, and is neither reported nor a user edit; the same text under a new key replaces a typed edit; a parent render with the same key does not;
  - a person editing: rapid typing and backspacing reports every step in order and ends where the text ends; the badge and error follow the text; an operator key, a backspace, Use result and a quick amount each report the new text;
  - **outside `act`**, as in a browser: a seed pushed outside any React event, and a keystroke dispatched from a `MutationObserver` callback, which runs after the commit and before the render's effects. The keystroke is kept. Its twin types after the seed has settled, and before it;
  - `TransactionForm` in the real `FinanceProvider`: a note's amount is what is submitted; after a save the field is empty and a new amount can be typed at once; a typed amount outlives a note (ADR `0013`);
  - `WalletTransferForm`: Transfer all arms the transfer and its preview.
- **Negative controls:**
  - the three components from `main`: the outside-`act` test fails (the field ends on the seed's "60", not the typed "777") and its twin passes; the seed-not-reported test fails;
  - the new field with each caller's report removed: the two `TransactionForm` seed tests and the Transfer all test fail.
- **Gate:** lint clean; unit 827/827 in 32 files, the new file 25/25 three runs in a row. Playwright at 4 workers: run 1 439/441 in 8.3 m: two WebKit clicks waited 15 s for a button to be stable after a dialog closed (`debts-page.spec.ts` Mark as paid off, `transaction-edit.spec.ts` the repayment edit); run 2 441/441 in 8.0 m, first pass. `toast-layering.spec.ts` on chromium 1.7 s and 2.5 s in both full runs (Phase 80: 28.5 s and 29.4 s); the warm-up took 3.6 s and 3.8 s.
  - **The two WebKit failures are not this phase's.** `debts-page.spec.ts`'s test never touches the amount field, and Phase 63 recorded the `transaction-edit` one failing the same way. Repeated: both specs together on WebKit, 5 times each, failed 1 of 30 on the branch, then the branch passed 60/60 and `main`'s components 60/60; the repayment test alone passed 15/15 on each.
- **Run 3**, after the CI fix below: 441/441 in 7.8 m, first pass; the warm-up 3.9 s; the toast tests 1.7 s and 2.6 s on chromium.
- **Found on CI:** in PR #31's first run the chromium job's warm-up stopped with "Execution context was destroyed, most likely because of a navigation" (it warned, and all 147 tests passed). A reload during the first load, most likely Vite reloading once it has pre-bundled the dependencies it found on a fresh checkout, ended the `evaluate` that waited for the service worker. The wait is now an init script that marks the service worker ready in every page it loads, polled with `waitForFunction`, which keeps polling across a reload. A probe that forces a reload mid-wait fails the old wait with CI's message and passes the new one; an empty local Vite cache did not reproduce the reload (old 12.7 s, new 7.0 s, both succeeded).
- **The spec alone, fresh servers, two runs each:** without the warm-up chromium took 7.5 to 10.4 s a test, Firefox 9.2 to 9.5 s and WebKit 2.8 to 3.3 s; with it (3.4 to 4.2 s) chromium took 1.6 to 3.6 s, Firefox 7.6 to 8.7 s and WebKit 4.1 to 5.2 s. The first browser to open 3100 is the one that used to pay, and in a full run that is chromium.
- **Bundle** (local builds with `.env`, gzip level 9): `InlineMathInput` 5,983 -> 5,680 B (-303 B, -137 B gzip), `TransactionForm` 25,869 -> 25,865 B (-4 B, +26 B gzip) and `TransferFundsModal` 6,855 -> 6,927 B (+72 B, +39 B gzip). No other chunk changed size, and the entry `index-*.js` is identical to `main`'s once its hashed chunk names are normalised.

## Consequences

- **A new caller that seeds the field records the amount itself**, through `evaluateAmountInput`, as `seedAmount` does. A seed it does not record leaves the form's amount behind the field's text.
- **Every Playwright run starts with the warm-up**, about 4 s, including a run of one spec on port 3000, since both servers start for any run.
- **Still open:** Firefox once failed both toast tests while closing their context (`Browser.removeBrowserContext`: `_maybeDontRestoreTabs`, inside Firefox's session restore), after their bodies passed, in a run without the warm-up. Phase 61 saw the same error once on another spec. It is Firefox's, not the app's, and is recorded rather than worked around.
- **Still open:** a WebKit click that waits for its button to be stable after a dialog closes, and does not get there in 15 s, about once in a few hundred runs (above, and Phase 63).
