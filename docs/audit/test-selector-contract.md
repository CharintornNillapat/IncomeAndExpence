# Playwright selector contract

The ids and `data-testid`s that `tests/*.spec.ts` use today. They are **API surface**: added freely, never removed, renamed only in the same commit that updates every spec referencing them. For how each one got here (Phases 19 to 124), see `archive/test-selector-log-phases-019-124.md`, read only for historical research.

## Rule

- An `id` or `data-testid` referenced by a spec stays stable across restyles. Visual changes (colour, spacing, copy) must not require a selector change.
- `data-testid` is preferred over a Tailwind-class or DOM-structure assertion for anything a later phase might restyle.
- A spec edit is only ever a **locator move for a surviving assertion**: see the spec-edit policy in `docs/contexts/ui-and-e2e.md`. Never delete or weaken an assertion to make a refactor pass.

## Selectors by spec (grepped 2026-10-15)

How to read the list:

- `*` stands for an entity id, a tab name or a template part. `#tx-row-*` is `[id^="tx-row-"]` or `` `#tx-row-${id}` ``.
- `#*-desc`, `#*-category`, `#*-wallet` and the like are suffix matches (`[id$="-desc"]`) on `TransactionForm`'s fields, whose prefix depends on the caller.
- The entity ids specs fill in come from the seeds: `wal-cash`, `wal-main-checking`, `wal-savings`, `cat-food`, `cat-groceries`, `cat-housing`, `debt-starter-01`.
- `account-and-mobile-nav.spec.ts:40` and `:84` assert `#mobile-nav-tab-security` and `#nav-tab-security` are **absent**.

To regenerate, grep the specs for `#`-ids, `[id^=`, `[id$=`, `[id*=`, `data-testid` and `getByTestId`.

- `account-and-mobile-nav.spec.ts`: ids `#*-desc`, `#account-delete`, `#account-delete-btn`, `#account-export`, `#account-export-btn`, `#account-import-input`, `#account-modal`, `#account-modal-close-btn`, `#account-sessions`, `#account-signin-btn`, `#account-status-card`, `#auth-email-input`, `#auth-guest-data-notice`, `#auth-guest-export-btn`, `#close-quick-record-modal-btn`, `#dashboard-wallet-card-*`, `#hero-add-wallet-btn`, `#mobile-nav-account-btn`, `#mobile-nav-more-btn`, `#mobile-nav-quick-add-btn`, `#mobile-nav-tab-*`, `#nav-tab-*`, `#navbar-account-btn`, `#navbar-quick-add-btn`, `#navbar-signin-btn`, `#new-wallet-init-balance`, `#new-wallet-name`, `#save-new-wallet-btn`, `#tx-drawer-close-btn`, `#tx-row-*`, `#view-loading-fallback`, `#wallet-adjust-btn-*`, `#wallet-adjust-input`, `#wallet-adjust-save-btn`, `#wallet-detail-balance`
- `auth.spec.ts`: ids `#auth-back-to-signin-link`, `#auth-close-btn`, `#auth-email-input`, `#auth-forgot-password-link`, `#auth-name-input`, `#auth-password-hint`, `#auth-password-input`, `#auth-tab-signin`, `#auth-tab-signup`, `#navbar-signin-btn`, `#time-filter-week`
- `categories-page.spec.ts`: ids `#category-form-heading`, `#category-group-expense`, `#category-group-system`, `#category-row-*`, `#edit-category-*`, `#edit-category-cancel-btn`, `#edit-category-name`, `#new-category-color-*`, `#new-category-name`, `#save-category-btn`
- `categories.spec.ts`: ids `#*-category`, `#category-group-income`, `#category-row-*`, `#category-subtab-rules`, `#confirm-destructive-btn`, `#delete-category-*`, `#edit-category-*`, `#edit-category-cancel-btn`, `#edit-category-description`, `#edit-category-name`, `#edit-category-save-btn`, `#keyword-category-select`, `#navbar-quick-add-btn`, `#new-category-description`, `#new-category-name`, `#new-category-type-expense`, `#new-category-type-income`, `#save-category-btn`
- `csv-classify.spec.ts`: ids `#commit-import-btn`, `#csv-classify-btn`, `#csv-classify-cancel-btn`, `#csv-file-input`, `#tx-import-csv-btn`, `#tx-import-export-btn`, `#tx-row-*`; test ids `csv-classify-announcer`, `csv-classify-note`, `csv-classify-progress`, `csv-classify-wait`, `csv-row-category-*`, `csv-row-confidence-*`
- `csv.spec.ts`: ids `#commit-import-btn`, `#csv-file-input`, `#tx-export-csv-btn`, `#tx-import-csv-btn`, `#tx-import-export-btn`
- `dashboard.spec.ts`: ids `#dashboard-category-details-btn`, `#dashboard-log-mood-btn`, `#dashboard-repay-btn`, `#dashboard-view-all-transactions-btn`, `#dashboard-wallet-card-*`, `#hero-manage-all-wallets-btn`, `#nav-tab-debts`, `#nav-tab-diary`, `#nav-tab-transactions`, `#nav-tab-wallets`, `#time-filter-all`, `#time-filter-day`, `#time-filter-month`, `#time-filter-week`; test ids `metric-card-expense`, `metric-card-income`, `net-worth-card`
- `date-boundary.spec.ts`: ids `#time-filter-week`, `#wallet-detail-meta`, `#wallet-entity-*`; test ids `metric-card-expense`
- `debt-repayment.spec.ts`: ids `#*-desc`, `#confirm-repay-btn`, `#debt-card-*`, `#navbar-quick-add-btn`, `#new-debt-min-payment`, `#new-debt-name`, `#new-debt-total`, `#open-add-debt-btn`, `#open-repay-modal-*`, `#repay-amount-math`, `#repay-payoff-full`, `#repay-payoff-half`, `#repay-payoff-minimum`, `#save-new-debt-btn`; test ids `repay-overpayment-note`, `repay-payoff-preview`, `repay-remaining-after`, `repay-settle-note`
- `debts-page.spec.ts`: ids `#confirm-destructive-btn`, `#debt-card-*`, `#debt-menu-btn-*`, `#edit-debt-*`, `#edit-debt-error`, `#edit-debt-name`, `#edit-debt-total`, `#new-debt-due-date`, `#new-debt-name`, `#new-debt-total`, `#open-add-debt-btn`, `#save-edit-debt-btn`, `#save-new-debt-btn`, `#settle-debt-*`
- `debts.spec.ts`: ids `#confirm-repay-btn`, `#debt-card-*`, `#new-debt-interest`, `#new-debt-min-payment`, `#new-debt-name`, `#new-debt-total`, `#open-add-debt-btn`, `#open-repay-modal-*`, `#repay-amount-math`, `#repay-wallet-select`, `#save-new-debt-btn`, `#settle-debt-*`
- `diary-page.spec.ts`: ids `#confirm-destructive-btn`, `#delete-diary-*`, `#diary-cal-day-*`, `#diary-cal-prev-month-btn`, `#diary-card-*`, `#diary-day-spending`, `#diary-day-tx-link-*`, `#diary-menu-btn-*`, `#diary-next-day-btn`, `#diary-notes-textarea`, `#diary-prev-day-btn`, `#diary-save-status`, `#mood-btn-*`, `#nav-tab-*`, `#save-diary-entry-btn`, `#tx-day-filter`, `#tx-row-*`
- `diary.spec.ts`: ids `#diary-notes-textarea`, `#export-diary-btn`, `#mood-btn-*`, `#save-diary-entry-btn`; test ids `diary-entry-notes`
- `express-input.spec.ts`: ids `#*-category`, `#*-desc`, `#navbar-quick-add-btn`, `#tx-row-*`
- `helpers.ts` (the shared helpers): ids `#*-desc`, `#*-wallet`, `#nav-tab-*`, `#navbar-quick-add-btn`, `#view-loading-fallback`
- `insights.spec.ts`: ids `#insights-collapse-btn`, `#insights-generate-btn`; test ids `insights-body`, `insights-card`, `insights-offline-note`, `insights-signin-note`
- `ios-field-zoom.spec.ts`: ids `#category-subtab-rules`, `#csv-file-input`, `#navbar-quick-add-btn`, `#navbar-signin-btn`, `#new-keyword-input`, `#open-add-debt-btn`, `#tx-edit-amount`, `#tx-import-csv-btn`, `#tx-import-export-btn`, `#tx-open-add-modal-btn`, `#tx-row-*`, `#wallet-add-modal-btn`, `#wallet-transfer-modal-btn`; test ids `csv-row-category-*`
- `jev-classify.spec.ts`: ids `#*-category`, `#*-desc`, `#*-suggestion-apply`, `#*-wallet`, `#navbar-quick-add-btn`; test ids `tx-category-suggestion`, `tx-save-rule`
- `keywords.spec.ts`: ids `#category-subtab-rules`, `#keyword-category-select`, `#new-keyword-input`, `#rule-row-*`, `#save-keyword-rule-btn`, `#test-parser-input`; test ids `metric-cleaned-description`, `metric-extracted-amount`, `metric-inferred-type`, `metric-matched-category`
- `layout-stability.spec.ts`: ids `#mobile-nav-tab-*`, `#nav-tab-*`, `#view-loading-fallback`
- `presets.spec.ts`: ids `#*-desc`, `#*-preset-chip-*`, `#*-template-name`, `#close-quick-record-modal-btn`, `#navbar-quick-add-btn`, `#quickadd-preset-apply-*`, `#quickadd-preset-chip-*`, `#tx-row-*`
- `reduced-motion.spec.ts`: ids `#*-desc`, `#close-quick-record-modal-btn`, `#navbar-quick-add-btn`, `#time-filter-week`
- `routing.spec.ts`: ids `#*-shortcut-repay-debt`, `#*-shortcut-transfer`, `#close-quick-record-modal-btn`, `#nav-tab-*`, `#navbar-quick-add-btn`, `#transfer-source-wallet`, `#view-loading-fallback`
- `safe-area.spec.ts`: ids `#mobile-nav-quick-add-btn`, `#view-loading-fallback`
- `smart-rules.spec.ts`: ids `#*-category`, `#*-desc`, `#*-save-rule-btn`, `#*-save-rule-dismiss`, `#category-subtab-rules`, `#close-quick-record-modal-btn`, `#navbar-quick-add-btn`, `#open-repay-modal-*`, `#rule-row-*`; test ids `tx-save-rule`
- `soft-delete.spec.ts`: ids `#*-desc`, `#confirm-destructive-btn`, `#confirm-repay-btn`, `#debt-card-*`, `#debt-menu-btn-*`, `#delete-debt-*`, `#delete-wallet-*`, `#new-debt-name`, `#new-debt-total`, `#new-wallet-name`, `#open-add-debt-btn`, `#open-repay-modal-*`, `#repay-amount-math`, `#repay-payoff-full`, `#repay-wallet-select`, `#save-new-debt-btn`, `#save-new-wallet-btn`, `#tx-delete-btn-*`, `#tx-restore-btn-*`, `#tx-row-*`, `#tx-show-deleted`, `#wallet-add-modal-btn`, `#wallet-detail-menu-btn`, `#wallet-entity-*`; test ids `wallet-balance-*`
- `storage-persistence.spec.ts`: none (it reads storage and visible text only)
- `theme.spec.ts`: ids `#navbar-quick-add-btn`, `#navbar-theme-toggle-btn`; test ids `net-worth-card`
- `toast-layering.spec.ts`: ids `#mobile-nav-more-btn`, `#mobile-nav-more-sheet`, `#mobile-nav-tab-*`, `#tx-open-add-modal-btn`
- `transaction-edit.spec.ts`: ids `#*-desc`, `#confirm-repay-btn`, `#debt-card-*`, `#open-repay-modal-*`, `#repay-amount-math`, `#repay-wallet-select`, `#tx-edit-amount`, `#tx-edit-description`, `#tx-edit-type-income`, `#tx-edit-wallet`, `#tx-row-*`, `#tx-save-btn-*`, `#wallet-entity-*`; test ids `wallet-balance-*`
- `transaction.spec.ts`: ids `#*-desc`, `#*-wallet`, `#navbar-quick-add-btn`, `#tx-filter-type-income`, `#tx-search-input`
- `transfer-preview.spec.ts`: ids `#execute-transfer-btn`, `#hero-transfer-funds-btn`, `#transfer-all-chip`, `#transfer-amount-math`, `#transfer-dest-wallet`, `#transfer-source-wallet`, `#transfer-swap-btn`; test ids `transfer-balance-after-dest`, `transfer-balance-after-source`, `transfer-overdraft-warning`, `transfer-panel-source`
- `voice-input.spec.ts`: ids `#*-category`, `#*-desc`, `#*-voice-btn`, `#navbar-quick-add-btn`; test ids `tx-save-rule`, `tx-voice-error`, `tx-voice-listening`
- `wallet-forms.spec.ts`: ids `#execute-transfer-btn`, `#hero-add-wallet-btn`, `#hero-transfer-funds-btn`, `#new-wallet-init-balance`, `#new-wallet-name`, `#save-new-wallet-btn`, `#transfer-amount-math`, `#transfer-dest-wallet`, `#transfer-source-wallet`, `#wallet-transfer-modal-btn`
- `wallets-page.spec.ts`: ids `#*-wallet`, `#archive-wallet-*`, `#confirm-destructive-btn`, `#dashboard-wallet-card-*`, `#debt-card-*`, `#nav-tab-*`, `#navbar-quick-add-btn`, `#wallet-archived-toggle`, `#wallet-detail-menu-btn`, `#wallet-detail-title`, `#wallet-edit-btn`, `#wallet-edit-form`, `#wallet-edit-name`, `#wallet-edit-save-btn`, `#wallet-entity-*`, `#wallet-unarchive-btn-*`; test ids `wallet-balance-*`
- `wallets.spec.ts`: ids `#new-wallet-init-balance`, `#new-wallet-name`, `#save-new-wallet-btn`

## Hazards

Still true today, and not already in `docs/contexts/ui-and-e2e.md`.

### Text and title locators

The specs also match these by text, so the text is part of the contract:

- `transaction.spec.ts:58`: the Income option by `/^Income$/` (a `SegmentedControl` label must keep its exact text).
- `transaction.spec.ts:103`: `button[title="Clear search"]` (`IconButton`'s `label` sets the title).
- `transaction.spec.ts:137`: the `Calculated:` badge, a `span`.
- `presets.spec.ts:214`: rows filtered by ISO date text. `TransactionRow` keeps its date as `sr-only` text in each row; a date shown only in a `DayGroupHeader` would make the count-2 check fail and the count-0 check pass vacuously.
- `wallet-forms.spec.ts:38`: "Funds transfer" in a transfer row's second line (its title is always "Transfer").
- `date-boundary.spec.ts:37`: "created Sep 18, 2026" in `#wallet-detail-meta`.
- `diary.spec.ts:15` and `theme.spec.ts:60`: the heading `/Daily Diary/i`. Each view has one `PageHeader` `h1`; a second heading with the same name on a view breaks the unique match.
- `dashboard.spec.ts`: the regions "Left over", "Income", "Spending by category", "Debt payoff", "Recent activity", "Net worth and wallets" and "Mood and spending" (matched with `exact: true`, since "Spending insights" is also a region), the "Spending insights" section found by `aria-label`, the sparkline's name, "Daily spending, <period>: highest ฿X on <Ddd, Mmm D>" or "...: nothing spent", the caption text "No income this period", the donut's name "Spending by category: <name> <p>%, ...", the month line's "<Month> 1 to N:" lead and "vs <Mmm>" pill, and "Needed this month".

### Row id prefixes

- The Dashboard's Recent activity rows are `#dashboard-tx-*` and a wallet's activity rows are `#wallet-tx-*` (`ActivityFeed`'s `idPrefix`), never `tx-row-`. A page-wide `tx-row-` match right after `gotoTab(page, 'transactions')` finds only the Transactions page's rows.

### Transactions page

- The selected row's panel is inline from `lg` (1024px, `useMediaQuery`) and a `Modal` below; every spec runs at 1280px, so it sees the inline panel.
- The panel shows the row's note, so a text count taken while it is open includes it. No spec counts text with the panel open.
- The panel's `<select>`s list every wallet and category as `<option>`s, so a strict `getByText('Cash Wallet')` or a category name taken while a row is open can meet one. The note is an input's value, which `getByText` does not match.

### Wallets page

- From `lg` a wallet is always selected, so its name appears twice: in its row and as `#wallet-detail-title`. A strict `getByText` on the selected wallet's name meets both. A new wallet is not auto-selected, which keeps `wallets.spec.ts:33` strict.

### Debt payoff page

- A card and the summary both say "Still owed", but the summary sits outside every `div[id^="debt-card-"]`. A card-scoped `toContainText` never meets it; a page-wide `getByText` on a ฿ amount can meet both.
- The Dashboard's Debt payoff card also has an `h2` "Debt payoff". A heading match right after `gotoTab(page, 'debts')` is safe because the Dashboard is not mounted; a match from the Dashboard would find its `h2`.

### Daily diary

- The form remounts for each day and entry (keyed by both): a locator handle held across a day change points at the old element, so look it up again.
- A spec that needs "yesterday" reads it in the page (`page.evaluate`), so it is the browser's own local day.
- A future calendar day is a disabled button, so a click on it waits and fails rather than doing nothing.

### Categories page

- `#delete-category-*` exists only in that category's edit form: a spec asserting it is absent opens `#edit-category-{id}` first, or the check passes for the wrong reason.
- The New form remounts after each add, starting on the next free colour, so a handle to a swatch held across an add points at the old element.
- A swatch's id is its hex without `#`, lower-cased (`#new-category-color-e879a6`). While any of the twelve colours is free, a used one is a disabled button, so a click waits and fails.
- Below `lg` the edit form is in a sheet while the New form stays on the page, so `#new-category-*` and `#edit-category-*` can both be in the DOM.
