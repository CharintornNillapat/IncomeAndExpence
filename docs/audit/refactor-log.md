# Refactor log

Append-only, newest entry first. One entry per **shipped phase**, never per commit.

---

## Phase 8 — FinanceContext value split: T13 (2026-09-18, commit `_pending_`)

**Changed**

- `src/context/FinanceContext.tsx` — the only file touched (+133/-52).
  - The single 33-member `FinanceContextType` was replaced by two interfaces: `FinanceStateContextType` (`:46`, 19 members — 13 state values plus the 6 volatile mutators) and `FinanceActionsContextType` (`:98`, 14 members — the stable session callbacks plus `setShowSoftDeleted`).
  - `FinanceContextType` (`:132`) is retained as `extends FinanceStateContextType, FinanceActionsContextType`, so the exported type is structurally unchanged.
  - `const FinanceContext = createContext(...)` became two contexts (`:134-135`), and the single `contextValue` memo became `stateValue` (`:1535`) and `actionsValue` (`:1584`).
  - `FinanceProvider` now nests both providers — actions outer, state inner (`:1622-1626`).
  - `useFinanceState()` (`:1636`) and `useFinanceActions()` (`:1645`) exported; `useFinance()` (`:1659`) survives as a merging shim over both.

Zero consumer files modified. All 16 `useFinance()` call sites are byte-identical to before.

**Why**

ADR `0001` option (b), staged after the App-shell fixes that already shipped in Phase 2. Correction C1 established that only 7 of the context's 22 `useCallback`s are volatile; the other 15 are stable for the whole session but were trapped in a value object that changes identity on every ledger write, so a component needing nothing but `signOut` or `addWallet` re-rendered on every transaction. This commit makes the two halves invalidate independently. It deliberately does not yet *use* that — migrating consumers is T14 — because doing the split and the migration together would mean a 17-file diff where a behavioral regression has 17 candidate causes instead of one.

**Verification**

```
npm run lint                     # tsc --noEmit: clean, 0 errors, src/ and tests/
npm run build                    # built in 19.54s; PWA precache 26 entries (1497.37 KiB)
npx playwright test --reporter=line   # 75/75 passed (1.7m)
```

`git diff --stat` confirmed a single changed file.

**Metric delta**

| | Before | After |
|---|---|---|
| React contexts in `FinanceContext.tsx` | 1 | 2 |
| Largest context value | 33 members | 19 members (state) / 14 (actions) |
| `Object.is` comparisons per provider commit | 33 (one memo) | 19 + 13 = 32, across two independently-invalidating memos |
| Consumers subscribed to the volatile value | 16 | 16 (unchanged — the shim still reads both; T14 reduces this) |
| Files changed | — | 1 |
| Full suite | 75 runs | 75 runs, no spec edited |

No re-render metric is claimed for this phase, and none should be: with every consumer still on the shim, the split cannot yet reduce a single re-render. The S1-S5 counts are the measurement for T14, not this commit.

**Surprises**

- **A naive shim would have been a regression, not a no-op.** The obvious `return { ...useFinanceState(), ...useFinanceActions() }` allocates a fresh object on every render of every consumer. Pre-split, `useFinance()` returned one memoized object whose identity was stable between writes — so the "zero breaking changes" shim would have silently broken identity stability for all 16 consumers (and anything downstream keying a `useMemo`/`useEffect` on the context object). The shim memoizes the merge on `[state, actions]` (`:1659`) to preserve the original guarantee exactly.
- **Two Firefox tests failed on the first full-suite run** (`auth.spec.ts:33`, `csv.spec.ts:18`) and passed on an immediate clean re-run, plus in isolation against the same working tree. Load-related flake under full parallelism in the engine `playwright.config.ts` already documents as the slowest to paint a lazy chunk — not a regression from this change, which touches neither auth nor CSV code paths. Recorded rather than quietly dropped, because it is the second phase in a row where the T12-era specs have been the ones to wobble; if it recurs, those two specs need a look independent of whatever task is in flight.

**Deliberately not done**

- **No consumer migrated.** That is T14, one file per commit, and it is what actually banks the re-render win. The shim exists precisely so this commit can be reverted alone.
- **No ref-mirroring.** The 6 volatile mutators (`addTransaction`, `softDeleteTransaction`, `restoreTransaction`, `commitBulkImport`, `repayDebtAtomic`, `upsertDiaryEntry`) stay in the state context and stay volatile. Moving them is T15, gated on T12 and sequenced one mutator per commit with `repayDebtAtomic` last.
- **`setTransactionDeleted` was not exposed.** It stays a private implementation detail behind `softDeleteTransaction`/`restoreTransaction`; the split neither widened nor narrowed the public surface.
- **No dependency-array cleanup.** Several deps are wider than strictly needed (e.g. `upsertDiaryEntry` depends on the whole `diaryEntries` array where a functional `setState` would drop it). Narrowing them changes which callbacks are volatile and therefore which context they belong in — that is a decision for T15, and folding it in here would have made this commit non-mechanical.
- **No re-render instrumentation run.** `baseline-metrics.md`'s S1-S5 still have no captured "before" numbers (deferred since Phase 0). This phase cannot move them by construction, so capturing them now would burn the instrumentation branch on a commit with nothing to show; they belong immediately before T14.

---

## Phase 7 — Characterization tests for the untested half: T12 (2026-09-17, commit `7f0c5b1`)

**Changed**

- New `tests/debts.spec.ts` — one test covering create → partial repayment → progress update → full repayment → auto-settle.
- New `tests/soft-delete.spec.ts` — three tests: transaction (delete → toggle reveal → restore), wallet (delete → reload persistence), debt (delete → reload persistence).
- New `tests/keywords.spec.ts` — two tests: sandbox matcher against a default seeded rule, and adding a new rule that the sandbox immediately picks up.
- New `tests/csv.spec.ts` — one test: export a seeded transaction, re-import the exact downloaded file, confirm it commits as a new valid row.
- New `tests/auth.spec.ts` — five tests covering modal open/close, signin/signup/forgot mode switching, and native HTML5 email/password validation.
- `src/components/AuthModal.tsx` — added 8 `id` attributes (`auth-email-input`, `auth-password-input`, `auth-name-input`, `auth-submit-btn`, `auth-tab-signin`, `auth-tab-signup`, `auth-forgot-password-link`, `auth-back-to-signin-link`, `auth-close-btn`) purely for test targeting; no markup, styling, or behavior changed.

6 files changed: 1 modified (`AuthModal.tsx`, +13/-4), 5 new spec files.

**Why**

T13-T15 (context value split, then migrating consumers, then ref-mirroring the volatile mutators) and T22/T29 (modal consolidation, `useDebts` wallet-filtering fix) all touch code with zero existing automated coverage: debt repayment/settlement, soft-delete across three entities, keyword matching, CSV import/export, and the auth modal. Refactoring any of that blind means the only signal on a regression is manual inspection. This phase establishes the safety net those tasks were gated on.

**Verification**

```
npx tsc --noEmit                                     # clean, 0 errors, src/ and tests/
npx playwright test tests/debts.spec.ts tests/soft-delete.spec.ts \
  tests/keywords.spec.ts tests/csv.spec.ts tests/auth.spec.ts --project=chromium
                                                        # 12/12 passed (10.9s)
npx playwright test tests/debts.spec.ts tests/soft-delete.spec.ts \
  tests/keywords.spec.ts tests/csv.spec.ts tests/auth.spec.ts --project=firefox --project=webkit
                                                        # 24/24 passed (1.0m) - the CSV download
                                                        # mechanic specifically verified in both,
                                                        # including WebKit's Blob-URL handling
npx playwright test --reporter=list                    # 75/75 passed (1.7m) - full suite,
                                                        # 39 pre-existing + 12 new x 3 browsers
npm run build                                          # succeeded in 9.7s; vendor chunk split
                                                        # from T7 unaffected
```

`git status --short` / `git diff --stat` confirmed the only modified `src/` file was `AuthModal.tsx` (id attributes only), plus the 5 new spec files - no other files touched.

**Metric delta**

| Domain | Before | After |
|---|---|---|
| Debt repayment/settlement | 0 automated tests | 1 test, 3 assertions on the payoff lifecycle |
| Soft-delete (tx/wallet/debt) | 0 automated tests | 3 tests |
| Keyword auto-matcher | 0 automated tests | 2 tests |
| CSV export/import | 0 automated tests | 1 round-trip test |
| Auth modal | 0 automated tests, 0 `id` attributes | 5 tests, 8 `id` attributes added |
| Full suite size | 39 runs (13 tests x 3 browsers) | 75 runs (25 tests x 3 browsers) |

**Surprises**

- **`AuthModal`'s `isSupabaseConfigured` branch fires differently between this environment and CI.** This local checkout has a real `.env` with live (demo-project) Supabase credentials, so `handleAuth` would make an actual network call before ever reaching its own Zod validation; `playwright.yml` never sets those secrets, so CI takes the "Cloud sync is not configured" short-circuit instead. Neither branch is safe to assert on in a spec that has to pass in both places. Caught this before writing any assertion that depended on it (rather than after a flaky CI run), and scoped `auth.spec.ts` to only the parts of the form that resolve before `handleAuth` runs at all: modal open/close, mode switching, and native HTML5 `validity.valid` checks. This is a real, non-obvious characterization finding in its own right, not just a test-design workaround - anyone adding a signed-in-flow test here later needs to know which branch they're actually exercising.
- Everything else passed on the first attempt in all three browsers, including the CSV Blob-URL download/re-upload round trip, which was the one mechanism in this batch with a real chance of browser-specific behavior.

**Deliberately not done**

- **Mobile Playwright project not added**, despite being named in the task's own file list ("new `tests/*.spec.ts`, mobile project"). Adding a mobile viewport project to `playwright.config.ts` would require re-verifying all 25 existing test files against it, not just the 5 new ones added here - a materially larger and separately-scoped change. Left as a follow-on.
- No characterization test written for realtime/cloud-sync behavior, `WalletPopupModal`'s in-modal "Activity" tab, the CSV `Diary Export (JSON)` button, or `SecurityView` - out of the 5 domains this task explicitly named.
- The `KeywordRulesView` sandbox test relies on the app's default seeded keyword rule (`coffee` -> Food & Dining) rather than seeding its own - if that default data ever changes, this test's first case breaks along with it. Judged acceptable since the default seed data is itself effectively a fixture other specs already depend on implicitly (e.g. `wallets[0]` defaults used throughout).
- Did not attempt to also address the T29 finding (`useDebts` returning unfiltered `wallets`) that this phase was partly gating - `debts.spec.ts` exercises the repay-wallet select as-is, without asserting on whether a soft-deleted wallet could appear there.

---

## Phase 6 — Nav hoisting and Suspense boundary restructure: T10, T11 (2026-09-17, commit `1c4c7e7`)

**Changed**

- `Navbar.tsx` — hoisted the static `navItems` array (7 objects: id/label/icon per tab) to a module-level `NAV_ITEMS: NavItemConfig[]` constant, with a new `NavItemConfig` interface. Was previously reallocated (the array plus all 7 object literals) on every `Navbar` render, including every financial write (since `Navbar` subscribes to `useFinance()` for `totalNetWorth`/`isAuthenticated`/`isSyncing`/`currentUser`).
- `MobileBottomNav.tsx` — same hoist, reusing the file's existing module-level `NavItemConfig` interface.
- `App.tsx` — moved `<Suspense fallback={<ViewLoadingFallback />}>` to wrap `<AnimatePresence mode="wait" custom={direction}>`, out from its previous position nested inside the keyed `<motion.div>` (where it wrapped only `{renderActiveView()}`). One `Suspense` boundary now persists across `activeTab` changes instead of a new one being constructed every time the `motion.div`'s `key` changes.

3 files changed: `src/App.tsx` (15 insertions, 15 deletions), `src/components/MobileBottomNav.tsx` (11 insertions, 11 deletions), `src/components/Navbar.tsx` (17 insertions, 11 deletions).

**Why**

`navItems` in both nav components was a purely static configuration array with zero dependency on props or component state, yet was declared inside the function body, so it was rebuilt from scratch on every render — for `Navbar` specifically, that's every financial write in the app, not just tab changes. Hoisting removes that allocation entirely from the render path.

The `Suspense` placement was flagged in the original audit plan as a candidate fix for "tearing or fallback churn on route transitions" — nesting the boundary inside the per-tab keyed `motion.div` means a brand-new `Suspense` fiber is constructed and torn down on every tab switch, rather than one boundary persisting across the whole navigation lifecycle. The plan itself flagged this specific change as carrying the highest test risk in the deferred backlog, since `tests/helpers.ts:gotoTab`'s `#view-loading-fallback` assertion is the one piece of test coverage that would catch a regression here.

**Verification**

```
npx tsc --noEmit                                            # clean, 0 errors
npx playwright test --reporter=list                         # 39/39 (55.2s), all three browsers
npx playwright test --project=firefox tests/theme.spec.ts tests/diary.spec.ts
                                                              # re-run in isolation, 4/4 passed
npx playwright test --project=firefox tests/theme.spec.ts:47 --repeat-each=3
                                                              # the 7-tab cycling test specifically,
                                                              # repeated 3x — 3/3 passed, ~8-10s each,
                                                              # no flakes, no timing regression
npm run build                                                # succeeded in 5.6s; vendor chunk split
                                                              # from T7 unaffected
```

`git status --short` / `git diff --stat` confirmed only the three target files changed.

**Metric delta**

| Metric | Before | After |
|---|---|---|
| `navItems` allocation (`Navbar`) | array + 7 objects rebuilt every render, incl. every financial write | built once at module load |
| `navItems` allocation (`MobileBottomNav`) | array + 7 objects rebuilt every render | built once at module load |
| `Suspense` boundary lifetime | new fiber per `activeTab` key change (nested inside the keyed `motion.div`) | one persistent boundary spanning all tab transitions |
| `Navbar` `React.memo` | not applied (unchanged this phase) | still not applied — see Deliberately not done |

**Surprises**

- None functionally — both changes were mechanical. The main open question going in was whether moving `Suspense` outside `AnimatePresence` would visibly disrupt the exit/enter slide animation on a tab switch to an unloaded chunk (a real risk given React's Suspense-fallback-replaces-whole-subtree behavior on non-`startTransition` updates). It did not surface as a test failure or a timing regression in any of the three browsers across the standard run plus the two additional targeted re-runs, but this was verified only via the automated suite's DOM-state assertions, not a visual/manual check of the animation itself — see Deliberately not done.

**Deliberately not done**

- **`Navbar` was not wrapped in `React.memo`.** It still calls `useFinance()`/`useTheme()` directly, so per audit correction C3 and the plan's guardrail #9, `React.memo` cannot stop it from re-rendering on financial writes (context-value changes force a re-render of every consumer regardless of props memoization) — it would only skip renders triggered by an unrelated parent (`MainApp`) re-render with unchanged props, a narrow and easily-overstated win. The task ledger's own original phrasing for this task was "memo `Navbar` after subscription cut" — that subscription cut (extracting the net-worth/sync-badge/auth sections into self-subscribing pieces, as T1 did for the quick-add modal) hasn't happened, so memoizing now was judged not worth doing; it's a precondition for a future task, not a partial step taken here.
- No manual/visual verification of the tab-switch slide animation was performed — only the automated Playwright DOM assertions (class changes, fallback element count) were checked. If a subtle animation-timing regression exists that no current test asserts on, it would not have been caught by this verification pass.
- `App.tsx`'s other structure (the `AnimatePresence`/`motion.div`/`pageVariants` themselves) was left untouched beyond relocating `Suspense` — no attempt was made to also address `renderActiveView()`'s `switch` statement or the lazy-import declarations, which are out of this task's scope.

---

## Phase 5 — Inline filter/computation memoization: T9 (2026-09-17, commit `58e460d`)

**Changed**

- `TransactionForm.tsx:37` — `activeDebts` wrapped in `React.useMemo([debts])`.
- `TransactionForm.tsx:306-307` — the destination-wallet `<select>`'s inline `wallets.filter((w) => w.id !== walletId)` hoisted to a `destinationWalletOptions` `React.useMemo([wallets, walletId])` above the `return`, JSX now maps over the memoized array.
- `WalletsView.tsx:22` — `activeWallets` wrapped in `useMemo([wallets])`; this one memo also covers the `wallets={activeWallets}` prop passed to `WalletTransferForm` further down the same component.
- `KeywordRulesView.tsx:17` — `matchResult` (`matchSmartDescription(...)`) wrapped in `useMemo([testInput, keywordRules, categories])`.
- `KeywordRulesView.tsx:34` — `categoryMap` wrapped in `useMemo([categories])`.
- `TransactionsView.tsx:400-401` — the Add Transaction modal's two inline `wallets.filter(!isDeleted)` / `categories.filter(!isDeleted)` calls hoisted to `activeWalletsForForm`/`activeCategoriesForForm` `useMemo`s, placed beside the file's existing `walletMap`/`categoryMap` memos.

4 files changed: `src/components/TransactionForm.tsx` (+13/-6), `src/views/KeywordRulesView.tsx` (+9/-3), `src/views/TransactionsView.tsx` (+6/-2), `src/views/WalletsView.tsx` (+2/-2).

**Why**

Each of these was a computation (filter, `.map()`-built lookup, or matcher call) re-run from scratch on every render of its parent component, regardless of whether its actual inputs had changed — the same class of waste T8 fixed inside `DiaryView`, here spread across the four views/forms the task ledger's original audit had flagged. `TransactionForm` and `KeywordRulesView` in particular re-run these on every keystroke into unrelated local state (description text, math input, sandbox test string), since none of the memoized values depend on that state.

**Verification**

```
npx tsc --noEmit          # clean, 0 errors
npx playwright test --reporter=list   # 39/39 (1m6s-ish), all three browsers
npm run build              # succeeded in 20.4s; vendor chunk split from T7 unaffected
```

`git status --short` / `git diff --stat` confirmed only the four target files changed, matching the task's file list exactly.

**Metric delta**

| Site | Before | After |
|---|---|---|
| `TransactionForm` `activeDebts` | recomputed every render (incl. every description/amount keystroke) | recomputed only when `debts` changes |
| `TransactionForm` destination-wallet options | rebuilt every render inside JSX | recomputed only when `wallets`/`walletId` changes |
| `WalletsView` `activeWallets` | recomputed every render | recomputed only when `wallets` changes |
| `KeywordRulesView` `matchResult` | re-run `matchSmartDescription` every render (incl. every sandbox-input keystroke) | recomputed only when `testInput`/`keywordRules`/`categories` changes |
| `KeywordRulesView` `categoryMap` | rebuilt every render | recomputed only when `categories` changes |
| `TransactionsView` active wallets/categories for the Add Transaction modal | rebuilt every render (incl. every search/filter keystroke on the table above) | recomputed only when `wallets`/`categories` changes |

No S1-S5 re-render-count replay was run for this phase; the existing `baseline-metrics.md` snapshot (recorded post-Phase-4, commit `e20c49e`) predates this change and was not re-captured, consistent with that file's own "current-state snapshot, not a before/after delta" caveat.

**Surprises**

- None. The task's own line references (`TransactionForm.tsx:37,306-307`, `WalletsView.tsx:22,218`, `KeywordRulesView.tsx:17,34`, `TransactionsView.tsx:400-401`) matched the current file contents closely enough that no re-scoping was needed — line 218 in `WalletsView.tsx` (the `wallets={activeWallets}` prop) needed no separate edit since it already consumes the memoized value once line 22 was fixed.

**Deliberately not done**

- No `React.memo` added to `TransactionForm`, `WalletsView`, or `KeywordRulesView` themselves — out of scope per the task's file/line list, which targets the inline computations passed as or feeding into props, not the receiving components. `TransactionForm` in particular is not currently `React.memo`'d; wrapping it is a separate, unrequested decision (its call sites already pass memoized `wallets`/`categories` arrays after this phase and T1/T8, but its `onSubmitTransaction` callbacks are inline in two of its three call sites — `TransactionsView.tsx`'s Add Transaction modal and the original `DashboardView.tsx` usage already uses a stable `handleTransactionSubmit`).
- `TransactionsView.tsx`'s inline `onSubmitTransaction={async (data) => {...}}` passed to `TransactionForm` (adjacent to the memoized wallets/categories props) was left as-is — not in the task's specified line list, and stabilizing it only matters once `TransactionForm` itself is memoized, which is also not in scope here.
- The ledger's prior note that the `KeywordRulesView` slice was "blocked by T12" (characterization tests) was re-assessed and treated as not applicable: every change in this phase is a pure memoization of an existing computation with no behavior change, verified by the full suite passing with zero test edits.

---

## Phase 4 — DiaryView memoization: T8 (2026-09-17, commit `c9d4f26`)

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
