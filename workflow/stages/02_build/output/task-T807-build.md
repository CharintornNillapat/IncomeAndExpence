# Build report: T807

Phase 148, branch `phase-148-add-entry-close`. First task of the phase; does not ship the phase.

## 1. Files changed (6 files)

- `docs/audit/decisions/0108-shell-dialogs-mount-at-idle.md` (new ADR)
- `src/App.tsx` (three comment and effect edits: mount shell modals at idle)
- `tests/tab-preload.spec.ts` (four new tests verifying instant dialog open after idle preload)
- `docs/contexts/ui-and-e2e.md` (updated shell modals contract bullet)
- `docs/audit/test-selector-contract.md` (updated `tab-preload.spec.ts` selector list)
- `docs/audit/task-ledger.md` (bookkeeping: added Phase 148 section, T807 row marked done, T808 row todo)

## 2. Tests added and fail-then-pass evidence

Added four tests in `tests/tab-preload.spec.ts` inside `Tab view idle preloading` testing the four shell dialogs:
- `Quick Record Transaction opens in the click's own update after the idle preload` (`#navbar-quick-add-btn`)
- `Transfer Funds opens in the click's own update after the idle preload` (`#dashboard-wallets-transfer-btn`)
- `Add Wallet opens in the click's own update after the idle preload` (`#dashboard-wallets-add-btn`)
- `Account & Security opens in the click's own update after the idle preload` (`#navbar-account-btn`)

Each test waits for idle view preload completion, performs a DOM click on the dialog trigger, and checks that within one macrotask (`setTimeout(resolve, 0)`) the dialog heading is present on the page (verifying it commits in the click's own SyncLane update without Suspense boundary reveal throttle).

### Red run

Command: `npx playwright test tests/tab-preload.spec.ts --project=chromium`
Log: `workflow/stages/02_build/output/logs/T807-red.log`

Result: 4 failed | 2 passed (6 tests) in 17.4s.
Failure output:
```
  1) [chromium] › tests\tab-preload.spec.ts:89:5 › Tab view idle preloading › Quick Record Transaction opens in the click's own update after the idle preload 

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: true
    Received: false

      111 |       }, { trigger, title });
      112 |
    > 113 |       expect(openedAtOnce).toBe(true);
          |                            ^
      114 |       await expect(page.getByRole('dialog', { name: title })).toBeVisible();
      115 |     });
      116 |   }
        at C:\Users\MRmar\Desktop\Mid years projects\IncomeAndExpence\tests\tab-preload.spec.ts:113:28
```
(Identical `Expected: true, Received: false` failure at line 113 across all four shell dialog tests).

### Green run

- Command: `npx playwright test tests/tab-preload.spec.ts --project=chromium`
  Result: 6 passed (22.7s).
- Command: `npx playwright test tests/tab-preload.spec.ts`
  Result: 18 passed (1.1m) across Chromium, Firefox, WebKit.

## 3. Gates

1. **`npm run lint`:** clean (node-globals 133 src files clean, safe-ids 133 src files clean, `tsc --noEmit` clean, `tsc -p api/tsconfig.json` clean).
2. **Full unit suite:** `npm run test:unit` -> 69 files passed, 1510 tests passed (84.61s). Log: `workflow/stages/02_build/output/logs/T807-unit.log`. Unit test count remains 1510 in 69 files.
3. **Targeted Playwright Chromium:** `npx playwright test tests/tab-preload.spec.ts --project=chromium` -> 6 passed (22.7s).
4. **Targeted Playwright 3 browsers:** `npx playwright test tests/tab-preload.spec.ts` -> 18 passed (1.1m) across Chromium, Firefox, WebKit.
5. **Full E2E Playwright suite:** `npm test` -> 36 specs, 561 runs: 555 passed, 6 skipped (10.2m) across Chromium, Firefox, WebKit. Log: `workflow/stages/02_build/output/logs/T807-e2e.log`.
6. **Red run verified:** `workflow/stages/02_build/output/logs/T807-red.log` (4 failed, 2 passed).
7. **Ports check:** verified no stale dev servers listening on ports 3000 and 3100 before Playwright runs.
8. **Line endings:** `w/crlf` verified on all touched files via `git ls-files --eol`; `docs/audit/decisions/0108-shell-dialogs-mount-at-idle.md` verified `crlf 47 bare-lf 0`.
9. **Em dashes:** 0 em dashes in `git diff -U0 HEAD`, 0 in ADR 0108, 0 in this build report.
10. **Text landed:** `git diff src/App.tsx` shows only edits A, B, and C with exact text; `docs/contexts/ui-and-e2e.md` and `docs/audit/test-selector-contract.md` each change one line.
11. **Scope:** `git status --porcelain` lists only target files, bookkeeping files, and this build report.

## 4. Deliberately not done

- `Modal.tsx` scrim rule (a click outside the panel closes it; no time guard or pointerdown check), focus, history and `inert` logic, and `modalHistory.ts`.
- Converting the four modals to `lazyView` or making open handlers wait for chunk.
- `AuthModal` and `ReloadPrompt` (eager, ADR 0010), `MobileBottomNav`, `Navbar`, `?action=quick-add` effect, copy or style.
- Stale comments elsewhere stating a modal "never unmounts once opened".
- Suite counts in `AGENTS.md`, `README.md` and `docs/contexts/ui-and-e2e.md:67`, `refactor-log.md` and `baseline-metrics.md` (reserved for phase closing task T808).
