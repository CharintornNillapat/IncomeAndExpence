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
| **Phase 37 closeout (final, 2026-09-20, commit `24e9ee6`)** | 158.93 kB / 44.81 kB | No — 8 vendor/shared chunks + all view chunks still under 500 kB |

### Phase 37 closeout — final full chunk breakdown

Captured via `npm run clean && npm run build`, same commands as every prior column, on the second audit pass's tip (Phases 32–37, T61–T78; no `src/` change lands in T78 itself). This is the roadmap's final column.

The entry chunk **dropped** for the first time in this file's history — **180.57 kB → 158.93 kB (−21.64 kB, −12.0%)** — the net effect of Phase 36/T76 deferring `QuickAddModal`/`TransferFundsModal`/`AddWalletModal` behind `React.lazy` (each now its own small chunk: 1.15/4.10/3.15 kB) and pulling their dependency graph (`TransactionForm`, `useIdempotencyKey`, and transitively `vendor-math`) out of the entry tree along with them. `TransactionForm-*.js` (10.45 kB/3.28 kB gzip) and `useIdempotencyKey-*.js` (6.99 kB/2.43 kB gzip) are new standalone chunks that previously lived inside the entry; `vendor-math` (110.72 kB gzip) is no longer reachable from any eagerly-loaded module at all — see Phase 36's `refactor-log.md` entry for the network-level proof. `csvExchange-*.js` no longer exists as its own chunk — T77 split `exportDiaryToJson` into `diaryExport.ts` and Rollup folded the remaining `csvExchange.ts` (now single-consumer, `TransactionsView`) directly into `TransactionsView-*.js`, which grew accordingly (21.68 → 43.56 kB).

| Chunk | Raw | Gzip |
|---|---|---|
| `index-*.js` (entry) | 158.93 kB | 44.81 kB |
| `vendor-math-*.js` (`mathjs/number`, no longer on the critical path — see Phase 36) | 375.73 kB | 110.72 kB |
| `vendor-supabase-*.js` (`@supabase/supabase-js` + sub-packages) | 226.44 kB | 58.66 kB |
| `vendor-react-*.js` (`react` + `react-dom` + `scheduler`) | 194.33 kB | 60.68 kB |
| `vendor-motion-*.js` (`framer-motion` + `motion-dom`/`motion-utils`/`tslib`) | 136.71 kB | 45.33 kB |
| `vendor-icons-*.js` (`lucide-react`) | 28.06 kB | 6.14 kB |
| `TransactionsView-*.js` (absorbed `csvExchange.ts`, Phase 36/T77) | 43.56 kB | 13.93 kB |
| `DashboardView-*.js` | 42.44 kB | 9.06 kB |
| `DiaryView-*.js` | 15.85 kB | 4.53 kB |
| `SecurityView-*.js` | 15.30 kB | 3.56 kB |
| `CategoriesView-*.js` | 13.15 kB | 3.47 kB |
| `TransactionForm-*.js` (new — left the entry tree, Phase 36/T76) | 10.45 kB | 3.28 kB |
| `DebtsView-*.js` | 9.63 kB | 3.07 kB |
| `useIdempotencyKey-*.js` (new — left the entry tree, Phase 36/T76) | 6.99 kB | 2.43 kB |
| `workbox-window.prod.es5-*.js` | 5.75 kB | 2.36 kB |
| `WalletsView-*.js` | 4.77 kB | 1.78 kB |
| `TransferFundsModal-*.js` (new lazy chunk, Phase 36/T76) | 4.10 kB | 1.76 kB |
| `AddWalletModal-*.js` (new lazy chunk, Phase 36/T76) | 3.15 kB | 1.45 kB |
| `TxCells-*.js` | 1.99 kB | 0.90 kB |
| `ConfirmDialog-*.js` | 1.72 kB | 0.76 kB |
| `Badge-*.js` | 1.19 kB | 0.57 kB |
| `ProgressMeter-*.js` | 1.16 kB | 0.64 kB |
| `QuickAddModal-*.js` (new lazy chunk, Phase 36/T76) | 1.15 kB | 0.65 kB |
| `SectionHeader-*.js` | 0.82 kB | 0.48 kB |
| `diaryExport-*.js` (new, Phase 36/T77 — split off `csvExchange.ts`) | 0.68 kB | 0.45 kB |
| `smartMatcher-*.js` | 0.56 kB | 0.39 kB |
| `EmptyState-*.js` | 0.54 kB | 0.32 kB |
| `useSubmitHandler-*.js` | 0.46 kB | 0.33 kB |
| `useTransientFlash-*.js` | 0.43 kB | 0.26 kB |
| `useWallets-*.js` | 0.24 kB | 0.19 kB |
| `walletIcons-*.js` | 0.23 kB | 0.19 kB |
| `mapUtils-*.js` | 0.07 kB | 0.09 kB |
| CSS (`index-*.css`) | 77.25 kB | 11.87 kB |
| PWA precache | 41 entries | 1,507.21 KiB |

**Whole-roadmap delta, Phase 0 baseline → Phase 37 closeout:** entry chunk **1,116.67 kB → 158.93 kB (−85.8% raw), 326.33 kB → 44.81 kB gzip (−86.3%)**. The two passes attacked different costs — the first (Phases 1–29) split vendor code out of a single monolithic bundle and eliminated render-storm/duplication issues; the second (Phases 32–36) fixed 2 money-affecting correctness bugs no test had caught, hardened 9 more write paths to the same rollback standard, removed the single largest remaining per-frame render cost (`AnimatedCounter`), and took the single largest vendor chunk (`vendor-math`, 110.72 kB gzip) off the critical path entirely.

Verified via the standard audit sequence: `npm run lint` clean; `npm run build` emits 0 chunk-size warnings, build succeeds in 6.22s. (Full `CI=true npx playwright test` re-verified as part of this phase's own gate — see `task-ledger.md` Phase 37.)

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


## Phase 39 (Jev classification) — bundle delta, measured against a rebuild of HEAD

**Why this is a section and not a column.** The entry-chunk figure carried forward in `refactor-log.md` Phase 36 (158.93 kB raw / 44.81 kB gzip) no longer describes HEAD: Phases 37–38 and the presets feature added app code, and HEAD now builds at **161.53 kB / 45.37 kB**. Differencing this phase against the documented number would have invented a +2.60 kB regression that this phase did not cause. So the baseline was re-measured directly instead.

**Method.** `git stash push -u` the entire phase → `npm run clean && npm run build` → record → `git stash pop` → rebuild. Same machine, same Node (v24.19.0), same `node_modules`, clean tree both times, no dev server running.

| Chunk | HEAD (stashed) | Phase 39 | Delta |
|---|---|---|---|
| entry `index-*.js` | 161.53 kB / 45.37 kB gzip | **161.53 kB / 45.37 kB gzip** | **0 / 0** |
| `TransactionForm-*.js` (lazy) | 13.07 kB / 3.90 kB gzip | 17.65 kB / 5.53 kB gzip | +4.58 kB / +1.63 kB |
| `vendor-math-*.js` | 375.73 kB / 110.72 kB gzip | 375.73 kB / 110.72 kB gzip | 0 / 0 |
| vendor chunk count | 5 | 5 | 0 |
| build time | 5.23 s | 17.75 s | *(cold cache after `clean`; not comparable)* |

**Findings**

- **The entry chunk is byte-identical.** Every byte of new client code (`jevClassifier.ts`, `useDescriptionClassifier.ts`, `CategorySuggestionChip.tsx`, the `TransactionForm` wiring) landed in the lazy `TransactionForm` chunk, confirmed by `grep -l '/api/classify' dist/assets/*.js` returning only `TransactionForm-*.js`. This is ADR `0010`'s deferral doing its job: `TransactionForm` is reachable only through `QuickAddModal`/`TransactionsView`/`DebtsView`, all behind `React.lazy`.
- **`api/classify.ts` contributes zero bytes to the client**, because it never enters the Vite module graph — it is built by Vercel as a serverless function. Its only link to `src/` is an `import type`, which TypeScript erases.
- **No new vendor chunk and no new dependency.** `grep -rl 'typesafe-ai' dist/` returns nothing; `vite.config.ts`'s `manualChunks` was not touched.
- **The entry chunk references `vendor-math-*.js` in both builds.** This was checked specifically because it looks like an ADR `0010` regression and is not one — the identical reference exists in the stashed HEAD build. It is Vite's module-preload/dynamic-import map naming the chunk, not an eager import. ADR `0010`'s claim was always about requests at first paint, which this phase neither re-measured nor changed.

**Test-suite size:** 129 → **144 runs** (43 → 48 tests, 14 → 15 spec files). Wall clock `npx playwright test --workers=4`: 3.4 m → 3.5 m.

## Phase 40 (category descriptions) — bundle delta, measured against a rebuild of HEAD

Same method as the Phase 39 section: `git stash push -u` the whole phase, `npm run clean && npm run build`, record, `git stash pop`, rebuild. Same machine, Node v24.19.0, same `node_modules`, clean tree both times, no dev server running. HEAD here is `2633af7`.

| Chunk | HEAD (stashed) | Phase 40 | Delta |
|---|---|---|---|
| entry `index-*.js` | 161.53 kB / 45.37 kB gzip | **163.10 kB / 46.05 kB gzip** | **+1.57 kB / +0.68 kB** |
| `CategoriesView-*.js` (lazy) | 14.20 kB / 3.76 kB gzip | 15.15 kB / 3.94 kB gzip | +0.95 kB / +0.18 kB |
| `TransactionForm-*.js` (lazy) | 17.65 kB / 5.53 kB gzip | 17.77 kB / 5.57 kB gzip | +0.12 kB / +0.04 kB |
| `vendor-math-*.js` | 375.73 kB / 110.72 kB gzip | 375.73 kB / 110.72 kB gzip | 0 / 0 |
| vendor chunk count | 5 | 5 | 0 |
| build time | 6.77 s | 6.39 s | — (both cold after `clean`) |

**Findings**

- **This is the first phase since 36 to move the entry chunk, and it does so on purpose.** `FinanceContext.tsx` is eager, so the nine `DEFAULT_SYSTEM_CATEGORIES` descriptions land on the critical path along with `withDefaultDescriptions` and the `description` mapping in three mutators. Confirmed by `grep -l 'Netflix or Spotify' dist/assets/*.js`, which resolves only to `index-*.js`.
- **The cost was about double the pre-build estimate** (+~0.7 kB raw / +~0.3 kB gzip was predicted). Recorded as measured. The rejected alternative — a static hint map inside `api/classify.ts`, which would have cost the client zero bytes — was rejected on ownership grounds in ADR `0012`, not on size, so this is a known and accepted trade rather than an overrun.
- **Everything else stayed lazy.** `grep -l '/api/classify' dist/assets/*.js` still resolves only to `TransactionForm-*.js`; the `CategoriesView` growth is the two textareas and their state, in a `React.lazy` view chunk.
- **No new dependency and no new vendor chunk.** `grep -rl 'typesafe-ai' dist/` returns nothing and `manualChunks` is unmodified, so ADR `0010`'s `vendor-math` deferral is intact.
- **`api/classify.ts` still contributes zero client bytes.** Its only link to `src/` remains an `import type`, which TypeScript erases; Vercel builds it as a serverless function outside the Vite graph.

**Test-suite size:** 144 → **150 runs** (48 → 50 tests, 15 spec files unchanged). Wall clock `npx playwright test --workers=4`: 3.5 m → 4.1 m.

## Phase 41 (express note entry) — bundle delta, measured against a rebuild of HEAD

Same method as the Phase 39 and 40 sections: `git stash push -u` the whole phase, `npm run clean && npm run build`, record, `git stash pop`, rebuild. Same machine, Node v24.19.0, same `node_modules`, clean tree both times, no dev server running. HEAD here is `5a67726`.

| Chunk | HEAD (stashed) | Phase 41 | Delta |
|---|---|---|---|
| entry `index-*.js` | 163.10 kB / 46.05 kB gzip | **163.30 kB / 46.11 kB gzip** | **+0.20 kB / +0.06 kB** |
| `TransactionForm-*.js` (lazy) | 17.77 kB / 5.57 kB gzip | 17.90 kB / 5.84 kB gzip | +0.13 kB / +0.27 kB |
| `QuickAddModal-*.js` (lazy) | 2.53 kB / 1.19 kB gzip | 2.60 kB / 1.22 kB gzip | +0.07 kB / +0.03 kB |
| `index-*.css` | 77.68 kB / 11.93 kB gzip | 77.02 kB / 11.85 kB gzip | **−0.66 kB / −0.08 kB** |
| `vendor-math-*.js` | 375.73 kB / 110.72 kB gzip | 375.73 kB / 110.72 kB gzip | 0 / 0 |
| vendor chunk count | 5 | 5 | 0 |
| build time | 16.04 s | 6.90 s | *(baseline was the session's first build, cold cache; not comparable)* |

**Findings**

- **The entry delta is `App.tsx` and nothing else.** `App.tsx` is eager, and it gained three `useCallback`s (`handleQuickAddTransfer`, `handleQuickAddRepayDebt`, `handleNavigateToDebts`) plus four JSX props. +0.20 kB raw is the whole cost of making the shortcut row reachable.
- **The parser is entirely off the critical path.** `grep -l 'baht' dist/assets/*.js` resolves **only** to `TransactionForm-*.js`, so `expressInput.ts` ships inside the lazy chunk that ADR `0010` already defers. `grep -l '/api/classify' dist/assets/*.js` still resolves only to the same chunk.
- **The `TransactionForm` chunk barely moved despite a large rewrite**, because the phase deleted roughly as much as it added: the destination-wallet select, its validity effect, the `destinationWalletOptions` memo, the TRANSFER submit/label/description branches, and the entire collapse block all came out. Gzip grew slightly more than raw (+0.27 vs +0.13 kB) — the new parser's regex literals compress worse than the repetitive Tailwind strings that were removed.
- **The CSS shrank, which was not a goal.** The deleted collapse banner and "To Wallet" block took their utility classes out of the Tailwind scan with them.
- **No new dependency and no new vendor chunk.** `manualChunks` is unmodified, so ADR `0010`'s `vendor-math` deferral (110.72 kB gzip, still the largest chunk in the build) is intact.

**Test-suite size:** 150 → **165 runs** (50 → 55 tests, 15 → **16** spec files — the first new spec file since Phase 39). Wall clock `npx playwright test --workers=4`: 4.1 m → 4.5 m.

## Phase 42 (visual transfer layout) — bundle delta, measured against a rebuild of HEAD

Same method as the Phase 39–41 sections: `git stash push -u` the whole phase, `npm run clean && npm run build`, record, `git stash pop`, rebuild. Same machine, Node v24.19.0, same `node_modules`, clean tree both times, no dev server running. HEAD here is `84c4400`.

| Chunk | HEAD (stashed) | Phase 42 | Delta |
|---|---|---|---|
| entry `index-*.js` | 163.30 kB / 46.11 kB gzip | **163.31 kB / 46.12 kB gzip** | **+0.01 kB / +0.01 kB** |
| `TransferFundsModal-*.js` (lazy) | 4.10 kB / 1.76 kB gzip | 7.76 kB / 2.96 kB gzip | +3.66 kB / +1.20 kB |
| `index-*.css` | 77.02 kB / 11.85 kB gzip | 77.82 kB / 11.98 kB gzip | +0.80 kB / +0.13 kB |
| `vendor-math-*.js` | 375.73 kB / 110.72 kB gzip | 375.73 kB / 110.72 kB gzip | 0 / 0 |
| vendor chunk count | 5 | 5 | 0 |
| build time | 5.68 s | 5.26 s | — (both cold after `clean`) |

**Findings**

- **The whole redesign rides the lazy chunk.** `grep -l 'overdraws' dist/assets/*.js` resolves **only** to `TransferFundsModal-*.js` — the panels, the preview, the swap button and the warning all land behind ADR `0010`'s `hasOpened` latch, so none of it is on the critical path.
- **The entry chunk moved 10 bytes, and that is the `roundToCents` extraction.** Moving a two-line function from a module-private definition into its own module was expected to be byte-neutral after minification; it is not quite, because it adds a module boundary inside the eager `FinanceContext` graph. Recorded as measured rather than rounded to "unchanged" — the honest figure is more useful than a tidy one.
- **The CSS grew more in raw bytes than the JS chunk grew in gzip.** The two-panel grid, the amber overdraft banner and the circular swap button introduced utility classes the Tailwind scan had not previously emitted. This is the inverse of Phase 41, where deleting the collapse banner and the "To Wallet" block *shrank* the CSS by 0.66 kB.
- **No new dependency and no new vendor chunk.** `manualChunks` is unmodified, so ADR `0010`'s `vendor-math` deferral (110.72 kB gzip, still the largest chunk) is intact.
- **`TransferFundsModal-*.js` nearly doubled** (4.10 → 7.76 kB raw) and that is the expected shape of this phase: a plain stacked form became a two-panel layout with a preview, a warning, a swap control and an empty state. It remains the fourth-smallest chunk in the build.

**Test-suite size:** 165 → **186 runs** (55 → 62 tests, 16 → **17** spec files). Wall clock `npx playwright test --workers=4`: 4.5 m → 4.3 m.

## Phase 43 (debt payoff preview) — bundle delta, measured against a rebuild of HEAD

Same method as the Phase 39–42 sections, with one change: the phase was already committed when the measurement ran, so instead of `git stash push -u` this built `fb56cf8` (the pre-phase HEAD) and `main` in turn — `checkout` → `npm run clean && npm run build` → record → `checkout` → rebuild. Same machine, Node v24.19.0, same `node_modules`, clean tree both times, no dev server running.

| Chunk | HEAD (`fb56cf8`) | Phase 43 | Delta |
|---|---|---|---|
| entry `index-*.js` | 163.31 kB / 46.12 kB gzip | **163.35 kB / 46.14 kB gzip** | **+0.04 kB / +0.02 kB** |
| `TransactionForm-*.js` (lazy) | 17.90 kB / 5.84 kB gzip | 21.30 kB / 6.63 kB gzip | +3.40 kB / +0.79 kB |
| `ProgressMeter-*.js` (shared) | 1.16 kB / 0.64 kB gzip | 0.48 kB / 0.33 kB gzip | **−0.68 kB / −0.31 kB** |
| `useDebts-*.js` (shared, **new**) | — | 0.73 kB / 0.42 kB gzip | +0.73 kB / +0.42 kB |
| `DebtsView-*.js` (lazy) | 9.63 kB / 3.07 kB gzip | 9.66 kB / 3.08 kB gzip | +0.03 kB / +0.01 kB |
| `index-*.css` | 77.82 kB / 11.98 kB gzip | 77.92 kB / 12.00 kB gzip | +0.10 kB / +0.02 kB |
| `vendor-math-*.js` | 375.73 kB / 110.72 kB gzip | 375.73 kB / 110.72 kB gzip | 0 / 0 |
| **all JS, summed** | 1325.35 kB / 389.52 kB gzip | 1328.98 kB / 390.52 kB gzip | +3.63 kB / +1.00 kB |
| chunk count | 32 | 33 | **+1** |
| vendor chunk count | 5 | 5 | 0 |
| build time | 5.13 s | 5.21 s | — (both cold after `clean`) |

**Findings**

- **The feature rides the lazy chunk.** `grep -l 'more than this debt needs' dist/assets/*.js` resolves **only** to `TransactionForm-*.js`, which is already behind `React.lazy` at all three of its call sites. None of the payoff block is on the critical path.
- **The entry chunk's +0.04 kB is not this phase's code.** Importing `ProgressMeter` into `TransactionForm` gave that module a second lazy importer, and Rollup re-partitioned the shared graph: `ProgressMeter-*.js` **shrank** by 0.68 kB and `useDebts` split out into a new chunk of its own. One extra chunk means one extra entry in the preload map the entry chunk carries. The plan predicted "entry chunk unchanged" — recorded as measured, with the cause identified rather than rounded away.
- **A shared chunk got *smaller* because an import was added to it.** This is the first phase in this table where that happened, and it is the reason the **all JS, summed** row now exists: reading a single chunk's delta in isolation would have suggested +3.40 kB when the real cost across the build is +3.63 kB. Chunk sizes are a partitioning outcome, not a per-module cost.
- **CSS barely moved** (+0.10 kB raw). The payoff block reuses the save-as-template block's container shell and the template chips' class verbatim, so almost every utility it needs was already in the scan. Compare Phase 42's +0.80 kB, where a new panel layout, an amber banner and a circular button all introduced fresh classes; the amber note here is the only genuinely new shape and it shares its palette with the transfer overdraft warning.
- **No new dependency, no new vendor chunk.** `manualChunks` is unmodified, so ADR `0010`'s `vendor-math` deferral (110.72 kB gzip, still the largest chunk) is intact.

**Test-suite size:** 186 → **210 runs** (62 → 70 tests, 17 → **18** spec files). Wall clock `npx playwright test --workers=4`: 4.3 m → 4.8 m.

## Phase 44 (debt repayment integrity) — bundle delta, measured against a rebuild of HEAD

Same method as Phase 43: the phase was already committed, so this built `b83ad93` (the pre-phase HEAD) and `main` in turn — `checkout` → `npm run clean && npm run build` → record → `checkout` → rebuild. Same machine, Node v24.19.0, same `node_modules`, clean tree both times, no dev server running.

| Chunk | HEAD (`b83ad93`) | Phase 44 | Delta |
|---|---|---|---|
| entry `index-*.js` | 163.35 kB / 46.14 kB gzip | **164.29 kB / 46.32 kB gzip** | **+0.94 kB / +0.18 kB** |
| `TransactionForm-*.js` (lazy) | 21.30 kB / 6.63 kB gzip | 21.39 kB / 6.64 kB gzip | +0.09 kB / +0.01 kB |
| `index-*.css` | 77.92 kB / 12.00 kB gzip | 77.92 kB / 12.00 kB gzip | **0 / 0** |
| `vendor-math-*.js` | 375.73 kB / 110.72 kB gzip | 375.73 kB / 110.72 kB gzip | 0 / 0 |
| **all JS, summed** | 1328.98 kB / 390.52 kB gzip | 1330.01 kB / 390.71 kB gzip | +1.03 kB / +0.19 kB |
| chunk count | 33 | 33 | 0 |
| vendor chunk count | 5 | 5 | 0 |
| build time | — | 5.75 s | not compared; the baseline build was the first after a checkout and its 19.11 s is a cold-cache artefact, not a signal |

**Findings**

- **This phase puts real weight on the critical path, and that is correct rather than a regression.** `grep -l 'remaining on' dist/assets/*.js` resolves **only** to the entry chunk. Phases 41–43 all rode lazy chunks because their code lived in `TransactionForm`; both of this phase's guards live in `FinanceContext`, which is eager by construction — it is the provider wrapping the app. +0.94 kB raw / +0.18 kB gzip is the price of enforcing an invariant at the layer that actually commits, and paying it in a lazy chunk instead would mean enforcing it somewhere a caller could bypass.
- **The CSS did not move by a single byte** — the two builds produced an identical content hash (`index-Dwrjbfi7.css`). The constraint note reuses the amber palette and layout classes the warning it replaced already carried, so the Tailwind scan emitted nothing new. The first zero-delta CSS row in this table; compare Phase 42's +0.80 kB and Phase 43's +0.10 kB.
- **The chunk set is unchanged**, unlike Phase 43 where adding a lazy importer re-partitioned a shared chunk and added one. Nothing here changes an import graph — both guards are additions inside modules that were already in the entry chunk.
- **The summed-JS row (+1.03 kB) barely exceeds the entry row (+0.94 kB)**, which is the expected shape when a change is confined to already-eager modules plus a few lines in one lazy one. It is kept because Phase 43 proved a single chunk's delta can mislead.
- **No new dependency, no new vendor chunk.** `manualChunks` unmodified; ADR `0010`'s `vendor-math` deferral (110.72 kB gzip) intact.

**Test-suite size:** 210 → **225 runs** (70 → 75 tests, 18 spec files — one test inverted, five added, no new file). Wall clock `npx playwright test --workers=4`: 4.8 m → 5.2 m.

**Stability note:** the first full run of this phase reported 224/225, with `wallets.spec.ts:9` failing on webkit — a spec this phase does not touch. It passed 3/3 in isolation and the suite re-ran clean at 225/225. Recorded as `--workers=4` contention flake rather than resolved; CI runs `workers: 1`.

## Phase 45 (one-click smart rule capture) — bundle delta, measured against a rebuild of HEAD

Same method as Phases 43 and 44: the phase was already committed, so this built `b54941b` (the pre-phase HEAD) and `main` in turn — `checkout` → `npm run clean && npm run build` → record → `checkout` → rebuild. Same machine, same `node_modules`, clean tree both times, no dev server running. The HEAD column reproduced Phase 44's recorded figures to the byte (1330.01 kB / 390.71 kB gzip summed), which is the check that the method has not drifted.

| Chunk | HEAD (`b54941b`) | Phase 45 | Delta |
|---|---|---|---|
| entry `index-*.js` | 164.29 kB / 46.32 kB gzip | **164.29 kB / 46.33 kB gzip** | **0 / +0.01 kB** |
| `TransactionForm-*.js` (lazy) | 21.39 kB / 6.64 kB gzip | 24.51 kB / 7.31 kB gzip | +3.12 kB / +0.67 kB |
| `index-*.css` | 77.92 kB / 12.00 kB gzip | 77.92 kB / 12.00 kB gzip | **0 / 0** (identical hash `index-Dwrjbfi7.css`) |
| `vendor-math-*.js` | 375.73 kB / 110.72 kB gzip | 375.73 kB / 110.72 kB gzip | 0 / 0 |
| **all JS, summed** | 1330.01 kB / 390.71 kB gzip | 1333.13 kB / 391.39 kB gzip | +3.12 kB / +0.68 kB |
| chunk count | 33 | 33 | 0 |
| vendor chunk count | 5 | 5 | 0 |
| build time | — | 5.27 s | not compared; the HEAD build's 16.84 s is a cold-cache artefact of being the first build after a checkout, as in Phase 44 |

**Findings**

- **The entry chunk did not move by a single raw byte.** This is the cleanest result in the table and it was predicted rather than discovered: `addKeywordRule` was already in the entry chunk via `FinanceContext`, and no eager module gained an import. Contrast Phase 44, whose guards lived in `FinanceContext` itself and cost +0.94 kB on the critical path. The +0.01 kB gzip delta is compression noise from a changed chunk filename in the preload map, not content.
- **The whole feature rides the lazy chunk.** `grep -l 'Always file' dist/assets/*.js` resolves **only** to `TransactionForm-*.js`, which is behind `React.lazy` at all three of its call sites.
- **`SaveRuleChip` did not get a chunk of its own,** so unlike Phase 43 nothing re-partitioned. It has exactly one importer, and Rollup folded it into that importer's chunk — 33 chunks before and after. The **all JS, summed** row (+3.12 kB) matching the single-chunk row (+3.12 kB) exactly is the arithmetic proof of that.
- **The CSS content hash was identical again** — `index-Dwrjbfi7.css` in both builds, the second consecutive zero-byte CSS phase and the first time one has held while a *new component file* was added. The chip reuses `CategorySuggestionChip`'s container, text and button classes verbatim, and its emerald confirmation palette already existed on the ADR `0015` settle note. The only genuinely new utilities are `disabled:opacity-50` and `disabled:cursor-not-allowed`, both of which the scan already carried from elsewhere.
- **No new dependency, no new vendor chunk.** `manualChunks` unmodified; ADR `0010`'s `vendor-math` deferral (110.72 kB gzip, still the largest chunk) intact. Two new `lucide-react` icons (`Tag`, `Check`) are part of the +3.12 kB.

**Test-suite size:** 225 → **252 runs** (75 → 84 tests, 18 → **19** spec files — 9 added, none inverted or removed). Wall clock `npx playwright test --workers=4`: 5.2 m → 5.7 m.

**Stability note:** the first full run passed 252/252 with no retries. Phase 44's `wallets.spec.ts` webkit flake at `--workers=4` did not reproduce here; it stays on the watch list rather than being declared resolved on one clean run.

## Phase 46 (voice input for the omni note) — bundle delta, measured against a rebuild of HEAD

Same method as Phases 43–45: built `446aafb` (the pre-phase HEAD) and `main` in turn — `checkout` → `npm run clean && npm run build` → record → `checkout` → rebuild. Same machine, same `node_modules`, clean tree both times, no dev server running. The HEAD column reproduced Phase 45's recorded figures exactly, which is the check that the method has not drifted.

| Chunk | HEAD (`446aafb`) | Phase 46 | Delta |
|---|---|---|---|
| entry `index-*.js` | 164.29 kB / 46.33 kB gzip | **164.29 kB / 46.32 kB gzip** | **0 / -0.01 kB** |
| `TransactionForm-*.js` (lazy) | 24.51 kB / 7.31 kB gzip | 27.85 kB / 8.44 kB gzip | +3.34 kB / +1.13 kB |
| `vendor-icons-*.js` (**modulepreloaded**) | 29.79 kB | 30.16 kB | **+0.37 kB** |
| `index-*.css` | 77.92 kB / 12.00 kB gzip | 78.48 kB / 12.09 kB gzip | +0.56 kB / +0.09 kB |
| `vendor-math-*.js` | 375.73 kB / 110.72 kB gzip | 375.73 kB / 110.72 kB gzip | 0 / 0 |
| **all JS, summed** | 1333.13 kB / 391.39 kB gzip | 1336.84 kB / 392.57 kB gzip | +3.71 kB / +1.18 kB |
| chunk count | 33 | 33 | 0 |
| vendor chunk count | 5 | 5 | 0 |
| build time | 6.51 s | 6.00 s | both cold after `clean` |

**Findings**

- **The entry chunk did not move, and that is still not the same as "no critical-path cost."** The `Mic` icon went into `vendor-icons`, and `dist/index.html` carries `<link rel="modulepreload" href="/assets/vendor-icons-*.js">` — so its +0.37 kB is on the initial load. This is the second time reading only the rows expected to move would have produced a wrong claim (Phase 43 was the first, and the reason the summed row exists). It was caught by diffing **every** chunk until the +3.71 kB summed delta was fully accounted for: +3.34 in `TransactionForm`, +0.37 in `vendor-icons`, nothing anywhere else.
- **The feature itself is entirely lazy.** `grep -l 'Microphone access is blocked' dist/assets/*.js` resolves **only** to `TransactionForm-*.js`. The hook has one importer and Rollup folded it into that importer's chunk — 33 chunks before and after, so unlike Phase 43 nothing re-partitioned.
- **CSS moved for the first time in three phases** (+0.56 kB raw, +0.09 gzip). Phases 44 and 45 were byte-identical because they reused existing shells; this one introduces genuinely new shapes — an absolutely-positioned in-field button, the rose listening palette, `animate-pulse`, and the disabled-button states. The increase is the honest cost of a control that did not previously exist anywhere in the form.
- **No new dependency.** `@types/dom-speech-recognition` was deliberately not installed; the hook declares the six members it touches. `manualChunks` unmodified and ADR `0010`'s `vendor-math` deferral (110.72 kB gzip) intact.

**Test-suite size:** 252 → **276 runs** (84 → 92 tests, 19 → **20** spec files — 8 added, none removed or inverted). Wall clock `npx playwright test --workers=4`: 5.7 m → 6.3 m.

**Stability note:** first full run clean at 276/276 with no retries. Phase 44's `wallets.spec.ts` webkit flake has now not reproduced across two consecutive phases; it stays on the watch list rather than being closed on that basis.
