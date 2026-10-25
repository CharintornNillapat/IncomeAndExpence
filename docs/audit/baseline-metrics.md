# Baseline metrics

The figures a phase is measured against. Phases 0 to 124 are in `archive/baseline-metrics-phases-000-124.md`, read only when asked to prove or disprove an improvement over an older phase. **Never rewrite an archived column.** Each phase that ships adds its section at the top of "Figures" with deltas against the one below; past about 150 lines, move the older sections to the archive.

## How to measure

```powershell
# Bundle: always rebuild, never read a stale dist/. Build with the repo's .env present:
# VITE_ values are inlined into the entry, so a build without it is smaller.
npm run clean
npm run build
# Then gzip each file in dist/assets at level 9 and record raw and gzip bytes:
# the entry index-*.js, and the sum of all app JS.

# Tests: record files, tests, runs, result and time; keep the logs.
npm run test:unit
npm run test:unit:shuffle      # note the seed it prints
npx playwright test            # local, 4 workers; note whether the dev servers were cold

# Type-check time: run 3 times, discard the cold first run, take the median of the rest.
npx tsc --noEmit --extendedDiagnostics
```

## Figures

### Phase 148 - delta against Phase 147

- **Entry chunk** `index-D4N64t3V.js`: 194,626 B (+33 B), 56,981 B gzip (+18 B against Phase 147 `index-B-nRqlko.js`, 194,593 / 56,963): T807's idle callback in `App.tsx` also flips the four shell-dialog latches.
- **All app JS**: 886,331 B (+33 B), 269,276 B gzip (+46 B against Phase 147 886,298 / 269,230, 39 files, 0 file delta).
- **CSS**: `index-CNaxMlAk.css`: 53,359 B (0 delta), 10,451 B gzip (0 delta; the same file as Phase 147).
- **Vitest**: 69 files, 1510 tests (0 delta against Phase 147), 1510 passed in 76.30 s (`workflow/stages/02_build/output/logs/T808-unit.log`). Per-task run: T807 1510 passed in 84.61 s (`workflow/stages/02_build/output/logs/T807-unit.log`).
- **Playwright**: `npx playwright test --list` reports 187 tests in 36 files, 561 runs across 3 projects (+4 tests, +12 runs against Phase 147, all in `tests/tab-preload.spec.ts`, new in T807). Full run by T807: 555 passed, 6 skipped, 0 failed across 3 projects (10.2 min, `workflow/stages/02_build/output/logs/T807-e2e.log`); the T807 review's run gave the same (10.4 min). No full run by T808 (docs-only; the code is unchanged since T807).

### Phase 147 - delta against Phase 146

Measured at `d6261d4`; T806 changed docs only and the merge commit `2c00a6d` has the same tree as `53e1062`, so the figures hold for it.

- **Entry chunk** `index-B-nRqlko.js`: 194,593 B (+207 B), 56,963 B gzip (+70 B against Phase 146 `index-C3uifmw_.js`, 194,386 / 56,893): T805's `registerType: 'prompt'` makes `vite-plugin-pwa` generate its prompt-mode register code.
- **All app JS**: 886,298 B (+207 B), 269,230 B gzip (+63 B against Phase 146 886,091 / 269,167, 39 files, 0 file delta).
- **CSS**: `index-CNaxMlAk.css`: 53,359 B (0 delta), 10,451 B gzip (0 delta; the same file as Phase 146).
- **Vitest**: 69 files, 1510 tests (+4 tests, +1 file against Phase 146: `unit/reload-prompt.test.tsx`, new in T805), 1510 passed in 61.55 s (`workflow/stages/02_build/output/logs/T806-unit.log`). Per-task run: T805 1510 passed in 59.69 s (`workflow/stages/02_build/output/logs/T805-unit.log`).
- **Playwright**: `npx playwright test --list` reports 183 tests in 36 files, 549 runs across 3 projects (0 delta). No full run in Phase 147: T805 ran `tests/toast-layering.spec.ts`, the one spec on the `pwa-dev` server, on 3 projects (6 passed), and T806 changed docs only. Last full run: T803, 543 passed, 6 skipped, 0 failed (9.7 min).

### Phase 146 - delta against Phase 145

Measured at `476b92c`; T804 changed docs only and the merge commit `f6d05ce` has the same tree as `c250226`, so the figures hold for it.

- **Entry chunk** `index-C3uifmw_.js`: 194,386 B (-139 B), 56,893 B gzip (-62 B against Phase 145 `index-CDIxbGVL.js`, 194,525 / 56,955): T803 removes the tab direction state and the `Presence` wrapper from `App.tsx`.
- **All app JS**: 886,091 B (-139 B), 269,167 B gzip (-94 B against Phase 145 886,230 / 269,261, 39 files, 0 file delta).
- **CSS**: `index-CNaxMlAk.css`: 53,359 B (-536 B), 10,451 B gzip (-75 B against Phase 145 `index-BNXJTUPd.css`, 53,895 / 10,526): T803 deletes the page and popup entrance keyframes and rules.
- **Vitest**: 68 files, 1506 tests (0 delta against Phase 145), 1506 passed in 80.63 s (`workflow/stages/02_build/output/logs/T804-unit.log`). Per-task run: T803 1506 passed in 54.14 s (`workflow/stages/02_build/output/logs/T803-unit.log`).
- **Playwright**: `npx playwright test --list` reports 183 tests in 36 files, 549 runs across 3 projects (0 delta). No full run by T804 (docs-only; the code is unchanged since T803). Full run by T803: 543 passed, 6 skipped, 0 failed across 3 projects (9.7 min, `workflow/stages/02_build/output/logs/T803-playwright.log`).

### Phase 145 - delta against Phase 144

Measured at `8fe3e93`; T802 changed docs only and the merge commit `ed71c59` has the same tree as `fb0b81d`, so the figures hold for it.

- **Entry chunk** `index-CDIxbGVL.js`: 194,525 B (-50 B), 56,955 B gzip (+25 B against Phase 144 `index-BI7UeuqQ.js`, 194,575 / 56,930): T801's `adoptSession` replaces the two copies of the profile block in the auth effect.
- **All app JS**: 886,230 B (-50 B), 269,261 B gzip (+18 B against Phase 144 886,280 / 269,243, 39 files, 0 file delta).
- **CSS**: `index-BNXJTUPd.css`: 53,895 B (0 delta), 10,526 B gzip (0 delta; the same file as Phase 144).
- **Vitest**: 68 files, 1506 tests (+6 tests, 0 files against Phase 144: `unit/authenticated-ledger.test.tsx`, +6 from T801), 1506 passed in 54.34 s (`workflow/stages/02_build/output/logs/T802-unit.log`). Per-task run: T801 1506 passed in 71.65 s (`workflow/stages/02_build/output/logs/T801-unit.log`).
- **Playwright**: `npx playwright test --list` reports 183 tests in 36 files, 549 runs across 3 projects (0 delta). Full run by T802, at the owner's request: 543 passed, 6 skipped, 0 failed across 3 projects (11.4 min, `workflow/stages/02_build/output/logs/T802-playwright.log`). Earlier full run at 183 tests: T800, 543 passed, 6 skipped (12.8 min).

### Phase 144 - delta against Phase 143

Measured at `5a16b79`; T800 changed docs only and the merge commit `5ecdb1d` has the same tree as `237684e`, so the figures hold for it.

- **Entry chunk** `index-BI7UeuqQ.js`: 194,575 B (+1,282 B), 56,930 B gzip (+502 B against Phase 143 `index-TU2ZOqF8.js`, 193,293 / 56,428): T797's `lazyView` and idle preload gave +749 B at its own build (`index-CKmfyoLI.js`, 194,042 B), T798 and T799 the other +533 B.
- **All app JS**: 886,280 B (+1,293 B), 269,243 B gzip (+487 B against Phase 143 884,987 / 268,756, 39 files, 0 file delta; the six view chunks stay separate files).
- **CSS**: `index-BNXJTUPd.css`: 53,895 B (0 delta), 10,526 B gzip (0 delta; the same file as Phase 143).
- **Vitest**: 68 files, 1500 tests (+25 tests, +2 files against Phase 143: `unit/lazy-view.test.tsx`, 5 tests from T797; `unit/navbar-sync-badge.test.tsx`, 8 tests from T798; `unit/authenticated-ledger.test.tsx`, +3 from T798 and +9 from T799), 1500 passed in 100.75 s (`workflow/stages/02_build/output/logs/T800-unit.log`). Per-task runs: T797 1480 passed in 54.02 s, T798 1491 in 74.62 s, T799 1500 in 71.35 s (`workflow/stages/02_build/output/logs/T79N-unit.log`).
- **Playwright**: `npx playwright test --list` reports 183 tests in 36 files, 549 runs across 3 projects (+2 tests, +1 file, +6 runs: T797's `tests/tab-preload.spec.ts`). Full run by T800, at the owner's request: 543 passed, 6 skipped, 0 failed across 3 projects (12.8 min, `workflow/stages/02_build/output/logs/T800-playwright.log`). Earlier full run at 183 tests: T797, 543 passed, 6 skipped (10.8 min).

### Phase 143 - delta against Phase 142

Measured at `45b9e87`; T796 changed docs only and the merge commit `7aa9ecb` has the same tree as `a0f31b9`, so the figures hold for it.

- **Entry chunk** `index-TU2ZOqF8.js`: 193,293 B (+124 B), 56,428 B gzip (+54 B against Phase 142 `index-CQ64gmHG.js`, 193,169 / 56,374).
- **All app JS**: 884,987 B (+278 B), 268,756 B gzip (+164 B against Phase 142 884,709 / 268,592, 39 files, 0 file delta).
- **CSS**: `index-BNXJTUPd.css`: 53,895 B (+1,018 B), 10,526 B gzip (+310 B against Phase 142 `index-BJZ9fITB.css`, 52,877 / 10,216): the theme variables T793 to T795 added to `:root`, `.dark` and `@theme inline`.
- **Vitest**: 66 files, 1475 tests (+10 tests, +2 files against Phase 142: `unit/theme-tokens.test.ts`, 7 tests from T793 and T794, and `unit/identity-display.test.ts`, 3 tests from T795), 1475 passed in 76.39 s (`workflow/stages/02_build/output/logs/T796-unit.log`). Per-task runs: T793 1469 passed in 71.38 s, T794 1472 in 61.33 s, T795 1475 in 43.47 s (`workflow/stages/02_build/output/logs/T79N-unit.log`).
- **Playwright**: `npx playwright test --list` reports 181 tests in 35 files, 543 runs across 3 projects (+2 tests, +6 runs: T795's two identity colour tests in `tests/dashboard.spec.ts`). Full run by T796, at the owner's request: 537 passed, 6 skipped, 0 failed across 3 projects (8.9 min, `workflow/stages/02_build/output/logs/T796-playwright.log`). Earlier full runs at 179 tests: T793 and T794, 531 passed, 6 skipped (8.8 and 9.4 min).

### Phase 142 - delta against Phase 141

Measured at `c8d16cf`; T791 changed docs only and the merge commit `9e7bb45` has the same tree as `77cb979`, so the figures hold for it.

- **Entry chunk** `index-CQ64gmHG.js`: 193,169 B (-6 B), 56,374 B gzip (-6 B against Phase 141 `index-O-Xe4lzP.js`, 193,175 / 56,380).
- **All app JS**: 884,709 B (+218 B), 268,592 B gzip (-20 B against Phase 141 884,491 / 268,612, 39 files, 0 file delta).
- **CSS**: `index-BJZ9fITB.css`: 52,877 B (0 delta), 10,216 B gzip (0 delta against Phase 141 `index-BJZ9fITB.css`, 52,877 / 10,216).
- **Vitest**: 64 files, 1465 tests (+2 tests, +1 file against Phase 141: the new guard `unit/dom-id-convention.test.ts`), 1465 passed in 53.05 s (`workflow/stages/02_build/output/logs/T791-unit.log`). Per-task run: T790 1465 passed in 42.56 s (`workflow/stages/02_build/output/logs/T790-unit.log`).
- **Playwright**: run in full by T790, since its renames touched 24 specs: 531 passed, 6 skipped, 0 failed across 3 projects (8.7 min, `workflow/stages/02_build/output/logs/T790-playwright.log`; the review's rerun took 10.9 min). Suite size unchanged: `npx playwright test --list` reports 179 tests in 35 files, 537 runs across 3 projects.

### Phase 141 - delta against Phase 140

Measured at `1324fb2`; the merge commit `e61ac44` has the same tree, so the figures hold for it.

- **Entry chunk** `index-O-Xe4lzP.js`: 193,175 B (-24 B), 56,380 B gzip (+78 B against Phase 140 `index-BxO3ndwn.js`, 193,199 / 56,302).
- **All app JS**: 884,491 B (-36 B), 268,612 B gzip (+102 B against Phase 140 884,527 / 268,510, 39 files, 0 file delta).
- **CSS**: `index-BJZ9fITB.css`: 52,877 B (0 delta), 10,216 B gzip (0 delta against Phase 140 `index-BJZ9fITB.css`, 52,877 / 10,216).
- **Vitest**: 63 files, 1463 tests (+7 tests, 0 file delta against Phase 140), 1463 passed in 72.01 s (`workflow/stages/02_build/output/logs/T789-unit.log`). Per-task runs: T787 1460 passed in 71.99 s (`workflow/stages/02_build/output/logs/T787-unit.log`), T788 1463 passed in 68.49 s (`workflow/stages/02_build/output/logs/T788-unit.log`).
- **Playwright**: not run in full: affected specs ran per task (`tests/transaction.spec.ts`, `tests/debt-repayment.spec.ts`, and `tests/soft-delete.spec.ts` for T787: 23 on Chromium, 69 on three browsers; `tests/csv.spec.ts` and `tests/csv-classify.spec.ts` for T788: 13 on Chromium, 39 on three browsers). Suite size unchanged: `npx playwright test --list` reports 179 tests in 35 files, 537 runs across 3 projects.

### Phase 140 - delta against Phase 139

Measured at `3f6071d`; the merge commit `f1532dd` has the same tree, so the figures hold for it.

- **Entry chunk** `index-BxO3ndwn.js`: 193,199 B (-178 B), 56,302 B gzip (-28 B against Phase 139 `index-DdI940YI.js`, 193,377 / 56,330).
- **All app JS**: 884,527 B (-162 B), 268,510 B gzip (-44 B against Phase 139 884,689 / 268,554, 39 files, 0 file delta).
- **CSS**: `index-BJZ9fITB.css`: 52,877 B (0 delta), 10,216 B gzip (0 delta against Phase 139 `index-BJZ9fITB.css`, 52,877 / 10,216).
- **Vitest**: 63 files, 1456 tests (+12 tests, 0 file delta against Phase 139), 1456 passed in 70.48 s (`workflow/stages/02_build/output/logs/T786-unit.log`). Per-task runs: T780 1444 passed in 68.65 s (`workflow/stages/02_build/output/logs/T780-unit.log`), T781 1445 passed in 90.21 s (`workflow/stages/02_build/output/logs/T781-unit.log`), T783 1446 passed in 77.12 s (`workflow/stages/02_build/output/logs/T783-unit.log`), T784 1450 passed in 88.93 s (`workflow/stages/02_build/output/logs/T784-unit.log`), T785 1456 passed in 69.41 s (`workflow/stages/02_build/output/logs/T785-unit.log`).
- **Playwright**: not run in full: affected specs ran per task (`tests/presets.spec.ts` for T780: 6 on Chromium, 18 on three browsers; `tests/transaction.spec.ts` and `tests/soft-delete.spec.ts` for T781: 12 on Chromium, 36 on three browsers; `tests/debts.spec.ts` and `tests/debts-page.spec.ts` for T783: 4 on Chromium, 12 on three browsers; `tests/insights.spec.ts` for T784 and T785: 2 on Chromium, 6 on three browsers each). Suite size unchanged: `npx playwright test --list` reports 179 tests in 35 files, 537 runs across 3 projects.

### Phase 139 - delta against Phase 137

Measured at `5076a1d`; the merge commit `f33ba89` has the same tree, so the figures hold for it.

- **Entry chunk** `index-DdI940YI.js`: 193,377 B (+42 B), 56,330 B gzip (-28 B against Phase 137 `index-vzBQwKkr.js`, 193,335 / 56,358).
- **All app JS**: 884,689 B (+20 B), 268,554 B gzip (-34 B against Phase 137 884,669 / 268,588, 39 files, 0 file delta).
- **CSS**: `index-BJZ9fITB.css`: 52,877 B (0 delta), 10,216 B gzip (0 delta against Phase 137 `index-BJZ9fITB.css`, 52,877 / 10,216).
- **Vitest**: 63 files, 1444 tests (+6 tests, +1 file against Phase 137), 1444 passed in 75.76 s (`workflow/stages/02_build/output/logs/T778-unit.log`). Per-task runs: T776 1440 passed in 43.94 s (`workflow/stages/02_build/output/logs/T776-unit.log`), T777 1444 passed in 60.60 s (`workflow/stages/02_build/output/logs/T777-unit.log`).
- **Playwright**: not run in full: no UI path changed in Phase 139; affected specs ran per task (`tests/soft-delete.spec.ts` for T777: 6 on Chromium, 18 on three browsers; `tests/soft-delete.spec.ts` and `tests/transaction.spec.ts` for T776: 12 on Chromium, 36 on three browsers). Suite size unchanged: `npx playwright test --list` reports 179 tests in 35 files, 537 runs across 3 projects.

### Phase 137 - delta against Phase 136

- **Entry chunk** `index-vzBQwKkr.js`: 193,335 B (0 delta), 56,358 B gzip (-2 B against Phase 136 `index-BcaenrL9.js`, 193,335 / 56,360).
- **All app JS**: 884,669 B (+5 B), 268,588 B gzip (+26 B against Phase 136 884,664 / 268,562, 39 files, 0 file delta). Measured on the merge `0a0f87d`, after T774's line-height change (T769's build gave `index-DLzcvRPb.js` and `index-CLc9BRYW.css`). Production on `0a0f87d` serves the same entry and CSS.
- **CSS**: `index-BJZ9fITB.css`: 52,877 B (-7 B), 10,216 B gzip (+7 B against Phase 136 `index-z3bqoA9P.css`, 52,884 / 10,209).
- **Vitest**: 62 files, 1438 tests (+2 tests against Phase 136), 1438 passed in 50.99 s (`workflow/stages/02_build/output/logs/T769-unit.log`).
- **Playwright**: 5 files (`tests/dashboard.spec.ts`, `tests/transfer-preview.spec.ts`, `tests/transaction.spec.ts`, `tests/transaction-edit.spec.ts`, `tests/diary.spec.ts`), 32 tests, 96 runs across 3 browsers (Chromium, Firefox, WebKit), 96 passed, 0 failed in 2.2 m; Chromium alone: 32 passed in 40.2 s.

### Phase 136 - delta against Phase 135

- **Entry chunk** `index-BcaenrL9.js`: 193,335 B (+83 B), 56,360 B gzip (+24 B against Phase 135 `index-wgYjfCND.js`, 193,252 / 56,336).
- **All app JS**: 884,664 B (+332 B), 268,562 B gzip (+63 B against Phase 135 884,332 / 268,499, 39 files, 0 file delta). Production on `753e4f4` serves the same entry and CSS.
- **CSS**: `index-z3bqoA9P.css`: 52,884 B (0 delta), 10,209 B gzip (0 delta against Phase 135 `index-z3bqoA9P.css`, 52,884 / 10,209).
- **Vitest**: 62 files, 1436 tests (+4 tests against Phase 135), 1436 passed in 48.79 s (`workflow/stages/02_build/output/logs/T768-unit.log`).
- **Playwright**: 8 files (`tests/auth.spec.ts`, `tests/account-and-mobile-nav.spec.ts`, `tests/wallet-forms.spec.ts`, `tests/wallets.spec.ts`, `tests/soft-delete.spec.ts`, `tests/csv.spec.ts`, `tests/csv-classify.spec.ts`, `tests/ios-field-zoom.spec.ts`), 51 tests, 153 runs across 3 browsers (Chromium, Firefox, WebKit), 153 passed, 0 failed in 3.4 m (`workflow/stages/02_build/output/logs/T768-e2e.log`); Chromium alone: 51 passed in 43.5 s.

### Phase 135 - delta against Phase 134

- **Entry chunk** `index-wgYjfCND.js`: 193,252 B (+1,556 B), 56,336 B gzip (+526 B against Phase 134 `index-C7LsbYem.js`, 191,696 / 55,810).
- **All app JS**: 884,332 B (+6,103 B), 268,499 B gzip (+1,587 B), 39 files (-1 file against Phase 134 878,229 / 266,912, 40 files; one chunk fewer since T767 deleted `NetWorthCard.tsx` from the Dashboard's graph). Production on `bdfc500` serves the same entry and CSS.
- **CSS**: `index-z3bqoA9P.css`: 52,884 B (+125 B), 10,209 B gzip (+50 B against Phase 134 `index-CqllkKUj.css`, 52,759 / 10,159).
- **Vitest**: 62 files, 1432 tests (+28 tests against Phase 134), 1432 passed in 44.88 s (`workflow/stages/02_build/output/logs/T767-unit.log`); shuffled 1432/1432 (seed `1792225420210`).
- **Playwright**: 35 files, 179 tests, 537 runs across 3 browsers (Chromium, Firefox, WebKit), 531 passed, 6 skipped by design, 0 failed in 9.9 m (`workflow/stages/02_build/output/logs/T767-e2e-full.log`); Chromium alone (12 affected specs): 71 passed in 40.3 s.

### Phase 134 - delta against Phase 132

- **Entry chunk** `index-C7LsbYem.js`: 191,696 B (0 delta), 55,810 B gzip (0 delta against Phase 132 `index-C7LsbYem.js`, 191,696 / 55,810).
- **All app JS**: 878,229 B (0 delta), 266,912 B gzip (0 delta), 40 files (0 delta against Phase 132 878,229 / 266,912, 40 files).
- **CSS**: `index-CqllkKUj.css`: 52,759 B (0 delta), 10,159 B gzip (0 delta against Phase 132 `index-CqllkKUj.css`, 52,759 / 10,159).
- **Vitest**: 62 files, 1404 tests (+26 tests against Phase 132), 1404 passed in 49.85 s (`workflow/stages/02_build/output/logs/T764-unit.log`).
- **Playwright**: not run: no UI path changed in Phase 134; nothing renders the new selectors.

### Phase 132 - delta against Phase 129

- **Entry chunk** `index-C7LsbYem.js`: 191,696 B (+22 B), 55,810 B gzip (+8 B against Phase 129 `index-BB5386eR.js`, 191,674 / 55,802).
- **All app JS**: 878,229 B (+22 B), 266,912 B gzip (-30 B), 40 files (0 delta against Phase 129 878,207 / 266,942, 40 files).
- **CSS**: `index-CqllkKUj.css`: 52,759 B (0 delta), 10,159 B gzip (0 delta against Phase 129 `index-CqllkKUj.css`, 52,759 / 10,159).
- **Vitest**: 62 files, 1378 tests, 1378 passed in 49.8 s (`workflow/stages/02_build/output/logs/T760-unit.log`).
- **Playwright**: 2 files (`tests/transfer-preview.spec.ts`, `tests/wallet-forms.spec.ts`), 11 tests, 33 runs across 3 browsers (Chromium, Firefox, WebKit), 33 passed, 0 failed in 56.8 s (`workflow/stages/02_build/output/logs/T760-e2e.log`); Chromium alone: 11 passed in 46.4 s.

### Phase 129 - delta against Phase 127

- **Entry chunk** `index-BB5386eR.js`: 191,674 B (0 delta), 55,802 B gzip (+6 B against Phase 127 `index-0LGxXWZU.js`, 191,674 / 55,796).
- **All app JS**: 878,207 B (-4 B), 266,942 B gzip (-9 B), 40 files (0 delta against Phase 127 878,211 / 266,951, 40 files).
- **CSS**: `index-CqllkKUj.css`: 52,759 B (0 delta), 10,159 B gzip (0 delta against Phase 127 `index-CqllkKUj.css`, 52,759 / 10,159).
- **Vitest**: 62 files, 1375 tests, 1375 passed in 69.9 s (`workflow/stages/02_build/output/logs/T756-unit.log`).
- **Playwright**: 3 files (`tests/wallet-forms.spec.ts`, `tests/transfer-preview.spec.ts`, `tests/ios-field-zoom.spec.ts`), 13 tests, 39 runs across 3 browsers (Chromium, Firefox, WebKit), 39 passed, 0 failed in 1.2 m (`workflow/stages/02_build/output/logs/T756-e2e.log`); Chromium alone: 13 passed in 28.6 s.

### Phase 127 - delta against Phase 124

- **Entry chunk** `index-0LGxXWZU.js`: 191,674 B (0 delta), 55,796 B gzip (+3 B against Phase 124 `index-BLSMm3p4.js`, 191,674 / 55,793).
- **All app JS**: 878,211 B (-12 B), 266,951 B gzip (+43 B), 40 files (0 delta against Phase 124 878,223 / 266,908, 40 files).
- **CSS**: `index-CqllkKUj.css`: 52,759 B, 10,159 B gzip.
- **Vitest**: 62 files, 1375 tests, 1375 passed in 75.3 s (`workflow/stages/02_build/output/logs/T753-unit.log`).
- **Playwright**: 2 files (`tests/presets.spec.ts`, `tests/debt-repayment.spec.ts`), 17 tests, 51 runs across 3 browsers (Chromium, Firefox, WebKit), 51 passed, 0 failed in 1.5 m (`workflow/stages/02_build/output/logs/T753-e2e.log`); Chromium alone: 17 passed in 59.4 s.

### Phase 125 (docs only) - delta against Phase 124

- **No `src/` change:** the bundle is Phase 124's.
- **Rule files loaded at session start:** about 20 KB (global `CLAUDE.md`, this repo's `CLAUDE.md` and `AGENTS.md`, the memory index, a plugin's start hook), from about 185 KB with the old `CLAUDE.md`.
- **Live `docs/audit/*.md`:** 1,497.8 KB in 12 files on `main`, about 27 KB in 5 files now.
- **Vitest:** 62 files, 1375/1375 (71.5 s, run during the context audit). Playwright: not run (no code change); 492 tests in 34 files listed.

### Phase 124 (latest code change)

- **Entry chunk** `index-BLSMm3p4.js`: 191,674 B, 55,793 B gzip (Phase 123: 195,458 / 57,105).
- **All app JS**: 878,223 B, 266,908 B gzip, 40 files.
- **Runtime dependencies**: 7.
- **Vitest** (`unit/`): 62 files, 1375 tests, 1375/1375 in 41 s; shuffled 1375/1375 (seed `1791595131349`).
- **Playwright** (local, 4 workers): 34 files, 164 tests, 492 runs, 486 passed, 6 skipped, 0 failed, in 8.2 min, first run.
