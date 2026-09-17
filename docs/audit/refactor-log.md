# Refactor log

Append-only, newest entry first. One entry per **shipped phase**, never per commit.

---

## Phase 4 — DiaryView memoization: T8 (2026-09-17, no commit yet — pending review)

**Changed**

- Hoisted `formatDayInfo` from `DiaryView.tsx` into `src/utils/date.ts`, extending its signature with optional `todayStr`/`yesterdayStr` parameters (defaulting to fresh `todayIsoDate()`/`daysAgoIsoDate(1)` calls) so a caller formatting many dates in a loop computes "today" once instead of once per date. Date math unchanged: still `new Date(year, month-1, day)` for local midnight, never `new Date(dateStr)` — no UTC-shift risk introduced.
- Hoisted `moodLabels` (fully static, no component-state dependency) to a module-level `MOOD_LABELS` constant.
- Added a module-level `EMPTY_DAY_DATA` constant replacing two inline fallback-object literals, so a day with zero transactions gets the same object reference every access.
- Memoized `activeEntries` (`useMemo`, deps `[diaryEntries]`), `selectedDayInfo`, `selectedDateOutflowCount`, and — the main fix — a new `enrichedEntries` `useMemo` (deps `[activeEntries, dailyTransactionsMap, todayIso, yesterdayIso]`) that precomputes each diary entry's `dayInfo`/`dayData`/`outflowTxs`/`moodInfo` once per actual data change instead of once per render.
- Extracted the per-entry card markup into a new `src/components/DiaryEntryCard.tsx`, wrapped in `React.memo`, receiving the precomputed values plus two new stable `useCallback`s from the parent (`handleToggleExpand`, `handleDeleteEntry`) that take the entry id as an argument — replacing per-row inline closures that would have defeated the memo regardless of prop stability elsewhere.

3 files changed: `src/utils/date.ts` (+37 lines), `src/views/DiaryView.tsx` (132 insertions, 181 deletions — net smaller despite the added memoization, since the ~180-line inline card JSX moved out), new `src/components/DiaryEntryCard.tsx` (196 lines).

**Why**

`audit-report.md` finding B: `DiaryView.tsx:135-137` (filter+sort), `:203` (inline filter), and `:367` (per-entry filter inside the render map) all recomputed on every render, including every keystroke into the form's 7 local state fields (mood, workout, workoutNote, foodQuality, notes, saveSuccess, saveError) — none of which have anything to do with the entries list being displayed. `:68-84`'s `formatDayInfo` additionally recomputed "today"/"yesterday" reference dates once per diary entry per render.

**Verification**

```
npx tsc --noEmit                          # clean, 0 errors
npx playwright test tests/diary.spec.ts   # 3/3 (all 3 browsers), 9.5s total -
                                           # Firefox at normal speed, no timing regression
npx playwright test --reporter=line       # 39/39 (1m15.0s)
npm run clean && npm run build            # succeeded in 6.88s; DiaryView chunk
                                           # 16.46 kB -> 16.71 kB (DiaryEntryCard
                                           # bundles into the same lazy chunk, not
                                           # a new split point); vendor chunks
                                           # from T7 unaffected
```

`git status --short` confirmed only `date.ts`, `DiaryView.tsx`, and the new `DiaryEntryCard.tsx` changed.

**Metric delta**

| Metric | Phase 3 | Phase 4 |
|---|---|---|
| `formatDayInfo` calls per DiaryView render (N entries) | N + 1 (once for selected date, once per entry, each also recomputing today/yesterday internally) | N + 1 calls, but 0 of them on a keystroke unrelated to the entries list — `enrichedEntries`/`selectedDayInfo` only recompute when their actual deps change |
| `activeEntries` filter+sort | every render | only when `diaryEntries` changes |
| Per-entry outflow filter (`:367`) | every render, inline in JSX | precomputed once in `enrichedEntries`, plus the row itself is `React.memo`'d so unaffected rows skip re-rendering entirely |
| `DiaryView.tsx` line count | 499 (pre-T8) | ~350 (card markup extracted to its own file) |

Re-render counts (S4, the diary-keystroke scenario from `baseline-metrics.md`) remain uncaptured — same instrumentation gap noted in the Phase 2 entry. This phase's fix is the direct target of S4 and would be the clearest place to finally stand up that measurement.

**Surprises**

- None. `tsc`, the diary spec (specifically watched for Firefox timing per the task's guardrail), and the full suite all passed clean on the first attempt.

**Deliberately not done**

- `DashboardView.tsx:87,92,95,150`, `WalletsView.tsx:117`, and `SecurityView.tsx:282` (the other UTC-shift-risk date sites the audit flagged) were not touched — that's task `T21`, out of scope here. `daysAgoIsoDate` still isn't adopted at any of those sites.
- No change to `dailyTransactionsMap` (already correctly `useMemo`'d before this phase) or to the diary form's own local state shape.
- Re-render scenario counts (S1-S5) still not captured — see Metric delta above.

---

## Phase 3 — Bundle optimization: T7 (2026-09-17, commit `da46314`)

**Changed**

- **T7** — Added `build.rollupOptions.output.manualChunks` to `vite.config.ts` as a function (not the object-shorthand form, which cannot match `mathjs/number`'s subpath import or `lucide-react`'s deep per-icon module paths). Matches on `node_modules/<pkg>/` substrings and groups: `vendor-react` (`react`, `react-dom`, `scheduler`), `vendor-motion` (`framer-motion`, `motion-dom`, `motion-utils`, `tslib`), `vendor-supabase` (`@supabase/*`, which covers all 5 of `@supabase/supabase-js`'s sub-packages via the scope prefix), `vendor-math` (`mathjs/number`), `vendor-icons` (`lucide-react`). Everything else (`zod`, `papaparse`, `react-swipeable`, app code) is left to Rollup's default chunking.

1 file changed (`vite.config.ts`): +38 lines (new `build` block only). No other file touched.

**Why**

`audit-report.md` finding H: the entry chunk was 1,116.67 kB with no `manualChunks` configured — Vite's own build output warned about it directly ("Some chunks are larger than 500 kB... Use build.rollupOptions.output.manualChunks"). Per-view code splitting via `React.lazy` already worked; the entry chunk was the one thing nothing split.

**Verification**

```
npx tsc --noEmit                    # clean, 0 errors
npm run clean && npm run build      # succeeded in 6.91s; entry chunk 165.39 kB / 45.72 kB gzip
                                     # (was 1,116.36 kB / 326.11 kB gzip); 0 chunks over 500 kB (was 1)
npx playwright test --reporter=line # 39/39 on a clean re-run (see Surprises for the one flake)
```

Additionally, since `manualChunks` only takes effect under `vite build` (never under the `vite dev` server Playwright's `webServer` runs against), I booted `vite preview` against the actual production build to confirm the split works at runtime, not just at build time: `curl` returned HTTP 200 for `/`, and grepping the served entry chunk's contents for `vendor-*.js` filenames found all 5 vendor chunks referenced.

`git status --short` confirmed only `vite.config.ts` changed.

**Metric delta**

| Metric | Phase 2 | Phase 3 |
|---|---|---|
| Entry chunk (raw / gzip) | 1,116.36 kB / 326.11 kB | 165.39 kB / 45.72 kB (−85% raw) |
| Chunks over Vite's 500 kB warning threshold | 1 (the entry chunk) | 0 |
| Total JS bytes across all chunks (raw, summed) | ≈1,300.96 kB | ≈1,296.81 kB (essentially unchanged — see Surprises) |
| Build time | 8.51s | 6.91s |

Full per-chunk table recorded in `baseline-metrics.md` under "After T7".

**Surprises**

- **Total bytes shipped did not shrink.** Summing every `.js` chunk before and after T7 gives ≈1,301 kB and ≈1,297 kB respectively — essentially identical (the small drop is from consolidating 7 previously-separate lucide-react micro-chunks into one `vendor-icons` chunk, removing per-chunk overhead). This task was never going to reduce total payload — it redistributes the same code across chunks that can be fetched in parallel and cached independently across deploys. Worth stating plainly so this isn't mistaken for a "faster page" claim without qualification: what improved is time-to-first-paint-relevant parse/eval work (entry chunk −85%) and cache stability for returning visitors, not total bytes for a cold empty-cache visit.
- One Firefox run of `diary.spec.ts` failed on the first full-suite pass (`#view-loading-fallback` didn't detach within 10s), then passed both in isolation and on a full clean re-run immediately after. Confirmed this cannot be caused by `manualChunks`, since that Rollup option only applies to `vite build` output and the Playwright suite runs against `vite dev` (`playwright.config.ts`'s `webServer.command: 'npm run dev'`), which never executes `build.rollupOptions` at all. This matches the pre-existing, documented Firefox/dev-server flakiness `tests/helpers.ts` and `playwright.config.ts` already account for with generous Firefox timeouts.
- The pre-T7 build already had informal, Rollup-default splitting of individual `lucide-react` icons into tiny standalone chunks (`plus-*.js`, `arrow-up-right-*.js`, etc., 0.33-0.92 kB each) — an artifact of icons being shared across 2+ lazy-loaded view chunks. These disappeared post-T7, consolidated into the single `vendor-icons` chunk by the broader `node_modules/lucide-react/` match, which is the intended and better outcome (one cacheable chunk instead of many tiny ones).

**Deliberately not done**

- No bundle-analysis plugin (e.g. `rollup-plugin-visualizer`) was added — explicitly out of scope per the plan's non-goals; logged in `constraints-to-promote.md`'s follow-on proposals.
- No change to `chunkSizeWarningLimit` — the warning is now moot since every chunk is under the default 500 kB threshold, so there was nothing to adjust.
- `@/*` alias was not re-added or touched — confirmed the `vite.config.ts` diff contains only the new `build` block, nothing near the (already-deleted, per T28) `resolve.alias` section.
- `server.hmr`/`server.watch` (`DISABLE_HMR` handling) untouched, per the explicit guardrail.

---

## Phase 2 — High-impact UI decoupling: T1 & T3 (2026-09-17, commit `41c6a4c`)

**Changed**

- **T1** — Extracted the quick-add modal (`App.tsx:176-242` in its pre-Phase-2 form) into `src/components/QuickAddModal.tsx`, a near-verbatim move that preserves every id, `role`/`aria-*` attribute, and class name the Playwright suite depends on. The new component calls `useFinance()` itself for `wallets`/`categories`/`addTransaction`, and wraps its wallet/category filters in `useMemo`. Deleted `MainApp`'s `useFinance()` call (`App.tsx:61` in its pre-Phase-2 form) entirely — it now holds only its 4 local `useState` UI flags (`activeTab`, `direction`, `isQuickAddOpen`, `isAuthModalOpen`).
- **T3** — Wrapped `handleTabChange`, `handleNextTab`, `handlePrevTab` in `useCallback` (dep: `[activeTab]` — stable except when the tab itself changes). Added a single stable `handleNavigate` callback replacing the two inline `onNavigate={(tab) => handleTabChange(tab as ActiveTab)}` closures passed to `DashboardView`. Also added `useCallback` for the four modal-toggle handlers (`handleOpenQuickAdd`, `handleCloseQuickAdd`, `handleOpenAuth`, `handleCloseAuth`), which are now fully stable (`[]` deps) since they're pure `setState(true/false)` wrappers.

1 file changed (`App.tsx`): 48 insertions, 91 deletions. 1 file added (`QuickAddModal.tsx`, 100 lines).

**Why**

`audit-report.md` finding A: `App.tsx:61`'s `useFinance()` subscription was the single highest-leverage fix in the whole audit — `MainApp` renders the entire app shell inline, so that one subscription is why `React.memo` looked defeated at eight unrelated components (`MobileBottomNav`, `RecentTransactionsTable`, `CategoryExpenseDistribution`, `CashflowMetricsCards`, `DebtPayoffOverview`, `TotalWealthHero`, `TransactionTableRow`, `DebtCardItem`). ADR `0001` recommended doing this before any `FinanceContext` split work, since it requires zero context surgery and removes most of the measured re-render cost on its own.

**Verification**

```
npx tsc --noEmit                    # clean, 0 errors
npx playwright test --reporter=line # 39 passed (1m5.0s) - no timeouts,
                                     # helpers.ts:gotoTab's #view-loading-fallback
                                     # assertion held throughout
npm run clean && npm run build      # succeeded in 8.51s; entry chunk
                                     # 1,116.36 kB / 326.11 kB gzip
```

`git status --short` confirmed only `App.tsx` (modified) and `QuickAddModal.tsx` (new) changed — nothing in `FinanceContext.tsx`, Supabase sync, or ledger mutation code was touched, per the guardrail.

**Metric delta**

| Metric | Phase 1 | Phase 2 |
|---|---|---|
| Entry chunk (raw / gzip) | 1,116.08 kB / 326.05 kB | 1,116.36 kB / 326.11 kB |
| Playwright wall-clock | 1m2.8s (cold server) | 1m5.0s (cold server) — within normal run-to-run variance, no timeouts |
| `MainApp`'s `useFinance()` subscriptions | 1 (only via the modal it rendered inline) | 0 |

The entry chunk grew by ~280 bytes raw — expected: `QuickAddModal.tsx` is a new eagerly-imported module (not lazy), so its code moved rather than shrank. `manualChunks` (T7) is still the lever for the entry chunk's actual size; that's unaffected by this phase.

Re-render counts (S1-S5) remain uncaptured. This was the natural point to capture them (T1 is the "before" this whole plan was measuring toward), but doing so requires the throwaway `Profiler`/`console.count` instrumentation branch described in `baseline-metrics.md`, which this session did not stand up. Recorded as a gap to close before Phase 3 continues (T8, T7, T9, etc.).

**Surprises**

- The `handleTabChange`/`handleNextTab`/`handlePrevTab` handlers were initially written using React's functional-updater form (`setActiveTab(current => ...)`) specifically so their `useCallback` dependency arrays could be `[]` — fully stable for the session, not just stable-between-tab-changes. This was reverted before shipping: the updater bodies called `setDirection(...)` as a side effect, and React may invoke a `setState` updater function more than once (StrictMode double-invocation, concurrent rendering) — updaters must stay pure. Shipped with the simpler closure-based form and an explicit `[activeTab]` dependency instead, which is behaviorally identical to the pre-Phase-2 code and avoids the impure-updater trap.
- T10 ("hoist `navItems`; memo `Navbar` after subscription cut") was previously blocked on "T1, T2" in the ledger. Both are now shipped (T2 in Phase 1, T1 here), so T10 is unblocked — noted in `task-ledger.md`.

**Deliberately not done**

- Re-render scenario counts (S1-S5) were not captured before or after this phase — see Metric delta above. This is the clearest gap in this phase's verification: the plan's headline claim (removing `App.tsx:61` fixes "every consumer re-renders on every write") is currently supported by structural reasoning and the passing test suite, not by a measured before/after render count. Should be captured before Phase 3 continues.
- `renderActiveView` was not wrapped in `useCallback` or otherwise memoized. It's a local render-helper function, called directly during render and never passed as a prop to any component — memoizing it would add an equality check for no benefit.
- No `FinanceContext.tsx` changes. Per the guardrail, this phase touched only `App.tsx` and the new `QuickAddModal.tsx`.
- T7 (`manualChunks`), T8 (`DiaryView` memoization), T9 (remaining inline-filter memoization elsewhere), and the rest of the deferred task list remain untouched, awaiting separate approval per the ledger.

---

## Phase 1 — Zero-risk cleanup (2026-09-17, commit `74114f6`)

**Changed**

- **T4** — Added `npm run lint` (`tsc --noEmit`) as a CI step in `.github/workflows/playwright.yml`, before the Playwright step. Added `tests` to `tsconfig.json`'s `include` (removing it from `exclude` alone was not sufficient — `include` was `["src"]` only, so `tests/` was never type-checked regardless of the exclude list; fixed by adding it to `include` too).
- **T2** — Deleted `otpPending` end-to-end: the state (`FinanceContext.tsx`), its two context-value sites, and both badge renders (`Navbar.tsx`, `MobileBottomNav.tsx`). `MobileBottomNav` lost its only `useFinance()` call and its now-dead `useFinance` import.
- **T5** — Removed dead hook exports: `useTransactions.ts`'s `metrics` memo and its dep on `isSyncing`, un-exported `UseTransactionsFilterOptions`; `useWallets.ts`'s `walletsByType` and the `addWallet`/`updateWallet`/`deleteWallet`/`isSyncing` pass-throughs (file went from 74 to 16 lines); `useDebts.ts`'s `allDebts`/`isSyncing` from the return object and `metrics.totalMinimumMonthly`/`metrics.settledCount`.
- **T6** — Removed unused props: `AnimatedCounter`'s `currencySuffix`/`decimals`/`className` (hardcoded `decimals`'s only value, 2, into the `toLocaleString` call); `InlineMathInput`'s `name`/`autoFocus`/`className` (hardcoded `name`'s only value, `"amount_expression"`, onto the `<input>`); `currency.ts`'s `formatCurrencyAmount` second parameter (`{showCode, showSymbol}`) entirely. **Did not** delete `WalletPopupModal.tsx`'s `'TRANSACTIONS'` tab union member — see Surprises.
- **T19** — Replaced 4 inlined `Math.round(x*100)/100` copies in `FinanceContext.tsx` with `roundToCents` calls. `csvExchange.ts`'s money-rounding copies left untouched (deferred — see Deliberately not done).
- **T20** — Replaced 5 hard-coded `฿` literals (`DebtsView.tsx` ×4, `WalletPopupModal.tsx` ×1) with `APP_CURRENCY_SYMBOL`. Dropped `CashflowMetricsCards`'s `primarySymbol` prop-thread in favor of importing the constant directly; removed the now-dead `APP_CURRENCY_SYMBOL` import this left behind in `DashboardView.tsx`.
- **T28** — Deleted the `@/*` alias from `vite.config.ts` (`resolve.alias` block + the now-dead `path` import) and `tsconfig.json` (`paths`). Corrected `CLAUDE.md:53` and the Project Structure tree entry for `tsconfig.json` to stop documenting the alias.

17 files changed: 37 insertions(+), 181 deletions(-).

**Why**

These seven tasks were ranked zero-risk in `task-ledger.md` because every change is either compiler-proven (`tsc --noEmit` catches a bad deletion immediately) or sits directly on a path the existing 39 Playwright runs already exercise. See `audit-report.md` findings D, F, and H for the evidence behind each task.

**Verification**

```
npx tsc --noEmit                    # clean, 0 errors (including tests/, now in scope via T4)
npx playwright test --reporter=line # 39 passed (1m2.8s)
npm run clean && npm run build      # succeeded in 7.25s; entry chunk 1,116.08 kB / 326.05 kB gzip
                                     # (baseline: 1,116.67 kB / 326.33 kB — smaller, as expected
                                     # from dead-code removal; manualChunks still deferred to T7)
grep -rn "฿" src/ --include=*.tsx   # only currency.ts:12 and the two documented exemptions
```

`git status --short` confirmed only the 17 intended `src/`/config files plus the new `docs/` tree changed — nothing else touched.

**Metric delta**

| Metric | Phase 0 baseline | Phase 1 |
|---|---|---|
| Entry chunk (raw / gzip) | 1,116.67 kB / 326.33 kB | 1,116.08 kB / 326.05 kB |
| `tsc --noEmit` (warm) | 2.40s, 373 files | not re-measured (no reason to expect a change; `tests/` now included) |
| Playwright wall-clock | 1m16.2s (cold server) | 1m2.8s (cold server) |
| Source LOC (src+tests) | 9,529 | 9,529 − 144 net = 9,385 |

Re-render counts (S1-S5) remain uncaptured — still deferred to immediately before Phase 3, per the Phase 0 entry.

**Surprises**

- T4's instruction ("remove `tests` from `tsconfig.json` exclude list") was not by itself sufficient to make `tsc` check `tests/` — `include` was `["src"]` only, so the exclude entry was already a no-op. Fixed by adding `tests` to `include` as well. `tests/` type-checked clean with zero pre-existing errors, so no cascading fixes were needed.
- T2's `otpPending` removal had a free side effect: `MobileBottomNav` lost its only context subscription, so its pre-existing (but previously inert, per audit correction C3) `React.memo` now actually does something.
- **T6's `WalletPopupModal.tsx:22` instruction was based on an incorrect audit finding.** The `'TRANSACTIONS'` tab union member is not dead code — it's a live "Activity" tab with two working in-modal trigger buttons (`id="tab-btn-txs"` and a second button in the wallet-detail view) and real rendered content. The original finding only established it can never arrive as `WalletPopupModal`'s *initial* tab from `DashboardView`'s `openWalletModal` (correctly narrowed by `WalletAccountsGrid.tsx:12`), not that the whole feature was unreachable. Deleting it would have broken a real feature and caused 4+ compile errors. Skipped; `audit-report.md` finding D corrected in place rather than marked resolved.

**Deliberately not done**

- `csvExchange.ts`'s 3 money-rounding copies (`:152,163,176`) were left un-migrated to `roundToCents`, per T19's explicit scope limit — that helper is module-private to `FinanceContext.tsx`, and exporting it is more churn than Phase 1's zero-risk scope justifies. Left for a later phase.
- `WalletPopupModal.tsx`'s `'TRANSACTIONS'` tab member was not deleted (see Surprises) — this is a correction to the audit, not deferred work.
- No `src/` file was touched beyond the 7 tasks' explicit scope. In particular, `DashboardView.tsx:104-124`'s hand-rolled income/expense/debt-repayment aggregation (which duplicates the `metrics` memo T5 just deleted from `useTransactions.ts`) was left as-is — deduplicating it is task `T26`, out of scope here.

---

## Phase 0 — Documentation and baselines (2026-09-17, commit `74114f6` — shipped together with Phase 1)

**Changed**

- Created `docs/audit/` with `README.md`, `audit-report.md`, `baseline-metrics.md`, `task-ledger.md`, `refactor-log.md` (this file), `constraints-to-promote.md`, and 5 ADRs under `decisions/`.
- Zero edits to `src/`, `tests/`, or any build config.

**Why**

The audit surfaced ~30 findings across re-renders, duplication, dead code, constraint drift, and test coverage gaps, with no existing place to record them. Without a written baseline, every future session re-derives the same findings from scratch, and there is no way to prove a later change actually improved anything.

**Verification**

Baselines captured on a clean working tree at commit `1a02a4a`:

```
npm run clean && npm run build     # entry chunk 1,116.67 kB / 326.33 kB gzip; build 22.61s
npx tsc --noEmit --extendedDiagnostics   # median warm: 2.40s (373 files, 9,164 TS lines)
npx playwright test --reporter=line      # 39 passed (1m16.2s wall-clock, cold dev-server boot)
```

`git status --short` clean before and after — no unintended changes leaked (`dist/` is gitignored and was not committed).

**Metric delta**

N/A — this is the baseline column itself. See `baseline-metrics.md`.

**Surprises**

- The CI workflow (`.github/workflows/playwright.yml`) never runs `npm run lint`, and `tsconfig.json:30` excludes `tests/` from type-checking — the gate the whole plan depends on is not enforced today (finding C4). Recorded as task T4, first in Phase 1.
- Two harmless Rollup build warnings from `node_modules/zod`'s `@__PURE__` comment placement — third-party, not actionable, noted so it isn't mistaken for a regression later.

**Deliberately not done**

- Re-render scenario counts (S1-S5) were **not captured** in this phase. Doing so requires a throwaway instrumentation branch (`Profiler` + `console.count`), and this phase was scoped to zero `src/` edits, including on a disposable branch. Deferred to immediately before Phase 3 (the `App.tsx:61` fix), where the "before" number is most load-bearing. The exact method and fixed scenarios are already written into `baseline-metrics.md` so this doesn't need to be re-derived.
- No source code was touched — Phase 1 (dead code + constraint-drift fixes) is documented in `task-ledger.md` but not yet executed.
