# Review: T798

## Round 1

### 1. Metadata

- Task: T798, Phase 144 (`phase-144-smooth-sync-and-tabs`)
- Date: 2026-10-23
- Round: 1
- Verdict: **APPROVED**
- Target files: `docs/audit/decisions/0026-static-money-motion-and-sync-status.md`, `src/context/FinanceContext.tsx`, `src/components/navbar/NavbarLedgerStatus.tsx`, `src/components/account/AccountModal.tsx`, `unit/navbar-sync-badge.test.tsx` (new), `unit/authenticated-ledger.test.tsx`, `DESIGN.md`, `docs/contexts/client-state.md`, `docs/audit/task-ledger.md`. `git check-ignore -v` on all nine returns nothing (exit 1): none is ignored.

### 2. Summary

The context gains `isManualSync`, set and cleared inside `loadSupabaseData` only when `refreshFromCloud({ manual: true })` is called, and only Sync now (AccountModal) and the badge's Sync failed button pass it. `NavbarSyncBadge` now shows Syncing when `isSyncing && (isManualSync || loadIsSlow)`, with a 1 s timer in the badge that resets when `isSyncing` drops. ADR 0026 has an amendment; DESIGN.md's Syncing row, `client-state.md` and the ledger are updated as the spec asked.

### 3. Invariants and parity

- **Load timing, write paths, ledger arithmetic unchanged (the orchestrator's check):** the FinanceContext diff is exactly the six spec edits: one type field, the action type, one `useState`, `loadSupabaseData` gaining an optional `options` with two guarded `setIsManualSync` lines (start, and in `finally`, so an early `return` or a throw still clears it), `refreshFromCloud` forwarding `options`, and `isManualSync` in `stateValue` plus its deps. The `loadSupabaseData` deps stay `[seedInitialUserAccount]`. No caller of `loadSupabaseData`/`loadSupabaseDataRef` (`:886`, `:973`, `:993`, `:1130`) and none of the 12 write-path `refreshFromCloud()` calls (`:1318` to `:2574`, `DiaryContext.tsx:133`) changed; grep shows `{ manual: true }` only at `AccountModal.tsx:77` and `NavbarLedgerStatus.tsx:114`. No read, debounce, staleness or epoch logic touched; no money arithmetic touched.
- **`isSyncing` meaning kept:** AccountModal's `disabled={isSyncing}`, spinner and export guard untouched (diff is one line); test 11 asserts the button is disabled with "Syncing…".
- **Badge:** precedence Offline > Syncing > Sync failed > Synced kept; markup, classes, `role="status"`, both ids byte-identical apart from the `showSyncing` condition and the retry handler. Hooks run before the guest early return.
- **Parity map, "Spec-asserted DOM ids":** `#navbar-sync-status` and `#navbar-sync-badge-btn` unchanged; no spec asserts them (spec section 2); now covered by unit tests. No other row touched (no `api/`, SQL, `src/types.ts`, transfer/debt formula).
- **Non-negotiables:** relative imports; no new dependency or state library; no `React.memo`; strict `tsc` clean.
- **Line endings:** `git ls-files --eol` shows `w/crlf` for all targets except ADR 0026 `w/lf`, as before; the new test file is CRLF, like `unit/motion.test.tsx`.
- **Scope:** `git diff --stat` (8 tracked files) plus `git status --porcelain` (new test file, spec and build outputs) list only target files and workflow outputs. Nothing unannounced.

### 4. Gates run

| Command | Result | Log |
|---|---|---|
| Red run, source stashed (`git stash push -- src/context/FinanceContext.tsx src/components/navbar/NavbarLedgerStatus.tsx src/components/account/AccountModal.tsx`), `npx vitest run unit/navbar-sync-badge.test.tsx unit/authenticated-ledger.test.tsx` | 2 files, 138 tests: **7 failed**, 131 passed. The 7 failures are exactly the spec's RED tests 1, 3, 4, 7, 9, 10, 11; the four GUARD tests pass. `git stash pop --index`; `git status --porcelain` identical before and after | `workflow/stages/03_review/output/logs/T798-red.log` |
| `npm run lint` | exit 0 (node-globals 133 clean, safe-ids 133 clean, both `tsc` clean) | `.../logs/T798-lint.log` |
| `npx vitest run unit/navbar-sync-badge.test.tsx unit/authenticated-ledger.test.tsx unit/rerender-matrix.test.tsx unit/ledger-guards.test.tsx unit/backup-restore.test.tsx unit/dom-id-convention.test.ts` | 6 files passed, 199 tests passed, 0 failed | `.../logs/T798-targeted.log` |
| `npm run test:unit` | 68 files passed, 1491 tests passed, 0 failed, 0 skipped (67.07s) | `.../logs/T798-unit.log` |
| Ports 3000 and 3100 | nothing listening | |
| `npx playwright test tests/account-and-mobile-nav.spec.ts tests/auth.spec.ts tests/theme.spec.ts tests/layout-stability.spec.ts --project=chromium` | 30 passed (32.2s) | `.../logs/T798-e2e-chromium.log` |
| Same four specs, all three browsers | 88 passed, 2 skipped, 0 failed (2.0m) | `.../logs/T798-e2e.log` |
| Em dashes: added lines of `git diff -U0 HEAD`; `unit/navbar-sync-badge.test.tsx` | 0; 0 (also 0 in the two changed components) | |

### 5. Not verified

- The signed-in badge in a real browser: no Playwright spec signs in (stop-and-ask: `.env` points at live), so signed-in states are covered only by the unit tests, as the spec states.
- Overlapping loads (a background load finishing while a manual one runs clears `isSyncing` early): pre-existing and out of scope per spec section 9; not exercised.

### 6. Blocking

None.

### 7. Non-blocking

- The ADR 0026 amendment cites `FinanceContext.tsx:890` for `setIsSyncing(true)`; after this change it sits at `:897`. The spec gave `:890`, so it is as specified; a later docs pass may drop the line number.
- `unit/navbar-sync-badge.test.tsx`'s `afterEach` uses `vi.restoreAllMocks()` rather than restoring only the `navigator.onLine` spy; harmless, since `beforeEach` resets `mock.state` and calls `mockClear()`.

### 8. Rule candidates

None.
