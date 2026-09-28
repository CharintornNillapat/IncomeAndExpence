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
| `#dashboard-wallet-card-{id}` | **Unchanged id**, now a `<button>` that opens the wallet popup (`account-and-mobile-nav.spec.ts:131` clicks its centre). The inner `wallet-quick-transfer-*` button is gone, so nothing inside competes for the click. | same |
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
