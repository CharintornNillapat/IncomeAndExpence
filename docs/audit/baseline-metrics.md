# Baseline metrics

Numbers are never rewritten — a regression must stay visible in its own column. Each phase appends one column after its verification gate passes, using the identical commands and scenarios listed here.

**Environment:** Windows 11, Node v24.19.0, npm 11.17.0, Vite 6.4.3, Playwright 1.63.0. Captured 2026-09-17 at commit `1a02a4a`, clean working tree, `node_modules` already installed.

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

## Playwright wall-clock

```
39 passed (1.2m)
real 1m16.216s
```

Run included a fresh `npm run dev` server boot (no server was pre-warmed). All 39 runs green: 13 tests × {chromium, firefox, webkit}.

| Phase | Wall-clock | Server state | Pass count |
|---|---|---|---|
| **Phase 0 baseline** | 1m16.2s | Cold boot (fresh `npm run dev`) | 39 / 39 |

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

## Re-render counts (scenario replay)

**Not yet captured.** This requires a throwaway instrumentation branch (React `Profiler` + `console.count`, per the plan) that is deliberately never merged. It has not been created in Phase 0 to keep this phase at zero `src/` edits, including on a disposable branch, per the explicit constraint for this session.

**To capture before Phase 3 (App-shell fix) ships:**

1. Create a throwaway branch off `main`.
2. Wrap `<MainApp />` at `App.tsx:249` in a `<Profiler id="app" onRender={...}>` that appends `phase` to `window.__commits`.
3. Add `console.count('<Name>')` as the first statement in: `MainApp`, `Navbar`, `MobileBottomNav`, `AuthModal`, `ReloadPrompt`, `DashboardView`, `TransactionForm`, `InlineMathInput`, `AnimatedCounter`, `WalletPopupModal`, `AddWalletForm`, `WalletTransferForm`, `SecurityView`, `KeywordRulesView`.
4. Run the five fixed scenarios below via Playwright, harvesting `page.on('console', ...)` and `window.__commits.length`.
5. Record the numbers here, then discard the branch. Never commit the instrumentation.

### Fixed scenarios (do not change these once a baseline exists — a changed scenario invalidates every prior column)

- **S1 — Cold load.** `page.goto('/')` → dashboard painted.
- **S2 — One write** (the headline number). From S1: open Quick Add → fill ฿150 + wallet + description → submit → modal closes.
- **S3 — Typing.** From S1: type 12 characters into the `TransactionForm` description field.
- **S4 — Diary keystroke.** Diary tab → type 12 characters into notes.
- **S5 — Tab cycle.** dashboard → transactions → wallets → dashboard.

| Phase | S1 | S2 | S3 | S4 | S5 |
|---|---|---|---|---|---|
| **Phase 0 baseline** | not captured | not captured | not captured | not captured | not captured |
