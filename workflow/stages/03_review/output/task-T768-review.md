# Review: T768

## Round 1

### Metadata

- **Task:** T768, Phase 136 (`phase-136-form-labels`, base `779db69`, no commits on the branch yet)
- **Date:** 2026-10-17
- **Round:** 1
- **Verdict:** APPROVED
- **Target files:** `src/components/AuthModal.tsx`, `src/components/wallet/AddWalletForm.tsx`, `src/components/account/AccountModal.tsx`, `src/components/transaction/ImportCsvModal.tsx`, `unit/auth-password.test.tsx`, `unit/authenticated-ledger.test.tsx`, `unit/wallets-page.test.tsx`, `unit/csv-import-categories.test.tsx`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` (plus bookkeeping `docs/audit/task-ledger.md`). `git check-ignore -v` on every target: none ignored.

### Summary

Ten `<label>`s now name their control through `htmlFor` (3 in `AuthModal`, 3 in `AddWalletForm`, 3 in `AccountModal`, the CSV file picker in `ImportCsvModal`), and the CSV row category `<select>` gets `aria-label={`Category for row ${row.rowIndex}: ${row.description || 'transaction'}`}`. The change is exactly the spec's section 5 table: attribute additions only, no id, text, class or structure change. Four unit tests, one per finding, assert each label resolves to the existing control id; the phase paperwork (ledger section, four Backlog rows done, one new Backlog row, refactor-log entry, baseline-metrics section) is in place.

### Invariants and parity

- **Parity map:** no row touched. "Spec-asserted DOM ids": no id or `data-testid` changed (diff checked), so `docs/audit/test-selector-contract.md` needs nothing. No money path, `api/`, `supabase/` or type change.
- **Label targets exist and are unique:** every `htmlFor` value matches the `id` of the next control in the same block (`AuthModal.tsx:186,203,236`; `AddWalletForm.tsx` via `ids.name/type/balance`, sole caller `AddWalletModal.tsx:25-31`; `AccountModal.tsx:613,673,684`; `ImportCsvModal.tsx:372`).
- **No em dash in user-facing text:** the aria-label uses a colon.
- **Changed functions:** every hunk is a JSX attribute inside the components' render output (`AuthModal`, `AddWalletForm`, `ProfileSection`, `PasswordSection`, `ImportCsvModal`); I read the surrounding form blocks in full. No handler, state or effect changed.
- **Remaining unlinked labels:** `grep -rn "<label" src --include=*.tsx | grep -v htmlFor` lists exactly the spec's expected set: `EditTransactionPanel.tsx:201,280,302,326` (wrapping), `TransactionForm.tsx:1091` (`htmlFor` on the next line), `AddWalletForm.tsx:125,151` (Currency, Color; new Backlog row).
- **Ledger:** Phase 136 section above Backlog; branch base `779db69` matches `git merge-base HEAD main`; T768 row status `done`, Commit empty per the ledger rule; Backlog rows UI-02 to UI-05 set to `done in Phase 136 (T768)`; Currency/Color row added as `todo`.

### Gates run

Ports 3000 and 3100: nothing listening before Playwright.

| # | Command | Result | Log |
|---|---|---|---|
| Red (step 6) | `git stash push -- ` the 4 `src/components` files; `npx vitest run unit/auth-password.test.tsx unit/authenticated-ledger.test.tsx unit/wallets-page.test.tsx unit/csv-import-categories.test.tsx`; `git stash pop` | 4 files failed, 4 tests failed, 148 passed (152): exactly the 4 new tests, each with `TestingLibraryElementError: Found a label with the text of: <Full Name / Display Name / ^Wallet Name / Select CSV File>, however no form control was found associated to that label`. `git status --porcelain` identical before and after | `workflow/stages/03_review/output/logs/T768-red.log` |
| 2 | `npm run lint` | exit 0: node-globals, safe-ids (132 files), `tsc --noEmit`, `tsc -p api/tsconfig.json` | `.../logs/T768-lint.log` |
| 3 | the 4 related unit files | 4 files passed, 152 passed, 0 failed (37.70 s) | `.../logs/T768-related.log` |
| 4 | `npm run test:unit` | 62 files passed, 1436 passed, 0 failed, 0 skipped (45.61 s) | `.../logs/T768-unit.log` |
| 5 | 8 specs (`auth`, `account-and-mobile-nav`, `wallet-forms`, `wallets`, `soft-delete`, `csv`, `csv-classify`, `ios-field-zoom`) `--project=chromium` | 51 passed, 0 failed (39.0 s) | `.../logs/T768-e2e-chromium.log` |
| 6 | same 8 specs, all browsers | 153 passed, 0 failed, 0 skipped (3.1 m) | `.../logs/T768-e2e.log` |
| 7 | `npm run clean; npm run build` (`.env` present), gzip level 9 | entry `index-BcaenrL9.js` 193,335 B / 56,360 B gzip; all app JS 884,664 B / 268,562 B gzip, 39 files; CSS `index-z3bqoA9P.css` 52,884 B / 10,209 B gzip. Matches `baseline-metrics.md` exactly | `.../logs/T768-build.log` |
| 8 | `git diff --stat`, `git status --porcelain` | 11 modified (10 targets + ledger), 2 untracked (spec, build report). No unannounced file | n/a |
| 9 | `git ls-files --eol` on the 11 modified files | all `w/crlf` | n/a |
| 10 | `git diff -U0` U+2014 count | 0 | n/a |
| 11 | label grep | expected set only (see above) | n/a |

### Not verified

- The red gate shows only each test's first failing assertion. The later assertions (for example the combobox name `Category for row 2: zzzlunch`, `Email Address`, `New Password`) were not individually shown to fail without the fix. They depend on the same attribute additions and pass with them, so I accept this.
- Screen-reader announcement on a real device (VoiceOver or NVDA): not run. The jsdom accessible-name checks and the browser runs cover the markup.

### Blocking

None.

### Non-blocking

- `docs/audit/refactor-log.md` Phase 136 entry: `**Changed:**` and `**Deliberately not done:**` are bullet lists, while the template (`:10-17`) and recent entries use one run-in line each. The brief sentence also leaves out the CSV file-picker label (it is in the Changed list). Worth tidying when the deploy record fills the shas.
- `workflow/stages/02_build/output/task-T768-build.md` is LF (95 bare LF) while earlier build reports check out `w/crlf`. Git stores `i/lf` either way, so the commit is unaffected.
- `unit/authenticated-ledger.test.tsx:23-24` has 2 em dashes in a code comment from earlier phases (`git show main:` has the same 2). They are not user-facing and not in this diff, so out of scope.

### Rule candidates

None.
