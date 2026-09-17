# Task ledger

The only file in `docs/audit/` edited mid-phase. Flip `Status` to `in-progress` when a task starts; fill `Commit` / `Gate result` / `Metric delta` when it lands. Ranked by impact-to-risk, prioritized per the session's stated order: runtime responsiveness first, duplication second.

Status values: `todo` · `in-progress` · `done` · `dropped` (with a one-line reason).

## Phase 1 — zero-risk (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T4 | Add `npm run lint` to CI; un-exclude `tests` from `tsconfig.json` | `.github/workflows/playwright.yml`, `tsconfig.json` (`include`/`exclude`) | Med | Low | 15m | done | — | 74114f6 | lint clean, 0 pre-existing errors in `tests/` | tsc now checks 373→386 files (tests/ added) |
| T2 | Delete `otpPending` end-to-end | `FinanceContext.tsx`, `Navbar.tsx`, `MobileBottomNav.tsx` | High | Low | 1h | done | — | 74114f6 | tsc clean; `theme.spec.ts:47` green | Bonus: `MobileBottomNav` lost its only `useFinance()` call — its existing `React.memo` now actually functions (was previously a no-op per C3) |
| T5 | Delete dead hook exports | `useTransactions.ts`, `useWallets.ts`, `useDebts.ts` | Med | Low | 1.5h | done | — | 74114f6 | tsc clean | `useWallets.ts` shrank from 74 to 16 lines. Kept `unsettledDebts`/`settledDebts` in `useDebts`'s return (still exported, per instruction) even though no external caller destructures them yet |
| T6 | Delete unused props/options | `AnimatedCounter.tsx`, `InlineMathInput.tsx`, `currency.ts`, `WalletPopupModal.tsx` | Low-Med | Low | 1h | **partial** | — | 74114f6 | tsc clean | **`WalletPopupModal.tsx`'s `'TRANSACTIONS'` tab member was NOT deleted** — see correction note below. All other T6 items done: `AnimatedCounter` lost `currencySuffix`/`decimals`/`className` (decimals hardcoded to 2, its only actual value); `InlineMathInput` lost `name`/`autoFocus`/`className` (`name` hardcoded to `"amount_expression"` on the input, since that was the only value ever used and `wallet-forms.spec.ts`/`transaction.spec.ts` locate the field by it); `currency.ts`'s `formatCurrencyAmount` lost its `{showCode, showSymbol}` options param entirely |
| T19 | Replace 4 inlined cent-rounding copies with `roundToCents` (FinanceContext only, not csvExchange) | `FinanceContext.tsx` (4 sites) | Low | Low | 1h | done | — | 74114f6 | tsc clean | Textually identical arithmetic substitution, as predicted by audit correction C5 |
| T20 | Hard-coded `฿` → `APP_CURRENCY_SYMBOL`; drop `primarySymbol` prop | `DebtsView.tsx`, `WalletPopupModal.tsx`, `CashflowMetricsCards.tsx`, `DashboardView.tsx` | Low | Low | 1h | done | — | 74114f6 | tsc clean; `grep -rn "฿" src/ --include=*.tsx` now resolves only to `currency.ts:12` and the two documented exemptions (`AnimatedCounter.tsx`, `InlineMathInput.tsx`) | `DashboardView.tsx`'s `APP_CURRENCY_SYMBOL` import became dead after removing the prop-thread and was also removed |
| T28 | Resolve dead `@/*` alias (recommend: delete) | `vite.config.ts`, `tsconfig.json`, `CLAUDE.md:53` | Low | Low | 30m | done | — | 74114f6 | tsc clean; build succeeds | Deleted the alias (not re-pointed) per the plan's recommendation. `path` import in `vite.config.ts` also became dead and was removed. `DISABLE_HMR` block untouched |

**Correction found during execution (T6):** the ledger's `WalletPopupModal.tsx:22` entry — "the `'TRANSACTIONS'` tab member is unreachable" — was wrong. It is a live in-modal "Activity" tab (`id="tab-btn-txs"`, two working trigger buttons, rendered content) reachable once the modal is open, just never as the *initial* tab passed in from `DashboardView`. Deleting it would have removed a real feature and broken 4+ call sites. Skipped; `audit-report.md`'s finding D entry for this needs a `> Correction:` note appended, not a `> Resolved by` note, since the original finding was inaccurate rather than fixed.

**Committed:** `74114f6` — "refactor: complete phase 1 zero-risk cleanup and type gate hardening".

## Phase 2 — high-impact UI decoupling (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | Delete `useFinance()` from `MainApp`; extract quick-add modal as self-subscribing component | `App.tsx`, new `src/components/QuickAddModal.tsx` | High | Low | 2h | done | — | 41c6a4c | tsc clean; 39/39 Playwright; build succeeds | `MainApp` no longer subscribes to finance state at all — it now re-renders only for its own 4 `useState` UI flags, not on any financial write |
| T3 | `useCallback` the tab handlers; stabilize `onNavigate` | `App.tsx` | High | Low | 1h | done | — | 41c6a4c | tsc clean; 39/39 Playwright; build succeeds | `handleTabChange`/`handleNextTab`/`handlePrevTab` now stable except when `activeTab` itself changes (down from "every render"); `handleNavigate` passed to `DashboardView` → `RecentTransactionsTable` is stable on the same terms, so that component's existing (previously-defeated) `React.memo` can now bail out on unrelated re-renders |

**Notes on execution:**
- `QuickAddModal.tsx` is a near-verbatim extraction of the old inline JSX (same ids, `role="dialog"`, `aria-labelledby`, class names) — `tests/helpers.ts:addQuickTransaction` locates it by `getByRole('dialog', {name: /Quick Record Transaction/i})` and `input[name="amount_expression"]`, both preserved exactly.
- Added `useMemo` around the wallet/category filters now living in `QuickAddModal` (`wallets.filter(!isDeleted)`, `categories.filter(!isDeleted)`) — not explicitly requested, but directly serves the instruction's "ensure props passed down do not cause unnecessary re-renders," and is the same fix `T9` will apply elsewhere later.
- `handleTabChange`/`handleNextTab`/`handlePrevTab` were first written using the `setActiveTab(current => ...)` functional-updater form so their `useCallback` deps could be `[]` (fully stable forever). Reverted that: it called `setDirection` as a side effect from inside `setActiveTab`'s updater, which React may invoke more than once (StrictMode, concurrent features) — updater functions must stay pure. Shipped instead with the closure-based form and an explicit `[activeTab]` dependency, which matches the pre-existing behavior exactly and is stable between tab changes (changes only when `activeTab` itself changes, which is correct — the closure must be re-created then).
- Confirmed `Navbar`/`MobileBottomNav`'s `setActiveTab` prop type (`(tab: ActiveTab) => void`) and `DashboardView`'s `onNavigate` prop type (`(tab: string) => void`) were unchanged — no downstream signature changes needed.

## Phase 3 — bundle optimization (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T7 | `build.rollupOptions.output.manualChunks` | `vite.config.ts` (new `build` block) | High | Low-Med | 2h | done | — | da46314 | tsc clean; 39/39 Playwright (one Firefox flake on first run, reproduced-clean on re-run — see notes); build succeeds with 0 chunks over 500 kB (was 1) | Entry chunk 1,116.36 kB → 165.39 kB (−85%). 5 new vendor chunks. Total JS bytes shipped ~unchanged (~1,297 kB raw both before/after) — this redistributes weight for caching/parallelism, it does not shrink total payload |

**Notes on execution:**
- Implemented as a `manualChunks(id)` function (not the object-shorthand form), matching on `node_modules/<pkg>/` substrings — this is what correctly captures `mathjs/number`'s subpath import and `lucide-react`'s deep per-icon module paths, which the object form (`{'vendor-x': ['pkg-name']}`) would miss.
- Folded each vendor's own runtime-only dependencies into its group rather than leaving them to Rollup's default chunking: `scheduler` (react-dom's dependency) → `vendor-react`; `motion-dom`, `motion-utils`, `tslib` (framer-motion's dependencies — confirmed via `grep -rl tslib node_modules/*/package.json` that no other *runtime* dependency in this project pulls in `tslib`) → `vendor-motion`. `@supabase/supabase-js`'s five `@supabase/*` sub-packages (`postgrest-js`, `realtime-js`, `functions-js`, `storage-js`, `auth-js`) are covered automatically by the `node_modules/@supabase/` prefix match.
- Verified the split actually wires up at runtime, not just at build time: booted `vite preview` against the real production build, confirmed HTTP 200, and grepped the served entry chunk for references to all 5 vendor chunk filenames — all present.
- One Firefox test (`diary.spec.ts`) failed on `#view-loading-fallback` timing out on the first full-suite run, then passed both in isolation and on a full clean re-run. This is the known dev-server flakiness `CLAUDE.md`/`playwright.config.ts` already document generous Firefox timeouts for — and structurally cannot be caused by this change, since `build.rollupOptions` only applies to `vite build`, never to `vite dev`, which is what the Playwright `webServer` runs.
- `DISABLE_HMR` / `server.hmr` / `server.watch` block untouched, as required. PWA plugin config, manifest, and workbox caching rules untouched. No `@/*` alias re-added.

## Phase 4 — DiaryView memoization (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T8 | Memoize `DiaryView`; hoist `formatDayInfo` into `date.ts`; kill per-entry filters | `date.ts`, `DiaryView.tsx`, new `src/components/DiaryEntryCard.tsx` | High | Low | 3h | done | — | (uncommitted) | tsc clean; `diary.spec.ts` 3/3 (all browsers, Firefox at normal ~9.5s, no timing regression); 39/39 full suite; build succeeds | `activeEntries` filter+sort, `formatDayInfo`, and the per-entry outflow filter no longer recompute on every DiaryView render (e.g. every notes/workout keystroke) — only when `diaryEntries`/`transactions` actually change. Each entry row is now a `React.memo`'d `DiaryEntryCard` receiving referentially-stable props, so unaffected rows skip re-rendering entirely on unrelated state changes |

**Notes on execution:**
- `formatDayInfo` hoisted into `src/utils/date.ts` verbatim in its date-math (`new Date(year, month-1, day)` local-midnight construction, never `new Date(dateStr)`) — no UTC-shift risk introduced. Signature extended to accept optional `todayStr`/`yesterdayStr` parameters (defaulting to fresh `todayIsoDate()`/`daysAgoIsoDate(1)` calls) so callers formatting many dates in a loop compute "today" once instead of once per date — this is what actually kills the "N `formatDayInfo` calls per render" cost, not just moving the function to a new file.
- `moodLabels` (a fully static object, no component-state dependency) hoisted to a module-level `MOOD_LABELS` constant instead of being recreated — or even `useMemo`'d — every render.
- Added a stable module-level `EMPTY_DAY_DATA` constant replacing the inline `|| { totalOutflow: 0, totalIncome: 0, transactions: [] }` fallback literal (created fresh every access) at both the selected-date lookup and the per-entry lookup — a day with zero transactions now gets the *same* object reference every time, which matters for `DiaryEntryCard`'s `React.memo` to actually bail correctly on those rows.
- New `enrichedEntries` `useMemo` (deps: `[activeEntries, dailyTransactionsMap, todayIso, yesterdayIso]`) precomputes `dayInfo`/`dayData`/`outflowTxs`/`moodInfo` once per entry, once per actual data change — this is the fix for the O(entries × transactionsPerDay) work that previously ran inline in the JSX `.map()` on every render.
- Extracted the per-entry card markup into `src/components/DiaryEntryCard.tsx`, wrapped in `React.memo`. Its `onToggleExpand`/`onDelete` props are stable `useCallback`s from the parent (`handleToggleExpand`, `handleDeleteEntry`) that take the entry id as an argument, rather than the previous per-row inline arrow closures (`onClick={() => deleteDiaryEntry(entry.id)}`) — inline closures are a fresh function reference every render and would have defeated `React.memo` immediately regardless of how stable the other props were.
- Also memoized `selectedDayInfo` and `selectedDateOutflowCount` (the selected-date summary box), flagged in the audit at `DiaryView.tsx:140,203` in the pre-T8 file — smaller wins than the list, but same class of unnecessary per-keystroke recompute.
- `deleteDiaryEntry` (used inside `handleDeleteEntry`) is one of the context's stable actions (deps `[isAuthenticated]` only, per audit correction C1), so `handleDeleteEntry`'s own identity is stable across the whole session except around login/logout.

## Deferred — documented, awaiting separate approval

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by |
|---|---|---|---|---|---|---|---|
| T9 | Memoize inline filters passed as props | `TransactionForm.tsx:37,306-307`, `WalletsView.tsx:22,218`, `KeywordRulesView.tsx:17,34`, `TransactionsView.tsx:400-401` | Med-High | Low | 2h | todo | — (KeywordRulesView slice needs T12) |
| T10 | Hoist `navItems`; memo `Navbar` after subscription cut | `Navbar.tsx:39-47`, `MobileBottomNav.tsx:33-41` | Med | Low | 30m | todo | none — T1 and T2 both shipped |
| T11 | Hoist `<Suspense>` outside keyed `motion.div` | `App.tsx:134-147` | Med | Low-Med | 1h | todo | — |
| T12 | Characterization tests for the untested half | new `tests/*.spec.ts`, mobile project | High (enabler) | Low | 12-16h | todo | — |
| T13 | Split context value: `FinanceActionsContext` + `FinanceStateContext`, shim `useFinance()` | `FinanceContext.tsx:1498-1572` | High | Med | 4h | todo | T1 recommended first |
| T14 | Migrate 16 consumers off the shim; delete shim | 16 `useFinance()` sites | High | Med | 4h | todo | T13, T12 |
| T16 | Batched localStorage writer + `pagehide`/`visibilitychange` flush | `FinanceContext.tsx:390-413` | High | Med | 3h | todo | — |
| T21 | Local-calendar correctness: compare ISO strings, not `Date` objects | `DashboardView.tsx:82,87,88,92,95,150`, `WalletsView.tsx:117`, `SecurityView.tsx:282` | Med | Med | 2h | todo | new frozen-clock spec |
| T22 | One `<Modal>` primitive; convert 9 sites | 9 modal sites (see audit-report §E) | Med | Med | 6h | todo | T12 |
| T24 | Promote `walletFormStyles.ts`; adopt across ~12 files | `walletFormStyles.ts` + 10 consumers | Med | Med | 6h | todo | T12 |
| T26 | Shared `buildLookupMap` helper | 7 independent map-building copies | Low-Med | Low | 2h | todo | T12 |
| T27 | `useSubmitHandler`, `useIdempotencyKey`, `useTransientFlash` | 6 duplicate submit shapes, 3 duplicate amount callbacks, 7 flash timeouts | Med | Med | 5h | todo | T12 |
| T29 | Fix `useDebts` returning unfiltered `wallets` | `useDebts.ts:84`, `DebtsView.tsx:29,313-314` | Med (correctness) | Med | 1h | todo | T12 debts spec |
| T15 | Ref-mirror the 7 volatile mutators, one per commit | `FinanceContext.tsx:855,1154,1214,1378,1420` | Med-High | High | 6h | todo | T12 mandatory |
| T17 | Realtime: debounce, `user_id` filter, suppress self-echo | `FinanceContext.tsx:132,658-677` | High | High | 4h | todo | manual 2-device checklist |
| T25 | Unify the 4 transaction-row renderers | see audit-report §E | Med | High | 8h | todo | consider dropping — see plan traps §19 |
| T18 | `Promise.all` the bulk-import wallet updates | `FinanceContext.tsx:1305-1312` | Low-Med | Med | 1h | todo | T12 CSV spec |
| T30 | Promote constraints into `CLAUDE.md` | `CLAUDE.md`, `constraints-to-promote.md` | Med | Low | 2h | todo | drains after each task above ships |

## Not a task — explicitly out of scope this pass

`tsconfig.json` `strict` mode, ESLint/Prettier, Vitest, React Compiler, `rollup-plugin-visualizer`, a second state library, merging `roundToCents`/`roundToTwoDecimals`, mass-rewriting imports to adopt `@/*`, unifying/removing `AnimatedCounter`'s currency exemption without ADR `0004`. See the plan's "Non-goals and traps" section for the full list and reasoning.
