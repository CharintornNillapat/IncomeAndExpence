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

## Known remaining fragile selectors (not yet hardened; addressed in later phases per the roadmap)

- `transaction.spec.ts:55` — `^Income$` button text (Phase 27, SegmentedControl must preserve option labels exactly).
- `transaction.spec.ts:100` — `button[title="Clear search"]` (a tooltip string, reword risk).
- `transaction.spec.ts:119` — `span` filtered by `Calculated:` text.
- Heading text assertions (`/Wallets & Accounts/i`, `/Debts & Loans/i`, `/Holistic Mini Diary/i`, `/FinLife Tracker/i`) — Phase 25's `SectionHeader` must render identical `h2` text.
- `date-boundary.spec.ts:31,34` — hardcoded seeded id `wallet-entity-wal-main-checking` and literal string `Created: 2026-09-18` (stable unless the seed data or date-formatting changes).
