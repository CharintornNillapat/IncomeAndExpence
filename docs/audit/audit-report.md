# Audit report — FinLife Tracker

**Status: frozen as of Phase 0 (2026-09-17).** Findings are write-once. Do not delete a finding when its task ships — append a `> Resolved by T<n>, commit <sha>` note under it instead. Every claim below carries a `path:line` citation, verified against the repository at commit `1a02a4a`.

## Corrections and verification notes

Five claims from the initial pass were checked against the code and revised before this report was frozen. They change the task ranking, so they are recorded here rather than silently folded in.

| # | Initial assumption | Verified reality | Effect |
|---|---|---|---|
| C1 | All context callbacks churn on hot state | Only **7 of 22** `useCallback`s in `FinanceContext.tsx` are volatile: `addTransaction` (`:855`, deps `:1148` = `[wallets, transactions, debts, categories, currentUser.id, isAuthenticated]`), `setTransactionDeleted` (`:1154`, deps `:1201`) + wrappers `softDeleteTransaction`/`restoreTransaction` (`:1203`/`:1208`), `commitBulkImport` (`:1214`, deps `:1329`), `repayDebtAtomic` (`:1378`, deps `:1399`), `upsertDiaryEntry` (`:1420`, deps `:1483`). The remaining 15 — `signOut:685`, `revokeSession:694`, `revokeAllOtherSessions:700`, `addWallet:707`, `updateWallet:771`, `deleteWallet:795`, `addKeywordRule:800`, `deleteKeywordRule:847`, `addDebt:1332`, `settleDebt:1401`, `deleteDebt:1410`, `deleteDiaryEntry:1485`, `refreshFromCloud:679`, `loadSupabaseData:491`, `setShowSoftDeleted` (raw setter) — depend only on `isAuthenticated` / `currentUser.id` / `[]` and are stable for the whole session | A stable-actions context (§4 of the plan) covers 15 of 22 actions on day one with zero ref surgery |
| C2 | `DashboardView.tsx:80-101,147-152` need memoization | Already memoized — `useMemo` at `:80,104,110,116,122,127,147,154,158` | Reclassified from performance to **correctness**: `:87` calls `todayIsoDate()` once per transaction inside the predicate; `:88/:92/:95` parse a bare `YYYY-MM-DD` as UTC midnight and compare against a local `now` (`:82`) via raw `86400000` ms arithmetic |
| C3 | `MobileBottomNav`'s `React.memo` is defeated only by unstable props | It calls `useFinance()` itself (`MobileBottomNav.tsx:31`). `React.memo` cannot stop a context subscriber from re-rendering | New rule: never wrap a context subscriber in `React.memo`. Cut the subscription first, memo second |
| C4 | CI enforces the type gate | `.github/workflows/playwright.yml:26-32` runs only `npm ci`, `playwright install`, `npx playwright test`. `npm run lint` never runs in CI, and `tsconfig.json:30` excludes `tests` from type-checking | The gate this whole plan leans on is not enforced today (see task T4) |
| C5 | `roundToCents` differs meaningfully from the inlined copies | `roundToCents` (`FinanceContext.tsx:115-117`) is exactly `Math.round(value * 100) / 100` — byte-identical to the 4 inline call sites at `:944,1071,1309,1318` | The substitution (T19) is zero-risk arithmetic, not a behavior change |

Also verified: the `useMemo` at `FinanceContext.tsx:1498` currently guards against nothing. `FinanceProvider`'s only parent is `App()` (`App.tsx:246-252`), which holds no state and never re-renders, so the 33-entry dep array (`:1535-1569`) is 33 `Object.is` comparisons per commit for a memo that never has anything to prevent. It becomes load-bearing only after the volatile actions are stabilized (T13-T15).

---

## A. Context / re-render problems

- `FinanceContext.tsx:36-96` — `FinanceContextType` has 34 members across 7 unrelated domains (auth/sessions, wallets, categories+keyword rules, transactions, debts, diary, UI filter flags). Value built `:1499-1534`, memoized `:1498`.
- Every `useFinance()` consumer re-renders together on the 7 volatile writes (C1). 16 consumers: `App.tsx:61`, `hooks/useDebts.ts:14`, `hooks/useTransactions.ts:27`, `hooks/useWallets.ts:13`, `MobileBottomNav.tsx:31`, `Navbar.tsx:36`, `TransactionForm.tsx:35`, `WalletPopupModal.tsx:37-43`, `DashboardView.tsx:49`, `DiaryView.tsx:22`, `KeywordRulesView.tsx:8`, `SecurityView.tsx:25-35`, `WalletsView.tsx:17`, `TransactionsView.tsx:22-26`, `wallet/AddWalletForm.tsx:53`, `wallet/WalletTransferForm.tsx:66`.
- `App.tsx:61` — `MainApp` calls `useFinance()` for `wallets, categories, addTransaction`. Because `addTransaction`'s identity churns on every tx/wallet/debt/category change, and `MainApp` renders the *entire* tree (`Navbar`, swipe wrapper, `AnimatePresence`, active view, `MobileBottomNav`, `AuthModal`, `ReloadPrompt`, footer, quick-add modal), every financial write re-renders everything. This single subscription is why `React.memo` looks defeated at eight different components.
  > Resolved by T1 (Phase 2): the quick-add modal (the only reason `MainApp` needed `useFinance()`) was extracted to `src/components/QuickAddModal.tsx`, which subscribes for itself. `MainApp` now holds only its 4 local `useState` UI flags and no longer re-renders on any financial write.
- `App.tsx:63,72,80,98` — `handleTabChange`, `handleNextTab`, `handlePrevTab`, `renderActiveView` recreated every render, none `useCallback`'d. `App.tsx:101,115` inline `onNavigate` closures defeat `React.memo` on `RecentTransactionsTable` (`dashboard/RecentTransactionsTable.tsx:14`).
  > Resolved by T3 (Phase 2): `handleTabChange`/`handleNextTab`/`handlePrevTab` are `useCallback`'d with an explicit `[activeTab]` dependency (stable between tab changes); the inline `onNavigate` closures at `:101,115` were replaced with a single stable `handleNavigate` callback. `renderActiveView` itself was left as a plain function — it's a local render helper, never passed as a prop, so memoizing it buys nothing.
- `App.tsx:134-147` — `<AnimatePresence mode="wait">` + `key={activeTab}` unmounts/remounts the view subtree on every tab change (deliberate — see decision `0005`), and the `<Suspense>` boundary sits inside that keyed `motion.div`.
- Memoized-but-defeated (by unstable props, not by a subscription): `RecentTransactionsTable.tsx:14`, `CategoryExpenseDistribution.tsx:16`, `CashflowMetricsCards.tsx:13`, `DebtPayoffOverview.tsx:12`, `TotalWealthHero.tsx:15`, `TransactionTableRow.tsx:15`, `DebtCardItem.tsx:13`.
- Memoized-but-defeated (by self-subscription, per C3): `MobileBottomNav.tsx:27` + `:31`.
- Not memoized at all: `TransactionForm`, `Navbar`, `InlineMathInput`, `WalletPopupModal`, `AnimatedCounter`.

## B. Unmemoized render-time computation

- `DiaryView.tsx:135-137` — filter+sort over `diaryEntries`, no `useMemo`, recomputed on every keystroke across 7 local state vars (`:29-35`).
- `DiaryView.tsx:367` — filter executed once per diary entry inside the render map (`:362`) → O(entries × transactions-per-day) per keystroke.
- `DiaryView.tsx:203` — inline filter in JSX, every render.
- `DiaryView.tsx:68-84` (`formatDayInfo`) — recreated every render, allocates a `Date` + two `toLocaleDateString` calls per entry per render, and calls `todayIsoDate()`/`daysAgoIsoDate(1)` inside itself.
- `KeywordRulesView.tsx:17` — `matchSmartDescription` called during render, unmemoized. `:34` — `new Map(categories.map(...))` unmemoized.
- `TransactionForm.tsx:37` — `debts.filter(...)` at component body; the form holds ~12 local state fields, so this runs on every keystroke. `:306-307` — `wallets.filter(...)` inline in JSX.
- `WalletsView.tsx:22` — `wallets.filter(...)` unmemoized, result passed as a prop (`:218`) with a new identity every render.
- `WalletTransferForm.tsx:171-172`, `App.tsx:225-226`, `DashboardView.tsx:254`, `TransactionsView.tsx:400-401` — filtered arrays passed as props, new identity per render.
- `Navbar.tsx:39-47` — 7-object `navItems` literal rebuilt every render for constant data.
- (See correction C2 — `DashboardView.tsx:80-152` is already memoized; its remaining issue is date correctness, listed under F.)

## C. localStorage / sync

- `FinanceContext.tsx:390-413` — eight separate `useEffect`s, one per slice, each a full `JSON.stringify` on every change of that slice, no debounce/throttle. The transactions effect (`:399-401`) is O(entire ledger) and synchronous on the main thread.
- All 8 fire once on mount, re-serializing exactly what was just parsed back by `safeGetLocalStorage` (`:101-111`).
- A single `addTransaction` touches `setTransactions` + `setWallets` (+ `setDebts` for repayments) → 2-3 full serializations. A failed write rolls back (`:1111-1113`) → 3 more.
- `loadSupabaseData` (`:491-597`) sets all 6 slices → 6 serialization passes per cloud refresh. `StrictMode` (`main.tsx:7`) double-invokes these effects in dev.
- `FinanceContext.tsx:658-677` — one realtime channel over `SYNCED_TABLES` (`:132`, 5 tables); any `postgres_changes` event on any table calls `loadSupabaseData(currentUser.id)` (`:668`), which refetches all 6 tables unbounded (`.select('*')` at `:497,514,534,551,561,572`). No debounce, no payload diffing, no `user_id` filter on the subscription. A user's own write echoes back and triggers a full refetch of their entire dataset; `commitBulkImport` inserting N rows can fan out to N events. The effect depends on `loadSupabaseData` (`:677`), so it tears down and resubscribes whenever that identity changes.
- `FinanceContext.tsx:1305-1312` — bulk import issues one sequential `await` per affected wallet before the refetch.

## D. Dead code (exports — invisible to `noUnusedLocals`)

- `hooks/useTransactions.ts:121-151` + `:189` — the whole `metrics` memo, computed on every `transactions` change, consumed by nobody. `DashboardView.tsx:104-124` hand-rolls the same numbers independently.
  > Resolved by T5 (Phase 1). Note: `DashboardView.tsx:104-124`'s independent hand-rolled version was left in place — deduplicating it is a separate task (`T26`), not part of dead-code removal.
- `hooks/useTransactions.ts:5-13` — `UseTransactionsFilterOptions` exported, never imported.
  > Resolved by T5 (Phase 1): un-exported (kept as an internal type — the hook's own filtering logic for `categoryId`/`startDate`/`endDate`/`includeDeleted` still uses it, just isn't fed those fields by any current caller).
- `hooks/useWallets.ts:21-38` + `:68` — `walletsByType`, never consumed.
  > Resolved by T5 (Phase 1).
- `hooks/useWallets.ts:40-62` + `:70-72` — `addWallet`/`updateWallet`/`deleteWallet` pass-throughs, never consumed (`AddWalletForm.tsx:53`, `WalletsView.tsx:17` call `useFinance()` directly instead).
  > Resolved by T5 (Phase 1). `useWallets.ts` shrank from 74 to 16 lines.
- `hooks/useDebts.ts:81-84` — `allDebts`, `unsettledDebts`, `settledDebts` (as external exports — they are used internally for `debtMetrics`), `isSyncing`. `:44,46` — `metrics.totalMinimumMonthly`, `settledCount`.
  > Partially resolved by T5 (Phase 1): `allDebts` and `isSyncing` removed from the return object; `metrics.totalMinimumMonthly` and `metrics.settledCount` removed. `unsettledDebts`/`settledDebts` were deliberately kept in the return object per the task's explicit instruction, even though still unconsumed externally — they remain legitimate derived-state API surface, unlike `allDebts` which just duplicated the context's own `debts`.
- `FinanceContext.tsx:384` — `otpPending`, a `useState(false)` with no setter; nothing can ever set it. Still plumbed through `:1507,1543` and read by `Navbar.tsx:36,236` and `MobileBottomNav.tsx:31,81` to render a badge that can never appear.
  > Resolved by T2 (Phase 1). Bonus effect: removing it deleted `MobileBottomNav`'s only `useFinance()` call, so its existing `React.memo` (finding A) now actually prevents re-renders instead of being a no-op per correction C3.
- `utils/currency.ts:19-21` — `{showCode, showSymbol}` options object; no call site in `src/` passes a second argument.
  > Resolved by T6 (Phase 1): `formatCurrencyAmount` now takes only `amount`.
- `components/AnimatedCounter.tsx:7-8,19` — props `currencySuffix`, `decimals`, `className` never passed by any of 5 call sites.
  > Resolved by T6 (Phase 1). `decimals` was hardcoded to 2 (its only real value) in the `toLocaleString` call it fed.
- `components/InlineMathInput.tsx:7,13,17` — props `name`, `autoFocus`, `className` never passed by any of 3 call sites.
  > Resolved by T6 (Phase 1). `name` was hardcoded to `"amount_expression"` directly on the `<input>` — its only real value, and the literal string tests and other code locate the field by.
- `components/WalletPopupModal.tsx:22` — the `'TRANSACTIONS'` tab member unreachable (`WalletAccountsGrid.tsx:12` narrows the callback).
  > **Correction (Phase 1, T6):** this finding is wrong, not resolved. `'TRANSACTIONS'` is a live in-modal "Activity" tab — two working buttons inside `WalletPopupModal` itself call `setActiveTab('TRANSACTIONS')` directly (its own internal state transition, independent of the `initialTab` prop), and the tab renders real content. The original finding only established that it can never arrive as the *initial* tab from `DashboardView.tsx`'s `openWalletModal`, not that the union member is dead. Left in place; not deleted.

## E. Duplication

- **Modal scaffolding**, hand-rolled 9 times (overlay, drag indicator, close-X, spring transition): `App.tsx:183-187`, `TransactionsView.tsx:363-367,420`, `WalletsView.tsx:135-139,188-192`, `DebtsView.tsx:134-138,277-281`, `WalletPopupModal.tsx:120-124`, `AuthModal.tsx:104-108`. Worst pair: `App.tsx:176-242` ≡ `TransactionsView.tsx:361-416` — the same modal, wrapping the same `TransactionForm`, with the same submit closure.
- **Page header banner**, duplicated 7×: `WalletsView.tsx:27-33`, `DebtsView.tsx:99-105`, `DiaryView.tsx:145-151`, `KeywordRulesView.tsx:39-45`, `SecurityView.tsx:132-138`, `TransactionsView.tsx:154-160`, `DashboardView.tsx:210-216`.
- **Segmented toggle**, 3×: `DashboardView.tsx:219-236`, `TransactionForm.tsx:193-213`, `AuthModal.tsx:146-177`.
- **Transaction row**, 4 independent renderers: `TransactionTableRow.tsx:27-163`, `RecentTransactionsTable.tsx:70-180`, `WalletPopupModal.tsx:484-514`, `DiaryView.tsx:464-481`.
- **Wallet card**, 3 renderers: `WalletsView.tsx:60-124`, `WalletAccountsGrid.tsx:56-154`, `WalletPopupModal.tsx:233-361`.
- **Wallet `<option>` with balance**, 6 copies: `TransactionForm.tsx:286-291,306-313`, `WalletTransferForm.tsx:155-160,171-178`, `DebtsView.tsx:313-319`, `WalletPopupModal.tsx:470-474`.
- **Progress bar + caption**, 4 copies: `DebtCardItem.tsx:81-92` ≈ `DebtPayoffOverview.tsx:32-43`, `CategoryExpenseDistribution.tsx:49-55`, `WalletAccountsGrid.tsx:126-134`.
- **`new Map(wallets.map(...))` / categories**, built 7 independent times: `DashboardView.tsx:154-160`, `TransactionsView.tsx:78-84`, `DiaryView.tsx:38-39`, `KeywordRulesView.tsx:34`, `useTransactions.ts:41-49`, `csvExchange.ts:10-11`, `smartMatcher.ts:25`.
- **`walletFormStyles.ts`** centralizes `LABEL_CLASS`/`inputClass`/`selectClass`/`OPTION_CLASS`/`PRIMARY_BUTTON_CLASS`/`ERROR_BANNER_CLASS`, but only the two wallet forms (`wallet/AddWalletForm.tsx`, `wallet/WalletTransferForm.tsx`) use it. Re-typed inline across `DebtsView`, `KeywordRulesView`, `DiaryView`, `SecurityView`, `TransactionsView`, `TransactionForm`, `WalletPopupModal`, `AuthModal`, `DebtCardItem`, `InlineMathInput` (dozens of sites).
- **Submit shape** (preventDefault → clear error → await → `if (!res.success) setError` → reset) repeated in `DebtsView.tsx:53-74`, `KeywordRulesView.tsx:19-32`, `DiaryView.tsx:86-107`, `AddWalletForm.tsx:61-86`, `TransactionForm.tsx:103-171`, `WalletTransferForm.tsx:91-126`.
- **Idempotency-key lifecycle**, identical in `TransactionForm.tsx:79/153/165` ≡ `WalletTransferForm.tsx:81/108/121`. **Triple-setState amount callback**, identical in `TransactionForm.tsx:81-85` ≡ `WalletTransferForm.tsx:189-193` ≡ `DebtsView.tsx:329-333`. **Transient success flash** (`setTimeout`), 7 sites.

## F. Constraint drift (against CLAUDE.md rules)

- `AnimatedCounter.tsx:30-35` reimplements `toLocaleString` formatting and glues `฿` on at `:43`, instead of `formatCurrencyAmount` (`currency.ts:17-27`). This formats every headline number: `Navbar.tsx:155-158`, `TotalWealthHero.tsx:43-47`, `WalletAccountsGrid.tsx:108-112`, `CashflowMetricsCards.tsx:37-41/68-72/114-118`, `WalletsView.tsx:105-109`. **CLAUDE.md explicitly exempts this component** as "an animation primitive with its own decimals prop and separately styled prefix" — any change here needs ADR `0004`, not a routine fix.
- `InlineMathInput.tsx:132,179` render `{currencyPrefix}{formattedResult}` where `formattedResult` is `toFixed(2)` from `mathEvaluator.ts:62` — no thousands separator, so `฿12345.00` renders here vs `฿12,345.00` elsewhere. CLAUDE.md exempts `mathEvaluator`'s `formattedValue` as "raw input-field text" — arguably not what `:132` is doing when it renders a computed *result*. Also ADR `0004`.
- Hard-coded `฿` literals instead of `APP_CURRENCY_SYMBOL`: `DebtsView.tsx:175,195,227,326`, `WalletPopupModal.tsx:299`.
  > Resolved by T20 (Phase 1).
- `CashflowMetricsCards.tsx:10,17` threads a `primarySymbol` prop from `DashboardView.tsx:244` instead of importing `APP_CURRENCY_SYMBOL` directly, as its sibling `TotalWealthHero.tsx:5` does.
  > Resolved by T20 (Phase 1). `DashboardView.tsx`'s now-unused `APP_CURRENCY_SYMBOL` import was also removed.
- Dates: `new Date().toISOString().slice(0,10)` has **zero** occurrences in `src/` (migration complete). Remaining issues of the same class: `WalletsView.tsx:117` slices a full UTC timestamp (`wallet.createdAt.slice(0,10)`), showing the UTC calendar day. `DashboardView.tsx:87,92,95,150` parse bare `YYYY-MM-DD` as UTC midnight and compare against a local `now`. `daysAgoIsoDate` (`date.ts:32`) exists and is used nowhere but `DiaryView.tsx`. `DiaryView.tsx:68-84` (`formatDayInfo`) is a local-calendar formatter living in a view rather than `utils/date.ts`. `SecurityView.tsx:282` — inline `toLocaleTimeString`.
- Rounding: `roundToCents` (`FinanceContext.tsx:115-117`) has 7 ledger call sites; `roundToTwoDecimals` (`mathEvaluator.ts:26-30`) has 1. CLAUDE.md says do not merge them (still correct). But 4 inlined hand-rolled `Math.round(x*100)/100` copies bypass `roundToCents` at `FinanceContext.tsx:944,1071,1309,1318`, plus 3 more money-rounding copies at `csvExchange.ts:152,163,176` (note: `csvExchange.ts:52,53` round mood/workout-rate, not money — do not touch those).
  > Partially resolved by T19 (Phase 1): the 4 `FinanceContext.tsx` sites now call `roundToCents`. The `csvExchange.ts` sites were deliberately left out of scope — `roundToCents` is module-private to `FinanceContext.tsx`, and exporting it adds import churn Phase 1 didn't need. Deferred to a later phase.

## G. Hook-layer adoption is inconsistent

- `useWallets` consumed only by `DashboardView.tsx:52`. `useDebts` consumed by `DashboardView.tsx:53` and `DebtsView.tsx:15`. `useTransactions` consumed only by `TransactionsView.tsx:37-50`. Every other site calls `useFinance()` directly: `WalletsView.tsx:17`, `DiaryView.tsx:22`, `WalletPopupModal.tsx:37-43`, `TransactionForm.tsx:35`, `Navbar.tsx:36`, `AddWalletForm.tsx:53`, `WalletTransferForm.tsx:66`, `App.tsx:61`, `KeywordRulesView.tsx:8`, `SecurityView.tsx:25-35`, `MobileBottomNav.tsx:31`.
- `useDebts.ts:84` re-exports `wallets` **unfiltered** straight from context, while `useWallets.ts:65` exports the active set. This forces `DebtsView.tsx:313-314` to filter `!w.isDeleted` itself, and `DebtsView.tsx:29` seeds `selectedWalletId` from `wallets[0]` — potentially a soft-deleted wallet.

## H. Build / config / tests

- `vite.config.ts` has no `build` block: no `manualChunks`, no bundle-analysis plugin. Entry chunk is 1,116.67 kB (gzip 326.33 kB) as of the Phase 0 build — see `baseline-metrics.md`. Per-view splitting already works (Dashboard 47.09 kB, TransactionsView 27.50 kB, csvExchange 22.35 kB split out).
- `vite.config.ts:79-83` alias `@` → repo **root** (not `src`); zero `from '@/'` matches anywhere in `src/` or `tests/`. Matching dead entry at `tsconfig.json:18-22`. `CLAUDE.md:53` still documents `@/*` as a live convention — it is not.
  > Resolved by T28 (Phase 1): alias deleted from both `vite.config.ts` and `tsconfig.json` (not re-pointed), `CLAUDE.md:53` and the Project Structure tree corrected. The now-unused `path` import in `vite.config.ts` was also removed.
- `tsconfig.json` has no `strict`, `strictNullChecks`, or `noImplicitAny`. Only `noUnusedLocals` (`:26`) and `noUnusedParameters` (`:27`). `exclude` (`:30`) omits `tests`, so `npm run lint` never type-checks the Playwright suite. `.github/workflows/playwright.yml` never runs `npm run lint` at all (C4).
  > Partially resolved by T4 (Phase 1): `tests` added to `include`, CI now runs `npm run lint` before the Playwright step. `strict`/`strictNullChecks`/`noImplicitAny` remain explicit non-goals (see plan's "Non-goals and traps").
- No ESLint, no Prettier, no unit-test runner. Playwright is the only test layer: 13 tests × 3 browsers = 39 runs (confirmed in Phase 0 baseline). Files: `theme.spec.ts` (3), `transaction.spec.ts` (4), `wallets.spec.ts` (1), `wallet-forms.spec.ts` (4), `diary.spec.ts` (1).
- **Zero test coverage**: `DebtsView.tsx` (377 lines, all debt mutations), `SecurityView.tsx` (467 lines, all session mutations), `KeywordRulesView.tsx` (212 lines + `smartMatcher.ts`), `AuthModal.tsx` (309 lines, entire auth path, and it contains **zero** `id=` attributes), CSV import/export (`csvExchange.ts`, 183 lines, + `commitBulkImport`), soft-delete/restore, the entire Supabase cloud-sync path (every spec runs against the localStorage fallback), `ReloadPrompt.tsx`, mobile bottom nav + swipe gestures (all 3 Playwright projects are Desktop).
- No barrel files anywhere in `src/`. Import graph is a clean DAG: `types`/`utils`/`lib` → `FinanceContext` → `hooks` → `components`/`views` → `App` → `main`. `FinanceContext.tsx:1-24` imports no hook and no component — that is what keeps the graph acyclic.
- No `docs/` directory existed before this audit. No ADRs existed. Root previously held only `CLAUDE.md` and `README.md`. `.gitignore` does not exclude a `docs/` path.
