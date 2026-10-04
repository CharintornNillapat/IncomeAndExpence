# 0059: An open dialog keeps its focus when React re-runs its effects; CI keeps the first failure's trace

**Status:** Accepted. Implemented on branch `phase-83-stacked-modal-inert-and-ci-trace` (commit `19a523b`), draft PR. Not merged yet.
- **Amends** ADR `0058` (and `0043`'s focus on open): the focus move on open now gives back a control that had focus inside the panel.

**Date:** 2026-10-05

## Context

On the Phase 82 merge's CI run, WebKit's first attempt at `categories.spec.ts`'s "attempting to delete an in-use category surfaces the guard error in the confirm dialog" failed. With the Delete category confirmation open, the test opens Quick Add over it, fills the amount with "50" and picks the category. The submit stayed disabled for 15 s. The page snapshot showed the category picked and the amount empty; the retry passed, and CI kept no trace of the failure, because it traced only retries.

Two readings fit: Quick Add's field was `inert` when filled, or focus left it. Playwright's `fill` decides between them. In the page it calls `input.select()` and `input.focus()`; then, a protocol round trip later, it types into whatever has focus, and nothing checks that focus is still on the field.

**What moved focus is React's StrictMode,** which `main.tsx` turns on, so it is on in development and in every Playwright run (production builds drop it). For a newly mounted component it runs the effects, their cleanups, then the effects again, a task after the commit. `Modal`'s opener cleanup hands focus back to the opener, then the re-run stack effect finds focus outside the panel and moves it to the first control, the close button. When that task lands between Playwright's focus and its typing, the amount goes to the close button.

- **The inert marks were never wrong.** The field was not inert at any point; the cleanup's moment with only the confirmation on the stack does mark Quick Add, but the re-run clears it in the same task.
- **It is not new.** The Phase 81 `Modal`, whose effects were still passive, loses the amount the same way in the test below.

## Decision

### `Modal` gives focus back to where it was inside the panel

- **The opener cleanup notes the control that has focus inside the panel** (`focusInside`) before it releases the dialog and focuses the opener.
- **The stack effect gives focus back to that control** when it is still in the panel. Otherwise, as before, it moves focus to the first control unless focus is already inside.
- **A real close clears the note** in the closing layout effect, so the next open starts from the first control again.
- The same holds for any re-run of an open dialog's effects; React's `<Activity>` hides and shows content that way.

### CI keeps the first failed attempt's trace

`trace` is `retain-on-first-failure` on CI: every test's first attempt is traced, and the trace is kept only when that attempt fails, so a test that fails then passes on retry still leaves its failure in the uploaded HTML report. Locally it stays `on-first-retry`, which with no local retries means no trace unless a run passes `--trace`: tracing every local test made Phase 82's full run 11.1 m instead of about 8.

**Rejected:**
- **Turning StrictMode off for the test server:** it would hide what StrictMode exists to find, and the dialog would still drop a person's focus inside a hidden `<Activity>`.
- **Not returning focus to the opener in the cleanup:** a dialog unmounted while open would leave focus on `<body>` (audit 008).
- **`force` or a re-fill in the spec:** the spec found a real focus move; changing it would hide the next one.

## Verification

- **Unit:** `unit/modal-focus.test.tsx`, one new test (828 -> 829). Under StrictMode and outside `act`, a confirmation is open inside `<main>`; an inert header button is clicked with `dispatchEvent`, as the spec does; a lazy dialog then mounts beside `<main>`. From the first commit that shows it, the test fills the field as Playwright does (focus, a task, then typing into whatever has focus), and again once it settles. It checks the field is not inert, keeps focus, and reports the amount, and that the confirmation under it is inert.
- **Negative controls:**
  - `main`'s `Modal`: the amount is empty, nothing is reported, focus is not on the field (CI's failure);
  - the Phase 81 `Modal`: the same, so the race predates ADR `0058`;
  - the same test without StrictMode passes on `main`'s `Modal`.
- **Lint** clean; **unit** 829/829 in 32 files; the modal file 27/27 three runs in a row.
- **E2E:** `categories.spec.ts` on WebKit x15: 118/120; both failures were the known Windows WebKit painting stall (the trace's last frame about 14.8 s before the timeout), at a category save and a type toggle, before any stacked dialog. Full suite at 4 workers: 441/441 in 8.0 m, first pass.
- **Bundle** (the branch built with `.env` against production's files, `main`'s build): the entry `index-*.js` 189,653 -> 189,919 B (+266 B, +61 B gzip), where `Modal` lives. Every other chunk is identical once hashed chunk names are normalised.

## Consequences

- **A dialog's focus survives React re-running its effects.** A new effect in `Modal` that moves focus must keep that: read `focusInside` before moving it.
- **A flaky test on CI now leaves a trace** in the `playwright-report-<browser>` artifact, so the next one can be read instead of guessed.
- **Still open:** WebKit on Windows stops painting a page now and then (ADR `0058`); it was both failures of the stress run here.
