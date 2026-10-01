# Playwright selector contract

Ids and `data-testid`s that `tests/*.spec.ts` depend on are **API surface**: added freely, never removed, renamed only in the same commit that updates every spec referencing them. This document is the freeze-list a UI refactor (see `implementation-roadmap.md`) must preserve or deliberately migrate.

## Rule

- An `id` or `data-testid` referenced by a spec stays stable across restyles. Visual changes (color, spacing, copy) must not require a selector change.
- `data-testid` is preferred over a Tailwind-class or DOM-structure assertion for anything a later phase might restyle. Phase 19 (T31-T32) added `data-testid`s specifically to remove class/xpath/structure dependencies that existed before it.
- A spec edit is only ever a **locator move for a surviving assertion** — see `implementation-roadmap.md`'s spec-edit policy. Never delete or weaken an assertion to make a refactor pass.

## Hardened in Phase 19

| Selector | Replaces | File |
|---|---|---|
| `[data-testid="nav-tab-${id}"]` + `aria-current="page"` | `toHaveClass(/bg-stone-900/)` in `tests/helpers.ts:26` | `src/components/Navbar.tsx` |
| `[data-testid="mobile-nav-tab-${id}"]` + `aria-current` | (new; mobile nav had no active-state assertion before) | `src/components/MobileBottomNav.tsx` |
| `[data-testid="metric-card-expense"]` | xpath `ancestor::div[contains(@class,"rounded-2xl")]` in `tests/date-boundary.spec.ts:92` | `src/components/dashboard/CashflowMetricsCards.tsx` |
| `[data-testid="metric-card-income"]`, `[data-testid="metric-card-net"]` | (added for symmetry; not yet referenced by a spec) | same |
| `[data-testid="metric-extracted-amount"]`, `-matched-category`, `-inferred-type`, `-cleaned-description` | `div.flex.justify-between` filtered by label text in `tests/keywords.spec.ts:20,23,26,29,47,49` | `src/views/KeywordRulesView.tsx` |
| `[data-testid="diary-entry-notes"]` | bare `page.locator('p')` in `tests/diary.spec.ts:34` | `src/components/DiaryEntryCard.tsx` |
| `TransactionForm`'s `formTestId` prop → `[data-testid="tx-form-dashboard"\|"tx-form-quickadd"\|"tx-form-page"]` | `.first()` on `locator('form').filter({hasText:/Record Transaction/i})` in `tests/transaction.spec.ts:51,110` (not a live bug yet — see `ui-ux-audit-report.md` finding L — but Phase 22 makes multiple mounts routine) | `src/components/TransactionForm.tsx` + its 3 call sites |

## Existing ids the suite depends on (unchanged, still load-bearing)

Every id-prefix pattern: `tr[id^="tx-row-"]`, `button[id^="tx-delete-btn-"]`, `button[id^="tx-restore-btn-"]`, `div[id^="wallet-entity-"]`, `button[id^="delete-wallet-"]`, `div[id^="debt-card-"]`, `button[id^="open-repay-modal-"]`, `button[id^="settle-debt-"]`, `button[id^="delete-debt-"]`, `tr[id^="rule-row-"]`. Standalone ids across auth, csv, debts, diary, keywords, soft-delete, storage-persistence, theme, transaction, wallet-forms, wallets specs — see `ui-ux-audit-report.md` finding L and the individual spec files for the full list. None of these change in Phase 19.

## Added in Phase 41 (ADR `0013`, express transaction entry)

| Selector | Notes | File |
|---|---|---|
| `input[id$="-desc"]` | The omni note field, now the form's first input. Previously reachable as `input[placeholder*="groceries"], input[id$="-desc"]`; the placeholder alternative is **retired** — the copy is now `e.g. ข้าวมันไก่ 60, bts 45, or ค่าไฟ 1200` and must not be selected on. | `src/components/TransactionForm.tsx` |
| `select[id$="-category"]`, `select[id$="-wallet"]` | Both are now **always mounted**. The "Edit details" collapse that used to unmount them is gone, so no spec needs to click anything open before asserting on their value. | same |
| `${formId}-shortcut-transfer`, `${formId}-shortcut-repay-debt` | The shortcut-row links out to `TransferFundsModal` and the Debts tab. Each renders only when its handler prop is supplied. | same |
| `${inputId}-chip-100\|500\|1000` | Quick-amount chips, unchanged ids, but no longer `sm:hidden` — visible at every breakpoint. | `src/components/InlineMathInput.tsx` |

**Removed in the same phase** (ADR `0013`): `${formId}-type-transfer`, `${formId}-type-debt_repayment` and `${formId}-dest-wallet`. No spec referenced any of them — verified by grep across all 15 spec files before deletion. `${formId}-type-expense` / `-income` and the whole `repay` id set (`#repay-amount-math`, `#repay-wallet-select`, `#confirm-repay-btn`) are unchanged.

Removing `-dest-wallet` also resolved a latent hazard rather than creating one: `helpers.ts:53`'s `select[id$="-wallet"]` matched **both** the source and destination selects, and was unambiguous only because the form happened to default to `EXPENSE`. It is now unambiguous by construction.

> Note: `tx-form-dashboard` in the Phase 19 table no longer exists in `src/`. The Dashboard's inline form was retired in Phase 22 (T37); only `tx-form-quickadd` and `tx-form-page` remain.

## Added in Phase 42 (ADR `0014`, visual transfer layout)

| Selector | Notes | File |
|---|---|---|
| `#transfer-source-wallet`, `#transfer-dest-wallet` | **Still real, visible `<select>` elements**, now restyled borderless inside their wallet panels. `wallet-forms.spec.ts` asserts both are visible and reads them with `.inputValue()`, which is why the redesign kept them as form controls rather than replacing them with cards. Both now list *every* wallet; picking the other side's wallet swaps the two instead of filtering an option away. | `src/components/wallet/WalletTransferForm.tsx` |
| `#transfer-swap-btn` | Exchanges source and destination. | same |
| `#transfer-all-chip` | Seeds the amount with the full source balance. Rendered only when that balance is `> 0`. | same |
| `[data-testid="transfer-panel-source"]`, `-dest` | The two wallet panels. | same |
| `[data-testid="transfer-balance-after-source"]`, `-dest` | The projected balances. **Absent from the DOM entirely when there is no valid amount** — assert with `toHaveCount(0)`, not on empty text. | same |
| `[data-testid="transfer-overdraft-warning"]` | The amber note shown when the source would go negative. Its presence must never imply the submit button is disabled — the non-blocking behaviour is deliberate (ADR `0014`) and pinned by `transfer-preview.spec.ts`. | same |

Nothing was removed in this phase. `#transfer-amount-math`, `#transfer-note`, `#execute-transfer-btn`, `#hero-transfer-funds-btn` and `#wallet-transfer-modal-btn` are unchanged, and `tests/wallet-forms.spec.ts` passed **unedited** — it is the regression guard for the transfer flow and should stay that way.

## Added in Phase 43 (ADR `0015`, debt payoff preview)

All ids below are derived from `idPrefix || formId`, so they render as `repay-*` only on `DebtsView`'s repay modal — the one caller that passes `idPrefix="repay"`. A `TransactionForm` mounted without an `idPrefix` gets `useId()`-derived equivalents.

| Selector | Notes | File |
|---|---|---|
| `#repay-payoff-full`, `#repay-payoff-half` | Seed the amount field with the whole remainder / half of it. Rendered only while `remainingAmount > 0`. They push through `InlineMathInput`'s `seed` prop, so **the value lands in `#repay-amount-math` itself** — assert on that input's value, not on a separate display. | `src/components/TransactionForm.tsx` |
| `#repay-payoff-minimum` | Seeds the debt's stored `minimumPayment`. **Absent from the DOM unless `0 < minimumPayment < remainingAmount`** — assert with `toHaveCount(0)`, not on visibility. | same |
| `[data-testid="repay-payoff-preview"]` | The payoff block. **Present whenever a target debt resolves, with or without an amount** — deliberately unlike `transfer-panel-*`, because `presetDebtId` suppresses the Debt Target select and this is the only place the remaining balance appears in the modal. | same |
| `[data-testid="repay-remaining-after"]` | The projected remaining balance. **Absent from the DOM entirely when there is no valid amount** — assert with `toHaveCount(0)`, not on empty text. | same |
| `[data-testid="repay-overpayment-note"]` | The amber note shown when the payment exceeds the remainder. Its presence must never imply the submit button is disabled — the non-blocking behaviour is deliberate (ADR `0015`) and pinned by `debt-repayment.spec.ts`. | same |
| `[data-testid="repay-settle-note"]` | The emerald note for an *exact* payoff. Mutually exclusive with the overpayment note, which already says the debt settles — assert `toHaveCount(0)` on this one when testing overpayment. | same |

Nothing was removed in this phase. `#repay-amount-math`, `#repay-wallet-select`, `#confirm-repay-btn`, `#open-repay-modal-*` and the Add Debt form's ids are unchanged, and `tests/debts.spec.ts` passed **unedited** — it is the regression guard for the repayment lifecycle and should stay that way. The chips are additive: they seed the existing amount input rather than replacing it, which is what kept that spec's surface intact.

## Changed in Phase 44 (ADR `0016`, debt repayment integrity)

**Nothing was added or removed. One selector kept its name and inverted its meaning**, which is precisely the case this document exists to catch — a spec that located it by name and asserted on the old behaviour would have kept passing its locator and failing its intent, or worse, kept passing both while testing a contract that no longer exists.

| Selector | What changed | File |
|---|---|---|
| `[data-testid="repay-overpayment-note"]` | **Same id, same render condition, opposite meaning.** It was a *warning* that the excess would still leave the wallet, rendered while `#confirm-repay-btn` stayed **enabled** (ADR `0015`). It is now a *constraint* naming the maximum payable, rendered while that button is **disabled** (ADR `0016`). Any assertion on its presence must now also expect a blocked submit. | `src/components/TransactionForm.tsx` |
| `#confirm-repay-btn` | Unchanged id; its gating condition gained `!isOverpaying`. `tests/debts.spec.ts` is unaffected — it pays 1,000 then 4,000 against a 5,000 debt, both exact — and passed **unedited**. | same |

**The Phase 43 test that pinned the old meaning was inverted, not deleted.** `debt-repayment.spec.ts`'s *"overpaying warns but never blocks the submit button"* became *"overpaying blocks the submit button and names the maximum"*. The spec-edit policy forbids weakening an assertion; this one was not weakened, it was pointed at the opposite contract at equal strictness, under a decision ADR `0015` anticipated in writing. The test carries a comment saying so, so a later reader does not mistake it for erosion.

`#repay-payoff-full`, `#repay-payoff-half`, `#repay-payoff-minimum`, `repay-payoff-preview`, `repay-remaining-after` and `repay-settle-note` are all unchanged in both name and meaning.

## Added in Phase 45 (ADR `0017`, smart rule capture)

| Selector | Notes | File |
|---|---|---|
| `[data-testid="tx-save-rule"]` | The rule-offer chip, and also its saved-confirmation and rejection states — one testid across all three, because they occupy the same slot and a spec asserting "no offer" wants `toHaveCount(0)` to cover every one of them. **Bare, not form-prefixed**, matching `tx-category-suggestion`: two `TransactionForm`s can be mounted at once, so specs scope by the modal locator rather than by the id. | `src/components/transaction/SaveRuleChip.tsx` |
| `[id$="-save-rule-btn"]`, `[id$="-save-rule-dismiss"]` | Derived from the owning form's `useId()`, same pattern as `-suggestion-apply` / `-suggestion-dismiss`. | same |

**Nothing was renamed or removed.** `tx-category-suggestion`, `[id$="-suggestion-apply"]`, `[id$="-suggestion-dismiss"]`, `select[id$="-category"]` and `input[id$="-desc"]` all keep both their names and their meanings; the chip is a sibling element added beneath the category select, not a change to anything a spec already targeted.

**One meaning did shift, invisibly to any selector.** `select[id$="-category"]`'s `onChange` and `applySuggestion` now both latch `userTouchedRef.current.category`, so a spec that applies a mid-confidence suggestion and then expects a later high-confidence answer to overwrite the category would fail. None did — `jev-classify.spec.ts` gained a test asserting the opposite, which is the new contract.

## Added in Phase 46 (ADR `0018`, voice input)

| Selector | Notes | File |
|---|---|---|
| `[id$="-voice-btn"]` | The mic button. **Renders only where the Speech API is usable**, which includes `window.isSecureContext` — so a spec that does not install the stub sees it in chromium and not in firefox or webkit. Any assertion on it must install or remove the API first. | `src/components/TransactionForm.tsx` |
| `[data-testid="tx-voice-listening"]` | The listening state, inside an `aria-live="polite"` region. | same |
| `[data-testid="tx-voice-error"]` | The error message, including the disabling permission cases. | same |

**A new kind of test seam.** `voice-input.spec.ts` installs a fake `SpeechRecognition` via `page.addInitScript` and drives it through a `window.__speech` handle. This is **not** a `page.route` interception, so the rule that `jev-classify.spec.ts` is the only spec intercepting requests is intact. Real recognition is untestable — microphone, vendor network round-trip, audio a test cannot produce — so stubbing is the only option rather than a convenience.

**Nothing was renamed or removed.** `input[id$="-desc"]` keeps its name and meaning; the mic is a sibling added inside the field's existing `relative` wrapper. The input's right padding is now conditional on the button rendering, which is visual only and nothing asserts on it.

## Added in Phase 47 (ADR `0019`, batch CSV classification)

| Selector | Notes | File |
|---|---|---|
| `#csv-classify-btn` | Runs Layer 2. Renders only while uncategorized rows remain and no run is in flight, so "no button" means "nothing left to classify", not "broken". | `src/views/TransactionsView.tsx` |
| `#csv-classify-cancel-btn` | Replaces it during a run. | same |
| `[data-testid="csv-classify-progress"]` | Present only while running; it clears itself on completion, which is what lets a spec assert both states. | same |
| `[data-testid="csv-classify-note"]` | The completion summary, and the "Jev is unavailable" message. Its appearance is the signal that a run finished. | same |
| `[data-testid="csv-row-category-<rowIndex>"]` | The per-row category `<select>` — the manual override channel. Keyed by `rowIndex`, which starts at **2** (row 1 is the CSV header). | same |
| `[data-testid="csv-row-confidence-<rowIndex>"]` | Dual-purpose by design: a **span** showing the percentage when the answer was applied, a **button** offering it when it was not. A spec asserting "not applied" should click it. | same |

**A second spec may now mock the classifier.** `CLAUDE.md`'s rule that `jev-classify.spec.ts` is the only spec intercepting requests is amended to name `csv-classify.spec.ts` too. The rule's purpose — no TypeSafe credits, no API key — is upheld by a second locally-fulfilling spec. Phase 46's `addInitScript` Speech stub is a different mechanism and intercepts nothing.

**The preview table gained a column**, so its `tfoot` `colSpan` moved 6 → 7. Nothing asserts on it, but a future column must move it again.

**`csv.spec.ts` passed unedited** and remains both the round-trip guard and the pin on the deliberate absence of import deduplication.

## Added in Phase 48 (ADR `0020`, monthly spending insights)

| Selector | Notes | File |
|---|---|---|
| `[data-testid="insights-card"]` | The card shell. Always present on the Dashboard, including when there is nothing to summarize. | `src/components/dashboard/SpendingInsightsCard.tsx` |
| `#insights-generate-btn` | Renders **only** while no verdict is held. It is absent after a cached verdict seeds the card, which is how a spec asserts the cache worked. | same |
| `#insights-refresh-btn` | Renders only once a verdict exists and the card is expanded. Always hits the network. | same |
| `#insights-collapse-btn` | Carries `aria-expanded`, which is what a spec should assert on rather than the chevron glyph. | same |
| `[data-testid="insights-body"]` | The rendered sentences. Its appearance is the signal that generation finished. | same |
| `[data-testid="insights-skeleton"]` | Present only while generating. | same |
| `[data-testid="insights-offline-note"]` | Marks a locally-chosen verdict. **A provenance note, not an error** — the card has no error state, so a spec asserting "no error" should check the card's text rather than look for this. | same |

**A third spec may mock the classifier family.** `CLAUDE.md`'s rule is now stated as a principle — every intercepting spec fulfils locally — rather than as a list, with `jev-classify`, `csv-classify` and `insights` named as the three that currently rely on it.

**The Dashboard now makes network requests.** It was previously pure presentation over context state. Specs that assert on the Dashboard and do not mock `/api/insights` will see a 404 and the local fallback, which is harmless and is what `transaction.spec.ts` and `date-boundary.spec.ts` already do — both passed unedited.

## Added in Phase 50 (ADR `0022`, signed-in import integrity)

| Selector | Notes | File |
|---|---|---|
| `#import-commit-error` (`role="alert"`) | Present only after `commitBulkImport` returns `success: false`. The preview stays open and populated beneath it, so a retry is one click. No spec references it yet: the failure is only reachable on the signed-in path, which `unit/authenticated-ledger.test.tsx` covers at the context layer. | `src/views/TransactionsView.tsx` |

**`#commit-import-btn` is unchanged as a selector.** It is now also `disabled` while a commit is in flight and its label reads "Importing…" for that window. `csv.spec.ts` and `csv-classify.spec.ts` assert on it only before the click (`toBeEnabled`) and on the success message after it, so both run unedited.

## Known remaining fragile selectors (not yet hardened; addressed in later phases per the roadmap)

- `transaction.spec.ts:58` — `^Income$` button text (Phase 27, SegmentedControl must preserve option labels exactly).
- `transaction.spec.ts:103` — `button[title="Clear search"]` (a tooltip string, reword risk; since Phase 56 it is `IconButton`'s `label`, which sets the title).
- `transaction.spec.ts:124` — `span` filtered by `Calculated:` text.

(Line numbers corrected in Phase 56; they had drifted from :55, :100 and :119.)
- Heading text assertions (`/Wallets & Accounts/i`, `/Debts & Loans/i`, `/Holistic Mini Diary/i`, `/FinLife Tracker/i`) — Phase 25's `SectionHeader` must render identical `h2` text.
- `date-boundary.spec.ts:31,34` — hardcoded seeded id `wallet-entity-wal-main-checking` and literal string `Created: 2026-09-18` (stable unless the seed data or date-formatting changes).

## Added and retired in Phase 52 (ADR `0024`)

**Retired:** `#nav-tab-security` / `[data-testid="nav-tab-security"]` and `#mobile-nav-tab-security` - Security left both tab bars and became the Account & Security modal. No spec ever referenced either. `#revoke-all-others-btn`, `#revoke-session-${id}` - the fabricated session list they acted on is gone. Every other `nav-tab-*` and `mobile-nav-tab-*` id is unchanged.

| Selector | Notes | File |
|---|---|---|
| `#navbar-account-btn` | Opens Account & Security. Signed in: the name pill. Guest: an icon button beside Sign In (`sm` and up). | `src/components/navbar/NavbarLedgerStatus.tsx` |
| `#navbar-signout-btn` | **Moved**, id kept: now inside the account modal, and opens a confirmation instead of signing out at once. | `src/components/account/AccountModal.tsx` |
| `#account-modal`, `#account-modal-title`, `#account-modal-close-btn`, `#account-status-card`, `#account-signin-btn`, `#account-sync-btn` | The modal's panel and its fixed parts. `#account-signin-btn` is guest-only. | same |
| `#account-sessions`, `#session-item-${id}`, `#account-sessions-unavailable`, `#account-signout-others-btn`, `#account-signout-everywhere-btn` | Signed-in only. Session ids are `auth.sessions` uuids. | same |
| `#auth-guest-data-notice`, `#auth-guest-export-btn` | In `AuthModal` (sign-in and create-account modes) when the guest ledger has transactions. | `src/components/account/GuestDataNotice.tsx` |

## Added and changed in Phase 53b (ADR `0026`)

| Selector | Notes | File |
|---|---|---|
| `#navbar-sync-status` (`role="status"`) | **New.** Wraps every signed-in sync state (Offline, Syncing, Sync failed, Synced). No spec references it: no spec signs in. In the Sync failed state it holds a retry button named "Sync failed. Try again". | `src/components/navbar/NavbarLedgerStatus.tsx` |
| `#navbar-sync-badge-btn` | **Unchanged id**, guest only. Its text is now "Local" at every width (it was "Local Only (Click to Sync)" from `sm` up), and its `title` is "Sign in to sync across devices". Its hit box is 44 px. | same |
| `#view-loading-fallback` | **Unchanged id.** Now `role="status"` with `aria-busy`, and a static per-view outline instead of a spinner. `gotoTab` still waits for it to detach. | `src/components/ViewLoadingFallback.tsx` |
| `#diary-workout-checkbox` | **Unchanged id**, still a native checkbox. It is now a transparent 44×44 input over a drawn 16 px box. Playwright counts `opacity: 0` as visible, so `.check()` and `toBeChecked()` are unaffected. | `src/views/DiaryView.tsx` |
| `#close-wallet-modal-btn` | **Unchanged id.** Gained the accessible name "Close wallet details". It deliberately does not reuse "Close modal", which `categories.spec.ts:108` queries by role. | `src/components/WalletPopupModal.tsx` |
| `button[id^="tx-delete-btn-"]`, `button[id^="tx-restore-btn-"]` | **Unchanged ids.** Titles now read "Delete and reverse the wallet change" / "Restore transaction", and each is also the `aria-label`. No spec reads either title. | `src/components/TransactionTableRow.tsx` |

**Heading text moved:** the diary's `h2` is "Daily Diary" (was "Holistic Mini Diary"). `diary.spec.ts:15` and `theme.spec.ts:55` changed their regex in the same commit, the only spec edits in Phase 53. The export filename `holistic_diary_export_*` is unchanged. The fragile-selector list above still names the old regex, as a record of what it was.

**Money text is byte-identical.** `Money` renders `formatCurrencyAmount` output, so every `฿1,000.00` assertion is unaffected. A negative now reads `−฿1,000.00` (it read `฿-1,000.00` through `AnimatedCounter`); no spec asserts on a negative balance.

## Added and changed in Phase 55a (ADR `0027`)

| Selector | Notes | File |
|---|---|---|
| `data-testid="wallet-balance-<id>"` | **New.** The balance on each Wallets-view card. `soft-delete.spec.ts:108` moved to it from `div.text-2xl.font-bold.font-mono`, the last class-based locator in the suite, which dropping `font-mono` would have broken. The assertions are unchanged. | `src/views/WalletsView.tsx` |
| `#nav-tab-*` | **Unchanged ids**, still with `aria-current="page"`. They now sit in the header's single row, visible from `md` (768 px) instead of `sm`. From `lg` they are text; between `md` and `lg` they are icons, with the label kept as `sr-only` text and as the `title`, so a role query by name still finds them. | `src/components/Navbar.tsx` |
| `nav[aria-label="Mobile Navigation"]`, `#mobile-nav-tab-*` | **Unchanged.** The bottom nav now shows under `md` instead of under `sm`. Every mobile spec runs at 390 px. | `src/components/MobileBottomNav.tsx` |
| `#navbar-theme-toggle-btn`, `#navbar-quick-add-btn`, `#navbar-signin-btn`, `#navbar-account-btn`, `#navbar-sync-badge-btn`, `#navbar-sync-status` | **Unchanged ids.** The header's total balance is gone. "Add Entry" reads "Add entry". | `src/components/Navbar.tsx`, `src/components/navbar/NavbarLedgerStatus.tsx` |

**The heading "FinLife Tracker" is still an `h1`**, now visible from `xl` (1280 px) rather than `sm`. `theme.spec.ts:11` runs at Playwright's Desktop viewport, 1280 px wide.

**Money text:** positive amounts are byte-identical. A negative is now `−฿1,000.00` from `formatCurrencyAmount` itself, and no spec asserts on one. A transfer's amount lost its `−` outside a wallet's own view (`฿500.00`, was `−฿500.00`). No spec asserts on a transfer row's amount text.

## Changed in Phase 56 (ADR `0029`, shared components)

Nothing was added or removed. Every id below now renders through a shared component, **on the same element type**, and no spec was edited.

| Selector | Notes | File |
|---|---|---|
| Every `button[id^=…]` and `#…-btn` moved to `Button` / `IconButton` | **Still `<button>` elements with the same ids.** `Button` is `type="button"` unless it submits; every form submit still passes `type="submit"`, which about twelve steps locate by, and `disabled` is still the native attribute behind `toBeEnabled` / `toBeDisabled`. | `src/components/ui/Button.tsx`, `IconButton.tsx` and their callers |
| `button[title="Clear search"]` | **Unchanged title**, now from `IconButton`'s `label`, which sets both `aria-label` and `title`. The button grew from `p-1` to 44 × 44. | `src/views/TransactionsView.tsx` |
| Button named "Close modal" | **Unchanged name** (`categories.spec.ts:108`), now an `IconButton` label. | `src/components/Modal.tsx` |
| `#auth-close-btn` | **Unchanged id.** Gained a name, "Close"; it had none. Playwright matches role names by substring, so it cannot satisfy a query for "Close modal". | `src/components/AuthModal.tsx` |
| `#time-filter-*`, `#category-subtab-*`, `#auth-tab-*`, `${formId}-type-expense` / `-income` | **Unchanged ids and labels.** The options now carry `aria-pressed`; the Categories switcher carries `role="tab"` + `aria-selected`. No spec reads either. | `src/components/ui/SegmentedControl.tsx` |
| `#navbar-theme-toggle-btn` | **Unchanged id.** Its label is now "Theme: <mode>. Click to switch." (it had a separate title and aria-label). No spec reads it. | `src/components/Navbar.tsx` |

**Text a spec reads is unchanged**: category names still render as text inside each row (`csv-classify.spec.ts`), the repayment chip keeps its words, `[Soft Deleted]` is untouched, and the percentages keep `toFixed(1)` at their call sites.

### Hazards for the page phase

These components are built but not yet on screen. Adopting them must keep the contract:
- **`TransactionRow`** renders a `<button>` or a `<div>`. `tr[id^="tx-row-"]` is typed, so a row that stops being a `<tr>` needs a locator move in every spec that uses it. The date must stay as text inside each row: `presets.spec.ts:214-215` filters rows by date, and a date shown only in a `DayGroupHeader` would make the count-2 assertion fail and the count-0 one pass vacuously. The row's `meta` slot is for that date.
- **`OverflowMenu`'s items exist only while it is open.** Moving `tx-delete-btn-*`, `delete-wallet-*`, `delete-debt-*` or `delete-category-*` into one adds a menu-open step to each spec that clicks them (a locator move, which the policy allows). `debts.spec.ts:63` (`settle-debt-*` count 0) and `categories.spec.ts:28` (`delete-category-cat-food` count 0) must open the menu before asserting, or they pass because the menu is closed, which is a weakened assertion and forbidden.
- **`PageHeader` is an `h1`.** `theme.spec.ts` and `diary.spec.ts` find headings by name; the text must survive, and a second heading with the same name on one view would break the unique match.

## Changed in Phase 57 (ADR `0030`, the Dashboard)

The Dashboard is the landing view, so it mounts in every run of every spec.

| Selector | Now | File |
|---|---|---|
| `[data-testid="metric-card-expense"]` | **Moved** from the retired `CashflowMetricsCards` onto the Cash flow card's Spending cell. It holds only the period's spending, now signed (`−฿1,000.00`), which still contains the `฿1,000.00` `date-boundary.spec.ts:94` looks for and not the `฿3,000.00` it rules out. `metric-card-income` and `metric-card-net` moved with it; no spec reads them. | `src/components/dashboard/CashFlowCard.tsx` |
| `[data-testid="net-worth-card"]` | **New.** `theme.spec.ts:58` moved to it from the text "Total Money Across All Wallets", which the spec's Net worth card replaces. The assertion (the Dashboard renders after a theme switch) is unchanged. The phase's only spec edit. | `src/components/dashboard/NetWorthCard.tsx` |
| `#hero-transfer-funds-btn`, `#hero-add-wallet-btn`, `#hero-manage-all-wallets-btn` | **Unchanged ids, still `<button>`s**, now the Wallets section's text links. Transfer still calls `onOpenTransfer()` with no wallet, so the form seeds Main Checking to Cash (`transfer-preview.spec.ts:39-40`). | `src/components/dashboard/WalletsSection.tsx` |
| `#dashboard-wallet-card-{id}` | **Unchanged id**, now a `<button>` that opens the wallet popup (`account-and-mobile-nav.spec.ts:131` clicks its centre; since Phase 59 it opens the Wallets page instead). The inner `wallet-quick-transfer-*` button is gone, so nothing inside competes for the click. | same |
| `#time-filter-*` | **Unchanged ids.** Labels are now "Today / This week / Past 30 days / All time"; no spec reads them. | `src/views/DashboardView.tsx` |
| `#dashboard-view-all-transactions-btn` | **Unchanged id**, now in Recent activity. | `src/components/dashboard/RecentActivityCard.tsx` |
| `insights-*` | **Unchanged ids, testids and render conditions.** The card's title now names its months; no spec reads it. | `src/components/dashboard/SpendingInsightsCard.tsx` |
| `#dashboard-repay-btn`, `#dashboard-all-debts-btn`, `#dashboard-log-mood-btn`, `#dashboard-debt-{id}`, `#dashboard-adjustment-pair-{wallet}-{date}`, `[data-testid="dashboard-debt-warning"]` | **New**, not yet used by a spec. | the new Dashboard cards |
| `wallet-quick-transfer-*` | **Retired** with the per-card Transfer buttons (spec 6.1). No spec used it. | - |

**Text a spec reads on the Dashboard** is unchanged: each transaction's description appears once (`transaction.spec.ts:43,76`, `storage-persistence.spec.ts:44`), and a new wallet's name is the first, visible match (`wallet-forms.spec.ts:73`, `account-and-mobile-nav.spec.ts:144`).

### Hazards the Dashboard now carries
- **Its recent activity is `TransactionRow`s, which are `<div>`s.** They cannot match `tr[id^="tx-row-"]`, which is why they carry no id. The Transactions page's own rows keep that prefix until its phase.
- **Its ids use the `dashboard-` prefix only.** Specs filter the Debt Payoff page's `debt-card-`, `open-repay-modal-` and `settle-debt-`, and the Transactions page's `tx-row-`, page-wide straight after `gotoTab`, while the Dashboard may still be leaving.
- **The Mood card's caption says "From your Daily Diary"** as a `<p>`, not a heading, so `diary.spec.ts`'s `/Daily Diary/i` heading query still matches one element.

## Changed in Phase 58a (ADR `0031`, the Transactions page)

Seven specs use this page. Every edit below is a locator or step move that keeps its assertion.

| Selector | Now | Specs moved |
|---|---|---|
| `tr[id^="tx-row-"]` → **`button[id^="tx-row-"]`** | Rows are `TransactionRow` buttons with the same `tx-row-{id}` id. | 17 locators: `soft-delete` (9), `presets` (3), `csv-classify` (3), `express-input` (1), `account-and-mobile-nav` (1) |
| `button[id^="tx-delete-btn-"]`, `button[id^="tx-restore-btn-"]` | **Same ids, now in the selected row's panel** (`#tx-drawer`), not on the row. Delete is still immediate, with no confirmation. | `soft-delete` clicks the row first, then finds the button page-wide (seven places) |
| `#tx-import-csv-btn`, `#tx-export-csv-btn` | **Same ids, now `OverflowMenu` items** under `#tx-import-export-btn`. They exist only while the menu is open. | `csv` (2) and `csv-classify` (1) open the menu first |
| `#tx-show-deleted`, `#tx-search-input`, `button[title="Clear search"]` | **Unchanged.** The checkbox is still a native, checkable input under its drawn box. | none |
| `#csv-file-input` and every `csv-*` id | **Unchanged.** The import moved to `ImportCsvModal` verbatim. | none |
| `#tx-filter-wallet` | Unchanged id, still a `<select>`. | none |
| `#tx-filter-type` (a `<select>`) | **Retired**, replaced by `SegmentedControl` options `#tx-filter-type-all/income/expense/transfer`. No spec used it. | none |
| `#tx-prev-page-btn`, `#tx-next-page-btn` | **Retired**, replaced by `#tx-load-more-btn` "Load N more" (L12). No spec used them. | none |
| `#diary-export-json-btn` | **Retired** from this page; the diary keeps `#export-diary-btn`. No spec used it. | none |
| New | `#tx-filter-range`, `#tx-filter-category`, `#tx-drawer`, `#tx-drawer-title`, `#tx-drawer-close-btn`, `#tx-import-export-btn`, `#tx-load-more-btn` | - |

**Text kept exactly:** "No transactions match your current filters.", "Successfully imported N transactions", the classify summary, `[Soft Deleted]` inside the row, and a row's ISO date. The date is now `sr-only` text inside the row, because the visible date is the day header's. `presets.spec.ts:214-215` filters by it.

### Hazards this page now carries
- **The panel is rendered once.** At `xl` it is inline (`#tx-drawer`); below that it is a `Modal`. The choice comes from `useMediaQuery`, never from CSS, so `toHaveCount` and strict `getByText` never see two copies. The panel shows the row's note, so a text count taken while it is open includes it. No spec counts text with the panel open.
- **The rows are buttons, so nothing clickable can sit inside one.** A new per-row action goes in the panel or in an `OverflowMenu` beside the list, never inside the row.
- **A transfer row's note is in its second line** (`wallet-forms.spec.ts:38` reads "Funds transfer" there). The title is always "Transfer".

## Changed in Phase 58b (ADR `0033`, editing a transaction)

No existing spec was edited. `tests/transaction-edit.spec.ts` is new (3 tests).

| Selector | Now | Specs |
|---|---|---|
| `button[id^="tx-delete-btn-"]` | **Same id**, now beside "Save changes" in `EditTransactionPanel` for a live row. | `soft-delete` unchanged |
| `button[id^="tx-restore-btn-"]` | **Same id**, in the read-only panel a deleted row keeps. | `soft-delete` unchanged |
| New | `button[id^="tx-save-btn-"]`, `#tx-edit-type-income/expense/transfer`, `#tx-edit-amount`, `#tx-edit-description`, `#tx-edit-category`, `#tx-edit-wallet`, `#tx-edit-from`, `#tx-edit-to`, `#tx-edit-date` | `transaction-edit` |
| New, on the Dashboard | `button[id^="dashboard-tx-"]`: each Recent activity row, now a button that opens the row on the Transactions page. | none |

### Hazards
- **The panel now holds `<select>`s whose options name every wallet and category.** Strict `getByText('Cash Wallet')` or a category name, taken while a row is open, would meet an `<option>`. The note is an input's value, which `getByText` does not match.
- **The Dashboard's Recent activity rows are buttons with ids** since this phase, replacing the "no id" note above. Their prefix is `dashboard-tx-`, so a page-wide `tx-row-` match straight after `gotoTab` still finds only the Transactions page's rows.
- **The panel is inline from `lg` (1024px)**, not `xl`. Every spec runs at 1280px, so they still see the inline panel.

## Changed in Phase 59 (ADR `0034`, the Wallets page)

Four specs were edited, each in the code's own commit, by a locator or copy move that keeps its assertion. `tests/wallets-page.spec.ts` is new (3 tests). `wallets.spec.ts`, `wallet-forms.spec.ts` and `transaction-edit.spec.ts` passed unedited.

| Selector | Now | Specs moved |
|---|---|---|
| `div[id^="wallet-entity-"]` → **`[id^="wallet-entity-"]`** | **Same id**, now on each wallet's row `<button>` in the list (`aria-pressed` when selected). It still holds `data-testid="wallet-balance-{id}"`, so `#wallet-entity-wal-cash` → `wallet-balance-wal-cash` reads as before. | `soft-delete` (3) |
| `button[id^="delete-wallet-"]` | **Same id**, now an `OverflowMenu` item under `#wallet-detail-menu-btn` in the selected wallet's detail. It exists only while the menu is open. | `soft-delete` selects the row and opens the menu first |
| `#modal-wallet-balance-{id}` → **`#wallet-detail-balance`** | The selected wallet's balance, money text only (`toHaveText` stays exact). | `account-and-mobile-nav` (1) |
| `#wallet-adjust-btn-{id}`, `#wallet-adjust-input`, `#wallet-adjust-save-btn` | **Same ids**, moved from the popup to the detail's balance box. | none |
| `#dashboard-wallet-card-{id}` | **Same id.** It now opens the Wallets page with that wallet selected instead of the popup. | none |
| Heading `/Wallets & Accounts/i` → **`'Wallets'` (exact)** | The page title (spec 6.3). | `theme` (1) |
| Text `Created: 2026-09-18` in `#wallet-entity-wal-main-checking` → **`created Sep 18, 2026` in `#wallet-detail-meta`** | The created date moved to the selected wallet's header. The negative half moved with it (`created Sep 17, 2026`). | `date-boundary` (2, after a click on the row) |
| `#wallet-transfer-modal-btn`, `#wallet-add-modal-btn` | **Unchanged ids**, in the `PageHeader`. The Add button reads "Add wallet"; `wallets.spec.ts`'s `/Add Wallet/i` is case-insensitive and takes `.first()`, which is this button. | none |
| **Retired with `WalletPopupModal`** | `#wallet-popup-modal`, `#wallet-popup-modal-title`, `#close-wallet-modal-btn`, `#tab-btn-overview`, `#tab-btn-txs`, `#modal-wallet-card-*`, `#modal-wallet-balance-*`, `#wallet-modal-view-all-tx-btn`. Only `#modal-wallet-balance-*` had a spec, moved above. | - |
| New | `#wallet-list-add-btn`, `#wallet-archived-toggle`, `#wallet-archived-list`, `#wallet-archived-{id}`, `#wallet-unarchive-btn-{id}`, `#wallet-detail-title`, `#wallet-detail-meta`, `#wallet-detail-menu-btn`, `#archive-wallet-{id}`, `#wallet-edit-btn`, `#wallet-edit-form`, `#wallet-edit-name`, `#wallet-edit-type`, `#wallet-edit-save-btn`, `#wallet-edit-error`, `#wallet-transfer-out-btn`, `#wallet-view-all-tx-btn`, `#wallet-detail-close-btn`, `button[id^="wallet-tx-"]`, `#wallet-adjustment-pair-{wallet}-{date}` | `wallets-page` |

### Hazards
- **The detail is rendered once.** From `lg` it is inline; below that it is a `Modal` that opens only when a wallet is tapped. A full-page screenshot resizes the viewport to 1px wide, which flips `useMediaQuery` and can leave the sheet's exit animation stuck, so a check that takes one sees two copies. The walk-through uses viewport screenshots.
- **From `lg` a wallet is always selected** (the first one by default), so its name appears twice: in its row and as `#wallet-detail-title`. A strict `getByText` on the **selected** wallet's name meets both. A new wallet is not auto-selected, which keeps `wallets.spec.ts:33` strict.
- **The activity rows' prefix is `wallet-tx-`**, never `tx-row-`, so a page-wide `tx-row-` match after `gotoTab(page, 'transactions')` still finds only the Transactions page's rows.
- **`#archive-wallet-*` and `#delete-wallet-*` exist only while the menu is open.** A spec asserting one is absent must open the menu first.

## Changed in Phase 60 (ADR `0035`, the Debt payoff page)

Two specs were edited, in the page's own commit, by a locator or copy move that keeps its assertion. `tests/debts-page.spec.ts` is new (3 tests). `debts.spec.ts`, `debt-repayment.spec.ts`, `transaction-edit.spec.ts` and `smart-rules.spec.ts` passed unedited.

| Selector | Now | Specs moved |
|---|---|---|
| `div[id^="debt-card-"]` | **Same id**, on `DebtCard`'s root, in the "Active debts" section or under "Paid off (N)". A paid-off card still contains "100% Fully Settled!" and "✓ Debt Fully Settled". | none |
| `button[id^="delete-debt-"]` | **Same id**, now an `OverflowMenu` item under the card's `#debt-menu-btn-{id}`. It exists only while the menu is open. | `soft-delete` opens the menu first |
| `button[id^="settle-debt-"]` | **Same id**, now a visible "Mark as paid off" button that opens a confirmation; `#confirm-destructive-btn` writes the debt off. It is absent from a paid-off card, so `debts.spec.ts:63`'s count 0 still holds for the right reason. | none |
| `button[id^="open-repay-modal-"]`, `#repay-*` | **Unchanged.** The repay modal is untouched. | none |
| `#open-add-debt-btn`, `#new-debt-*`, `#save-new-debt-btn` | **Unchanged ids.** The buttons read "Add debt". | none |
| Heading `/Debts & Loans/i` → **`'Debt payoff'` (exact)** | The page title (spec 6.4). | `theme` (1) |
| Text `4.5% APR`, `20.0%`, `55.0%`, `฿4,500.00` in a debt card | **Kept**: the interest badge, "N% paid" and "Still owed". | none |
| New | `#debt-menu-btn-{id}`, `#edit-debt-{id}`, `#edit-debt-form`, `#edit-debt-name`, `#edit-debt-total`, `#edit-debt-interest`, `#edit-debt-min-payment`, `#edit-debt-due-date`, `#save-edit-debt-btn`, `#edit-debt-error`, `#debts-caption`, `#debts-paid-off-heading`, the `data-testid`s `debt-summary-owed`, `debt-summary-paid`, `debt-summary-plan` | `debts-page` |

### Hazards
- **`#edit-debt-*` and `#delete-debt-*` exist only while the card's menu is open.** A spec asserting one is absent must open the menu first.
- **A card's text includes "Still owed" and the summary's does too**, but the summary is outside every `div[id^="debt-card-"]`, so a card-scoped `toContainText` never meets it. A page-wide `getByText` on a ฿ amount can meet both.
- **The Dashboard's Debt payoff card also has an `h2` "Debt payoff".** The page's title is the `h1`; a heading match right after `gotoTab(page, 'debts')` is safe because the Dashboard is not mounted, but a match from the Dashboard itself would find its `h2`.

## Changed in Phase 61 (ADR `0036`, the Daily diary)

No spec was edited. `diary.spec.ts` and `theme.spec.ts` passed unedited, and `tests/diary-page.spec.ts` is new (3 tests).

| Selector | Now | Specs moved |
|---|---|---|
| `#mood-btn-1..5` | **Same ids**, each now a number over its word, with `aria-pressed`. No emoji. | none |
| `#diary-notes-textarea`, `#save-diary-entry-btn`, `#export-diary-btn` | **Same ids.** The buttons read "Save entry" (disabled until a mood is picked) and "Export JSON". | none |
| Text `/Diary entry logged/i` | **Kept**: "Diary entry logged for Thursday, Oct 1." in `#diary-save-status`. | none |
| `[data-testid="diary-entry-notes"]` | **Same testid**, the note inside a recent entry's inset (no quotes). | none |
| Heading `/Daily Diary/i` | The page's `h1` now reads "Daily diary"; the match is case-insensitive. | none |
| `div#diary-card-{id}` → **`li#diary-card-{id}`** | **Same id**, now a list item in Recent entries. | none |
| `#diary-date-picker` | **Same id**, now visually hidden behind "Pick date" (`#diary-pick-date-btn`), with `max` = today. | none |
| **Retired** | `#diary-workout-checkbox` (now `#activity-btn-rest` / `#activity-btn-workout`), the expander and its "item(s)" button, `DiaryEntryCard`. No spec used them. | - |
| New | `#diary-form-heading`, `#diary-day-spending`, `#diary-prev-day-btn`, `#diary-next-day-btn`, `#diary-pick-date-btn`, `#activity-btn-rest`, `#activity-btn-workout`, `#diary-workout-note`, `#food-btn-healthy|average|junk` (ids kept from before), `#diary-save-status`, `#diary-calendar-heading`, `#diary-cal-prev-month-btn`, `#diary-cal-next-month-btn`, `#diary-cal-day-{iso}`, `#diary-calendar-count`, `#diary-recent-heading`, `#diary-menu-btn-{id}`, `#edit-diary-{id}`, `#delete-diary-{id}`, `#diary-day-tx-link-{date}`, `#diary-show-more-btn`, and on the Transactions page `#tx-day-filter` | `diary-page` |

### Hazards
- **The form remounts for each day and entry** (it is keyed by both). A spec or test that holds a locator handle to a form control across a day change gets the old element: look it up again.
- **`#edit-diary-*` and `#delete-diary-*` exist only while the entry's menu is open.**
- **Dates are local calendar days.** A spec that needs "yesterday" reads it in the page (`page.evaluate`) rather than in Node, so it is the browser's own day.
- **A future calendar day is a disabled button**, so a click on it waits and fails rather than doing nothing.

## Changed in Phase 62 (ADR `0037`, the Categories page)

Two specs were edited, in the page's own commit, by a locator or copy move that keeps its assertion. `tests/categories-page.spec.ts` is new (3 tests). `smart-rules.spec.ts` and `account-and-mobile-nav.spec.ts` passed unedited.

| Selector | Now | Specs moved |
|---|---|---|
| `[id^="category-row-"]` | **Same id**, now an `li` in `#category-group-expense`, `-income` or `-system`. An Expense or Income row holds one button; a System row holds none. | none |
| `#edit-category-{id}` | **Same id**, now the row's own full-width button. It opens the category in the form (from `lg`) or a sheet (below it). | none |
| `#delete-category-{id}` | **Same id**, now in the edit form, for a custom category only, disabled while it is in use. It exists only while that category's form is open. | `categories` opens `#edit-category-{id}` first (3 tests) |
| `#new-category-type` `<select>` | **Retired.** The type is a `SegmentedControl`: `#new-category-type-expense`, `#new-category-type-income`. | `categories` (5) |
| Row text `INCOME` | **Retired** (no raw enum, L10). The type is the group: `#category-group-income`. | `categories` (1) |
| Dialog `'Delete Category'` → **`'Delete category'`** | The `ConfirmDialog` title. | `categories` (2) |
| Button `'Close modal'` (edit) → **`#edit-category-cancel-btn`** | The edit form's Cancel; there is no edit modal from `lg`. | `categories` (1) |
| `#new-category-name`, `#new-category-description`, `#save-category-btn`, `#edit-category-name`, `#edit-category-description`, `#edit-category-save-btn` | **Same ids.** The buttons read "Add category" and "Save changes". | none |
| `#keyword-category-select` option `Groceries (EXPENSE)` → **`Groceries (Expense)`** | Types read as words; a System category reads by its L10 name alone. | `keywords` (1) |
| `[data-testid="metric-inferred-type"]` `EXPENSE` → **`Expense`** | The sandbox's type, in words. | `keywords` (1) |
| `#category-subtab-manage`, `#category-subtab-rules`, `#new-keyword-input`, `#save-keyword-rule-btn`, `#test-parser-input`, the other `metric-*` testids, `tr[id^="rule-row-"]` | **Unchanged.** The tab reads "Smart rules". | none |
| `#nav-tab-*` | **Same ids**; the label is `sr-only` below 1280px and the icon shows instead. Name and `title` are unchanged. | none |
| New | `#category-list-heading`, `#category-group-{expense,income,system}`, `#category-form-heading`, `#new-category-form`, `#edit-category-form`, `#new-category-color-{hex}`, `#edit-category-color-{hex}`, `#edit-category-color-current`, `#edit-category-cancel-btn` | `categories-page` |

### Hazards
- **`#delete-category-*` exists only in that category's edit form.** A spec asserting it is absent must open `#edit-category-{id}` first, or the check passes for the wrong reason.
- **A new form remounts after each add**, starting on the next free colour, so a handle to a swatch held across an add points at the old element.
- **A swatch's id is its hex without `#`, lower-cased** (`#new-category-color-e879a6`). A used one is a disabled button, so a click waits and fails.
- **Below `lg` the edit form is in a sheet** while the New form stays on the page, so `#new-category-*` and `#edit-category-*` can both be in the DOM.
