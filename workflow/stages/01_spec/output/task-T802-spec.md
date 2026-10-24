# Spec: T802

Phase 145, branch `phase-145-one-load-per-session`, cut from `main` at `c9269ba`. Docs-only; this task ships the phase. T802 is free: the ledger's highest id is T801 (`docs/audit/task-ledger.md:111`) and no `task-T802-*` stage file exists. Format model: the Phase 144 closing task T800 (`237684e`, `workflow/stages/01_spec/output/task-T800-spec.md`).

## 1. Goal

Close Phase 145 on paper, in the T800 pattern: the `refactor-log.md` entry for T801-T802 (with Surprises and Deliberately not done), the `baseline-metrics.md` Phase 145 section against Phase 144, the ledger Commit cell for T801 (`8fe3e93`) and the T802 row, and the unit count in `AGENTS.md` and `README.md`, measured from the code. The order also asks for one full Playwright run (`npm test`), recorded in the ledger, the metrics and the refactor-log.

## 2. Target files

```
AGENTS.md
README.md
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
```

Bookkeeping, always allowed: `docs/audit/task-ledger.md` (the T801 Commit cell and the T802 row; section 6a step 5).

- The Playwright figures did not move in Phase 145 (section 4 item 5), so `README.md:10`, `README.md:158` and `docs/contexts/ui-and-e2e.md:66` stay as they are. `docs/contexts/ui-and-e2e.md` is not a target; if the full run disagrees with its `543 pass, 6 skip`, the builder stops and reports (section 7).
- **Pause list:** `AGENTS.md` is a target, so the orchestrator pauses for the owner's go-ahead before `build T802`. The `AGENTS.md` edit is one number on line 11 and nothing else.

## 3. Context to read

none (docs-only). The builder reads, as the shapes to copy: the template block and the Phase 144 entry at the top of `docs/audit/refactor-log.md` (`:7-30`), the Phase 144 section of `docs/audit/baseline-metrics.md` (`:26-34`), and the Phase 144 and 145 sections of `docs/audit/task-ledger.md` (`:94-111`).

## 4. Current behaviour

1. **ADR:** ADR 0105 (`docs/audit/decisions/0105-one-cloud-load-per-session.md`, new in T801). No new ADR for T802.
2. **Phase 145 commits** (`git log --oneline main..HEAD`, verified by the spec author): T801 `8fe3e93` only, 2026-10-24. Merge base with `main` is `c9269ba`.
3. **Review:** T801 CHANGES REQUESTED in round 1 (the `isSeedingRef` comment at `FinanceContext.tsx:765-770` and the `docs/contexts/supabase-ledger.md:62` bullet did not match the spec's verbatim text; the comment said the ref guards loads, not seeds), APPROVED in round 2 (`workflow/stages/03_review/output/task-T801-review.md`). Round 1 reran the red check by stashing `src/context/FinanceContext.tsx`: 4 failed, 2 passed. The reviewer did not rerun the builder's negative control.
4. **Ledger** (`docs/audit/task-ledger.md:105-111`): heading `:105`, branch line `:107` (`cut from main at c9269ba.`), row T801 `:111`, `done` with an empty Commit cell and a filled Gate result. No T802 row. No Backlog row is touched. File is 164 lines.
5. **Counts** (spec author, at `8fe3e93`):
   - Unit: 68 files (`ls unit` gives 68 `*.test.ts(x)`), 1506 tests (`workflow/stages/02_build/output/logs/T801-unit.log`: 68 passed, 1506 passed, 71.65 s; the T801 review's two runs also 1506). Delta against Phase 144: +6 tests, 0 files, all in `unit/authenticated-ledger.test.tsx` (T801's new describe). Stale statements: `AGENTS.md:11` (`1500 tests, 68 files`), `README.md:157` (`1500 tests in 68 files`). `git grep "1500 tests"` outside history files finds only these two.
   - Playwright: `npx playwright test --list` prints `Total: 549 tests in 36 files`; `--project=chromium` prints `Total: 183 tests in 36 files`. 0 delta; `AGENTS.md:11`, `README.md:10`, `README.md:158` and `docs/contexts/ui-and-e2e.md:66` already say 183 / 36 / 549. The last full run: T800, 543 passed, 6 skipped (12.8 min). T801 ran 3 specs only (27 on chromium, 81 on three browsers).
6. **Bundle** (spec author, `npm run clean` then `npm run build` exit 0, `.env` present, gzip level 9 over `dist/assets`, at `8fe3e93`):
   - Entry `index-CDIxbGVL.js` 194,525 B / 56,955 B gzip (Phase 144 `index-BI7UeuqQ.js` 194,575 / 56,930: -50 / +25). `adoptSession` replaced the two copies of the profile block in the auth effect (`git show 8fe3e93 -- src/context/FinanceContext.tsx`).
   - All app JS 886,230 B / 269,261 B gzip, 39 files (Phase 144 886,280 / 269,243: -50 / +18, 0 file delta).
   - CSS `index-BNXJTUPd.css` 53,895 B / 10,526 B gzip: the same file as Phase 144, 0 delta.
7. **Inputs for Surprises and Deliberately not done** (from T801's spec, build, review and ADR 0105):
   - supabase-js 2.116.0 notifies `SIGNED_IN` on every hidden-to-visible tab return (`_onVisibilityChanged` to `_recoverAndRefresh`, `GoTrueClient.js:4747`, `:4165`), so a filter on the event name would have left the tab-return reload; the fix keys on the user id (ADR 0105 option (a) rejected).
   - Every signed-in open ran two full loads back to back: the `getSession()` load, then the `INITIAL_SESSION` that `onAuthStateChange` emits on subscribe (`:3631-3669`). The Phase 30 `isSeedingRef` comment described that overlap as expected.
   - Five tests in `unit/authenticated-ledger.test.tsx` used a synthetic `SIGNED_IN` or `TOKEN_REFRESHED` to start a mid-flight reload; under the change they would fail or pass without testing anything (T801 spec section 4), so they now call `actions().refreshFromCloud()`.
   - T801 not done (spec section 13, build section 4, review): the realtime effect (`scheduleReload`, `handleVisible`, `CLOUD_STALE_AFTER_MS`, `verifySession`) unchanged, so a tab return reloads only through the 30 s rule (ADR 0023); `NavbarSyncBadge`'s 1 s timer unchanged, so a cold load over 1 s still shows Syncing (ADR 0026 amendment); the seed flow and `isSeedingRef` behaviour unchanged (a startup load can still overlap an `online` or Sync now reload); guests unchanged; supabase-js not upgraded or pinned (ADR 0105 cites auth-js 2.116.0 lines); no signed-in browser check (real credentials are stop-and-ask; real auth-js timing is the owner's post-merge check); two pre-existing em dashes in the header comment of `unit/authenticated-ledger.test.tsx:24-25` (review round 2 non-blocking, not user-facing).
8. **File lengths:** `refactor-log.md` 117 lines, `baseline-metrics.md` 155, `task-ledger.md` 164. After this task: about 128, 163 and 165. The ledger and the metrics file are past the ~150-line threshold (`docs/audit/README.md:40`), as T800 already recorded. Archiving is not in this order (section 9); the refactor-log records it under Deliberately not done. All five files are `w/crlf` (`git ls-files --eol`).

## 5. Parity map

none.

## 6. Tests to add

none. Docs-only; the change cannot alter behaviour. Stage 02 step 4 and stage 03 step 6 do not apply.

## 6a. Edits (exact)

Order: run gates 1 to 6 of section 7 first (they measure the figures the edits record), then make the edits, then run gates 7 onward. Keep CRLF in every file. Placeholders: `<X>` is the seconds of gate 1's unit run (two decimals); `<P>`, `<S>`, `<M>` are gate 6's passed count, skipped count and minutes (one decimal). Expect `<P>` 543 and `<S>` 6.

1. **`AGENTS.md:11`**: replace `1500 tests, 68 files` with `1506 tests, 68 files`. Nothing else in `AGENTS.md`.

2. **`README.md:157`**: replace `1500 tests in 68 files` with `1506 tests in 68 files`. Nothing else in `README.md`.

3. **`docs/audit/baseline-metrics.md`**: insert this block after `## Figures` and its blank line (`:24-25`), above `### Phase 144 - delta against Phase 143`. If gate 4 prints a different entry name, CSS name or byte count than below, stop and report it instead of writing the block. Leave out a `Measured at <sha>` line; the post-merge deploy record adds it.

   ```markdown
   ### Phase 145 - delta against Phase 144

   - **Entry chunk** `index-CDIxbGVL.js`: 194,525 B (-50 B), 56,955 B gzip (+25 B against Phase 144 `index-BI7UeuqQ.js`, 194,575 / 56,930): T801's `adoptSession` replaces the two copies of the profile block in the auth effect.
   - **All app JS**: 886,230 B (-50 B), 269,261 B gzip (+18 B against Phase 144 886,280 / 269,243, 39 files, 0 file delta).
   - **CSS**: `index-BNXJTUPd.css`: 53,895 B (0 delta), 10,526 B gzip (0 delta; the same file as Phase 144).
   - **Vitest**: 68 files, 1506 tests (+6 tests, 0 files against Phase 144: `unit/authenticated-ledger.test.tsx`, +6 from T801), 1506 passed in <X> s (`workflow/stages/02_build/output/logs/T802-unit.log`). Per-task run: T801 1506 passed in 71.65 s (`workflow/stages/02_build/output/logs/T801-unit.log`).
   - **Playwright**: `npx playwright test --list` reports 183 tests in 36 files, 549 runs across 3 projects (0 delta). Full run by T802, at the owner's request: <P> passed, <S> skipped, 0 failed across 3 projects (<M> min, `workflow/stages/02_build/output/logs/T802-playwright.log`). Earlier full run at 183 tests: T800, 543 passed, 6 skipped (12.8 min).

   ```

4. **`docs/audit/refactor-log.md`**: insert this block after the `---` that follows the template (`:20`) and its blank line, above `## Phase 144 - ...` (`:22`), followed by a blank line, `---` and a blank line. Keep `docs <sha>` and `merged <sha>` literal; fill `<X>`, `<P>`, `<S>`, `<M>`.

   ```markdown
   ## Phase 145 - One cloud load per session: T801-T802 (2026-10-24, code `8fe3e93`, docs `<sha>`, merged `<sha>`)

   ADR `0105`. Opening the app signed in reads the account from the cloud once: the auth listener loads only when a different user signs in, and a session-ready event, a token refresh, a return to the tab or a rename for the user already loaded only updates a changed profile field.

   **Changed:** T801 (`8fe3e93`: ADR 0105; `src/context/FinanceContext.tsx`: `loadedUserIdRef` (set before the load starts, cleared in `resetToGuestState`) and an inner `adoptSession` that the startup `getSession()` path and the `onAuthStateChange` handler both call; it keeps the same `currentUser` object when `id`, `email` and `name` are unchanged and loads only for a different user id; the `isSeedingRef` comment rewritten; `unit/authenticated-ledger.test.tsx`: +6 tests in `one cloud load per signed-in user (T801, ADR 0105)`, and five existing tests start their reload with `refreshFromCloud()` instead of a synthetic `SIGNED_IN` or `TOKEN_REFRESHED`; `docs/contexts/supabase-ledger.md`: the "One cloud load per signed-in user" rule and `0105` in the Accounts and sessions heading; `docs/audit/task-ledger.md`: Phase 145 section). T802 (`AGENTS.md` and `README.md`: unit 1506 tests in 68 files; `docs/audit/baseline-metrics.md`: Phase 145 section; `docs/audit/task-ledger.md`: the T801 commit and the T802 row; this file).
   **Verified:** T801: Red gate verified (4 unit failed, 2 passed); npm run lint clean; related unit 2 files 148 passed (50.09s); full unit 68 files 1506 passed (71.65s); targeted e2e 3 specs on chr 27 passed (51.0s), 81 passed on 3 browsers (2.0m); negative control verified; CRLF kept; 0 em dashes; scope clean. T802: full unit 68 files 1506 passed (<X>s); playwright list 183 tests in 36 files, 549 runs; full e2e 36 specs <P> passed <S> skipped on 3 browsers (<M>m); clean production build index-CDIxbGVL.js 194,525 B / 56,955 B gzip, all app JS 886,230 B / 269,261 B gzip, 39 files, CSS index-BNXJTUPd.css 53,895 B / 10,526 B gzip; CRLF kept across 5 touched files; 0 em dashes in git diff. The T801 review requested changes in round 1 and approved in round 2; round 1 reran the red check by stashing `src/context/FinanceContext.tsx` (4 failed, 2 passed).
   **Surprises:** (a) supabase-js notifies `SIGNED_IN` again on every return to the tab (`_onVisibilityChanged` to `_recoverAndRefresh`, auth-js 2.116.0 `GoTrueClient.js:4747`, `:4165`), so loading only on `SIGNED_IN` would have kept the tab-return reload; the fix keys on the user id (ADR 0105 option (a) rejected). (b) Every signed-in open ran two full loads back to back: the `getSession()` load, then the `INITIAL_SESSION` that `onAuthStateChange` emits on subscribe (`:3631-3669`); the Phase 30 `isSeedingRef` comment described that overlap as expected. (c) Five tests in `unit/authenticated-ledger.test.tsx` used a synthetic auth event to start a mid-flight reload; after the change three would fail and two would pass without testing anything, so they now call `refreshFromCloud()`. (d) T801 round 1: the builder's `isSeedingRef` comment said the ref guards loads rather than seed calls, and the context bullet read as if `INITIAL_SESSION` were always ignored; the fix round took the spec's text verbatim. (e) The entry chunk shrank 50 B raw but grew 25 B gzip.
   **Deliberately not done:** the realtime effect (`scheduleReload`, `handleVisible`, `CLOUD_STALE_AFTER_MS`, `verifySession`) is unchanged, so a return to the tab reloads only through the 30 s rule (ADR 0023); `NavbarSyncBadge`'s 1 s timer is unchanged, so one cold load over 1 s still shows Syncing (ADR 0026 amendment); the seed flow and `isSeedingRef` keep their behaviour, and a startup load can still overlap an `online` or Sync now reload; guests are unchanged; supabase-js is not upgraded or pinned, though ADR 0105 cites auth-js 2.116.0 line numbers; a signed-in browser check of the one load (no spec signs in; real credentials are stop-and-ask, so real auth-js timing is the owner's post-merge check), and the T801 review did not rerun the builder's negative control; the two pre-existing em dashes in the header comment of `unit/authenticated-ledger.test.tsx` (not user-facing; this task is docs-only); archiving `task-ledger.md` (165 lines) and `baseline-metrics.md` (163 lines), both past the ~150-line threshold in `docs/audit/README.md` for a second phase, left for a separate task.

   ---
   ```

   If gate 12 gives line counts other than 165 (ledger) and 163 (metrics), write the real numbers in the last Deliberately not done item.

5. **`docs/audit/task-ledger.md`** (Phase 145 table only):
   - Commit cell: T801 (`:111`) `8fe3e93`. Change no other cell of that row.
   - Add the T802 row after `:111`:
     - `#`: `T802`
     - Task: `Phase 145 closing docs: refactor-log entry, baseline-metrics section, T801 Commit cell, unit 1506 / 68 files in AGENTS.md and README.md; full Playwright run`
     - Files: `` `AGENTS.md`, `README.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, `docs/audit/task-ledger.md` ``
     - Status: `done` (flip to `in-progress` when starting)
     - Commit: empty
     - Gate result: `unit 68 files 1506 passed (<X>s); playwright list 183/36/549; full e2e 36 specs <P> passed <S> skipped on 3 browsers (<M>m); clean prod build (index-CDIxbGVL.js 194,525 B, all app JS 886,230 B 39 files, CSS 53,895 B); CRLF kept; 0 em dashes`
   - Do not edit the heading `:105`, the branch line `:107`, any earlier phase, the Backlog or the template.

## 7. Gates

Docs-only tier: nothing mandatory beyond checking every stated count, path and sha; the order adds the full Playwright run (`npm test`), and the unit run and build supply the recorded figures. Commands (PowerShell, from the repo root):

```powershell
# 1-6: before any edit
npm run test:unit *> workflow/stages/02_build/output/logs/T802-unit.log    # expect 68 files, 1506 passed; record seconds as <X>
npx playwright test --list | Select-Object -Last 1                         # expect "Total: 549 tests in 36 files"; starts no server
if (Test-Path dist) { Remove-Item -Recurse -Force dist }; npm run build    # .env present; never read or print it
node -e "const fs=require('fs'),z=require('zlib'),p='dist/assets/';let t=0,g=0,n=0;for(const f of fs.readdirSync(p)){const b=fs.readFileSync(p+f),c=z.gzipSync(b,{level:9}).length;if(f.endsWith('.js')){t+=b.length;g+=c;n++}if(/^index-.*\.(js|css)$/.test(f))console.log(f,b.length,c)}console.log('allJS',t,g,n)"
netstat -ano | Select-String ':3000 |:3100 ' | Select-String LISTENING      # expect nothing; stop any stale server you started, else report
npm test *> workflow/stages/02_build/output/logs/T802-playwright.log      # all 36 specs, 3 browsers; record <P>, <S>, <M>

# 7 onward: after the edits
git log --format=%h -1 --grep="(T801)"
git diff -U0 HEAD -- AGENTS.md README.md
git grep -n "1500 tests" -- AGENTS.md README.md docs/contexts/                # expect nothing (exit 1)
git ls-files --eol AGENTS.md README.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md
node -e "for(const f of process.argv.slice(1)){const s=require('fs').readFileSync(f,'utf8');console.log(f,'crlf',s.split('\r\n').length-1,'bareLF',s.split('\n').length-s.split('\r\n').length)}" AGENTS.md README.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
(Get-Content docs/audit/task-ledger.md).Count; (Get-Content docs/audit/refactor-log.md).Count; (Get-Content docs/audit/baseline-metrics.md).Count
git status --porcelain
```

Expect:
- Unit: 68 files, 1506 passed, 0 failed.
- Playwright list: `Total: 549 tests in 36 files`.
- Bundle: `index-CDIxbGVL.js 194525 56955`, `index-BNXJTUPd.css 53895 10526`, `allJS 886230 269261 39`. Any difference: report it, do not write the metrics block (6a step 3).
- Ports 3000 and 3100 free before the run.
- Full Playwright: 0 failed; expect 543 passed, 6 skipped (which also confirms `docs/contexts/ui-and-e2e.md:66`). Any failure, or a skip count other than 6: rerun the failing spec once alone on its project and report both results; do not write the counts until the owner or reviewer decides.
- Sha: `8fe3e93`.
- `git diff -U0`: `AGENTS.md` one changed line; `README.md` one. Nothing else.
- The `git grep` check: no output.
- All five files `w/crlf`, `bareLF 0`.
- Em dash count: `0`.
- Line counts: 165, 128 and 163 (ledger, refactor-log, metrics), give or take a line for the refactor-log; the two counts named in the refactor-log's last Deliberately not done item match.
- `git status --porcelain`: only the 4 Target files, `docs/audit/task-ledger.md` and `workflow/stages/*/output/` files (`dist/` is gitignored).

## 8. Production touch points

none. (`AGENTS.md` triggers the automatic pause; it is not a production touch point.) The full Playwright run is hermetic, spends no TypeSafe credits and signs in nowhere. The owner's post-merge deploy record on `main` later fills the `<sha>` placeholders in `refactor-log.md`, the T802 Commit cell, the branch line `:107`, and the `Measured at` line in `baseline-metrics.md`. The owner's own signed-in check of the deployed app (one load on open, none on a tab return within 30 s; T801 spec section 12) is not a task step.

## 9. Out of scope

- Any code, test, config, script or SQL file, including the two pre-existing em dashes in `unit/authenticated-ledger.test.tsx`'s header comment; `.claude/agents/`; the `workflow/stages/*/CONTEXT.md` files.
- ADR 0105 stays as committed; no new ADR.
- Any other line of `AGENTS.md` or `README.md` (the Playwright figures at `AGENTS.md:11`, `README.md:10` and `README.md:158` are already right); `docs/contexts/ui-and-e2e.md`, `docs/contexts/supabase-ledger.md`, `DESIGN.md`.
- The T801 row's Task, Files, Status and Gate result cells; the Phase 145 heading and branch line; earlier phases; every Backlog row; the template.
- Historical counts in earlier `refactor-log.md` and `baseline-metrics.md` entries, ADRs and stage outputs.
- Archiving any `docs/audit/` file (recorded as not done; a separate task the owner can order); any request to production `/api/*`; any live Supabase SQL.
