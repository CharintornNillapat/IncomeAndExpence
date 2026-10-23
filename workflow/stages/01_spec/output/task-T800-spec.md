# Spec: T800

Phase 144, branch `phase-144-smooth-sync-and-tabs`, cut from `main` at `da2f475`. Docs-only; this task ships the phase. T800 is free: the ledger's highest id is T799 (`docs/audit/task-ledger.md:102`) and no `task-T800-*` stage file exists.

## 1. Goal

Close Phase 144 on paper, in the Phase 143 pattern (T796): the `refactor-log.md` entry for T797-T800 (with Surprises and Deliberately not done), the `baseline-metrics.md` Phase 144 section against Phase 143, the ledger Commit cells for T797 to T799 and the T800 row, and the unit and Playwright counts in `AGENTS.md` and `README.md` (and the same stale count in `docs/contexts/ui-and-e2e.md`), measured from the code. The owner also asks for one full Playwright run (`npm test`), recorded in the ledger, the metrics and the refactor-log.

## 2. Target files

```
AGENTS.md
README.md
docs/contexts/ui-and-e2e.md
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
```

Bookkeeping, always allowed: `docs/audit/task-ledger.md` (three Commit cells and the T800 row; section 6a step 6).

- `docs/contexts/ui-and-e2e.md` is added beyond the order's two files because its line `:66` states the same Playwright count and would stay wrong (the docs-only tier: a doc that states a count is checked against the code); T796 edited the same line. One line, nothing else.
- **Pause list:** `AGENTS.md` is a target, so the orchestrator pauses for the owner's go-ahead before `build T800`. The `AGENTS.md` edit is the four numbers on line 11 and nothing else.

## 3. Context to read

none (docs-only). The builder reads, as the shapes to copy: the template block and the Phase 143 entry at the top of `docs/audit/refactor-log.md` (`:7-30`), the Phase 143 section of `docs/audit/baseline-metrics.md` (`:26-34`), and the Phase 143 and 144 sections of `docs/audit/task-ledger.md` (`:82-102`).

## 4. Current behaviour

1. **ADRs:** ADR 0104 (`docs/audit/decisions/0104-preload-tab-views.md`, new in T797), the ADR 0026 Amendment (T798) (`docs/audit/decisions/0026-static-money-motion-and-sync-status.md:189-213`) and the ADR 0003 Amendment (T799) (`docs/audit/decisions/0003-localstorage-and-realtime.md:38-65`). No new ADR for T800.
2. **Phase 144 commits** (`git log --oneline main..HEAD`, verified by the spec author): T797 `8633c17`, T798 `2868d31`, T799 `5a16b79`, all 2026-10-23. Merge base with `main` is `da2f475`.
3. **Reviews:** T797, T798 and T799 each APPROVED in round 1 (`workflow/stages/03_review/output/task-T79N-review.md`, one round each).
4. **Ledger** (`docs/audit/task-ledger.md:94-102`): heading `:94`, branch line `:96` (`cut from main at da2f475. No migration.`), rows T797 `:100`, T798 `:101`, T799 `:102`, each `done` with an empty Commit cell and a filled Gate result. No T800 row. No Backlog row is touched by this phase. File is 155 lines.
5. **Unit counts:** before the phase 66 files, 1475 tests (`AGENTS.md:11`, `README.md:157`). At `5a16b79`: 68 files (`ls unit` gives 68 `*.test.ts(x)`), 1500 tests (`workflow/stages/03_review/output/logs/T799-unit.log:10-11`: 68 passed, 1500 passed). Delta +25 tests, +2 files: `unit/lazy-view.test.tsx` (5, T797), `unit/navbar-sync-badge.test.tsx` (8, T798), `unit/authenticated-ledger.test.tsx` (+3 T798, +9 T799).
6. **Playwright counts** (spec author, at `5a16b79`): `npx playwright test --list` prints `Total: 549 tests in 36 files`; `--project=chromium` prints `Total: 183 tests in 36 files`. So 183 tests, 36 specs, 549 runs (+2 tests, +1 spec, +6 runs: T797's `tests/tab-preload.spec.ts`, 2 tests). Stale statements: `AGENTS.md:11` (`181 tests, 35 specs, 543 runs`), `README.md:10` (badge `Playwright-181%20E2E%20tests`), `README.md:158` (`181 tests in 35 spec files ... (543 runs)`), `docs/contexts/ui-and-e2e.md:66` (`181 tests in 35 specs on Chromium, Firefox and WebKit: 543 runs, 537 pass, 6 skip by design`). The last full run: T797 (builder and review), 549 runs, 543 passed, 6 skipped (10.8 min). T798 and T799 ran targeted specs only.
7. **Bundle** (spec author, `npm run clean` then `npm run build` exit 0, `.env` present, gzip level 9 over `dist/assets`, at `5a16b79`):
   - Entry `index-BI7UeuqQ.js` 194,575 B / 56,930 B gzip (Phase 143 `index-TU2ZOqF8.js` 193,293 / 56,428: +1,282 / +502). T797's own build gave `index-CKmfyoLI.js` 194,042 B (+749 B), so T798 and T799 add the other +533 B.
   - All app JS 886,280 B / 269,243 B gzip, 39 files (Phase 143 884,987 / 268,756: +1,293 / +487, 0 file delta). The six view chunks stay separate files.
   - CSS `index-BNXJTUPd.css` 53,895 B / 10,526 B gzip: the same file as Phase 143, 0 delta.
8. **Inputs for Surprises and Deliberately not done** (from the three tasks' spec, build and review files):
   - T797: `React.lazy` still suspends and commits `ViewLoadingFallback` for a chunk that is already fetched; React's fallback throttle then kept the skeleton up for about 260 ms (spec author's jsdom measurement, React 19.2.8; ADR 0104 Context and option (a)). Hence `lazyView` reads a memoised promise with `use()`, marked `status = 'fulfilled'` when it settles. The unit file was red only by absence (`src/utils/lazyView.tsx` is new and untracked), so the review reproduced the red check through the Playwright spec (stash of `src/App.tsx`: 2 failed, only Dashboard requested) and not through the unit file; the build report's unit test titles differ from the file (review non-blocking).
   - T797 not done: the four shell modals stay on `React.lazy` (ADR 0010); no `navigator.connection.saveData` / `effectiveType` gate (ADR 0104 Revisit if); no `<link rel="modulepreload">` (the inline script's CSP hash in `vercel.json`); all views mounted at once stays rejected (ADR 0005); the `runWhenIdle` global `requestIdleCallback` branch duplicates the `window` branch (review non-blocking).
   - T798 not done: overlapping loads: the first load to finish clears `isSyncing` while a second still runs; pre-existing, no counter added (T798 spec section 9, ADR 0026 Amendment Consequences). The amendment cites `FinanceContext.tsx:890` for `setIsSyncing(true)`, which now sits at `:898` (`grep -n` at `5a16b79`); `unit/navbar-sync-badge.test.tsx`'s `afterEach` uses `vi.restoreAllMocks()` (review non-blocking). No Playwright spec signs in, so the signed-in badge is covered by unit tests only.
   - T799 surprise: `update_transaction` (reverse then apply) and `create_wallet` with an opening balance update one wallet row twice in one transaction; the first echo consumed the id's mark, so the second echo reloaded (ADR 0003 Amendment Context gap 2). The two diary red tests saw 2 reloads, not the 1 the build report gave (the save's own `refreshFromCloud()` plus the echo reload; review non-blocking).
   - T799 not done: the two limits in the ADR 0003 Amendment (`:64-65`): (1) an echo that arrives more than 400 ms before its own HTTP response still triggers one reload (a redundant read, not a wrong state); (2) a change another device makes to a row this client wrote in the last 5 s, with no other row touched, waits for the next sync trigger. Also: `import_transactions` returning its rows or client-supplied insert ids (needs a migration); `deleteDiaryEntry` unchanged; the 400 ms / 5 s / 30 s constants unchanged; `markLocalWrite` called twice for one id keeps the first timer (pre-existing); the diary save sets state after an `await` without the sign-out epoch check (matches the other writes); the amendment cites no `file:line` (review non-blocking); the real Realtime ordering is not exercised in a browser.
9. **File lengths:** `refactor-log.md` 106 lines, `baseline-metrics.md` 145, `task-ledger.md` 155. After this task about 116, 155 and 156: the ledger is already past the ~150 archive threshold (`docs/audit/README.md:40`) and the metrics file crosses it. Archiving is not in this order (section 9); the refactor-log records it under Deliberately not done. All six files are `w/crlf` (`git ls-files --eol`).

## 5. Parity map

none.

## 6. Tests to add

none. Docs-only; the change cannot alter behaviour. Stage 02 step 4 and stage 03 step 6 do not apply.

## 6a. Edits (exact)

Order: run gates 1 to 5 of section 7 first (they measure the figures the edits record), then make the edits, then run gates 6 onward. Keep CRLF in every file. Placeholders: `<X>` is the seconds of gate 1's unit run (two decimals); `<P>`, `<S>`, `<M>` are gate 5's passed count, skipped count and minutes (one decimal).

1. **`AGENTS.md:11`**: replace `1475 tests, 66 files` with `1500 tests, 68 files`, and `181 tests, 35 specs, 543 runs` with `183 tests, 36 specs, 549 runs`. Nothing else in `AGENTS.md`.

2. **`README.md`**:
   - `:10`: `Playwright-181%20E2E%20tests` becomes `Playwright-183%20E2E%20tests`.
   - `:157`: `1475 tests in 66 files` becomes `1500 tests in 68 files`.
   - `:158`: `181 tests in 35 spec files` becomes `183 tests in 36 spec files`, and `(543 runs)` becomes `(549 runs)`.
   - Nothing else.

3. **`docs/contexts/ui-and-e2e.md:66`**: replace `181 tests in 35 specs on Chromium, Firefox and WebKit: 543 runs, 537 pass, 6 skip by design` with `183 tests in 36 specs on Chromium, Firefox and WebKit: 549 runs, <P> pass, <S> skip by design`. Expect `<P>` 543 and `<S>` 6; if gate 5 gives any failure, or a skip count other than 6, stop and report it in the build report instead of writing any count. Nothing else in the file.

4. **`docs/audit/baseline-metrics.md`**: insert this block after `## Figures` and its blank line (`:24-25`), above `### Phase 143 - delta against Phase 142`. If gate 3 prints a different entry name, CSS name or byte count than below, stop and report it instead of writing the block. Leave out a `Measured at <sha>` line; the post-merge deploy record adds it.

   ```markdown
   ### Phase 144 - delta against Phase 143

   - **Entry chunk** `index-BI7UeuqQ.js`: 194,575 B (+1,282 B), 56,930 B gzip (+502 B against Phase 143 `index-TU2ZOqF8.js`, 193,293 / 56,428): T797's `lazyView` and idle preload gave +749 B at its own build (`index-CKmfyoLI.js`, 194,042 B), T798 and T799 the other +533 B.
   - **All app JS**: 886,280 B (+1,293 B), 269,243 B gzip (+487 B against Phase 143 884,987 / 268,756, 39 files, 0 file delta; the six view chunks stay separate files).
   - **CSS**: `index-BNXJTUPd.css`: 53,895 B (0 delta), 10,526 B gzip (0 delta; the same file as Phase 143).
   - **Vitest**: 68 files, 1500 tests (+25 tests, +2 files against Phase 143: `unit/lazy-view.test.tsx`, 5 tests from T797; `unit/navbar-sync-badge.test.tsx`, 8 tests from T798; `unit/authenticated-ledger.test.tsx`, +3 from T798 and +9 from T799), 1500 passed in <X> s (`workflow/stages/02_build/output/logs/T800-unit.log`). Per-task runs: T797 1480 passed in 54.02 s, T798 1491 in 74.62 s, T799 1500 in 71.35 s (`workflow/stages/02_build/output/logs/T79N-unit.log`).
   - **Playwright**: `npx playwright test --list` reports 183 tests in 36 files, 549 runs across 3 projects (+2 tests, +1 file, +6 runs: T797's `tests/tab-preload.spec.ts`). Full run by T800, at the owner's request: <P> passed, <S> skipped, 0 failed across 3 projects (<M> min, `workflow/stages/02_build/output/logs/T800-playwright.log`). Earlier full run at 183 tests: T797, 543 passed, 6 skipped (10.8 min).

   ```

5. **`docs/audit/refactor-log.md`**: insert this block after the `---` that follows the template (`:20`) and its blank line, above `## Phase 143 - ...` (`:22`), followed by a blank line, `---` and a blank line. Keep `docs <sha>` and `merged <sha>` literal; fill `<X>`, `<P>`, `<S>`, `<M>`.

   ```markdown
   ## Phase 144 - Smooth sync and tabs: T797-T800 (2026-10-23, code `8633c17` to `5a16b79`, docs `<sha>`, merged `<sha>`)

   ADR `0104`, with amendments to ADR `0026` (T798) and ADR `0003` (T799). Makes the app feel smoother without changing what it loads or writes: all six tab views are fetched after first paint so a tab switch skips the loading outline, the Syncing badge shows at once only for a load the user starts and after 1 s for any other, and a save on this client no longer triggers a full cloud reload through its own realtime echoes.

   **Changed:** T797 (`8633c17`: ADR 0104; `src/utils/lazyView.tsx`: new, `lazyView` (a memoised `import()` read with `use()`, marked `fulfilled` when it settles, forgotten on rejection) and `runWhenIdle` (`requestIdleCallback` with a 3 s timeout, else `setTimeout` 1 s); `src/App.tsx`: the six tab views move from `React.lazy` to `lazyView` and `MainApp` preloads all six through `runWhenIdle`, the four shell modals stay on `React.lazy`; `unit/lazy-view.test.tsx`: new, 5 tests; `tests/tab-preload.spec.ts`: new, 2 tests; `tests/helpers.ts`: `gotoTab` comment; `docs/audit/test-selector-contract.md`: the new spec's bullet; `docs/contexts/ui-and-e2e.md`: the `lazyView` rule; `docs/audit/task-ledger.md`: Phase 144 section). T798 (`2868d31`: ADR 0026 Amendment (T798); `src/context/FinanceContext.tsx`: `isManualSync`, true while a load started with `refreshFromCloud({ manual: true })` runs; `src/components/navbar/NavbarLedgerStatus.tsx`: `NavbarSyncBadge` shows Syncing when `isSyncing && (isManualSync || the load has run 1 s)`, the 1 s timer in the badge, and its Sync failed button passes `manual: true`; `src/components/account/AccountModal.tsx`: Sync now passes `manual: true`; `unit/navbar-sync-badge.test.tsx`: new, 8 tests; `unit/authenticated-ledger.test.tsx`: +3 tests; `DESIGN.md`: the Syncing row; `docs/contexts/client-state.md`: `isManualSync` and the badge rule). T799 (`5a16b79`: ADR 0003 Amendment (T799); `src/context/FinanceContext.tsx`: known ids marked before the call (TRANSFER's two wallets before `transfer_funds`, the CSV import's wallets and debts before its RPC and the inserted ids after it), the realtime handler judges pending ids when the 400 ms debounce fires, and an echo no longer consumes its mark; `src/context/DiaryContext.tsx`: the diary save marks a known id before the update and applies the returned row instead of calling `refreshFromCloud()`; `unit/authenticated-ledger.test.tsx`: +9 tests, an echo-capable fake channel, one test renamed; `docs/contexts/client-state.md`: the "Own echoes never reload" rule). T800 (`AGENTS.md`, `README.md` and `docs/contexts/ui-and-e2e.md`: unit 1500 tests in 68 files, Playwright 183 tests in 36 specs, 549 runs; `docs/audit/baseline-metrics.md`: Phase 144 section; `docs/audit/task-ledger.md`: T797 to T799 commits and the T800 row; this file).
   **Verified:** T797: Red gate verified (missing unit file + tab-preload timed out waiting for 6 views); npm run lint clean; unit/lazy-view.test.tsx 5 passed; full unit 67 files 1480 passed (54.02s); tab-preload.spec.ts 2 passed (15.9s) + repeat-each=5 10 passed (21.1s); targeted e2e 7 specs on chr 53 passed (36.1s), 153 passed 6 skipped on 3 browsers (2.9m); full e2e 36 specs 543 passed 6 skipped on 3 browsers (10.8m); bundle verified (index-CKmfyoLI.js 194,042 B +749 B, total app JS 885,736 B +749 B 39 files, 6 view chunks, 0 named in index.html); CRLF kept; 0 em dashes. T798: Red gate verified (7 unit failed); npm run lint clean; related unit 6 files 199 passed; full unit 68/68 files 1491 passed (74.62s); e2e 4 specs on chr 30 passed (31.2s), 88 passed 2 skipped on 3 browsers (2.1m); CRLF kept (ADR 0026 w/lf); 0 em dashes; scope clean. T799: Red gate verified (7 unit failed, 2 passed); npm run lint clean; related unit 7 files 218 passed; shuffle 3x 139 passed; full unit 68/68 files 1500 passed (71.35s); e2e 7 specs on chr 27 passed (33.3s), 81 passed on 3 browsers (2.3m); CRLF kept (ADR 0003 w/lf); 0 em dashes in diff; scope clean. T800: full unit 68 files 1500 passed (<X>s); playwright list 183 tests in 36 files, 549 runs; full e2e 36 specs <P> passed <S> skipped on 3 browsers (<M>m); clean production build index-BI7UeuqQ.js 194,575 B / 56,930 B gzip, all app JS 886,280 B / 269,243 B gzip, 39 files, CSS index-BNXJTUPd.css 53,895 B / 10,526 B gzip; CRLF kept across 6 touched files; 0 em dashes in git diff. T797, T798 and T799 were APPROVED in round 1; each review reran the red check by stashing the source files.
   **Surprises:** (a) T797: fetching a view's chunk early is not enough: `React.lazy` still suspends on the first render of a chunk that is already loaded, commits `ViewLoadingFallback`, and React's fallback throttle kept the skeleton up for about 260 ms (jsdom, React 19.2.8; ADR 0104 option (a)). `lazyView` reads a memoised promise with `use()` and marks it `fulfilled` itself, so a preloaded view renders on the first pass. (b) T797's unit file was red only by absence (`lazyView.tsx` is new and untracked, so a stash cannot remove it); the review reproduced the red check through `tests/tab-preload.spec.ts` with `src/App.tsx` stashed (2 failed, only Dashboard requested). (c) T799: `update_transaction` (reverse then apply) and `create_wallet` with an opening balance update one wallet row twice in one transaction; the first echo used to consume the id's mark, so the second echo reloaded everything. Marks now last their full 5 s. (d) T799's two diary red tests saw 2 reloads, not the 1 the build report gave: the save's own `refreshFromCloud()` plus the echo reload.
   **Deliberately not done:** overlapping loads: the first load to finish still clears `isSyncing` while a second runs, so the badge can drop Syncing early (pre-existing; T798 added no load counter, ADR 0026 Amendment Consequences); the two limits in the ADR 0003 Amendment: an echo that arrives more than 400 ms before its own HTTP response still triggers one reload (a redundant read, not a wrong screen), and a change another device makes to a row this client wrote in the last 5 s, with no other row touched, waits for the next sync trigger (a write to another row, reconnect, a tab return after 30 s, or Sync now); `import_transactions` returning its rows or client-supplied insert ids, so the CSV import keeps its one reload (needs a migration); `deleteDiaryEntry`, the 400 ms, 5 s and 30 s constants, and `markLocalWrite` keeping the first timer when one id is marked twice (pre-existing; at worst one extra read); the shell modals stay on `React.lazy` (ADR 0010) and are not preloaded; a `saveData` or `effectiveType` gate on the preload, and `<link rel="modulepreload">` (the inline script's CSP hash in `vercel.json`); a signed-in browser check of the badge and of echo ordering (no spec signs in; unit tests only, the fake channel modelling the echo-before-response worst case); the nits from non-blocking review notes, since this task is docs-only (T797: `runWhenIdle`'s global `requestIdleCallback` branch duplicates the `window` one; T798: the ADR 0026 amendment cites `FinanceContext.tsx:890` for `setIsSyncing(true)`, now `:898`, and `vi.restoreAllMocks()` in `unit/navbar-sync-badge.test.tsx`; T799: the ADR 0003 amendment cites no `file:line`, and the diary save sets state after an `await` without the sign-out epoch check, as the other writes do); archiving `task-ledger.md` (156 lines) and `baseline-metrics.md` (about 155), both now past the ~150-line threshold in `docs/audit/README.md`, left for a separate task.

   ---
   ```

   If gate 9 gives a `baseline-metrics.md` line count other than 155, write the real number in place of `about 155`; likewise `156` for `task-ledger.md`.

6. **`docs/audit/task-ledger.md`** (Phase 144 table only):
   - Commit cells: T797 (`:100`) `8633c17`, T798 (`:101`) `2868d31`, T799 (`:102`) `5a16b79`. Change no other cell of those rows.
   - Add the T800 row after `:102`:
     - `#`: `T800`
     - Task: `Phase 144 closing docs: refactor-log entry, baseline-metrics section, T797 to T799 Commit cells, unit 1500 / 68 files and Playwright 183 / 36 / 549 in AGENTS.md, README.md and ui-and-e2e.md; full Playwright run`
     - Files: `` `AGENTS.md`, `README.md`, `docs/contexts/ui-and-e2e.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, `docs/audit/task-ledger.md` ``
     - Status: `done` (flip to `in-progress` when starting)
     - Commit: empty
     - Gate result: `unit 68 files 1500 passed (<X>s); playwright list 183/36/549; full e2e 36 specs <P> passed <S> skipped on 3 browsers (<M>m); clean prod build (index-BI7UeuqQ.js 194,575 B, all app JS 886,280 B 39 files, CSS 53,895 B); CRLF kept; 0 em dashes`
   - Do not edit the heading `:94`, the branch line `:96`, any earlier phase, the Backlog or the template.

## 7. Gates

Docs-only tier: nothing mandatory beyond checking every stated count, path and sha; the owner adds the full Playwright run (`npm test`), and the unit run and build supply the recorded figures. Commands (PowerShell, from the repo root):

```powershell
# 1-5: before any edit
npm run test:unit *> workflow/stages/02_build/output/logs/T800-unit.log    # expect 68 files, 1500 passed; record seconds as <X>
npx playwright test --list | Select-Object -Last 1                         # expect "Total: 549 tests in 36 files"; starts no server
if (Test-Path dist) { Remove-Item -Recurse -Force dist }; npm run build    # .env present; never read or print it
node -e "const fs=require('fs'),z=require('zlib'),p='dist/assets/';let t=0,g=0,n=0;for(const f of fs.readdirSync(p)){const b=fs.readFileSync(p+f),c=z.gzipSync(b,{level:9}).length;if(f.endsWith('.js')){t+=b.length;g+=c;n++}if(/^index-.*\.(js|css)$/.test(f))console.log(f,b.length,c)}console.log('allJS',t,g,n)"
netstat -ano | Select-String ':3000 |:3100 ' | Select-String LISTENING      # expect nothing; stop any stale server you started, else report
npm test *> workflow/stages/02_build/output/logs/T800-playwright.log      # all 36 specs, 3 browsers; record <P>, <S>, <M>

# 6 onward: after the edits
git log --format=%h -1 --grep="(T797)"; git log --format=%h -1 --grep="(T798)"; git log --format=%h -1 --grep="(T799)"
git diff -U0 HEAD -- AGENTS.md README.md docs/contexts/ui-and-e2e.md
git grep -n "1475\|66 files\|181 \|181%\|543 runs\|35 spec" -- AGENTS.md README.md docs/contexts/ui-and-e2e.md   # expect nothing (exit 1)
git ls-files --eol AGENTS.md README.md docs/contexts/ui-and-e2e.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md
node -e "for(const f of process.argv.slice(1)){const s=require('fs').readFileSync(f,'utf8');console.log(f,'crlf',s.split('\r\n').length-1,'bareLF',s.split('\n').length-s.split('\r\n').length)}" AGENTS.md README.md docs/contexts/ui-and-e2e.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
(Get-Content docs/audit/task-ledger.md).Count; (Get-Content docs/audit/refactor-log.md).Count; (Get-Content docs/audit/baseline-metrics.md).Count
git status --porcelain
```

Expect:
- Unit: 68 files, 1500 passed, 0 failed.
- Playwright list: `Total: 549 tests in 36 files`.
- Bundle: `index-BI7UeuqQ.js 194575 56930`, `index-BNXJTUPd.css 53895 10526`, `allJS 886280 269243 39`. Any difference: report it, do not write the metrics block (6a step 4).
- Ports 3000 and 3100 free before the run.
- Full Playwright: 0 failed; expect 543 passed, 6 skipped. Any failure: rerun the failing spec once alone on its project and report both results; do not write the counts until the owner or reviewer decides.
- Shas: `8633c17`, `2868d31`, `5a16b79`.
- `git diff -U0`: `AGENTS.md` one changed line; `README.md` three; `ui-and-e2e.md` one. Nothing else.
- The `git grep` check: no output.
- All six files `w/crlf`, `bareLF 0`.
- Em dash count: `0`.
- Line counts: about 156, 116 and 155 (ledger, refactor-log, metrics); the two counts named in the refactor-log's last Deliberately not done item match.
- `git status --porcelain`: only the 5 Target files, `docs/audit/task-ledger.md` and `workflow/stages/*/output/` files (`dist/` is gitignored).

## 8. Production touch points

none. (`AGENTS.md` triggers the automatic pause; it is not a production touch point.) The full Playwright run is hermetic, spends no TypeSafe credits and signs in nowhere. The owner's post-merge deploy record on `main` later fills the `<sha>` placeholders in `refactor-log.md`, the T800 Commit cell, the branch line `:96`, and the `Measured at` line in `baseline-metrics.md`.

## 9. Out of scope

- Any code, test, config, script or SQL file, including the nits listed under Deliberately not done (`runWhenIdle`'s duplicate branch, `vi.restoreAllMocks()`); `.claude/agents/`; the `workflow/stages/*/CONTEXT.md` files.
- The ADRs: ADR 0104, the ADR 0026 Amendment (its stale `:890` citation) and the ADR 0003 Amendment stay as committed; no new ADR.
- Any other line of `AGENTS.md`, `README.md` or `docs/contexts/ui-and-e2e.md`; `DESIGN.md`, `docs/contexts/client-state.md`, `docs/audit/test-selector-contract.md`.
- The T797 to T799 rows' Task, Files, Status and Gate result cells; the Phase 144 heading and branch line; earlier phases; every Backlog row; the template.
- Historical counts in earlier `refactor-log.md` and `baseline-metrics.md` entries, ADRs and stage outputs.
- Archiving any `docs/audit/` file (recorded as not done; a separate task the owner can order); any request to production `/api/*`; any live Supabase SQL.
