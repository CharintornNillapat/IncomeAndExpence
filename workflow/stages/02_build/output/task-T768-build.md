# Build report: T768

Phase 136: Link every form label to its control, and name the CSV row category select (audit 2026-10-16 findings UI-02, UI-03, UI-04, UI-05; no ADR).

## Files changed (10 target files + task-ledger.md)

1. `src/components/AuthModal.tsx`:
   - Added `htmlFor="auth-name-input"` to the Full Name `<label>`.
   - Added `htmlFor="auth-email-input"` to the Email Address `<label>`.
   - Added `htmlFor="auth-password-input"` to the Password `<label>`.

2. `src/components/wallet/AddWalletForm.tsx`:
   - Added `htmlFor={ids.name}` to the Wallet Name `<label>`.
   - Added `htmlFor={ids.type}` to the Type `<label>`.
   - Added `htmlFor={ids.balance}` to the Starting Balance `<label>`.
   - Currency and Color labels left untouched per spec (no labelable control).

3. `src/components/account/AccountModal.tsx`:
   - Added `htmlFor="profile-name-input"` to the Display Name `<label>`.
   - Added `htmlFor="security-new-password"` to the New Password `<label>`.
   - Added `htmlFor="security-confirm-password"` to the Confirm Password `<label>`.

4. `src/components/transaction/ImportCsvModal.tsx`:
   - Added `htmlFor="csv-file-input"` to the Select CSV File `<label>`.
   - Added `aria-label={`Category for row ${row.rowIndex}: ${row.description || 'transaction'}`}` to the row category `<select>`.

5. `unit/auth-password.test.tsx`:
   - Added `it('names each field from its label')` in `describe('the sign-in dialog')`.

6. `unit/authenticated-ledger.test.tsx`:
   - Added `it('names the profile and password fields from their labels')` in `describe('the Account & Security modal (ADR 0024)')`.

7. `unit/wallets-page.test.tsx`:
   - Imported `AddWalletModal` from `../src/components/wallet/AddWalletModal`.
   - Added `describe('the Add Wallet form (audit 2026-10-16 UI-03)')` with `it('names each field from its label')`.

8. `unit/csv-import-categories.test.tsx`:
   - Added `it('names the file picker and each row picker')` in `describe("the preview's category picker")`.

9. `docs/audit/baseline-metrics.md`:
   - Added `### Phase 136 - delta against Phase 135` section with entry chunk, all app JS, CSS, Vitest, and Playwright measurements.

10. `docs/audit/refactor-log.md`:
    - Added `## Phase 136 - Form labels: T768` entry at the top of the refactor log.

11. `docs/audit/task-ledger.md`:
    - Added Phase 136 section and T768 row above Backlog.
    - Marked UI-02, UI-03, UI-04, and UI-05 Backlog rows as `done in Phase 136 (T768)`.
    - Added new Backlog row for AddWalletForm's Currency and Color labels.
    - Updated T768 status to `done` with verification gate results and empty Commit cell.

## Tests added and fail-then-pass evidence

- 4 new unit tests added across the 4 test files:
  1. `unit/auth-password.test.tsx`: `names each field from its label`
  2. `unit/authenticated-ledger.test.tsx`: `names the profile and password fields from their labels`
  3. `unit/wallets-page.test.tsx`: `names each field from its label`
  4. `unit/csv-import-categories.test.tsx`: `names the file picker and each row picker`
- **Red run evidence**:
  - `npx vitest run unit/auth-password.test.tsx unit/authenticated-ledger.test.tsx unit/wallets-page.test.tsx unit/csv-import-categories.test.tsx`:
    - 4 failed, 148 passed across 4 test files.
    - All 4 failures confirmed: `TestingLibraryElementError: Found a label with the text of: ..., however no form control was found associated to that label` or missing combobox role name.
- **Green run evidence**:
  - `npx vitest run unit/auth-password.test.tsx unit/authenticated-ledger.test.tsx unit/wallets-page.test.tsx unit/csv-import-categories.test.tsx`:
    - 4 test files passed, 152 tests passed in 37.59s.
  - `npm run test:unit`:
    - 62 test files passed, 1436 tests passed in 48.79s (`workflow/stages/02_build/output/logs/T768-unit.log`).
  - Playwright Chromium (8 specs):
    - 8 spec files passed, 51 passed in 43.5s.
  - Playwright 3-browser suite (8 specs across Chromium, Firefox, WebKit):
    - 8 spec files passed, 153 passed, 0 failed in 3.4m (`workflow/stages/02_build/output/logs/T768-e2e.log`).

## Gate commands and results

1. Red gate:
   - `npx vitest run unit/auth-password.test.tsx unit/authenticated-ledger.test.tsx unit/wallets-page.test.tsx unit/csv-import-categories.test.tsx`: exactly the 4 new tests failed, 148 passed.

2. Lint:
   - `npm run lint`: passed clean (check:node-globals 132 files, check:safe-ids 132 files, tsc --noEmit, tsc -p api/tsconfig.json).

3. Targeted unit tests:
   - `npx vitest run unit/auth-password.test.tsx unit/authenticated-ledger.test.tsx unit/wallets-page.test.tsx unit/csv-import-categories.test.tsx`: 4 passed, 152 passed in 37.59s.

4. Full unit suite:
   - `npm run test:unit`: 62 passed, 1436 passed in 48.79s.
   - Log path: `workflow/stages/02_build/output/logs/T768-unit.log`

5. Targeted Playwright on Chromium (8 specs):
   - `npx playwright test tests/auth.spec.ts tests/account-and-mobile-nav.spec.ts tests/wallet-forms.spec.ts tests/wallets.spec.ts tests/soft-delete.spec.ts tests/csv.spec.ts tests/csv-classify.spec.ts tests/ios-field-zoom.spec.ts --project=chromium`: 51 passed in 43.5s.

6. Targeted Playwright on all 3 browsers (8 specs):
   - Same 8 specs without project filter: 153 passed in 3.4m.
   - Log path: `workflow/stages/02_build/output/logs/T768-e2e.log`

7. Clean production build and bundle measurement:
   - Cleaned `dist/` and ran `npm run build`: built in 4.19s.
   - Entry chunk `index-BcaenrL9.js`: 193,335 B (+83 B), 56,360 B gzip (+24 B against Phase 135 `index-wgYjfCND.js`, 193,252 / 56,336).
   - All app JS: 884,664 B (+332 B), 268,562 B gzip (+63 B against Phase 135 884,332 / 268,499, 39 files, 0 file delta).
   - CSS `index-z3bqoA9P.css`: 52,884 B (0 delta), 10,209 B gzip (0 delta against Phase 135 `index-z3bqoA9P.css`, 52,884 / 10,209).

8. Git status and diff cleanliness:
   - `git diff --stat`: 11 files changed (10 target files + task-ledger.md).
   - `git status --porcelain`: only target files, task-ledger.md, and workflow stage files.

9. Line endings check:
   - `git ls-files --eol`: confirmed `w/crlf` across all touched files.

10. No em dash check:
    - Verified 0 U+2014 em dashes added in git diff.

11. Unassociated labels check:
    - Verified `grep -rn "<label" src --include=*.tsx | grep -v htmlFor` returns only:
      - `EditTransactionPanel.tsx:201,280,302,326` (wrapping their controls)
      - `TransactionForm.tsx:1091` (htmlFor on next line)
      - `AddWalletForm.tsx:125,151` (Currency and Color)

## Deliberately not done

- `AddWalletForm.tsx`'s `Currency` and `Color` labels (name no labelable control; Backlog row added per spec).
- `EditTransactionPanel.tsx` and `TransactionForm.tsx` labels (already named).
- Any id, `data-testid`, label text, class or layout change; `docs/audit/test-selector-contract.md`.
- Wrapping inputs inside labels instead of `htmlFor`, or adding `aria-label` where a visible label exists.
- The test counts in `AGENTS.md:11` and `README.md:157` (left for deploy record or later docs task).
- Any other audit 2026-10-16 finding (SL-01, UI-06).
