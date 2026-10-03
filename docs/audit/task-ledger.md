# Task ledger

The only file in `docs/audit/` edited mid-phase. Flip `Status` to `in-progress` when a task starts; fill `Commit` / `Gate result` / `Metric delta` when it lands. Ranked by impact-to-risk, prioritized per the session's stated order: runtime responsiveness first, duplication second.

Status values: `todo` · `in-progress` · `done` · `dropped` (with a one-line reason).

**Roadmap status: closed out at Phase 37. Both audit passes are complete.** All 29 original phases (T1–T50) are `done`. Phase 29 (T50, 2026-09-19) was that first pass's closeout — ADRs 0006–0008, final metrics, and constraint promotion into `CLAUDE.md`. Phase 30 (T51–T56, 2026-09-19) landed after that closeout, at the user's explicit request: a duplicate-category correctness bug fix plus the "Categories & Smart Rules" hub feature build. Phase 31 (T57–T60, 2026-09-20) followed, also at explicit request: dashboard visual hierarchy polish, `InlineMathInput` UX (hint + quick-amount chips), a verification pass confirming `MobileBottomNav`'s mobile-ergonomics requirements were already shipped, and the Supabase duplicate-category cleanup migration Phase 30 explicitly deferred. Phases 32–37 (T61–T78, approved 2026-09-20) are a second full audit pass — `docs/audit/perf-audit-report.md` — covering correctness (a cloud wallet-balance desync bug and 9 optimistic mutators with no rollback), render cost (`AnimatedCounter`'s per-frame `setState`), dead code, and bundle weight (deferring the shell modals to take `mathjs` off the critical path); correctness landed first per the user's explicit instruction, and Phase 37 (T78, 2026-09-20) closed this second pass out the same way Phase 29 closed the first: ADRs finalized, a closing `baseline-metrics.md` column, and constraint promotion/drift repair in `CLAUDE.md`. Phase 38 (2026-09-20, approved explicitly) closed the backlog out entirely: `T18` shipped and `T25` formally rejected/closed per ADR `0006`. **Zero audit tasks remain `todo` or deferred.** Phase 39 (T79-T83, 2026-09-23, approved explicitly) reopens the ledger for a feature build rather than an audit task: Jev auto-categorization and transaction-type detection, layered behind the existing keyword matcher per ADR `0011`.

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

## Phase 27 — SegmentedControl (approved to execute) · Medium risk

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T48 | `SegmentedControl`; adopt at 3 pill-in-tray sites | new `src/components/ui/SegmentedControl.tsx`; `DashboardView.tsx`, `TransactionForm.tsx`, `AuthModal.tsx` | Med | Med | 2h | done | — | 07b6394 | tsc clean; `transaction`+`auth` chromium 9/9; `CI=true npx playwright test` 87/87, 0 retries; `npm run build` succeeds in 7.28s | 3 hand-rolled pill-in-tray switchers (period filter, transaction-type toggle, auth mode tabs) → 1 shared component with a `layoutId`-animated active pill; all pre-existing ids (`#time-filter-*`, `#auth-tab-signin`, `#auth-tab-signup`, `${formId}-type-*`) and label text preserved verbatim |

**Verification**

```
npm run lint                                                                # tsc --noEmit: clean, 0 errors
npx playwright test tests/transaction.spec.ts tests/auth.spec.ts --project=chromium   # 9/9 passed
CI=true npx playwright test                                                 # 87/87 passed, 0 retries
npm run build                                                                # built in 7.28s
```

**Notes on execution:**
- **The active pill is a `layoutId`-animated `motion.span` sibling behind the label, not a background-class swap on the button itself.** Switching options now springs the white/dark-panel pill across the tray instead of an instant class change on each button.
- **`layoutId` is namespaced per instance via `useId()`.** `TransactionForm` can mount twice at once (Dashboard's inline form alongside the Quick Add modal, per its own `formTestId` prop), and `DashboardView` renders its period-filter `SegmentedControl` alongside that inline form's type-toggle `SegmentedControl` in the same tree - two unnamespaced `layoutId="pill"` instances would fight over the same shared layout animation.
- **Container layout classes (`flex`/`grid`, alignment, width) stay with each call site via `className`, not baked into the primitive.** `DashboardView` passes `flex items-center self-start sm:self-auto`; `TransactionForm` passes `grid grid-cols-4 sm:flex w-full sm:w-auto` (its existing 4-column mobile touch-target grid, now including the `DEBT_REPAYMENT`/"Debt" option the phase brief's file excerpt didn't show); `AuthModal` uses the default (a plain tray) plus the new `fill` prop for its two equal-width tabs. Tray background/border/padding/pill styling is shared; only the outer display mode is call-site-owned, since the three sites genuinely differ there (content-sized pills vs. equal-width tabs vs. a 4-column mobile grid) and forcing one shape would be a layout regression at two of the three sites.
- **A `fill` prop (equal-width buttons via `flex-1`) was added beyond the task's minimum prop list**, needed for `AuthModal`'s two-tab switcher, which was `flex-1` at both buttons pre-migration - no prop set in the brief's `value`/`onChange`/`size`/`className` list could express that without it.
- **Minor, deliberate padding homogenization at 2 of 3 sites**, in the direction the phase's own goal ("replace fragmented tab/period/type switchers" into one shared visual style) invites: `DashboardView`'s pills (`size="sm"`, `px-3.5 py-1.5`) and `AuthModal`'s tabs (also `size="sm"`, previously no horizontal padding at all - reliant on `flex-1` alone) now share one padding scale rather than each retyping its own. `TransactionForm` keeps its own `size="md"` (`py-2 px-2 sm:px-3`) unchanged, matching its distinct grid-cell touch-target sizing.
- **AuthModal's label text is verbatim `Sign In` / `Create Account`**, not `Sign In` / `Sign Up` as the phase brief's own prose said - the brief's guardrail ("preserve exact label texts verbatim") was followed against the actual source, not the brief's paraphrase; no test asserts on `Create Account`'s literal text, only on the ids (`auth.spec.ts:36,40`).

---

## Phase 28 — transaction row cells (approved to execute) · High risk

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T49 | Atomic `TxTypeIcon`/`TxAmount`/`TxCategoryChip`/`TxSoftDeletedTag` cells; adopt across 4 transaction surfaces | new `src/components/transaction/TxCells.tsx`; `TransactionTableRow.tsx`, `RecentTransactionsTable.tsx`, `WalletPopupModal.tsx`, `DiaryEntryCard.tsx` | High | High | 5h | done | — | 91687df | tsc clean; `soft-delete`+`transaction`+`date-boundary` chromium 9/9; `CI=true npx playwright test` 87/87, 0 retries; `npm run build` succeeds in 20.15s | 4 atomic cell primitives (not one row wrapper) shared across all 4 renderers; every existing `tr[id^="tx-row-"]` id and the exact `[Soft Deleted]` string preserved; `RecentTransactionsTable`'s amount glyph gained the canonical `MINUS` sign for TRANSFER/DEBT_REPAYMENT/ADJUSTMENT (previously blank - a real fix, not a preserved behavior) |

**Verification**

```
npm run lint                                                                                   # tsc --noEmit: clean, 0 errors
npx playwright test tests/soft-delete.spec.ts tests/transaction.spec.ts tests/date-boundary.spec.ts --project=chromium   # 9/9 passed
CI=true npx playwright test                                                                    # 87/87 passed, 0 retries
npm run build                                                                                   # built in 20.15s
```

**Notes on execution:**
- **Deliberately 4 atomic cells, not one `<TxRow>` wrapper**, per this task's own explicit instruction and the discipline `implementation-roadmap.md` already set for this exact surface at T25 ("consider dropping" a unified row component - see the Deferred table). `TransactionTableRow` renders `<tr>`/`<td>`s, `RecentTransactionsTable` the same but with a different column set, `WalletPopupModal`'s activity list is `<div>`-based with no table at all, and `DiaryEntryCard`'s outflow rows are a third, simpler `<div>` shape - one row component could not span all three without either a large prop surface or per-caller escape hatches that would defeat the point of sharing it. Only the genuinely-identical sub-pieces (an icon-in-a-box, a formatted signed amount, a category chip, a soft-deleted tag) were extracted; each renderer keeps its own cell/row markup and calls into these where it fits.
- **`TxTypeIcon`/`TxAmount` both take an override (`tintOverride`/`colorClassName`) precisely because 2 of the 3 icon/amount call sites have already diverged from `TX_TYPE_META`'s own canonical scheme** - a divergence `txTypeMeta.ts`'s own T35 doc comment already flagged and declined to force-unify. `WalletPopupModal`'s activity-list icon tint (bg-*-50/dark:*-950/60) and amount color (income-emerald-else-stone, no distinct debt-repayment color) both differ from `TransactionTableRow`'s (bg-*-100/dark:*-950/50, income-emerald/debt-amber/else-stone); `RecentTransactionsTable`'s amount color is a 4th scheme entirely (emerald/rose/amber/indigo). Passing each site's own exact string through the override preserves every one of these pixel-for-pixel rather than picking a winner and calling the other two visual regressions.
- **`RecentTransactionsTable`'s Type column (the `ArrowDownLeft`/`ArrowUpRight`/`ArrowLeftRight`/`TrendingDown` icon+label row, `lg:table-cell` only) was left untouched, not migrated onto `TxTypeIcon`.** It uses a 3rd icon set (`ArrowLeftRight` for TRANSFER and `TrendingDown` for DEBT_REPAYMENT, versus `TX_TYPE_META`'s `RefreshCw`/`Landmark`) and its own label text (`Repayment`, not `Debt Repayment`) - adopting `TxTypeIcon` there would render the wrong icon, not just a differently-styled one. Same reasoning `txTypeMeta.ts` already documented for this exact column when T35 shipped.
- **The one deliberate correctness fix: `TxAmount` always renders `TX_TYPE_META[type].sign`, the canonical `+`/`MINUS` (U+2212) glyph, rather than each site re-deriving its own ternary.** `RecentTransactionsTable`'s pre-existing inline ternary (`tx.type === 'INCOME' ? '+' : tx.type === 'EXPENSE' ? MINUS : ''`) rendered **no sign at all** for TRANSFER/DEBT_REPAYMENT/ADJUSTMENT - the only one of the 4 renderers with that gap. Adopting the shared component closes it. No spec asserts on the literal sign character for those types, so this was verified by reading the diff, not by a new test.
- **`DiaryEntryCard`'s outflow-row amount also gained the canonical `MINUS` (U+2212) glyph in place of a hardcoded ASCII hyphen** (`-{formatCurrencyAmount(...)}` → `<TxAmount ... colorClassName="text-rose-600 dark:text-rose-400" />`). Its color (always rose, regardless of whether the underlying type is EXPENSE or DEBT_REPAYMENT - this list's own "outflow" framing, distinct from `TransactionTableRow`'s per-type debt-amber) is passed through the same `colorClassName` override, unchanged from before.
- **`TxCategoryChip` is a thin pass-through over `CategoryChip` (Phase 26), not a new visual component.** It renders `null` when no category is given, so each call site's own "no category" fallback branch (a debt `Badge` in `TransactionTableRow`, an em dash or type-name string in both table renderers) stays local and unchanged - only the category-present branch was actually duplicated across renderers.
- **`DiaryEntryCard`'s per-item category display (a 2px color dot + plain name text, `:152`) was left as-is, not converted to `TxCategoryChip`.** It was never a chip - a different, simpler shape - so there was nothing to adopt losslessly there.
- **`WalletPopupModal`'s activity list has no category display at all** (it never rendered one pre-migration) - nothing to adopt there beyond the icon and amount.

**Deliberately not done**

- **T25 (a single unified `<TxRow>`/`<TransactionRow>` component spanning all 4 surfaces) remains explicitly out of scope**, per this phase's own guardrail and the Deferred table's existing "consider dropping" note - the 4 surfaces' underlying DOM shapes (`<tr>` vs `<div>`, different column sets, no table at all) are too structurally different to share one component without a large conditional prop surface.
- **`RecentTransactionsTable`'s Type column's own icon set/labels were not unified onto `TX_TYPE_META`** - a real icon mismatch, not just a color one; see notes.
- **No visual regression testing beyond Playwright's text/id assertions** - the amount-glyph fix and every preserved tint/color scheme were verified by reading the diff against each file's pre-change source, not a pixel-level screenshot comparison.

---

## Phase 29 — roadmap closeout & documentation alignment (approved to execute)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T50 | ADRs 0006–0008; final metrics column; promote verified constraints into `CLAUDE.md` | new `docs/audit/decisions/0006-ui-primitive-inventory.md`, `0007-transaction-entry-consolidation.md`, `0008-wallet-surface-ownership.md`; `docs/audit/baseline-metrics.md`, `task-ledger.md`, `refactor-log.md`; `CLAUDE.md` | High (closeout) | Low | 3h | done | Phases 19-28 (all done) | 5132ef6 | tsc clean; `CI=true npx playwright test` 87/87, 0 retries; `npm run build` succeeds in 7.60s | 3 new ADRs; final metrics column appended (entry chunk 169.08 kB → 176.93 kB, +4.6%; `tsc` 2.40s → ~4.15s warm median; 39/39 → 87/87 tests; source LOC 9,529 → 11,261); `CLAUDE.md` gains a UI-primitives-inventory section, corrects the stale wallet-forms-ownership line, and documents the transaction-entry-engine convention |

**Verification**

```
npm run lint                     # tsc --noEmit: clean, 0 errors
CI=true npx playwright test      # 87/87 passed, 0 retries
npm run build                    # built in 7.60s
```

**Notes on execution:**
- **Every ADR and every `CLAUDE.md` promotion was written only after reading the current source** (`App.tsx`, `WalletPopupModal.tsx`, `WalletsView.tsx`, `DebtsView.tsx`, `DashboardView.tsx`, `TransferFundsModal.tsx`), not transcribed from the Phase 22/23 ledger notes alone. This surfaced one real drift: `CLAUDE.md`'s pre-existing "Wallet forms are shared: `AddWalletForm`/`WalletTransferForm`... used by both `WalletsView` and `WalletPopupModal`" line (written at Phase 18/T30, before Phase 23 existed) is stale — as of T41, neither view mounts those forms directly; their only 2 call sites are the shell-level `AddWalletModal`/`TransferFundsModal`. Corrected as part of this promotion, per the promotion rule's own "only what holds true right now" standard - not left as a known-stale note.
- **ADR 0007 explicitly does not claim "transfer" was unified onto `TransactionForm`.** Two transfer paths coexist by design: `TransactionForm`'s own TRANSFER type option (for the 3 generic-entry consumers) and the dedicated `WalletTransferForm`/`TransferFundsModal` (for the wallet-first "Transfer" button/shortcut, Phase 23's decision). Writing the ADR surfaced that the roadmap brief's framing ("unifying standard/transfer/repay") slightly overstates what actually happened for transfer specifically; the ADR documents the real split with a cross-reference to 0008, rather than repeating the imprecise framing as fact.
- **No `src/` behavior changed in this phase** - purely documentation (3 ADRs, a metrics column, ledger/log entries, `CLAUDE.md` promotions). The verification gate runs anyway, per this phase's own instruction, to confirm the documentation-only claim is actually true and nothing else drifted since Phase 28's commit.
- **The `tsc --noEmit --extendedDiagnostics` timing increase (2.40s → ~4.15s warm median) is reported without attributing it to any single phase.** The file count grew from 373 to 426 (+14%, tracking the roadmap's own new modules and Phase 4's `tests/` inclusion), but three runs captured back-to-back on this measurement ranged 2.70s-4.18s on their own, meaning machine-load variance is at least as large a factor as the file-count growth. See `baseline-metrics.md`'s own caveat.

**Deliberately not done**

- **`T25` (unify the 4 transaction-row renderers into one component) and `T18` (`Promise.all` the bulk-import wallet updates) remain in the Deferred table below, unstarted.** Both are explicitly blocked on a separate approval this closeout phase was not asked to obtain — see that table's own notes, and ADR 0006's "Options considered (a)" for why a single unified transaction-row component was rejected rather than merely postponed.
- **No re-render scenario replay (S1-S5) was re-run for this closeout.** `baseline-metrics.md`'s existing Post-Phase-4 and Post-T34 snapshots stand; nothing in Phases 19-28 changed a re-render-affecting subscription pattern in a way this closeout's own scope (ADRs + metrics + `CLAUDE.md`) asked to re-verify.

---

## Phase 30 — Categories & Smart Rules hub, category CRUD, duplicate-category bug fix (approved to execute) · High risk

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T51 | Root-cause the triple-duplicated default categories bug; heal existing data | `FinanceContext.tsx` (`seedInitialUserAccount` re-entrancy guard, `keywordRulesRef`); new `src/utils/categoryUtils.ts` (`dedupeCategoriesByName`), applied at both the local-storage initializer and `loadSupabaseData`'s categories branch | High (correctness) | Med | 2h | done | — | 8f7e4cd | tsc clean; `CI=true npx playwright test` 99/99, 0 retries | Root cause identified: the auth-state effect calls `loadSupabaseData` from both an explicit `getSession()` and `onAuthStateChange`'s own guaranteed initial fire (and, in dev, StrictMode double-invokes the whole effect) - any combination can race `seedInitialUserAccount` for the same brand-new (wallets-empty) account, each racer independently inserting its own full set of starter categories. Closed with an `isSeedingRef` mutex; existing corrupted state healed non-destructively (losing duplicates marked `isDeleted: true`, not dropped, so any historical reference by id still resolves) |
| T52 | Category CRUD: `addCategory`/`updateCategory`/`deleteCategory`, guarded delete | `FinanceContext.tsx` (3 new mutators + `FinanceActionsContextType`); new `CategorySchema` in `zodSchemas.ts` | High | Med | 2h | done | T51 | 8f7e4cd | same gate | 0 → 3 category mutators; delete guarded against system defaults and anything referenced by an active transaction or keyword rule (checked both client-side, to hide the control, and server-authoritatively in the action itself) |
| T53 | Merge `KeywordRulesView` into a new `CategoriesView` (Categories management + Smart Rules sub-tabs via `SegmentedControl`) | new `src/views/CategoriesView.tsx`; deleted `src/views/KeywordRulesView.tsx` | High | Med | 3h | done | T52 | 8f7e4cd | same gate | 1 standalone view → 1 hub with 2 `SegmentedControl` sub-tabs; every Smart Rules element id/`data-testid` ported verbatim; Categories half built from `SectionHeader`/`Card`/`CategoryChip`/`EmptyState`/`Modal`/`ConfirmDialog`, per this phase's UI-consistency guardrail |
| T54 | Rename nav tab "Smart Rules" → "Categories" | `Navbar.tsx` (`ActiveTab` union, `NAV_ITEMS`), `MobileBottomNav.tsx` (`NAV_ITEMS`), `App.tsx` (`TABS_ORDER`, lazy import, switch case) | Med | Low | 45m | done | T53 | 8f7e4cd | same gate | `ActiveTab`'s `'keywords'` member → `'categories'`; icon `Sparkles` → `Tags` (kept `Sparkles` for the Smart Rules sub-tab's own sandbox card) |
| T55 | Sweep for hardcoded `$` in transaction submit buttons/labels | `TransactionsView.tsx` (CSV import modal subtitle) | Low | Low | 30m | done | — | 8f7e4cd | same gate | 0 hardcoded `$` currency glyphs found anywhere in `src/` (already closed by Phases 4/21's `APP_CURRENCY_SYMBOL`/`MINUS` adoption) - the one real `$` found was unrelated to currency: a literal, unrendered `$\rightarrow$` LaTeX fragment plus a factually wrong "MySQL" mention in the CSV import subtitle, fixed to a real arrow character and accurate wording |
| T56 | Test safety: migrate `tests/keywords.spec.ts`; add `tests/categories.spec.ts` | `tests/keywords.spec.ts` (nav target + one sub-tab click); new `tests/categories.spec.ts` (4 tests) | High | Low | 1.5h | done | T53, T54 | 8f7e4cd | `keywords`+`categories`+`transaction` chromium 10/10; `CI=true npx playwright test` 99/99, 0 retries; `npm run build` succeeds in 5.31s | Suite: 29 tests/12 files/87 runs → 33 tests/13 files/99 runs. New assertions: default categories appear exactly once in the management list; a system category has no delete control; the rule-assignment category `<select>` has zero duplicate options; creating a category makes it appear in both the management list and the rule-assignment dropdown immediately (Local Storage Mode, no round-trip) |

**Verification**

```
npm run lint                                                                  # tsc --noEmit: clean, 0 errors
npx playwright test tests/keywords.spec.ts tests/categories.spec.ts tests/transaction.spec.ts --project=chromium   # 10/10 passed
CI=true npx playwright test                                                  # 99/99 passed, 0 retries
npm run build                                                                 # built in 5.31s; new CategoriesView-*.js chunk, 13.07 kB / 3.43 kB gzip
```

**Notes on execution:**
- **The duplication bug could not be reproduced in this sandbox** (no `.env` configured here, so `isSupabaseConfigured` is `false` and the app runs entirely in offline Local Storage Mode, where `seedInitialUserAccount` never executes at all) - the fix was derived by reading the auth-state effect and the seed function for a mechanism that could actually produce it, not by reproducing the symptom directly. The mechanism (two-to-four concurrent `loadSupabaseData` calls racing an unguarded insert on a brand-new account) is real and independent of the exact multiplier a given user saw; the `isSeedingRef` mutex closes it regardless of how many racers there are.
- **Dedup is applied at the state-commit layer, exactly as this phase's own guardrail specified**, not only at the dropdown/render layer - `dedupeCategoriesByName` runs before `setCategories` in both the local-storage initializer and `loadSupabaseData`. This is safe with zero risk of orphaning a historical reference: the only realistic way duplicates form is at first-ever seeding of a brand-new account, before any transaction can exist yet to reference one of the soon-to-be-duplicate ids. Every consumer that already did `categories.filter((c) => !c.isDeleted)` before creating a `<select>` (`QuickAddModal`, `TransactionsView`, `DebtsView`, and now `CategoriesView`) inherited the fix with zero further changes, since the losing duplicates are marked `isDeleted: true` rather than removed from the array.
- **`deleteCategory`'s guard is enforced in the action itself, not only by the UI hiding the button** - `CategoriesView` also precomputes `inUseCategoryIds` to hide/disable the delete control for a non-deletable row (better UX, no dead-end confirm-then-fail flow), but the mutator re-checks `isSystem` and both reference sources independently, per this codebase's existing double-enforcement discipline (Zod validation lives in the action, not just the form).
- **`ActiveTab` lives in `Navbar.tsx`, not `types.ts`.** The phase brief named `types.ts` as holding the union; it doesn't and never has - `ActiveTab` is defined and exported from `Navbar.tsx` and imported by `App.tsx`/`MobileBottomNav.tsx`. Renamed it in place rather than relocating it to match the brief's incorrect premise, which would have been an unrelated, out-of-scope move.
- **The tab id itself was renamed (`'keywords'` → `'categories'`), not just the label**, since only one test call site referenced it (`tests/keywords.spec.ts:14`, already being updated by this same phase) - a stale id under a new label would have been a permanent, pointless mismatch for zero test-compatibility benefit.
- **Category type is not editable after creation** (`updateCategory` only accepts `name`/`color`). A category's type is load-bearing for every transaction already recorded under it, and for DEBT_REPAYMENT/ADJUSTMENT specifically, for the fixed system taxonomy other mutators resolve by type - changing it after the fact would make historical records visually inconsistent with what they actually were when recorded.
- **The Add Category form offers only EXPENSE/INCOME as creatable types.** TRANSFER/ADJUSTMENT/DEBT_REPAYMENT each already have exactly one fixed system category that other mutators resolve by type, not by user choice among several - there is nothing for a second user-created category of those types to do.
- **`Category.icon` has no editor.** Confirmed via `grep -rn "category.icon\|c.icon\|cat.icon" src/` that the field is stored (and round-tripped through Supabase) but rendered nowhere in the app today - only `color` drives any visible category UI (`CategoryChip`, the management list's dot). Building an icon picker for a field nothing displays would be speculative UI for a non-existent payoff; new categories default it to `'tag'`, matching `loadSupabaseData`'s own existing fallback.

**Deliberately not done**

- **No admin/cleanup tool was built to surface or physically remove already-duplicated rows in a real Supabase project's `categories` table.** This phase's fix heals the *symptom* (what a category picker/list shows) non-destructively and prevents *new* duplicates; it does not - and given no database access exists in this sandbox, could not - run any destructive SQL against a live project's already-corrupted data. A user who hit this bug before this fix shipped will still have the extra rows physically present in their database, just permanently marked deleted and therefore invisible everywhere the app already filters on `isDeleted`.
- **No domain hook (`useCategories`) was introduced.** Per `CLAUDE.md`'s existing "state no hook covers" carve-out for categories/diary entries/sessions, `CategoriesView` reads `useFinanceState()`/`useFinanceActions()` directly, matching how every other category consumer in the app already does.
- **Editing a category's icon, and reordering/grouping categories, were not built** - neither was asked for, and (per the icon note above) the field has no existing renderer to serve.

---

## Phase 31 — visual hierarchy polish, math input UX, mobile ergonomics verification, Supabase cleanup: T57-T60 (2026-09-20, commit `f053fcf`)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T57 | Dashboard visual hierarchy: tabular-figure alignment on financial numbers; balance the reclaimed-6-column CTA card against its 2-card sibling column | `TotalWealthHero.tsx`, `CashflowMetricsCards.tsx`, `DashboardView.tsx` | Med | Low | 1h | done | — | f053fcf | tsc clean; `theme.spec.ts`/`transaction.spec.ts` 8/8 chromium; 99/99 full suite; build succeeds | `items-start` → `items-stretch` on the T22 4-way grid so the CTA card's `h-full` (already present, previously inert) actually matches the right column's 2-card height; `tabular-nums` added alongside every existing `font-mono` financial figure (hero net worth, 3 cashflow cards) so digit columns no longer shift width as values animate |
| T58 | `InlineMathInput` UX: non-intrusive formula hint, quick-amount chips for rapid expense entry | `InlineMathInput.tsx` | Med | Low | 1.5h | done | — | f053fcf | tsc clean; `transaction.spec.ts` math-expression test (line 112) still green — `input[name="amount_expression"]` and `safeEvaluateMath` untouched | Extracted the existing inline evaluation body out of `handleInputChange` into `evaluateAndNotify` (pure refactor, byte-identical logic) so the new quick-amount chips (+100/+500/+1,000) can reuse the same evaluation path `onChange` uses, rather than duplicating or bypassing it. Chips render only below `sm` (`flex sm:hidden`), chaining onto whatever's already typed with `+` the same way the existing quick-operator row does |
| T59 | Mobile ergonomics: safe-area padding, backdrop blur, ≥44px touch targets on `MobileBottomNav` | none | Low | — | 15m | **verified, no change** | — | — | read `MobileBottomNav.tsx` in full | All 3 requirements were already shipped: `pb-[env(safe-area-inset-bottom,0.5rem)]` (safe-area), `backdrop-blur-md` on the nav's light/dark background, `min-h-[48px]` per tab button (>44px, plus a `max-w-lg`-constrained 7-column grid keeping tap width comfortable). Not touched — editing working code to match a brief that predates its own prior fix would be a no-op diff at best and a visual regression at worst |
| T60 | Supabase migration: physically dedupe already-corrupted `categories` rows in a live project, re-pointing dependents first | new `supabase/migrations/20260920_dedupe_categories.sql` | Med | Med | 1.5h | done | — | f053fcf | SQL reviewed against the assumed schema comment block in `20260909_transfer_funds.sql`; not executed against a live database (no Supabase project connected in this sandbox — see note below) | Fills the gap Phase 30's own ledger entry named ("No admin/cleanup tool was built... could not run any destructive SQL against a live project's already-corrupted data"). Single `begin`/`commit`-wrapped transaction: ranks active rows per `(user_id, lower(btrim(name)))` by `created_at`/`id`, re-points `transactions.category_id` and `keyword_rules.category_id` off every loser onto its winner, then hard-deletes the now-unreferenced loser rows. Idempotent — a second run finds no group with >1 active row per key |

**Notes on execution:**
- T57/T58 verified against the full local gate: `npm run lint` (clean), `npx playwright test tests/transaction.spec.ts tests/theme.spec.ts tests/categories.spec.ts --project=chromium` (11/11), `CI=true npx playwright test` (99/99, 0 retries, 5.1m, 1 worker), `npm run build` (7.54s, 0 chunks over 500 kB warning threshold).
- **T60 could not be executed against a real database** — this sandbox has no Supabase project connection (confirmed: no `mcp__supabase__list_projects` result attempted, matching Phase 30's own note that "no database access exists in this sandbox"). The migration file is written, follows this repo's one existing migration's conventions (assumed-schema comment block, `security`-conscious re-pointing before delete, explicit idempotency argument in its header comment), and is ready to apply via `supabase db push` or the Supabase SQL editor — but its correctness rests on schema-comment inference the same way `20260909_transfer_funds.sql` already documents its own assumption, not on a live run.
- **Duplicate key for T60 deliberately excludes `category.type`**, matching `dedupeCategoriesByName` (`src/utils/categoryUtils.ts`) exactly — see that file's own comment. Keeping the client healing pass and this one-time server cleanup on the same duplicate definition means neither can disagree with the other about what counts as a duplicate.
- **T60 hard-deletes the loser category rows rather than soft-deleting them**, unlike `dedupeCategoriesByName`'s `isDeleted: true` marking. This is a deliberate difference, not an inconsistency: the client pass runs on every read against rows that might already be referenced by history, so it can never risk removing an id; this migration runs once, re-points every reference first within the same transaction, and only then removes rows that are bug artifacts no user ever chose to create or delete — there is nothing left pointing at them to break.

---

## Phase 32 — audit report and soft-delete balance desync: T61-T63 (2026-09-20, commit `c0c1371`)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T61 | Write second-pass performance/correctness audit report; capture missing Phase 30-31 baseline column | `docs/audit/perf-audit-report.md` (new), `docs/audit/baseline-metrics.md` | High | Low | 2h | done | — | c0c1371 | `npm run clean && npm run build` succeeded, 20.49s, 0 chunk-size warnings | Entry chunk 176.93 kB (Phase 29) → 180.57 kB (Post-Phase-31, +2.1%); `vendor-icons` 25.89 → 28.06 kB (Categories hub); new `CategoriesView-*.js` chunk (13.07 kB); `KeywordRulesView` chunk retired (folded into Categories hub, Phase 30) |
| T62 | Characterization test: wallet balance invariant across soft-delete/restore | `tests/soft-delete.spec.ts` (new 4th test), `CLAUDE.md` (suite counts) | High | Low | 1.5h | done | — | c0c1371 | 4/4 chromium (`npx playwright test tests/soft-delete.spec.ts --project=chromium`) | Suite 33 tests/99 runs → 34 tests/102 runs. Test asserts against `#wallet-entity-wal-cash`'s own balance text, not a dashboard `AnimatedCounter` total, so it stays independent of Phase 34's `AnimatedCounter` change |
| T63 | Fix `setTransactionDeleted`: compute wallet balances from `walletsRef` before the `setWallets` updater, not inside it | `src/context/FinanceContext.tsx:1525-1585` | High | Med | 1h | done | — | c0c1371 | `npm run lint` clean; `tests/soft-delete.spec.ts`/`transaction.spec.ts`/`storage-persistence.spec.ts` 10/10 chromium; `CI=true npx playwright test` 102/102, 0 retries, 6.7m, 1 worker; `npm run build` succeeded, entry chunk unchanged at 180.57 kB (pure logic fix, no bundle impact) | The two remote `wallets` UPDATE calls (`:1566`,`:1570`) now actually fire on an authenticated soft-delete/restore of a TRANSFER — 1 remote write → 3. That increase is the fix: cloud wallet-balance divergence per soft-delete goes from "every time" to zero |

**Notes on execution:**
- **T63's bug was invisible to every existing test and to `npm run lint`.** `sourceNewBal`/`destNewBal` are declared `number | null`, so the `!== null` guard at `:1566`/`:1570` type-checks whether or not the preceding `setWallets` updater actually ran in time to assign them — TypeScript has no way to know the assignment is racing a scheduled state update. Every assertion in `soft-delete.spec.ts` before T62 checked the `isDeleted` flag, never the balance, so the bug shipped undetected through every phase since the feature was written.
- **T62 cannot exercise the cloud half of the bug.** Every Playwright spec runs unauthenticated (`isAuthenticated === false`), so the entire remote-write branch at `FinanceContext.tsx:1560-1574` — including the one T63 fixes — is unreachable under this harness. T62 guards the *local* balance invariant only (already correct before T63; the test passed against the pre-fix code too, confirming the bug was cloud-only). The cloud-side fix is verified by code review against `addTransaction`'s proven pattern, not by an automated test — see `perf-audit-report.md`'s Testing section and this phase's `refactor-log.md` entry for why that gap is accepted rather than papered over.
- **`perf-audit-report.md`'s cut list removed ~10 findings from the original sweep after reading the code**, most notably: 4 "unmemoized array prop" sites that turned out to feed non-memoized children (defeat nothing), `deleteKeywordRule`'s hard-delete (correct as-is — `KeywordRule` has no `isDeleted` field), and a debt-progress-formula "divergence" that is unreachable because `DebtSchema.totalAmount` is `.positive()`. Two findings were *upgraded*: `useIdempotencyKey.ts`'s bare `crypto.randomUUID()` is a white-screen crash on insecure-origin LAN dev, not a style nit (scheduled T68); deferring the shell modals removes `vendor-math` (110.72 kB gzip) from the critical path, the largest bundle win in the whole roadmap (scheduled T76).

## Phase 33 — write-path hardening: prune, error checks, rollback parity: T64-T69 (2026-09-20, commit `1e0e4ad`)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T64 | Prune dead mutators: `repayDebtAtomic`/`repayDebt`, `settledDebts` memo, unused `useDebts` return entries, `updateWallet` off the public actions context | `src/context/FinanceContext.tsx`, `src/hooks/useDebts.ts`, `CLAUDE.md` | Med | Low | 1h | done | — | 1e0e4ad | `npm run lint` clean | `useDebts.ts` 95 → 80 lines; `FinanceActionsContextType` 23 → 21 members; `unsettledDebts` memo kept (feeds `debtMetrics.activeCount`) |
| T65 | `setTransactionDeleted`: snapshot-based rollback, wallet-balances-first/flag-last remote ordering, remote compensation, `MutationResult` return | `src/context/FinanceContext.tsx:1523-1638`, `src/hooks/useTransactions.ts` | High | Med | 2h | done | T63 (Phase 32) | 1e0e4ad | 4/4 `soft-delete.spec.ts` chromium | Failure path now compensates committed wallet writes and restores local state instead of leaving them applied with a rolled-back flag |
| T66 | Wallets & debts: error check + rollback + `MutationResult` on `updateWallet`/`deleteWallet`, `settleDebt`/`deleteDebt`; `ConfirmDialog` gains an `error` prop; both delete-confirm call sites surface the message and stay open on failure | `src/context/FinanceContext.tsx`, `src/hooks/useDebts.ts`, `src/components/ui/ConfirmDialog.tsx`, `src/views/WalletsView.tsx`, `src/views/DebtsView.tsx` | High | Med | 3h | done | T64 | 1e0e4ad | `npx playwright test tests/debts.spec.ts --project=chromium` 1/1; `wallets.spec.ts`/`wallet-forms.spec.ts` unaffected (full suite below) | `ConfirmDialog`'s new `error` prop is additive/optional - every other call site (`WalletsView` reload-confirm not applicable, other consumers) is unaffected |
| T67 | Categories, diary, keyword rules: error check + rollback + `MutationResult` on `updateCategory`/`deleteCategory`/`deleteDiaryEntry`/`deleteKeywordRule` | `src/context/FinanceContext.tsx` | Med | Low-Med | 2h | done | T64 | 1e0e4ad | `npx playwright test tests/categories.spec.ts --project=chromium` 4/4 | `deleteKeywordRule` stays a hard delete (no `isDeleted` field on `KeywordRule`); its rollback re-inserts at the original array index rather than restoring a flag |
| T68 | Centralized safe ID generator: new `src/utils/ids.ts`, `useIdempotencyKey.ts` calls it instead of bare `crypto.randomUUID()` | `src/utils/ids.ts` (new), `src/context/FinanceContext.tsx`, `src/hooks/useIdempotencyKey.ts` | Med | Low | 30m | done | — | 1e0e4ad | `npm run lint` clean | Fixes a white-screen crash on insecure-origin LAN dev (`crypto.randomUUID` is `undefined` outside a secure context); not verifiable by Playwright, which runs on `localhost` (a secure context) - see Deliberately-not-done |
| T69 | `addTransaction`: `cloudRevisionRef` counter guards its rollback against clobbering a mid-flight realtime reload | `src/context/FinanceContext.tsx` | Med | Med | 1.5h | done | — | 1e0e4ad | `npx playwright test tests/transaction.spec.ts tests/csv.spec.ts tests/storage-persistence.spec.ts --project=chromium` (covered in full suite below) | Not directly measurable - requires two authenticated clients and an induced write failure; no harness exists (see Deliberately-not-done) |

**Full gate (all 6 tasks):** `npm run lint` clean; `npx playwright test tests/soft-delete.spec.ts tests/debts.spec.ts tests/categories.spec.ts --project=chromium` 9/9; `CI=true npx playwright test` 102/102, 0 retries, 6.0m, 1 worker; `npm run build` succeeded in 8.21s, 0 chunk-size warnings, entry chunk 180.57 → 183.07 kB (+2.5 kB raw / +0.36 kB gzip - expected, new error-handling/rollback code lands in the always-eager `FinanceContext.tsx`).

**Notes on execution:**
- **T64 was sequenced first in the phase, as the plan required**, so T65-T67's hardening never touched code that was about to be deleted. `settleDebt`'s history now dead-ends at the same `addTransaction` path `DebtsView`'s repay modal already used - see `docs/audit/decisions/0007-transaction-entry-consolidation.md`.
- **`updateWallet` is no longer public API but is not deleted** - it remains a `useCallback` inside `FinanceProvider`, now the one place wallet-write error handling and rollback live, and `deleteWallet` calls it and forwards its `MutationResult`. This keeps the hardening in one place instead of duplicating it between `updateWallet` and `deleteWallet`.
- **`ConfirmDialog`'s new `error` prop is the one shared-primitive change in this phase.** It follows the same `{errorVar && <div className={ERROR_BANNER_CLASS}>{errorVar}</div>}` shape every other write form in this app already uses (`TransactionForm`, `AddWalletForm`, `WalletTransferForm`, `CategoriesView`) - not a new pattern, just this primitive's first use of an existing one. Both `WalletsView` and `DebtsView`'s delete-confirm flows now keep the dialog open with the reason shown on a rejected write, instead of closing as if the delete succeeded.
- **`deleteDebt`/`settleDebt` return `MutationResult` but `handleSettle` in `DebtsView` does not surface it** - `settleDebt` is a direct button action, not gated behind `ConfirmDialog` (the plan's UI-wiring instruction named only the two delete-confirm sites). Its rollback still applies on failure; only the UI surfacing was scoped to the confirm dialogs.
- **T68's fix cannot be exercised by this suite.** Every Playwright spec runs against `localhost` or the dev server's own origin, both secure contexts, so `crypto.randomUUID` is always defined during the run - the exact condition the fix guards against never occurs under test. Verified instead by reading `src/utils/ids.ts`'s fallback branch and confirming `useIdempotencyKey.ts`/`FinanceContext.tsx` both now route through it.
- **T69's guard cannot be exercised by this suite either** - it requires a second authenticated client committing a realtime-visible change while a first client's `addTransaction` is mid-flight and then fails, which needs two live Supabase sessions and an induced failure; this sandbox has neither. Verified by code review against the reasoning in `cloudRevisionRef`'s own comment, not by a passing test.

## Phase 34 — `AnimatedCounter` direct DOM write: T70 (2026-09-20, commit `155c882`)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T70 | Replace `AnimatedCounter`'s per-frame `setState` with a direct `ref.current.textContent` write; `useLayoutEffect` seeds the initial `'0.00'` | `src/components/AnimatedCounter.tsx`, new `docs/audit/decisions/0009-animated-counter-dom-writes.md` | High | Low-Med | 2h | done | — | 155c882 | `npm run lint` clean; `tests/date-boundary.spec.ts`/`theme.spec.ts` 5/5 chromium; `CI=true npx playwright test` 102/102, 0 retries, 5.1m, 1 worker; `npm run build` succeeded in 6.92s, entry chunk 183.07 → 183.18 kB (+0.11 kB, negligible) | Throwaway `window.__acFnCalls` counter probe (added and removed within this task, never committed - see `refactor-log.md`): function-body executions **590 (S1 cold load) → 16**, **636 (S2 one write) → 16** |

**Notes on execution:**
- **ADR 0009 was written before the code change**, per `README.md`'s convention. It documents why `useTransform`/`motion.span` (the framer-motion-idiomatic alternative) was rejected: framer-motion has no built-in way to bind a `MotionValue<string>` to a DOM text node outside React's render cycle the way it binds numeric values to `opacity`/`x`, so that route would still re-render on every frame - the exact cost this task removes.
- **The render-count claim was independently re-verified, not just asserted from the ADR's back-of-envelope math.** A temporary `(window as any).__acFnCalls++` counter was added to the top of `AnimatedCounter`'s function body and a throwaway `tests/_tmp-ac-probe.spec.ts` (never committed) measured it across the same S1 (cold load)/S2 (one write) scenarios `baseline-metrics.md`'s Phase-4 Profiler harness used. Result: 590/636 → 16/16. Both the counter line and the probe spec were removed before this phase's commit - `grep -rn "__acFnCalls" src/ tests/` returns nothing on the committed tree, matching the precedent `baseline-metrics.md`'s own "Post-T34 (`Navbar` de-subscription)" section set for this exact kind of targeted, disposable re-measurement.
- **This is a function-body-execution count, not identical to the original Profiler harness's `__rc` metric**, but it measures the same thing the original claim was about: how many times React invoked the component's render function. The remaining 16 executions on both S1 and S2 are real mount/prop-change renders (multiple counter instances × StrictMode's ×2), not per-animation-frame `setState` calls - the category of render this task set out to eliminate is gone, not merely reduced.
- **`currencyPrefix`, `duration`, and the `[0.16, 1, 0.3, 1]` ease curve are byte-identical to the pre-refactor component** - confirmed by diff, not just by intent. All 6 call sites (`CashflowMetricsCards.tsx`, `TotalWealthHero.tsx`, `WalletAccountsGrid.tsx`, `NavbarLedgerStatus.tsx`, `WalletsView.tsx`) needed zero changes.

## Phase 35 — targeted render-cost fixes: T71-T75 (2026-09-20, commit `b9ed84f`)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T71 | Split `useTransactions`' `filteredTransactions` into a Stage 1 (no `wallets`/`categories` dependency) and a Stage 2 search pass that returns Stage 1 by reference when no search is active | `src/hooks/useTransactions.ts` | Med-High | Low | 1.5h | done | — | b9ed84f | `npx playwright test tests/transaction.spec.ts --project=chromium` 4/4 (search-filter test at `:79` exercises Stage 2 directly) | A wallet-balance change (a new `wallets` array reference) no longer invalidates `filteredTransactions` at all when no search is active - previously it forced a full re-filter of the entire ledger for a change that only ever affected a name lookup. `walletNameMap`/`categoryNameMap` are now `null` (not built) whenever no search is active, and only rebuild when the underlying collection changes or a search starts/stops, not per keystroke |
| T72 | `DashboardView`: hoist one shared `categoryMap`, removing a duplicate `buildLookupMap(categories)` call; replace `recentTransactions`' full sort+slice(5) with a single O(n) top-5 pass | `src/views/DashboardView.tsx` | Low-Med | Low | 1h | done | — | b9ed84f | `npx playwright test tests/transaction.spec.ts tests/date-boundary.spec.ts --project=chromium` (covered in full suite below) | `categoryBreakdown` no longer builds its own `catMap` - one `buildLookupMap(categories)` call instead of two per invalidation. `recentTransactions` is O(n) instead of O(n log n); tie-breaking among same-date transactions is no longer guaranteed identical to the old stable sort's order (see Deliberately-not-done) |
| T73 | `DebtsView.handleDelete`: store the debt id instead of closing over `debts`, resolving the target at render time | `src/views/DebtsView.tsx` | Low-Med | Low | 30m | done | — | b9ed84f | `npx playwright test tests/debts.spec.ts --project=chromium` 1/1 | `handleDelete`'s `useCallback` deps go from `[debts]` to `[]` - stable for the whole session. This is the one "unmemoized prop" finding from the audit that actually fed a memoized child (`DebtCardItem`, `React.memo`'d); every debt-array change previously invalidated every card's memo simultaneously regardless of which debt changed |
| T74 | Cap the CSV dry-run preview to 100 rendered rows with a "+N more rows omitted" footer | `src/views/TransactionsView.tsx` | Med (large imports only) | Low | 45m | done | — | b9ed84f | `npx playwright test tests/csv.spec.ts --project=chromium` 1/1 (imports 1 row - unaffected by the cap) | Preview DOM nodes: O(rows) -> min(rows, 100). The valid/invalid summary counts above the table already total the whole file; every valid row still commits regardless of whether it was rendered in the capped preview |
| T75 | `React.memo` on `AuthModal` and `ReloadPrompt` | `src/components/AuthModal.tsx`, `src/components/ReloadPrompt.tsx` | Low | Low | 15m | done | — | b9ed84f | `npx playwright test tests/auth.spec.ts tests/theme.spec.ts --project=chromium` (covered in full suite below) | Both are unmemoized children of `MainApp` per `baseline-metrics.md`'s own Phase-4 Profiler findings; neither subscribes to finance context (confirmed by import inspection), so `CLAUDE.md`'s memo-a-context-subscriber prohibition doesn't apply. Each now re-renders only on its own prop/state changes instead of on every `MainApp` render |

**Full gate (all 5 tasks):** `npm run lint` clean; `npx playwright test tests/transaction.spec.ts tests/debts.spec.ts tests/csv.spec.ts --project=chromium` 6/6; `CI=true npx playwright test` 102/102, 0 retries, 5.4m, 1 worker; `npm run build` succeeded in 6.98s, 0 chunk-size warnings, entry chunk 183.18 → 183.26 kB (+0.08 kB, negligible).

**Notes on execution:**
- **T71's name-lookup maps are `null` rather than empty `Map`s when unused**, and are declared as their own `useMemo`s (not built inline inside the Stage 2 filter body). This was a deliberate choice over inlining: gating on `hasSearchQuery` (a boolean) rather than `trimmedQuery` (a string that changes on every keystroke) means the maps rebuild only when `wallets`/`categories` changes or a search starts/stops - not once per character typed into the search box, which inlining them into the search-filter memo's own body would have caused.
- **T72's `recentTransactions` no longer guarantees the exact same tie-break order among same-`transactionDate` transactions that the old stable `.sort()` produced.** The new single-pass top-5 selection only replaces a currently-held candidate when a later transaction's date is *strictly* greater, so among equal dates the earlier-encountered transaction wins - which happens to match the old behavior in the common case (new transactions are prepended, so `transactions`' natural order is already newest-created-first) but is not proven identical in every case. This is a cosmetic ordering nuance in a 5-row dashboard preview widget, not a correctness issue, and no test asserts tie order.
- **T73 was the only one of the audit's five "unmemoized prop" findings scheduled as a task** - the other four (`DebtsView.tsx:281`, `DashboardView.tsx:247-251`, `TransactionForm.tsx:249-253`, `CategoriesView.tsx:164-167`) were cut in `perf-audit-report.md` (finding D1) after confirming their target components are not `React.memo`'d and therefore have nothing to defeat.
- **T75 is deliberately the smallest, lowest-priority task in this phase** - `perf-audit-report.md` itself flagged it as "cut first if the phase runs long." It shipped because the phase had room, not because its impact is comparable to T71's.

## Phase 36 — bundle: deferred shell modals, diary/papaparse split: T76-T77 (2026-09-20, commit `01fbdb8`)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T76 | Defer `QuickAddModal`/`TransferFundsModal`/`AddWalletModal` behind `React.lazy` + a per-modal `hasOpened` latch | `src/App.tsx`, new `docs/audit/decisions/0010-deferred-shell-modal-mounting.md` | High | Med | 2.5h | done | — | 01fbdb8 | `npm run lint` clean; `tests/wallet-forms.spec.ts tests/diary.spec.ts tests/transaction.spec.ts --project=chromium --repeat-each=2` 18/18; `tests/wallet-forms.spec.ts tests/theme.spec.ts --project=firefox --repeat-each=2` 14/14; `CI=true npx playwright test` 102/102, 0 retries, 6.3m, 1 worker; `npm run build` succeeded | **Entry chunk 183.26 -> 158.93 kB raw (-24.33 kB, -13.3%) / 50.89 -> 44.81 kB gzip (-6.08 kB, -11.9%). Network-level verification (throwaway `vite preview` + real-browser script, never committed): 0 requests for `vendor-math` during initial page load; 1 request the instant Quick Add is opened for the first time.** `useIdempotencyKey` also split into its own 6.99 kB/2.43 kB gzip chunk, no longer eager |
| T77 | Split `exportDiaryToJson` out of `csvExchange.ts` into new `src/utils/diaryExport.ts`; add a download-event assertion to `tests/diary.spec.ts` | `src/utils/diaryExport.ts` (new), `src/utils/csvExchange.ts`, `src/views/DiaryView.tsx`, `src/views/TransactionsView.tsx` (also imported it - fixed alongside), `tests/diary.spec.ts` | Low-Med | Low | 1h | done | — | 01fbdb8 | `npx playwright test tests/diary.spec.ts --project=chromium` 1/1, new download assertion passing | **`csvExchange-*.js` no longer exists as a separate chunk at all** - with `DiaryView` no longer importing it, `TransactionsView` became `csvExchange.ts`'s sole consumer, so Rollup inlined it directly into `TransactionsView`'s own chunk (21.68 -> 43.56 kB, absorbing the old 22.02 kB/8.31 kB gzip shared chunk) instead of keeping it as a separately-fetched file. Net effect: navigating to Diary no longer fetches Papa/csvExchange at all (previously 22.02 kB/8.31 kB gzip on that navigation); navigating to Transactions costs about the same total bytes as before, just as one file instead of two |

**Full gate (both tasks):** `npm run lint` clean; `npx playwright test tests/wallet-forms.spec.ts tests/diary.spec.ts tests/transaction.spec.ts --project=chromium --repeat-each=2` 18/18; Firefox repeat-guard 14/14; `CI=true npx playwright test` 102/102, 0 retries, 6.3m, 1 worker; `npm run build` succeeded, 0 chunk-size warnings.

**Notes on execution:**
- **ADR 0010 documents why a bare `React.lazy` swap on the existing JSX would have been worse than doing nothing** - it would neither defer the chunk fetch (the element still renders unconditionally) nor work at all (no `<Suspense>` boundary covers `App.tsx:236-261`, and it would throw). The `hasOpened` latch pattern was verified necessary, not just convenient: a bare `{isOpen && <Modal/>}` gate would unmount the wrapper the instant `isOpen` flips false, which breaks `Modal`'s own `AnimatePresence` exit animation and would race `TransferFundsModal`'s 1,000ms delayed-close success flash out of existence. This was checked against the actual code (`TransferFundsModal.tsx:54`'s `flashTransferStatus(..., 1000, onClose)`), not assumed.
- **`AuthModal` was deliberately left eager**, not overlooked. Its own weight (`zod`, `@supabase/supabase-js`) is already eager via `FinanceContext.tsx` regardless of `AuthModal`'s own import status, so deferring it would add a `React.lazy` boundary for zero bundle benefit. `ReloadPrompt` was left eager because `useRegisterSW` registers the PWA service worker as a mount side effect - deferring it would delay or skip registration for users who never open a gated modal.
- **T76's Firefox repeat-guard was run deliberately, matching Phase 6/T11's precedent** for exactly this class of risk (a new dynamic-import boundary added to a path the suite already exercises) - `playwright.config.ts`'s own generous Firefox timeouts exist because Firefox is this suite's slowest lazy-chunk-fetch case under the Vite dev server.
- **T77 surfaced a second, previously-unknown consumer of `exportDiaryToJson`**: `TransactionsView.tsx` has its own "Export Diary (JSON)" button (`#diary-export-json-btn`), duplicating `DiaryView`'s own export action. This import needed fixing alongside `DiaryView`'s or the build would have broken. It does not change T77's bundle claim - `TransactionsView` already imports `papaparse` directly for its own CSV export/import, so its chunk was never going to lose that weight regardless of where `exportDiaryToJson` lives.
- **The `csvExchange-*.js` chunk disappearing entirely (not just shrinking) was a Rollup consequence of T77, not a separate task.** It was verified by reading the full, untruncated `npm run build` chunk list (a `tail`-truncated read initially hid this) before writing it up here - the same "read the whole file before publishing a claim about it" discipline this session has applied to every other build-output citation in this audit pass.

## Phase 37 — closeout: ADRs, metrics, `CLAUDE.md` promotion + drift repair: T78 (2026-09-20, commit `24e9ee6`)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T78 | Finalize ADRs 0009/0010; capture the closing `baseline-metrics.md` column; promote the plan's 5 scheduled constraints plus 2 more resolved from `constraints-to-promote.md` (7 total) to `CLAUDE.md`; repair 2 stale `CLAUDE.md` claims | `docs/audit/baseline-metrics.md`, `docs/audit/task-ledger.md`, `docs/audit/refactor-log.md`, `docs/audit/constraints-to-promote.md`, `CLAUDE.md` | Low | Low | 2h | done | T63, T65-T67, T68, T70/ADR-0009, T76/ADR-0010 (all shipped) | 24e9ee6 | `npm run lint` clean; `CI=true npx playwright test` 102/102, 0 retries; `npm run build` succeeded, 0 chunk-size warnings, entry chunk unchanged at 158.93 kB (docs-only phase, no `src/` change) | Roadmap closed: entry chunk **1,116.67 kB → 158.93 kB (−85.8% raw) / 326.33 kB → 44.81 kB gzip (−86.3%)** across all 37 phases |

**Notes on execution:**
- **ADRs 0009 and 0010 needed no edits to finalize.** Both were written in their own phases already carrying `Status: Accepted`, a full Context/Options/Decision/Consequences/Revisit-if shape, and (0009) an explicit cross-reference to the `CLAUDE.md` constraint this phase promotes. Re-read in full against the current tree; both remain accurate.
- **The `walletsByType` claim was confirmed stale, not just suspected.** `grep -rn "walletsByType" src/` returns zero matches; `useWallets.ts`'s actual return shape is `{ wallets, allWallets, totalNetWorth }` — 3 members, not 4. This has been wrong in `CLAUDE.md` since Phase 1/T5 deleted the dead export (30+ phases). Fixed by removing the trailing `, walletsByType` from the `useWallets()` bullet. A second, previously-unflagged instance of the same rot was found and fixed in the same pass: the "State: context + domain hooks" section's opening paragraph still listed `repayDebtAtomic` among `FinanceActionsContext`'s example members, 4 phases after Phase 33/T64 deleted it end-to-end — grepped (`grep -rn "repayDebtAtomic" src/` returns zero matches) before removing it from that sentence.
- **The `repayDebtAtomic`/`repayDebt` paragraph the original plan scheduled for repair here was already fixed in Phase 33/T64** (`CLAUDE.md`'s Transaction-entry section), not deferred to this phase — confirmed by re-reading that section: it already states the removal accurately and warns against reintroducing a second repayment path. `grep -rn "repayDebt" src/views/DebtsView.tsx` returns only the unrelated local variable `repayDebtTarget` and an explanatory code comment, neither of which is stale documentation.
- **All 5 scheduled constraints promoted to `CLAUDE.md`** (setState-updater ref-mirror rule, `MutationResult` rollback/compensation rule, `generateIdempotencyKey()` rule, `AnimatedCounter` `textContent`-ownership rule, shell-modal `hasOpened`-latch rule) — each re-verified against the live tree immediately before writing it, per this file's own "nothing is promoted until the code already complies" rule (`constraints-to-promote.md:3`).
- **All 3 previously-unpromoted `constraints-to-promote.md` rows were re-checked against the current tree, not left open by default.** Two now hold and were promoted: the batched-`localStorage`-writer rule (`grep -c "localStorage.setItem" src/context/FinanceContext.tsx` still returns exactly 2 — the writer and its flush, unchanged since Phase 12) and the `roundToCents`-is-the-only-ledger-cent-rounder rule (`FinanceContext.tsx` still has exactly one `Math.round(x*100)/100` implementation; `csvExchange.ts`'s and `diaryExport.ts`'s own `Math.round(x*100)/100` uses are CSV/diary aggregate math, not ledger rounding, and were never in this rule's scope). One was **not** promoted: the "every interactive element carries an `id` following `<view>-<thing>-<kind>`" row. `AuthModal.tsx` itself still complies (8 `id=` attributes, unchanged since Phase 7/T12), but the row's own evidence column already scoped this as "fixed for `AuthModal.tsx` only; not re-verified as a repo-wide invariant" — auditing every interactive element across the other 12 views/components for id compliance is a separate, unscoped effort this phase was not asked to do, and promoting an unverified repo-wide claim would repeat exactly the kind of drift this phase exists to close. Left `todo` with its existing note.
- **`baseline-metrics.md`'s closing column is the first one in the file's history to show the entry chunk *drop*** rather than grow — every prior post-Phase-3 column recorded incremental app-code growth; Phase 36's shell-modal deferral is the first change since the initial `manualChunks` split (Phase 3/T7) large enough to reverse that trend.

## Phase 38 — clear the deferred backlog: T18, T25 (2026-09-20, commit `9aa6732`)

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T18 | `Promise.all` the bulk-import wallet updates | `FinanceContext.tsx:1874-1881` | Low-Med | Med | 1h | done | — | `9aa6732` | `npm run lint` clean; `tests/csv.spec.ts` chromium 1/1 pass; `CI=true npx playwright test` 102/102 | Per-wallet balance writes in `commitBulkImport` now fire concurrently instead of sequentially awaited in a `for...of` loop — round-trip count unchanged, wall-clock time scales with the slowest single write instead of the sum of all of them |
| T25 | Unify the 4 transaction-row renderers | see audit-report §E | Med | High | 8h | **rejected / closed** | — | `9aa6732` | n/a — no code change | Formally closed, not just left deferred. Reason unchanged from when first raised: the 4 surfaces (table row, compact card, wallet-popup row, diary row) have structurally different DOM shapes (`<tr>` vs `<div>`, different column sets, no table at all in 2 of them); a single component would need a conditional prop surface worse than the duplication it replaces. Phase 21 already shipped the actual reusable unit — shared **cells** (`TxTypeIcon`, `TxAmount`, `TxCategoryChip`, `TxSoftDeletedTag`) over shared tokens — and each of the 4 renderers keeps its own layout on top of them. See ADR `0006`, "Options considered (a)", for the full rejection rationale. |

**Notes on execution:**
- **T18's fix is a straight `Object.entries(...).map(async ...)` wrapped in `Promise.all`**, replacing the sequential `for...of` loop's per-iteration `await supabase.from('wallets').update(...)`. No change to what each write does — `markLocalWrite(wId)` still fires once per wallet before its own request, and `roundToCents` still computes off the same `walletsRef.current` snapshot taken before any of the writes start, so concurrent execution doesn't change which balance value gets written.
- **This was intentionally *not* extended to `refreshFromCloud()` or the preceding `transactions.insert(...)` call** — those are already single calls, not loops, so there's nothing in them to parallelize; T18's scope was always just the per-wallet update loop per its own ledger row.
- **T25 is closed as "rejected," not "done" or left in Deferred** — no unification code was written, on purpose. The task's own Deferred-table note already said "consider dropping" since it was first scoped; this phase makes that formal rather than leaving it as a permanently-open row nobody was going to pick up. `T25` should not be reopened without a new ADR superseding `0006`.
- **CI workflow deprecation warnings fixed in the same phase** (not a ledger task, since it predates the ledger's task-numbering): `.github/workflows/playwright.yml` bumped `actions/checkout` v4→v5, `actions/setup-node` v4→v5 (`node-version` 20→22), and pinned `runs-on` from `ubuntu-latest` to `ubuntu-24.04` to pre-empt the announced Ubuntu 26 label migration (2026-10-19). Clears both annotations seen on run `35494199574`.
- **`actions/upload-artifact` needed a second bump, v5→v7, found only after re-running CI.** The v4→v5 bump alone left one annotation on run `35494932165`: `actions/upload-artifact@v5` still targets the deprecated Node 20 runtime internally (its own `action.yml`, not this workflow's `node-version` field) — checking `gh api repos/actions/upload-artifact/releases` showed v6.0.0 (2025-12-12) and v7.0.0 (2026-02-26, patched to v7.0.1 2026-04-10) as the releases that actually moved off it. Bumped straight to v7 rather than the intermediate v6.

## Phase 39 — Jev auto-categorization and transaction-type detection: T79–T83 (2026-09-23)

Reopens the ledger after Phase 38 closed it. Approved explicitly by the user; scope is the live-typing path only. Per `README.md:28`, ADR `0011` was written **before** T79 started.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T79 | Wire types + Vercel proxy `api/classify.ts` with request validation, 404-on-missing-key, 8s upstream timeout; Node-typed island `api/tsconfig.json`; `lint` script extended to type-check `api/` | `src/types.ts`, `api/classify.ts` (new), `api/tsconfig.json` (new), `package.json`, `.env.example` | High | Med | 2h | done | ADR 0011 | 18779b3, 2633af7 | `tsc -p api/tsconfig.json` clean; 14/14 throwaway handler probes pass (405/404/400 paths incl. all 5 prompt-injection rejections) | 0 bytes to the client bundle — the proxy never enters the Vite graph |
| T80 | `classifyDescription()` never-throw contract, module-level LRU cache (cap 50), session availability latch, abort + sequence guard; `useDescriptionClassifier` debounce 450ms | `src/utils/jevClassifier.ts` (new), `src/hooks/useDescriptionClassifier.ts` (new) | High | Med | 2.5h | done | T79 | 18779b3 | `npm run lint` clean | Lands in the lazy `TransactionForm` chunk, not the entry chunk |
| T81 | **Baseline guard:** full existing suite must stay green with the client wired but the endpoint absent, before any UI lands | none (verification only) | High | Low | 20m | done | T80 | n/a | **129/129 pre-existing runs passed** (132 total incl. the 1 new spec that passes without UI; the other 4 new tests failed as expected pending T82) | Confirms the design claim rather than assuming it |
| T82 | Confidence-gated UI: `CategorySuggestionChip`, `TransactionForm` wiring after the existing rule call, `userTouchedRef` overwrite guard | `src/components/transaction/CategorySuggestionChip.tsx` (new), `src/components/TransactionForm.tsx` | High | Med | 2.5h | done | T81 | 18779b3 | `CI` full suite 144/144 | `TransactionForm` chunk 13.07 → 17.65 kB raw / 3.90 → 5.53 kB gzip |
| T83 | 5 mocked Playwright specs incl. the zero-network-call assertion on a rule hit | `tests/jev-classify.spec.ts` (new) | Med | Low | 1.5h | done | T82 | 18779b3 | 15/15 (5 tests × 3 browsers) | Suite 129 → **144 runs**, 14 → 15 spec files |

**Full gate:** `npm run lint` clean (both tsconfigs); `npx playwright test --workers=4` **144/144 passed, 0 retries, 3.5m**; `npm run clean && npm run build` succeeded in 17.75s, 0 chunk-size warnings. **Entry chunk 161.53 kB raw / 45.37 kB gzip — byte-identical to HEAD**, verified by stashing the phase and rebuilding rather than by trusting the docs' stale figure.

**Design constraints carried from ADR `0011` (do not re-litigate):**
- `smartMatcher.ts`, `KeywordRule`, `keyword_rules`, the Smart Rules tab and `tests/keywords.spec.ts` are **untouched**. Zero migrations.
- `classifyDescription()` never throws — `src/` has no error boundary, so a thrown fetch white-screens the app.
- No new npm dependency; `vite.config.ts`'s `manualChunks` stays unmodified so ADR `0010`'s `vendor-math` deferral survives.
- The proxy owns the question wording; a client body carrying `instructions`/`criteria`/`model`/`state`/`questions` is rejected.
- `TYPESAFE_API_KEY` carries **no `VITE_` prefix**, so Vite cannot inline it.

**Notes on execution:**
- **The measured entry-chunk baseline is 161.53 kB / 45.37 kB gzip, not the 158.93 kB / 44.81 kB that `refactor-log.md` Phase 36 records.** The repo grew by ~2.6 kB of app code across Phases 37–38 and the presets feature. Rather than compare against a stale number, this phase stashed its own changes (`git stash -u`), rebuilt HEAD, and measured — which is what establishes that the entry chunk is *byte-identical* before and after, with all +4.58 kB of new code landing in the lazy `TransactionForm` chunk.
- **The entry chunk does reference `vendor-math-*.js`, and that is pre-existing, not an ADR `0010` regression.** Verified against the HEAD build: the same reference is present there. It is Vite's module-preload/dynamic-import map naming the chunk, not an eager import — ADR `0010`'s claim was always about network requests at first paint, which this phase did not re-measure and did not change.
- **The first baseline run reported 3 chromium `presets.spec.ts` failures that were self-inflicted, not real.** Files were being written to `src/` while the run was in flight, and Vite HMR perturbed the app under test. Re-running the spec in isolation gave 6/6, and every subsequent gate was run with a quiet filesystem. Worth remembering: this suite's `webServer` is the live dev server, so editing during a run invalidates it.
- **The proxy is the one piece with no Playwright coverage, so it got its own throwaway probe** (`node --experimental-strip-types`, Node 24 runs the handler directly). 14 cases: method rejection, the missing-key 404, six malformed-body shapes, and five prompt-injection attempts (`instructions`, `criteria`, `model`, `state`, `questions`). All rejected locally *before* any upstream call, which is what stops the endpoint being an open relay billed to the project's key. The probe was not committed — it needs no fixture and duplicates no committed assertion.
- **`api/` is type-checked by a second tsconfig, not by widening the root one.** `npm run lint` is now `tsc --noEmit && tsc -p api/tsconfig.json`. Adding `"types": ["node"]` to the root config would have let `process`/`Buffer` type-check inside `src/`, where they fail at runtime in the browser.
- **The `state` field sent upstream is a bare string, matching the probes that produced ADR `0011`'s measured confidences** — `jev ask --dry-run` was used to confirm the proxy builds byte-equivalent request JSON to what the CLI sends.
- **Two spec assertions had to move off `select[id$="-category"]` for the auto-fill cases.** Any auto-categorization sets `autoMatchedCategory`, which collapses the manual block behind "Edit details", so the `<select>` genuinely leaves the DOM. The assertions survive unchanged in meaning — they now assert the badge names the category, then click through to the select. This is a locator move for a surviving assertion, which `implementation-roadmap.md:18` permits.
- **The zero-network-call test needed a real synchronization point, not a fixed wait.** It types a rule-covered note first, then an uncovered one, and asserts the counter is exactly 1 once the second answer renders. A leaked call from the rule hit would make it 2. No `waitForTimeout` anywhere in the spec.

## Phase 40 — Category descriptions as Jev classification criteria: T84–T88 (2026-09-23)

Approved explicitly by the user. Triggered by ADR `0011`'s **first "Revisit if" condition firing within hours of Phase 39 going live**: `Netflix subscription` classified as the `other` escape option at 0.93 against the shipped default set, because `api/classify.ts` sends bare category names as each option's `criteria` and none of the seven default EXPENSE/INCOME categories is *named* anything a streaming subscription maps onto. Per `README.md:28`, ADR `0012` was written **before** T84 started.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T84 | Additive nullable `description` column on `public.categories`; applied **before** the client build shipped (PostgREST `PGRST204` rejects an unknown column outright, which would break category create/edit for authenticated users) | `supabase/migrations/20260923_add_category_description.sql` (new) | High | Low | 20m | done | ADR 0012 | e1f7d77 | applied to `rmpnzlcufeioxmgoocpt` after explicit user authorization; column verified present and nullable via `information_schema.columns` **before** the push | Existing rows NULL, so `withDefaultDescriptions` supplies the shipped wording |
| T85 | `Category.description` + `ClassifyCandidate.description` wire type; `CategorySchema` bound (trim, ≤120); nine default descriptions; `addCategory`/`updateCategory` payloads; Supabase read map; `withDefaultDescriptions` in-memory backfill at both `dedupeCategoriesByName` seams | `src/types.ts`, `src/utils/zodSchemas.ts`, `src/context/FinanceContext.tsx`, `src/utils/categoryUtils.ts` | High | Med | 2h | done | ADR 0012 | e1f7d77 | `npm run lint` clean (both tsconfigs) | Entry chunk +1.57 kB raw / +0.68 kB gzip — `FinanceContext` is eager, so the default descriptions are on the critical path by design |
| T86 | Optional description field in both the Add form and the Edit modal of the Categories hub, using the existing `inputClass('plain')` | `src/views/CategoriesView.tsx` | Med | Low | 1h | done | T85 | e1f7d77 | `npm run lint` clean | `CategoriesView` chunk 14.20 → 15.15 kB raw / 3.76 → 3.94 kB gzip, still lazy |
| T87 | Send the description: `toClassifyCandidates` emits it when non-blank, `cacheKey` includes it, proxy validates ≤200 and formats criteria as `"<name>: <description>"` | `src/utils/jevClassifier.ts`, `api/classify.ts` | High | Med | 1h | done | T85 | e1f7d77 | 15/15 throwaway handler probes pass (bounds, the 3 criteria shapes, all 5 prompt-injection rejections still firing with a description present, missing-key 404) | `TransactionForm` chunk +0.12 kB raw |
| T88 | +2 mocked/offline Playwright tests: a description round-trips create→edit, and the outgoing `/api/classify` body carries it | `tests/categories.spec.ts`, `tests/jev-classify.spec.ts` | Med | Low | 1h | done | T86, T87 | e1f7d77 | **150/150, 0 retries, 4.1m** — all 144 pre-existing runs untouched | Suite 144 → **150 runs**, 48 → 50 tests, 15 spec files unchanged |

**Design constraints carried from ADR `0012` (do not re-litigate):**
- Every ADR `0011` invariant is untouched: rules run first and short-circuit, `classifyDescription()` never throws, the confidence gates and coherence rule are unchanged, the proxy still rejects client-supplied `instructions`/`criteria`/`model`/`state`/`questions`.
- `undefined` (never set, eligible for a shipped default) and `''` (user cleared it) are **different values**. The backfill fills only `undefined`, matched by name rather than id because authenticated rows carry uuids.
- The backfill is in-memory only. It writes nothing to Supabase; the database stays the source of truth for descriptions the user actually set.
- No new default category. A `Subscriptions & Entertainment` bucket would touch seeding, `20260920_dedupe_categories.sql` and the category-count assertions in `tests/categories.spec.ts` — a materially larger change, explicitly deferred in ADR `0012`'s "Revisit if".

**Full gate:** `npm run lint` clean (both tsconfigs); `npx playwright test --workers=4` **150/150 passed, 0 retries, 4.1m**; `npm run clean && npm run build` succeeded in 6.39s, 0 chunk-size warnings. Entry chunk 161.53 → **163.10 kB raw / 45.37 → 46.05 kB gzip**, measured by stashing the phase and rebuilding HEAD rather than differencing a documented figure.

**Shipped:** `e1f7d77`, pushed to `origin/main` only after T84's column was applied and verified. Vercel deployment `dpl_GkPdZZuHmG9TqhFnvYQjxetbDGR9` READY on production.

**Live result:** classifying each note twice against the same deployment in the same minute — bare names (what Phase 39 sent) then described — gives **2 fixed, 0 regressed**. `Netflix subscription` `other` @ 0.92 → Housing & Utilities @ 1.00; `Spotify` `other` @ 0.98 → Housing & Utilities @ 1.00. Both cross the 0.85 gate, so they auto-fill rather than offering a chip. Full table in `refactor-log.md`.

**Notes on execution:**
- **`updateCategory`'s name branch was spreading `updates`, not `cleanedUpdates`.** Adding a second cleaned field exposed it: the name branch would have silently discarded the trimmed description computed immediately above. Both spreads type-check identically, so `tsc` could not have caught it.
- **The estimate for the entry chunk was low by roughly 2×** (+0.7 kB raw predicted, +1.57 kB measured). Nine strings plus the backfill helper plus mapping code in three mutators. Recorded as measured; the alternative that would have cost zero client bytes (a static hint map in `api/classify.ts`) was rejected in ADR `0012` on ownership grounds, not size.
- **The new `jev-classify` test asserts the request body, not the rendered UI.** Nothing else in the suite would fail if a link in the chain dropped the description: the mocked response never echoes it back, and every existing UI assertion passes just as happily with bare names on the wire.
- **`ค่าเน็ตบ้าน` was never broken, contrary to the plan's assumption.** It resolved to Housing & Utilities at 1.00 on bare names alone. The real failure mode is narrower than scoped: **brand and merchant names** (`Netflix`, `Spotify`) that carry no categorical signal in the label. Worth remembering before assuming a reported failure generalizes to a whole class.
- **Descriptions also sharpened options that were already winning** — `ข้าวมันไก่` went 0.91 → 1.00. Not an argued benefit in ADR `0012`; noticed only because the smoke test ran controls through both paths rather than just the suspected failures.

## Phase 41 — Express note entry; TRANSFER leaves the transaction form: T89–T93 (2026-09-23)

Approved explicitly by the user as Part 1 of a UX redesign roadmap, planned and approved before any code was written. Three design questions were settled by the user up front: delete TRANSFER's now-unreachable branch rather than leave it dormant, store the note as typed rather than stripped, and wire the shortcut row into both the shell and page modals with the debt link landing on the Debts tab. Per `README.md:28`, ADR `0013` was written **before** T89 started.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T89 | `parseExpressInput` (whole-text → trailing → leading anchors, baht marker, comma stripping, validated through `safeEvaluateMath` into `(0, 1e9)`); `InlineMathInput` gains `seed: {key,value}` and `onUserEdit`, re-evaluates on `handleQuickAdd`/`handleApplyResult`, suppresses the trailing-operator error, and shows quick-amount chips at every breakpoint | `src/utils/expressInput.ts` (new), `src/components/InlineMathInput.tsx` | High | Med | 2h | done | ADR 0013 | `cb999ab` | `npm run lint` clean (both tsconfigs); 27/27 throwaway esbuild+Node probes of the parser against the real `safeEvaluateMath` | New util ~120 lines, lands entirely in the lazy `TransactionForm` chunk |
| T90 | Note moved to the top and made the form's driver; amount seeded from it behind the manual-amount latch; toggle reduced to EXPENSE/INCOME; TRANSFER branch deleted outright; "Edit details" collapse deleted; `Auto-categorized` badge moved to the Category label. Three spec locator moves in the same commit | `src/components/TransactionForm.tsx`, `tests/jev-classify.spec.ts`, `tests/transaction.spec.ts`, `tests/helpers.ts` | High | High | 3h | done | T89 | `87a73a2` | `npm run lint` clean; 32/32 chromium across the eight regression-critical specs | `TransactionForm` chunk 17.77 → 17.90 kB raw (deletions nearly offset the parser); CSS −0.66 kB |
| T91 | `onRequestTransfer`/`onRequestRepayDebt` shortcut row; `App.tsx` gains `handleQuickAddTransfer`/`handleQuickAddRepayDebt`/`handleNavigateToDebts`; forwarded through `QuickAddModal` and `TransactionsView` (each closing itself first) | `src/App.tsx`, `src/components/QuickAddModal.tsx`, `src/views/TransactionsView.tsx` | Med | Low | 1h | done | T90 | `d7cdf98` | `npm run lint` clean | Entry chunk +0.20 kB raw / +0.06 kB gzip — `App.tsx` is eager, and this is the phase's entire critical-path cost |
| T92 | +5 Playwright tests: trailing/leading/math extraction, the manual-amount latch, the always-mounted category selector | `tests/express-input.spec.ts` (new) | High | Low | 1h | done | T90, T91 | `161b9e3` | **165/165, 0 retries, 4.5m** — all 150 pre-existing runs green | Suite 150 → **165 runs**, 50 → 55 tests, 15 → **16** spec files |
| T93 | ADR `0013`; ADR `0007` status amended; `CLAUDE.md` "Express note entry" section + rewritten engine section + suite count; Phase 41 selector table; Phase 41 refactor-log entry | `docs/audit/decisions/0013-*.md` (new), `docs/audit/decisions/0007-*.md`, `CLAUDE.md`, `docs/audit/test-selector-contract.md`, `docs/audit/refactor-log.md` | Med | Low | 1h | done | T92 | `ba1690a` | docs only; `npm run lint` clean at HEAD | — |

**Full gate:** `npm run lint` clean (both tsconfigs); `npx playwright test --workers=4` **165/165 passed, 0 retries, 4.5m**; `npm run clean && npm run build` succeeded in 6.90s, 0 chunk-size warnings. Entry chunk 163.10 → **163.30 kB raw / 46.05 → 46.11 kB gzip**, measured by stashing the phase and rebuilding HEAD rather than differencing a documented figure.

**Shipped:** `cb999ab`…`ba1690a`, pushed to `origin/main`.

**Design constraints carried from ADR `0013` (do not re-litigate):**
- **The manual-amount latch is a test invariant, not a preference.** `csv.spec.ts`, `soft-delete.spec.ts` and all six `presets.spec.ts` cases fill the amount by hand and *then* type a note ending in six digits, asserting on amounts and wallet balances. Weaken `userTouchedRef.current.amount` and three spec files fail on values at once. `tests/express-input.spec.ts` now pins it directly.
- **The note is stored as typed; only the classifier sees the stripped text.** Stripping at the write path is lossy and lets a mis-parse corrupt the note as well as the amount.
- **`matchSmartDescription` stays untouched.** `KeywordRulesView` surfaces its own `extractedAmount`/`cleanDescription` through the `metric-*` testids, which `keywords.spec.ts` asserts on.
- **TRANSFER does not come back to this form.** `DEBT_REPAYMENT` stayed only because it has a live caller and full coverage; TRANSFER had neither.

**Notes on execution:**
- **A quoted bash heredoc collapsed `\\` to `\`, corrupting the parser's regexes at module load.** `tsc` passed clean — the breakage only exists when `new RegExp` evaluates — and with no error boundary in `src/` it would have white-screened the app. Caught only by bundling the module with `esbuild` and executing it. Rewritten as regex **literals**, which removes the second escaping level entirely. A composed regex deserves a runtime probe even when the type-checker is happy.
- **Fixing `handleQuickAdd`'s stale-state bug required a second change to stay correct.** Making it notify the parent meant `60+` now reaches the evaluator and is rejected, so tapping an operator chip would have thrown a visible error. `evaluateAndNotify` now treats a trailing operator or open paren as an expected intermediate. This also removed the same error flashing mid-way through hand-typing a long expression — a pre-existing annoyance nobody had filed.
- **Removing the collapse is a pure locator move, not a weakened assertion.** `jev-classify.spec.ts` keeps both `toHaveValue(TRANSPORT.id)` assertions; only the `revealDetails` click that used to be required first is gone.
- **Deleting `-dest-wallet` resolved a latent strict-mode hazard rather than creating one.** `helpers.ts`'s `select[id$="-wallet"]` matched **both** wallet selects and was unambiguous only because the form happened to default to EXPENSE.
- **`presetWalletId` is still dead.** `CLAUDE.md` and ADR `0007` both claimed `DebtsView` passes it; no call site in `src/` ever has. Both docs corrected; the prop kept as supported-but-unused.
- **The `lunch for 4` false positive shipped deliberately.** It pre-fills ฿4, visible and one keystroke to correct. Tightening the trailing anchor would trade that for silently refusing real input like `bts 45`. Recorded in ADR `0013`'s "Revisit if" instead.

## Phase 42 — Visual transfer layout and live balance preview: T94–T98 (2026-09-23)

Approved explicitly by the user as Part 2 of the UX redesign roadmap, planned and approved before any code was written. Three design questions were settled up front: keep the native `<select>`s as the real controls (forced by `wallet-forms.spec.ts`'s visibility + `.inputValue()` assertions), warn on overdraft rather than block it, and take the swap button and "Transfer all" chip while declining the percent meter and the animated arrow. Per `README.md:28`, ADR `0014` was written **before** T94 started.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T94 | Move `roundToCents` out of `FinanceContext.tsx` (module-private since it was written) into a shared `src/utils/money.ts`, so the transfer preview computes with the same function the ledger commits with | `src/utils/money.ts` (new), `src/context/FinanceContext.tsx` | Med | Low | 20m | done | ADR 0014 | 67a8bc7 | `npm run lint` clean; all 11 call sites unchanged | Entry chunk +0.01 kB — one module boundary in the eager graph |
| T95 | `TransferWalletPanel` + source → swap → destination grid; colour-tinted icon badge, borderless `<select>`, struck-through current balance, projected balance; live preview mirroring `addTransaction`'s TRANSFER arithmetic; amber overdraft warning that does **not** gate `canSubmit`; modal widened to `max-w-lg` | `src/components/wallet/WalletTransferForm.tsx`, `src/components/wallet/TransferFundsModal.tsx` | High | Med | 3h | done | T94 | f2dc4f8 | `npm run lint` clean; **`wallet-forms.spec.ts` 4/4 unedited** | `TransferFundsModal` chunk 4.10 → 7.76 kB raw, still lazy |
| T96 | Swap button; collision-swap reconciliation on both selects (replacing the option filtering that left `destWalletId` stale); "Transfer all" chip via `InlineMathInput`'s `seed` prop; `EmptyState` for fewer than two wallets | `src/components/wallet/WalletTransferForm.tsx` | Med | Low | 1h | done | T95 | f2dc4f8 | `npm run lint` clean | 2 new ids, 5 new `data-testid`s; none removed |
| T97 | +7 Playwright tests: preview arithmetic, preview clearing, inline-math amounts, swap, collision-swap, overdraft-warns-but-allows, "Transfer all" | `tests/transfer-preview.spec.ts` (new) | High | Low | 1.5h | done | T95, T96 | 8adc88e | **186/186, 0 retries, 4.3m** — all 165 pre-existing runs green | Suite 165 → **186 runs**, 55 → 62 tests, 16 → **17** spec files |
| T98 | ADR `0014`; Phase 42 refactor-log entry, ledger rows, and bundle column; Phase 42 selector table; `CLAUDE.md` suite count + transfer-preview constraint | `docs/audit/decisions/0014-*.md` (new), `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`, `docs/audit/baseline-metrics.md`, `docs/audit/test-selector-contract.md`, `CLAUDE.md` | Med | Low | 1h | done | T97 | ad5490e | docs only; `npm run lint` clean at HEAD | — |

**Full gate:** `npm run lint` clean (both tsconfigs); `npx playwright test --workers=4` **186/186 passed, 0 retries, 4.3m**; `npm run clean && npm run build` succeeded in 5.26s, 0 chunk-size warnings. Entry chunk 163.30 → **163.31 kB raw / 46.11 → 46.12 kB gzip**, measured by stashing the phase and rebuilding HEAD (`84c4400`) rather than differencing a documented figure.

**Design constraints carried from ADR `0014` (do not re-litigate):**
- **The `<select>`s stay real, visible form controls.** `wallet-forms.spec.ts:22-23,25,50,52` asserts visibility and reads `.inputValue()`. Replacing them with cards is not a locator move, so the spec-edit policy forbids it. This spec is the phase's regression guard and passed unedited.
- **The preview shares `roundToCents` with the ledger.** It must not grow its own rounding; that is what `CLAUDE.md`'s no-inlined-`Math.round` rule prevents. `roundToTwoDecimals` stays separate.
- **Overdraft warns, never blocks.** `CREDIT_CARD` wallets legitimately run negative. Pinned by a test so it cannot quietly become a gate.
- **`AnimatedCounter` is wrong for this.** It animates from 0 on mount, re-tweens per keystroke, and ADR `0009` forbids children in its span.

**Notes on execution:**
- **The entry chunk moved 10 bytes, not zero.** Extracting a two-line function into its own module was expected to be byte-neutral after minification; it costs one module boundary in the eager `FinanceContext` graph. Recorded as measured.
- **The CSS grew more than the JS gzip did** (+0.80 kB raw vs +1.20 kB). The panel layout, amber warning and swap button introduced utility classes the Tailwind scan had not seen — the inverse of Phase 41, where deletions shrank it.
- **The desync fix fell out of the feature.** Collision-swap was adopted because the swap button made it the natural gesture; that it also fixes `destWalletId` going stale was a second-order benefit, not the motivation.
- **All 7 new tests passed on the first run.** Noted as worth scrutiny rather than reassurance: the expectations were derived from the seeded fixtures and the real arithmetic, so a wrong one would have failed loudly rather than passed vacuously.

## Phase 43 — Debt payoff chips and live repayment preview: T99–T103 (2026-09-23)

Approved explicitly by the user as Part 3 of the UX redesign roadmap, planned and approved before any code was written. Three design questions were settled up front: overpayment **warns rather than blocks**, the chips and preview live **inside `TransactionForm`** rather than in `DebtsView`'s modal shell, and the `Minimum due` chip is **hidden** when the minimum meets or exceeds the remainder. Per `README.md:28`, ADR `0015` was written **before** T99 started.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T99 | ADR `0015` — the decision record, written ahead of the code: placement inside the shared engine, warn-not-block on overpayment, the chip latch, the deliberate divergence from Phase 42's vanishing preview, and the full-debit/floored-debt asymmetry | `docs/audit/decisions/0015-debt-repayment-preview.md` (new) | Med | Low | 45m | done | — | b6e5ba8 | docs only | — |
| T100 | Three quick-payoff chips seeding through `InlineMathInput`'s `seed` prop; `seedPayoffAmount` sets `userTouchedRef.current.amount` itself since the seed effect never fires `onUserEdit`; `Minimum due` gated on `0 < minimumPayment < remainingAmount`; template-chip Tailwind string promoted to a shared `QUICK_CHIP_CLASS` | `src/components/TransactionForm.tsx` | Med | Low | 1.5h | done | T99 | b6e5ba8 | `npm run lint` clean | 3 new ids; `#repay-amount-math` unchanged |
| T101 | Live payoff block: remaining balance struck through with its projection beside it, `ProgressMeter` at the projected percentage, amber overpayment note and emerald exact-settle note (mutually exclusive), all derived on render with no effect or debounce | `src/components/TransactionForm.tsx` | High | Med | 2h | done | T100 | 253748a | `npm run lint` clean; **`debts.spec.ts` 1/1 unedited** | `TransactionForm` chunk 17.90 → 21.30 kB, still lazy |
| T102 | +8 Playwright tests: each chip's seeding, typed-amount projection, projection absent until valid and gone again when cleared, minimum-chip suppression, overpayment-warns-but-allows, and the chip latch against the note parser | `tests/debt-repayment.spec.ts` (new) | High | Low | 1.5h | done | T100, T101 | fd12f5b | **210/210, 4.8m** — all 186 pre-existing runs green | Suite 186 → **210 runs**, 62 → 70 tests, 17 → **18** spec files |
| T103 | Phase 43 refactor-log entry, ledger rows, and bundle column; Phase 43 selector table; `CLAUDE.md` suite count + debt-preview constraints section | `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`, `docs/audit/baseline-metrics.md`, `docs/audit/test-selector-contract.md`, `CLAUDE.md` | Med | Low | 1h | done | T102 | 44a9747 | docs only; `npm run lint` clean at HEAD | — |

**CI and deploy:** run `35869610069` on `44a9747` — success, zero failed steps. Vercel deployment `6615598496` — Production, state `success`.

**On T99's commit:** ADR `0015` was *written* before any code, per `README.md:28`, but it was *committed* inside `b6e5ba8` alongside the chips rather than getting a commit of its own. Recorded as it happened; the ordering the protocol cares about is authorship, not commit boundaries, and the plan's five-commit split did not reserve one for the ADR.

**Full gate:** `npm run lint` clean (both tsconfigs); `npx playwright test --workers=4` **210/210 passed, 4.8m**; `npm run clean && npm run build` succeeded in 5.21s, 0 chunk-size warnings. Entry chunk 163.31 → **163.35 kB raw / 46.12 → 46.14 kB gzip**, measured by building `fb56cf8` and `main` in turn rather than differencing a documented figure.

**Design constraints carried from ADR `0015` (do not re-litigate):**
- ~~**Overpayment warns, never blocks.**~~ **Superseded by Phase 44 / ADR `0016`** — the ledger now rejects an overpayment outright and the form blocks it. Left as written, since this row records what Phase 43 decided at the time; the reasoning below is why it was *not* fixed then, not a standing rule. Original text: *"The ledger floors the debt at zero but debits the wallet the full amount. Blocking removes a case the ledger permits and changes submit gating `debts.spec.ts` exercises. Pinned by a test."*
- **The chips seed through `#repay-amount-math`, never replace it.** That id, `#repay-wallet-select` and `#confirm-repay-btn` are `debts.spec.ts`'s entire surface, and it passed unedited.
- **A chip latches the amount field.** `InlineMathInput`'s `seed` effect deliberately never fires `onUserEdit`, so the handler sets `userTouchedRef.current.amount` directly — ADR `0013`'s rule reached through a new entry point.
- **The block stays mounted with no amount**, unlike Phase 42's transfer preview. `presetDebtId` suppresses the Debt Target select, so this is the only place the remaining balance appears in the modal.
- **`AnimatedCounter` is wrong for this**, for the same reasons as ADR `0014`: animates from 0 on mount, re-tweens per keystroke, and ADR `0009` forbids children in its span.

**Notes on execution:**
- **The entry chunk moved +0.04 kB and none of it is this phase's code.** Giving `ProgressMeter` a second lazy importer made Rollup re-partition: that chunk *shrank* 1.16 → 0.48 kB and `useDebts` split into a new 0.73 kB chunk, so the entry carries one more preload entry. The plan predicted "unchanged"; recorded as measured with the cause identified.
- **A shared chunk got smaller because an import was added to it.** Chunk sizes here are a partitioning outcome, not a per-module cost — which is why a summed-JS row was added to the bundle table (+3.63 kB across everything, against +3.40 kB in `TransactionForm` alone).
- **The overpayment note is now the only place in the app describing the full-debit/floored-debt asymmetry.** If that behaviour is ever fixed in the ledger, the note must be revised or removed with it.
- **All 8 new tests passed on the first run.** Worth scrutiny rather than reassurance: the expectations came from the Add Debt form's own defaults (5,000 total, 200 minimum) and the real arithmetic, so a wrong one would have failed loudly rather than passed vacuously.

## Phase 44 — Debt repayment integrity: the ledger stops losing money: T104–T109 (2026-09-23)

Approved explicitly by the user, planned and approved before any code was written. Three questions were settled up front: **reject rather than clamp** an overpayment; the **`setTransactionDeleted` hole is in scope** (surfaced during planning, larger than the reported bug); and **`settleDebt` stays exempt**, documented rather than changed. Per `README.md:28`, ADR `0016` was written **before** T105 started.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T104 | ADR `0016`, amending `0015` — reject-not-clamp; the guard's load-bearing position; the soft-delete hole and why it exceeded the reported bug; `settleDebt`'s exemption; the uncapped reversal; the deliberate test inversion | `docs/audit/decisions/0016-debt-repayment-integrity.md` (new) | Med | Low | 1h | done | — | d9ca5e8 | docs only | — |
| T105 | `addTransaction` rejects a `DEBT_REPAYMENT` exceeding `remainingAmount`, placed after the `existingTx` replay check and before `inFlightIdempotencyKeys.add`; `Math.max(0, …)` floors kept and annotated as stale-ref defence | `src/context/FinanceContext.tsx` | High | Med | 1h | done | T104 | d9ca5e8 | `npm run lint` clean; **`debts.spec.ts` 1/1 unedited** | Entry chunk +0.94 kB — `FinanceContext` is eager |
| T106 | `setTransactionDeleted` reverses/reapplies the debt decrement with `isSettled` recomputed both ways; optimistic `setDebts`, `previousDebts` snapshot, remote write ordered before the `is_deleted` flag, compensating write in the `catch` | `src/context/FinanceContext.tsx` | High | Med | 2h | done | T105 | 07e9e1c | `npm run lint` clean; `soft-delete.spec.ts` 4/4 unedited at this point | — |
| T107 | `isOverpaying` (with the load-bearing `repayTargetDebt !== null` test) gates a single new `canSubmit`, replacing three copies of the same expression; the amber note becomes a constraint naming the maximum; `CLAUDE.md`'s contradicted Do-NOT deleted in the same commit | `src/components/TransactionForm.tsx`, `CLAUDE.md` | High | **High** | 1.5h | done | T105 | f244727 | `transaction.spec.ts` + `presets.spec.ts` **10/10** — the null-check regression check | `TransactionForm` chunk +0.09 kB |
| T108 | 1 test inverted, 5 added: the overpayment gate, its non-stickiness, "Pay in full" satisfying the constraint, a plain EXPENSE form unaffected, and two debt soft-delete/restore invariants | `tests/debt-repayment.spec.ts`, `tests/soft-delete.spec.ts` | High | Low | 2h | done | T106, T107 | 8d14dfe | **225/225, 5.2m**; negative control confirmed both new invariant cases fail against `b83ad93` | Suite 210 → **225 runs**, 70 → 75 tests, 18 spec files (no new file) |
| T109 | Phase 44 refactor-log entry, ledger rows, and bundle column; `test-selector-contract.md`'s inverted-selector note | `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`, `docs/audit/baseline-metrics.md`, `docs/audit/test-selector-contract.md` | Med | Low | 1h | done | T108 | 4c2ba98 | docs only; `npm run lint` clean at HEAD | — |

**CI and deploy:** run `35882637760` on `4c2ba98` — success, zero failed steps. Vercel deployment `6617954628` — Production, state `success`. CI runs `workers: 1` and passed `wallets.spec.ts` on webkit, which supports reading the local 224/225 as `--workers=4` contention rather than a regression.

**Full gate:** `npm run lint` clean (both tsconfigs); `npx playwright test --workers=4` **225/225 passed, 5.2m**; `npm run clean && npm run build` succeeded in 5.75s, 0 chunk-size warnings. Entry chunk 163.35 → **164.29 kB raw / 46.14 → 46.32 kB gzip**, measured by building `b83ad93` and `main` in turn.

**Design constraints carried from ADR `0016` (do not re-litigate):**
- **Reject, never clamp.** A clamped write records an amount the user never entered while the button still names what they typed.
- **The guard sits between the replay check and the idempotency `add`.** Either side of that window is a real, specific failure — a rejected retry, or a permanently bricked form. Both are spelled out in the code comment.
- **The floors stay.** They defend a stale-`debtsRef` race, not a reachable UI path.
- **`isOverpaying` tests `repayTargetDebt !== null`.** Without it, every EXPENSE and INCOME submit in the app is disabled.
- **`settleDebt` is exempt** by decision, not oversight.

**Notes on execution:**
- **The audit found more than the bug report.** `setTransactionDeleted` had no debt handling at all, making an ordinary undo leak money in both directions, where the reported overpayment needed the user to type too large a number. Found by enumerating every writer of `Debt.remainingAmount` rather than reading only the path named in the request.
- **The new invariant tests were negative-controlled.** Both were re-run against `b83ad93`'s `FinanceContext.tsx` and **failed**, with the debt card stuck at "฿0.00 / 100% Fully Settled" after its repayment was deleted. They are not vacuous.
- **Suite arithmetic landed under the projection.** The plan said 6 new tests / 228 runs; 5 were actually written (one plan item was the inversion, not an addition), so 75 tests / **225 runs**. Recorded as measured.
- **One webkit flake, disclosed.** The first full run reported 224/225, `wallets.spec.ts:9` failing on webkit — a spec untouched by this phase. It passed 3/3 in isolation and the full suite re-ran clean at 225/225. Contention at `--workers=4`; CI runs `workers: 1`. Worth watching rather than declaring solved.
- **The CSS delta was exactly zero** — identical content hash across both builds, a first for this table.

## Phase 45 — One-click smart rule capture from the transaction form: T110–T115 (2026-09-24)

Approved explicitly by the user, planned and approved before any code was written. Three questions were settled up front: the affordance is an **inline chip, not a post-submit prompt** (all three consumers close their modal on success, so post-submit is unavailable); it fires **only on an explicit category choice**; and the keyword is **`cleanDescription` verbatim and read-only**. Per `README.md:28`, ADR `0017` was written before T111 started — and this phase committed it **alone**, correcting the Phase 43/44 pattern where `git add -A` swept the ADR in with the first code commit.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T110 | ADR `0017` — why inline rather than post-submit (the close-on-success table); the five trigger conditions; the missing dedupe that makes condition 4 an invariant; the confirmation-cannot-be-derived race; the `applySuggestion` latch; the type-mismatch suppression; the three non-goals | `docs/audit/decisions/0017-rule-capture-from-entry.md` (new) | Med | Low | 1h | done | — | 1d3d29f | docs only; committed alone | — |
| T111 | `applySuggestion` latches `userTouchedRef.current.category` when `force` is set, aligning the code with a contract `CLAUDE.md` already stated | `src/components/TransactionForm.tsx`, `tests/jev-classify.spec.ts` | Med | Low | 1h | done | T110 | 0e83531 | `jev-classify.spec.ts` 7/7 chromium; **negative control: the select flips to `cat-housing` without the line** | — |
| T112 | `SaveRuleChip` + five derived trigger conditions, `handleSaveRule`/`handleDismissRule`, in-flight guard, transient-flash confirmation | `src/components/transaction/SaveRuleChip.tsx` (new), `src/components/TransactionForm.tsx` | High | Med | 3h | done | T111 | f410e11 | `npm run lint` clean both tsconfigs | `TransactionForm` chunk +3.12 kB; **entry chunk unchanged** |
| T113 | 7 new tests in a new spec file plus 1 in `jev-classify.spec.ts` for the tap-Apply trigger, which must live there because it needs a live suggestion | `tests/smart-rules.spec.ts` (new), `tests/jev-classify.spec.ts` | High | Low | 2h | done | T112 | 071060e | **252/252, 5.7 m**, first attempt, no flakes; both invariant tests negative-controlled | Suite 225 → **252 runs**, 75 → 84 tests, 18 → **19** spec files |
| T114 | Phase 45 refactor-log entry, ledger rows, bundle column, selector-contract additions, and the `CLAUDE.md` smart-rules section | `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`, `docs/audit/baseline-metrics.md`, `docs/audit/test-selector-contract.md`, `CLAUDE.md` | Med | Low | 1h | done | T113 | 5901d2d | docs only; `npm run lint` clean at HEAD | — |
| T115 | Sha backfill, plus the CI and deploy result | `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md` | Low | Low | 0.5h | done | T114 | (this row's own commit — a backfill cannot cite its own sha) | docs only; CI `35925528056` success on the preceding commit | — |

**CI and deploy:** run `35925528056` on `5901d2d` — success, zero failed jobs. Vercel deployment `6625318217` — Production, state `success` ("Deployment has completed"). CI runs `workers: 1`; the local gate ran `--workers=4`, and both were clean at 252/252.

**Full gate:** `npm run lint` clean (both tsconfigs); `npx playwright test --workers=4` **252/252 passed, 5.7 m**; `npm run clean && npm run build` succeeded in 5.27 s, 0 chunk-size warnings. Entry chunk **164.29 kB raw in both builds** (gzip 46.32 → 46.33), measured by building `b54941b` and `main` in turn.

**Design constraints carried from ADR `0017` (do not re-litigate):**
- **The chip offers; it never writes unasked.** Nothing reaches `addKeywordRule` without a tap on the button.
- **Condition 4 is an invariant, not a politeness.** `addKeywordRule` has no dedupe, so relaxing "no existing rule matches" lets this surface write a duplicate keyword that silently shadows the older rule.
- **The 3-character floor is load-bearing.** `matchSmartDescription` matches with `includes`, so a shorter rule would capture nearly every future note, with nothing on screen connecting the symptom to the cause.
- **The confirmation cannot be derived.** A successful save makes the offer's own conditions false on the next render.
- **The keyword is never truncated to fit the bounds.** Outside the band the chip does not render at all.

**Notes on execution:**
- **The brief's preferred option did not exist.** A post-submit prompt inside the form is unreachable: all three consumers close their modal on success. Establishing that also turned up `TransactionForm.tsx:858-860`'s success line as long-dead code, which is recorded but deliberately not removed.
- **A documented contract was found to be aspirational.** `CLAUDE.md` claimed `userTouchedRef` recorded manual category picks; `applySuggestion` never set it. Fixed in its own commit, with a negative control proving the new test fails without the line.
- **Both invariant tests were negative-controlled**, as in Phase 44. Removing the existing-rule condition makes the duplicate-suppression test fail; skipping the `addKeywordRule` write makes both end-to-end save tests fail. Neither is vacuous.
- **Suite arithmetic landed one over the projection** (8 planned, 9 written) because the latch fix earned its own guard. Recorded as measured, not as planned.
- **No flakes.** Unlike Phase 44's `wallets.spec.ts` webkit flake at `--workers=4`, this phase's first full run was clean at 252/252. That flake remains watched rather than declared solved.

## Phase 46 — Voice input for the omni note: T116–T121 (2026-09-24)

Approved explicitly by the user, planned and approved before any code was written. Three questions were settled up front: interim results go **live into the note field**; dictation **appends** to existing text rather than replacing it; and the language comes from **`navigator.language` with a `th-TH` fallback**. Per `README.md:28`, ADR `0018` was written before T117 started and committed alone.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T116 | ADR `0018` — why the transcript reuses `handleDescriptionChange` instead of getting a pipeline; the measured three-browser support split; why detection needs `isSecureContext`; the per-error-code table and why `network` does not latch; append-not-replace and the missing undo | `docs/audit/decisions/0018-voice-note-entry.md` (new) | Med | Low | 1h | done | — | 4dec34b | docs only; committed alone | — |
| T117 | `useSpeechRecognition` — two-condition support detection, single-utterance config, error taxonomy, unmount abort, minimal local types and no dependency | `src/hooks/useSpeechRecognition.ts` (new) | High | Med | 2.5h | done | T116 | fa9c875 | `npm run lint` clean both tsconfigs | — |
| T118 | Mic button inside the note field, listening/error states, `aria-live` announcement, base-text capture, and the un-memoized transcript handler | `src/components/TransactionForm.tsx` | High | Med | 2h | done | T117 | 80fd5a4 | `npm run lint` clean | `TransactionForm` +3.34 kB; `vendor-icons` +0.37 kB |
| T119 | 8 new tests with an `addInitScript` Web Speech stub — a new kind of test seam for this suite | `tests/voice-input.spec.ts` (new) | High | Low | 2.5h | done | T118 | 85063b9 | **276/276, 6.3 m**, first attempt, no flakes; **three** negative controls confirmed | Suite 252 → **276 runs**, 84 → 92 tests, 19 → **20** spec files |
| T120 | Phase 46 refactor-log entry, ledger rows, bundle column, selector-contract additions, and the `CLAUDE.md` voice section | `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`, `docs/audit/baseline-metrics.md`, `docs/audit/test-selector-contract.md`, `CLAUDE.md` | Med | Low | 1h | done | T119 | 37b60f7 | docs only; `npm run lint` clean at HEAD | — |
| T121 | Sha backfill, plus the CI and deploy result | `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md` | Low | Low | 0.5h | done | T120 | (this row's own commit — a backfill cannot cite its own sha) | docs only; CI `35931109674` success on the preceding commit | — |

**CI and deploy:** run `35931109674` on `37b60f7` — success, zero failed jobs. Vercel deployment `6626224885` — Production, state `success` ("Deployment has completed"). CI runs `workers: 1`; the local gate ran `--workers=4`, and both were clean at 276/276.

**Full gate:** `npm run lint` clean (both tsconfigs); `npx playwright test --workers=4` **276/276 passed, 6.3 m**; `npm run clean && npm run build` succeeded in 6.00 s, 0 chunk-size warnings. Entry chunk **164.29 kB raw in both builds**, measured by building `446aafb` and `main` in turn.

**Design constraints carried from ADR `0018` (do not re-litigate):**
- **The transcript goes through `handleDescriptionChange`.** Voice gets no pipeline of its own; that is what makes every downstream layer, including ADR `0013`'s amount latch, treat it identically to typing.
- **Support detection is two conditions.** `isSecureContext` is what stops the button rendering-then-failing on a phone at `http://192.168.x.x:3000`, and Playwright cannot catch its absence.
- **Dictation appends, never replaces.** This form has no undo and the mic sits inside the field it would wipe.
- **`network` errors do not latch; permission errors do.** A dropped request must not kill the feature for a session.
- **The transcript handler is not memoized.** It closes over `keywordRules`, which Phase 45's chip mutates mid-session.

**Notes on execution:**
- **The support matrix was measured, not assumed.** A throwaway probe across all three projects (chromium: both constructors; firefox and webkit: neither) is what justifies stubbing in every test rather than relying on native support. The probe was deleted before the first commit.
- **Three negative controls**, one of which was instructive by failing to fail: bypassing `handleDescriptionChange` left the amount-latch test green, because a bypass seeds no amount at all. That test was re-controlled by removing the latch itself.
- **The summed-JS row earned its place again.** The entry chunk was byte-identical, but `vendor-icons` — which `index.html` modulepreloads — grew by the `Mic` icon. Accounting for the full +3.71 kB is what surfaced it.
- **The projection landed exactly** for the first time in three phases: 8 tests planned, 8 written, 92 tests / 276 runs as projected.
- **No flakes.** Phase 44's `wallets.spec.ts` webkit flake at `--workers=4` has now not reproduced across two consecutive phases; still watched rather than closed.

## Phase 47 — Batch AI CSV import with layered auto-categorization: T122–T128 (2026-09-24)

Approved explicitly by the user, planned and approved before any code was written. Three questions were settled up front: a **concurrency pool over the existing endpoint** rather than a new one; an **explicit button** rather than automatic classification; and **confidence mirroring the form's `CONFIDENCE` gate**. Per `README.md:28`, ADR `0019` was written before T123 started and committed alone.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T122 | ADR `0019` — pool over endpoint and the cache/latch reuse behind it; the `classifyOnce` split with a frozen wrapper; explicit trigger; the confidence mirror; the two safety rules on what may be written; the mocking-rule amendment; and the finding that CSV import has no dedupe and that this is pinned by a spec | `docs/audit/decisions/0019-batch-csv-classification.md` (new) | Med | Low | 1.5h | done | — | 8a22222 | docs only; committed alone | — |
| T123 | `classifyOnce` + `ClassifyOutcome`; `classifyDescription` reduced to a wrapper with an explicitly frozen contract; 429 separated from other non-ok statuses | `src/utils/jevClassifier.ts` | Med | Med | 1.5h | done | T122 | c938266 | `jev-classify.spec.ts` + `csv.spec.ts` **9/9 unedited** | — |
| T124 | `ImportRowValidation.categoryId`; `commitBulkImport` prefers it over the name lookup | `src/types.ts`, `src/context/FinanceContext.tsx` | High | Low | 0.5h | done | T122 | 383f311 | `npm run lint` clean both tsconfigs | entry chunk +0.08 kB (eager `FinanceContext`) |
| T125 | `batchClassifier` (concurrency cap, pre-dispatch de-duplication, bounded backoff, early abort) plus Layer 1 on parse, the explicit Layer 2 button, progress, and the preview Category column | `src/utils/batchClassifier.ts` (new), `src/views/TransactionsView.tsx`, `src/utils/jevClassifier.ts` | High | **High** | 4h | done | T123, T124 | 571c314 | `npm run lint` clean | `TransactionsView` +6.24 kB; 33 chunks, no re-partition |
| T126 | 8 new tests, the second spec permitted to mock the classifier, plus the `CLAUDE.md` rule amendment in the same commit | `tests/csv-classify.spec.ts` (new), `CLAUDE.md` | High | Low | 2.5h | done | T125 | aaa1186 | **300/300, 6.6 m**, first attempt, no flakes; **three** negative controls confirmed | Suite 276 → **300 runs**, 92 → 100 tests, 20 → **21** spec files |
| T127 | Phase 47 refactor-log entry, ledger rows, bundle column, selector-contract additions | `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`, `docs/audit/baseline-metrics.md`, `docs/audit/test-selector-contract.md` | Med | Low | 1h | done | T126 | ca867c0 | docs only; `npm run lint` clean at HEAD | — |
| T128 | Sha backfill, plus the CI and deploy result | `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md` | Low | Low | 0.5h | done | T127 | (this row's own commit — a backfill cannot cite its own sha) | docs only; CI `35948155766` success on the preceding commit | — |

**CI and deploy:** run `35948155766` on `ca867c0` — success, zero failed jobs. Vercel deployment `6628962059` — Production, state `success` ("Deployment has completed"). CI runs `workers: 1`; the local gate ran `--workers=4`, and both were clean at 300/300.

**Full gate:** `npm run lint` clean (both tsconfigs); `npx playwright test --workers=4` **300/300 passed, 6.6 m**; `npm run clean && npm run build` succeeded in 7.08 s, 0 chunk-size warnings. Measured by building `0bfe7bf` and `main` in turn.

**Design constraints carried from ADR `0019` (do not re-litigate):**
- **De-duplicate before dispatch, not via the cache.** The cache fills on response, so concurrent identical rows all miss it. This was a real bug, found by a test.
- **`classifyDescription`'s contract is frozen.** New callers extend `classifyOnce`; the wrapper exists to keep three call sites and one spec unchanged.
- **AI never writes a row's `type`**, and a category whose type disagrees with the row's is demoted to a suggestion.
- **Only `categoryId` reaches the ledger.** Confidence and applied/suggested state are preview-only by design.
- **There is no CSV dedupe, deliberately**, and `csv.spec.ts` asserts it.

**Notes on execution:**
- **The cost test found a correctness bug.** "Repeated descriptions cost one request" failed at 4-of-4 on first run and is what surfaced the cache stampede. The ADR had asserted the cache made repeats free; it did not, and the ADR's claim was true only after the fix.
- **Two premises in the request were wrong** and are corrected in ADR `0019` rather than silently worked around: the named files do not exist, and there were no dedupe rules to preserve.
- **A flagged bundle risk was checked and came back clean.** `jevClassifier` gaining a second lazy importer is the Phase 43 re-partition shape; 33 chunks before and after, with all three real deltas summing exactly to the summed-JS delta.
- **One negative control was redone** because the first attempt produced malformed TypeScript that the dev server still served — the tests failed, but possibly for the wrong reason.
- **No flakes.** Phase 44's `wallets.spec.ts` webkit flake has now not reproduced across three consecutive phases; still watched rather than closed.

## Phase 68 - CI in Playwright's container image: T381-T385 (2026-10-03)

ADR `0044`. Branch `phase-68-ci-apt-optimization`, cut from `main` at `1ce499f`; the workflow change is `3b8a180`, draft PR #18. PR run `37087564638` passed on four attempts. Not merged. Removes the apt step whose slow mirror took up to 19 minutes, the backlog item chosen after Phase 67.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T381 | Baseline: setup, test step and job time for the last 40 runs (117 E2E jobs), and the slow `install-deps` logs | - | Med | Low | 0.3h | done | - | - | setup median 43 s, max 1,171 s; install-deps median 23 s, 3 runs at 5.6 / 10.8 / 19.3 min | - |
| T382 | E2E jobs in `mcr.microsoft.com/playwright:v1.63.0-noble` as `--user 1001`; the browser cache and both install steps removed | `.github/workflows/playwright.yml` | High | Med | 0.3h | done | T381 | `3b8a180` | 141/141 per browser on 4 attempts, none flaky, the port 3100 server included | setup max 1,171 s -> 52 s |
| T383 | The image version once, as `matrix.playwright`; a step fails with both versions named when the lockfile installs another | same | Med | Low | 0.2h | done | T382 | `3b8a180` | locally: 1.63.0 passes, 1.64.0 exits 1 with the message | - |
| T384 | Measure: 4 attempts of PR run `37087564638` against the 40-run and the same-suite baselines | - | Med | Low | 0.3h | done | T382 | - | setup 40-52 s; tests unchanged against the 141-test suite | job median 219 -> 222 s, max 871 -> 265 s |
| T385 | ADR `0044`, `CLAUDE.md` (CI, the two-edit Playwright update, a Do NOT line), refactor log, this ledger, baseline metrics | docs | Low | Low | 0.4h | done | T384 | - | - | - |

**Notes on execution:**
- **No `src/` or `tests/` change.** The four attempts are re-runs of one commit, so they measure the runner and the image, not the code.
- **The test step only looked slower.** Against all 40 runs its median rose 156 -> 176 s, but the suite grew from 119 to 141 tests in that window. Against the three runs of the same 141-test suite it is unchanged (172 -> 176 s).
- **A typical run is not faster:** setup's median is about 5 s longer, since the image pull (24 to 39 s) replaces a cache restore and a 23 s apt run. The gain is that the worst setup in 12 jobs was 52 s.

## Phase 67 - Modal focus trap: T371-T380 (2026-10-02)

ADR `0043`. Branch `phase-67-modal-focus-trap`, cut from `main` at `6354c08`; the phase is `5234613`, merged as `d2f735e` (PR #16). PR run `37027020930` passed; push run `37070456315` failed on a test time zone flaw (T380), fixed by PR #17 (`7f0c738`, merged as `3dd9068`), whose PR run `37074761332` and push run `37075229294` passed. Vercel `dpl_9uk8JX9RkeU4fgUF9HT5as6PA54T` is READY and serves the local build byte for byte. Closes spec section 10 item 12's keyboard half and records the section 10 acceptance check, with antislop applied during the work.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T371 | ADR `0043`, written before the code | `docs/audit/decisions/` | Low | Low | 0.3h | done | T370 | `5234613` | - | - |
| T372 | Focus on open: the first reachable control, unless focus is already inside; the panel (`tabIndex={-1}`, outline off) when there is none | `components/Modal.tsx` | High | Low | 0.3h | done | T371 | `5234613` | probe "dialog takes focus" FAIL -> PASS at 1280 and 390; the 390 row sheet takes focus | entry +1,927 B with T373-T374 |
| T373 | Tab trap: capture-phase listener, wrap at both ends, focus brought back, reachability read at key-press time from markup and style | `components/Modal.tsx` | High | Med | 0.5h | done | T372 | `5234613` | `modalfocus.cjs`: every stop inside at 1280 and 390; the More sheet wraps instead of reaching `BODY` | - |
| T374 | Only the top dialog answers: a stack of open dialogs; Escape marks the event handled; a control belongs to its nearest dialog | `components/Modal.tsx` | Med | Med | 0.3h | done | T373 | `5234613` | a confirmation over the Wallets sheet traps and closes alone in chromium, firefox and webkit | - |
| T375 | Unit `modal-focus.test.tsx` (19) and negative controls for every guard | `unit/` | Med | Low | 0.5h | done | T372-T374 | `5234613` | 615/615; every guard removed alone fails at least one test, `:disabled` with the selector's `:not([disabled])` | unit 596 -> 615, 27 -> 28 files |
| T376 | E2E: Quick Add by keyboard at 1280, a Transactions row at 390; negative controls on chromium | `tests/account-and-mobile-nav.spec.ts` | Med | Low | 0.4h | done | T372-T374 | `5234613` | 12/12 over two repeats; `main`'s `Modal` fails both; no Tab listener fails the Quick Add walk | E2E 139 -> 141 tests, 417 -> 423 runs |
| T377 | Gate: lint, unit, two full Playwright runs; probes before and after on `vite preview`; bundle | - | - | - | 0.6h | done | T375-T376 | `5234613` | run 1 420/423 (three timeouts, no assertion; the specs 48/48 alone), run 2 423/423; `accept10.cjs` 369 -> 372/372; `nested67.cjs` 22/22 x 3 browsers | entry 186,724 -> 188,651 B |
| T378 | Spec section 10 acceptance record: 13 items, status and evidence, Thai quote and English gloss | `docs/audit/spec-acceptance-2026-10-02.md` | Med | Low | 0.5h | done | T377 | `5234613` | 13/13 PASS after Phase 67 | - |
| T379 | `CLAUDE.md` (Modal focus, two Do NOT lines, counts), refactor log, this ledger, baseline metrics | docs | Low | Low | 0.3h | done | all | `5234613` | - | - |
| T380 | Diary unit test: set `TZ` when the file loads, before `TODAY` is computed (it was set in `beforeAll`, after) | `unit/diary-page.test.tsx` | Med | Low | 0.2h | done | push run `37070456315` | `7f0c738` | `TZ=UTC` 4 failures -> 615/615; PR run `37074761332` at 22:53 UTC, inside the failing window: unit 615/615, 141/141 per browser | - |

**Notes on execution:**
- **The first E2E version failed for a locator reason, not the app.** On the date input's calendar-picker stop Playwright's `:focus` matches nothing (closed user-agent shadow root) while `document.activeElement` is the input inside the dialog. Diagnosed from the failure snapshot and a standalone trace before the check changed.
- **Escape closed every open dialog at once** before this phase (no top-of-stack check). Fixed by T374; recorded in ADR `0043` as an amendment.
- **No `src/` or `tests/` file was edited while Playwright ran**; only `docs/` and `CLAUDE.md`.
- **`main`'s first run after the merge failed, and not because of this phase.** Push run `37070456315` (22:04 UTC) failed 4 of 615 unit tests in `unit/diary-page.test.tsx`, so the browser jobs were skipped. The file computed `TODAY` at load and set Bangkok time in `beforeAll`, after it; between 17:00 and 23:59 UTC a runner's `TODAY` was the day before the app's. Unchanged since Phase 61, so it had failed in that window every night since; PR #16's own run fell outside it. Fixed by T380 (PR #17). Production was not affected: Vercel deploys independently of CI.
- **Production** (`dpl_9uk8JX9RkeU4fgUF9HT5as6PA54T`, re-checked after PR #17's `dpl_5ZWq4FYsiSGmvLwfyWkqPDSZ9H61`, which serves the same entry): `accept10.cjs` **372/372**, so all 13 section 10 items pass; `modalfocus.cjs` every Tab stop inside at 1280 and 390 and the More sheet wrapping; `nested67.cjs` 22/22 in chromium, firefox and webkit.

## Phase 66 - UI polish: T363-T370 (2026-10-02)

ADR `0042`. Branch `phase-66-ui-polish`, cut from `main` at `1036ee0`; the phase is `1eecc8c`, merged as `7e2daa9` (PR #15). PR run `37002162580` and push run `37003395179` passed; Vercel `dpl_8vuPfAZLQkzY3dpuuXUSbXarHomX` is READY and serves the local build byte for byte. Closes Phase 65's open toast/More sheet gap and audit 013 findings 6 and 7, with antislop applied during the work.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T363 | ADR `0042`, written before the code | `docs/audit/decisions/` | Low | Low | 0.3h | done | T362 | `1eecc8c` | - | - |
| T364 | `ReloadPrompt` `z-50` -> `z-45`: above the header and nav (40), under every `Modal` (50) | `components/ReloadPrompt.tsx` | High | Low | 0.2h | done | T363 | `1eecc8c` | probe at 390: Debt payoff, Daily diary, Categories rows hit the toast -> hit themselves; the Transactions Add dialog covers the toast at 390 and 1280 | - |
| T365 | `AllocationBar` `emptyCaption`; "No money in your wallets yet" on the Dashboard Wallets card and the Wallets page list (finding 6) | `components/ui/AllocationBar.tsx`, `dashboard/WalletsSection.tsx`, `wallet/WalletList.tsx` | Low | Low | 0.3h | done | T363 | `1eecc8c` | shown once per page at ฿0, absent with a positive balance | - |
| T366 | Quick Add says each thing once (finding 7): no form heading; "Use result" instead of the repeated figure; placeholder as the only formula help; "Operators:" fits at 390 | `TransactionForm.tsx`, `InlineMathInput.tsx` | Low | Low | 0.4h | done | T363 | `1eecc8c` | one heading in Quick Add; all spec ids unchanged | `TransactionForm` 25.85 -> 25.49 kB, `InlineMathInput` 6.44 -> 5.98 kB |
| T367 | A real toast under test: `devOptions` in `--mode pwa-dev`, a second Playwright `webServer` on 3100, `dev-dist/` gitignored, `toast-layering.spec.ts` | `vite.config.ts`, `playwright.config.ts`, `.gitignore`, `tests/` | Med | Low | 0.6h | done | T364 | `1eecc8c` | the real offline-ready toast appears in chromium, firefox and webkit; no injection, no interception | - |
| T368 | Tests: unit `ui-display` +1, `dashboard` +1, `wallets-page` +2; E2E `toast-layering` +2, `transaction` +1; negative controls; layering, touch and smoke probes (scratchpad) | `unit/`, `tests/` | Med | Low | 0.6h | done | T364-T367 | `1eecc8c` | lint clean; unit 596/596; Playwright 417/417 on both full runs (139 per browser; 6.0 m, 6.2 m), no flake. Negative controls: `z-50` fails both layering tests, no `emptyCaption` fails the fresh-guest caption test. Touch probe 0 under 44px; smoke 192/192 | unit 592 -> 596; E2E 136 -> 139 tests, 408 -> 417 runs, 28 -> 29 files |
| T369 | `CLAUDE.md` (layer order, caption, form structure, second webServer, two Do NOT lines, counts), refactor log, this ledger, baseline metrics | docs | Low | Low | 0.4h | done | all | `1eecc8c` | - | entry unchanged at 186,724 B |
| T370 | Release: PR #15 merged, production byte check, layering probe and signed-out smoke on production, sha backfill | - | - | - | 0.4h | done | all | `7e2daa9` | CI unit 596/596, 139/139 per browser; 55 of 59 files identical, the rest line endings only; at 390 every More row hits itself under the real toast; smoke 252/252 at 1280, 1024 and 390, light and dark | - |

## Phase 65 - audit 013 fixes: T354-T362 (2026-10-02)

ADR `0041`. Branch `phase-65-audit-013-fixes`, cut from `main` at `025e303`; its first commit (`2474185`) records audit 013 itself, and the phase's work is `d2d1e70`. Merged as `517aee8` (PR #14); PR run `36986445549` and push run `36989305255` passed; Vercel `dpl_9LooVHCjGCdG5tjVPRgpC4CkrT2k` is READY and serves the local build byte for byte. The owner picked findings 1, 2, 3, 4, 5 and 8, with antislop applied during the work; **findings 6 and 7 stay open**.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T354 | ADR `0041`, written before the code | `docs/audit/decisions/` | Low | Low | 0.4h | done | T353 | `d2d1e70` | - | - |
| T355 | `ReloadPrompt` above the phone nav (finding 1): `calc(5rem + env(safe-area-inset-bottom, 0.5rem))` below `md`, `bottom-5` from it | `components/ReloadPrompt.tsx` | High | Low | 0.3h | done | T354 | `d2d1e70` | toast 680-824 over all five nav buttons -> 620-764, 14px above Quick Add, every nav centre hits its button | - |
| T356 | Toast: no idle spin, no dead `animate-in`, plain copy (findings 5 and 8) | `components/ReloadPrompt.tsx` | Med | Low | 0.2h | done | T354 | `d2d1e70` | probe: no animation on the toast or its icons | entry -76 B |
| T357 | 44px targets in the entry form (finding 2, and the extras the probe found) | `TransactionForm.tsx`, `InlineMathInput.tsx`, `QuickAddModal.tsx`, `transaction/SaveRuleChip.tsx`, `transaction/CategorySuggestionChip.tsx` | High | Med | 1h | done | T354 | `d2d1e70` | probe under-44: 11/9/7 -> 0/0/0; outline on the pill | - |
| T358 | Sparkles replaced: `Calculator`, `Tags` (x2), `CheckCircle2` (finding 3) | the same files | Med | Low | 0.2h | done | T354 | `d2d1e70` | `Sparkles` not imported in `src/` | - |
| T359 | Transactions first-run empty state (finding 4) | `views/TransactionsView.tsx` | Med | Low | 0.3h | done | T354 | `d2d1e70` | 4 unit tests; 3 fail on the old view | - |
| T360 | Tests: unit `transactions-page` +4, E2E `transaction.spec.ts` +1; touch and toast probe (scratchpad) | `unit/`, `tests/` | Med | Low | 0.6h | done | T355-T359 | `d2d1e70` | lint clean; unit 592/592; Playwright 408/408 on the third full run (chromium, firefox, webkit, 136 each; 6.6 m). The first two runs each lost WebKit clicks to the known 'waiting for stable' timeout on controls this phase did not touch (run 1: the Wallets adjust button and the Import CSV menu item, 406/408; run 2: Add debt, 407/408); each spec passed 20/20 and 3/3 on its own re-run | unit 588 -> 592; E2E 135 -> 136 tests, 405 -> 408 runs |
| T361 | `CLAUDE.md`, refactor log, this ledger, baseline metrics | docs | Low | Low | 0.4h | done | all | `d2d1e70` | - | - |
| T362 | Release: PR #14 merged, production byte check, signed-out smoke and probe on production, sha backfill | - | - | - | 0.4h | done | all | `517aee8` | 55 of 59 files identical, the rest line endings only; smoke 192/192 across six views at 1280, 1024 and 390, light and dark; probe 0 controls under 44px; the toast clears every nav button at 390 but covers the More sheet's rows (open, see the refactor log) | - |

## Audit 013 - antislop verification pass after Phase 54: T353 (2026-10-02)

A mode 2 audit with no phase of its own and no code change. It confirms what Phase 54 left pending: **R-17, R-38 and C-5 now pass** on all three paths (a new guest on production, sign-out, a new sign-up through `seed_starter_account()`), and it re-audits all six views and the shared entry form. "Obsidian Slate" and "R-39/R-40", named in the request, do not exist; the audit uses the real token system and R-01 to R-38 plus C-1 to C-5.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T353 | Antislop audit 013 (mode 2): R-17/R-38/C-5 verification, all six views at 1280/1024/390 in light and dark, on production | `anti-slop/audit-013-2026-10-02.md` | - | - | 1.5h | done; findings await the owner | T352 | - | 8 findings (2 HIGH, 3 MEDIUM, 3 LOW; finding 3 is audit 005's known sparkles); R-17, R-38 and C-5 confirmed PASS; unit 588/588; lint clean; Phase 54 probe OK inside `begin ... rollback` (0 fixture rows left); live body md5 `90c93706...` = the file | - |

## Phase 54 - empty starters (audit 001 finding 6): T346-T352 (2026-10-02)

ADR `0040`. The phase reserved since Phase 55 for audit 001 finding 6. The owner's decisions:
- new guests, `resetToGuestState` and new sign-ups start with three wallets at ฿0.00 and no debt;
- tests that need money or a debt seed it themselves;
- new accounts only: stored guest ledgers and accounts already seeded keep their balances;
- the names stay as they are ("Main Checking" on the client, "Checking Account" on the server).

Branch `phase-54-empty-starters`, cut from `main` at `e044ba0`, merged as `0882695` (PR #13; Vercel `dpl_GSmZYYCtL4NU7UUsvDCojGEXRCWK` READY, byte-checked, signed-out smoke OK). **One migration**, `20261003_phase54_zero_starter_seed.sql`, applied to the live project on 2026-10-02 (`20261002061331`); the client does not depend on it. **Resolves R-17, R-38 and C-5** (FAIL, known and deferred, in audits 002 to 012), pending the next antislop audit's confirmation.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T346 | ADR `0040`; amendment notes in ADR `0024` (F7) and `0021` (unit fixture) | `docs/audit/decisions/` | Low | Low | 0.4h | done | - | `052b6c4` | - | - |
| T347 | Guest starters at ฿0.00, `DEFAULT_STARTER_DEBTS` removed, F7 comment rewritten | `context/FinanceContext.tsx` | High | Low | 0.2h | done | T346 | `052b6c4` | 2 unit tests fail on the old file | entry -267 B |
| T348 | `seed_starter_account()` at 0.00 from the md5-matched Phase 64 body, grants restated; its probe | `supabase/migrations/`, `supabase/tests/` | High | Low | 0.4h | done; applied `20261002061331` | T346 | `052b6c4` | deployed body md5 `06b826c0...` = the Phase 64 file before; Phase 54 probe OK; Phase 64 probe seed and grant sections OK on the new body (the dedupe sections were not re-run: they touch every account and do not involve this function); after apply the live body md5 `90c93706...` = the file | - |
| T349 | E2E fixtures (`SAMPLE_WALLETS`, `SAMPLE_STUDENT_LOAN`, `seedLedger`, write-once), seven specs seeded, a fresh-guest regression test | `tests/` | High | Med | 0.8h | done | T347 | `052b6c4` | 405/405; control: 6 of 7 failed unseeded | E2E 134 -> 135 tests |
| T350 | Unit fixture `guestLedger.ts`; five suites seeded; two new tests | `unit/` | High | Low | 0.5h | done | T347 | `052b6c4` | 588/588 | unit 586 -> 588 |
| T351 | `CLAUDE.md`, refactor log, this ledger, baseline metrics | docs | Low | Low | 0.4h | done | all | `052b6c4` | - | - |
| T352 | Probe and Phase 64 probe re-run, apply on the owner's word, PR, sha backfill | - | - | - | 0.5h | done; PR #13 merged | all | `0882695` | - | - |

## Phase 64 - the re-seeding guard and the duplicate cleanup: T339-T345 (2026-10-02)

ADR `0039`. The owner's decisions:
- a server-side seed function, with no client fallback;
- duplicate categories soft-deleted, with their transactions and rules re-pointed to the earliest copy;
- the 24 deleted wallets kept;
- no antislop audit (no UI change).

Branch `phase-64-seed-guard`, cut from `main` at `77b0cdb`. **Two migrations:** `20261002_phase64_seed_starter_account.sql`, applied before the client deploys, and `20261002_phase64_dedupe_categories.sql`, applied after. Both wait for the owner's word, the probe first.
- Merged into `main` as `b65b437` with a merge commit, with the owner's go-ahead. PR run `36963695971` and push run `36964231528` passed. Vercel `dpl_HFtfaZbUWFXnvC8UmVC148NZtUt5` is READY and serves the local build byte for byte. The dedupe was run by the owner in the Supabase SQL editor (not recorded in the migration history); every money fingerprint is unchanged, but the 27 duplicate rows were **removed, not marked deleted**: afterwards the table holds 20 category rows, all live, where before it held 47 and none deleted. `20261002_phase64_dedupe_categories.sql` only sets `is_deleted`, so it cannot lower the row count; the run was most likely `20260920_dedupe_categories.sql`, which re-points the same way and then physically deletes the copies. **Accepted and closed by the owner (2026-10-02):** the permanent removal stands. The rows were seeding duplicates that nothing referenced, the same kind the 2026-09-19 cleanup removed, so no restore from backup is planned.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T339 | `seed_starter_account()`: no session refused, once only (deleted rows count), advisory lock, one transaction | `supabase/migrations/` | High | Med | 0.5h | applied 2026-10-02 (`20261002041331`) | - | `c17019a` | probe OK; security definer, `authenticated` yes, `anon` no | - |
| T340 | The client calls it; four outcomes; a failed seed keeps the screen and sets `syncError`; no client inserts | `context/FinanceContext.tsx` | High | Med | 0.5h | done | T339 | `c17019a` | 4 unit tests; 3 controls failed | - |
| T341 | Dedupe: re-point transactions and rules to the earliest copy, `updated_at` bumped, losers soft-deleted | `supabase/migrations/` | High | Med | 0.4h | run 2026-10-02 in the SQL editor; the copies were removed, not soft-deleted (see above) | - | `c17019a` | live preview: 38 -> 11, 17 transactions, 0 rules | - |
| T342 | The probe for both | `supabase/tests/` | High | Low | 0.6h | done; the owner ran it in the SQL editor: `PHASE 64 PROBE OK` | T339, T341 | `c17019a` | - | - |
| T343 | Unit: the seed contract, replacing Phase 63's direct-insert seed test | `unit/authenticated-ledger.test.tsx` | High | Low | 0.4h | done | T340 | `c17019a` | unit 583 -> 586 | - |
| T344 | ADR `0039`, `CLAUDE.md` ("Do NOT seed from the client"), ledger, log | docs | Low | Low | 0.4h | done | all | `031d824` | - | - |
| T345 | Gate (lint, unit, Playwright, build), sha backfill, draft PR; apply the migrations in order on the owner's word | - | - | - | 1h | done | all | - | lint clean; unit 586/586; PR and push CI 134/134 per browser; probe OK | entry -124 B |

## Phase 63 - FinLife redesign, step 5 (spec 5.1's colour migration): T329-T337 (2026-10-02)

ADR `0038`. The plan was approved in plan mode; the owner's decisions:
- any row in any account still on its shipped colour moves, plus spec 5.1's named rows, and a colour someone picked stays;
- the live duplicate category rows are recoloured, not removed (their cleanup stays open);
- a target colour already held by another category becomes the first free identity colour (L9);
- antislop mode 2 (audit 012).

Branch `phase-63-category-colours`, cut from `main` at `ba87338`. It also carries `ee53206`, the Phase 62 deploy record, which had not been pushed. **One data-only migration**, `20261002_phase63_identity_colors.sql`, applied after the merge and deploy, on the owner's word.
- Merged into `main` as `9c35489` with a merge commit, with the owner's go-ahead, after audit 012's findings 1 and 4 were fixed (T338). PR run `36945015504` and push run `36948152458` passed. Vercel `dpl_7RFMfczepXDoeJNdpGkvTcPpABe7` is READY and serves the local build byte for byte. The migration was applied to the live project on 2026-10-02 (version `20261002013725`): 47 category rows and 6 wallets moved, and nothing is left to move or collides.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T329 | `migrateCategoryColors` / `migrateWalletColors`: the 5.1 table and the L9 collision rule | `utils/identityColorMigration.ts` | High | Med | 0.5h | done | - | `1f09894` | 9 unit tests; 3 controls failed | - |
| T330 | Seeds on identity colours (guest and new account) | `context/FinanceContext.tsx` | Med | Low | 0.2h | done | T329 | `1f09894` | signed-in seed test; its control failed | - |
| T331 | The `pf_categories` / `pf_wallets` hydration applies the migration (never the Supabase load) | `context/FinanceContext.tsx` | High | Low | 0.2h | done | T329 | `1f09894` | 2 seam controls failed | - |
| T332 | "Color" throughout, swatches named by colour, "Current color"; System chip colour in the rules table | `wallet/`, `category/`, `identityPalette.ts` | Low | Low | 0.3h | done | - | `1f09894` | - | - |
| T333 | The SQL migration and its probe | `supabase/` | High | Med | 1h | done; applied 2026-10-02 (`20261002013725`) | T329 | `cdda81d` | `PHASE 63 PROBE OK` on the live schema | - |
| T334 | Unit: `identity-color-migration` (9), page and seed tests (7), 3 fixtures moved | `unit/` | High | Low | 0.7h | done | T329-T332 | `1f09894` | 6 controls caught in all | unit 562 -> 578 |
| T335 | Gate: lint, unit, build, Playwright twice, walk-through | - | - | - | 1h | done | all | ce9731b | lint clean; unit 578/578; Playwright 398/402 then 401/402 (click-settling timeouts only, each file green on repeat); probe OK | entry +1,817 B |
| T336 | Antislop audit 012 (mode 2) | `anti-slop/audit-012-2026-10-02.md` | - | - | 0.4h | done; findings await the owner | T335 | ce9731b | 4 findings (1 MEDIUM, 3 LOW), no new Hard Gate failure | - |
| T337 | ADR `0038`, `DESIGN.md`, `CLAUDE.md`, ledger, log, metrics; sha backfill; draft PR | docs | Low | Low | 0.6h | docs done; draft PR on the owner's word | all | ce9731b | - | - |
| T338 | Audit 012 findings 1 and 4: colours repeat past twelve (`paletteExhausted`, `nextColor`, both guards); "Custom color" | `selectors/categories.ts`, `category/`, `CategoriesView.tsx`, `FinanceContext.tsx` | High | Low | 0.6h | done | T336 | 7b4e61a | unit 578 -> 583; 4 controls failed | - |

## Phase 62 - FinLife redesign, step 4, sixth page (Categories): T314-T328 (2026-10-01)

ADR `0037`. The plan was approved in plan mode; the owner's decisions:
- Delete only an unused category (no move-then-delete);
- spec 5.1's colour migration is its own phase (Phase 63);
- header tabs show icons only below 1280px (audit 007 finding 1);
- antislop mode 2 (audit 011).

Branch `phase-62-categories`, cut from `main` at `192e333`. It also carries `43524c4`, the Phase 61 deploy record, which had not been pushed. No migration.
- Merged into `main` as `ba87338` with a merge commit, with the owner's go-ahead, after audit 011's findings 1 and 2 were fixed (T328). PR run `36876112983` and push run `36881986291` passed. Vercel `dpl_BXMooK9LkRpXEe5c85WzPbp6zo9z` is READY and serves the local build byte for byte.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T314 | One identity palette; `categoryGroups`, `categoryUsage`, `firstFreeColor` | `utils/identityPalette.ts`, `selectors/categories.ts`, `walletFormStyles.ts` | Med | Low | 0.4h | done | - | 58b5d75 | 4 selector tests | - |
| T315 | L9 and L10 guards in `addCategory` / `updateCategory` | `context/FinanceContext.tsx` | High | Med | 0.5h | done | T314 | 58b5d75 | 3 signed-in tests; 3 controls failed | - |
| T316 | `PageHeader` "Categories", Categories / Smart rules tablist | `views/CategoriesView.tsx` | Med | Low | 0.2h | done | - | f8c62a0 | - | - |
| T317 | `CategoryList`: three groups, one button per row, locked System rows | `category/CategoryList.tsx` | Med | Low | 0.5h | done | T314 | f8c62a0 | a raw type on the row failed | - |
| T318 | `CategoryForm` + `ColorGrid`: New / Edit, L9 grid, "Current colour" | `category/` | High | Med | 1h | done | T314-T315 | f8c62a0 | Delete-while-in-use, clickable used swatch and lost older colour controls failed | - |
| T319 | Below `lg`: the edit form in a sheet | `views/CategoriesView.tsx` | Med | Low | 0.3h | done | T318 | f8c62a0 | - | - |
| T320 | Delete: unused custom only, confirmed, result checked, focus to the list | `views/CategoriesView.tsx` | Med | Low | 0.3h | done | T318 | f8c62a0 | - | - |
| T321 | Smart rules tab as `SmartRulesPanel`: types as words, no heading icons | `category/SmartRulesPanel.tsx` | Low | Low | 0.3h | done | - | f8c62a0 | - | - |
| T322 | Header tab labels from `xl` (audit 007 finding 1) | `Navbar.tsx` | Med | Low | 0.1h | done | - | f8c62a0 | 1024: nav overflow 0 | - |
| T323 | Unit: `categories-page` (16) | `unit/` | High | Low | 1h | done | T314-T322 | f8c62a0 | 7 controls caught in all | unit 537 -> 560 |
| T324 | Spec moves (`categories`, `keywords`); `tests/categories-page.spec.ts` (3) | `tests/` | High | Low | 0.4h | done | T316-T322 | f8c62a0 | - | E2E 393 -> 402 runs |
| T325 | Gate: lint, unit, WCAG, build, Playwright twice, walk-through | - | - | - | 1h | done | all | 03a1311 | lint clean; unit 560/560; Playwright 401/402 twice (one intermittent per run, outside the phase) | entry +2,561 B |
| T326 | Antislop audit 011 (mode 2) | `anti-slop/audit-011-2026-10-01.md` | - | - | 0.5h | done; findings 1 and 2 fixed (T328), the rest accepted | T325 | 03a1311 | 5 findings (2 MEDIUM, 3 LOW), no new Hard Gate failure | - |
| T327 | ADR `0037`, `DESIGN.md`, `CLAUDE.md`, selector contract, ledger, log, metrics; sha backfill; draft PR | docs | Low | Low | 1h | done; draft PR on the owner's word, 2026-10-01 | all | 03a1311 | - | - |
| T328 | Audit 011 findings 1 and 2: a strike on used colours; "Add category" in the header below `lg` | `category/ColorGrid.tsx`, `views/CategoriesView.tsx`, `unit/categories-page.test.tsx` | Low | Low | 0.4h | done | the owner | 837d442 | a control for each failed its test; the category, rules, nav and wallet specs 117/117 on all three browsers | unit 560 -> 562 |

## Phase 61 - FinLife redesign, step 4, fifth page (Daily diary): T299-T313 (2026-10-01)

ADR `0036`. The plan was approved in plan mode; the owner's decisions:
- Delete confirms first;
- a day with no entry starts with no mood, and Save waits for one;
- "N transactions" opens the Transactions page filtered to that day, in place of the expander;
- antislop mode 2 (audit 010).

Branch `phase-61-diary`, cut from `main` at `3f45e3b`. It also carries `ef1bdea`, the Phase 60 deploy record, which had not been pushed. No migration.
- Merged into `main` as `192e333` with a merge commit, with the owner's go-ahead, after audit 010's findings 1 and 3 were fixed (T313). PR run `36859636624` and push run `36869396358` passed. Vercel `dpl_HzVLx7VeGMkoAXwT54CHzchV3Csi` is READY and serves the local build byte for byte.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T299 | `daySpending` (L1), `diaryMonth`; `moodSpendingDays` uses `daySpending` | `selectors/diary.ts` | Med | Low | 0.3h | done | - | e8a1f79 | `unit/dashboard.test.tsx` unedited | - |
| T300 | `monthGrid` (Monday first), `shiftMonth`, `monthKeyOf`, `formatMonthYear`, `formatDiaryHeading` | `utils/date.ts` | Med | Low | 0.3h | done | - | e8a1f79 | a Sunday-first control failed 2 tests | - |
| T301 | Diary labels, shared `MoodMeter`, the `logged` token | `components/diary/`, `MoodSpendingCard.tsx`, `index.css`, `wcag-tokens.mjs` | Med | Low | 0.3h | done | - | e8a1f79 | WCAG: `fg` on `logged-bg` 12.86 / 9.49 | - |
| T302 | `PageHeader` "Daily diary", Export JSON, 7/5 layout | `views/DiaryView.tsx` | Med | Low | 0.2h | done | T299-T301 | 220e7db | - | - |
| T303 | `DiaryEntryForm`: starts from the day's entry (keyed), no-mood default, previous / Pick date / next, one selected style | `diary/DiaryEntryForm.tsx` | High | Med | 1h | done | T302 | 220e7db | controls (no load, Save without a mood) each failed | - |
| T304 | `DiaryCalendar`: Monday first, logged / today / future, a click loads the day | `diary/DiaryCalendar.tsx` | Med | Low | 0.6h | done | T300 | 220e7db | a clickable future day failed its test | - |
| T305 | `RecentEntries` / `DiaryEntryRow` (replace `DiaryEntryCard`) | `diary/`, `DiaryEntryCard.tsx` (deleted) | Med | Low | 0.6h | done | T301 | 220e7db | - | - |
| T306 | Delete confirms and checks the result; focus to the next entry | `views/DiaryView.tsx` | Med | Low | 0.3h | done | T305 | 220e7db | a delete without the confirm failed | - |
| T307 | Day hand-off: `transactionsDayFilter`, `initialDayFilter`, `#tx-day-filter` | `App.tsx`, `views/TransactionsView.tsx` | Med | Low | 0.4h | done | T305 | 220e7db | bounds that ignore the day failed | - |
| T308 | Unit: `diary-page` (17), day filter (2) | `unit/` | High | Low | 1h | done | T299-T307 | 220e7db | 6 controls caught | unit 518 -> 537 |
| T309 | `tests/diary-page.spec.ts` (3); `diary.spec.ts` and `theme.spec.ts` unedited | `tests/` | High | Low | 0.4h | done | T302-T307 | 220e7db | - | E2E 384 -> 393 runs |
| T310 | Gate: lint, unit, WCAG, build, Playwright, walk-through; "Daily diary" in the nav (`d80fb5e`); the Phase 60 size figures corrected | - | - | - | 1h | done | all | d80fb5e, cc9c310 | lint, unit 537/537, WCAG, build; Playwright 392 then 393 of 393 (one Firefox page-open failure in run 1); walk-through clean | entry +525 B |
| T311 | Antislop audit 010 (mode 2) | `anti-slop/audit-010-2026-10-01.md` | - | - | 0.5h | done; findings 1 and 3 fixed (T313), the rest accepted | T310 | cc9c310 | 6 findings (2 MEDIUM, 4 LOW), no new Hard Gate failure | - |
| T312 | ADR `0036`, `DESIGN.md`, `CLAUDE.md`, selector contract, ledger, log, metrics; sha backfill; draft PR | docs | Low | Low | 1h | done; draft PR on the owner's word, 2026-10-01 | all | cc9c310 | - | - |
| T313 | Audit 010 findings 1 and 3: the range select reads "One day" under a day filter; today's ring is white on the form's day | `views/TransactionsView.tsx`, `diary/DiaryCalendar.tsx`, `unit/transactions-page.test.tsx`, `unit/diary-page.test.tsx` | Low | Low | 0.3h | done | the owner | 7b68e67 | a control for each failed its test; Playwright 392/393 then the failing Firefox file 60/60 | - |

## Phase 60 - FinLife redesign, step 4, fourth page (Debt payoff): T285-T298 (2026-10-01)

ADR `0035`. The plan was approved in plan mode; the owner's decisions:
- Edit changes the name, interest rate, minimum payment, due date and the borrowed total, which can never go below what is still owed; what is still owed is never edited;
- Mark as paid off confirms first, in a non-destructive dialog that says no money moves;
- paid-off debts go in an open "Paid off (N)" section below the active ones;
- antislop mode 2 (audit 009).

Branch `phase-60-debts`, cut from `main` at `f58f681`, PR #8. It also carried `a0cb2c1`, the Phase 59 deploy record, which had not been pushed. No migration.
- Merged into `main` as `3f45e3b` with a merge commit, with the owner's go-ahead, after audit 009's findings 1 and 3 were fixed (T298). PR run `36841191990` and push run `36843306528` passed.
- Vercel `dpl_8BbKBF8sKiEzENRxe7zCC9V3bVXU` serves a build that matches the local one byte for byte, apart from line endings. A signed-out smoke test on production passed: the page, Edit's floor and save, Mark as paid off (Cancel, then confirm) at 1280, and the More sheet at 390 (see the refactor log).

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T285 | `editDebt` + `DebtEditSchema` (Borrowed never below what is owed); the update never sends `remaining_amount` or `is_settled` | `FinanceContext.tsx`, `zodSchemas.ts`, `types.ts` | High | Med | 0.5h | done | - | bcc8621 | a control sending `remaining_amount` and one without the floor each failed a signed-in test | - |
| T286 | `useDebts`: `editDebt`, `activeDebts` / `settledDebts` sorted by `sortByDueDate` | `hooks/useDebts.ts` | Med | Low | 0.2h | done | T285 | bcc8621 | a control without the sort failed the order test | - |
| T287 | `PageHeader` "Debt payoff", "N active debts · sorted by due date", "Add debt" | `views/DebtsView.tsx` | Med | Low | 0.2h | done | T286 | ebf7a14 | - | - |
| T288 | `DebtSummaryCard`: Still owed, Paid off, the L5 box or "On track" | `debt/DebtSummaryCard.tsx` | High | Low | 0.5h | done | T287 | ebf7a14 | - | - |
| T289 | `DebtCard` (replaces `DebtCardItem`): tags, ⋯ menu, 28px remainder, three boxes, two actions | `debt/DebtCard.tsx`, `DebtCardItem.tsx` (deleted) | High | Med | 1h | done | T287 | ebf7a14 | - | - |
| T290 | Layout: summary, active grid, "Paid off (N)", caption | `views/DebtsView.tsx` | Med | Low | 0.3h | done | T288, T289 | ebf7a14 | - | - |
| T291 | Dialogs: Mark as paid off confirms; `EditDebtModal`; Delete from the menu; focus when the opener is gone | `views/DebtsView.tsx`, `debt/EditDebtModal.tsx` | High | Med | 0.7h | done | T290 | ebf7a14 | controls skipping the confirm and dropping the focus hand-off each failed | - |
| T292 | Unit: `debts-page` (18), signed-in `editDebt` (4) | `unit/` | High | Low | 1h | done | T285-T291 | bcc8621, ebf7a14 | 5 controls caught | unit 494 -> 516 |
| T293 | Spec moves: `theme` (heading), `soft-delete` (open the menu first) | `tests/` | High | Low | 0.1h | done | T289 | ebf7a14 | locator/copy moves only; `debts.spec.ts` unedited | - |
| T294 | `tests/debts-page.spec.ts` (3 guest tests) | `tests/` | High | Low | 0.3h | done | T291 | ebf7a14 | - | E2E 375 -> 384 runs |
| T295 | Gate: lint, unit, WCAG, build, Playwright (four full runs), walk-through | - | - | - | 1h | done | all | - | lint, unit 516/516, WCAG, build; Playwright 384, 383, 383, 384 (two Firefox mobile-nav timeouts, the known intermittent; 240/240 on targeted repeats); walk-through clean | build entry +1,778 B |
| T296 | Antislop audit 009 (mode 2) | `anti-slop/audit-009-2026-10-01.md` | - | - | 0.5h | done; findings 1 and 3 fixed (T298), the rest accepted | T295 | baae0e3 | 6 findings (2 MEDIUM, 4 LOW), no new Hard Gate failure | - |
| T297 | ADR `0035`, `DESIGN.md`, `CLAUDE.md`, selector contract, ledger, log, metrics; sha backfill; draft PR | docs | Low | Low | 1h | done; draft PR on the owner's word, 2026-10-01 | all | baae0e3 | - | - |
| T298 | Audit 009 findings 1 and 3: the L5 box's wording for a zero, negative or small surplus; "Debt payoff" in the nav | `debt/DebtSummaryCard.tsx`, `Navbar.tsx`, `MobileBottomNav.tsx`, `unit/debts-page.test.tsx` | Low | Low | 0.3h | done | the owner | d5a06c4 | a control with the old wording failed 2 tests; the Firefox intermittent measured on `main` (2/180) and here (1/180) | unit 516 -> 518 |

## Phase 59 - FinLife redesign, step 4, third page (Wallets): T268-T284 (2026-10-01)

ADR `0034`, amending `0008`. The plan was approved in plan mode; the owner's decisions:
- a Dashboard wallet row hands off to the Wallets page with that wallet selected, and `WalletPopupModal` is deleted;
- archive **and** unarchive, with archived wallets under a collapsed "Archived (N)";
- Edit changes name, type and colour, never the balance;
- antislop mode 2 (audit 008).

Branch `phase-59-wallets`, cut from `main` at `8725c11`, PR #7. It also carried `ffd1b4e`, the Phase 58b deploy record, which had not been pushed.
- Merged into `main` as `f58f681` with a merge commit, with the owner's go-ahead, after audit 008's findings 1 and 2 were fixed (T283, T284). Push run `36823383454` passed.
- Vercel `dpl_ECj8qkmWJk7gTWNahBmujEqzwon9` serves a build that matches the local one byte for byte, apart from line endings. A signed-out smoke test on production passed: the Dashboard hand-off, adjust, edit, archive and unarchive at 1280, and the sheet's Escape and focus return at 390 (see the refactor log).

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T268 | `editWallet` + `WalletEditSchema` (no balance; a wallet in debt stays a credit card); `updateWallet` sends only named columns | `FinanceContext.tsx`, `zodSchemas.ts`, `types.ts` | High | Med | 0.5h | done | - | 373c28b | a control restoring the old payload failed 2 signed-in tests | - |
| T269 | `setWalletArchived` | `FinanceContext.tsx` | Med | Low | 0.2h | done | T268 | 373c28b | see T278 | - |
| T270 | `walletActivity`, `archivedWallets`, shared `byNewest` | `selectors/wallets.ts`, `TransactionsView.tsx` | Med | Low | 0.3h | done | - | 373c28b | 3 selector tests | - |
| T271 | New-entry pickers offer active wallets only | `QuickAddModal.tsx`, `TransactionsView.tsx`, `hooks/useDebts.ts` | Med | Low | 0.2h | done | T269 | 373c28b | a control restoring the old filter failed the archive spec | - |
| T272 | `WalletsView`: `PageHeader`, master-detail from `lg` (5/7, then 4/8 at `xl`), sheet below | `views/WalletsView.tsx` | High | Med | 1h | done | T268-T271 | 21dba28 | - | - |
| T273 | `WalletList`: AllocationBar, row buttons, dashed Add wallet, Archived group | `wallet/WalletList.tsx`, `walletFormStyles.ts` | High | Low | 0.5h | done | T272 | 21dba28 | - | - |
| T274 | `WalletDetail`: header + menu, balance box, Adjust editor (moved), Edit form, activity | `wallet/WalletDetail.tsx` | High | Med | 1.5h | done | T272 | 21dba28 | - | - |
| T275 | `ActivityFeed` extracted from `RecentActivityCard` | `transaction/ActivityFeed.tsx`, `dashboard/RecentActivityCard.tsx` | Med | Med | 0.3h | done | - | 21dba28 | `unit/dashboard.test.tsx` unedited, 17/17 | - |
| T276 | Dashboard hand-off through `App.tsx` | `App.tsx`, `DashboardView.tsx`, `WalletsSection.tsx` | Med | Low | 0.3h | done | T272 | 21dba28 | - | - |
| T277 | Delete `WalletPopupModal` and its compact icons, `sm` size, `tintOverride` | `WalletPopupModal.tsx` (deleted), `TxCells.tsx`, `txTypeMeta.ts` | Med | Low | 0.2h | done | T276 | 21dba28 | - | - |
| T278 | Unit: `wallets-page` (12), selectors (3), signed-in (3) | `unit/` | High | Low | 1h | done | T268-T277 | 373c28b, 21dba28 | 5 mutations caught | unit 471 -> 489 |
| T279 | Spec moves: `soft-delete`, `account-and-mobile-nav`, `theme`, `date-boundary` | `tests/` | High | Med | 0.3h | done | T272-T277 | 21dba28 | locator/copy moves only | - |
| T280 | `tests/wallets-page.spec.ts` (3 guest tests) | `tests/` | High | Low | 0.3h | done | T272-T277 | 21dba28 | 2 controls each failed their test | E2E 366 -> 375 runs |
| T281 | Gate: lint, unit, WCAG, build, Playwright twice, walk-through, antislop audit 008; audit 008's in-pass fix (Escape in the menu closed the sheet) | `ui/OverflowMenu.tsx`, `unit/ui-controls.test.tsx` | - | - | 1h | done | all | 77e33cf | 375/375 twice; the fix's test failed first; 90 menu-spec runs after it | unit 489 -> 490 |
| T282 | ADR `0034`, `DESIGN.md`, `CLAUDE.md`, selector contract, ledger, log, metrics; sha backfill; draft PR | docs | Low | Low | 1h | docs and backfill done; draft PR on the owner's word, 2026-10-01 | all | 7c54dfe | - | - |
| T283 | Audit 008 finding 2: the wallet colour picker offers spec section 1's twelve identity colours | `wallet/walletFormStyles.ts`, `unit/wallets-page.test.tsx` | Med | Low | 0.2h | done | the owner | 7f4b1a3 | a control with red put back failed its test | - |
| T284 | Audit 008 finding 1: `Modal` returns focus to its opener when it closes | `Modal.tsx`, `unit/ui-controls.test.tsx`, `unit/wallets-page.test.tsx` | Med | Med | 0.3h | done | the owner | 7f4b1a3 | a control without the restore failed 2 tests | unit 490 -> 494 |

**Notes on execution:**
- **The walk-through found three layout problems, all fixed before the gate:** the balance box had no inner padding; at 1024 a 4/12 list cut every wallet name off; and the balance buttons wrapped into a column beside the figure.
- **A full-page screenshot reported a doubled detail that a user never sees.** Chromium resizes the viewport to 1px wide for the capture, which flips `useMediaQuery` and leaves the sheet's exit animation stuck. A real resize across 1024 gives one copy each way. Recorded in `CLAUDE.md` and the selector contract.
- **`updateWallet` had always sent `balance: undefined`.** `JSON.stringify` dropped it, so nothing was wrong on the wire, but nothing stopped a caller from sending one. It now sends only the columns it is given, and a signed-in test pins the absence.

## Phase 58b - Editing a transaction (spec 6.2's edit panel): T253-T267 (2026-09-30)

ADR `0033`. The plan was approved in plan mode; the owner's decisions:
- a new `update_transaction` RPC, probe first, applied only on the owner's word;
- income, expense and transfer edit everything; a repayment or an adjustment its note and date only;
- a new `EditTransactionPanel`, not `TransactionForm`;
- a stale edit is refused (`TRANSACTION_CHANGED`) and the page re-reads;
- 3 guest E2E tests;
- Dashboard Recent-activity rows open their row;
- audit 006 findings 1 and 2 fixed here;
- antislop mode 2 (audit 007).

Branch `phase-58b-edit`, PR #6. It also carried `280e70a`, the Phase 58s deploy record, which had not been pushed.
- Merged into `main` as `8725c11` with a merge commit, with the owner's go-ahead. Push run `36801738099` passed.
- Vercel `dpl_Fmv9YXiWKQ5YrFPkcJeTiLABfos1` serves a build that matches the local one byte for byte, apart from line endings. A signed-out smoke test on production passed: a new row opened the edit panel, and an amount edit saved (see the refactor log).

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T253 | `update_transaction` and its probe | `supabase/migrations/20260930_phase58b_update_transaction.sql`, `supabase/tests/20260930_phase58b.probe.sql` | High | High | 2h | done | - | dc166a0 | probe OK; it caught a real bug first (a signed adjustment's note edit refused); 3 negative controls diverged | - |
| T254 | Apply live | live DB | High | Med | 0.3h | done | T253, the owner | - (applied 2026-09-30) | md5 matches; 58b, 58s and 52 probes OK | - |
| T255 | `updateTransaction`, `walletEffects`, `editRuleError`; `TransactionEdit`; `useTransactions` | `FinanceContext.tsx`, `types.ts`, `hooks/useTransactions.ts` | High | High | 1.5h | done | T254 | c20b370 | see T256 | - |
| T256 | Signed-in stand-in and 10 tests; 9 guest tests | `unit/authenticated-ledger.test.tsx`, `unit/ledger-guards.test.tsx` | High | Low | 1.5h | done | T255 | c20b370 | 7 mutations caught | unit 443 -> 462 |
| T257 | `EditTransactionPanel`; `TransactionDetails` delegates for a live row | `transaction/EditTransactionPanel.tsx`, `transaction/TransactionDrawer.tsx` | High | Med | 2h | done | T255 | 235c1a0 | see T261 | - |
| T258 | `TransactionsView`: "Click any row to edit it", inline from `lg`, save wiring | `TransactionsView.tsx` | Med | Low | 0.3h | done | T257 | 235c1a0 | - | - |
| T259 | Dashboard hand-off | `App.tsx`, `DashboardView.tsx`, `RecentActivityCard.tsx`, `TransactionsView.tsx` | Med | Low | 0.5h | done | T258 | 235c1a0 | - | - |
| T260 | `ImportCsvModal`: `Tags`, no badge icons | `ImportCsvModal.tsx` | Low | Low | 0.1h | done | - | 235c1a0 | - | - |
| T261 | Page tests | `unit/transactions-page.test.tsx` | High | Low | 1h | done | T257-T259 | 235c1a0 | 4 mutations caught | unit 462 -> 470 |
| T262 | `tests/transaction-edit.spec.ts` | `tests/` | High | Low | 0.5h | done | T258 | c685a7a | a wallet-write control failed 2 of 3 | E2E 357 -> 366 runs |
| T263 | Gate: lint, unit, WCAG, build, Playwright twice, MCP | - | - | - | 1h | done | all | 336c0ca (MCP fix) | 366/366 twice; MCP clean but for audit 007 finding 1 | see metrics |
| T264 | ADR `0033`, `DESIGN.md`, `CLAUDE.md`, selector contract | docs | Low | Low | 1h | done | all | 5f19972 | - | - |
| T265 | Ledger, log, metrics, antislop audit 007 | docs | Low | Low | 0.5h | done | all | 5f19972 | - | - |
| T266 | sha backfill; PR on the owner's word | docs | Low | Low | 0.1h | done: backfill (d699ae6); PR #6 merged as 8725c11 on the owner's word, 2026-10-01 | T265 | d699ae6 | push run 36801738099 passed; production matches the local build | - |
| T267 | Audit 007 finding 2: a repayment's or adjustment's panel names its wallet, and a repayment its debt | `EditTransactionPanel.tsx`, `TransactionDrawer.tsx`, `TransactionsView.tsx`, `unit/transactions-page.test.tsx` | Low | Low | 0.2h | done | the owner | (this row's own commit) | a control that dropped the debt failed its test; 366/366 | unit 470 -> 471 |

**Notes on execution:**
- **The probe earned its keep on its first run.** The amount check also covered adjustments, whose amounts are signed since ADR `0024`, so a note edit of a downward adjustment was refused. The money checks now apply to income, expense and transfer only, and probe step 10 pins the case.
- **Two negative controls were wrong before they were right.**
  - Reading the ref after the optimistic write was proposed as the stale-version bug, but nothing awaits between the two, so it still held the old version. The real failure, sending the optimistic timestamp, failed 6 tests.
  - A test that read a transfer's To select passed with no wallet chosen, because an empty select displays its first option. The test now checks that Save is enabled, and the select shows "Choose a wallet" when nothing is chosen.
- **The unknown-outcome test first passed without the re-read**, because a later reload also showed the committed row. It now counts reads the moment the call returns.

## Phase 58s - Security: who may spend TypeSafe credits, and who may write `public.profiles`: T245-T252 (2026-09-30)

A security phase between 58a and 58b, from an outside review's two "critical" claims. ADR `0032`. Both claims were checked against the code, production and the live database first:
- the AI proxies were open to anyone (true);
- `public.profiles` had drifted (false: 0 mismatches). The review missed the real problem: a signed-in user could set their own `role` to `ADMIN`.

The owner's decisions:
- verify a token when one is sent and keep guests, limited per IP in the Vercel firewall (30 a minute without a header, 120 for everyone);
- remove client writes to `profiles` and sync it from `auth.users`, probe first, apply on the owner's word;
- the owner re-saves `TYPESAFE_API_KEY` as "sensitive" and reviews TypeSafe's spend caps.

Branch `phase-58s-security`, draft PR #5. It also carried `092e87c`, the Phase 58a deploy record, which had not been pushed.
- Merged into `main` as `acb969c` with the owner's go-ahead. Push run `36712827442` passed.
- Vercel `dpl_AD4WfDGUWor3G7fDCBjGyPEyTW8w` serves a build that matches the local one byte for byte. Live checks on production passed: a fake token gets 401, and a guest's invalid body gets 400 (see the refactor log).
- T246 stays open: the owner creates the firewall rules in the dashboard, then the burst test runs.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T245 | `profiles` migration and its probe | `supabase/migrations/20260930_phase58s_profiles_hardening.sql`, `supabase/tests/20260930_phase58s.probe.sql` | High | Med | 1h | done | - | ca5d465 | probe OK in `BEGIN … ROLLBACK`; two negative controls failed as designed | - |
| T246 | Vercel firewall rules | - | High | Low | 0.3h | **blocked** | the owner | - | the API answers `404 Seawall Config not found` to every create; the project has no firewall configuration yet | - |
| T247 | Apply the migration live | live DB | High | Med | 0.3h | done | T245 | - (applied 2026-09-30) | body md5 matches the file; Phase 58s and Phase 52 probes OK after | - |
| T248 | `checkCaller` in both proxies | `api/classify.ts`, `api/insights.ts` | High | Med | 1h | done | - | 6a8e790 | 2 mutations caught (13 and 4 failures) | - |
| T249 | `authorizationHeader()`; the clients send it; a 401 is `unavailable` without latching | `src/lib/supabase.ts`, `src/utils/jevClassifier.ts`, `src/utils/insightsClient.ts` | High | Low | 0.5h | done | T248 | 6a8e790 | 3 mutations caught | - |
| T250 | Tests: `proxy-contract` caller-check block; `proxy-auth-client` (new) | `unit/` | High | Low | 1h | done | T248, T249 | 6a8e790 | 5 mutations caught in all | unit 396 -> 443 |
| T251 | ADR `0032`, `CLAUDE.md`, ledger, log, metrics | docs | Low | Low | 0.5h | done | all | 7561cf1 | - | - |
| T252 | sha backfill; draft PR | docs | Low | Low | 0.1h | done | T251 | (this row's own commit) | - | - |

**Notes on execution:**
- **The firewall rules are not in place.** Every attempt through the Vercel API (`PUT` and `PATCH`, by project id and by name) answered `404 Seawall Config not found`. The API does not create a first configuration, and there is no CLI or token on this machine. **Until the owner creates the two rules, guests are exactly as unlimited as before**; the token check does nothing against a caller who sends no header.
- **The negative control on the live schema showed the hole.** Without the migration, a signed-in probe user's `update profiles set role = 'ADMIN'` succeeded (then rolled back).
- **`.env` changes what a unit test sees.** `isSupabaseConfigured` is read when `src/lib/supabase` loads, and a local `.env` sets it while CI has none. `proxy-auth-client` stubs the environment and re-imports the modules for each test.
- **The check lives twice, in both proxies,** rather than in a shared `api/_auth.ts`: it would have been the first runtime import between Vercel functions in an ESM package, which nothing local can prove resolves.

## Phase 58a - FinLife redesign, step 4, second page (Transactions): T234-T244 (2026-09-30)

Spec 6.2, the page. ADR `0031`. The plan was approved; the owner's decisions:
- split editing into Phase 58b (a new `update_transaction` RPC);
- 58b edits money fields on income, expense and transfer only, through a new `EditTransactionPanel`;
- antislop in mode 2 (audit 006).

Branch `phase-58a-transactions`, draft PR #4. It also carried `01e6c16`, the Phase 57 deploy record, which had not been pushed.
- Merged into `main` as `f3a5819` with the owner's go-ahead. Push run `36707649627` passed.
- Vercel `dpl_BE1rwtXSVF2j5N3eYTeWBLmFCi5P` serves a build that matches the local one byte for byte (see the refactor log).
- Audit 006 findings 1 and 2 move to Phase 58b.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T234 | `secondaryLine` keeps a transfer's note; `TransactionRow.dateText` (`sr-only`); `TxTypeIcon` as a `<span>`; `OverflowMenu` text trigger; `Button` ref; `useMediaQuery` | `selectors/display.ts`, `transaction/*`, `ui/*`, `hooks/useMediaQuery.ts`, 3 unit files | Med | Low | 1h | done | - | 449ffe0 | note and date tests red first | unit 385 -> 390 |
| T235 | `ImportCsvModal`: the CSV import moved out of the view | `transaction/ImportCsvModal.tsx` | Med | Med | 0.5h | done | - | 261448d | a whitespace-insensitive diff shows only the wrapper and the open and close props | view 901 -> 470 lines |
| T236 | `PageHeader`, the "Import / export" menu, "Add transaction"; Export Diary removed; `csv` and `csv-classify` gain the menu step | `TransactionsView.tsx`, 2 specs | Med | Low | 0.5h | done | T234 | 261448d | - | - |
| T237 | Filter row: search, range (new), wallet, category (new), type control, Show deleted | `TransactionsView.tsx` | Med | Low | 0.5h | done | - | 261448d | every filter narrows the list (MCP) | - |
| T238 | List card: summary line, day groups with L11 nets over all filtered rows, `TransactionRow` buttons, "Load 25 more" (L12); `TransactionTableRow` and `TxCategoryChip` deleted; 17 row locators moved | `TransactionsView.tsx`, 5 specs | High | Med | 1h | done | T234 | 261448d, 3b639ca | Out equals the 28 seeded expenses, deleted row excluded (MCP) | - |
| T239 | `TransactionDetails` panel: inline at `xl`, a `Modal` below, Delete or Restore with surfaced errors, focus in and back; `soft-delete` clicks the row first | `transaction/TransactionDrawer.tsx`, `TransactionsView.tsx`, `soft-delete.spec.ts` | High | Med | 1h | done | T238 | 261448d | delete, Show deleted, restore and Escape all work at 1280, 900 and 390px (MCP) | - |
| T240 | `unit/transactions-page.test.tsx`: the page in the real guest provider | `unit/` | High | Low | 1h | done | T239 | 5aa6f48 | 3 mutations caught | unit 390 -> 396 |
| T241 | Gate: lint, unit, build, WCAG, Playwright, MCP | - | - | - | 1h | done | all | 3b639ca (MCP fixes) | see notes | see metrics |
| T242 | ADR `0031`, `DESIGN.md`, `CLAUDE.md`, selector contract | docs | Low | Low | 1h | done | all | fbc389e | - | - |
| T243 | Ledger, log, metrics, antislop audit 006 | docs | Low | Low | 0.5h | done | all | fbc389e, e65ccf5 (audit) | - | - |
| T244 | sha backfill; draft PR | docs | Low | Low | 0.1h | done | T243 | (this row's own commit) | - | - |

**Notes on execution:**
- **Found in the MCP pass (`3b639ca`):**
  - The list card's `overflow-hidden` clipped every row's focus ring. The list is now inset 8px.
  - The type control's "All" was 43px wide. `SegmentedControl` options now keep a 44px minimum width.
  - The phone filter row wrapped unevenly.
- **A full-page screenshot showed a second panel** fading in over the page. The DOM had one; Chromium's full-page capture briefly reports a narrower viewport, which flips `useMediaQuery`. Plain screenshots were correct.
- **Local E2E (4 workers), runs 1 and 2: 356/357 each.** Both failures were the same Firefox test, `account-and-mobile-nav.spec.ts:60`: the Quick Add dialog never appeared after the centre button was tapped.
  - **Control:** that test 20 times on the branch and 20 on `main`: 20/20 on both.
  - It fails only under full-suite load. It is the same Quick Add symptom audit 005 recorded on `main`, so it stays audit finding 3, on watch.
- **Two untracked reports** appeared in the repo root during the phase, `AGY_AUDIT300926.md` and `SUGGESTS.md`, from another assistant. They were left untouched and out of every commit.

## Phase 57 - FinLife redesign, step 4, first page (the Dashboard): T222-T233 (2026-09-28)

Spec 6.1 and section 9 step 4. ADR `0030`. The plan was approved in plan mode. The owner's decisions:
- the insights card stays, titled with its own months;
- `main` takes the spec's padding but keeps `max-w-7xl` for now;
- `theme.spec.ts:58` moves its locator to `net-worth-card`;
- antislop in mode 2 (audit 005).

Branch `phase-57-dashboard`, draft PR #3. It also carried `2739e4e`, the Phase 56 deploy record, which had not been pushed.
- After review, audit 005 finding 1 was fixed in `a6d7241`.
- Merged into `main` as `dd057b7` with the owner's go-ahead. Push run `36435411711` passed.
- Vercel `dpl_DRE4k97Gb3Uu9rkedLpD7CmTQxAU` serves a build that matches the local one byte for byte (see the refactor log).

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T222 | Selectors `cashFlow`, `walletShares`, `moodSpendingDays`; date helpers `formatLongDate`, `formatShortDate`, `formatWeekdayDate`, `formatMonthName`, `greetingFor` | `selectors/ledger.ts`, `selectors/wallets.ts`, `selectors/diary.ts` (new), `utils/date.ts`, `unit/selectors-dashboard.test.ts` | High | Low | 1h | done | - | 5e40415 | red against the missing modules first; 2 mutations caught | unit 353 -> 368 |
| T223 | `@utility transition-control` replaces `transition-colors` everywhere (audit 004 finding 2); `main` padding 16px, then 32/40/48 from `md` | `index.css`, `App.tsx`, 22 components | Med | Low | 0.5h | done | - | dfb9174 | outline `rgb(124, 58, 237)` on the first read after focus (MCP) | - |
| T224 | `PageHeader` (greeting, long date, period control) and the 12-column grid | `DashboardView.tsx` | High | Med | 0.5h | done | T222 | e43ea5d | `#time-filter-*` unchanged | - |
| T225 | `NetWorthCard` (L3) and `CashFlowCard`; `metric-card-expense` moves; `TotalWealthHero` and `CashflowMetricsCards` deleted; `theme.spec.ts:58` locator move | `dashboard/*`, `tests/theme.spec.ts` | High | Med | 1h | done | T222 | e43ea5d, 873d714 | Spending equals the category total in all four periods (MCP) | - |
| T226 | `DebtWarningBanner` (L5) and `DebtPayoffCard` (L4, per debt); `DebtPayoffOverview` deleted | `dashboard/*` | High | Low | 1h | done | T222 | e43ea5d | Car loan ฿42,000 due Feb 1, 2027: ฿10,500.00 / month, banner shown | - |
| T227 | Wallets section: links keep the hero ids, `AllocationBar`, one button row per wallet; `WalletAccountsGrid` deleted | `dashboard/WalletsSection.tsx` | High | Med | 1h | done | T222 | e43ea5d, 20558ac | `#dashboard-wallet-card-*` now a `<button>` | - |
| T228 | `CategorySpendingCard`; `CategoryExpenseDistribution` deleted | `dashboard/*` | Med | Low | 0.5h | done | - | e43ea5d | - | - |
| T229 | `RecentActivityCard`: `TransactionRow`, `DayGroupHeader`, the L8 fold that expands; `RecentTransactionsTable` deleted | `dashboard/*` | High | Med | 1h | done | - | e43ea5d | each description once (strict `getByText` specs pass) | - |
| T230 | `MoodSpendingCard`: five-bar meter, signed spending, the "Log today" button | `dashboard/*` | Med | Low | 0.5h | done | T222 | e43ea5d | - | - |
| T231 | `SpendingInsightsCard` restyled, titled "Spending insights · September vs August" | `dashboard/SpendingInsightsCard.tsx` | Low | Low | 0.25h | done | - | e43ea5d | `insights.spec.ts` unedited, 10/10 per browser | - |
| T232 | `unit/dashboard.test.tsx`: spec 10's checks per card | `unit/dashboard.test.tsx` | High | Low | 1h | done | T224-T231 | 20558ac, 873d714 | 4 mutations caught; found the click event reaching `onTransfer` | unit 368 -> 385 |
| T233 | ADR `0030`, `DESIGN.md`, `CLAUDE.md`, selector contract, ledger, log, metrics, antislop audit 005, sha backfill | docs | Low | Low | 1.5h | done | all | f4fb38c, 5efc483 (audit), backfill (this row's own commit) | - | - |

**Notes on execution:**
- **Found by the unit tests: the Wallets section passed the click event to `onTransfer`.** `DashboardView` wraps it, so nothing broke. Wired straight to `onOpenTransfer(walletId?)`, though, the event would have been read as a wallet id. The links now call their handlers with no argument.
- **Found in the MCP pass:**
  - At 390px a wallet row's share and the insights title were truncated. Both now wrap.
  - A negative net worth was drawn in `fg`, not red. Spec section 3 treats it as a net figure (`873d714`).
- **Six stale dev servers** from earlier runs were still listening on ports 3000 to 3005. The oldest was a day old, and Playwright reuses whatever answers on 3000. All six were stopped before the full runs, so each run started a fresh server.
- **Local E2E (4 workers):**
  - Run 1: 353/357. Two Firefox failures (a `goto` timeout, and a protocol error closing a context) and two WebKit ones (clicks waiting for "stable"). The four tests passed 40/40 in repeats.
  - Run 2: 356/357. WebKit `#tx-import-csv-btn` was not stable.
  - Run 3, after the net worth fix: 356/357. The same WebKit button again.
  - **Control:** `csv-classify.spec.ts` on WebKit, 10 repeats: branch 79/80, `main` 80/80. The two failing tests then ran 30 more times each on the branch: 60/60.
  - So the rate cannot be told apart from audit 004 finding 3. The pattern is audit 005 finding 3, and CI is the cross-check.

## Phase 56 - FinLife redesign, step 3 (shared components): T212-T221 (2026-09-28)

Spec section 4, the fourteen shared components. ADR `0029`. The plan was approved in plan mode. The owner's decisions:
- build and unit-test all fourteen, but adopt only the drop-ins now;
- one global `:focus-visible` rule;
- 44px everywhere, including where the spec draws 40px.

Branch `phase-56-components`, draft PR #2. Merged into `main` as `a86e5d0` with the owner's go-ahead. Push run `36405543706` passed, and Vercel `dpl_CGrLhV7LsZafrX4M5FweApxDY25T` serves a build that matches the local one byte for byte (see the refactor log).

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T212 | Tokens `chip-text`, `danger-line`; global `:focus-visible` outline; WCAG pairs for focus (header, surface-3), chip text, expense on menu surfaces | `src/index.css`, `scripts/wcag-tokens.mjs` | High | Low | 0.5h | done | - | 1cc6e12 | all pairs pass; lowest focus pair 3.89:1 (dark menu) | CSS +1,848 B (whole phase) |
| T213 | `Button` (4 variants, 3 sizes, `buttonClass`) and `IconButton` (required `label`) | `ui/Button.tsx`, `ui/IconButton.tsx`, `unit/ui-controls.test.tsx` | High | Low | 1h | done | - | 1cc6e12 | default type and title caught by mutation; `@ts-expect-error` pins the required label | - |
| T214 | Adopt `Button` at about 40 sites; delete `formStyles`' three button strings | header, account, auth, dashboard, debts, diary, wallets, transactions, categories, wallet forms, `ConfirmDialog`, `ReloadPrompt` | High | Med | 2h | done | T213 | 1cc6e12 | 357 unedited | - |
| T215 | Adopt `IconButton` at the icon-only buttons; `AuthModal`'s close gains a name; Clear search and the diary delete reach 44px | same, plus `Modal`, `TransactionTableRow`, `SpendingInsightsCard`, `WalletPopupModal` | High | Med | 1h | done | T213 | 1cc6e12 | 0 controls under 44px on 6 views at 1280 and 4 at 390 | - |
| T216 | `SegmentedControl`: card tray, `control-active`, `aria-pressed`, `mode="tabs"` for Categories | `ui/SegmentedControl.tsx` + 4 callers | Med | Low | 0.5h | done | - | 1cc6e12 | 2 tests red against the old component first | - |
| T217 | `Card` (radius 16, padding 24/28) and `Inset`; `Chip` replaces `CategoryChip`/`categoryTint`; grey system chip for repayments (audit 003 #3); `Badge` loses amber; recent table drops per-row "THB"; `TxTypeIcon` size `lg` | `ui/Card.tsx`, `ui/Chip.tsx`, `ui/Badge.tsx`, `TxCells.tsx`, `TransactionTableRow.tsx`, `RecentTransactionsTable.tsx`, `CategoriesView.tsx`, `selectors/ledger.ts` | Med | Low | 1h | done | T212 | 1cc6e12 | chip text 10.09:1 / 9.45:1 | - |
| T218 | `ProgressBar` replaces `ProgressMeter` at 5 sites (`line` track, `role="progressbar"`, 200ms) | `ui/ProgressBar.tsx` + callers | Med | Low | 0.5h | done | - | 1cc6e12 | `toFixed(1)` labels untouched | - |
| T219 | Build-only: `PageHeader`, `TransactionRow`, `DayGroupHeader` (+ `formatDayLabel`), `AllocationBar`, `WarningBanner`, `OverflowMenu` | `ui/*`, `transaction/*`, `utils/date.ts`, `unit/ui-display.test.tsx`, `unit/tx-row.test.tsx` | High | Low | 2.5h | done | T213, T217 | 1cc6e12 | 3 files red against the missing modules first; 0 B in the bundle until adopted | unit 304 -> 353 |
| T220 | ADR `0029`, `DESIGN.md` components and deviations, `CLAUDE.md`, selector contract (+ stale line refs), ledger, log, metrics; antislop audit 004 | docs | Low | Low | 1.5h | done | all | acf0b2f, 5ca1e8b (audit) | - | - |
| T221 | sha backfill | docs | Low | Low | 0.1h | done | T220 | (this row's own commit) | - | - |

**Notes on execution:**
- **A clipped focus ring, found by the MCP pass and fixed (`726269b`).** The header nav is `overflow-x-auto`, which clipped the new outline on three sides of every tab. The nav gained `p-1`, which is the outline's 2px offset plus its 2px width. An audit script then checked every control on all six views for an ancestor that would clip a 4px ring: none at 1280px. At 390px the only hit was the transactions table, which is 16px wider than its scroller. That predates this phase, and focusing the button scrolls it into view.
- **The outline fades in from the text colour.** Tailwind's `transition-colors` includes `outline-color`, so for 150ms the outline starts in `currentColor`. It settles on `--focus`, measured after 400ms. Recorded, not changed (audit 004).
- **Intermittent local E2E failures, again all "waiting for stable" or "performing click action" timeouts.**
  - Run 1 was 356/357: WebKit `#nav-tab-diary`. 30 repeats passed.
  - Run 2 was 355/357: Firefox `#account-signin-btn` and a Firefox `goto` load.
  - Targeted repeats hit 2 more in `account-and-mobile-nav` on Firefox, on the untouched mobile nav.
  - **Control run:** the same spec 10x on `main` gave 120/120, and on the branch 120/120.
  - Run 3 and run 4 were 357/357.
  - These are the pattern of audit 003 finding 5, not a regression that reproduces. They stay on watch.
- **Deliberately not adopted:** the in-chip dismiss crosses, the note microphone, the calculator keys, the pickers, text links, the mobile Quick Add and the transfer swap. `DESIGN.md` lists why.

## Phase 55 - FinLife redesign, steps 1 and 2 (Foundation, Logic), plus CI speed: T199-T211 (2026-09-28)

The owner wrote `docs/design/finlife-redesign-spec.md`. This phase covers its section 9 steps 1 and 2, plus a CI speed-up requested in the same plan. Phase 54 stays reserved for audit 001 finding 6. The plan was approved in plan mode.

The owner's four decisions:
- the light theme stays;
- IBM Plex Sans Thai is self-hosted and `font-mono` goes, with the one class-based locator moved;
- an adjustment is grey, as the spec says (reversing Phase 53b);
- all L1 to L13 selectors are built, and only L1 to L5 are wired now.

ADRs `0027` (foundation) and `0028` (selectors). Work ran on branch `phase-55-ci` with draft PR #1, so CI could be measured without touching `main`.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T199 | CI: a `checks` job gates one E2E job per browser (matrix, `fail-fast: false`), each installing only its browser | `.github/workflows/playwright.yml` | High | Low | 0.5h | done | - | 1cb9a18 | run `36373804867` green | job wall time 13 m 47 s -> 5 m 18 s |
| T200 | CI: browser cache keyed by lockfile; a hit runs `install-deps` only | same | Med | Low | 0.25h | done | T199 | 1cb9a18 | cache hit on run `36374212154` | browser step 53 s -> 12-35 s |
| T201 | CI: `concurrency` cancel-in-progress; `paths-ignore` for docs-only pushes and PRs | same | Med | Low | 0.25h | done | T199 | 1cb9a18 | cancel-in-progress seen on the branch; docs-only push `79ed8de` to `main` created no run (see notes) | - |
| T202 | CI: `workers: 2` per browser job, on trial | `playwright.config.ts` | Med | Med | 0.25h | done (kept) | T199 | b33e18c | 3 consecutive green attempts of run `36374212154`, 0 flaky, 0 retries | 4 m 31 s-4 m 48 s per run |
| T203 | Tokens: spec dark values under the app's names, new roles, solid hue tints, derived light set; the spec's input border not used (1.26:1) | `src/index.css`, `scripts/wcag-tokens.mjs` | High | Med | 1.5h | done | - | 97d2b4e | all WCAG pairs pass, both themes | CSS 43,802 -> 46,984 B |
| T204 | IBM Plex Sans Thai (400-700, thai + latin, self-hosted, precached); `tabular-nums` on body; every `font-mono` on an amount removed | `package.json`, `src/index.css`, 21 components/views | High | Med | 1h | done | T203 | 97d2b4e | ฿ served by the font's thai subset | fonts 40,404 -> 120,532 B; precache 45 -> 53 entries |
| T205 | Amounts: `formatCurrencyAmount` puts U+2212 before ฿; transfer unsigned except in one wallet's view (`direction`); adjustment and repayment grey | `currency.ts`, `txTypeMeta.ts`, `TxCells.tsx`, `Money.tsx`, `WalletPopupModal.tsx`, `unit/tx-cells.test.tsx` | High | Med | 1h | done | - | 97d2b4e | tx-cells 251 -> 257 | - |
| T206 | Header: one 64 px row, tabs left, no total balance; bottom nav under `md` | `Navbar.tsx`, `NavbarLedgerStatus.tsx`, `MobileBottomNav.tsx`, `App.tsx` | High | Med | 1h | done | - | 97d2b4e | MCP 1280/900/390, light and dark: one row, 0 controls under 44 px, no overflow | - |
| T207 | `wallet-balance-<id>` testid; `soft-delete.spec.ts:108` locator moved, assertions unchanged | `WalletsView.tsx`, `tests/soft-delete.spec.ts` | Med | Low | 0.25h | done | T204 | 97d2b4e | the only spec edit in Phase 55 | - |
| T208 | ADR `0027`, `DESIGN.md` rewrite, selector contract, `CLAUDE.md` | docs | Low | Low | 1h | done | all 55a | 8a0c0ad | - | - |
| T209 | `src/selectors/` (8 modules) and `shiftIsoDate`; three unit files written first and red against the missing modules | `src/selectors/*`, `src/utils/date.ts`, `unit/selectors-*.test.ts` | High | Low | 2h | done | - | bcb1987 | 47 new tests; the spec's L4 figures reproduce to the cent | unit 257 -> 304 |
| T210 | Wire L1 to L5: dashboard range and totals, category chart by id, insights spending, diary outflow, one active-wallet predicate | `DashboardView.tsx`, `CategoryExpenseDistribution.tsx`, `spendingSummary.ts`, `DiaryView.tsx`, `FinanceContext.tsx`, `useWallets.ts`, `unit/spending-summary.test.ts` | High | Med | 1h | done | T209 | bcb1987 | two spending-summary tests red against the old code first; MCP with a seeded ledger: Expense card = chart total = ฿150.25 in all four ranges, the ฿300 repayment, ฿500 transfer and −฿40 adjustment excluded; diary outflow ฿150.25 | - |
| T211 | ADR `0028`, `CLAUDE.md`, refactor log, metrics, sha backfill | docs | Low | Low | 1h | done | all | 8a0c0ad (sha backfill: this row's own commit) | - | - |

**Notes on execution:**
- **Local run 1 of 55a had two timeouts in 357 runs**:
  - Firefox, clicking the More button at 390 px;
  - WebKit, waiting for `#tx-import-csv-btn` to be stable.
  Neither reproduced in a second full run (357/357), in 3 repeats of both spec files on all browsers (180 runs, 1 more Firefox More-sheet timeout) or in 4 repeats on Firefox (48/48). They are recorded as intermittent and watched, not closed. CI ran all three engines green four times with no retry.
- **`pending` was not renamed `warning`**: about 40 call sites for a word. The mapping is documented in `src/index.css` and ADR `0027`.
- **The debt repayment's colour is a decision.** The spec names none. It is grey, because L1 says it is not spending and amber is reserved for real problems. ADR `0027`.
- **`TransactionTableRow`'s repayment badge is still amber.** It belongs to the TransactionRow component, spec step 3.
- **The docs-only skip could not be tested on the branch.** A pull request's `paths-ignore` looks at the whole PR diff, which touches `src/`, so every PR run ran. The merge push to `main` touched `src/` too.
- **Verified on `main`:** `79ed8de` (only `docs/audit/*.md`) was pushed with the user's go-ahead. Two minutes later `actions/runs?head_sha=` returned `total_count: 0` and the commit had no check runs. T201 is closed.
- **Deployed.** PR #1 merged as `41c5216` (a merge commit, so these shas stay valid). CI and the byte-for-byte production check are in the refactor log.
- **Audit 003's findings are open by decision.** 1 to 3 go to the shared components and page phases, 4 to the shared components pass, and 5 is watched without gating.

## Phase 53b - Antislop audit 001 remediation: static money, state-only motion, a sync status that can fail: T188-T198 (2026-09-28)

Second half of Phase 53. The owner's decisions on 53a's open questions:
- **Adjustments** keep ADR `0024`'s direction (emerald `+` up, rose `−` down), and cyan is for transfers only.
- **The overdraft warning** stays amber.
- **`WalletTransferForm`'s two selects** join T195.

ADR `0026` (supersedes `0009`, amends `0025`).

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T188 | JetBrains Mono, self-hosted, latin file only; `woff2` precached | `package.json`, `src/index.css`, `vite.config.ts` | Med | Low | 0.5h | done | - | f422692 | build emits one 40,404 B `woff2` | precache 44 -> 45 entries |
| T189 | `ui/Money` replaces `AnimatedCounter` at 6 sites; `TX_TYPE_META.text` drives every amount colour; adjustments by direction | `ui/Money.tsx` (new), `AnimatedCounter.tsx` (deleted), dashboard cards, `WalletsView`, `NavbarLedgerStatus`, `txTypeMeta.ts`, `TxCells.tsx`, `RecentTransactionsTable`, `WalletPopupModal`, `currency.ts`, `DESIGN.md` | High | Med | 1.5h | done | - | f422692 | tx-cells +3 tests | - |
| T190 | Hero: orbs, pulsing dot, blur, count-up gone; "{n} wallets"; one-line description | `TotalWealthHero.tsx` | Med | Low | 0.5h | done | T189 | f422692 | - | - |
| T191 | Blur only on the mobile nav and a sticky `<thead>`; solid scrim; 39 hover/tap scales removed; 200 ms tweens; the dashboard's staggered entrance removed | `Modal.tsx`, `App.tsx`, `DashboardView.tsx`, `SegmentedControl.tsx`, `MobileBottomNav.tsx`, `WalletPopupModal.tsx`, 10 more | Med | Med | 1.5h | done | - | f422692 | - | - |
| T192 | Per-view static skeleton; insights skeleton static | `ViewLoadingFallback.tsx`, `App.tsx`, `SpendingInsightsCard.tsx`, `TransactionsView.tsx` | Med | Low | 0.5h | done | - | f422692 | `#view-loading-fallback` kept | - |
| T193 | `syncError` on the state context: set on a failed read or a throw (epoch-checked), cleared on a clean load and on reset | `FinanceContext.tsx`, `unit/authenticated-ledger.test.tsx` | High | Med | 1h | done | - | f422692 | 5 new tests, all 5 red against the old code first | - |
| T194 | Five-state navbar badge; Sync failed retries via `refreshFromCloud`; 44 px hit boxes | `navbar/NavbarLedgerStatus.tsx` | High | Low | 1h | done | T193 | f422692 | - | - |
| T195 | Focus rings on the three unindicated `<select>`s; WCAG re-run | `WalletPopupModal.tsx`, `wallet/WalletTransferForm.tsx` | High | Low | 0.5h | done | - | f422692 | all token pairs pass | - |
| T196 | 44 px targets: every control in audit 001's table, plus the shared button classes, `SegmentedControl`, swatches, icon pickers, wallet-popup controls | `formStyles.ts` (buttons and `FIELD_BASE`), 15 components/views | High | Med | 2h | done | - | f422692 | MCP at 390 px, all six views: 0 controls under 44 px (15 before the last round, none in 001's table), 0 unnamed buttons, no overflow | - |
| T197 | Copy: taglines, "Daily Diary", developer language, em dashes; sentence-case form labels | 13 files including `spendingSummary.ts`, `index.html`, `vite.config.ts`, `tests/diary.spec.ts:15`, `tests/theme.spec.ts:55` | Med | Low | 1h | done | - | f422692 | the two approved spec regexes only | - |
| T198 | ADR `0026`, ADR `0025` note, selector contract, `CLAUDE.md`, refactor log, metrics, audit 002 | docs | Low | Low | 1h | done | all | afd5de4 | - | - |

**Notes on execution:**
- **Scope grew in two places, both inside DESIGN.md's own rules.**
  - The dashboard's staggered spring entrance was not on the plan's list, but it is "motion on its own", which MOTION 1 forbids.
  - Controls beside the audited ones (swatches, `WalletPopupModal`'s icon buttons, the shared button classes) got 44 px hit boxes in the same pass. A per-control plan would have left the same finding one row away.
- **Accessible names added where the change exposed none:**
  - `#close-wallet-modal-btn` ("Close wallet details", deliberately not "Close modal": `categories.spec.ts` queries that name by role);
  - `WalletPopupModal`'s adjust and delete buttons;
  - the colour swatches and the icon picker;
  - the activity `<select>`.
- **Phase gate:**
  - lint clean;
  - unit **251/251**;
  - Playwright **357/357** (4.9 m, no retries), run three times as `src/` changed, each run green;
  - `node scripts/wcag-tokens.mjs`: all pairs pass;
  - ฿ and JetBrains Mono confirmed in Chromium, Firefox and WebKit;
  - audit 002 records every finding and the Delivery Gate.
- **Left, and recorded in ADR `0026`:**
  - finding 6 (starter money);
  - the 32 px microphone button inside the note field;
  - the transfer panel's negative projection rendering `฿-1,000.00`.

## Phase 53a - Semantic design tokens: the stone palette is retired: T182-T187 (2026-09-27)

First half of Phase 53 ("UI / Design System Retheme & Anti-slop Remediation"), planned after a grill session and approved by the user. 53a moves every colour onto DESIGN.md's tokens; 53b (T188-T198) does the antislop audit 001 remediation on top. ADR `0025`.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T182 | Baseline (lint, unit, 357 E2E, per-chunk sizes); commit the audit report and the antislop pointer | `docs/audit/baseline-metrics.md`, `anti-slop/audit-001-2026-09-27.md`, `CLAUDE.md` | Low | Low | 0.5h | done | - | a19b8ac | 357/357 (7.9 m), unit 243/243 | reproduces T181's figures exactly |
| T183 | DESIGN.md adjusted and committed; token contrast checker | `DESIGN.md`, `scripts/wcag-tokens.mjs` (new) | Med | Low | 1h | done | - | b08b0ef | - | - |
| T184 | Theme-flipping tokens, static fills/tints/lines, shadows, font stacks | `src/index.css` | High | Med | 1h | done | T183 | 438e126 | all token pairs pass | - |
| T185 | Form styles, UI primitives, transaction tokens, Modal | `src/utils/formStyles.ts`, `src/components/ui/*`, `transaction/txTypeMeta.ts`, `transaction/TxCells.tsx`, `Modal.tsx` | High | Med | 1h | done | T184 | 438e126 | see phase gate | - |
| T186 | Shell | `App.tsx`, `Navbar.tsx`, `MobileBottomNav.tsx`, `AuthModal.tsx`, `ReloadPrompt.tsx`, `QuickAddModal.tsx`, `navbar/NavbarLedgerStatus.tsx`, `ViewLoadingFallback.tsx`, `index.html`, `vite.config.ts` | High | Med | 1h | done | T184 | 438e126 | see phase gate | - |
| T187 | Views and components (24 files, three parallel agents on one mapping guide) | `src/views/*`, `src/components/**` | High | Med | 3h | done | T185 | 438e126 | lint clean; unit 243/243; Playwright **357/357** (6.5 m); attribute/text diff clean; MCP visual pass clean | CSS 78,908 -> 45,533 B; all JS 1,365,069 -> 1,341,862 B |

**Notes on execution:**
- **Two DESIGN.md values changed during the phase, both recorded there:** light `pending` / `transfer` text one shade darker (they failed on their own tint), and a Surface 3 that reuses the Border default hex.
- **Deliberately left for 53b:** blur, motion, the hero's orbs and pulsing dot, `AnimatedCounter`, skeletons, the sync badge's states, touch targets, copy. They were recoloured only.
- **Found for 53b:** `WalletTransferForm`'s two wallet `<select>`s have `focus:ring-0` and no indicator, like `WalletPopupModal`'s; added to T195.
- **Open question for the user:** DESIGN.md renders adjustments in cyan with no sign; ADR `0024` and `unit/tx-cells.test.tsx` give them a direction (income tint when upward). `txTypeMeta` keeps ADR `0024`.

## Phase 52 follow-up - a device signed out elsewhere evicts itself: T181 (2026-09-27)

Reported by the user from a desktop + phone test: "Sign out other devices" left the phone signed in and working. Diagnosed before any edit - the auth log showed the server revoking correctly; the gap was an access token that stays valid for up to an hour with nothing on the client asking. ADR `0024` amended rather than a new ADR: it is that ADR's sessions decision, finished. No migration.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T181 | `verifySession` (`auth.getUser()`) on every reconnection trigger, `focus`, mount, a 60 s visible tick and any Data API 401; `onDataApiUnauthorized` fetch wrapper; rejection signs out locally, no answer keeps the session; confirmation copy; ADR `0024` amendment; `CLAUDE.md` | `src/context/FinanceContext.tsx`, `src/lib/supabase.ts`, `src/components/account/AccountModal.tsx`, `unit/authenticated-ledger.test.tsx`, `unit/supabase-client.test.ts` (new), ADR `0024`, `CLAUDE.md` | High | Med | 2h | done | - | ab7f706 | lint clean; unit **243/243** (harness 3 runs, stable); Playwright **357/357**, 7.6 m, no spec edited; 13 of 14 new harness tests red first | entry +1,346 B / +468 B gzip |

**Notes on execution:**
- **Diagnosis first.** auth-js 2.116 source: `getUser()` hits `/user`, GoTrue answers `session_not_found` for a revoked session, and the library then drops the session and emits `SIGNED_OUT` itself. `signOut({scope:'local'})` tolerates a 401/403/404 from `/logout`. The auth log: `/logout` 204, then a refresh with the revoked token refused (`Refresh Token Not Found`) 25 s later; refreshes ~59 minutes apart put the token lifetime at an hour.
- **Deviation from the request, on purpose:** a Data API 401 triggers a session check, not an immediate sign-out - a token can expire in transit, and signing out then would wipe the device's ledger on a race. The check signs out in one round trip when the session really is gone. Pinned both ways.
- **One addition beyond the named triggers:** a 60 s tick while visible, because a phone left open on the desk fires no wake event, which is the reported scenario. Plus a check on mount, for a PWA reopened after revocation.
- **Controls:** 12, each failing only its own test(s). The first pass found the epoch check unpinned (removing it failed nothing); an assertion that supabase-js's own sign-out is not repeated now pins it. The first "burst" test passed without the throttle - three events in one tick are deduped by the in-flight check alone - so it was rewritten to space the events.
- **Not exercised against a real second device.** The desktop/phone re-test on the deployed build remains.

**CI and deploy:** run `36320070129` on `ab7f706` - success in 20 m 14 s; the Vitest step ran **243 tests in 12 files** ahead of the browser install, Playwright **357 passed** (18.5 m at `workers: 1`). Vercel `dpl_4uKYB6F5AET1xEpB58Fcx8TdVwyU` Production `READY` before CI finished; `income-and-expence-neon.vercel.app` serves `index-CHvoGxc3.js` at **177,660 B** - byte-for-byte the local build - containing the `/rest/v1/` 401 filter, the refresh-token codes and the 60 s tick. Pushed with the user's explicit go-ahead. **Not yet verified:** the desktop + phone re-test on the deployed build, which the user is running.

## Phase 52 - Security hardening, real sessions, mobile ergonomics, and ledger completeness (F5, F7, F8): T166-T180 (2026-09-28)

Planned in plan mode and approved by the user before any code was written; four decisions were the user's (signed ADJUSTMENT with the 3 bad production rows reported not repaired; warn-and-export at sign-in, never merge; templates cleared on sign-out; lazy `supabase-js` deferred to Phase 53). Per `README.md:28`, ADR `0024` was written before any code and committed alone.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T166 | ADR `0024` - the four findings, every decision, the 3-row repair query, sessions design, migration strategy | `docs/audit/decisions/0024-security-sessions-ledger-completeness.md` (new) | Med | Low | 1.5h | done | - | 72da04c | docs only; committed alone | - |
| T167 | Migration: `handle_new_user` hardening, `wallets.idempotency_key`, `create_wallet`, `list_my_sessions`, re-created `record_transaction`/`import_transactions`; probe | `supabase/migrations/20260928_phase52_security_ledger.sql` (new), `supabase/tests/20260928_phase52.probe.sql` (new) | **Critical** | High | 3h | done | T166 | e7e94dc | deployed bodies md5-checked first; diffs only the marked changes; probe **OK** pre-apply, nothing leaked | - |
| T168 | Harness: `signOut({scope})` recorded; stand-ins for signed ADJUSTMENT, `create_wallet`, import `debt_id` + aggregate guard, `list_my_sessions` | `unit/authenticated-ledger.test.tsx` | Med | Low | 1h | done | T166 | 68679d2 | 157/157, the 31 existing harness tests unedited | - |
| T169 | Signed ADJUSTMENT: Zod, CSV, the balance editor's signed diff, `txTypeMetaFor` + `Math.abs` display | `src/utils/zodSchemas.ts`, `csvExchange.ts`, `WalletPopupModal.tsx`, `txTypeMeta.ts`, `TxCells.tsx`, `TransactionTableRow.tsx`, 4 unit files | **Critical** | Med | 2h | done | T168 | 71d0c3e | red first: **5000** (expected 4000), **`−฿-1,000.00`**, **`−฿250.00`** | Unit 157 -> 171 |
| T170 | F7: opening-balance rows via `create_wallet` (per-form key), checked fallback with compensation, guest rows; credit cards may open negative | `FinanceContext.tsx`, `zodSchemas.ts`, `AddWalletForm.tsx`, `tests/helpers.ts` (comment), 2 unit files | High | Med | 2h | done | T169 | ae74e7a | 7 of 9 red first; wallet specs 9/9 chromium | Unit 171 -> 180 |
| T171 | F8: CSV `Debt` column, debt resolution, aggregate guard, guest decrement, server `DEBT_OVERPAYMENT` mapping | `types.ts`, `csvExchange.ts`, `FinanceContext.tsx`, `TransactionsView.tsx`, 3 unit files | High | Med | 2.5h | done | T169 | 6846d07 | 11 of 12 red first; stale-debt control failed exactly its test; CSV/debt specs 10/10 | Unit 180 -> 192 |
| T172 | F5: `resetToGuestState` (explicit + `SIGNED_OUT`), `authEpochRef`, explicit sign-out scope; `GuestDataNotice` | `FinanceContext.tsx`, `AuthModal.tsx`, `account/GuestDataNotice.tsx` (new), harness | **Critical** | Med | 2h | done | T168 | adb9473 | 5 red first (**9** and **7** leaked values); epoch control failed exactly; **queue-drop control failed nothing** (recorded) | Unit 192 -> 199 |
| T173 | AccountModal with real sessions; mock session list, `SecurityView` and the security tab removed | `account/AccountModal.tsx` (new), `FinanceContext.tsx`, `App.tsx`, `Navbar.tsx`, `NavbarLedgerStatus.tsx`, `MobileBottomNav.tsx`, `types.ts`, `userAgent.ts`, `date.ts`, 3 unit files, selector contract | High | Med | 3h | done | T172 | f471e14 | scope control failed exactly the 2 scope tests | Unit 199 -> 215 |
| T174 | Five-slot mobile nav; More sheet as a sibling of `<nav>` | `MobileBottomNav.tsx`, `App.tsx` | Med | Low | 1.5h | done | T173 | 5b8f95e | covered by T175's spec | - |
| T175 | Swipe guard + `tests/account-and-mobile-nav.spec.ts` | `swipeGuard.ts`, `App.tsx`, `WalletPopupModal.tsx` (ids), `unit/swipe-guard.test.ts`, new spec | Med | Med | 2.5h | done | T174 | eb9d2b5 | 36/36 on 3 browsers; E2E control reproduced the bug at **฿3,000.00**; swipe E2E **dropped** (vacuous under two controls) | Unit 215 -> **222**; E2E 321 -> **357** |
| T176 | **Paused for the user's go-ahead**, then `apply_migration`; body md5s; both probes post-apply; advisors | live database (no repo change) | **Critical** | High | 0.5h | done | T167, user approval | - (no repo change) | 4/4 bodies match; Phase 51 + Phase 52 probes **OK**; `handle_new_user` advisories gone | - |
| T177 | `CLAUDE.md`: accounts/sessions/sign-out/ledger-edges section, suite sizes, six Do-NOT lines | `CLAUDE.md` | Med | Low | 0.5h | done | T176 | b26b09d | docs only | - |
| T178 | Refactor-log entry, ledger rows, bundle column; ADR 0024's two corrections | `docs/audit/refactor-log.md`, `task-ledger.md`, `baseline-metrics.md`, ADR `0024` | Med | Low | 1h | done | T177 | c8bab97 | docs only; `npm run lint` clean at HEAD | - |
| T179 | **Ask before push**; CI + Vercel + production probe; sha backfill | `docs/audit/refactor-log.md`, `task-ledger.md` | Low | Low | 0.5h | done | T178, user approval | (this row's own commit - a backfill cannot cite its own sha) | docs only; CI `36297307769` success on `c8bab97` | - |
| T180 | Reserved for a fix a gate forced | - | - | - | - | **not needed** | - | - | no gate forced a fix | - |

**Notes on execution:**
- **Every fix went red first**, and the direction bug reproduced at every layer with its own figure: 5000 locally, `−฿-1,000.00` on screen, ฿3,000.00 end to end.
- **Two controls failed nothing, and both findings were recorded rather than worked around.** The sign-out queue drop is defence in depth, not the guard ADR 0024 said it was; the swipe guard cannot be demonstrated in Chromium at all, so its E2E test was deleted and its hardware effect is marked unverified.
- **Re-creating deployed SQL was checked from both ends** - bodies md5-verified before editing, diffed against Phase 51's, byte-compared after apply, and Phase 51's probe re-run unchanged against the result.
- **The full gate:** `npm run lint` clean; `npx playwright test --workers=4` **357/357, 8.2 m**, first attempt, no flakes, no existing spec edited; `npm run test:unit` **222/222**, ~19 s over three runs; `npm run clean && npm run build` 5.1 s, 0 warnings. Bundle measured by rebuilding `044b862` (with `.env`) and `main` in turn.

**CI and deploy:** run `36297307769` on `c8bab97` - success, zero failed jobs, 17 m 41 s. The **Unit tests (Vitest)** step ran **222 tests in 11 files** ahead of the browser install; Playwright **357 passed** (16.3 m at `workers: 1`). Vercel deployment `dpl_3MoKfskbALU7PydTisWnpwQNKNZ5` - Production, `READY`. Pushed with the user's explicit go-ahead, after T176 had applied the migration. (The approval question said 13 commits; the push carried 12 - a miscount, not a missing commit.)

**Production probe after deploy** (`income-and-expence-neon.vercel.app`): site root 200; the served entry is `index-CXUo31ON.js` - the local build's own hash - at exactly **176,314 B**, with no papaparse in it; it names `create_wallet`, `list_my_sessions` and `import_transactions`, and its sign-out call reads `scope: everywhere ? "global" : "local"`, so the explicit local scope shipped. **Not probed:** a real sign-up (the one remaining check that `handle_new_user` still fires as `supabase_auth_admin`) and a signed-in session list - both need a real account session, which this environment does not have.

## Phase 51 - Atomic server-side ledger writes (Supabase RPCs) and reconnection reconciliation: T154-T165 (2026-09-27)

Planned in plan mode and approved by the user before any code was written; four scoping decisions were the user's (drop the untracked `create_ledger_transaction`, keep the legacy fallback, probe-then-apply with an explicit pause before `apply_migration`, defer F7/F8). Scope is the review's F3 (absolute balance writes) and F4 (retry-unsafe insert), deferred by ADR `0022`, plus reload-on-reconnect. Per `README.md:28`, ADR `0023` was written before any code and committed alone.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T154 | ADR `0023` - F3/F4, the live-schema drift (untracked RPC + second idempotency index), the three RPC contracts, replay on any row and before the overpayment guard, no overdraft check, fallback kept, reconnect triggers, migration strategy; the dropped function preserved verbatim | `docs/audit/decisions/0023-atomic-server-ledger-writes.md` (new) | Med | Low | 1.5h | done | - | 9527c0c | docs only; committed alone; appendix md5 `dbe22dc3…` equals the live function's | - |
| T155 | Migration: `record_transaction`, `set_transaction_deleted`, `import_transactions`, four revoked helpers, drop of `create_ledger_transaction`. Probe: 15 assertion groups in `BEGIN…ROLLBACK` | `supabase/migrations/20260927_ledger_rpcs.sql` (new), `supabase/tests/20260927_ledger_rpcs.probe.sql` (new) | **Critical** | High | 3h | done | T154 | ec63c10 | probe **OK** against the live schema, first run; controls: a false `ASSERT` raises `P0004` there, and nothing survived the rollback | - |
| T156 | Harness: `rpc()` becomes a router (missing = `PGRST202`), recorded calls, gates/failures per RPC, a lost-response switch; channel status callback captured | `unit/authenticated-ledger.test.tsx` | Med | Low | 1h | done | T154 | e53461a | the 8 Phase 50 tests pass with their bodies unedited | - |
| T157 | `addTransaction` (non-TRANSFER) -> `record_transaction`; adopt the committed balances; server `DEBT_OVERPAYMENT` -> roll back, re-read, client-formatted message; unknown outcome -> roll back, re-read | `src/context/FinanceContext.tsx`, `unit/authenticated-ledger.test.tsx` | **Critical** | Med | 2.5h | done | T156 | 27581b6 | 8 new, all red first; F3 red at **4800**; targeted control (only the unknown-outcome re-read removed) failed exactly one | Unit suite 134 -> 142 |
| T158 | `setTransactionDeleted` -> `set_transaction_deleted`, same shape | `src/context/FinanceContext.tsx`, `unit/authenticated-ledger.test.tsx` | High | Med | 1.5h | done | T157 | 89c7419 | 4 new, red first; F3 red at **5000**; one test tightened after passing vacuously; `landed()` helper added | Unit suite 142 -> 146 |
| T159 | `commitBulkImport(rows, importKey?)` -> `import_transactions`; one key per preview in `TransactionsView` | `src/context/FinanceContext.tsx`, `src/views/TransactionsView.tsx`, `unit/authenticated-ledger.test.tsx` | High | Med | 1.5h | done | T157 | 35ef68d | 5 new; 4 red first, F3 red at **4900**; no-dedupe guard green both ways by design; `csv.spec` + `csv-classify.spec` 9/9 chromium, unedited | Unit suite 146 -> 151; `TransactionsView` +64 B |
| T160 | Reload on `online`, on visible-after-30 s, and on channel re-`SUBSCRIBED` after a drop; none signed out | `src/context/FinanceContext.tsx`, `unit/authenticated-ledger.test.tsx` | Med | Low | 1.5h | done | T156 | fb1bfbe | 6 new; 3 triggers red first; removing only the staleness gate failed exactly the fresh-load test; 8 consecutive full runs green | Unit suite 151 -> **157** |
| T161 | **Paused for the user's go-ahead**, then `apply_migration` to `Income-Expense-db`; every deployed body byte-compared to the file; probe re-run against the deployed functions; security advisors read | live database (no repo change) | **Critical** | High | 0.5h | done | T155, user approval | - (no repo change) | 7/7 body md5s match; probe **OK**; 0 probe rows left; migration row `20260927003804 ledger_rpcs`; no new anon exposure | - |
| T162 | `CLAUDE.md`: the ledger RPC rules, probe workflow, schema drift, per-preview import key, reconnection, harness router / `landed()` / `quietPeriod`, four Do-NOT lines | `CLAUDE.md` | Med | Low | 0.5h | done | T161 | 90d8515 | docs only | - |
| T163 | Phase 51 refactor-log entry, ledger rows, bundle column | `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`, `docs/audit/baseline-metrics.md` | Med | Low | 1h | done | T162 | 145ce0a | docs only; `npm run lint` clean at HEAD | - |
| T164 | Sha backfill plus the CI and deploy result | `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md` | Low | Low | 0.5h | done | T163 | (this row's own commit - a backfill cannot cite its own sha) | docs only; CI `36283681997` success on `145ce0a` | - |
| T165 | Reserved for a fix a gate forced | - | - | - | - | **not needed** | - | - | no gate forced a fix | - |

**Notes on execution:**
- **Every fix went red before it went green, and each F3 control failed at the exact absolute value the legacy path writes** - 4800 (record), 5000 (delete), 4900 (import) - where the server-relative answer was 7577, 9200 and 7677.
- **Two tests passed vacuously on the first red run and were fixed, not accepted.** The delete tests fired in the same tick as the add that created their row, so the unfixed code failed with `Transaction not found` rather than on the absolute write, and the rejected-RPC test passed for that wrong reason. A `landed()` helper and an "the RPC was actually asked" assertion made both honest.
- **The SQL was proven twice against the real schema without persisting anything** - before apply (migration inside the transaction) and after (deployed functions) - and the deployed bodies were byte-compared to the file, so the text pasted into `apply_migration` could not have drifted from the repo.
- **The full gate:** `npm run lint` clean (both tsconfigs); `npx playwright test --workers=4` **321/321 passed, 7.2 m**, first attempt, no flakes, no spec edited; `npm run test:unit` **157/157**, 9.6-10.2 s across three timed runs (8 further back-to-back runs, all green); `npm run clean && npm run build` 5.1 s, 0 chunk-size warnings. Bundle measured by rebuilding `2b60b51` (with the same `.env`) and `main` in turn.

**CI and deploy:** run `36283681997` on `145ce0a` - success, zero failed jobs, 15 m 17 s. Type-check, the **Unit tests (Vitest)** step (**157 tests**, 6 files, still ahead of the browser install) and the Playwright step (**321 passed**, 14.2 m at `workers: 1`) all passed. Vercel deployment `dpl_DEa7XiqZD7DgU3oxSwkE5xfkQtYX` - Production, `READY`. The push was made with the user's explicit go-ahead, after T161 had already applied the migration, so the frontend never ran against a database without the RPCs.

**Production probe after deploy** (`income-and-expence-neon.vercel.app`): site root 200; the served entry is `index-J7uTPzwf.js` - the same content hash as the local build - at exactly **168,856 B**, and it names `record_transaction`, `set_transaction_deleted` and `import_transactions`, so the measured build is the one serving. **Not probed: a signed-in write against production** - that needs a real account session, which this environment does not have; the SQL probe exercised the deployed functions directly instead.

## Phase 50 - Signed-in write-path integrity, and a harness that can see it: T145-T153 (2026-09-26)

Approved explicitly by the user after a full architectural review of Phases 1-49, planned and approved before any code was written. Scope is the review's two Critical data-corruption findings (F1, F2) plus three small fixes the new harness made testable (F6, P2, P3). Per `README.md:28`, ADR `0022` was written before T146 started and committed alone. The review's other findings are deferred by name to Phases 51-52 - see the refactor-log entry's "Deliberately not done".

**Day 0 was not applied.** The plan's Vercel firewall rate limit on `/api/classify` and `/api/insights` failed at the API (`404 Seawall Config not found`; the update tool's schema cannot express a `rate_limit` rule), and a further attempt was refused by the session's permission classifier. It is not a task row because it was never a code change; it was handed to the user as dashboard steps.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T145 | ADR `0022` - why the signed-in path needs its own harness, why it runs without `act()` on macrotask-settling fakes, the F1 negative control as part of the decision, the 429 amendment to ADR `0011` | `docs/audit/decisions/0022-authenticated-path-unit-harness.md` (new) | Med | Low | 1h | done | - | 51f71da | docs only; committed alone | - |
| T146 | The harness: real `FinanceProvider`, `src/lib/supabase` replaced by `vi.mock`, a recording chainable fake settling on `setTimeout(0)`, `IS_REACT_ACT_ENVIRONMENT = false`; `beforeEach` later tightened to wait for `isSyncing === false` after it raced | `unit/authenticated-ledger.test.tsx` (new) | High | Med | 2.5h | done | T145 | 4195db9, 3d9399a | no `src/` export added; race fix 0/30 failures | Unit suite 99 -> 102 |
| T147 | F1: the debt remainder computed once from the ref, before any `setState`, and reused by the remote write | `src/context/FinanceContext.tsx` | **Critical** | Med | 1h | done | T146 | 4195db9 | control failed at **2500** as predicted; exact-payoff case passed unfixed (the floor hid it) | entry +1,081 B together with T148/T151 (`FinanceContext` is in the entry chunk) |
| T148 | F2 context: insert error checked before any balance write, sequential balance writes, compensation (restore + soft-delete), `MutationResult` return, honest `insertedCount` | `src/context/FinanceContext.tsx`, `unit/authenticated-ledger.test.tsx` | **Critical** | Med | 2h | done | T147 | 2f4fcd0 | 3 tests red first; targeted control (only `insertErr` removed) failed exactly one | Unit suite 102 -> 105 |
| T149 | F2 view: `#commit-import-btn` disabled + ref latch while in flight, `#import-commit-error`, preview kept open on failure, false atomicity copy removed | `src/views/TransactionsView.tsx`, `docs/audit/test-selector-contract.md` | High | Low | 1h | done | T148 | 96b52f8 | `csv.spec.ts` + `csv-classify.spec.ts` 9/9 chromium, unedited | `TransactionsView` +626 B |
| T150 | P2: upstream 429 passed through by both proxies; insights `no-store`; 26 contract tests driving the exported `POST` handlers | `api/classify.ts`, `api/insights.ts`, `unit/proxy-contract.test.ts` (new), ADR `0022` (corrected) | Med | Low | 1.5h | done | T145 | dc37b48 | exactly 3 of 26 red first; **planned tsconfig split dropped** - the root program already has Node types via `@types/papaparse` | Unit suite 105 -> 131 |
| T151 | P3: a too-short CSV note skips its row, not the run. F6: `cloudRevisionRef` moves only on a clean read | `src/utils/batchClassifier.ts`, `src/context/FinanceContext.tsx`, `unit/batch-classifier.test.ts`, `unit/authenticated-ledger.test.tsx` | Med | Med | 1.5h | done | T146 | 9deff7d | P3 red (`unavailable: true`); F6 red (**4800**, expected 5000); boundary test green both ways | Unit suite 131 -> **134** |
| T152 | `CLAUDE.md`: the second harness and its `act()` rule, the import `MutationResult`, the 429 pass-through, and the Node-types guard corrected | `CLAUDE.md` | Med | Low | 0.5h | done | T151 | a078e5e | docs only | - |
| T153 | Phase 50 refactor-log entry, ledger rows, bundle column | `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`, `docs/audit/baseline-metrics.md` | Med | Low | 1h | done | T152 | af49581 | docs only; `npm run lint` clean at HEAD | - |

**Notes on execution:**
- **Every fix went red before it went green**, and two controls reproduced the review's predicted figures exactly (2500 for F1, 4800 stuck for F6).
- **Two plan premises were wrong and both were corrected rather than forced.** The tsconfig split (the root program already has Node types) and the first bundle baseline (a worktree build without `.env` measured env inlining, not code). Both are recorded in the refactor log.
- **The full gate:** `npm run lint` clean (both tsconfigs); `npx playwright test --workers=4` **321/321 passed, 7.2 m**, first attempt, no flakes; `npm run test:unit` **134/134**, ~3.1 s; `npm run clean && npm run build` 5.45 s, 0 chunk-size warnings. Bundle measured by rebuilding `030a46a` (with the same `.env`) and `main` in turn.
- **The harness raced once in twelve timing runs** and was fixed in its own commit (`3d9399a`) before any docs were written - 0 failures in 30 consecutive runs afterwards.

**CI and deploy:** run `36250746360` on `af49581` - success, zero failed jobs, 19 m 51 s. Type-check, the **Unit tests (Vitest)** step (now 134 tests, still ahead of the browser install) and the Playwright step all passed; CI runs `workers: 1`, the local gate ran `--workers=4`, both clean at 321/321. Vercel deployment `dpl_zrosWP7j8DZZboP7ViAWsVwF6Xnu` - Production, `READY`.

**Production probes after deploy** (`income-and-expence-neon.vercel.app`): site root 200; `{}` to both `/api/classify` and `/api/insights` returns **400** (key still configured - a missing key would 404); `/api/insights` now carries `Cache-Control: no-store`, which only the new build sends, so the deploy is what is serving. One real classify call with `ข้าวมันไก่` sent from a **UTF-8 file** (`curl --data-binary @file`; the bytes on the wire checked as `e0 b8 82 …`) returned `cat-food` at 0.97. **Not probed: the 429 burst** - the Day 0 firewall rule is still not configured (`get_firewall_config` 404 after deploy), so there is no limit to hit. That check is owed once the rule exists.

## Phase 49 - Unit testing foundation (Vitest) and the historical coverage gaps: T136-T144 (2026-09-24)

Approved explicitly by the user, planned and approved before any code was written. Four questions were settled up front: the Phase 44 gap is closed by **rendering the real `FinanceProvider`** rather than extracting arithmetic; the runner is **Vitest 5** with the Vite floor tightened to `^6.4.0`; the DOM harness is **`@testing-library/react`**; and the wiring is a **CI step only**, no husky. Per `README.md:28`, ADR `0021` was written before T137 started and committed alone.

**This phase reverses a standing decision.** The "Not a task" section below has listed Vitest as explicitly out of scope since the original audit. Phases 44-48 changed the facts; the exclusion is amended below rather than silently contradicted.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T136 | ADR `0021` - the four-phase pattern that forced this; the reversal of the Vitest exclusion; both default-glob collection traps; why the Phase 44 gap is rendered rather than extracted; the linear-not-exponential backoff correction | `docs/audit/decisions/0021-unit-testing-foundation.md` (new) | Med | Low | 1.5h | done | - | e9cd727 | docs only; committed alone | - |
| T137 | Vitest installed and bounded: `unit/` directory, explicit `include`, the `testMatch` pin on Playwright, `test:unit` script, Vite floor `^6.2.3` -> `^6.4.0` | `package.json`, `package-lock.json`, `vitest.config.ts` (new), `tsconfig.json`, `playwright.config.ts` | High | Med | 1.5h | done | T136 | 0b21c4e | `npm run lint` clean; `playwright test --list` still **321 tests in 22 files** | 4 devDeps; zero production files touched |
| T138 | 38 tests pinning Phase 48's thresholds at both edges, the branch precedence, sliced-not-parsed months, and that no rendered figure is absent from the summary | `unit/spending-summary.test.ts` (new) | High | Low | 2h | done | T137 | 1ceee28 | 38/38; `vitest list` shows only `unit/` | Unit suite 0 -> 38 |
| T139 | 20 tests pinning Phase 47's concurrency ceiling, pre-dispatch de-duplication, the 400 ms retry, and both early-stop paths | `unit/batch-classifier.test.ts` (new) | High | Med | 2.5h | done | T137 | 1f9e14e | 20/20; two controls, one reproducing the stampede at 4 requests | Unit suite 38 -> 58 |
| T140 | 23 tests pinning Phase 46's `isSecureContext` branch and the full error taxonomy, driven through the hook's public surface | `unit/speech-support.test.tsx` (new) | High | Med | 2.5h | done | T137 | 8b7f9e7 | 23/23; two controls; **found** that `start()` never re-checks `isSupported` | Unit suite 58 -> 81 |
| T141 | 18 tests against the real `FinanceProvider`: the overpayment guard, its position relative to the key and the replay check, and the delete/restore debt reversal | `unit/ledger-guards.test.tsx` (new) | High | High | 3.5h | done | T137 | 47e1dee | 18/18; three controls, each isolating its own assertions | Unit suite 81 -> **99** |
| T142 | CI step before the browser install, `CLAUDE.md` section and four Do-NOT lines; **plus the Tailwind source restriction a bundle measurement forced** | `.github/workflows/playwright.yml`, `CLAUDE.md`, `src/index.css` | Med | Med | 1.5h | done | T141 | a0fb4e0, f9eff52 | **321/321, 7.5 m**, first attempt, no flakes | JS byte-identical; **CSS -935 B** |
| T143 | Phase 49 refactor-log entry, ledger rows, bundle column | `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`, `docs/audit/baseline-metrics.md` | Med | Low | 1h | done | T142 | 90f1be4 | docs only; `npm run lint` clean at HEAD | - |
| T144 | Sha backfill plus the CI result | `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md` | Low | Low | 0.5h | done | T143 | (this row's own commit - a backfill cannot cite its own sha) | docs only; CI `35985107507` success on `90f1be4` | - |

**Notes on execution:**
- **The bundle measurement caught a leak that predates the phase.** The delta was supposed to be byte-identical and was not: Tailwind v4's automatic content detection scans the *whole repository*, so `isolate: true` in `vitest.config.ts` emitted `.isolate` and the word "invert" in a sentence in ADR `0021` emitted `.invert` - 246 bytes of dead CSS shipped to users from two files that render nothing. `tests/helpers.ts` had been doing the same since Phase 19. Fixed at the class level with `source(none)` plus two explicit sources; all 15 removed selectors verified dead before the commit.
- **A test asserted something false and was corrected rather than the code.** `start()` in `useSpeechRecognition` checks only for a constructor, never `isSupported`, so on an insecure origin it arms a session that cannot run. Unreachable in the app because `TransactionForm.tsx:701` gates the mic on `isVoiceSupported`. Pinned as-is; hardening it is a behaviour change for a later phase.
- **The brief's "exponential backoff" is linear.** `BASE_BACKOFF_MS * attempt` with `MAX_ATTEMPTS` at 2 is exactly one 400 ms wait. Pinned as it ships.
- **A control revealed why both single-direction and round-trip assertions are needed.** With the debt reversal removed, the delete/restore round-trip tests stayed **green** - both halves were broken symmetrically and cancelled out. Only the single-direction assertions caught it.
- **Seven negative controls, every one failing on its intended assertion.** First phase in four where none needed redoing.
- **No flakes.** Phase 44's `wallets.spec.ts` webkit flake has now not reproduced across five consecutive phases.

**CI:** run `35985107507` on `90f1be4` - success, zero failed jobs. The new **Unit tests (Vitest)** step is confirmed to have executed in the intended position, after the type-check and **before** `npx playwright install --with-deps`, and `npm ci` resolved the four new devDependencies from the updated lockfile without incident. CI runs `workers: 1`; the local gate ran `--workers=4`, and both were clean at 321/321. No Vercel deployment check this phase - nothing deployable changed except `src/index.css`, whose effect was verified by the full suite rather than by a production probe.

## Phase 48 — Smart spending insights (AI monthly wrap-up): T129–T135 (2026-09-24)

Approved explicitly by the user, planned and approved before any code was written. Three questions were settled up front: the card goes in **`DashboardView`** (there is no Analytics view and none is created); **the model picks a pattern and the app renders the sentences** (Jev answers choice questions, not free text); and the cache lives in **`localStorage`** keyed by user and month. Per `README.md:28`, ADR `0020` was written before T130 started and committed alone.

| # | Task | Files | Impact | Risk | Effort | Status | Blocked by | Commit | Gate result | Metric delta |
|---|---|---|---|---|---|---|---|---|---|---|
| T129 | ADR `0020` — the missing Analytics view; choice-plus-renderer over free text and the three properties it buys; the exact payload and the category-name residual; `/api/insights` as a sibling rather than an action; the `localStorage` trade-off; and the generalisation of the mocking rule | `docs/audit/decisions/0020-monthly-spending-insights.md` (new) | Med | Low | 1.5h | done | — | feb8f71 | docs only; committed alone | — |
| T130 | `SpendingSummary`/`InsightsResponse` contracts plus `spendingSummary.ts` — aggregation, the deterministic selector, and the renderer that keeps every ฿ figure out of the model's hands | `src/types.ts`, `src/utils/spendingSummary.ts` (new) | High | Med | 2.5h | done | T129 | b015c63 | `npm run lint` clean both tsconfigs | — |
| T131 | `api/insights.ts` — named `POST` export, forbidden-key rejection, 404-on-missing-key, bounded and unique-checked input | `api/insights.ts` (new) | High | Med | 2h | done | T129 | 6b4da87 | `npm run lint` clean; `grep` confirms no default export | — |
| T132 | `insightsClient` (never-throws contract, 404 latch, `localStorage` cache write) plus the card and its Dashboard mount | `src/utils/insightsClient.ts` (new), `src/components/dashboard/SpendingInsightsCard.tsx` (new), `src/views/DashboardView.tsx` | High | Med | 3h | done | T130, T131 | 12933e0 | `npm run lint` clean | `DashboardView` +7.65 kB; `vendor-icons` +0.59 kB |
| T133 | 7 new tests, the third spec permitted to mock, the `CLAUDE.md` rule generalisation, **and the client simplification a negative control forced** | `tests/insights.spec.ts` (new), `CLAUDE.md`, `src/utils/insightsClient.ts`, `src/components/dashboard/SpendingInsightsCard.tsx` | High | Low | 3h | done | T132 | b76f112 | **321/321, 8.2 m**, first attempt, no flakes; **four** negative controls, two of which changed the code | Suite 300 → **321 runs**, 100 → 107 tests, 21 → **22** spec files |
| T134 | Phase 48 refactor-log entry, ledger rows, bundle column, selector-contract additions | `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`, `docs/audit/baseline-metrics.md`, `docs/audit/test-selector-contract.md` | Med | Low | 1h | done | T133 | 384c140 | docs only; `npm run lint` clean at HEAD | — |
| T135 | Sha backfill, plus the CI and deploy result | `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md` | Low | Low | 0.5h | done | T134 | (this row's own commit — a backfill cannot cite its own sha) | docs only; CI `35956000836` success on the preceding commit | — |

**CI and deploy:** run `35956000836` on `384c140` — success, zero failed jobs. Vercel deployment `6630243013` — Production, state `success`. CI runs `workers: 1`; the local gate ran `--workers=4`, and both were clean at 321/321.

**Production endpoint probe — run, and it passed.** The refactor-log entry filed this as code review only; it was then actually executed against the production alias `income-and-expence-neon.vercel.app` (the deployment URL and two other aliases are behind Vercel SSO and return 401 before reaching the function):

| Probe | Result |
|---|---|
| `POST /api/insights`, valid summary | **200 in 1.34 s**, `{"pattern":"CATEGORY_SPIKE","focus":"Food & Dining","confidence":1}` |
| `POST /api/insights` with `instructions` | **400** — `Field "instructions" is not accepted; question wording is server-owned.` |
| `POST /api/insights` with empty categories | **400** — `Field "summary.categories" must not be empty.` |
| `POST /api/classify` (regression) | **200 in 1.23 s**, unchanged shape |

**The default-export trap is confirmed absent**: a default export would have hung for 60 s and returned zero bytes. 1.34 s with a well-formed `InsightsResponse` is the only evidence that actually settles it, and it could not be produced locally — `tsc` cannot see the trap and the suite mocks the endpoint. It also confirms `TYPESAFE_API_KEY` is configured in production and that the upstream Jev call returns a usable verdict for a genuinely spiking category.

**Full gate:** `npm run lint` clean (both tsconfigs); `npx playwright test --workers=4` **321/321 passed, 8.2 m**; `npm run clean && npm run build` succeeded in 7.05 s, 0 chunk-size warnings. Measured by building `9ab4d5d` and `main` in turn.

**Design constraints carried from ADR `0020` (do not re-litigate):**
- **The model picks the pattern; the app states the numbers.** Every ฿ figure comes from `formatCurrencyAmount` over ledger data, so the card cannot contradict `CategoryExpenseDistribution` beside it.
- **Only aggregates leave the device.** No descriptions, no ids, no wallet names, no individual amounts or dates. Category names do, and that residual is named rather than glossed.
- **The card has no error state by construction**, because the offline path is the same renderer with a locally-chosen verdict.
- **`api/insights.ts` uses a named `POST` export.** A default export hangs for 60 s and is invisible to `tsc` and to the suite.
- **One cache reader.** The card's synchronous seed is it; `fetchInsight` deliberately does not read the cache.

**Notes on execution:**
- **A negative control deleted code.** Disabling `fetchInsight`'s cache read did not fail the caching test, because the card's `useState` seed was the real mechanism. The client's read was unreachable duplication and was removed along with `forceRefresh`.
- **A second control was itself wrong.** The offline-fallback control passed because the throw landed inside the `try`. With both fallback returns removed it failed correctly. Second consecutive phase where a control needed redoing.
- **The privacy test was checked for specificity before being trusted**: an unrelated extra field in the body correctly does *not* trip it, while a leaked transaction description does.
- **The icon cost on the critical path recurred and was caught proactively.** The entry chunk is byte-identical, but four new icons added +0.59 kB to the modulepreloaded `vendor-icons`.
- **No flakes.** Phase 44's `wallets.spec.ts` webkit flake has now not reproduced across four consecutive phases; still watched rather than closed.

## Deferred — none remaining

Both items formerly in this table are now resolved; see Phase 38 above. **Zero audit tasks remain in `todo` or `deferred` status.** Phases 39 and 40 above track approved feature builds with their own rows.

## Not a task — explicitly out of scope this pass

`tsconfig.json` `strict` mode, ESLint/Prettier, ~~Vitest~~ (**adopted in Phase 49 - see ADR `0021`**; the rest of this list stands), React Compiler, `rollup-plugin-visualizer`, a second state library, merging `roundToCents`/`roundToTwoDecimals`, mass-rewriting imports to adopt `@/*`, unifying/removing `AnimatedCounter`'s currency exemption without ADR `0004`. See the plan's "Non-goals and traps" section for the full list and reasoning.
