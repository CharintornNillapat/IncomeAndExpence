# Baseline metrics

Numbers are never rewritten — a regression must stay visible in its own column. Each phase appends one column after its verification gate passes, using the identical commands and scenarios listed here.

**Environment:** Windows 11, Node v24.19.0, npm 11.17.0, Vite 6.4.3, Playwright 1.63.0. Captured 2026-09-17 at commit `1a02a4a`, clean working tree, `node_modules` already installed.

**Final closeout column** ("Phase 29 closeout") captured 2026-09-19 at commit `91687df` (Phase 28's tip, the last `src/` change of the roadmap), same environment, same reproduction commands, clean working tree.

## How to reproduce

```powershell
# Bundle size per chunk — always regenerate; do not read a stale dist/
npm run clean
npm run build

# Type-check time — run 3x, discard the cold first run, record median of the rest
npx tsc --noEmit --extendedDiagnostics

# Playwright wall-clock — playwright.config.ts:68 sets reuseExistingServer: !CI,
# so the number below includes a fresh `npm run dev` boot (no server was
# pre-running for this baseline). A run against an already-warm dev server
# will read faster; note which case applies when comparing later columns.
npx playwright test --reporter=line

# Source size
find src tests -type f \( -name '*.ts' -o -name '*.tsx' \) | xargs wc -l | tail -1
find src -type f \( -name '*.ts' -o -name '*.tsx' \) | xargs wc -l | sort -rn | head -13
```

## Bundle size per chunk

| Chunk | Raw | Gzip |
|---|---|---|
| `index-DaRil9Rj.js` (entry) | 1,116.67 kB | 326.33 kB |
| `DashboardView-*.js` | 47.09 kB | 9.91 kB |
| `TransactionsView-*.js` | 27.50 kB | 7.00 kB |
| `csvExchange-*.js` | 22.35 kB | 8.51 kB |
| `SecurityView-*.js` | 19.11 kB | 4.09 kB |
| `DiaryView-*.js` | 17.92 kB | 4.86 kB |
| `DebtsView-*.js` | 17.45 kB | 3.83 kB |
| `KeywordRulesView-*.js` | 8.34 kB | 2.29 kB |
| `walletIcons-*.js` | 8.26 kB | 3.03 kB |
| `WalletsView-*.js` | 7.53 kB | 1.96 kB |
| `workbox-window.prod.es5-*.js` | 5.75 kB | 2.36 kB |
| CSS (`index-DhReYCw7.css`) | 75.81 kB | 11.60 kB |
| 7 icon micro-chunks (plus, arrow-up-right, arrow-down-left, credit-card, trash-2, landmark, receipt, useDebts) | 0.33–0.92 kB each | — |
| PWA precache | 28 entries | 1,501.19 KiB |

Vite's own warning, verbatim: *"(!) Some chunks are larger than 500 kB after minification. Consider: Using dynamic import() ... Use build.rollupOptions.output.manualChunks ..."* — this is the target for task T7.

Build time: 22.61s. Two harmless Rollup warnings about `@__PURE__` comment placement in `node_modules/zod` — third-party, not actionable.

### After T7 (`manualChunks`)

Same command (`npm run clean && npm run build`), captured after adding `build.rollupOptions.output.manualChunks` to `vite.config.ts`. The entry chunk collapsed from 1,116.36 kB (the Phase-2 figure, itself ~unchanged from the Phase 0 baseline) to 165.39 kB — an 85% reduction — with the removed weight moved into 5 new vendor chunks:

| Chunk | Raw | Gzip |
|---|---|---|
| `index-*.js` (entry, post-T7) | 165.39 kB | 45.72 kB |
| `vendor-math-*.js` (`mathjs/number`) | 375.73 kB | 110.72 kB |
| `vendor-supabase-*.js` (`@supabase/supabase-js` + sub-packages) | 226.44 kB | 58.66 kB |
| `vendor-react-*.js` (`react` + `react-dom` + `scheduler`) | 194.33 kB | 60.68 kB |
| `vendor-motion-*.js` (`framer-motion` + `motion-dom`/`motion-utils`/`tslib`) | 136.71 kB | 45.33 kB |
| `vendor-icons-*.js` (`lucide-react`) | 25.98 kB | 5.63 kB |
| `DashboardView-*.js` | 44.59 kB | 9.06 kB |
| `TransactionsView-*.js` | 25.73 kB | 6.39 kB |
| `csvExchange-*.js` | 22.02 kB | 8.31 kB |
| `SecurityView-*.js` | 17.11 kB | 3.55 kB |
| `DebtsView-*.js` | 17.09 kB | 3.59 kB |
| `DiaryView-*.js` | 16.46 kB | 4.41 kB |
| `KeywordRulesView-*.js` | 8.02 kB | 2.08 kB |
| `walletIcons-*.js` | 7.03 kB | 2.58 kB |
| `WalletsView-*.js` | 7.60 kB | 1.98 kB |
| `workbox-window.prod.es5-*.js` | 5.75 kB | 2.36 kB |
| `useDebts-*.js` | 0.83 kB | — |

The 7 icon micro-chunks that existed pre-T7 (`plus`, `arrow-up-right`, `arrow-down-left`, `credit-card`, `trash-2`, `landmark`, `receipt`) are gone — those were Rollup's own default splitting for `lucide-react` modules shared by 2+ lazy chunks; `manualChunks`'s broader `node_modules/lucide-react/` match now consolidates all of them (plus every icon used only by the entry) into the single `vendor-icons` chunk.

**Total JS bytes shipped is ~unchanged** (≈1,297 kB raw both before and after, computed by summing every `.js` chunk) — this task does not reduce what a cold, empty-cache visitor downloads in total. What it buys instead:
- **Parse/eval on the critical path drops 85%**: the entry chunk is what must be fetched, parsed, and executed before the app can paint anything; that work shrank from 1,116 kB to 165 kB.
- **Parallel fetching**: 5 vendor chunks + the entry chunk can be requested over HTTP/2 in parallel, instead of one monolithic blocking download.
- **Cache stability across deploys**: vendor code (react, framer-motion, supabase-js, mathjs, lucide-react) now lives in chunks whose content hash only changes when that dependency's version changes — an app-code-only deploy no longer invalidates ~960 kB of vendor code a returning visitor already has cached. Previously every deploy re-downloaded the entire 1.09 MB entry chunk regardless of what changed.

| Phase | Entry chunk (raw / gzip) | Build warning present? |
|---|---|---|
| **Phase 0 baseline** | 1,116.67 kB / 326.33 kB | Yes (no manualChunks) |
| **Phase 2** (T1/T3, unrelated to bundling) | 1,116.36 kB / 326.11 kB | Yes (no manualChunks) |
| **Phase 3 (T7)** | 165.39 kB / 45.72 kB | No — 5 vendor chunks + all view chunks now under 500 kB |
| **Post-T24/T26/T27 (final audit, 2026-09-19, commit `8168d10`)** | 169.08 kB / 47.39 kB | No — 5 vendor chunks + all view chunks still under 500 kB |
| **Phase 29 closeout (final, 2026-09-19, commit `91687df`)** | 176.93 kB / 49.69 kB | No — 5 vendor chunks + all view chunks still under 500 kB |

### Post-Phase-31 full chunk breakdown

Captured via `npm run clean && npm run build`, same commands as every prior column, at commit `6c5d7df` (Phase 31's tip — the last `src/` change before Phase 32's audit pass, which adds no `src/` code). This column closes a gap: Phases 30 (category dedupe + Categories & Smart Rules hub, `CategoriesView.tsx`) and 31 (dashboard visual polish, `InlineMathInput` UX, mobile-ergonomics verification, Supabase migration) both shipped `src/` changes with no metrics capture, so this is the first column since Phase 29 closeout and folds two phases' delta together rather than one.

The entry chunk grew **176.93 kB → 180.57 kB (+3.64 kB, +2.1%)** — expected: Phase 31's `InlineMathInput.tsx` quick-amount chips and dashboard `tabular-nums` polish (`T57`/`T58`) are entry-tree changes, not new code paths. `vendor-icons` grew **25.89 kB → 28.06 kB (+2.17 kB)** from the Categories & Smart Rules hub's additional icon usage. A new `CategoriesView-*.js` lazy chunk (13.07 kB / 3.43 kB gzip) did not exist in the Phase 29 column — it is the Phase 30 feature build. No chunk crosses Vite's 500 kB warning threshold; the build emits 0 chunk-size warnings, same as every column since Phase 3.

| Chunk | Raw | Gzip |
|---|---|---|
| `index-*.js` (entry) | 180.57 kB | 50.46 kB |
| `vendor-math-*.js` (`mathjs/number`) | 375.73 kB | 110.72 kB |
| `vendor-supabase-*.js` (`@supabase/supabase-js` + sub-packages) | 226.44 kB | 58.66 kB |
| `vendor-react-*.js` (`react` + `react-dom` + `scheduler`) | 194.33 kB | 60.68 kB |
| `vendor-motion-*.js` (`framer-motion` + `motion-dom`/`motion-utils`/`tslib`) | 136.71 kB | 45.33 kB |
| `vendor-icons-*.js` (`lucide-react`) | 28.06 kB | 6.14 kB |
| `DashboardView-*.js` | 42.22 kB | 8.98 kB |
| `csvExchange-*.js` | 22.02 kB | 8.31 kB |
| `TransactionsView-*.js` | 21.68 kB | 5.90 kB |
| `DiaryView-*.js` | 15.75 kB | 4.49 kB |
| `SecurityView-*.js` | 15.24 kB | 3.53 kB |
| `CategoriesView-*.js` (new, Phase 30) | 13.07 kB | 3.43 kB |
| `DebtsView-*.js` | 9.24 kB | 2.90 kB |
| `workbox-window.prod.es5-*.js` | 5.75 kB | 2.36 kB |
| `WalletsView-*.js` | 4.62 kB | 1.73 kB |
| `TxCells-*.js` | 1.99 kB | 0.90 kB |
| `ConfirmDialog-*.js` | 1.61 kB | 0.73 kB |
| `ProgressMeter-*.js` | 1.33 kB | 0.70 kB |
| `Badge-*.js` | 1.19 kB | 0.57 kB |
| `SectionHeader-*.js` | 0.82 kB | 0.48 kB |
| `EmptyState-*.js` | 0.54 kB | 0.32 kB |
| `walletIcons-*.js` | 0.23 kB | 0.19 kB |
| CSS (`index-*.css`) | 77.22 kB | 11.87 kB |
| PWA precache | 31 entries | 1,500.00 KiB |

**`KeywordRulesView` is gone from this column** — Phase 30's Categories & Smart Rules hub folded the standalone keyword-rules view into `CategoriesView`, so its 7.03 kB chunk no longer exists as a separate entry; that surface area now lives inside the new `CategoriesView-*.js` chunk above.

Verified via the standard audit sequence: `npm run build` emits 0 chunk-size warnings, build succeeds in 20.49s. (Full `CI=true npx playwright test` and `npm run lint` re-verified as part of this phase's own gate — see `task-ledger.md` Phase 32.)

### Phase 29 closeout — final full chunk breakdown

Captured via `npm run clean && npm run build`, same commands as every prior column, at commit `91687df` (Phase 28's tip — the last `src/` change before this closeout phase, which adds no `src/` code). The entry chunk grew **169.08 kB → 176.93 kB (+7.85 kB, +4.6%)** from the Post-T24/T26/T27 figure — the expected footprint of Phases 25–28's own new eagerly-loaded modules (`SectionHeader.tsx`, `Card.tsx`, `Badge.tsx`, `ProgressMeter.tsx`, `EmptyState.tsx`, `ConfirmDialog.tsx`, `SegmentedControl.tsx` are all imported from `TransactionForm`/`AuthModal`/other entry-tree components), not a regression to chase. `TxCells.tsx` — the one Phase 28 addition actually used only by lazy view chunks and `WalletPopupModal`/`DiaryEntryCard` (also entry-tree, via `App.tsx`'s unconditionally-rendered `WalletPopupModal`) — split into its own 1.99 kB/0.90 kB chunk rather than inflating the entry further. No chunk crosses Vite's 500 kB warning threshold; the build emits 0 chunk-size warnings, same as every column since Phase 3.

| Chunk | Raw | Gzip |
|---|---|---|
| `index-*.js` (entry) | 176.93 kB | 49.69 kB |
| `vendor-math-*.js` (`mathjs/number`) | 375.73 kB | 110.72 kB |
| `vendor-supabase-*.js` (`@supabase/supabase-js` + sub-packages) | 226.44 kB | 58.66 kB |
| `vendor-react-*.js` (`react` + `react-dom` + `scheduler`) | 194.33 kB | 60.68 kB |
| `vendor-motion-*.js` (`framer-motion` + `motion-dom`/`motion-utils`/`tslib`) | 136.71 kB | 45.33 kB |
| `vendor-icons-*.js` (`lucide-react`) | 25.89 kB | 5.67 kB |
| `DashboardView-*.js` | 40.97 kB | 8.86 kB |
| `TransactionsView-*.js` | 21.69 kB | 5.90 kB |
| `csvExchange-*.js` | 22.02 kB | 8.31 kB |
| `DiaryView-*.js` | 15.75 kB | 4.49 kB |
| `SecurityView-*.js` | 15.24 kB | 3.54 kB |
| `DebtsView-*.js` | 9.24 kB | 2.90 kB |
| `KeywordRulesView-*.js` | 7.03 kB | 2.10 kB |
| `workbox-window.prod.es5-*.js` | 5.75 kB | 2.36 kB |
| `WalletsView-*.js` | 4.62 kB | 1.73 kB |
| `TxCells-*.js` (new, Phase 28) | 1.99 kB | 0.90 kB |
| `ConfirmDialog-*.js` (Phase 24) | 1.61 kB | 0.73 kB |
| `ProgressMeter-*.js` (Phase 26) | 1.33 kB | 0.70 kB |
| `Badge-*.js` (Phase 26) | 1.19 kB | 0.57 kB |
| `SectionHeader-*.js` (Phase 25) | 0.82 kB | 0.48 kB |
| `EmptyState-*.js` (Phase 26) | 0.54 kB | 0.32 kB |
| `walletIcons-*.js` | 0.23 kB | 0.19 kB |
| CSS (`index-*.css`) | 75.59 kB | 11.58 kB |
| PWA precache | 31 entries | 1,485.61 KiB |

**Per-view deltas versus the Post-T24/T26/T27 column** — all further decreases from Phase 28's cell-extraction, except `DashboardView` (unchanged in shape, `SegmentedControl` adoption is a wash) and the two new views absorbing the primitives they didn't have before: `TransactionsView` 23.48 → 21.69 kB (−7.6%, `TxCells` adoption removed more inline markup than the import added), `DebtsView` 10.67 → 9.24 kB (−13.4%), `KeywordRulesView` 7.28 → 7.03 kB (−3.4%), `DashboardView` 43.67 → 40.97 kB (−6.2%, `SegmentedControl` + `TxCells`-adjacent cleanup combined), `WalletsView` 4.94 → 4.62 kB (−6.5%), `DiaryView` 16.39 → 15.75 kB (−3.9%), `SecurityView` 15.56 → 15.24 kB (−2.1%). `Card.tsx`/`SectionHeader.tsx`/`Badge.tsx`/`ProgressMeter.tsx`/`ConfirmDialog.tsx` each split into their own micro-chunk (Phases 24–26) rather than inflating every view that imports them.

Verified via the standard audit sequence: `npm run lint` clean; `CI=true npx playwright test` 87/87, 0 retries; build emits 0 chunk-size warnings.

### Post-T24/T26/T27 full chunk breakdown

Captured via `npm run clean && npm run build`, same commands as every prior column, at commit `8168d10` (the tip of the T24/T26/T27/T30 documentation-consolidation work). The entry chunk grew **165.39 kB → 169.08 kB (+3.69 kB, +2.2%)** from the Phase 3 (T7) figure — expected, not a regression to chase: `useSubmitHandler.ts`, `useIdempotencyKey.ts`, `useTransientFlash.ts`, `mapUtils.ts`, and `formStyles.ts` are new app-code modules imported by components that live in the entry chunk (`TransactionForm`, `AuthModal`, `InlineMathInput`, and the modal/hook plumbing in `App.tsx`'s eagerly-loaded tree), so their new logic necessarily lands there rather than in a vendor chunk. No chunk crosses Vite's 500 kB warning threshold; the build emits 0 chunk-size warnings, same as Phase 3.

| Chunk | Raw | Gzip |
|---|---|---|
| `index-*.js` (entry) | 169.08 kB | 47.39 kB |
| `vendor-math-*.js` (`mathjs/number`) | 375.73 kB | 110.72 kB |
| `vendor-supabase-*.js` (`@supabase/supabase-js` + sub-packages) | 226.44 kB | 58.66 kB |
| `vendor-react-*.js` (`react` + `react-dom` + `scheduler`) | 194.33 kB | 60.68 kB |
| `vendor-motion-*.js` (`framer-motion` + `motion-dom`/`motion-utils`/`tslib`) | 136.71 kB | 45.33 kB |
| `vendor-icons-*.js` (`lucide-react`) | 25.98 kB | 5.63 kB |
| `DashboardView-*.js` | 43.67 kB | 8.84 kB |
| `TransactionsView-*.js` | 23.48 kB | 6.03 kB |
| `csvExchange-*.js` | 22.02 kB | 8.31 kB |
| `DiaryView-*.js` | 16.39 kB | 4.45 kB |
| `SecurityView-*.js` | 15.56 kB | 3.52 kB |
| `DebtsView-*.js` | 10.67 kB | 3.07 kB |
| `KeywordRulesView-*.js` | 7.28 kB | 2.03 kB |
| `workbox-window.prod.es5-*.js` | 5.75 kB | 2.36 kB |
| `walletIcons-*.js` | 6.01 kB | 2.34 kB |
| `WalletsView-*.js` | 4.94 kB | 1.63 kB |
| `useDebts-*.js` | 0.90 kB | 0.48 kB |
| CSS (`index-*.css`) | 75.34 kB | 11.54 kB |
| PWA precache | 26 entries | 1,484.29 KiB |

**Per-view deltas versus the Phase 3 (T7) column, all decreases** — the T24 (shared `formStyles.ts`) and T26 (`buildLookupMap`) consolidations removed more inline duplication from these files than the new shared-module imports added back: `DebtsView` 17.09 → 10.67 kB (−37.6%), `SecurityView` 17.11 → 15.56 kB (−9.1%), `KeywordRulesView` 8.02 → 7.28 kB (−9.2%), `DiaryView` 16.46 → 16.39 kB (−0.4%), `TransactionsView` 25.73 → 23.48 kB (−8.7%), `DashboardView` 44.59 → 43.67 kB (−2.1%), `walletIcons` 7.03 → 6.01 kB (−14.5%), `WalletsView` 7.60 → 4.94 kB (−35.0%). The 5 vendor chunks and `vendor-icons`/`vendor-math`/`vendor-react`/`vendor-motion`/`vendor-supabase` are byte-identical to Phase 3 (third-party code, untouched by T24/T26/T27's app-code-only changes).

Verified via the standard audit sequence (`npm run lint` clean; `CI=true npx playwright test` 87/87, 0 retries; `npm run preview` served `index.html` at HTTP 200 with every asset reference in the page resolving to a live 200).

## Type-check time

3 runs of `npx tsc --noEmit --extendedDiagnostics`:

| Run | Total time | Files | Lines of TS | Memory |
|---|---|---|---|---|
| 1 (cold) | 3.08s | 373 | 9,164 | 271,187K |
| 2 | 2.37s | — | — | — |
| 3 | 2.44s | — | — | — |

**Median of warm runs (2, 3): 2.40s.**

| Phase | Median warm `tsc --noEmit` time | Files checked |
|---|---|---|
| **Phase 0 baseline** | 2.40s | 373 (excludes `tests/` — see finding H / C4) |
| **Phase 29 closeout (final, 2026-09-19)** | 4.15s (3 runs: 2.70s cold, 4.18s/4.11s warm; median of the 2 warm runs) | 426 (includes `tests/`, per T4; +53 files since baseline from the 15 new UI/domain modules and shared hooks Phases 8–28 added) |

The warm-run increase (2.40s → ~4.15s) tracks the file-count growth (373 → 426, +14%) plus this machine's own run-to-run variance (the 3 runs above ranged 2.70s–4.18s with no other process changes) more than any single phase's cost — no phase's own gate ever flagged a `tsc` regression in isolation. Read as "still well under 5s, still fast enough not to be a workflow complaint," not as a precise per-phase cost.

## Playwright wall-clock

```
39 passed (1.2m)
real 1m16.216s
```

Run included a fresh `npm run dev` server boot (no server was pre-warmed). All 39 runs green: 13 tests × {chromium, firefox, webkit}.

| Phase | Wall-clock | Server state | Pass count |
|---|---|---|---|
| **Phase 0 baseline** | 1m16.2s | Cold boot (fresh `npm run dev`) | 39 / 39 |
| **Phase 29 closeout (final, 2026-09-19)** | 5.5m (`CI=true`, 1 worker per `playwright.config.ts`) | Cold boot | 87 / 87, 0 retries |

Not a like-for-like comparison with the Phase 0 row: the baseline ran all 39 (then-)existing tests with Playwright's default worker parallelism; the closeout figure runs the full current 87 (`CI=true` forces `workers: 1`, serially, per `playwright.config.ts` and `CLAUDE.md`'s CI-mode note) — slower per-run by design, not a performance regression. The like-for-like number is the pass count: 39/39 → 87/87, 0 retries, across 12 spec files instead of the original 5.

## Source LOC

```
9,529 total (src + tests)
```

Top 12 files under `src/`:

| File | Lines |
|---|---|
| `src/context/FinanceContext.tsx` | 1,589 |
| `src/views/TransactionsView.tsx` | 576 |
| `src/components/WalletPopupModal.tsx` | 525 |
| `src/views/DiaryView.tsx` | 499 |
| `src/views/SecurityView.tsx` | 467 |
| `src/components/TransactionForm.tsx` | 417 |
| `src/views/DebtsView.tsx` | 377 |
| `src/components/AuthModal.tsx` | 309 |
| `src/views/DashboardView.tsx` | 294 |
| `src/App.tsx` | 254 |
| `src/components/Navbar.tsx` | 246 |
| `src/views/WalletsView.tsx` | 235 |

| Phase | Total src+tests LOC | `FinanceContext.tsx` LOC |
|---|---|---|
| **Phase 0 baseline** | 9,529 | 1,589 |
| **Phase 29 closeout (final, 2026-09-19)** | 11,261 | 1,855 |

Top 12 files under `src/`, final:

| File | Lines |
|---|---|
| `src/context/FinanceContext.tsx` | 1,855 |
| `src/views/TransactionsView.tsx` | 557 |
| `src/components/WalletPopupModal.tsx` | 475 |
| `src/components/TransactionForm.tsx` | 458 |
| `src/views/SecurityView.tsx` | 457 |
| `src/views/DiaryView.tsx` | 407 |
| `src/views/DashboardView.tsx` | 329 |
| `src/views/DebtsView.tsx` | 306 |
| `src/components/AuthModal.tsx` | 276 |
| `src/App.tsx` | 273 |
| `src/components/wallet/WalletTransferForm.tsx` | 226 |
| `src/components/InlineMathInput.tsx` | 220 |

**Both totals grew, and that is expected, not a regression to explain away.** `FinanceContext.tsx` (1,589 → 1,855, +16.7%) grew from Phase 13's context split (more type surface, not more logic), Phase 15's `repayDebtAtomic`/idempotency plumbing, and Phase 17's realtime-sync hardening — all additive correctness/architecture work, not duplication this roadmap was trying to remove. Total `src+tests` LOC (9,529 → 11,261, +18.2%) reflects 12 new characterization spec files (Phase 7) plus every new shared primitive/hook/domain-utility module this roadmap added (`Modal`, `SectionHeader`, `Card`, `Badge`, `ProgressMeter`, `EmptyState`, `ConfirmDialog`, `SegmentedControl`, `TxCells`, `txTypeMeta`, `mapUtils`, `formStyles`, `useSubmitHandler`, `useIdempotencyKey`, `useTransientFlash`, `TransferFundsModal`, `AddWalletModal`) — each one net-negative for the specific duplicated call sites it replaced (see each phase's own "Metric delta" column in `task-ledger.md` for the per-file shrinkage), but a net-positive line count once counted as new files. The roadmap's target was duplication and re-render cost, never raw line count.

## Re-render counts (scenario replay)

**Captured 2026-09-17, after Phase 4 (T1/T3/T7/T8 already shipped on `main` at commit `1e4381e`), on a throwaway branch `benchmark/re-render-metrics` that was never merged and no longer exists.**

**What this column is and isn't:** this was captured *after* T1/T3/T8 already shipped, not before. Phase 0 deliberately kept zero `src/` edits (including on a disposable branch), and the instrumentation branch was never stood up before Phase 2/4 landed — a gap explicitly flagged in the Phase 2 and Phase 4 `refactor-log.md` entries. There is consequently **no true pre-refactor baseline to diff against**; that measurement opportunity is gone. What follows is a single **current-state** snapshot, read qualitatively (does this component re-render when its actual inputs are unchanged?) rather than as a before/after delta table. The "Phase 0 baseline" row is left as `not captured` — per this file's own rule, a column is never rewritten after the fact — and a new `Post-Phase-4` row holds the real numbers.

### Method actually used

1. Throwaway branch `benchmark/re-render-metrics`, off `main` at `1e4381e`.
2. `App.tsx`: wrapped `<MainApp />` in `<Profiler id="app" onRender={...}>`, pushing `phase` onto `window.__commits` (method (a) — true DOM-commit count, **not** inflated by StrictMode; see caveat below).
3. New file `src/_bench.ts` exporting `bump(name)`, which both calls `console.count(name)` (as originally specified) and increments `window.__rc[name]` (added for deterministic programmatic harvesting — parsing `console.count`'s printed text via `page.on('console', ...)` was the originally documented plan, but a plain counter object read via `page.evaluate()` is more reliable and equally lightweight/zero-dependency). `bump(<Name>)` was inserted as the first statement in: `MainApp`, `Navbar`, `MobileBottomNav`, `AuthModal`, `ReloadPrompt`, `QuickAddModal`, `DashboardView`, `TransactionForm`, `InlineMathInput`, `AnimatedCounter`, `WalletPopupModal`, `DiaryView`, `DiaryEntryCard`, `RecentTransactionsTable` — this doc's original target list plus `QuickAddModal`/`DiaryEntryCard` (both new components T1/T8 created, after the target list was written). `AddWalletForm`, `WalletTransferForm`, `SecurityView`, `KeywordRulesView` were instrumented in an earlier pass of this same measurement and confirmed to never fire during S1-S5 (none of the five scenarios visit the wallets/debts/security/keywords tabs), so the final pass omitted them.
4. A temporary `tests/_benchmark.spec.ts` ran all five scenarios in one continuous Chromium session (only Chromium — this measurement doesn't need cross-browser coverage), snapshotting `window.__rc`/`window.__commits.length` before and after each scenario's action and diffing.
5. **First attempt had a real flaw, caught and fixed before recording anything:** S4 typed into the diary notes field without first saving any diary entry. A fresh Playwright browser context has **zero** diary entries, so `DiaryEntryCard` showing 0 renders proved nothing — there was no card to (not) re-render. Fixed by saving one diary entry first (clicking `#save-diary-entry-btn`), asserting a card actually exists (`[id^="diary-card-"]` count > 0), *then* measuring whether editing the form re-renders that already-rendered card.
6. Ran twice with the fix in place to confirm structural findings were reproducible, not measurement noise — see Findings.
7. Working tree wiped with `git checkout -- . && git clean -fd` (nothing had been committed on the branch), switched back to `main`, deleted the branch with `git branch -D`.

**StrictMode caveat:** `main.tsx` wraps the app in `<StrictMode>`, which deliberately double-invokes component function bodies in development to surface impure renders — every `__rc` count below is inflated roughly ×2 versus a production build. `commits` (the `Profiler`'s actual DOM-commit count) is **not** inflated the same way — React only commits to the DOM once per real update regardless of StrictMode's extra render-function calls. Read `__rc` numbers as "which components rendered, and in what proportion to each other," not as literal production counts; read `commits` as the closer proxy for real work.

### Fixed scenarios (do not change these once a baseline exists — a changed scenario invalidates every prior column)

- **S1 — Cold load.** `page.goto('/')` → dashboard painted.
- **S2 — One write** (the headline number). From S1: open Quick Add → fill ฿150 + wallet + description → submit → modal closes.
- **S3 — Typing.** From S1: type 12 characters into the `TransactionForm` description field.
- **S4 — Diary keystroke.** Diary tab → save one diary entry (so the list is non-empty) → type into notes.
- **S5 — Tab cycle.** dashboard → transactions → wallets → dashboard.

| Phase | S1 | S2 | S3 | S4 | S5 |
|---|---|---|---|---|---|
| **Phase 0 baseline** | not captured | not captured | not captured | not captured | not captured |
| **Post-Phase-4** | see below | see below | see below | see below | see below |

### Results (run 2 of 2 with the S4 fix in place; run 1 was structurally identical — see Findings)

Per-component `__rc` deltas during each scenario's action (a component absent from a scenario's row rendered **zero** times during that action — that absence is itself the signal for several rows below). `commits` is the `Profiler`'s DOM-commit count for the same window.

| Component | S1 (cold load) | S2 (write) | S3 (typing, no submit) | S4 (diary keystroke) | S5 (tab cycle ×3) |
|---|---|---|---|---|---|
| `MainApp` | 2 | 4 | 4 | 0 | 6 |
| `Navbar` | 2 | 6 | 4 | 0 | 6 |
| `MobileBottomNav` | 2 | **0** | 0 | 0 | 6 |
| `AuthModal` | 2 | 4 | 4 | 0 | 6 |
| `ReloadPrompt` | 2 | 4 | 4 | 0 | 6 |
| `QuickAddModal` | 2 | 6 | 4 | 0 | 6 |
| `DashboardView` | 60 | 6 | 4 | 0 | 0 (unmounted mid-cycle, see notes) |
| `RecentTransactionsTable` | 6 | 2 | 0 | 0 | 0 |
| `TransactionForm` | 42 | 20 | 40 | 0 | 0 |
| `InlineMathInput` | 32 | 24 | 40 | 0 | 0 |
| `WalletPopupModal` | 2 | 6 | 4 | 0 | 0 |
| `AnimatedCounter` | 590 (timing-dependent, see notes) | 636 (timing-dependent) | 100 (timing-dependent) | 0 | 6 |
| `DiaryView` | 0 | 0 | 0 | 34 | 0 |
| `DiaryEntryCard` | 0 | 0 | 0 | **0** | 0 |
| *sanity: cards on screen before the S4 keystroke* | — | — | — | **1** | — |
| **`commits` (Profiler)** | 52 | 69 | 32 | 17 | 3 |

### Findings

- **T1 confirmed directly: `MainApp`'s S2 delta (4) equals exactly its own open+close UI-state transitions (2 state changes × StrictMode's ×2) and nothing more.** Before T1, `MainApp` also subscribed to `useFinance()` for the write itself, which would have added a third re-render trigger on top of open/close. Post-T1, opening and closing the modal is the *only* thing that moves `MainApp` — the ledger write itself contributes zero additional `MainApp` renders.
- **T2 confirmed directly: `MobileBottomNav` shows 0 renders during S2 (the write) but 6 during S5 (the tab cycle).** Same `React.memo`'d component, two different outcomes, because its only prop that matters (`activeTab`) is unchanged during a financial write but genuinely changes on every tab transition. This is memo working exactly as intended, not by accident.
- **T8 confirmed directly, with the false-positive risk explicitly closed: `DiaryEntryCard` shows 0 renders during S4 while a real card is present on screen** (sanity row: 1 card existed before the keystroke), and `DiaryView` itself renders 34 times (≈ once per keystroke, doubled by StrictMode, for "S4 keystroke test" = 17 characters). Typing into the diary notes field re-renders the form but the **already-rendered, unrelated** entry-card row below it does zero work — the exact claim T8 made, now measured against a non-empty list rather than an accidentally-empty one.
- **New finding, not on the task ledger: `DashboardView`, `AuthModal`, `ReloadPrompt`, and `QuickAddModal` are not wrapped in `React.memo`, so they re-render on every `MainApp` render regardless of whether their own props changed** — visible in S5, where `AuthModal`/`ReloadPrompt` (which take no data derived from the active tab at all) still render exactly 6 times, once per `MainApp` render, purely because they're unmemoized children of a re-rendering parent. T1/T3 fixed *why* `MainApp` re-renders (only on its own real UI-state changes now); they didn't add memoization to what `MainApp` renders inline. This is a legitimate, cheap follow-on (`React.memo` on `AuthModal` and `ReloadPrompt` specifically — both take stable/no props) that isn't currently on `task-ledger.md`. Recommend adding it as a new low-risk candidate task in a future pass.
- **`AnimatedCounter`'s counts are not meaningfully comparable run-to-run** (236-596 across three runs for S1 alone) because it's driven by `requestAnimationFrame` ticks over a 0.8-1.4s duration, not by discrete state transitions — more simultaneously-animating instances (S1's cold load animates ~6 counters: navbar total, dashboard hero, 3 wallet cards, cashflow cards) and OS/browser frame-pacing variance both move this number. Its presence/absence per scenario is still informative; the magnitude is not.
- `DashboardView`'s S5 delta shows 0 because the tab cycle's third step returns to `dashboard`, and by the time the final snapshot is taken the view has fully **remounted** (per ADR `0005`'s deliberate `key={activeTab}` unmount/remount design) rather than "re-rendered" in the `__rc` sense — a fresh mount calls `bump()` too, but the before/after diff across an unmount+remount cycle isn't cleanly captured by this instrumentation. Treat `DashboardView`'s S5 row as inconclusive rather than as evidence of zero work — a benchmark-methodology limitation, not a code finding.
- `TransactionForm`/`InlineMathInput` in S3 (40/40 both runs, exactly) scale almost exactly 1:1 with the 18 characters typed (`pressSequentially`, doubled by StrictMode ≈ 36, plus a few mount/unmount renders ≈ 40) — expected, controlled-input behavior, not a regression. Unlike `AnimatedCounter`, these were identical across both runs, confirming they're driven by discrete keystroke events, not animation timing.
- `commits` (true DOM commits, not StrictMode-inflated) tracks the `__rc` numbers proportionally across scenarios (S1 ~52, S2 ~69, S3 ~32, S4 17, S5 3) — S5's very low commit count (3, one per tab transition) versus its relatively high `__rc` deltas (6 across several components) is the clearest illustration of the StrictMode-inflation caveat above: 3 real DOM updates, each counted twice at the function-invocation level.

**Reproducibility:** all findings above (the T1/T2/T8 confirmations and the new unmemoized-siblings finding) were identical in shape across both runs with the S4 fix in place. Only `AnimatedCounter`'s magnitude and `DashboardView`'s cold-load (S1) count varied between runs (both timing-sensitive, as noted).

### Post-T34 (`Navbar` de-subscription) — S2 delta, `Navbar` row only

**Method:** a lighter, targeted variant of the harness above, scoped to the one claim T34 makes (CLAUDE.md's "no component above view level subscribes to finance state" — `Navbar` was the one violation). Rather than the full `<Profiler>` + per-component `__rc` matrix (which required a throwaway branch that no longer exists), a single temporary counter was added directly to the top of `Navbar`'s function body — `window.__navbarFnCalls++` — incremented once per actual function-body execution (so a `React.memo` bail-out, which skips the call entirely, correctly reads as zero). The counter and its call site were never committed; both were removed before this phase's commit (`grep -rn "__navbarFnCalls" src/ tests/` returns nothing on the committed tree).

Same S2 scenario as above (open Quick Add → fill amount/wallet/description → submit → modal closes), reset immediately after cold load so only the write itself is measured:

| | `Navbar` function-body executions during S2 |
|---|---|
| **Pre-T34** (measured just now, on the pre-T34 committed `Navbar.tsx` restored via `git stash`) | 6 |
| **Post-T34** (current tree) | 0 |

The pre-T34 figure (6) matches the original Phase-4 baseline's `Navbar` S2 row exactly (see the table above), which is a useful cross-check that this lighter probe measures the same thing the original harness did, not an artifact of a different methodology. Post-T34, `Navbar` is `React.memo`'d and receives no props that change during a write, so it never re-executes — the write's effect is now confined to `NavbarSyncBadge` and `NavbarBalanceAndAuth` (the two new subscribing sub-components), which are expected and intended to re-render, being a small fraction of what `Navbar` used to render as one unmemoized whole.

**Reproduction:** `git stash push -- src/components/Navbar.tsx` to restore the pre-T34 file, add one line at the top of the function body incrementing a `window` counter, run a temporary Playwright spec that resets the counter after `page.goto('/')` and reads it after one `addQuickTransaction` call, then `git checkout -- src/components/Navbar.tsx && git stash pop` to restore and discard the probe.
