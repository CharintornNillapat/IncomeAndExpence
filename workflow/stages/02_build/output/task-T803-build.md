# Build report: T803

Phase 146, branch `phase-146-no-blink`. First task of the phase; does not ship the phase.

## 1. Files changed (7 files)

- `docs/audit/decisions/0106-instant-tabs-and-popups-open-without-motion.md`
- `src/App.tsx`
- `src/index.css`
- `src/components/Modal.tsx`
- `tests/reduced-motion.spec.ts`
- `docs/contexts/ui-and-e2e.md`
- `docs/audit/task-ledger.md`

## 2. Tests added and fail-then-pass evidence

Updated `tests/reduced-motion.spec.ts` to pin the removal of page and modal entrance animations:
- Replaced `ALL` with `['slide', 'motion-fade-out', 'motion-rise-out']`.
- Asserted that none of `motion-page-in`, `motion-page-out`, `motion-fade-in`, or `motion-rise-in` are recorded in `window.__motion`.
- Renamed test to `'the period pill animates and a dialog fades out on close'`.
- Updated header comment to document Phase 146 instant tab and popup entrances.

### Red run (Gate 1)

Command: `npx playwright test tests/reduced-motion.spec.ts --project=chromium`
Log: `workflow/stages/02_build/output/logs/T803-red.log`

Result: 1 failed, 1 passed (11.2s):
- `tests/reduced-motion.spec.ts > the period pill animates and a dialog fades out on close`: FAILED.
  Error: `expect(received).not.toContain(expected)`
  Expected value: not `"motion-page-in"`
  Received array: `["motion-page-in", "slide", "motion-rise-in", "motion-fade-in", "motion-rise-out", "motion-fade-out", "slide", "motion-page-out", "motion-page-in"]`

### Green run (Gate 2)

Command: `npx playwright test tests/reduced-motion.spec.ts --project=chromium`
Result: 2 passed (10.8s).

## 3. Gates

1. **Red run:** verified (1 failed, 1 passed). Log: `workflow/stages/02_build/output/logs/T803-red.log`.
2. **`npm run lint`:** clean (node-globals 133 files clean, safe-ids 133 files clean, both `tsc` clean).
3. **Related unit:** `npx vitest run unit/motion.test.tsx unit/modal-focus.test.tsx` -> 2 files passed, 37 tests passed (2.75s).
4. **Full unit suite:** `npm run test:unit` -> 68 files passed, 1506 tests passed (54.14s). Log: `workflow/stages/02_build/output/logs/T803-unit.log`.
5. **Targeted Playwright on Chromium:** `npx playwright test tests/reduced-motion.spec.ts tests/routing.spec.ts tests/tab-preload.spec.ts tests/layout-stability.spec.ts tests/account-and-mobile-nav.spec.ts tests/toast-layering.spec.ts tests/wallet-forms.spec.ts tests/transaction.spec.ts --project=chromium` -> 46 passed (27.8s).
6. **Targeted Playwright on 3 browsers:** `npx playwright test tests/reduced-motion.spec.ts tests/routing.spec.ts tests/tab-preload.spec.ts tests/layout-stability.spec.ts tests/account-and-mobile-nav.spec.ts tests/toast-layering.spec.ts tests/wallet-forms.spec.ts tests/transaction.spec.ts` -> 136 passed, 2 skipped across 3 browsers (2.5m).
7. **Full Playwright suite (`npm test`):** 543 passed, 6 skipped by design, 0 failed across 3 projects in 9.7 min. Log: `workflow/stages/02_build/output/logs/T803-playwright.log`.
8. **Ports check:** verified no listening servers on 3000 and 3100.
9. **Playwright test list:** `Total: 549 tests in 36 files` (183 tests, 36 specs, 549 runs).
10. **Line endings:** strict CRLF verified on all 7 touched files (0 bare LF).
11. **Em dashes:** Node verification confirms 0 em dashes added in `git diff -U0 HEAD` or ADR 0106.
12. **Scope:** `git status --porcelain` confirms only the 6 target files and `docs/audit/task-ledger.md` were modified.

## 4. Deliberately not done

- Dialog exit animations (`motion-fade-out`, `motion-rise-out`): retained so closing modals cleanly reveal already-rendered background content without layout flash.
- Suggestion chip tweens (`motion-chip`), `slidePill`, and period filter indicator slide: retained.
- `src/components/ui/motion.tsx` and `unit/motion.test.tsx` untouched (`Presence` retained).
- Refactor log and baseline metrics: reserved for the task that ships the phase.
