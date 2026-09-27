# 0026 — Static amounts, state-only motion, and a sync status that can fail

**Status:** Accepted. **Supersedes** ADR `0009` (`AnimatedCounter`'s direct DOM writes). **Amends** ADR `0025` (its "left open" list). **Implements** `DESIGN.md` §2, §3, §4 and §5 for Phase 53b. **Closes** antislop audit 001 findings 4, 5, 7, 8 and 10 to 17; 1 to 3 closed in Phase 53a.
**Date:** 2026-09-28

## Context

Phase 53a moved every colour onto the design tokens and changed nothing else. What was left came from audit 001 and `DESIGN.md`:

- **Balances counted up from zero** on every mount and every write, through `AnimatedCounter`. `DESIGN.md` §4: "a figure that is still moving can be read as the wrong amount."
- **Motion that nobody asked for:**
  - a pulsing dot in the dashboard hero that marked no state;
  - two blurred colour orbs behind the balance;
  - a staggered spring entrance on every dashboard section;
  - 39 framer `whileHover` / `whileTap` scales and lifts across 16 files;
  - a three-part loading animation (pulsing square, spinning ring, bouncing dots).
- **Blur on five surfaces**, where `DESIGN.md` allows two.
- **A failed cloud load was silent.** `loadSupabaseData` logged it to the console and the navbar kept saying "Cloud Synced".
- **Controls under 44 px**, a focus outline removed with nothing in its place, em dashes in user-facing text, and developer language in copy.

## Decision

### Amounts are static text

`src/components/ui/Money.tsx` renders `formatCurrencyAmount(Math.abs(value))` in `font-mono tabular-nums`, with `MINUS` before a negative value, so `−฿1,000.00` rather than `฿-1,000.00`. It replaced `AnimatedCounter` at all six call sites, and `AnimatedCounter.tsx` is deleted.

The same text as before reaches the DOM (`฿1,000.00`), so no spec changed. The number is now final on the first frame.

**ADR 0009 is superseded, not wrong.** Its direct-DOM-write mechanism was the right fix for a per-frame `setState`. The animation it made cheap is no longer wanted, so the mechanism has nothing left to do.

`CURRENCY_DISPLAY_OPTIONS` is module-private again, since only `formatCurrencyAmount` reads it.

### Amount colour comes from the transaction's meaning

`TX_TYPE_META` gained a `text` field, and `TxAmount` reads it through `txTypeMetaFor`:

| Transaction | Colour |
|---|---|
| Income | emerald |
| Expense | rose |
| Transfer | cyan |
| Debt repayment | amber |
| Adjustment, upward | emerald with `+` |
| Adjustment, downward | rose with `−` |

This settles the question ADR `0025` left open (the owner's decision on 2026-09-28): an adjustment keeps ADR `0024`'s direction and is not cyan. It changes the total you own, and a transfer does not. `DESIGN.md`'s hue table now reserves cyan for transfers.

The three per-site schemes `TxAmount` used to take (`standard`, `incomeOnly`, and `RecentTransactionsTable`'s own map) are gone:

- The dashboard table's map was already this rule, except that it painted adjustments cyan.
- The other two left expenses in plain text.

`WalletPopupModal`'s activity list also drops its `tintOverride`, which painted every repayment and adjustment cyan.

`DiaryEntryCard` keeps `colorClassName="text-expense"`, because it lists only a day's outflows.

### Motion is a response to the user, at 150 to 200 ms

- **Removed:**
  - every framer `whileHover` / `whileTap` (39 attributes);
  - the selected-swatch `scale-125`;
  - the active mobile-nav icon's `scale-110`;
  - the selected mood button's `scale-105`;
  - the dashboard's staggered entrance;
  - two `animate-fade-in` classes that had no keyframes.
- **Changed to a 200 ms `easeOut` tween with no scale:**
  - the tab slide (`pageTransition`);
  - the modal panel;
  - both `layoutId` pills (`SegmentedControl` and the mobile nav).
- **Kept, because each runs only while real work runs** (`DESIGN.md` Don't #5):
  - the Syncing spinner;
  - the auth submit spinner;
  - the insights refresh spinner while generating;
  - the microphone's pulse while recording.
  The Syncing spinner is `motion-safe:` only.

### Blur only where content scrolls underneath

- `Modal`'s scrim is a solid `bg-scrim`, and its panel is opaque `bg-surface-1`.
- `WalletPopupModal`'s header and the dashboard hero lost theirs.
- What remains is the mobile bottom nav and the CSV preview's sticky `<thead>`.
- `TransactionsView`'s main table header is not sticky, so it has no blur either.

### Loading states are static outlines

`ViewLoadingFallback` takes the tab being loaded and draws that view's layout in static Surface 2 blocks. It keeps `id="view-loading-fallback"` (`gotoTab` waits for it to detach), and adds `role="status"`, `aria-busy` and a screen-reader line such as "Loading diary".

The insights skeleton lost its pulse and gained `role="status"`. "Running dry-run validation checks..." with a pulse became a static "Checking rows...".

### The sync badge has five states, and one of them is an error

`FinanceStateContext` gains `syncError: string | null`:

- **Set** when `loadSupabaseData` finishes with any failed read ("Could not read debts, transactions").
- **Also set** when the load throws ("Could not reach the server"). The throw path checks `authEpochRef` first, so a load abandoned by a sign-out cannot set it.
- **Cleared** by a clean load, and by `resetToGuestState`.

A slice that did load still applies, exactly as before (ADR `0022`).

`NavbarSyncBadge` picks one state, in this order:

1. **Local** (guest): opens sign-in. It keeps `#navbar-sync-badge-btn`.
2. **Offline**: read with `useSyncExternalStore` over `navigator.onLine` and the `online` / `offline` events.
3. **Syncing**: amber, with the spinner.
4. **Sync failed**: rose. It is a button that calls the existing `refreshFromCloud`, and its `title` carries the error text.
5. **Synced**: a static emerald dot.

Every signed-in state sits inside `#navbar-sync-status` (`role="status"`). Both buttons keep a small pill inside a 44 px hit box. A negative vertical margin stops the taller box from pushing the navbar row apart.

**Tested in the signed-in harness, not E2E**, because no spec signs in. `unit/authenticated-ledger.test.tsx` has five tests covering:

- a partial read, which still applies the tables it did read;
- a thrown load;
- a clean retry clearing the error;
- a clean sign-in starting clear;
- `SIGNED_OUT` clearing it.

All five failed against the code before the change. One of them originally asserted `not.toBeNull()`, which `undefined` also passes, so it now asserts a string.

### 44 px and a visible focus on every control the audit named, and the ones beside them

**Shared styles:**
- `PRIMARY_BUTTON_CLASS`, `PRIMARY_BUTTON_COMPACT_CLASS` and `SECONDARY_BUTTON_CLASS` carry `min-h-[44px]`.
- Both `SegmentedControl` sizes carry it too, which covers `#time-filter-*`.

**Close buttons:** `Modal`'s close button, `#auth-close-btn` and `#close-wallet-modal-btn` are 44×44. The last one gained an accessible name, "Close wallet details". It had none, and reusing "Close modal" would have collided with `categories.spec.ts`'s role query.

**Icon buttons:** 44×44 on:
- `#delete-wallet-*`;
- `WalletPopupModal`'s adjust and delete buttons, which also gained `aria-label`s;
- `#insights-collapse-btn` and `#insights-refresh-btn`;
- the transfer swap button;
- the category icon picker.

**Colour swatches:** in `AddWalletForm` and `CategoriesView`, each 28 px swatch sits inside a 44 px button, with `aria-label` and `aria-pressed`. The selected swatch shows the focus ring instead of growing.

**`#diary-workout-checkbox`:** a 16 px drawn box inside a 44 px transparent native input.
- The input stays the element the spec checks.
- Playwright treats `opacity: 0` as visible.

**Found by the 390 px re-measure, outside 001's table, fixed in the same pass:**
- `#settle-debt-*` / `#delete-debt-*`, `#edit-category-*` / `#delete-category-*` and the keyword-rule delete button: each is 44×44 and gained an `aria-label`. The first four had only a `title`, and the rule button had no name at all.
- `#open-add-debt-btn`.
- `#tx-show-deleted`: the same transparent-input pattern as the workout checkbox.
- `FIELD_BASE`, so every shared input and select is at least 44 px tall.

**Other controls:**
- The diary date picker, workout note, food buttons and export button.
- The Wallets header buttons.
- The navbar tab row, which was `min-h-[40px]` below `sm`.
- The signed-in account pill, which was 36 px wide.

**Focus:** `WalletPopupModal`'s activity `<select>` and `WalletTransferForm`'s two wallet `<select>`s had `focus:outline-none` (and `focus:ring-0`) with no replacement. They now show `focus-visible:ring-2 ring-focus`. The transfer selects are still real, visible form controls, as `wallet-forms.spec.ts` requires.

### Copy

| Before | After |
|---|---|
| "Full-Stack Personal Finance & Holistic Lifestyle Management" (navbar) | "Track money and daily habits" |
| Footer tagline, plus "Supabase Realtime Cloud Sync • Safe Math.js • Single-Tx Repayments" | "FinLife Tracker · Track money and daily habits" |
| "Holistic Diary" / "Holistic Mini Diary" | "Daily Diary" (the two spec regexes changed in the same commit; the export filename did not) |
| "CRUD operations with soft-delete safety, math parser, and 2-step CSV synchronization" | "Record, delete and restore transactions, or import a CSV file." |
| "Soft delete (reverts wallet balance)" / "Restore soft-deleted transaction" | "Delete and reverse the wallet change" / "Restore transaction" (now also the `aria-label`) |
| "Step 1: Dry-run parse & validate rows → Step 2: ..." / "Running dry-run validation checks..." | "Step 1: check the rows. Step 2: import them." / "Checking rows..." |
| "Periodic Cashflow & Outflow Analysis" | "Income and spending by period" |
| "Click to authenticate & enable cloud sync" | "Sign in to sync across devices" |
| "{n} Accounts Active", "Cumulative liquid capital, ..." | "{n} wallets", "Sum of every active wallet's balance." |
| "Loading Module" | removed (the skeleton's screen-reader text) |
| Em dashes in the Jev note, the classify summary, "Rule saved —", "Maximum payable is ... —", "Offline summary —", two monthly-insight sentences in `spendingSummary.ts`, and "—" as an empty category | a colon, a comma, a full stop, or "No category" |
| AccountModal's "device - they are not synced" | "device. They are not synced" |

**Form labels are sentence case now.** `LABEL_TEXT_CLASS` and five inline labels lost `uppercase tracking-wider`. `DESIGN.md` §2 keeps uppercase for compact metric labels, column headers and tickers, which is where the rest remain. The DOM text is unchanged, so no spec depends on it.

### The font

`@fontsource-variable/jetbrains-mono` is self-hosted. `index.css` declares one `@font-face` for the latin file only, so the build emits one 40 kB `woff2` rather than the package's six subsets. `woff2` is in the workbox `globPatterns`, so the font is precached (44 to 45 entries). The baht sign still falls through the `--font-mono` stack (ADR `0025`).

## Consequences

- **One `framer-motion` feature left the shell.** `motion` is no longer imported by `Navbar`, `NavbarLedgerStatus`, `AuthModal`, `WalletsView`, `DashboardView`, `CategoriesView`, `WalletPopupModal`, `AddWalletForm`, `WalletTransferForm`, `RecentTransactionsTable` or `WalletAccountsGrid`. `vendor-motion` still ships for `Modal`, the tab slide and the `layoutId` pills.
- **The signed-in harness grew by five tests** and `tx-cells` by three: 251 unit tests.
- **Two spec lines changed**, both the diary heading regex, as approved in the plan.
- **Not done, and recorded:**
  - Finding 6 (starter money) is its own phase.
  - The note field's microphone button is 32 px inside the input; the audit did not list it, and a 44 px button would crowd the field.
  - The transfer panel's projected balance still renders a negative as `฿-1,000.00` through `formatCurrencyAmount`; `transfer-preview.spec.ts` asserts only non-negative projections, and moving it onto `Money` is a small follow-up.
  - The CSV preview's per-row controls (the classify button, suggestion chips, the row category select) and the search field's clear button were not measured: they render only with a file loaded or text typed.
