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

**Post-T24/T26/T27 checkpoint (final audit, 2026-09-19, commit `8168d10`):** the entry chunk this row records (165.39 kB) is T7's own figure and is left unedited per this file's "never rewrite a column" rule. Re-measured as part of the final end-to-end audit, the entry chunk is now **169.08 kB raw / 47.39 kB gzip** (+3.69 kB, +2.2%, from Phase 3's 165.39 kB) — the expected footprint of the new app-code modules T26/T27/T24 added (`useSubmitHandler.ts`, `useIdempotencyKey.ts`, `useTransientFlash.ts`, `mapUtils.ts`, `formStyles.ts`) landing in the eagerly-loaded entry tree rather than a vendor chunk. Still 0 chunks over Vite's 500 kB warning threshold, and every lazy view chunk that adopted T24/T26 actually *shrank* (`DebtsView` −37.6%, `WalletsView` −35.0%, `SecurityView` −9.1%, `TransactionsView` −8.7%, `KeywordRulesView` −9.2%). Full breakdown and per-chunk deltas: `docs/audit/baseline-metrics.md`'s "Post-T24/T26/T27 full chunk breakdown" section.

**Notes on execution:**
- Implemented as a `manualChunks(id)` function (not the object-shorthand form), matching on `node_modules/<pkg>/` substrings — this is what correctly captures `mathjs/number`'s subpath import and `lucide-react`'s deep per-icon module paths, which the object form (`{'vendor-x': ['pkg-name']}`) would miss.
- Folded each vendor's own runtime-only dependencies into its group rather than leaving them to Rollup's default chunking: `scheduler` (react-dom's dependency) → `vendor-react`; `motion-dom`, `motion-utils`, `tslib` (framer-motion's dependencies — confirmed via `grep -rl tslib node_modules/*/package.json` that no other *runtime* dependency in this project pulls in `tslib`) → `vendor-motion`. `@supabase/supabase-js`'s five `@supabase/*` sub-packages (`postgrest-js`, `realtime-js`, `functions-js`, `storage-js`, `auth-js`) are covered automatically by the `node_modules/@supabase/` prefix match.
- Verified the split actually wires up at runtime, not just at build time: booted `vite preview` against the real production build, confirmed HTTP 200, and grepped the served entry chunk for references to all 5 vendor chunk filenames — all present.
- One Firefox test (`diary.spec.ts`) failed on `#view-loading-fallback` timing out on the first full-suite run, then passed both in isolation and on a full clean re-run. This is the known dev-server flakiness `CLAUDE.md`/`playwright.config.ts` already document generous Firefox timeouts for — and structurally cannot be caused by this change, since `build.rollupOptions` only applies to `vite build`, never to `vite dev`, which is what the Playwright `webServer` runs.
- `DISABLE_HMR` / `server.hmr` / `server.watch` block untouched, as required. PWA plugin config, manifest, and workbox caching rules untouched. No `@/*` alias re-added.

## Phase 4 — DiaryView memoization (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T8 | Memoize `DiaryView`; hoist `formatDayInfo` into `date.ts`; kill per-entry filters | `date.ts`, `DiaryView.tsx`, new `src/components/DiaryEntryCard.tsx` | High | Low | 3h | done | — | c9d4f26 | tsc clean; `diary.spec.ts` 3/3 (all browsers, Firefox at normal ~9.5s, no timing regression); 39/39 full suite; build succeeds | `activeEntries` filter+sort, `formatDayInfo`, and the per-entry outflow filter no longer recompute on every DiaryView render (e.g. every notes/workout keystroke) — only when `diaryEntries`/`transactions` actually change. Each entry row is now a `React.memo`'d `DiaryEntryCard` receiving referentially-stable props, so unaffected rows skip re-rendering entirely on unrelated state changes |

**Notes on execution:**
- `formatDayInfo` hoisted into `src/utils/date.ts` verbatim in its date-math (`new Date(year, month-1, day)` local-midnight construction, never `new Date(dateStr)`) — no UTC-shift risk introduced. Signature extended to accept optional `todayStr`/`yesterdayStr` parameters (defaulting to fresh `todayIsoDate()`/`daysAgoIsoDate(1)` calls) so callers formatting many dates in a loop compute "today" once instead of once per date — this is what actually kills the "N `formatDayInfo` calls per render" cost, not just moving the function to a new file.
- `moodLabels` (a fully static object, no component-state dependency) hoisted to a module-level `MOOD_LABELS` constant instead of being recreated — or even `useMemo`'d — every render.
- Added a stable module-level `EMPTY_DAY_DATA` constant replacing the inline `|| { totalOutflow: 0, totalIncome: 0, transactions: [] }` fallback literal (created fresh every access) at both the selected-date lookup and the per-entry lookup — a day with zero transactions now gets the *same* object reference every time, which matters for `DiaryEntryCard`'s `React.memo` to actually bail correctly on those rows.
- New `enrichedEntries` `useMemo` (deps: `[activeEntries, dailyTransactionsMap, todayIso, yesterdayIso]`) precomputes `dayInfo`/`dayData`/`outflowTxs`/`moodInfo` once per entry, once per actual data change — this is the fix for the O(entries × transactionsPerDay) work that previously ran inline in the JSX `.map()` on every render.
- Extracted the per-entry card markup into `src/components/DiaryEntryCard.tsx`, wrapped in `React.memo`. Its `onToggleExpand`/`onDelete` props are stable `useCallback`s from the parent (`handleToggleExpand`, `handleDeleteEntry`) that take the entry id as an argument, rather than the previous per-row inline arrow closures (`onClick={() => deleteDiaryEntry(entry.id)}`) — inline closures are a fresh function reference every render and would have defeated `React.memo` immediately regardless of how stable the other props were.
- Also memoized `selectedDayInfo` and `selectedDateOutflowCount` (the selected-date summary box), flagged in the audit at `DiaryView.tsx:140,203` in the pre-T8 file — smaller wins than the list, but same class of unnecessary per-keystroke recompute.
- `deleteDiaryEntry` (used inside `handleDeleteEntry`) is one of the context's stable actions (deps `[isAuthenticated]` only, per audit correction C1), so `handleDeleteEntry`'s own identity is stable across the whole session except around login/logout.

## Phase 5 — inline filter/computation memoization (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T9 | Memoize inline filters passed as props | `TransactionForm.tsx`, `WalletsView.tsx`, `KeywordRulesView.tsx`, `TransactionsView.tsx` | Med-High | Low | 2h | done | — | 58e460d | tsc clean; 39/39 Playwright; build succeeds | Each target recompute now gated on its actual dependency instead of running on every render of its parent — see notes for per-site detail |

**Notes on execution:**
- `TransactionForm.tsx:37` — `activeDebts` (`debts.filter(!isDeleted && !isSettled)`) wrapped in `React.useMemo([debts])`, matching the file's existing style of qualifying hooks as `React.useCallback`/`React.useEffect` rather than adding more named imports.
- `TransactionForm.tsx:306-307` — the inline `wallets.filter((w) => w.id !== walletId)` built fresh inside the destination-wallet `<select>` JSX on every render was hoisted to a `destinationWalletOptions` `React.useMemo([wallets, walletId])` above the `return`, then the JSX maps over the memoized array directly.
- `WalletsView.tsx:22` — `activeWallets` wrapped in `useMemo([wallets])`. This single memo covers both of its consumers: the wallet cards grid map and the `wallets={activeWallets}` prop passed to `WalletTransferForm` at the former line 218 — no second edit was needed there once the source memo existed.
- `KeywordRulesView.tsx:17` — `matchResult` (a `matchSmartDescription(...)` call, not a filter, but the same "recomputes every render regardless of whether its inputs changed" problem) wrapped in `useMemo([testInput, keywordRules, categories])`.
- `KeywordRulesView.tsx:34` — `categoryMap` (`new Map(categories.map(...))`) wrapped in `useMemo([categories])`.
- `TransactionsView.tsx:400-401` — the two inline `wallets.filter(!isDeleted)` / `categories.filter(!isDeleted)` calls built fresh inside the Add Transaction modal's JSX on every `TransactionsView` render were hoisted to `activeWalletsForForm`/`activeCategoriesForForm` `useMemo`s (`useMemo`/`useCallback` were already imported in this file) placed beside the existing `walletMap`/`categoryMap` memos.
- **On the ledger's prior "KeywordRulesView slice needs T12" blocker:** re-assessed and not applicable here. T9 is a pure memoization pass — each memoized value is referentially transparent (same inputs, same output as the unmemoized inline expression it replaces), so it cannot change `KeywordRulesView`'s behavior, only when the computation re-runs. That blocker note was written for the class of task that *changes* what's rendered (T22 modal consolidation, T24 style adoption, etc.), not for caching an existing pure computation. Verified by full-suite pass with no test changes.
- No `React.memo` wrappers were added to `TransactionForm`, `WalletsView`, or `KeywordRulesView` themselves — out of scope per the task's own file/line list, which targets only the inline computations, not the components receiving them.

## Phase 6 — nav hoisting and Suspense boundary restructure (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T10 | Hoist `navItems` to module scope; evaluate memoizing `Navbar` | `Navbar.tsx`, `MobileBottomNav.tsx` | Med | Low | 30m | **partial** | — | 1c4c7e7 | tsc clean; 39/39 Playwright; build succeeds | `navItems` no longer reallocated (array + 7 object literals) on every render of either component. `Navbar` deliberately **not** wrapped in `React.memo` — see note below |
| T11 | Hoist `<Suspense>` outside the keyed `motion.div` | `App.tsx` | Med | Low-Med | 1h | done | — | 1c4c7e7 | tsc clean; 39/39 Playwright (Firefox tab-cycling test additionally repeated 3x in isolation — no flakes); build succeeds | Single persistent `Suspense` boundary spans tab transitions instead of one being freshly constructed per `activeTab` key |

**Notes on execution:**
- `Navbar.tsx` — `navItems` hoisted to a module-level `NAV_ITEMS: NavItemConfig[]` constant (new `NavItemConfig` interface added for it, matching the pattern already used in `MobileBottomNav.tsx`). It held only static labels/ids/icon references with no dependency on props or state, so the hoist is behavior-neutral.
- `MobileBottomNav.tsx` — same hoist; the file already had a `NavItemConfig` interface at module scope, so the array now uses it directly as `NAV_ITEMS`.
- **`Navbar` was deliberately NOT wrapped in `React.memo`.** It calls `useFinance()` directly (`totalNetWorth`, `isAuthenticated`, `isSyncing`, `currentUser`, `signOut`) and `useTheme()`. Per audit correction C3 and the plan's guardrail #9 ("Never `React.memo` a context subscriber — cut the subscription first, memo second"), memoizing a component that still subscribes to context directly cannot stop it from re-rendering on every write, since a context-value change forces a re-render of every consumer independent of `React.memo`'s props comparison — React only lets `memo` skip renders triggered by an *unchanged-props parent re-render*, never ones triggered by the component's own hook subscriptions. The narrow win memo would still offer here (skipping `Navbar`'s re-render when `MainApp` re-renders for an unrelated UI-only reason, e.g. `isAuthModalOpen` toggling, without a concurrent financial write) was judged not worth adding now, since it would look like the subscription problem is "handled" when it structurally is not — the ledger's own original text for this task said "memo `Navbar` after subscription cut," and that cut (extracting the net-worth/sync-badge/auth sections into self-subscribing pieces, the same pattern T1 used for the quick-add modal) hasn't happened. Left as a precondition for a future task rather than done partially here.
- `App.tsx` — `<Suspense fallback={<ViewLoadingFallback />}>` moved to wrap `<AnimatePresence mode="wait" custom={direction}>` (previously it was nested inside the keyed `<motion.div>`, wrapping only `{renderActiveView()}`). One `Suspense` boundary now persists across the whole tab-cycling lifecycle instead of being torn down and reconstructed as a fresh fiber every time `activeTab` changes the `motion.div`'s `key`.
- Given this task's own stated guardrail flagged `tests/helpers.ts:gotoTab`'s `#view-loading-fallback` assertion as "the assertion most at risk," it was verified beyond the standard single full-suite pass: the Firefox project's `theme.spec.ts:47` (the 7-tab desktop-navbar cycling test) was additionally re-run 3 times in isolation (`--repeat-each=3`) after the full suite already passed once, specifically to rule out a race between the reordered Suspense boundary and Firefox's slower lazy-chunk fetch under the dev server. All repeats passed with times consistent with the pre-change baseline (~8-10s).

## Phase 7 — characterization tests for the untested half (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T12 | Characterization tests for the untested half | new `tests/debts.spec.ts`, `soft-delete.spec.ts`, `keywords.spec.ts`, `csv.spec.ts`, `auth.spec.ts`; `AuthModal.tsx` (id attributes only) | High (enabler) | Low | 12-16h | **partial** | — | 7f0c5b1 | tsc clean; 75/75 Playwright (39 pre-existing + 12 new × 3 browsers = 36); build succeeds | 5 new spec files, 12 new test cases, covering debt repayment/settlement, soft-delete across 3 entities, keyword auto-matching, CSV round-trip, and auth modal UI/validation — all previously uncovered. Mobile project still not added — see notes |

**Notes on execution:**
- **`tests/debts.spec.ts`** — one end-to-end test: create a debt (accepting the form's own defaults: ฿5,000 total/remaining, 4.5% APR, ฿200 minimum), a partial ฿1,000 repayment asserting the progress bar reads exactly `20.0%` and remaining `฿4,000.00`, then a second ฿4,000 repayment that exhausts the balance and pins the auto-settle behavior in `FinanceContext.tsx`'s local-fallback branch (`isSettled: newRem === 0`) — the card's repay/settle buttons disappear and the "✓ Debt Fully Settled" state renders.
- **`tests/soft-delete.spec.ts`** — three tests, one per entity with a delete action in the UI. The transaction case is the fullest: delete → confirm exclusion from the default view → toggle `#tx-show-deleted` on → confirm the row reappears flagged `[Soft Deleted]` with a restore button instead of delete → restore → confirm the flag clears. Wallets and debts have no "show deleted" toggle in their views, so those two cases instead verify the omission survives a `page.reload()` — proving the flag persisted to storage rather than just being filtered out of the current render.
- **`tests/keywords.spec.ts`** — one test drives the sandbox with the default seeded `coffee` → `Food & Dining` rule (`250 coffee with friends` → extracted amount ฿250.00, matched category, inferred type EXPENSE, cleaned description) with no setup needed; a second test adds a brand-new rule via the form, confirms it lands in the configured-rules table, then immediately re-drives the sandbox with the new keyword to prove the write is live in state with no round-trip delay (Local Storage Mode).
- **`tests/csv.spec.ts`** — one round-trip test: seed a transaction, export it via `#tx-export-csv-btn` (captured with `page.waitForEvent('download')`, read from disk), feed that exact file back into `#csv-file-input`, and confirm the importer accepts it as a valid row and commits a second, genuinely new transaction (marker text now appears twice). This is the one path in the app with zero prior coverage — a header or date-format drift between `exportTransactionsToCsv` and `parseAndValidateTransactionCsv` would otherwise only surface in production as a silent "0 valid rows". Verified as working identically in all three browser engines, including the Blob-URL-download mechanic in WebKit.
- **`tests/auth.spec.ts`** — required adding `id` attributes to `AuthModal.tsx` first (it had none), scoped strictly to the fields/buttons needed for targeting: `auth-email-input`, `auth-password-input`, `auth-name-input`, `auth-submit-btn`, `auth-tab-signin`/`auth-tab-signup`, `auth-forgot-password-link`, `auth-back-to-signin-link`, `auth-close-btn`. **Finding surfaced during design, not fixed:** `handleAuth` checks `isSupabaseConfigured` before its own Zod validation runs, and this repo's local `.env` has real (demo-project) Supabase credentials configured, while `playwright.yml` never sets those secrets in CI — so the network-call branch and the "Cloud sync is not configured" branch fire in different environments for the exact same test run. To stay deterministic in both, the spec deliberately never submits a syntactically valid credential pair; it covers modal open/close, mode switching (signin/signup/forgot), and native HTML5 constraint validation (email format via `el.validity.valid`, password `minLength`) — all of which resolve before `handleAuth` ever runs, in either environment.
- **Mobile project not added.** The original T12 scope text included "mobile project" as a target; this pass added only the five spec files and the `AuthModal` ids. Extending `playwright.config.ts` with a mobile viewport project is a separate, broader change (would need every existing spec re-verified against it, not just the 5 new files) and wasn't part of this task's explicit instructions. Left as a follow-on, noted here rather than silently dropped.
- All 5 new files follow the existing conventions: `gotoTab`/`addQuickTransaction` from `helpers.ts`, no `page.waitForTimeout`, no `isVisible()` guards — every assertion is an auto-retrying `expect(...)`.

## Phase 8 — FinanceContext value split (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T13 | Split context value: `FinanceActionsContext` + `FinanceStateContext`, shim `useFinance()` | `FinanceContext.tsx` (only file touched, +133/-52) | High | Med | 4h | done | — | 8c3ad78 | tsc clean (`src/` + `tests/`); 75/75 Playwright; build succeeds in 19.5s | One 33-member context value → two: 19-member state (`FinanceStateContextType:46`) + 14-member actions (`FinanceActionsContextType:98`). Zero consumer files modified — all 16 `useFinance()` call sites unchanged |

**Notes on execution:**
- **Split per ADR 0001 option (b), not (a).** One `FinanceProvider`, two `createContext` calls nested inside it (`FinanceContext.tsx:134-135`). No provider-per-domain, no new module, no new import edge — the file's imports are byte-identical to before, so the acyclic DAG property `audit-report.md` records is preserved by construction.
- **Membership follows correction C1's volatility classification, verified against the live dep arrays rather than taken from the ADR on trust.** `FinanceStateContextType` (`:46`) holds the 13 state members plus the 6 exposed volatile mutators — `addTransaction` (deps `[wallets, transactions, debts, categories, currentUser.id, isAuthenticated]`), `softDeleteTransaction`/`restoreTransaction` (both derived from `setTransactionDeleted`, deps `[transactions, isAuthenticated]`), `commitBulkImport` (`[wallets, categories, …]`), `repayDebtAtomic` (`[debts, wallets, categories, addTransaction]`), and `upsertDiaryEntry` (`[isAuthenticated, diaryEntries, …]`). `FinanceActionsContextType` (`:98`) holds the 14 stable ones, every dep array of which is `[]`, `[isAuthenticated]`, or `[currentUser.id]` — including `deleteWallet` (deps `[updateWallet]`, itself `[isAuthenticated]`) and `refreshFromCloud` (deps `[currentUser.id, loadSupabaseData]`, the latter `[]`).
- **`FinanceContextType` survives as `extends FinanceStateContextType, FinanceActionsContextType`** (`:132`). It is still exported and still structurally identical to the pre-split interface, so anything typed against it — today nothing outside this file, but it is public API — sees no change.
- **Provider nesting order is deliberate:** actions outside, state inside (`:1622-1626`). The rarely-changing value sits nearer the root, so the state provider re-rendering cannot invalidate it.
- **`useFinance()` memoizes its merge** (`:1659`). A plain `{ ...state, ...actions }` would hand every one of the 16 current consumers a fresh object identity on *every* render, which is strictly worse than the single memoized value they had before the split. The `useMemo([state, actions])` keeps the pre-split stability guarantee exactly.
- **No ref-mirroring performed.** T15's scope, explicitly untouched here — the 6 volatile mutators stay in the state context and stay volatile.

## Phase 9 — consumer migration and shim retirement (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T14 | Migrate consumers off the `useFinance()` shim; delete the shim | 15 consumer files + `FinanceContext.tsx` (+58/-69) | High | Med | 4h | done | T13 (done), T12 (done) | 36c4d7e | tsc clean; `CI=true npx playwright test` 75/75, 0 retries; build succeeds in 6.4s | 15 shim call sites -> 0, `useFinance()` and `FinanceContextType` deleted. Consumers on both halves 15 -> 8; `AddWalletForm` now actions-only and insulated from ledger writes |

**Notes on execution:**
- **15 call sites, not the 16 recorded in ADR `0001` and the old T14 row.** Verified against the split commit: `git grep -c "= useFinance()" 8c3ad78 -- src/` returns 15 in 15 files. The 16th was the comment at `App.tsx:61` noting that `MainApp` deliberately does not subscribe.
- **Only one consumer turned out to be actions-only.** `AddWalletForm` (`:53`). The brief also listed `WalletTransferForm` and `SecurityView` as instant wins; neither is. `WalletTransferForm` needs `addTransaction`, a volatile mutator still held in the state context until T15, and `SecurityView` reads five state members alongside its four actions.
- **Three names in the brief's consumer list never called the shim** - `DebtsView`, `AuthModal`, `WalletAccountsGrid` - and two real consumers were missing from it: `TransactionForm.tsx` and `WalletsView.tsx`. Both are migrated.
- **`FinanceContextType` was deleted along with the hook.** Its own Phase 8 note recorded it as public API, but a repo-wide grep shows the shim's return type was its only reference; keeping an exported union with no provider to satisfy it would have been dead surface.
- **Mixed consumers take two destructures, not one merged object.** Re-merging state and actions locally would reintroduce exactly the identity churn the split removes.
- **Firefox flake recorded, not dismissed.** Multi-worker local runs failed one Firefox test per run, a different one each time, always a `locator.click` that hung after the element was reported stable. Isolated re-runs pass 3/3 and the single-worker CI-mode run is 75/75. Full detail, including the fact that the parent commit did not flake under the same command, is in `refactor-log.md` Phase 9.

## Phase 10 — ref-mirror volatile mutators (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T15 | Ref-mirror the 6 volatile mutators into `FinanceActionsContext`, one/small-batch per step | `FinanceContext.tsx` + 7 consumer files | Med-High | High | 6h | done | T12 (done), T13 (done), T14 (done) | c1740d6 | tsc clean; `CI=true npx playwright test` 75/75, 0 retries; `transaction`/`debts`/`diary`/`soft-delete` specs 27/27 across all 3 browsers; build succeeds in 5.7s | 6 volatile mutators moved `FinanceStateContextType` -> `FinanceActionsContextType`; `actionsValue` 14 -> 20 members; `WalletTransferForm` joins `AddWalletForm` as fully insulated from ledger writes |

**Notes on execution:**
- **"7 volatile mutators" in ADR `0001` counts the internal `setTransactionDeleted` helper alongside the 6 it exposes.** Only `addTransaction`, `softDeleteTransaction`, `restoreTransaction`, `commitBulkImport`, `repayDebtAtomic`, and `upsertDiaryEntry` are members of `FinanceStateContextType`/`FinanceActionsContextType`; `setTransactionDeleted` (`FinanceContext.tsx:1180`) is the shared implementation behind the first two and was ref-mirrored as part of that step, not as a separate one. Six mutators moved contexts; a seventh internal `useCallback` was also stabilised along the way.
- **Ref mirrors follow the file's own precedent.** `loadSupabaseDataRef` (`:455`, `:627`) already used `useEffect(() => { ref.current = value }, [value])` to break a dependency cycle between `loadSupabaseData` and `seedInitialUserAccount`. The five new refs (`walletsRef`, `transactionsRef`, `debtsRef`, `categoriesRef`, `diaryEntriesRef`) use the identical pattern, so the technique was not new to this codebase, only new in how many places it is used.
- **Sequencing followed the ADR exactly:** `setTransactionDeleted` first (simplest, single ref), then `commitBulkImport`, then `upsertDiaryEntry`, then `addTransaction` (the 3-slice rollback), then `repayDebtAtomic` last, because it calls `addTransaction` and could not stabilise until `addTransaction` itself had.
- **`addTransaction`'s optimistic-rollback snapshot was rewritten, not removed.** `previousWallets`/`previousDebts`/`previousTransactions` now read `walletsRef.current`/`debtsRef.current`/`transactionsRef.current` instead of the closured `wallets`/`debts`/`transactions`. Both are the committed-state value at the instant the function starts running; the ref read is not weaker, only the mechanism by which the callback stays current without being rebuilt on every state change.
- **One additional consumer became actions-only that the ADR did not name:** `WalletTransferForm`. T14's log recorded it as blocked on this exact task; this is the commit that unblocks it.
- **Seven consumer files touched**, not just the context: `QuickAddModal.tsx`, `WalletPopupModal.tsx`, `WalletTransferForm.tsx`, `useDebts.ts`, `useTransactions.ts`, `DashboardView.tsx`, `DiaryView.tsx`. Each split its destructure so the migrated mutator(s) come from `useFinanceActions()` while any remaining state reads stay on `useFinanceState()`.

## Phase 11 — local-calendar date comparisons (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T21 | Local-calendar correctness: compare ISO strings, not `Date` objects | `DashboardView.tsx`, `WalletsView.tsx`; `SecurityView.tsx` audited (no change) | Med | Med | 2h | done | new frozen-clock spec | e8d5236 | tsc clean; `CI=true npx playwright test` 81/81 (75 existing + 6 new), 0 retries; build succeeds in 5.8s | 3 UTC-anchored `Date` comparisons/parses replaced with local-calendar-string comparisons; 1 new spec file, both cases falsification-checked against pre-fix source |

**Notes on execution:**
- **Two distinct bug shapes, one root cause.** `DashboardView`'s `WEEK`/`MONTH` cutoff mixed a real elapsed-time epoch threshold with a UTC-midnight-parsed `Date`; `WalletsView`'s "Created" label sliced the UTC portion of a full ISO instant. Both are "constructed or read a `Date` in UTC terms where a local calendar day was needed" - fixed by never doing so, only comparing same-format ISO date strings directly or reading a `Date`'s local getters.
- **The `WEEK`/`MONTH` bug's failure window is the opposite of the canonical midnight-to-dawn one.** It manifests once local time-of-day passes 07:00 (UTC+7's offset), not during 00:00-06:59 - see the new spec's comments for the derivation. Both boundary conditions are covered: the wallet-creation spec pins 02:15 local (the canonical dawn window), the week-filter spec pins 15:00 local (where the DashboardView bug actually reproduces).
- **`SecurityView.tsx:282` audited, not changed.** Its `new Date(sess.lastActiveAt).toLocaleTimeString(...)` is a correct display of a full ISO instant's local time-of-day, exactly the pattern CLAUDE.md sanctions for `createdAt`/`updatedAt`-style fields. No calendar-day comparison exists anywhere in the file.
- **Both new tests were falsification-checked**, not just run green: each was run once against the pre-fix source (via `git stash` of just the two changed view files) to confirm it fails with the predicted wrong value, then re-run against the fix to confirm it passes. This is recorded in `refactor-log.md` Phase 11 rather than only asserted.
- **`page.clock.setFixedTime` + `test.use({ timezoneId: 'Asia/Bangkok' })`, not a component-level clock mock.** Freezing time at the Playwright/browser-context level (available since Playwright 1.45; this repo runs 1.63) exercises the real app code path end-to-end, including `new Date()` calls at module-eval time (`DEFAULT_STARTER_WALLETS`), without adding any test-only seam to production code.

## Phase 12 — batched localStorage writer (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T16 | Batched localStorage writer + `pagehide`/`visibilitychange` flush | `FinanceContext.tsx:390-413` (pre-change line numbers) | High | Med | 3h | done | — | 97ac7b4 | tsc clean; `CI=true npx playwright test` 87/87 (81 existing + 6 new), 0 retries; build succeeds in 5.1s | 8 independent per-slice `localStorage.setItem` effects collapsed into 1 debounced (250ms) writer keyed by a `pendingWritesRef` map; 1 new spec file (2 tests), both proven non-racy against the debounce window |

**Notes on execution:**
- **Per ADR 0003 option (b), exactly.** One `pendingWritesRef: Map<string, unknown>` collects dirty keys; a single `writeTimerRef` debounces the flush at 250ms; `flushPendingWrites` (stable, `useCallback([])`) is the one function that ever calls `localStorage.setItem`, invoked either by the debounce timer or synchronously by the lifecycle listeners.
- **Mount-skip guard uses effect declaration order, not a second render pass.** A single `didMountRef` is read (not written) by all 8 write-trigger effects, each guarded `if (didMountRef.current) scheduleStorageWrite(...)`; the effect that sets it `true` is declared immediately after all 8, so on the initial mount commit React runs the 8 guarded effects first (each seeing `false` and skipping) before the mount-flag effect runs — no `useEffect` reordering risk, no second commit needed.
- **`visibilitychange` and `pagehide` are both wired, not just one.** `pagehide` alone would miss a tab put to the background without navigating away or closing (the common mobile-PWA case); `visibilitychange`'s `hidden` state fires there and is also more reliable than `pagehide` on iOS Safari. Both call the same `flushPendingWrites`, which is idempotent (an empty pending map is a no-op), so double-firing both on an actual page unload is harmless.
- **Cleanup flushes, not just removes listeners.** The lifecycle effect's cleanup calls `flushPendingWrites()` in addition to removing both listeners, so a `FinanceProvider` unmount (not expected in normal app operation, but exercised implicitly by Playwright's per-test fresh context teardown) cannot strand a debounced write unflushed.
- **Verification spec avoids the debounce race entirely rather than tuning a timeout against it.** `tests/storage-persistence.spec.ts`'s first test overrides `document.visibilityState` and dispatches `visibilitychange`, then reads `localStorage` back inside the *same* `page.evaluate` call — since `dispatchEvent` invokes listeners synchronously, this cannot pass just because the 250ms timer happened to fire first; there is no wait to race. The second test reloads the page immediately after a write and asserts the data survived, exercising the real browser-native `pagehide` a navigation fires.

## Phase 13 — Supabase realtime sync hardening (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T17 | Realtime: debounce, `user_id` filter, suppress self-echo | `FinanceContext.tsx` (realtime subscription effect + ~13 mutator call sites) | High | High | 4h | done (automated gates only — see notes) | manual 2-device checklist | 0f67edc | tsc clean; `CI=true npx playwright test` 87/87, 0 retries; build succeeds in 5.1s | Realtime channel now filters by `user_id`, debounces reloads 400ms, and suppresses self-authored echoes for every mutator that learns its row id; see refactor-log.md Phase 13 for the manual 2-device checklist and the structural before/after of `loadSupabaseData` invocation patterns |

**Notes on execution:**
- **"Done" here covers the code change and the automated gates only.** ADR 0003 states plainly that T17 has no automated regression path — every Playwright spec runs against the unauthenticated localStorage fallback, never against a real Supabase realtime channel — so the 87/87 pass proves the offline-first path and optimistic-rollback mechanics are undisturbed, not that the realtime hardening behaves correctly under real cross-device load. That requires the manual 2-device checklist in `refactor-log.md`, which needs two live sessions signed into the same Supabase account and has **not** been executed in this session (no second device/account available here). Left as an explicit follow-up for whoever runs it, per the checklist's own steps.
- **`keyword_rules` was deliberately left out of the self-echo instrumentation.** It is not a member of `SYNCED_TABLES` (`wallets`, `transactions`, `debts`, `diary_entries`, `categories` only) — no realtime channel listens to it at all, so marking its writes into `recentLocalWriteIds` would be dead code with nothing to ever consume it.
- **`commitBulkImport`'s inserted transaction ids are not suppressible.** Its batch `insert(dbPayloads)` has no `.select()`, so the server-generated ids are never learned client-side. Documented inline at the call site rather than silently accepted — the 400ms debounce still collapses that burst into at most one extra reload (on top of the function's own explicit `refreshFromCloud()`) instead of one per inserted row, which is the ADR's actual target metric.
- **`upsertDiaryEntry`'s insert branch gained `.select().single()`** (it previously fired-and-forgot) specifically so its newly-created row's id could be captured and marked — a small, additive change, not a behavior change to what gets persisted.
- **`user_id` column existence verified against the client's own code, not a schema migration** — this repo has no tracked schema file (`supabase/migrations/20260909_transfer_funds.sql`'s own header says so explicitly). Every one of the 5 `SYNCED_TABLES`' row-mapping functions (`mapWalletRow`, `mapTransactionRow`, `mapDebtRow`, plus the inline `categories`/`diary_entries` mappings in `loadSupabaseData`) already reads `row.user_id`, which is the available evidence that the column exists and is populated on all five.

## Phase 14 — `useDebts` wallet-filtering fix (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T29 | Fix `useDebts` returning unfiltered `wallets` | `useDebts.ts`, `DebtsView.tsx` | Med (correctness) | Med | 1h | done | T12 debts spec (done) | 7a7e5a4 | tsc clean; `CI=true npx playwright test tests/debts.spec.ts` 3/3; `CI=true npx playwright test` 87/87, 0 retries; build succeeds in 8.95s | `useDebts` now returns `wallets: activeWallets` + `allWallets: wallets`, matching `useWallets`' exact shape; `DebtsView`'s redundant inline `.filter(!isDeleted)` on the `<select>` options removed (the array it maps is already filtered) |

**Notes on execution:**
- **The real bug was the initial `selectedWalletId`, not the dropdown options.** `DebtsView.tsx`'s `<select>` already had its own inline `.filter((w) => !w.isDeleted)` on the rendered `<option>`s, so a soft-deleted wallet never appeared as a choice. But `useState<string>(wallets[0]?.id || '')` (line 29) read the *unfiltered* array from the hook — if a soft-deleted wallet happened to sort first (wallets are ordered by `created_at` ascending, so an early-created-then-later-deleted wallet easily lands at index 0), the repay modal's default selected value pointed at an id with no matching `<option>` in the actually-rendered list. A controlled `<select>` whose `value` matches no option renders with nothing visibly selected, which is exactly the kind of small state/UI mismatch that's easy to miss in manual testing but breaks the "form defaults are always valid" invariant every other form in this codebase relies on.
- **Fix at the hook, not the view.** Matching `useWallets`' own shape (`wallets: activeOnly`, `allWallets: everything`) means any other view that starts consuming `useDebts()`'s wallets in the future inherits the same correct-by-default filtering, rather than needing to remember to filter locally the way `DebtsView` previously did.
- **`allWallets` is exposed but currently unconsumed.** `DebtsView.tsx` and `DashboardView.tsx` (the only two `useDebts()` call sites) have no need to resolve a soft-deleted wallet's historical name today — `DebtCardItem` doesn't reference wallets at all. Exposed anyway for shape-parity with `useWallets` and because a future debt-history view resolving a repayment's source wallet name (including a since-deleted one) is a realistic need, per the same reasoning `useWallets` itself documents for `allWallets`.
- **`tests/debts.spec.ts`'s own comment already anticipated this exact task** ("pin that behavior before... T29's wallet-filtering fix touches this view") — the spec needed no changes; it exercises the repay flow through the default first wallet, which is unaffected by the fix since this checkout's seeded wallets are all active.

## Phase 15 — unified `<Modal>` primitive (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T22 | One `<Modal>` primitive; convert 9 sites | new `Modal.tsx`; `QuickAddModal.tsx`, `AuthModal.tsx`, `WalletsView.tsx`, `DebtsView.tsx`, `TransactionsView.tsx`, `WalletPopupModal.tsx` | Med | Med | 6h | done | T12 (done) | 52f4f8a | tsc clean; `CI=true npx playwright test` 87/87 (3 browsers), 0 retries; build succeeds in 5.1s | 9 hand-rolled modal implementations across 6 files collapsed into 1 shared primitive; 6 files net -237 lines despite the new component; `WalletsView`/`DebtsView`/`TransactionsView` JS chunks each shrank (7.64→4.94 kB, 17.09→14.66 kB, 25.80→23.55 kB) |

**Notes on execution:**
- **Migrated in 3 batches, verified independently, per the task's own "2-3 modals per step" instruction:** (1) `QuickAddModal` + `AuthModal` — `auth.spec.ts` + `transaction.spec.ts`, 27/27; (2) `WalletsView` (Add Wallet, Transfer) + `DebtsView` (Add Debt, Repay) — `debts.spec.ts` + `wallet-forms.spec.ts` + `wallets.spec.ts`, 18/18; (3) `TransactionsView` (Add Transaction, CSV Import) + `WalletPopupModal` — `transaction.spec.ts` + `csv.spec.ts` + `soft-delete.spec.ts` + `keywords.spec.ts`, 30/30, then `wallet-forms.spec.ts` + `wallets.spec.ts` + `theme.spec.ts` again, 24/24, specifically to re-exercise `WalletPopupModal`'s open-sync behavior. Full 87/87 run only at the end.
- **`Modal.tsx`'s shape:** `isOpen`/`onClose` plus either `title`/`subtitle` (renders a standard header row + close button — used by 7 of 9 sites) or a `header` override slot for full custom chrome (`AuthModal`'s icon+title+subtitle row, `WalletPopupModal`'s icon+badge+subtitle row *and* its 4-tab navigation bar, both passed as one `header` node). `footer` exists as a thin optional slot per the task's explicit request, unused by any of the current 9 sites. `titleId` works independently of `title` so a custom `header`'s own heading can still be linked via `aria-labelledby`.
- **Panel layout changed from calc(vh − fixed px) to flexbox**, and this was a deliberate improvement, not just a port: `panel` is `flex flex-col … overflow-hidden`, `body` is `flex-1 overflow-y-auto`, so a sticky header with a scrollable body falls out of the flexbox model instead of each modal hand-computing `max-h-[calc(92vh-70px)]`/`max-h-[calc(90vh-80px)]` against its own header's actual height (fragile — QuickAddModal and the old Add Transaction modal each guessed a slightly different pixel offset). `WalletPopupModal`'s pre-existing structure (motion panel → non-scrolling header+tabs → `flex-1 overflow-y-auto` body) already matched this shape almost exactly, which is why it was the least invasive migration of the three "custom chrome" concerns despite being the most structurally complex modal in the app.
- **`WalletPopupModal`'s `if (!isOpen) return null` guard (line 90) was deliberately kept**, ahead of the `return <Modal ...>` call. Per this task's own caution and `CLAUDE.md`'s "`WalletPopupModal` never unmounts" gotcha (commit `39522bf`), the component instance itself must never be torn down by React so its hooks and the `useEffect`-driven `initialTab`/`initialWalletId` re-sync survive between opens. Keeping the early return preserves this exactly — by the time execution reaches `<Modal isOpen={isOpen} .../>`, `isOpen` is always `true`, so `Modal`'s own internal `AnimatePresence` never sees the closing transition for this particular modal; closing still happens by the parent's next render producing `null` again, identical to the pre-T22 behavior. This was a deliberate choice to keep the highest-risk migration behavior-neutral rather than also fix the (separate, pre-existing) lack of a close animation on this one modal.
- **Two genuine visual improvements, not migration regressions:** `DebtsView`'s two modals (Add Debt, Repay) and `TransactionsView`'s CSV Import modal previously had *no framer-motion animation at all* — plain conditionally-rendered `<div>`s, two using Tailwind's `animate-in fade-in slide-in-from-bottom-*` CSS utility classes for the entrance only (no exit animation), one (CSV Import) with no animation classes whatsoever and no mobile bottom-sheet responsiveness (`items-center` only, no `items-end sm:items-center`). All three now get the same backdrop-fade + spring-panel entrance *and* exit animation, and CSV Import gained the responsive mobile bottom-sheet layout, purely as a consequence of going through the shared primitive. This is the app becoming visually consistent, which is the explicit point of unifying "9 hand-rolled" modals — not a side effect to be undone.
- **Escape-to-close is new functionality, not a preserved behavior.** Grepped the pre-migration codebase for `Escape`/`keydown`/`onKeyDown` and found zero matches — none of the 9 hand-rolled modals wired a keyboard listener despite the task's own description implying it as an existing pattern. `Modal.tsx` adds one `document.addEventListener('keydown', …)` while `isOpen`, closing all 9 modals on Escape uniformly. Confirmed no spec in `tests/` references `Escape` before adding this, so it could not regress an existing assertion.
- **All existing test-targeted ids preserved exactly**, passed through via `Modal`'s `closeButtonId`/`panelId`/`titleId` props: `close-quick-record-modal-btn`, `auth-close-btn`, `close-wallet-modal-btn`, `close-add-transaction-modal-btn`, plus every id inside each modal's own body content (`new-wallet-name`, `repay-wallet-select`, `csv-file-input`, etc.), none of which lived in the extracted chrome to begin with.
- **`role="dialog"`/`aria-modal="true"`/`aria-labelledby` now apply uniformly to all 9 modals.** Previously only `QuickAddModal` and `TransactionsView`'s Add Transaction modal had these attributes at all; the other 7 had none. This is an accessibility improvement bundled into the consolidation, not a separate task.

## Phase 16 — shared map/form hooks (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T26 | Shared `buildLookupMap` helper | new `mapUtils.ts`; `DashboardView.tsx`, `DiaryView.tsx`, `smartMatcher.ts`, `KeywordRulesView.tsx`, `TransactionsView.tsx` | Low-Med | Low | 2h | done | T12 (done) | b72b8e9 | tsc clean; `CI=true npx playwright test` 87/87, 0 retries; build succeeds in 5.23s | 9 `new Map(items.map(x => [x.id, x]))` call sites across 5 files collapsed to one `buildLookupMap<T extends {id: string}>` generic |
| T27 | `useSubmitHandler`, `useIdempotencyKey`, `useTransientFlash` | new `useSubmitHandler.ts`, `useIdempotencyKey.ts`, `useTransientFlash.ts`; `AddWalletForm.tsx`, `WalletTransferForm.tsx`, `TransactionForm.tsx`, `DiaryView.tsx`, `KeywordRulesView.tsx`, `DebtsView.tsx`, `SecurityView.tsx`, `TransactionsView.tsx`, `WalletPopupModal.tsx` | Med | Med | 5h | done | T12 (done) | b72b8e9 | tsc clean; `CI=true npx playwright test` 87/87, 0 retries; build succeeds in 5.23s | 9 submit handlers across 7 files now share `useSubmitHandler`'s validate/mutate/error-or-reset shape; 2 idempotency keys (`WalletTransferForm`, `TransactionForm`) now share `useIdempotencyKey`'s arm-reuse-rotate lifecycle; 7 flash timeouts across 5 files now share `useTransientFlash`. 11 files touched net -46 lines despite 4 new hook/util files |

**Notes on execution:**
- **`buildLookupMap` only replaced the id -> full-item shape.** Two lookalikes were deliberately left alone: `useTransactions.ts:43,48` and `csvExchange.ts:10-11` build id -> *name string* maps (not id -> item), and `csvExchange.ts:83` keys by lowercased wallet *name*, not id — none match the generic's `Map<string, T>` contract, and forcing them through it would mean calling `.name` on the result at every use site for no reduction in duplication.
- **`useSubmitHandler` centralizes re-entrancy guarding and error surfacing, not each form's own field-reset logic.** Every caller still owns what "success" resets (`onSuccess` callback) - the hook only unifies `e.preventDefault()`, the in-flight guard, `setError(null)` before the attempt, catching both a `{success:false}` `MutationResult` and a thrown error (`DebtsView`'s repay handler was the one caller that already wrapped its action in try/catch; that catch is now inside the hook for every caller, not just that one).
- **`AddWalletForm`, `DiaryView`, and `KeywordRulesView` gained a re-entrant-submit guard they didn't previously have** (`useSubmitHandler`'s `isSubmitting` check) as a side effect of adopting the shared hook. None of their submit buttons were wired to a `disabled` state before or after this change, so this is invisible in the UI - it only closes a latent double-submit-on-double-click window, consistent with how `WalletTransferForm` and `TransactionForm` already behaved.
- **`SecurityView`'s two Supabase-backed forms (`handleUpdateProfile`, `handleUpdatePassword`) fit `useSubmitHandler` despite not returning `MutationResult`.** They already followed the identical try/throw/catch/finally shape by hand; their Supabase calls now just run inside the hook's `submit()` callback and throw on `{ error }` the same way they always did. Pre-mutation validation (password length/match) still short-circuits before the hook is ever invoked, exactly as before, so a validation failure still never toggles the loading state.
- **`useTransientFlash` picked up two call sites beyond the ledger's original "~7" estimate** (`TransactionsView.tsx`'s `importSuccessMsg` and `WalletPopupModal.tsx`'s `transferStatus`), both of which combine a self-clearing message with a side effect on clear (closing the import modal; switching the popup back to the `OVERVIEW` tab) - `flash()`'s optional third `onClear` parameter exists specifically for these two. `AuthModal.tsx`'s two `setTimeout(() => onClose(), ms)` calls were left untouched - they delay a fixed action with no local message state to clear, which isn't the flash shape.
- **`FinanceContext.tsx`'s three `setTimeout` call sites (storage-write debounce, realtime-reload debounce) were not touched**, per this task's explicit "do not modify core ledger/realtime sync" guardrail - they debounce a batched operation, not a self-clearing UI message, so they were never a `useTransientFlash` fit regardless.
- **`repayDebt`'s and `handleUpdatePassword`'s two different fallback error strings collapsed into one `defaultErrorMessage` each.** `DebtsView`'s pre-refactor repay handler showed "Failed to process debt repayment" for a `{success:false}` result but "An error occurred during repayment" for a thrown error with no message; `useSubmitHandler` uses a single default for both branches per hook instance. Neither spec (`debts.spec.ts`) asserts on failure-path copy, and a thrown error without a `.message` is already the unlikely case (Supabase/local-fallback errors normally carry one).

**Verification**

```
npm run lint                     # tsc --noEmit: clean, 0 errors
npm run build                    # built in 5.23s
CI=true npx playwright test      # 87/87 passed (4.4m), 1 worker, 0 retries
```

**Deliberately not done**

- **T24 (`walletFormStyles.ts` promotion) and T25 (unify the 4 transaction-row renderers) remain deferred**, untouched by this pass - out of this task's stated scope (T26/T27 only).

## Phase 17 — shared form styles (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T24 | Promote `walletFormStyles.ts`; adopt across ~12 files | new `src/utils/formStyles.ts`; `walletFormStyles.ts` (trimmed), `AddWalletForm.tsx`, `WalletTransferForm.tsx`, `TransactionForm.tsx`, `AuthModal.tsx`, `InlineMathInput.tsx`, `DiaryView.tsx`, `KeywordRulesView.tsx`, `DebtsView.tsx`, `SecurityView.tsx`, `TransactionsView.tsx`, `DebtCardItem.tsx` | Med | Med | 6h | done | T12 (done) | 7f9ef66 | tsc clean; `CI=true npx playwright test` 87/87, 0 retries; build succeeds in 4.98s | 12 consumer files migrated onto the promoted module (2 pre-existing + 10 newly adopted); net -24 lines across those 12 files plus the new module; `DebtsView`/`SecurityView` JS chunks shrank (14.55→10.67 kB, 17.07→15.56 kB) |

**Notes on execution:**
- **Every migrated class string was verified as a byte-for-byte (order-insensitive) token match to the shared constant before swapping**, per this task's own "do not alter visual styling unexpectedly" guardrail. Where a file's existing class string was a strict *superset* of a shared constant (extra non-conflicting utilities like `flex items-center gap-2` or `font-mono`), the swap composed `` `${SHARED_CLASS} ...extra}` `` rather than dropping the extras. Where a string differed in a rendering-relevant token (padding scale, font size, color shade, or a missing/extra responsive modifier), it was left untouched - see the divergences below.
- **Two label shapes existed, not one.** `walletFormStyles.ts`'s original `LABEL_CLASS` bakes in `block mb-1`, which is correct only for labels in a bare (non-gapped) wrapper `<div>` - `AddWalletForm`, `DebtsView`, `KeywordRulesView`, `SecurityView`, and one `DiaryView` label all use that pattern. `TransactionForm`, `AuthModal`, and `InlineMathInput` instead wrap label+input in a `flex flex-col gap-1.5` / `space-y-1.5` container, so their labels carry no margin of their own - the parent's gap owns the spacing. Adding `block mb-1` there would have stacked an extra ~4px under the parent's own gap. The promoted module splits this into `LABEL_TEXT_CLASS` (bare) and `LABEL_CLASS` (`= LABEL_TEXT_CLASS + ' block mb-1'`), and each of the 8 consumers uses whichever matches its existing wrapper.
- **A second, previously untracked duplicate was found and centralized: a "compact" primary button (no `sm:py-3` responsive growth).** `DebtCardItem`, `DiaryView`'s save button, `SecurityView`'s two account-action buttons, and `KeywordRulesView`'s submit all independently retyped an identical string that differs from the original `PRIMARY_BUTTON_CLASS` by exactly one token (missing `sm:py-3`). Promoted as `PRIMARY_BUTTON_COMPACT_CLASS`, closing a 5-site duplicate the original audit finding didn't name explicitly.
- **`SECONDARY_BUTTON_CLASS` is defined but not yet adopted anywhere** - no consumer in scope has a genuine full-width secondary/cancel form action (the visually similar `bg-stone-100`-style buttons found elsewhere are compact toolbar/icon buttons, a different UI role). Exported per this task's explicit "Primary & Secondary" ask and ready for the next form that needs it, same precedent as T22's unused `footer` slot.
- **`walletFormStyles.ts` kept as a thin wallet-domain file**, not deleted: it still owns `WALLET_COLOR_PALETTE` and `WALLET_TYPE_OPTIONS` (data specific to wallets, not generic form styling) and re-exports `FieldTone` for convenience. `AddWalletForm`/`WalletTransferForm` now import style primitives from `utils/formStyles.ts` and the two domain constants from the trimmed `walletFormStyles.ts`.

**Verification**

```
npm run lint                     # tsc --noEmit: clean, 0 errors
npm run build                    # built in 4.98s; PWA precache 26 entries (1484.29 KiB, down from 1491.34 KiB)
CI=true npx playwright test      # 87/87 passed (4.4m), 1 worker, 0 retries
```

**Deliberately not done**

- **`WalletPopupModal.tsx` audited, not touched.** Its inline balance-adjustment editor and wallet-activity filter use a genuinely different, more compact style family (`text-[10px]` micro-labels, `rounded-lg` instead of `rounded-xl`, different padding scale) - none of its label/input/select/button strings are an exact match to any shared constant. Forcing them through the shared module would shrink padding and font sizes that were deliberately sized for a dense inline popover, which is exactly the kind of "unexpected visual change" this task's guardrail forbids.
- **`TransactionsView`'s filter-bar and CSV-import inputs left untouched**, despite being named in this task's scope, for the same reason: every one of them bakes in `min-h-[44px]` (a deliberate mobile touch-target minimum used consistently across that view's toolbar) and `py-2`/icon-affordance padding (`pl-9 pr-8` for the search field), neither of which the shared `inputClass`/`selectClass` provide. The one exact match available there - the wallet-filter `<option>` elements - was adopted (`OPTION_CLASS`); the rest is a distinct "toolbar filter" style, not a "write-form field" style, and unifying it would have meant shrinking touch targets or extending the shared module's API for a single caller.
- **`TransactionForm`'s and `AuthModal`'s primary text inputs left untouched.** Both use `text-sm` (a deliberately larger, more prominent field for the app's two "front door" forms - quick-add and sign-in) where the shared `inputClass` is `text-xs`; `AuthModal`'s inputs are additionally icon-prefixed (`pl-9`) with a different border/ring/background recipe entirely. Neither is a re-typed duplicate of the wallet-form style, so neither was forced onto it.
- **`AuthModal`'s error/success banners left untouched** - its banner uses `text-rose-800`/no `font-medium` plus an icon-row layout, versus the shared `ERROR_BANNER_CLASS`'s `text-rose-700`/`font-medium`, a real (if subtle) color and weight difference, not just extra classes.
- **`KeywordRulesView`'s category `<select>` left untouched** - it uses `px-3.5` (matching its sibling text input) where `selectClass` always applies `px-3`; swapping would have shrunk its horizontal padding.
- **`DiaryView`'s two `mb-2` section labels (mood rating, physical activity) and its date-picker/notes-textarea inputs left untouched** - the `mb-2` labels are a real, different spacing value from the `mb-1` `LABEL_CLASS` (not a duplicate), and the date picker / textarea both use a distinct compact padding recipe (`px-3 py-1.5` / `p-3`) not covered by `inputClass`.
- **`SecurityView`'s disabled email input and its `p-2.5`-sized success/error banners left untouched** - the disabled input is deliberately muted (`text-stone-500`, `cursor-not-allowed`, `font-mono`) rather than styled like a live field, and its banners use a smaller `p-2.5` with different text-color shades than `ERROR_BANNER_CLASS`'s `p-3`.
- **T25 (unify the 4 transaction-row renderers) remains deferred**, untouched by this pass.

## Phase 18 — promote verified constraints into CLAUDE.md (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T30 | Promote constraints into `CLAUDE.md` | `CLAUDE.md`, `constraints-to-promote.md` | Med | Low | 2h | done | T24 (done) | 3c441e8 | tsc clean; `CI=true npx playwright test` 87/87, 0 retries; build succeeds in 5.29s | 7 rules promoted into `CLAUDE.md` (form styles, lookup maps, modals, context-subscription split, re-render rule, ISO-date comparison, test-suite size); `Testing` section corrected from a stale 13 tests / 5 files / 39 runs to the current 29 tests / 12 files / 87 runs |

**Notes on execution:**
- **Only 7 of the table's rows were promoted, matching this task's explicit list** — T24 (form styles), T26 (lookup maps), T22 (Modal primitive), T1 + T14 together (the `useFinanceState()`/`useFinanceActions()` split, no monolithic subscriber above view, `useFinance()` deleted), T2 (never `React.memo` a context subscriber without cutting the subscription), and T21 (ISO-string date comparison). T18, T19, T28, and T12's rows were **not** touched — T28's rule was already reflected in `CLAUDE.md`'s pre-existing Imports bullet (`there is no @/* alias`) from before this audit trail started, and T18/T19/T12 were not named in this task's instructions, so they stay in the Deferred table below rather than being promoted on inference.
- **Each promoted rule was re-verified against the current code, not taken on the ledger's word**, per the promotion rule's own "nothing moves into CLAUDE.md until the code already complies": grepped `src/` for `useFinance\(\)` (zero matches - the shim is gone), grepped `App.tsx` for `useFinanceState`/`useFinanceActions` (zero matches - no shell-level subscription), grepped for `role="dialog"` (only `Modal.tsx` - no surviving hand-rolled modal), checked `tsconfig.json` for a `paths` entry (none), and counted `test(` declarations across `tests/*.spec.ts` (29, times 3 browsers = 87, matching the suite's actual run count) before writing the Testing section update.
- **T24's and T26's rules were promoted with a qualifier, not verbatim from the original constraints-to-promote.md text.** The original phrasing ("never re-type Tailwind class strings...", "never write `new Map(x.map(...))`...") is a blanket ban that the actual shipped code does not satisfy and was never intended to - both T24 (Phase 17) and T26 (Phase 16)'s own refactor-log entries documented deliberate, correct exceptions (styles/maps with a genuinely different shape). Promoting the blanket version would have been "a rule the code does not satisfy," which `constraints-to-promote.md`'s own header calls worse than no rule. `CLAUDE.md`'s new bullets state the rule and name the exception category in the same breath.
- **`constraints-to-promote.md`'s 7 promoted rows got `Holds in code?` flipped to `Yes` and their `Promoted (sha)` column filled with this phase's commit**, in the same follow-up "docs: record" commit this repo's every prior phase uses to fill in a just-created commit's own hash.

**Verification**

```
npm run lint                     # tsc --noEmit: clean, 0 errors
npm run build                    # built in 5.29s
CI=true npx playwright test      # 87/87 passed (5.2m), 1 worker, 0 retries
```

**Deliberately not done**

- **T25, T18, T19, T12, T28 rows left as-is in `constraints-to-promote.md`** (T28 excepted, already reflected pre-audit) — none were part of this task's explicit promotion list, and T25/T18 are themselves still `todo` in the task ledger, so their constraints don't yet hold in code.

## Phase 19 — selector hardening + UI unification audit (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T31 | `aria-current` + `data-testid` on nav tabs; migrate `gotoTab`'s active-tab assertion | `Navbar.tsx`, `MobileBottomNav.tsx`, `tests/helpers.ts` | High | Low | 1h | done | — | 371d938 / 789a310 | tsc clean; `CI=true npx playwright test` 87/87 (twice - once additive-only, once after spec migration) | `gotoTab` no longer asserts a Tailwind class; every one of the suite's 87 runs depends on this helper |
| T32 | `data-testid` at 4 fragile-selector anchors (metric cards, keyword sandbox rows, diary notes, `TransactionForm` mounts) | `CashflowMetricsCards.tsx`, `KeywordRulesView.tsx`, `DiaryEntryCard.tsx`, `TransactionForm.tsx` + 3 call sites | High | Low | 1.5h | done | — | 371d938 / 789a310 | tsc clean; 87/87 both commits | Retires an xpath-ancestor lookup, 6 class+text-filtered row lookups, a bare `<p>` locator, and a `.first()` text filter that becomes ambiguous once Phase 22 ships |
| T33 | UI/UX unification audit report + phased roadmap + selector contract | new `ui-ux-audit-report.md`, `implementation-roadmap.md`, `test-selector-contract.md` | High | Low | 2h | done | — | 789a310 | docs-only, no gate needed | Findings A-L cover 5 add-transaction paths, 7 transfer triggers, `WalletPopupModal`'s 3-surface duplication, 4 transaction-row designs, 6 segmented controls, badge/progress/empty-state fragmentation, and the 2 spots `CLAUDE.md` has drifted from shipped code (Navbar subscription, stale mutator-split sentence) |

**Notes on execution:**
- **Two-commit split within the phase, matching the plan's stated safety requirement.** Commit `371d938` is additive-only (new attributes + a new optional `formTestId` prop, zero spec edits) and was verified 87/87 green on its own before any spec touched the new hooks - proving the hooks add nothing that could itself break a test. Commit `789a310` then migrates 5 spec files onto those hooks and adds the three new docs, verified 87/87 green again.
- **`transaction.spec.ts`'s Dashboard-form lookups were migrated too**, even though `tests/helpers.ts` and the other 3 fragile specs named in the plan were the direct target. The `.first()` on a text-filtered `form` locator sits right next to the file already under edit, is a live source of ambiguity risk once Phase 22 (T36-T38) makes multiple `TransactionForm` mounts routine, and the fix is a pure locator swap with the assertions untouched - in scope under the roadmap's spec-edit policy ("an assertion survives and only its locator moves").
- **`ui-ux-audit-report.md` is a new file, not an addition to `audit-report.md`.** `audit-report.md` is frozen write-once per its own header (`docs/audit/README.md`'s "Update discipline"); the two reports cover different concerns (Phase-0 context/re-render/dead-code findings vs. this pass's duplicate-entry-point/fragmented-UI findings) and mixing them would violate the freeze.

**Verification**

```
npm run lint                     # tsc --noEmit: clean, 0 errors
npm run build                    # built in 6.06s
CI=true npx playwright test      # 87/87 passed, both commits independently verified
```

**Deliberately not done**

- **No `contexts/` directory created**, despite the originating instruction naming one. `docs/audit/` already owns this audit trail and `CLAUDE.md` points there; a second root directory would fork the trail `docs/audit/README.md` explicitly protects. Confirmed with the user before proceeding.
- **Phases 20-29 (T34-T50) not started.** This phase covers only the test-hardening prerequisite and the audit/roadmap documents; no `src/` behavior changed beyond the additive attributes/prop in T31-T32.

---

## Phase 20 — Navbar de-subscription (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T34 | De-subscribe `Navbar` from finance context; fix stale `CLAUDE.md:79` | new `src/components/navbar/NavbarLedgerStatus.tsx`; `Navbar.tsx`; `CLAUDE.md` | High | Low-Med | 2h | done | — | e3fe540 | tsc clean; `auth.spec.ts`+`theme.spec.ts` 8/8 chromium; `npm run build` succeeds; `CI=true npx playwright test` 87/87, 0 retries | `Navbar` function-body executions during one ledger write: 6 → 0. See `baseline-metrics.md`'s "Post-T34" section |

**Notes on execution:**
- **`NavbarLedgerStatus.tsx` exports two components, not one**, because the finance-derived DOM Navbar rendered lived in two non-adjacent places: the sync badge in the left logo cluster, the net-worth/auth cluster in the right action row. A single wrapper component could only occupy one spot in the tree; two small components let each slot into its original position with identical DOM structure and sibling order, including `#navbar-signin-btn`'s exact position.
- **The quick-add button and theme toggle stayed in `Navbar.tsx`** — neither reads finance state, so extracting them would have been unnecessary indirection.
- **The re-render delta was measured, not asserted.** A temporary counter (`window.__navbarFnCalls`, incremented once per actual execution of `Navbar`'s function body) was added directly to the file, measured against the current tree (0 during a scripted Quick Add write), then `git stash` was used to temporarily restore the pre-T34 committed `Navbar.tsx`, the same counter line added to that reverted file, and the identical scripted write re-run (6). The stash was then popped to restore the T34 changes, the probe line removed, and `grep -rn "__navbarFnCalls" src/ tests/` confirmed zero leftovers before committing. The pre-T34 figure (6) matches the original Phase-4 baseline's `Navbar`/S2 row exactly (see `baseline-metrics.md`), cross-validating the lighter probe against the original `Profiler`-based harness.
- **A full `<Profiler>` + per-component `__rc` replay (the original Phase-4 methodology) was not repeated.** That harness lived on a throwaway branch that no longer exists and would need reconstructing from scratch; T34's claim is specific to one component (`Navbar` itself), so a single targeted counter answers it directly without rebuilding the multi-component matrix.
- **One contaminated full-suite run was discarded, not reported.** An initial `CI=true npx playwright test` was launched in the background before the render-count probe work; while it was still mid-run, `git stash`/`stash pop` swapped `Navbar.tsx`'s content twice for the measurement, and a leftover process on port 3000 was killed to unblock a second run attempt — that leftover process turned out to be the first run's own dev server, killed mid-test. That run finished "green" only via Playwright's CI retry budget (84 passed, 3 flaky retries, exit 0) and is not trustworthy evidence given the concurrent file-swapping. A second, clean run — launched only after all probe work and cleanup were complete — passed 87/87 with 0 retries and is the run cited above.

**Verification**

```
npm run lint                                                          # tsc --noEmit: clean, 0 errors
npx playwright test tests/auth.spec.ts tests/theme.spec.ts --project=chromium   # 8/8 passed
npm run build                                                         # built in 4.93s (post-probe-cleanup: 10.26s, cold cache)
CI=true npx playwright test                                           # 87/87 passed, 0 retries
```

**Deliberately not done**

- **No full S1-S5 × per-component re-render matrix was re-run.** See notes above — out of proportion to a single-component fix; the targeted probe directly answers T34's specific claim.
- **`MobileBottomNav` was not touched.** It already had zero finance-context subscription (fixed in an earlier phase per `audit-report.md` correction C3) and was not part of this task's scope.

---

## Phase 21 — transaction type tokens (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T35 | Centralize transaction type icon/label/tint/sign; standardize minus glyph | new `src/components/transaction/txTypeMeta.ts`; `currency.ts`; `AnimatedCounter.tsx`; `TransactionTableRow.tsx`; `WalletPopupModal.tsx`; `RecentTransactionsTable.tsx` | Med | Low | 1.5h | done | — | b958750 | tsc clean; `transaction.spec.ts`+`soft-delete.spec.ts` 7/7 chromium; `npm run build` succeeds; `CI=true npx playwright test` 87/87, 0 retries | Type-to-icon/color mapping (`ui-ux-audit-report.md` finding D, the single most duplicated fragment) now single-sourced for `TransactionTableRow` and half-adopted (icon/sign only) elsewhere; `AnimatedCounter`'s currency-format drift from finding J closed |

**Notes on execution:**
- **Adoption is not uniform across the 3 named files, and this was a discovery made during implementation, not a deviation from instructions taken lightly.** Reading all three renderers before touching any of them showed their type→icon/color schemes have already diverged, not just duplicated: `RecentTransactionsTable`'s Type column uses `ArrowLeftRight`/`TrendingDown` for TRANSFER/DEBT_REPAYMENT where the canonical (and `TransactionTableRow`'s existing) vocabulary is `RefreshCw`/`Landmark`; its label for `DEBT_REPAYMENT` is "Repayment", not "Debt Repayment"; and it shows no sign at all for TRANSFER/DEBT_REPAYMENT/ADJUSTMENT where `TransactionTableRow` and `WalletPopupModal` both show `-`. `WalletPopupModal`'s activity-tab badge background is its own 3-way scheme that collapses TRANSFER/DEBT_REPAYMENT/ADJUSTMENT into one indigo color, unlike the canonical 4-way `tint`. Forcing full adoption in either file would have changed what's on screen, directly contradicting this task's "without altering DOM layout or behaviour" goal. Adoption was scoped per-field to only what already matched exactly: `TransactionTableRow` gets full adoption (icon, tint, sign - a lossless 1:1 replacement of its own existing logic); `WalletPopupModal` gets `compactIcon`+`sign` only (its existing binary INCOME-vs-everything-else ternary already matches the canonical binary exactly); `RecentTransactionsTable` gets only the `MINUS` constant (its EXPENSE sign was already U+2212, so this is a pure single-sourcing with zero visual change).
- **The MINUS glyph swap is an intentional, requested visual change, not a bug.** Per this task's own step 2 ("standardizing the negative glyph... across display surfaces"), `TransactionTableRow` and `WalletPopupModal`'s ASCII `-` for EXPENSE/TRANSFER/DEBT_REPAYMENT/ADJUSTMENT amounts now render as U+2212 (`−`). Confirmed no spec asserts on the sign glyph before making this change (`grep` across `tests/` for `'-'`/`'−'`/`MINUS` returned nothing sign-related).
- **`ADJUSTMENT` was given an explicit token entry (mirroring `EXPENSE`'s tint/icon/sign) even though the task's file-list named only EXPENSE/INCOME/TRANSFER/DEBT_REPAYMENT.** `TransactionType` is a 5-member union; typing `TX_TYPE_META` as `Record<TransactionType, TxTypeMeta>` gives a compile-time guarantee every type is covered rather than a runtime `undefined` risk on an unhandled case, and `EXPENSE`'s appearance is exactly `ADJUSTMENT`'s existing fallback in every file that doesn't special-case it today.
- **CashflowMetricsCards.tsx and DiaryEntryCard.tsx's own sign-glyph drift (also documented in finding J) were left untouched** - not part of this task's named file list, and `MINUS` is now exported for a future pass to pick up without re-deriving it.

**Verification**

```
npm run lint                                                                          # tsc --noEmit: clean, 0 errors
npx playwright test tests/transaction.spec.ts tests/soft-delete.spec.ts --project=chromium   # 7/7 passed
npm run build                                                                         # built in 6.99s
CI=true npx playwright test                                                           # 87/87 passed, 0 retries
```

**Deliberately not done**

- **`RecentTransactionsTable`'s Type column icon/label vocabulary was not migrated onto the canonical tokens.** It is a 4th, independently-evolved scheme (see notes above); migrating it would change TRANSFER's and DEBT_REPAYMENT's rendered icon and label text. Left as its own local logic, matching the Phase 28 roadmap's stance that "each of the 4 [transaction] renderers keeps its own layout."
- **`WalletPopupModal`'s activity-tab badge background was not migrated onto the canonical `tint`.** Same reasoning - it would recolor TRANSFER/DEBT_REPAYMENT/ADJUSTMENT badges from indigo to blue/amber/rose respectively.
- **No new shared component was extracted** (e.g. a `<TxTypeIcon>` cell) - that is Phase 28's explicit scope (T49), which builds on these tokens once the roadmap's other consolidation phases (22-27) have run.

---

## Phase 22 — one transaction entry engine (approved to execute) · High risk

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T36 | `TransactionForm` gains `idPrefix`/`presetType`/`lockType`/`presetDebtId`/`presetWalletId` | `TransactionForm.tsx` | High | Med | 2h | done | — | 6885930 | tsc clean; `transaction.spec.ts` 4/4 chromium | New optional props, zero behavior change for existing callers (no prop = old behavior exactly) |
| T37 | Retire DashboardView's inline form for a Quick-Add button | `DashboardView.tsx`, `App.tsx`, `tests/transaction.spec.ts` | High | High | 1.5h | done | T36 | 6885930 | tsc clean; `transaction.spec.ts` 4/4 chromium | Add-transaction surfaces: 5 → 4 (finding A). Dashboard `TransactionForm` mount removed entirely |
| T38 | Consolidate DebtsView repay onto `TransactionForm` | `DebtsView.tsx` | High | High | 2h | done | T36 | 6885930 | tsc clean; `debts.spec.ts`+`soft-delete.spec.ts` 4/4 chromium | Add-transaction surfaces: 4 → 3 remaining (Navbar quick-add, TransactionsView modal, WalletPopupModal's Adjust Balance - deliberately not unified, see `implementation-roadmap.md`) |

**Combined gate:** tsc clean; `npm run build` succeeds in 7.51s; `CI=true npx playwright test` 87/87, 0 retries.

**Notes on execution:**
- **T38's most consequential discovery: `repayDebtAtomic` is not a distinct atomic code path, it is a thin wrapper around the exact same `addTransaction` call `TransactionForm` already makes.** Before touching `DebtsView.tsx`, `FinanceContext.tsx:1597-1618` was read in full: `repayDebtAtomic(debtId, walletId, amount, note)` validates the debt/wallet exist, looks up the debt-repayment category, and calls `addTransaction({..., type: 'DEBT_REPAYMENT', debtId, categoryId})` - nothing more. The actual remainingAmount decrement (and auto-settle at zero) lives inside `addTransaction` itself (`FinanceContext.tsx:1137-1148` for the local path, `:1271-1274` for the Supabase path), gated only on `data.type === 'DEBT_REPAYMENT' && data.debtId`, with **no dependency on which function called it**. `TransactionForm`'s own `handleSubmit` already supplies both fields identically (`debtId` at `:207`, the same category-matching expression at `:197` that `repayDebtAtomic` uses at `FinanceContext.tsx:1606`). This is why T38 could route DebtsView's repay through a direct `addTransaction` call instead of `useDebts().repayDebt` with zero loss of the debt-decrement/auto-settle behavior `debts.spec.ts` exercises - confirmed by that spec still passing unmodified.
- **`repayDebt`/`repayDebtAtomic` are now unused but were deliberately not deleted.** `grep -rn "repayDebt" src/` after the change shows zero remaining call sites outside `useDebts.ts` and `FinanceContext.tsx` themselves. Removing them is dead-code cleanup outside this task's stated scope (extend `TransactionForm`, retire two forms) and touches `FinanceContext.tsx`, whose blast radius this already-high-risk phase avoided expanding further. Left as a candidate for a future dead-code pass.
- **The id-naming scheme for `idPrefix` had to special-case 3 fields rather than apply one uniform template.** The exact legacy ids (`#repay-amount-math`, `#repay-wallet-select`, `#confirm-repay-btn`) don't share a common suffix pattern with each other or with `TransactionForm`'s own default `useId()`-derived ids (`${formId}-math-input`, `${formId}-wallet`, `${formId}-submit-btn`) - notably `confirm-repay-btn` puts the word "confirm" *before* the prefix, the opposite order of the other two. `mathInputId`/`walletSelectId`/`submitBtnId` are each computed with their own ternary rather than a shared helper, since a "clean" uniform template couldn't produce all three exactly.
- **The debt-repayment amount field no longer pre-fills with the debt's minimum payment.** The old hand-rolled form did this (`handleOpenRepay` seeded `repayAmount`/`repayRaw` from `debt.minimumPayment`); `TransactionForm` has no equivalent prop and adding one wasn't part of T36's listed prop set. `debts.spec.ts` fills the amount itself in both its repayment steps, so nothing broke, but this is a real, user-visible behavior change - flagged rather than silently absorbed. A `presetAmount` prop would restore it if wanted in a future task.
- **`WalletPopupModal`'s "Adjust Balance" editor was left untouched, deliberately.** It creates an `ADJUSTMENT` transaction via a bespoke one-field form, not a duplicate of `TransactionForm` - per `implementation-roadmap.md`'s "Deliberately not changed" #4, routing it through `TransactionForm` would expose a type toggle, category, and destination-wallet field the user must ignore for what is a one-field wallet reconciliation.

**Verification**

```
npm run lint                                                                              # tsc --noEmit: clean, 0 errors
npx playwright test tests/transaction.spec.ts --project=chromium                          # 4/4 passed (T36+T37)
npx playwright test tests/debts.spec.ts --project=chromium                                # 1/1 passed (T38)
npx playwright test tests/transaction.spec.ts tests/debts.spec.ts tests/soft-delete.spec.ts --project=chromium   # 8/8 passed (combined re-check)
npm run build                                                                             # built in 7.51s
CI=true npx playwright test                                                               # 87/87 passed, 0 retries
```

**Deliberately not done**

- **`repayDebt`/`repayDebtAtomic` were not deleted** - see notes above.
- **No `presetAmount` prop was added** to restore the minimum-payment pre-fill - not in T36's listed prop set; see notes above.
- **`WalletPopupModal`'s Adjust Balance and the TransactionsView/Navbar quick-add surfaces were not touched** - only the two named retirements (Dashboard inline form, DebtsView repay form) were in scope for this phase, per `implementation-roadmap.md`'s Phase 22 entry.

---

## Phase 23 — wallet surface ownership (approved to execute) · High risk

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T39 | Collapse `WalletPopupModal` to OVERVIEW + TRANSACTIONS; retire TRANSFER/ADD_WALLET tabs | `WalletPopupModal.tsx` | High | Med | 1.5h | done | — | 1f91b97 | tsc clean; `wallet-forms`+`wallets`+`date-boundary` chromium 7/7 | Tabs 4 → 2; 4 hardcoded tab buttons collapsed into one mapped array (`TAB_DEFS`) |
| T40 | TRANSACTIONS tab becomes a 5-row preview with a "View all" handoff to `TransactionsView`, pre-filtered by wallet | `WalletPopupModal.tsx`, `TransactionsView.tsx`, `App.tsx` | Med | Med | 1.5h | done | T39 | 1f91b97 | same gate | `walletTransactions.slice(0, 15)` → `.slice(0, 5)`; new `#wallet-modal-view-all-tx-btn` wired through a wallet-filter state lifted to `App.tsx` |
| T41 | Consolidate Transfer/Add-Wallet triggers onto one shared, shell-level modal | new `src/components/wallet/TransferFundsModal.tsx`, `AddWalletModal.tsx`; `App.tsx`; `WalletsView.tsx`; `DashboardView.tsx`; `WalletAccountsGrid.tsx`; `tests/wallet-forms.spec.ts` | High | High | 2.5h | done | T39 | 1f91b97 | `wallet-forms`+`wallets`+`date-boundary` chromium 7/7; `CI=true npx playwright test` 87/87, 0 retries | 2 independent Transfer/Add-Wallet modal instances (`WalletsView`'s own local `<Modal>`s + `WalletPopupModal`'s retired tabs) → 1 shared instance, mounted once in `App.tsx` |

**Combined gate:** tsc clean; `npm run build` succeeds in 24.6s; `CI=true npx playwright test` 87/87, 0 retries.

**Notes on execution:**
- **"OVERVIEW + ADJUST" in the phase brief does not name a 4th tab that needs building.** There has never been a dedicated ADJUST tab - the per-wallet balance-adjustment editor has always lived inline inside OVERVIEW's wallet cards (`isAdjustingBalance`/`Sliders` icon), and it stays exactly where it was. Read literally, "keep OVERVIEW + ADJUST only" would also imply dropping TRANSACTIONS, but T40's own instructions immediately go on to modify "the TRANSACTIONS tab" - so the two tasks are only consistent if TRANSACTIONS survives. Retained it as the second of the two surviving tabs; only TRANSFER and ADD_WALLET were actually retired.
- **T41's shell-level design (rather than a per-view duplicate, as `WalletPopupModal` itself uses) was chosen deliberately, not by default.** `implementation-roadmap.md`'s Phase 23 intro explicitly rejects promoting `WalletPopupModal` above view level and has each view mount its own copy instead, "fixing reachability at zero architectural cost" - because that modal is only ever opened by clicking a wallet card, and a wallet card already lives inside whichever view opens it. Transfer/Add-Wallet have the same reachability shape (triggers only in `DashboardView`'s hero/grid and `WalletsView`'s header) but a different constraint: `wallet-forms.spec.ts`'s existing test clicks `#hero-transfer-funds-btn` once and immediately asserts the transfer fields are visible, with no intermediate navigation step - so whatever renders those fields must already exist and be reachable the instant the Dashboard-rendered button is clicked, which a `WalletsView`-local modal instance cannot be (only one view is mounted at a time). `TransferFundsModal`/`AddWalletModal` follow the exact precedent `QuickAddModal` already set for this: a small, self-subscribing component mounted once in `App.tsx`, holding no finance state itself, with only its `isOpen` boolean (and, for transfer, an optional preselected wallet id) owned by `App.tsx` - preserving `CLAUDE.md`'s "no component above view level subscribes to finance state" rule exactly as `QuickAddModal` already does.
- **Discovered - and fixed - during the targeted spec run, not anticipated up front: the retired `WalletPopupModal` TRANSFER tab's "Transfer completed successfully!" success flash had to be reproduced in the new `TransferFundsModal`, not just its fields.** The first `TransferFundsModal` implementation called `onTransferred={onClose}` directly (an immediate close, matching what `WalletsView`'s own retired local modal did). `wallet-forms.spec.ts:59`'s `/Transfer completed successfully/i` assertion - explicitly named as a "must remain unchanged" outcome assertion in this phase's own instructions - then failed, because that text was never `WalletsView`'s behavior; it only ever came from the popup's `useTransientFlash`-driven `statusMessage` banner. Fixed by giving `TransferFundsModal` the same `useTransientFlash`+`errorPlacement="top"`+1000ms-delayed-close pattern the retired TRANSFER tab used. This is now `WalletsView`'s behavior too (previously it closed instantly) - an intentional, accepted side effect of both views sharing one modal instance, not a separate change.
- **`tests/date-boundary.spec.ts` needed no changes**, despite the roadmap listing it as an expected break (`:31,34`, targeting the wallet-popup's old wallet-card markup). Both of its tests already assert against `#wallet-entity-wal-main-checking` and `#time-filter-week` - `WalletsView`'s and `DashboardView`'s own ids, hardened in Phase 19 - not anything `WalletPopupModal` renders. The roadmap's line numbers describe the file's state before that earlier hardening pass; verified via a clean run rather than edited.
- **T40's wallet-filter handoff is a plain `useState` initializer + one-time consume effect in `TransactionsView`, not a re-sync effect like `WalletPopupModal`'s.** `App.tsx` keys the active view by `activeTab` inside its `AnimatePresence`, so `TransactionsView` fully unmounts and remounts on every tab switch (unlike `WalletPopupModal`, which its parent renders unconditionally and which therefore needs an `isOpen`-effect resync per `CLAUDE.md`'s documented gotcha). `initialWalletFilter` only needs to seed `selectedWalletId`'s initializer once per mount; a `useEffect(() => { if (initialWalletFilter) onConsumeInitialWalletFilter?.(); }, [])` then clears `App.tsx`'s copy so a later, unrelated navigation to the tab doesn't inherit a stale wallet id.

**Verification**

```
npm run lint                                                                                          # tsc --noEmit: clean, 0 errors
npx playwright test tests/wallet-forms.spec.ts tests/wallets.spec.ts tests/date-boundary.spec.ts --project=chromium   # 7/7 passed
npx playwright test tests/transaction.spec.ts tests/debts.spec.ts tests/soft-delete.spec.ts --project=chromium        # 8/8 passed (regression re-check)
npm run build                                                                                         # built in 24.62s
CI=true npx playwright test                                                                           # 87/87 passed, 0 retries
```

**Deliberately not done**

- **No `ConfirmDialog` was added** to wallet or debt delete (`WalletPopupModal`'s `window.confirm`, `WalletsView`'s unconfirmed delete button) - that is Phase 24's explicit scope (T42), not this phase's.
- **`WalletsView`'s own wallet cards still don't open `WalletPopupModal`.** They never did before this phase either (they are display-only, with an inline delete button); nothing in T39-T41 asked for that, so it was not added.
- **The TRANSACTIONS preview shows no "showing 5 of N" count or similar** - not specified by T40, and the "View all" handoff already communicates that more exist.
- **No `SectionHeader`/`Card`/`Badge`/`ConfirmDialog` primitives were introduced** - out of scope; Phases 24-26.

---

## Phase 24 — ConfirmDialog (approved to execute) · Medium risk

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T42 | Shared `ConfirmDialog` over `Modal.tsx`; gate wallet/debt delete behind it | new `src/components/ui/ConfirmDialog.tsx`; `WalletsView.tsx`; `WalletPopupModal.tsx`; `DebtsView.tsx`; `tests/soft-delete.spec.ts` | High | Med | 2h | done | — | c06e444 | tsc clean; `wallets`+`soft-delete`+`debts` chromium 5/5; `npm run build` succeeds; `CI=true npx playwright test` 87/87, 0 retries | Unconfirmed-delete surfaces: 2 (`WalletsView`'s one-click delete, a real bug) + 1 `window.confirm` (`WalletPopupModal`) + 1 unconfirmed (`DebtsView`) → 0; all 3 destructive delete sites now share one dialog and one pair of ids |

**Verification**

```
npm run lint                                                                                  # tsc --noEmit: clean, 0 errors
npx playwright test tests/wallets.spec.ts tests/soft-delete.spec.ts tests/debts.spec.ts --project=chromium   # 5/5 passed
npm run build                                                                                 # built in 8.86s
CI=true npx playwright test                                                                   # 87/87 passed, 0 retries
```

**Notes on execution:**
- **The actual delete-wallet and delete-debt test cases live in `tests/soft-delete.spec.ts`, not `tests/wallets.spec.ts` as this phase's instructions named.** `tests/wallets.spec.ts` has exactly one test (creating a wallet) and asserts nothing about deletion; both `button[id^="delete-wallet-"]` and `button[id^="delete-debt-"]` clicks are exercised only in `soft-delete.spec.ts`'s wallet/debt sub-tests (confirmed via `grep -rn "delete-wallet-\|delete-debt-" tests/`). Updated the actual location instead of forcing a no-op edit into `wallets.spec.ts`; `wallets.spec.ts` was still run per the instructions' verification step and passes unmodified.
- **`ConfirmDialog`'s two footer buttons use local Tailwind classes, not `PRIMARY_BUTTON_CLASS`/`SECONDARY_BUTTON_CLASS`.** Both shared classes are `w-full` (single full-width button per form); a side-by-side Cancel/Confirm pair is a different shape forcing them through would either wrap awkwardly or require overriding the `w-full`, so they stay local - the same call `WalletPopupModal`'s existing inline Save/Cancel balance-editor buttons already made (documented exception, `CLAUDE.md`'s Form styles convention).
- **`WalletPopupModal`'s delete button already stacks a `ConfirmDialog` on top of its own open `Modal`.** Both are `fixed inset-0` with their own backdrop; the second (confirm) backdrop visually covers the first (wallet popup) entirely, which is the intended effect - a modal-on-modal stack, not a layout conflict. No z-index changes were needed since `Modal.tsx` doesn't vary z-index per instance and mount order alone puts the confirm dialog's DOM node - and therefore its backdrop - on top.
- **Both `WalletsView` and `WalletPopupModal` track their delete target as the full `Wallet` object (`walletToDelete`), not just an id**, so `ConfirmDialog`'s description can name the wallet ("Delete \"Cash Wallet\"?") without a second lookup after the id is already known from the click.

**Deliberately not done**

- **No confirmation was added to transaction soft-delete.** Per this phase's explicit guardrail and `implementation-roadmap.md`'s "Deliberately not changed" #6: it's reversible via `restoreTransaction`, so a confirm dialog there is friction, not safety.
- **`isLoading` has no error-recovery UI** (no error banner on a failed delete). Neither `deleteWallet` nor `deleteDebt` currently return a `MutationResult` or surface a failure to their callers (`Promise<void>`, per `FinanceContext.tsx`) - there was no existing error-handling infrastructure to wire into, and adding a new one is outside T42's stated scope (a confirm dialog, not a delete-action rewrite).
- **No `SectionHeader`/`Card`/`Badge`/`ProgressMeter`/`EmptyState`/`SegmentedControl` primitives were introduced** - out of scope; Phases 25-27.

---

## Phase 25 — SectionHeader + Card (approved to execute) · Medium risk

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T43 | Create & adopt `SectionHeader` across all 7 views | new `src/components/ui/SectionHeader.tsx`; `DashboardView.tsx`, `DiaryView.tsx`, `DebtsView.tsx`, `WalletsView.tsx`, `TransactionsView.tsx`, `SecurityView.tsx`, `KeywordRulesView.tsx` | High | Med | 2h | done | — | 5b38141 | tsc clean; `keywords`+`wallets`+`debts`+`diary`+`theme` chromium 8/8 | 8 near-identical hand-rolled header banners (7 views + Dashboard's "Periodic Cashflow" section) → 1 shared component; every `getByRole('heading', {name})` assertion (`theme.spec.ts`, `diary.spec.ts`) still resolves, unchanged |
| T44 | Create & adopt `Card` at matching shell sites | new `src/components/ui/Card.tsx`; `KeywordRulesView.tsx` (×3), `DiaryView.tsx` (×2), `TransactionsView.tsx` (×1 table container) | Med | Med | 1.5h | done | — | 5b38141 | same gate | 6 plain container shells → `Card`; ~14 further candidate shells surveyed and left local (see notes) |

**Combined gate:** tsc clean; `npm run build` succeeds in 9.93s; `CI=true npx playwright test` 87/87, 0 retries.

**Verification**

```
npm run lint                                                                                                     # tsc --noEmit: clean, 0 errors
npx playwright test tests/keywords.spec.ts tests/wallets.spec.ts tests/debts.spec.ts tests/diary.spec.ts tests/theme.spec.ts --project=chromium   # 8/8 passed
npx playwright test tests/soft-delete.spec.ts tests/transaction.spec.ts --project=chromium                        # 7/7 passed (regression re-check)
npm run build                                                                                                     # built in 9.93s
CI=true npx playwright test                                                                                       # 87/87 passed, 0 retries
```

**Notes on execution:**
- **`SectionHeader` is built on `Card`, not a separate shell**, so both primitives share one visual language rather than two near-identical `rounded-2xl`/border/background implementations. `action` is rendered as-is (no extra wrapping `<div>`) since every existing caller already supplies its own single-root action markup - a bare button (`DebtsView`, `DiaryView`) or its own `<div className="flex ...">` wrapping several (`WalletsView`, `SecurityView`, `TransactionsView`, Dashboard's time-filter tray).
- **Two intentional, minor spacing unifications, both explicitly invited by this phase's "establishing consistent spacing" goal, not unnoticed regressions:** every banner now uses `Card`'s flat `p-5`/`shadow-xs` (previously `shadow-2xs` everywhere, and `TransactionsView` plus Dashboard's "Periodic Cashflow" section used stepped `p-4 sm:p-5`/`gap-3 sm:gap-4`); and `TransactionsView`'s subtitle, previously `hidden sm:block` (hidden on mobile to save room in its 4-button toolbar), is now always visible like every other view's subtitle. Neither changes any text a test asserts on.
- **`KeywordRulesView`'s header has no `action` at all** - it never had a header-level button (its "Add Rule" button lives inside its own left-column card, not the banner) - so `SectionHeader` is called there with `title`/`subtitle` only, exercising the prop as genuinely optional rather than always supplying an empty slot.
- **`Card` adoption was scoped to shells that already matched its shape losslessly, not the full ~25-site surface `implementation-roadmap.md`'s Phase 25 section describes for the whole roadmap.** Surveyed and left local, each for a distinct reason: `WalletsView`'s and `WalletAccountsGrid`'s wallet cards (framer-motion `motion.div` with `whileHover`/`whileTap` - `Card` isn't a motion component, converting would drop the tap/hover spring animation); `DebtCardItem`'s debt cards (a conditional per-state className swap for settled/unsettled - appending an override via `Card`'s `className` prop risks an unpredictable win/lose against `Card`'s own base classes, since Tailwind's cascade order depends on source-file order, not className string order); `SecurityView`'s five card-shaped shells (three use stepped `p-5 sm:p-6` padding, one uses `p-4 sm:p-5` with a non-white `bg-stone-50` background - none match the fixed `none`/`sm`/`md`/`lg` padding scale or the always-white background `Card` standardizes on); `TransactionsView`'s filter/search bar (`p-3.5 sm:p-4`, stepped); Dashboard's "Record a Transaction" CTA card (`p-8`, matching none of the four padding options without shrinking it). Forcing any of these through `Card` would have changed on-screen padding, background, or animation behavior - this phase's task list did not ask for that, so they stay local, matching the discipline `implementation-roadmap.md` itself sets for Phase 28's row renderers.
- **`Card`'s `padding` scale (`none`/`sm`/`md`/`lg` → `''`/`p-3.5 sm:p-4`/`p-5`/`p-6`) was derived from the two most common existing fixed-padding shapes (`p-5` for banners, `p-6` for the two-column form/log panels in `DiaryView`/`KeywordRulesView`) plus a bare `none` for `TransactionsView`'s table container, which pads internally via its own `<th>`/`<td>` cells.** No stepped-responsive padding value was added to the scale, since the props list this task specified is a fixed 4-value enum.

**Deliberately not done**

- **`SecurityView`'s five card-shaped shells, `TransactionsView`'s filter bar, and Dashboard's "Record a Transaction" CTA card were not converted to `Card`** - shape mismatches (stepped padding, non-white background, unique padding value); see notes above.
- **`WalletsView`/`WalletAccountsGrid`'s wallet cards and `DebtCardItem`'s debt cards were not converted** - framer-motion animation and conditional per-state styling respectively, neither of which `Card` as specified (a plain `<div>` with static classes) can express losslessly.
- **No `Badge`/`ProgressMeter`/`EmptyState`/`SegmentedControl`/`ConfirmDialog`-adjacent primitives were introduced** - out of scope; Phases 26-27 (`ConfirmDialog` itself already shipped in Phase 24).

---

## Phase 26 — Badge, ProgressMeter, EmptyState (approved to execute) · Low-Medium risk

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T45 | `Badge`/`CategoryChip`; fix the invalid `py-0.2` typo | new `src/components/ui/Badge.tsx`; `TransactionTableRow.tsx`, `RecentTransactionsTable.tsx`, `DiaryEntryCard.tsx`, `DiaryView.tsx`, `KeywordRulesView.tsx` | Med | Low | 2h | done | — | ab1068c | tsc clean; `transaction`+`keywords`+`debts` chromium 7/7 | `py-0.2` (not a real Tailwind step - silently zero vertical padding) fixed at all 5 sites; category-chip tint alpha drift (`15`/`20`/`25`) collapsed onto one `categoryTint()` (20%) |
| T46 | `ProgressMeter` with strict `[0,100]` clamping | new `src/components/ui/ProgressMeter.tsx`; `DebtCardItem.tsx`, `DebtPayoffOverview.tsx`, `CategoryExpenseDistribution.tsx`, `WalletAccountsGrid.tsx` | Med | Low | 1h | done | — | ab1068c | same gate | `CategoryExpenseDistribution.tsx`'s previously-unclamped fill width (a real overflow bug) now clamps like the other 3; 4 duplicated progress-bar shells → 1 |
| T47 | `EmptyState`; adopt at 5 previously-blank surfaces | new `src/components/ui/EmptyState.tsx`; `RecentTransactionsTable.tsx`, `KeywordRulesView.tsx`, `DebtsView.tsx`, `WalletsView.tsx`, `WalletAccountsGrid.tsx`, `TransactionsView.tsx` | Med | Low | 1.5h | done | — | ab1068c | same gate | 5 surfaces that rendered nothing (or a bare line of text) when their list was empty now show an icon+title+subtitle; `TransactionsView`'s `/No transactions match your current filters/i` text preserved verbatim |

**Combined gate:** tsc clean; `npm run build` succeeds in 9.28s; `CI=true npx playwright test` 87/87, 0 retries.

**Verification**

```
npm run lint                                                                                       # tsc --noEmit: clean, 0 errors
npx playwright test tests/transaction.spec.ts tests/keywords.spec.ts tests/debts.spec.ts --project=chromium   # 7/7 passed
npx playwright test tests/soft-delete.spec.ts tests/diary.spec.ts tests/wallets.spec.ts --project=chromium    # 5/5 passed (regression re-check)
npm run build                                                                                       # built in 9.28s
CI=true npx playwright test                                                                         # 87/87 passed, 0 retries
```

**Notes on execution:**
- **`Badge`'s two tones (`neutral`, `amber`) are exactly the two tones actually duplicated across the app, not a speculative palette.** `neutral` matches the plain "Today"/"Yesterday" day-badge (identical markup at `DiaryView.tsx` and `DiaryEntryCard.tsx`); `amber` matches the debt-repayment badge (`TransactionTableRow.tsx`, both its `sm` mobile and `md` desktop sizes). `DiaryEntryCard`'s workout/food-quality badges were read but not touched - they already use valid CSS (not part of the named `py-0.2` bug list) and each has its own multi-way conditional tone logic (workout: blue-vs-neutral; food: emerald/amber/rose), which would need a materially larger tone set to express losslessly than this task's two actually-duplicated tones justify.
- **`CategoryChip`'s `rounded` prop keeps all three pre-existing roundings (`rounded`/`rounded-md`/`rounded-full`) rather than collapsing to one.** `TransactionTableRow`'s mobile chip and `RecentTransactionsTable`'s mobile chip both used bare `rounded` (0.25rem); `TransactionTableRow`'s desktop chip and `KeywordRulesView`'s chip used `rounded-md` (0.375rem) - a different value, not a typo; `RecentTransactionsTable`'s desktop chip used `rounded-full`. Forcing one rounding onto all four would visibly change three of them; each call site now passes the `rounded` value that reproduces its own prior appearance exactly.
- **The `20%` tint alpha is a deliberate middle choice, not arbitrary.** Of the three values found (`KeywordRulesView` 15%, `TransactionTableRow` 25%, `RecentTransactionsTable` already 20%), picking 20% leaves one site (`RecentTransactionsTable`) with a zero-delta change and moves the other two by the smallest possible amount in either direction.
- **`ProgressMeter`'s `color` prop (raw hex, for `CategoryExpenseDistribution`/`WalletAccountsGrid`) and `barClassName` prop (a Tailwind class, for `DebtCardItem`/`DebtPayoffOverview`'s fixed `bg-emerald-500`) are mutually exclusive by design** - a category's or wallet's color is a per-instance hex value that can only be applied via inline `style`, while the debt bars' color never varies, so a static class is both correct and avoids an unnecessary inline style. `color`, when present, always wins.
- **`DebtsView`, `WalletsView`, and `WalletAccountsGrid`'s new empty states are wrapped in `Card` (Phase 25) even though `EmptyState` itself has no card chrome.** Unlike `RecentTransactionsTable`/`KeywordRulesView` (whose empty state already sits inside an existing table/card shell), these three views render their grid as a bare `<div className="grid ...">` today with no surrounding container - an unwrapped `EmptyState` would float as unstyled text directly on the page background. Wrapping in `Card` gives it the same visual footing as every other content block on those pages.

**Deliberately not done**

- **`DiaryEntryCard`'s workout/food-quality badges were not migrated onto `Badge`** - each has its own multi-way conditional tone logic beyond this task's two actually-duplicated tones; see notes above.
- **`CashflowMetricsCards.tsx`'s and any other undiscovered `${color}NN` tint site were not audited** - only the three sites the phase brief named (`KeywordRulesView`, `TransactionTableRow`, `RecentTransactionsTable`) were in scope.
- **No `SegmentedControl` primitive was introduced.** Out of scope - Phase 27.

---

## Deferred — documented, awaiting separate approval

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by |
|---|---|---|---|---|---|---|---|
| T25 | Unify the 4 transaction-row renderers | see audit-report §E | Med | High | 8h | todo | consider dropping — see plan traps §19 |
| T18 | `Promise.all` the bulk-import wallet updates | `FinanceContext.tsx:1305-1312` | Low-Med | Med | 1h | todo | T12 CSV spec |

## Not a task — explicitly out of scope this pass

`tsconfig.json` `strict` mode, ESLint/Prettier, Vitest, React Compiler, `rollup-plugin-visualizer`, a second state library, merging `roundToCents`/`roundToTwoDecimals`, mass-rewriting imports to adopt `@/*`, unifying/removing `AnimatedCounter`'s currency exemption without ADR `0004`. See the plan's "Non-goals and traps" section for the full list and reasoning.
