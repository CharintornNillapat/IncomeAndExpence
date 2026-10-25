# Playwright selector contract

The ids and `data-testid`s that `tests/*.spec.ts` use today. They are **API surface**: added freely, never removed, renamed only in the same commit that updates every spec referencing them. For how each one got here (Phases 19 to 124), see `archive/test-selector-log-phases-019-124.md`, read only for historical research.

## Rule

- An `id` or `data-testid` referenced by a spec stays stable across restyles. Visual changes (colour, spacing, copy) must not require a selector change.
- `data-testid` is preferred over a Tailwind-class or DOM-structure assertion for anything a later phase might restyle.
- A spec edit is only ever a **locator move for a surviving assertion**: see the spec-edit policy in `docs/contexts/ui-and-e2e.md`. Never delete or weaken an assertion to make a refactor pass.

### Convention

Interactive elements added to a view carry an `id` following `<view>-<thing>-<kind>`. `<view>` is one of the area prefixes: `auth`, `account`, `navbar`, `mobile-nav`, `nav-tab`, `pwa`, `view`, `dashboard`, `time-filter`, `tx`, `csv`, `confirm`, `quickadd`, `wallet`, `debt`, `debts`, `diary`, `category`. `<kind>` is `-btn` (or `-btn-<entity>`) for buttons, `-link` for links, and never `-button`. Non-button controls (fields, containers) are named by `<thing>`. Exceptions: `#time-filter-*` is frozen by `date-boundary.spec.ts`, and composed suffix families (`#*-desc`, `#*-category`, `#*-wallet`) take caller-supplied prefixes. The convention is guarded by `unit/dom-id-convention.test.ts`.

## Selectors by spec (grepped 2026-10-21)

How to read the list:

- `*` stands for an entity id, a tab name or a template part. `#tx-row-*` is `[id^="tx-row-"]` or `` `#tx-row-${id}` ``.
- `#*-desc`, `#*-category`, `#*-wallet` and the like are suffix matches (`[id$="-desc"]`) on `TransactionForm`'s fields, whose prefix depends on the caller.
- The entity ids specs fill in come from the seeds: `wal-cash`, `wal-main-checking`, `wal-savings`, `cat-food`, `cat-groceries`, `cat-housing`, `debt-starter-01`.
- `account-and-mobile-nav.spec.ts:40` and `:84` assert `#mobile-nav-tab-security` and `#nav-tab-security` are **absent**.

To regenerate, grep the specs for `#`-ids, `[id^=`, `[id$=`, `[id*=`, `data-testid` and `getByTestId`.

- `account-and-mobile-nav.spec.ts`: ids `#*-desc`, `#account-delete`, `#account-delete-btn`, `#account-export`, `#account-export-btn`, `#account-import-input`, `#account-modal`, `#account-modal-close-btn`, `#account-sessions`, `#account-signin-btn`, `#account-status-card`, `#auth-email-input`, `#auth-guest-data-notice`, `#auth-guest-export-btn`, `#quickadd-close-btn`, `#dashboard-wallet-card-*`, `#dashboard-wallets-add-btn`, `#mobile-nav-account-btn`, `#mobile-nav-more-btn`, `#mobile-nav-quick-add-btn`, `#mobile-nav-tab-*`, `#nav-tab-*`, `#navbar-account-btn`, `#navbar-quick-add-btn`, `#navbar-signin-btn`, `#wallet-new-init-balance`, `#wallet-new-name`, `#wallet-new-save-btn`, `#tx-drawer-close-btn`, `#tx-row-*`, `#view-loading-fallback`, `#wallet-adjust-btn-*`, `#wallet-adjust-input`, `#wallet-adjust-save-btn`, `#wallet-detail-balance`
- `auth.spec.ts`: ids `#auth-back-to-signin-link`, `#auth-close-btn`, `#auth-email-input`, `#auth-forgot-password-link`, `#auth-name-input`, `#auth-password-hint`, `#auth-password-input`, `#auth-tab-signin`, `#auth-tab-signup`, `#navbar-signin-btn`, `#time-filter-week`
- `categories-page.spec.ts`: ids `#category-form-heading`, `#category-group-expense`, `#category-group-system`, `#category-row-*`, `#category-edit-*`, `#category-edit-cancel-btn`, `#category-edit-name`, `#category-new-color-*`, `#category-new-name`, `#category-new-save-btn`
- `categories.spec.ts`: ids `#*-category`, `#category-group-income`, `#category-row-*`, `#category-subtab-rules`, `#confirm-destructive-btn`, `#category-delete-*`, `#category-edit-*`, `#category-edit-cancel-btn`, `#category-edit-description`, `#category-edit-name`, `#category-edit-save-btn`, `#category-rules-keyword-select`, `#navbar-quick-add-btn`, `#category-new-description`, `#category-new-name`, `#category-new-type-expense`, `#category-new-type-income`, `#category-new-save-btn`
- `csv-classify.spec.ts`: ids `#csv-commit-btn`, `#csv-classify-btn`, `#csv-classify-cancel-btn`, `#csv-file-input`, `#tx-import-csv-btn`, `#tx-import-export-btn`, `#tx-row-*`; test ids `csv-classify-announcer`, `csv-classify-note`, `csv-classify-progress`, `csv-classify-wait`, `csv-row-category-*`, `csv-row-confidence-*`
- `csv.spec.ts`: ids `#csv-commit-btn`, `#csv-file-input`, `#tx-export-csv-btn`, `#tx-import-csv-btn`, `#tx-import-export-btn`
- `dashboard.spec.ts`: ids `#dashboard-category-details-btn`, `#dashboard-log-mood-btn`, `#dashboard-repay-btn`, `#dashboard-view-all-transactions-btn`, `#dashboard-wallet-card-*`, `#dashboard-wallets-manage-btn`, `#nav-tab-debts`, `#nav-tab-diary`, `#nav-tab-transactions`, `#nav-tab-wallets`, `#time-filter-all`, `#time-filter-day`, `#time-filter-month`, `#time-filter-week`; test ids `metric-card-expense`, `metric-card-income`, `net-worth-card`
- `date-boundary.spec.ts`: ids `#time-filter-week`, `#wallet-detail-meta`, `#wallet-entity-*`; test ids `metric-card-expense`
- `debt-repayment.spec.ts`: ids `#*-desc`, `#debt-repay-confirm-btn`, `#debt-card-*`, `#navbar-quick-add-btn`, `#debt-new-min-payment`, `#debt-new-name`, `#debt-new-total`, `#debt-open-add-btn`, `#debt-open-repay-*`, `#debt-repay-amount-math`, `#debt-repay-payoff-full`, `#debt-repay-payoff-half`, `#debt-repay-payoff-minimum`, `#debt-new-save-btn`; test ids `repay-overpayment-note`, `repay-payoff-preview`, `repay-remaining-after`, `repay-settle-note`
- `debts-page.spec.ts`: ids `#confirm-destructive-btn`, `#debt-card-*`, `#debt-menu-btn-*`, `#debt-edit-*`, `#debt-edit-error`, `#debt-edit-name`, `#debt-edit-total`, `#debt-new-due-date`, `#debt-new-name`, `#debt-new-total`, `#debt-open-add-btn`, `#debt-edit-save-btn`, `#debt-new-save-btn`, `#debt-settle-*`
- `debts.spec.ts`: ids `#debt-repay-confirm-btn`, `#debt-card-*`, `#debt-new-interest`, `#debt-new-min-payment`, `#debt-new-name`, `#debt-new-total`, `#debt-open-add-btn`, `#debt-open-repay-*`, `#debt-repay-amount-math`, `#debt-repay-wallet-select`, `#debt-new-save-btn`, `#debt-settle-*`
- `diary-page.spec.ts`: ids `#confirm-destructive-btn`, `#diary-delete-*`, `#diary-cal-day-*`, `#diary-cal-prev-month-btn`, `#diary-card-*`, `#diary-day-spending`, `#diary-day-tx-link-*`, `#diary-menu-btn-*`, `#diary-next-day-btn`, `#diary-notes-textarea`, `#diary-prev-day-btn`, `#diary-save-status`, `#diary-mood-btn-*`, `#nav-tab-*`, `#diary-save-entry-btn`, `#tx-day-filter`, `#tx-row-*`
- `diary.spec.ts`: ids `#diary-notes-textarea`, `#diary-export-btn`, `#diary-mood-btn-*`, `#diary-save-entry-btn`; test ids `diary-entry-notes`
- `express-input.spec.ts`: ids `#*-category`, `#*-desc`, `#navbar-quick-add-btn`, `#tx-row-*`
- `helpers.ts` (the shared helpers): ids `#*-desc`, `#*-wallet`, `#nav-tab-*`, `#navbar-quick-add-btn`, `#view-loading-fallback`
- `insights.spec.ts`: ids `#dashboard-insights-collapse-btn`, `#dashboard-insights-generate-btn`; test ids `insights-body`, `insights-card`, `insights-offline-note`, `insights-signin-note`
- `ios-field-zoom.spec.ts`: ids `#category-subtab-rules`, `#csv-file-input`, `#navbar-quick-add-btn`, `#navbar-signin-btn`, `#category-rules-new-keyword-input`, `#debt-open-add-btn`, `#tx-edit-amount`, `#tx-import-csv-btn`, `#tx-import-export-btn`, `#tx-open-add-modal-btn`, `#tx-row-*`, `#wallet-add-modal-btn`, `#wallet-transfer-modal-btn`; test ids `csv-row-category-*`
- `jev-classify.spec.ts`: ids `#*-category`, `#*-desc`, `#*-suggestion-apply`, `#*-wallet`, `#navbar-quick-add-btn`; test ids `tx-category-suggestion`, `tx-save-rule`
- `keywords.spec.ts`: ids `#category-subtab-rules`, `#category-rules-keyword-select`, `#category-rules-new-keyword-input`, `#category-rule-row-*`, `#category-rules-save-btn`, `#category-rules-test-parser-input`; test ids `metric-cleaned-description`, `metric-extracted-amount`, `metric-inferred-type`, `metric-matched-category`
- `layout-stability.spec.ts`: ids `#mobile-nav-tab-*`, `#nav-tab-*`, `#view-loading-fallback`
- `presets.spec.ts`: ids `#*-desc`, `#*-preset-chip-*`, `#*-template-name`, `#quickadd-close-btn`, `#navbar-quick-add-btn`, `#quickadd-preset-apply-*`, `#quickadd-preset-chip-*`, `#tx-row-*`
- `reduced-motion.spec.ts`: ids `#*-desc`, `#quickadd-close-btn`, `#navbar-quick-add-btn`, `#time-filter-week`
- `routing.spec.ts`: ids `#*-shortcut-repay-debt`, `#*-shortcut-transfer`, `#quickadd-close-btn`, `#nav-tab-*`, `#navbar-quick-add-btn`, `#wallet-transfer-source`, `#view-loading-fallback`
- `safe-area.spec.ts`: ids `#mobile-nav-quick-add-btn`, `#view-loading-fallback`
- `smart-rules.spec.ts`: ids `#*-category`, `#*-desc`, `#*-save-rule-btn`, `#*-save-rule-dismiss`, `#category-subtab-rules`, `#quickadd-close-btn`, `#navbar-quick-add-btn`, `#debt-open-repay-*`, `#category-rule-row-*`; test ids `tx-save-rule`
- `soft-delete.spec.ts`: ids `#*-desc`, `#confirm-destructive-btn`, `#debt-repay-confirm-btn`, `#debt-card-*`, `#debt-menu-btn-*`, `#debt-delete-*`, `#wallet-delete-*`, `#debt-new-name`, `#debt-new-total`, `#wallet-new-name`, `#debt-open-add-btn`, `#debt-open-repay-*`, `#debt-repay-amount-math`, `#debt-repay-payoff-full`, `#debt-repay-wallet-select`, `#debt-new-save-btn`, `#wallet-new-save-btn`, `#tx-delete-btn-*`, `#tx-restore-btn-*`, `#tx-row-*`, `#tx-show-deleted`, `#wallet-add-modal-btn`, `#wallet-detail-menu-btn`, `#wallet-entity-*`; test ids `wallet-balance-*`
- `storage-persistence.spec.ts`: none (it reads storage and visible text only)
- `tab-preload.spec.ts`: ids `#dashboard-wallets-add-btn`, `#dashboard-wallets-transfer-btn`, `#nav-tab-*`, `#navbar-account-btn`, `#navbar-quick-add-btn`, `#view-loading-fallback`
- `theme.spec.ts`: ids `#navbar-quick-add-btn`, `#navbar-theme-toggle-btn`; test ids `net-worth-card`
- `toast-layering.spec.ts`: ids `#mobile-nav-more-btn`, `#mobile-nav-more-sheet`, `#mobile-nav-tab-*`, `#tx-open-add-modal-btn`
- `transaction-edit.spec.ts`: ids `#*-desc`, `#debt-repay-confirm-btn`, `#debt-card-*`, `#debt-open-repay-*`, `#debt-repay-amount-math`, `#debt-repay-wallet-select`, `#tx-edit-amount`, `#tx-edit-description`, `#tx-edit-type-income`, `#tx-edit-wallet`, `#tx-row-*`, `#tx-save-btn-*`, `#wallet-entity-*`; test ids `wallet-balance-*`
- `transaction.spec.ts`: ids `#*-desc`, `#*-wallet`, `#navbar-quick-add-btn`, `#tx-filter-type-income`, `#tx-search-input`
- `transfer-preview.spec.ts`: ids `#wallet-transfer-execute-btn`, `#dashboard-wallets-transfer-btn`, `#wallet-transfer-all-chip`, `#wallet-transfer-amount-math`, `#wallet-transfer-dest`, `#wallet-transfer-source`, `#wallet-transfer-swap-btn`; test ids `transfer-balance-after-dest`, `transfer-balance-after-source`, `transfer-overdraft-warning`, `transfer-panel-source`
- `voice-input.spec.ts`: ids `#*-category`, `#*-desc`, `#*-voice-btn`, `#navbar-quick-add-btn`; test ids `tx-save-rule`, `tx-voice-error`, `tx-voice-listening`
- `wallet-forms.spec.ts`: ids `#wallet-transfer-execute-btn`, `#dashboard-wallets-add-btn`, `#dashboard-wallets-transfer-btn`, `#wallet-new-init-balance`, `#wallet-new-name`, `#wallet-new-save-btn`, `#wallet-transfer-amount-math`, `#wallet-transfer-dest`, `#wallet-transfer-source`, `#wallet-transfer-modal-btn`
- `wallets-page.spec.ts`: ids `#*-wallet`, `#wallet-archive-*`, `#confirm-destructive-btn`, `#dashboard-wallet-card-*`, `#debt-card-*`, `#nav-tab-*`, `#navbar-quick-add-btn`, `#wallet-archived-toggle`, `#wallet-detail-menu-btn`, `#wallet-detail-title`, `#wallet-edit-btn`, `#wallet-edit-form`, `#wallet-edit-name`, `#wallet-edit-save-btn`, `#wallet-entity-*`, `#wallet-unarchive-btn-*`; test ids `wallet-balance-*`
- `wallets.spec.ts`: ids `#wallet-new-init-balance`, `#wallet-new-name`, `#wallet-new-save-btn`

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

- `#category-delete-*` exists only in that category's edit form: a spec asserting it is absent opens `#category-edit-{id}` first, or the check passes for the wrong reason.
- The New form remounts after each add, starting on the next free colour, so a handle to a swatch held across an add points at the old element.
- A swatch's id is its hex without `#`, lower-cased (`#category-new-color-e879a6`). While any of the twelve colours is free, a used one is a disabled button, so a click waits and fails.
- Below `lg` the edit form is in a sheet while the New form stays on the page, so `#category-new-*` and `#category-edit-*` can both be in the DOM.
