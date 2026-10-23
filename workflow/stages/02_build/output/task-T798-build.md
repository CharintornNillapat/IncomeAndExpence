# Build report: T798

Phase 144, branch `phase-144-smooth-sync-and-tabs`. Second task of the phase; does not ship the phase.

## 1. Files changed (9 files)

- `docs/audit/decisions/0026-static-money-motion-and-sync-status.md`
- `src/context/FinanceContext.tsx`
- `src/components/navbar/NavbarLedgerStatus.tsx`
- `src/components/account/AccountModal.tsx`
- `unit/navbar-sync-badge.test.tsx` (new)
- `unit/authenticated-ledger.test.tsx`
- `DESIGN.md`
- `docs/contexts/client-state.md`
- `docs/audit/task-ledger.md`

## 2. Tests added and fail-then-pass evidence

Added 8 unit tests in `unit/navbar-sync-badge.test.tsx` and 3 unit tests in `unit/authenticated-ledger.test.tsx` (11 tests total).

### Red run (Gate 1)

Command: `npx vitest run unit/navbar-sync-badge.test.tsx unit/authenticated-ledger.test.tsx`
Log: `workflow/stages/02_build/output/logs/T798-red.log`

Result: exactly 7 tests failed, 131 passed (138 total across 2 files):
- `unit/navbar-sync-badge.test.tsx > NavbarSyncBadge (T798, ADR 0026 amendment) > keeps Synced while a background load runs under 1 s`: FAIL (`expected 'Syncing' to be 'Synced'`)
- `unit/navbar-sync-badge.test.tsx > NavbarSyncBadge (T798, ADR 0026 amendment) > keeps Sync failed, still a retry button, while a background load runs under 1 s`: FAIL (`Unable to find role="button" and name "Sync failed. Try again"`)
- `unit/navbar-sync-badge.test.tsx > NavbarSyncBadge (T798, ADR 0026 amendment) > starts the 1 s again for the next background load`: FAIL (`expected 'Syncing' to be 'Synced'`)
- `unit/navbar-sync-badge.test.tsx > NavbarSyncBadge (T798, ADR 0026 amendment) > the Sync failed button starts a load the user sees`: FAIL (`expected "vi.fn()" to be called with arguments: [ { manual: true } ]`)
- `unit/authenticated-ledger.test.tsx > which loads show Syncing (T798, ADR 0026 amendment) > marks a load the user starts, for as long as it runs`: FAIL (`expected undefined to be true`)
- `unit/authenticated-ledger.test.tsx > which loads show Syncing (T798, ADR 0026 amendment) > leaves a background load unmarked, and the badge keeps Synced while it runs`: FAIL (`expected undefined to be false`)
- `unit/authenticated-ledger.test.tsx > which loads show Syncing (T798, ADR 0026 amendment) > Sync now shows Syncing at once, and keeps its own spinner`: FAIL (`expected undefined to be true`)

4 GUARD tests passed in `unit/navbar-sync-badge.test.tsx`:
- `shows Syncing once a background load has run 1 s` (PASS)
- `shows Syncing at once for a load the user started` (PASS)
- `Offline still outranks Syncing` (PASS)
- `a guest keeps the Local button and its id` (PASS)

### Green run (Gates 3 & 4)

All 11 new tests pass after implementation.

## 3. Gates

1. **Red run:** verified (7 failed, 131 passed). Log: `workflow/stages/02_build/output/logs/T798-red.log`.
2. **`npm run lint`:** clean (node-globals 133 files clean, safe-ids 133 files clean, `tsc --noEmit` and `tsc -p api/tsconfig.json` 0 errors).
3. **Targeted unit:** `npx vitest run unit/navbar-sync-badge.test.tsx unit/authenticated-ledger.test.tsx unit/rerender-matrix.test.tsx unit/ledger-guards.test.tsx unit/backup-restore.test.tsx unit/dom-id-convention.test.ts` -> 6 files passed, 199 tests passed (41.40s).
4. **Full unit suite:** `npm run test:unit` -> 68 files passed, 1491 tests passed (74.62s). Log: `workflow/stages/02_build/output/logs/T798-unit.log`.
5. **Playwright Chromium:** `npx playwright test tests/account-and-mobile-nav.spec.ts tests/auth.spec.ts tests/theme.spec.ts tests/layout-stability.spec.ts --project=chromium` -> 30 passed (31.2s).
6. **Playwright all browsers:** `npx playwright test tests/account-and-mobile-nav.spec.ts tests/auth.spec.ts tests/theme.spec.ts tests/layout-stability.spec.ts` -> 88 passed, 2 skipped (2.1m). Log: `workflow/stages/02_build/output/logs/T798-e2e.log`.
7. **Line endings:** verified via `git ls-files --eol`: `w/crlf` for all target files except `docs/audit/decisions/0026-static-money-motion-and-sync-status.md` which remains `w/lf`. New test file `unit/navbar-sync-badge.test.tsx` is `w/crlf`.
8. **Em dashes:** verified with AST / substring checks: 0 em dashes in `git diff -U0 HEAD` and 0 in `unit/navbar-sync-badge.test.tsx`.
9. **Scope:** `git diff --stat` and `git status --porcelain` confirm only the 9 target files and `workflow/` outputs were touched.

## 4. Deliberately not done

- Overlapping loads clearing `isSyncing` early (pre-existing, out of scope per spec section 9).
- `docs/audit/test-selector-contract.md` (no spec references badge ids).
- Phase closing docs (`refactor-log.md`, `baseline-metrics.md`, test counts in `AGENTS.md` and `README.md`): reserved for the task that ships the phase.
