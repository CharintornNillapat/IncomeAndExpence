# T790 spec: apply the `<view>-<thing>-<kind>` DOM id convention

Phase 142 (`phase-142-clean-up-id-conventions`). Backlog row: `docs/audit/task-ledger.md:84` ("Every interactive element added to a view carries an `id` following `<view>-<thing>-<kind>`"). On completion the builder sets that row's Status to `done in Phase 142 (T790)` and keeps the T790 task row.

## 1. Goal

Verify the id convention across `src/` and bring every id that breaks it into line, so the Backlog row can become a written rule. The rule is made precise below, a unit guard enforces the part a machine can check, and every spec, unit test and the selector contract move with the code in the same commit. No behaviour changes.

### The rule (made precise by this spec)

- **`<view>`** is the first segment and must be one of the area prefixes: `auth`, `account`, `navbar`, `mobile-nav`, `nav-tab`, `pwa`, `view`, `dashboard`, `time-filter`, `tx`, `csv`, `confirm`, `quickadd`, `wallet`, `debt`, `diary`, `category`. (`time-filter` is a named exception: `src/selectors/timeRange.ts:5` says `#time-filter-*` is frozen by `date-boundary.spec.ts`.)
- **`<kind>`**: a button's id ends `-btn` (or carries `-btn-<entity>` when an entity id follows, as `tx-save-btn-*` does), a link's ends `-link`. Never `-button`. Other elements (fields, containers, headings) have no mandatory kind suffix: `<thing>` names them (`wallet-new-name`).
- **Per-entity ids** are `<view>-<thing>-<entityId>` (`debt-card-*`, `tx-row-*`).
- **Composed ids** (a caller supplies the prefix, for example `${formId}-desc` in `TransactionForm`, `${idPrefix}-...` in `ColorGrid`, `SaveRuleChip`, `CategorySuggestionChip`, `InlineMathInput`) keep their `#*-desc` style suffix families. Only the caller-supplied prefix literal is checked.
- Non-interactive ids that already start with an area prefix (`account-delete`, `account-sessions`, `tx-drawer`) are not touched.

The survey (all `id=` literals and template ids in `src/`, 2026-10-21) found `AuthModal.tsx`, `Navbar`, `MobileBottomNav`, `NavbarLedgerStatus`, `GuestDataNotice`, `DashboardView`'s card ids, `TransactionsView`, `EditTransactionPanel`, `WalletList`/`WalletDetail` view ids, and the diary form buttons already comply. The renames below are the complete list of violations.

## 2. Target files

The builder may change exactly these (plus bookkeeping files).

Guard test (new):
- `unit/dom-id-convention.test.ts`

Source (`src/`), every line that carries an id in the rename table, and the comment lines that name one:
- `src/components/ReloadPrompt.tsx`
- `src/components/account/AccountModal.tsx`
- `src/components/category/CategoryForm.tsx`
- `src/components/category/CategoryList.tsx`
- `src/components/category/SmartRulesPanel.tsx`
- `src/components/dashboard/SpendingInsightsCard.tsx`
- `src/components/dashboard/WalletsSection.tsx`
- `src/components/debt/DebtCard.tsx`
- `src/components/debt/EditDebtModal.tsx`
- `src/components/diary/DiaryEntryForm.tsx`
- `src/components/diary/DiaryEntryRow.tsx`
- `src/components/transaction/ImportCsvModal.tsx`
- `src/components/ui/ConfirmDialog.tsx`
- `src/components/wallet/AddWalletModal.tsx`
- `src/components/wallet/TransferFundsModal.tsx`
- `src/components/wallet/WalletDetail.tsx`
- `src/components/QuickAddModal.tsx`
- `src/components/TransactionForm.tsx` (only the `submitBtnId` line and the doc comment at `:38-39`; see the table)
- `src/views/CategoriesView.tsx`
- `src/views/DebtsView.tsx`
- `src/views/DiaryView.tsx`
- `src/views/TransactionsView.tsx` (only `close-add-transaction-modal-btn` at `:506`)

Tests that follow (locator moves only, per the spec-edit policy in `docs/contexts/ui-and-e2e.md`; no assertion deleted or weakened):
- every file under `tests/` and `unit/` that the leftover grep in section 7 hits. Known today: `tests/account-and-mobile-nav.spec.ts`, `auth.spec.ts`, `categories-page.spec.ts`, `categories.spec.ts`, `csv-classify.spec.ts`, `csv.spec.ts`, `dashboard.spec.ts`, `date-boundary.spec.ts`, `debt-repayment.spec.ts`, `debts-page.spec.ts`, `debts.spec.ts`, `diary-page.spec.ts`, `diary.spec.ts`, `insights.spec.ts`, `ios-field-zoom.spec.ts`, `keywords.spec.ts`, `presets.spec.ts`, `reduced-motion.spec.ts`, `routing.spec.ts`, `smart-rules.spec.ts`, `soft-delete.spec.ts`, `transaction-edit.spec.ts`, `transfer-preview.spec.ts`, `wallet-forms.spec.ts`, `wallets-page.spec.ts`, `wallets.spec.ts`; `unit/dashboard.test.tsx`, `unit/debts-page.test.tsx`, `unit/diary-page.test.tsx`, `unit/authenticated-ledger.test.tsx` (`:2448-2450`), `unit/wallets-page.test.tsx`, and whichever others the grep finds.

Docs:
- `docs/audit/test-selector-contract.md`
- `docs/contexts/ui-and-e2e.md`
- `docs/audit/task-ledger.md` (Backlog row `:84`, a T790 row, a Phase 142 section)

No ADR: the task is a behaviour-preserving rename with the alternatives fixed by the existing spec-edit policy (Phase 141 shipped without one). `AGENTS.md` is not a target; its unit test count (`1463 tests, 63 files`) changes when this task adds a test file, and the phase's closing docs task re-measures and updates it. Do not touch `docs/audit/decisions/*` (they quote old ids as history).

## 3. Context to read

- `docs/contexts/ui-and-e2e.md` (selector contract, spec-edit policy, Playwright suite section) and `docs/audit/test-selector-contract.md`.
- `docs/contexts/client-state.md` only for `unit/` harness notes if the guard test needs them (it does not render anything; it reads files).

## 4. Current behaviour

- `docs/audit/task-ledger.md:84` records the convention as unverified. `AuthModal.tsx:127-277` complies (`auth-close-btn`, `auth-email-input`, ...).
- Violations by file (all `file:line` from the 2026-10-21 grep; the line numbers may shift by one or two, the table is keyed by id):
  - `ReloadPrompt.tsx`: `pwa-dismiss-button`, `pwa-reload-button` (kind `-button`).
  - `AccountModal.tsx`: `profile-name-input`, `security-confirm-password`, `security-new-password` (no area prefix); `:288` `session-item-${s.id}`.
  - `CategoryForm.tsx:67` `const prefix = isEdit ? 'edit-category' : 'new-category'` feeds `${prefix}-form|-name|-description|-color-label|-color-sharing` and `ColorGrid idPrefix` (`ColorGrid.tsx:49,75`); `:112-113` `new-category-type-expense|income`; `:175,178,207` `edit-category-save-btn`, `edit-category-cancel-btn`, `save-category-btn`; `:189` `delete-category-${editing.id}`.
  - `CategoryList.tsx:56` `edit-category-${category.id}`.
  - `SmartRulesPanel.tsx`: `keyword-category-select`, `new-keyword-input`, `save-keyword-rule-btn`, `test-parser-input`; `:173` `rule-row-${rule.id}`.
  - `CategoriesView.tsx`: `open-new-category-btn`.
  - `SpendingInsightsCard.tsx`: `insights-collapse-btn`, `insights-generate-btn`, `insights-refresh-btn`.
  - `WalletsSection.tsx`: `hero-add-wallet-btn`, `hero-manage-all-wallets-btn`, `hero-transfer-funds-btn`.
  - `DebtsView.tsx`: `open-add-debt-btn`, `new-debt-*` (`name`, `total`, `remaining`, `interest`, `min-payment`, `due-date`), `save-new-debt-btn`; `:398` `idPrefix="repay"`.
  - `EditDebtModal.tsx`: `edit-debt-form|name|total|owed|interest|min-payment|due-date|error`, `save-edit-debt-btn`.
  - `DebtCard.tsx:74,76,125,133`: `edit-debt-${id}`, `delete-debt-${id}`, `open-repay-modal-${id}`, `settle-debt-${id}`.
  - `TransactionForm.tsx:179` `confirm-${idPrefix}-btn`; `:177-178,851-858` `${idPrefix}-amount-math|wallet-select|payoff-full|half|minimum`.
  - `DiaryEntryForm.tsx`: `activity-btn-rest`, `activity-btn-workout`, `food-btn-${...}`, `mood-btn-${level}`, `save-diary-entry-btn`; `DiaryEntryRow.tsx:48,50` `edit-diary-${id}`, `delete-diary-${id}`; `DiaryView.tsx` `export-diary-btn`.
  - `ImportCsvModal.tsx`: `commit-import-btn`, `import-commit-error`.
  - `ConfirmDialog.tsx:63` `cancel-confirm-btn`.
  - `QuickAddModal.tsx:96` `close-quick-record-modal-btn`; `TransactionsView.tsx:506` `close-add-transaction-modal-btn`.
  - `AddWalletModal.tsx:26-30` and `TransferFundsModal.tsx:50-56`: the `ids` objects (`new-wallet-*`, `save-new-wallet-btn`, `transfer-*`, `execute-transfer-btn`).
  - `WalletDetail.tsx:174-175`: `archive-wallet-${id}`, `delete-wallet-${id}`.
- No test checks the convention today. The Playwright suite and `unit/` reference the old names (grep `tests`, `unit`).

## 5. Parity map

- "Spec-asserted DOM ids" must match `docs/audit/test-selector-contract.md` and the specs, guarded by the Playwright suite. This task is that row.
- No other row (ledger arithmetic, SQL, api, CSP) is touched.

## 6. Tests to add

### Guard: `unit/dom-id-convention.test.ts` (new)

Reads `src/components/**/*.tsx` and `src/views/**/*.tsx` as text (use `fs` + a recursive directory walk; write the file with the Write/Edit tool, not a bash heredoc, since it contains backslashes; see the memory note on heredocs). Defines `AREAS` as the section 1 list. Collects, from each file:

1. `id="…"` and `closeButtonId="…"` literals (skip any containing `{`).
2. `id: '…'` and `id: ` + backtick object-literal ids whose text contains a `-` (this skips nav items such as `{ id: 'dashboard' }` and `option.id`).
3. Template ids `id={`…`}`: the literal text before the first `${`; skip when it is empty (the id starts with `${`, a composed id).
4. `idPrefix="…"` literals.
5. In `src/components/wallet/AddWalletModal.tsx` and `TransferFundsModal.tsx` only: the string values of the `ids={{ … }}` object (`key: 'value',` lines).

Assertions: every collected id equals an area or starts with `<area>-` for an area in `AREAS` (a template prefix must start with `<area>-`), and none ends with `-button`. Failure messages list `file: id` for each offender. One more test asserts the collector finds at least 100 ids (so a broken regex cannot pass vacuously; today there are about 210).

Why it fails today: the offenders in section 4 (about 90 ids), for example `pwa-dismiss-button` and `hero-add-wallet-btn`.

Order (not a money path, but red first anyway): write the test, run `npx vitest run unit/dom-id-convention.test.ts`, save the failure to `workflow/stages/02_build/output/logs/T790-red.log`, then do the renames and watch it go green.

### Existing tests

No new Playwright tests. Existing specs and unit tests are updated as locator moves only. Do not weaken any assertion.

## The rename table (exact; section 7 greps prove none is left)

Apply every row everywhere: `src/`, `tests/`, `unit/`, the selector contract. A pattern ending `*` stands for the entity or suffix part, which is unchanged.

| Old | New |
|---|---|
| `pwa-dismiss-button` | `pwa-dismiss-btn` |
| `pwa-reload-button` | `pwa-reload-btn` |
| `profile-name-input` | `account-profile-name-input` |
| `security-new-password` | `account-security-new-password` |
| `security-confirm-password` | `account-security-confirm-password` |
| `session-item-*` | `account-session-item-*` |
| `CategoryForm` `prefix` literals `'edit-category'` / `'new-category'` | `'category-edit'` / `'category-new'` (so `edit-category-name` becomes `category-edit-name`, `new-category-form` becomes `category-new-form`, `new-category-color-*` becomes `category-new-color-*`, and so on for every `${prefix}-…`) |
| `new-category-type-expense`, `new-category-type-income` | `category-new-type-expense`, `category-new-type-income` |
| `edit-category-save-btn` | `category-edit-save-btn` |
| `edit-category-cancel-btn` | `category-edit-cancel-btn` |
| `save-category-btn` | `category-new-save-btn` |
| `delete-category-*` | `category-delete-*` |
| `edit-category-<id>` (the `CategoryList.tsx:56` wrapper) | `category-edit-<id>` |
| `open-new-category-btn` | `category-open-new-btn` |
| `keyword-category-select` | `category-rules-keyword-select` |
| `new-keyword-input` | `category-rules-new-keyword-input` |
| `save-keyword-rule-btn` | `category-rules-save-btn` |
| `test-parser-input` | `category-rules-test-parser-input` |
| `rule-row-*` | `category-rule-row-*` |
| `insights-collapse-btn`, `insights-generate-btn`, `insights-refresh-btn` | `dashboard-insights-collapse-btn`, `dashboard-insights-generate-btn`, `dashboard-insights-refresh-btn` |
| `hero-add-wallet-btn` | `dashboard-wallets-add-btn` |
| `hero-manage-all-wallets-btn` | `dashboard-wallets-manage-btn` |
| `hero-transfer-funds-btn` | `dashboard-wallets-transfer-btn` |
| `open-add-debt-btn` | `debt-open-add-btn` |
| `new-debt-name\|total\|remaining\|interest\|min-payment\|due-date` | `debt-new-name\|total\|remaining\|interest\|min-payment\|due-date` |
| `save-new-debt-btn` | `debt-new-save-btn` |
| `edit-debt-form\|name\|total\|owed\|interest\|min-payment\|due-date\|error` | `debt-edit-form\|name\|total\|owed\|interest\|min-payment\|due-date\|error` |
| `save-edit-debt-btn` | `debt-edit-save-btn` |
| `edit-debt-<id>` (menu item) | `debt-edit-<id>` |
| `delete-debt-*` | `debt-delete-*` |
| `open-repay-modal-*` | `debt-open-repay-*` |
| `settle-debt-*` | `debt-settle-*` |
| `idPrefix="repay"` (`DebtsView.tsx:398`) | `idPrefix="debt-repay"`, so `repay-amount-math` becomes `debt-repay-amount-math`, `repay-wallet-select` becomes `debt-repay-wallet-select`, `repay-payoff-full\|half\|minimum` become `debt-repay-payoff-full\|half\|minimum` |
| `confirm-repay-btn` | `debt-repay-confirm-btn`: change `TransactionForm.tsx:179` from `` `confirm-${idPrefix}-btn` `` to `` `${idPrefix}-confirm-btn` `` and the doc comment at `:38-39` to match |
| `mood-btn-*` | `diary-mood-btn-*` |
| `food-btn-*` | `diary-food-btn-*` |
| `activity-btn-rest`, `activity-btn-workout` | `diary-activity-btn-rest`, `diary-activity-btn-workout` |
| `save-diary-entry-btn` | `diary-save-entry-btn` |
| `edit-diary-*` | `diary-edit-*` |
| `delete-diary-*` | `diary-delete-*` |
| `export-diary-btn` | `diary-export-btn` |
| `commit-import-btn` | `csv-commit-btn` |
| `import-commit-error` | `csv-commit-error` |
| `cancel-confirm-btn` | `confirm-cancel-btn` |
| `close-quick-record-modal-btn` | `quickadd-close-btn` |
| `close-add-transaction-modal-btn` | `tx-add-modal-close-btn` |
| `new-wallet-name\|type\|currency\|init-balance` | `wallet-new-name\|type\|currency\|init-balance` |
| `save-new-wallet-btn` | `wallet-new-save-btn` |
| `transfer-source-wallet` | `wallet-transfer-source` |
| `transfer-dest-wallet` | `wallet-transfer-dest` |
| `transfer-amount-math` | `wallet-transfer-amount-math` |
| `transfer-note` | `wallet-transfer-note` |
| `transfer-swap-btn` | `wallet-transfer-swap-btn` |
| `transfer-all-chip` | `wallet-transfer-all-chip` |
| `execute-transfer-btn` | `wallet-transfer-execute-btn` |
| `archive-wallet-*` | `wallet-archive-*` |
| `delete-wallet-*` | `wallet-delete-*` |

Do not rename: `data-testid` values (`transfer-balance-after-*`, `repay-payoff-preview`, `insights-card`, `csv-row-category-*`, and the rest), the `time-filter-*` ids, composed suffix families (`#*-desc`, `#*-category`, `#*-wallet`, `*-save-rule-*`, `*-suggestion-apply`, `*-voice-btn`, `*-shortcut-*`, `*-preset-chip-*`, `*-template-name`), and ids already compliant. The `#*-wallet` suffix match must still not hit `wallet-transfer-source` (it ends `-source`) or `wallet-new-*`; the specs that use `[id$="-wallet"]` keep their meaning, but confirm by running them. `shortcut-repay-debt` / `shortcut-transfer` stay (`TransactionForm.tsx:1160`, composed).

### Selector contract and context doc

- `docs/audit/test-selector-contract.md`: regenerate the "Selectors by spec" list from the specs (method on `:20`), update the "grepped" date to 2026-10-21, and add a short "Convention" section under Rule stating the rule from section 1 (area list, kind rule, the `time-filter` and composed-suffix exceptions) and that the guard is `unit/dom-id-convention.test.ts`. Any prose that names a renamed id (hazards section, `#delete-category-*` at `:103`, `#new-category-*` / `#edit-category-*` at `:106`, `#wallet-detail-*`) is updated too.
- `docs/contexts/ui-and-e2e.md`: add one short paragraph under "Selector contract" saying new interactive ids follow the convention and the guard enforces the prefix. The rule goes here, not in `AGENTS.md`, because the code now complies.
- Keep CRLF on every edited file (`git ls-files --eol` shows `w/crlf`): edit with the Edit tool or a Node read/replace/write that preserves `\r\n`.

## 7. Gates

Run in this order; save full-suite output under `workflow/stages/02_build/output/logs/`.

1. Red run (section 6): `npx vitest run unit/dom-id-convention.test.ts` before the renames, log to `workflow/stages/02_build/output/logs/T790-red.log`.
2. Leftover grep, must print nothing (old ids anchored so new names do not match; testids excluded by listing exact old ids). Run it from the repo root, excluding history:
   `grep -rnE "(^|[^a-z-])(new-(wallet|debt|category)-|edit-(category|debt|diary)-|delete-(category|debt|diary|wallet)-|archive-wallet-|save-(category|new-wallet|new-debt|edit-debt|diary-entry|keyword-rule)-?(btn)?|open-(add-debt|new-category)-btn|open-repay-modal-|settle-debt-|hero-(add-wallet|manage-all-wallets|transfer-funds)-btn|mood-btn-|food-btn-|activity-btn-|export-diary-btn|commit-import-btn|import-commit-error|cancel-confirm-btn|close-quick-record-modal-btn|close-add-transaction-modal-btn|execute-transfer-btn|transfer-(source-wallet|dest-wallet|amount-math|note|swap-btn|all-chip)|repay-(amount-math|wallet-select|payoff-(full|half|minimum))|confirm-repay-btn|keyword-category-select|new-keyword-input|test-parser-input|profile-name-input|security-(new|confirm)-password|pwa-(dismiss|reload)-button|insights-(collapse|generate|refresh)-btn|rule-row-|session-item-)" src tests unit docs/contexts docs/audit/test-selector-contract.md README.md DESIGN.md`
   If a hit is a legitimate non-id use (for example `save-category-btn` inside a code comment about history), rewrite the comment or report it in the build report; do not exempt silently.
3. `npm run lint`
4. `npx vitest run unit/dom-id-convention.test.ts` (green), then `npx vitest run` on each changed `unit/` file, then `npm run test:unit` (log to `workflow/stages/02_build/output/logs/T790-unit.log`).
5. Check ports 3000 and 3100 for stale dev servers, then `npx playwright test <each changed spec> --project=chromium`, then `npm test` (all projects; log to `workflow/stages/02_build/output/logs/T790-playwright.log`). Do not edit `src/` while Playwright runs.
6. Docs: `git ls-files --eol` on every edited file shows `w/crlf` unchanged; em dash count in added lines is 0: `node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"` and, for the new test file, `node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" unit/dom-id-convention.test.ts`.
7. `git status --porcelain` shows only the Target files and bookkeeping.

## 8. Production touch points

None. No SQL, no `/api/*`, no `vercel.json`, no dependency. (`src/components` and `src/views` are not money paths; `TransactionForm.tsx` changes only an id string and a comment, not its arithmetic or the debt payoff block.)

## 9. Out of scope

- Renaming `data-testid` values, the `time-filter-*` ids, the composed suffix families, or any id already compliant.
- Adding `-input` / `-select` kind suffixes to field ids; changing any non-interactive id that already has an area prefix.
- `AGENTS.md` (the closing docs task updates the test count and file count), `docs/audit/decisions/*`, `docs/audit/archive/`, `README.md` beyond the leftover grep, `refactor-log.md`, `baseline-metrics.md`.
- Any behaviour, styling, copy or accessibility change, including the open Backlog rows nearby (ESLint, React Compiler, `transfer_funds` replay).
- Moving any control into `OverflowMenu` or reordering DOM.
