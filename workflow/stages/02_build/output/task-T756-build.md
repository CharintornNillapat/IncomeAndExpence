# Build report: T756

Phase 129: Wallet transfer label size (bring the transfer panel's From/To label onto DESIGN.md's section-label size).

## Files changed (4 files + build report)

1. `src/components/wallet/WalletTransferForm.tsx`:
   - Updated line 101 inside `TransferWalletPanel`: replaced `text-[10px]` with `text-xs` (`<span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">`).
2. `docs/audit/baseline-metrics.md`:
   - Added Phase 129 delta section under Figures against Phase 127 with entry chunk, app JS, CSS, Vitest, and Playwright metrics.
3. `docs/audit/refactor-log.md`:
   - Added Phase 129 entry above Phase 128 documenting changes, gate verifications, surprises (none), and deliberately not done scope.
4. `docs/audit/task-ledger.md`:
   - Added Phase 129 section with T756 row marked done with gate results; left Commit cell empty.
   - Updated Backlog row for WalletTransferForm.tsx:101 status to `done in Phase 129 (T756)`.

## Tests added

- None (per spec section 6: visual change only; one className token changed with no handler, state, text, id, role or DOM structure moves; pinned by grep and bash gate checks).

## Gate commands and results

1. Gate 1 (`npm run lint`):
   - `check:node-globals`: 132 files in src, no Node globals.
   - `check:safe-ids`: 132 files in src, no id from the time alone.
   - `tsc --noEmit`: clean.
   - `tsc -p api/tsconfig.json`: clean.
   - Result: clean, exit 0.

2. Gate 2 (`npm run test:unit`):
   - Command: `npm run test:unit 2>&1 | tee workflow/stages/02_build/output/logs/T756-unit.log`
   - Result: 62 test files passed, 1375 tests passed in 69.91s, exit 0.
   - Log path: `workflow/stages/02_build/output/logs/T756-unit.log`

3. Gate 3 (Playwright Chromium):
   - Command: `npx playwright test tests/wallet-forms.spec.ts tests/transfer-preview.spec.ts tests/ios-field-zoom.spec.ts --project=chromium`
   - Result: 13 passed in 28.6s, exit 0.

4. Gate 4 (Playwright all 3 browsers):
   - Command: `npx playwright test tests/wallet-forms.spec.ts tests/transfer-preview.spec.ts tests/ios-field-zoom.spec.ts 2>&1 | tee workflow/stages/02_build/output/logs/T756-e2e.log`
   - Result: 39 passed in 1.2m across Chromium, Firefox, WebKit (13 tests x 3 browsers), 0 failed, 0 flaky, exit 0.
   - Log path: `workflow/stages/02_build/output/logs/T756-e2e.log`

5. Gate 5 (Clean production build and asset metrics):
   - Command: `npm run clean && npm run build`
   - Result: clean build in 5.83s, exit 0.
   - Entry chunk: `index-BB5386eR.js`, 191,674 B raw (0 delta), 55,802 B gzip (+6 B gzip vs Phase 127 `index-0LGxXWZU.js`, 191,674 / 55,796).
   - All app JS: 878,207 B raw (-4 B vs Phase 127 878,211 B), 266,942 B gzip (-9 B vs Phase 127 266,951 B), 40 files (0 delta).
   - CSS: `index-CqllkKUj.css`, 52,759 B raw (0 delta), 10,159 B gzip (0 delta vs Phase 127 `index-CqllkKUj.css`, 52,759 / 10,159).

6. Gate 6 (Bash checks):
   - `git diff -U0 -- src/ | grep -cE '^-[^-]'`: 1 (exit 0)
   - `git diff -U0 -- src/ | grep -cE '^\+[^+]'`: 1 (exit 0)
   - `grep -n "text-\[10px\]" src/components/wallet/WalletTransferForm.tsx`: 0 hits (nothing printed)
   - `grep -n "text-xs font-semibold uppercase tracking-wider text-fg-muted" src/components/wallet/WalletTransferForm.tsx`: line 101 only
   - `git ls-files --eol src/components/wallet/WalletTransferForm.tsx docs/audit/task-ledger.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md`: all 4 show `w/crlf`
   - `grep -c $'\xe2\x80\x94' src/components/wallet/WalletTransferForm.tsx docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md`: all 4 return 0 em dashes
   - `git status --porcelain`: exactly the 3 target files, `docs/audit/task-ledger.md`, the spec, and this build report

## Not done

- None. All edits from the spec were completed.
