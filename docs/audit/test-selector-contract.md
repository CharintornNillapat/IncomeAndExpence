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

## Known remaining fragile selectors (not yet hardened; addressed in later phases per the roadmap)

- `transaction.spec.ts:55` — `^Income$` button text (Phase 27, SegmentedControl must preserve option labels exactly).
- `transaction.spec.ts:100` — `button[title="Clear search"]` (a tooltip string, reword risk).
- `transaction.spec.ts:119` — `span` filtered by `Calculated:` text.
- Heading text assertions (`/Wallets & Accounts/i`, `/Debts & Loans/i`, `/Holistic Mini Diary/i`, `/FinLife Tracker/i`) — Phase 25's `SectionHeader` must render identical `h2` text.
- `date-boundary.spec.ts:31,34` — hardcoded seeded id `wallet-entity-wal-main-checking` and literal string `Created: 2026-09-18` (stable unless the seed data or date-formatting changes).
