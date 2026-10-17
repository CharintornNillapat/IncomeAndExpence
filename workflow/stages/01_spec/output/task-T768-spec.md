# T768 spec: link every form label to its control, and name the CSV row category select

Phase 136 (branch `phase-136-form-labels`). Backlog rows: audit 2026-10-16 findings UI-02, UI-03, UI-04 and UI-05 (`docs/audit/task-ledger.md:132-135`). This task ships the phase.

## 1. Goal

A screen reader names every field in the sign-in dialog, the Add Wallet form, the Account modal's Profile and Change Password forms and the CSV import file picker, because each `<label>` names its control through `htmlFor`, and clicking a label moves focus to its field. The category `<select>` in each CSV preview row gets an accessible name that says which row it sets.

## 2. Target files

```
src/components/AuthModal.tsx
src/components/wallet/AddWalletForm.tsx
src/components/account/AccountModal.tsx
src/components/transaction/ImportCsvModal.tsx
unit/auth-password.test.tsx
unit/authenticated-ledger.test.tsx
unit/wallets-page.test.tsx
unit/csv-import-categories.test.tsx
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
```

No ADR: this fixes markup to standard HTML labelling and changes no rule or decision (as Phase 132 shipped an audit fix with none). Bookkeeping (`docs/audit/task-ledger.md`, the build report) is allowed as usual.

## 3. Context to read

- `docs/contexts/ui-and-e2e.md`: the accessibility and Playwright rules for `src/components/`. The change is logic-free markup, so `DESIGN.md` is not needed.
- Per `docs/contexts/ui-and-e2e.md:3` and the owner's standing memory, load the `antislop` core skill and `antislop-human` during the work (accessibility).

## 4. Current behaviour

No label below has `htmlFor` or wraps its control, so the control has no accessible name from it and a click on the label text does not focus the field.

**UI-02, `src/components/AuthModal.tsx`:**
- `:182` `<label className={LABEL_TEXT_CLASS}>Full Name</label>`; its control is `<input id="auth-name-input"` at `:186` (sign-up mode only, `:180`).
- `:199` `Email Address`; control `id="auth-email-input"` at `:203`.
- `:217` `Password` (inside a flex row with the "Forgot password?" button, `:216-232`); control `id="auth-password-input"` at `:236`.

**UI-03, `src/components/wallet/AddWalletForm.tsx`** (ids come from the caller; the only caller is `src/components/wallet/AddWalletModal.tsx:23-32`, which passes `new-wallet-name`, `new-wallet-type`, `new-wallet-currency`, `new-wallet-init-balance`):
- `:95` `Wallet Name *`; control `id={ids.name}` at `:97`.
- `:109` `Type`; control `<select id={ids.type}` at `:111`.
- `:136` `Starting Balance ({APP_CURRENCY_SYMBOL})` (renders `Starting Balance (฿)`, `src/utils/currency.ts:12`); control `id={ids.balance}` at `:138`.
- `:125` `Currency` labels a read-only `<div id={ids.currency}>` (`:127`) and `:151` `Color` labels a group of swatch buttons that each carry their own `aria-label` (`:159`). Neither is a labelable element, so `htmlFor` cannot apply; both are out of scope (section 9).

**UI-04, `src/components/account/AccountModal.tsx`** (rendered only when signed in, `:176-183`):
- `:611` `Display Name`; control `id="profile-name-input"` at `:613`.
- `:671` `New Password`; control `id="security-new-password"` at `:673`.
- `:682` `Confirm Password`; control `id="security-confirm-password"` at `:684`.

**UI-05, `src/components/transaction/ImportCsvModal.tsx`:**
- `:547-552` the row's category `<select data-testid={`csv-row-category-${row.rowIndex}`} ...>` has no `<label>`, `aria-label` or `aria-labelledby`. The table's first column header is `Row` (`:505`) and shows `row.rowIndex` (`:517`); the description is shown in the same row (`:532-537`) and may be an empty string.
- Same file, same defect, not in the audit: `:359-361` `<label className="text-xs font-semibold text-fg-secondary">Select CSV File</label>` names no control; the file input is `id="csv-file-input"` at `:372`. The order says "every label", so it is in scope.

Repo-wide, `grep -rn "<label" src --include=*.tsx | grep -v htmlFor` lists only the labels above plus `EditTransactionPanel.tsx:201,280,302,326`, which wrap their controls (already named), and `TransactionForm.tsx:1091`, whose `htmlFor` sits on the next line. Those need no change.

## 5. The change

Attribute additions only; no class, text, id or structure changes.

| File:line | Add |
|---|---|
| `AuthModal.tsx:182` | `htmlFor="auth-name-input"` |
| `AuthModal.tsx:199` | `htmlFor="auth-email-input"` |
| `AuthModal.tsx:217` | `htmlFor="auth-password-input"` |
| `AddWalletForm.tsx:95` | `htmlFor={ids.name}` |
| `AddWalletForm.tsx:109` | `htmlFor={ids.type}` |
| `AddWalletForm.tsx:136` | `htmlFor={ids.balance}` |
| `AccountModal.tsx:611` | `htmlFor="profile-name-input"` |
| `AccountModal.tsx:671` | `htmlFor="security-new-password"` |
| `AccountModal.tsx:682` | `htmlFor="security-confirm-password"` |
| `ImportCsvModal.tsx:359` | `htmlFor="csv-file-input"` |
| `ImportCsvModal.tsx:547` (the `<select>`) | ``aria-label={`Category for row ${row.rowIndex}: ${row.description || 'transaction'}`}`` |

The aria-label wording is the audit's fix (UI-05), with a colon, no em dash. Put each new attribute right after the element's tag name or `className`, matching the file's style.

## 6. Parity map

None. No id changes, so `docs/audit/test-selector-contract.md` is untouched; no money path.

## 7. Tests to add

Each fails on the unfixed code because `getByLabelText` throws "Found a label with the text of: ..., however no form control was found associated to that label", and `getByRole(..., { name })` finds no element with that name. Assert identity against the existing id, so the test proves the label names the right control.

1. `unit/auth-password.test.tsx`, in `describe('the sign-in dialog')` (`:41`): `it('names each field from its label')`. Call `open()`, click `#auth-tab-signup`, then expect `screen.getByLabelText('Full Name')` to be `document.getElementById('auth-name-input')`, `getByLabelText('Email Address')` to be `#auth-email-input`, and `getByLabelText('Password')` to be `#auth-password-input`. Catches `AuthModal.tsx:182,199,217`.
2. `unit/authenticated-ledger.test.tsx`, in `describe('the Account & Security modal (ADR 0024)')` (`:2280`): `it('names the profile and password fields from their labels')`. Call `open()`, then `await screen.findByLabelText('Display Name')` is `#profile-name-input`; `getByLabelText('New Password')` is `#security-new-password`; `getByLabelText('Confirm Password')` is `#security-confirm-password`. Catches `AccountModal.tsx:611,671,682`.
3. `unit/wallets-page.test.tsx`, a new `describe('the Add Wallet form (audit 2026-10-16 UI-03)')` at the end of the file: render `<FinanceProvider><AddWalletModal isOpen onClose={() => {}} /></FinanceProvider>` (import `AddWalletModal` from `../src/components/wallet/AddWalletModal`), then `getByLabelText(/^Wallet Name/)` is `#new-wallet-name`, `getByLabelText('Type')` is `#new-wallet-type`, `getByLabelText(/^Starting Balance/)` is `#new-wallet-init-balance`. Catches `AddWalletForm.tsx:95,109,136`.
4. `unit/csv-import-categories.test.tsx`, in `describe("the preview's category picker")` (`:46`): `it('names the file picker and each row picker')`. `await openWith([',EXPENSE,45,zzzlunch'])`, then `screen.getByLabelText('Select CSV File')` is `#csv-file-input`, and `screen.getByRole('combobox', { name: 'Category for row 2: zzzlunch' })` is `screen.getByTestId('csv-row-category-2')`. Catches `ImportCsvModal.tsx:359` and `:547`.

Red gate: write the four tests first, run them against the unfixed source (stash the `src/` edits, or write the tests before the edits) and record that all four fail, then make the change.

## 8. Gates

Check ports 3000 and 3100 for stale dev servers before Playwright. Save full-suite output under `workflow/stages/02_build/output/logs/`.

1. Red gate: `npx vitest run unit/auth-password.test.tsx unit/authenticated-ledger.test.tsx unit/wallets-page.test.tsx unit/csv-import-categories.test.tsx` on the unfixed source: exactly the 4 new tests fail.
2. `npm run lint`
3. `npx vitest run unit/auth-password.test.tsx unit/authenticated-ledger.test.tsx unit/wallets-page.test.tsx unit/csv-import-categories.test.tsx`: all pass.
4. `npm run test:unit 2>&1 | tee workflow/stages/02_build/output/logs/T768-unit.log`: 62 files, 1436 tests (1432 + 4), all pass.
5. `npx playwright test tests/auth.spec.ts tests/account-and-mobile-nav.spec.ts tests/wallet-forms.spec.ts tests/wallets.spec.ts tests/soft-delete.spec.ts tests/csv.spec.ts tests/csv-classify.spec.ts tests/ios-field-zoom.spec.ts --project=chromium`
6. The same 8 specs without a project filter (all three browsers), teed to `workflow/stages/02_build/output/logs/T768-e2e.log`.
7. For `baseline-metrics.md`: `npm run clean; npm run build` with the repo's `.env` present, and record entry chunk, all app JS and CSS raw and gzip-9 bytes against Phase 135. Expect a small entry or chunk delta from the added attributes.
8. `git diff --stat` shows only the Target files plus bookkeeping; `git status --porcelain` shows nothing else.
9. Line endings: `git ls-files --eol <each changed file>` keeps `w/crlf` (every target file is `w/crlf` today).
10. `git diff -U0 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log((s.match(/\u2014/g)||[]).length))"` prints 0 (no em dash added).
11. `grep -rn "<label" src --include=*.tsx | grep -v htmlFor` lists only `AddWalletForm.tsx`'s `Currency` and `Color` labels, `EditTransactionPanel.tsx:201,280,302,326` and `TransactionForm.tsx:1091`.

## 9. Production touch points

None. The Playwright specs run against the guest dev server; nothing signs in, calls `/api/*` or touches Supabase.

## 10. Bookkeeping the builder writes

- `docs/audit/task-ledger.md`: add `## Phase 136 - Form labels: htmlFor on every field and a name for the CSV row category (accessibility, no ADR)` above `## Backlog`, with the branch line in the house style and the T768 row; set the four Backlog rows (`:132-135`) to `done in Phase 136 (T768)`; add one Backlog row: "AddWalletForm's `Currency` and `Color` `<label>`s name no labelable control (a read-only `div` and a swatch button group); make them a `span` or a `role="group"` with `aria-labelledby`", source "Phase 136, T768's spec", status `todo`.
- `docs/audit/refactor-log.md`: a Phase 136 entry at the top of the list, with `Changed`, `Verified`, `Surprises` and `Deliberately not done` (name the Currency and Color labels, the stale counts in `AGENTS.md:11` and `README.md:157`, and section 11 below).
- `docs/audit/baseline-metrics.md`: a `### Phase 136 - delta against Phase 135` section at the top of Figures: bundle, Vitest and the Playwright run from gate 6.

## 11. Out of scope

- `AddWalletForm.tsx`'s `Currency` (`:125`) and `Color` (`:151`) labels: no labelable control; a Backlog row instead.
- `EditTransactionPanel.tsx` and `TransactionForm.tsx` labels: already named.
- Any id, `data-testid`, label text, class or layout change; `docs/audit/test-selector-contract.md`.
- Wrapping inputs inside labels instead of `htmlFor`, or adding `aria-label` where a visible label exists.
- The test counts in `AGENTS.md:11` and `README.md:157` (editing `AGENTS.md` would pause the phase for no behaviour; left for the deploy record or a later docs task).
- Any other audit 2026-10-16 finding (for example SL-01, UI-06).
