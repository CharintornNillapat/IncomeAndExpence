# T832 review

## Round 2

### Metadata

- Task: T832, wire ESLint's React hooks rules into `npm run lint` (Phase 161, branch `phase-161-finance-hooks-lint`, last task of the phase)
- Date: 2026-10-30
- Round: 2, after `fix T832` (build report `## Fix round 1`)
- Reviewer tier: strict
- Verdict: **APPROVED**
- Target files: unchanged from round 1 (seven targets plus the bookkeeping `docs/audit/task-ledger.md`); none is gitignored (round 1 check).

### Summary

The fix round changes the two closing-doc lines round 1 flagged and nothing else. `refactor-log.md` now cites T832's gate 5 as `(60.5s)`, so its `**Verified:**` line matches both ledger cells exactly. The `baseline-metrics.md` Vitest bullet now cites `60.49 s` and `T832-unit.log`. The code, config and other docs are as approved in round 1.

### Invariants and parity

- Blocking item 1 (`refactor-log.md:25`): fixed. A script builds `"**Verified:** T831 (" + T831 Gate result cell + "); T832 (" + T832 Gate result cell + ")."` from `task-ledger.md:130-131` and compares it to the one `**Verified:** T831` line: `verified-eq true` (`T832-r2-verified.log`).
- Blocking item 2 (`baseline-metrics.md:31`): fixed. The bullet reads `1625 passed in 60.49 s (`workflow/stages/02_build/output/logs/T832-unit.log`)`, and that log's `Duration` line says `60.49s`. The Phase 161 section no longer names `T831-unit.log`.
- Tree outside those two lines is unchanged since round 1. `git diff --numstat` is identical to round 1 gate 8 for all eight files (`package.json 2 2`, `eslint.config.js 3 2`, `AGENTS.md 2 2`, `README.md 3 3`, ADR `12 0`, refactor-log `11 0`, baseline `8 0`, ledger `3 2`). Only `refactor-log.md` (07:41:26) and `baseline-metrics.md` (07:41:36) have mtimes after round 1 ended (review file 07:40:47). The others are older: AGENTS, README, ADR and `eslint.config.js` 07:23, ledger 07:32, and `package.json` 07:37, which is my own round 1 stash pop. HEAD is still `e25ee1f`. So the round 1 code-gate logs (lint, timing, probe, unit, bundle) still apply.
- Parity map: no row touched, as in round 1. The forbidden-path `git diff --stat` (`src api unit tests supabase .github vercel.json .claude docs/contexts`, the stage `CONTEXT.md` files, ADR 0113, `package-lock.json`) is empty.

### Gates run

These are the gates the fix block lists. Logs are in `workflow/stages/03_review/output/logs/`.

| Gate | Command | Result |
|---|---|---|
| 1 | `node workflow/stages/02_build/output/logs/T832-gates.cjs text` | exit 0, `bad 0` (`T832-r2-text.log`) |
| 8 | `git diff --numstat` | identical to round 1; refactor-log `11 0`, baseline `8 0` |
| 10 | em dashes, line endings (node byte count) | 0 em dashes in either doc, the build report or the added diff lines; `baseline-metrics.md` crlf 109, bareLF 0 (`w/crlf`); `refactor-log.md` crlf 0 (`w/lf`); ledger crlf 0 |
| 11 | `git status --porcelain` | the 8 modified targets plus the 3 untracked T832 stage files; same as round 1's `T832-status-after.txt` plus this review file, which did not exist when that file was saved (`T832-r2-status.txt`) |
| extra | Verified-line equality script | `verified-eq true` (`T832-r2-verified.log`) |

No code gate rerun: only two doc lines changed since round 1, so round 1's runs stand: lint exit 0; unit 73 files, 1625 passed, 0 failed, 0 skipped; probe red exit 1 and green exit 0; bundle figures match.

### Not verified

- Byte-level comparison of the two docs against their round 1 state: I kept no round 1 snapshot. Numstat, mtimes and a full read of both diffs show only the two corrected values changed.
- Same items as round 1: gate 7 not rebuilt, and the CI `sh` run is left to the PR's `checks` job.

### Blocking

None.

### Non-blocking

- None new. Round 1's UTF-16 `T832-bundle.txt` note still applies to future runs.

### Rule candidates

- Round 1's candidate (check copied figures against their source cell by script) got a second, clean use here. It is still one defect occurrence, so do not promote it yet.

## Round 1

### Metadata

- Task: T832, wire ESLint's React hooks rules into `npm run lint` (Phase 161, branch `phase-161-finance-hooks-lint`, last task of the phase)
- Date: 2026-10-30
- Round: 1
- Reviewer tier: strict
- Verdict: **CHANGES REQUESTED**
- Target files: `docs/audit/decisions/0115-hooks-lint-joins-npm-run-lint.md`, `package.json`, `eslint.config.js`, `AGENTS.md`, `README.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, plus the bookkeeping file `docs/audit/task-ledger.md`. `git check-ignore -v` on all eight returns nothing (exit 1), so none is ignored and all show in the diff.

### Summary

`lint:hooks` becomes `eslint --max-warnings 0 --cache --cache-location .cache/eslint/ src api`, and `lint` keeps its four steps and appends `&& npm run lint:hooks`. The `eslint.config.js` header comment, the `AGENTS.md` Commands line and unit count, and the `README.md` Testing block are updated. ADR 0115 gets a T832 amendment, the ledger gets the T832 row and both Backlog rows are closed, and the Phase 161 closing docs are written. The code and config changes are exactly what the spec asks for and every mechanical gate passes. Two figures in the closing docs do not match the gate that produced them.

### Invariants and parity

- Parity map: no row touched. No `src/`, `api/`, `supabase/`, `index.html`, `vercel.json` or workflow file changed (gate 9's `git diff --stat` is empty). `package-lock.json` is unchanged.
- `eslint.config.js`: only comment lines changed (`git diff -U0`: 2 `-` and 3 `+` lines, all starting with `//`). The rules are still `exhaustive-deps: 'warn'` and `rules-of-hooks: 'error'`.
- `package.json`: only the two script lines changed. The helper checks that the other scripts and both dependency maps match `HEAD`, and that both scripts are shell-neutral. All OK.
- ADR 0115 is T831's text plus Edit 6, byte for byte, as the helper check `adr0115 is T831 text plus the amendment OK` confirms. ADR 0113 is unchanged.
- No stale text: outside history files (specs, reports, ADRs, the log), no live doc still calls `lint:hooks` opt-in or outside lint (`git grep`). The extra check `npm run lint:hooks -- --max-warnings 0`, which passes the flag twice as T831's docs do, exits 0, so those older commands still work.
- Dependency counts: dev 21, runtime 7, as baseline-metrics states.
- `Changed:` in the refactor log matches `git show --stat e25ee1f` (ADR 0113, ADR 0115, ledger, `FinanceContext.tsx`, `rerender-matrix.test.tsx`) plus T832's porcelain.
- Both `Surprises:` items trace to `task-T831-review.md` (lines 112 and 117) and to the T831 fix round.

### Gates run

Logs are in `workflow/stages/03_review/output/logs/`. I extracted the helper from the spec by script into `T832-gates.cjs`; it is gitignored by `.gitignore:94`.

| Gate | Command | Result |
|---|---|---|
| 0 | branch, `git log`, T831 commit, ledger grep, `script-shell` | branch `phase-161-finance-hooks-lint`; HEAD `e25ee1f` (T831) above `883a6a6`; last commit on the three T831 paths is `e25ee1f`; grep `1`; `script-shell` `null` |
| 1 | `node $H text` | `bad 0`, exit 0, all 41 checks OK (`T832-text.log`) |
| 2 after | 3 runs of `npm run lint`, warm cache | exit 0 each; 10,827 / 18,718 / 14,384 ms; median 14,384 (`T832-time-after.txt`) |
| 2 before | `git stash push -- package.json` (`w/crlf`), 3 runs, `git stash pop --index` | exit 0 each; 11,803 / 13,737 / 13,626 ms; median 13,626 (`T832-time-before.txt`). Porcelain is identical before the stash and after the pop (`cmp` OK). Delta +758 ms, within the 10,000 ms limit. My machine was noisier than the builder's (+1,681 ms); both pass |
| 2 CI | `gh run view 40906673300 ...` (read) | `["2026-10-29T15:57:25Z","2026-10-29T15:57:33Z"]`, 8 s |
| 3 | `npm run lint` | `lint exit=0`; the log has the `> eslint --max-warnings 0 --cache --cache-location .cache/eslint/ src api` line once and 0 `problem` or `react-hooks/` lines (`T832-lint.log`) |
| 4 | scratch copy at `/tmp/tmp.SdIGv3wvH0`, junction, warm cache, probe | `cache-cold`, `junction-ok`, `warm exit=0`, `cache-warm` (`.cache_le26jg`), `probe written`, `red exit=1`, `red cached exit=1`, `old lint exit=0`, `old hooks exit=0`, `green exit=0`, `scratch-removed`, `repo-node_modules-ok`, `status-unchanged`. The red and red-cached logs each contain all four required strings (`t832-lint-probe.tsx`, `react-hooks/exhaustive-deps`, `1 problem (0 errors, 1 warning)`, `ESLint found too many warnings (maximum: 0).`). The warm and green logs have the eslint line and no problem lines. The old-lint log has 0 `eslint` or `react-hooks/` lines. The old-hooks log has `1 problem (0 errors, 1 warning)` (`T832-probe-*.log`) |
| 5 | `npm run test:unit` | exit 0, `Test Files 73 passed (73)`, `Tests 1625 passed (1625)`, 0 failed, 0 skipped, 66.46 s (`T832-unit.log`) |
| 6 | `npx playwright test --list` / `--project=chromium` | `Total: 639 tests in 37 files` / `Total: 213 tests in 37 files` |
| 7 | `node $H bundle` on the builder's `dist/` (built 07:25 from this tree; T832 changes no build input) | `index-B7YcHRcz.js 198250 57976`, `index-BNwLrid8.css 54969 10720`, all app JS `911036 275908` in 39 files, `dist` 57 files. These match Edit 10 and the builder's `T832-bundle.txt`. The deltas against Phase 158 (+22/+19, +22/+17, 0, 0) are correct. Not rebuilt |
| 8 | numstat, `-U0` on `eslint.config.js`, lock, `npm ls` | `2 2 package.json`, `3 2 eslint.config.js`, `2 2 AGENTS.md`, `3 3 README.md`, ADR `12 0`, refactor-log `11 0`, baseline `8 0`; comments only; `lock-unchanged`; `eslint@9.39.5`, `eslint-plugin-react-hooks@7.1.1`, `typescript-eslint@8.72.1` |
| 9 | `git diff --stat` on the forbidden paths, grep, `ls-files` | empty; `104:        run: npm run lint`; all six paths tracked |
| 10 | em dashes, line endings | 0 added; 0 in every listed file; the six CRLF files have `bareLF 0`; refactor-log and ledger have `crlf 0` (`w/lf`) |
| 11 | `git status --porcelain` | exactly the 8 modified targets plus the untracked T832 spec and build report (and this review) |
| 12 | cache stays out of git | `repo-cache-present`; `.gitignore:62:.cache/	.cache/eslint/`; `cache entries=0` (`T832-status-cache.txt`); `git ls-files .cache` is empty |

No Playwright gate: no file Playwright loads changed (spec section 8).

### Not verified

- Gate 7 rebuild: I measured the builder's `dist/` and did not rebuild it, which the spec allows. It is the builder's 07:25 build, and no build input changed since then.
- Stage 03 step 6 stash red run: the spec replaces it with gate 4, which I ran myself.
- The CI `sh` run of the new script: the Phase 161 PR's `checks` job covers it.

### Blocking

- `docs/audit/refactor-log.md:25` - T832's part of `**Verified:**` says `Gate 5 full unit 73 files 1625 passed (70.1s)`. The ledger cell it must copy word for word (Edit 9) says `(60.5s)`. No run produced 70.1 s: T832's gate 5 took 60.49 s and T831's took 71.30 s. - Replace `(70.1s)` with `(60.5s)` in the T832 part so that line is exactly `**Verified:** T831 (<T831 ledger cell>); T832 (<T832 ledger cell>).`
- `docs/audit/baseline-metrics.md:31` - The Vitest bullet gives `1625 passed in 71.30 s (workflow/stages/02_build/output/logs/T831-unit.log)`, which is T831's run. Edit 10 asks for T832's gate 5 time and log path. - Change it to `1625 passed in 60.49 s (`workflow/stages/02_build/output/logs/T832-unit.log`)` and leave the rest of the bullet as it is.

### Non-blocking

- `T832-bundle.txt` in the builder's log folder is UTF-16. It came from a PowerShell `>` redirect, not the spec's Git Bash command. The figures are right, but run gate commands in Git Bash as written so their logs stay greppable.
- The build report says "Pre-hooks check: `pre-hooks exit=0`" and "Status clean". At gate 0 the status should list only the untracked T832 spec. It is fine as stated.

### Rule candidates

- When the closing docs copy a figure from another doc, check it programmatically against its source cell (here, the ledger). The gate helper checks that the sections exist, not what they say. One occurrence so far; do not promote yet.

### Fix block

```
fix T832 (stage file: workflow/stages/02_build/CONTEXT.md)
Round 1 review: workflow/stages/03_review/output/task-T832-review.md (CHANGES REQUESTED). Docs-only fix, two lines; change nothing else.
1. docs/audit/refactor-log.md:25 (LF file, keep LF): in the T832 part of **Verified:**, replace `Gate 5 full unit 73 files 1625 passed (70.1s)` with `Gate 5 full unit 73 files 1625 passed (60.5s)`, so the line is exactly "**Verified:** T831 (" + the T831 ledger Gate result cell + "); T832 (" + the T832 ledger Gate result cell + ")."
2. docs/audit/baseline-metrics.md:31 (CRLF file, keep CRLF): in the Vitest bullet, replace `1625 passed in 71.30 s (`workflow/stages/02_build/output/logs/T831-unit.log`)` with `1625 passed in 60.49 s (`workflow/stages/02_build/output/logs/T832-unit.log`)`.
Append `## Fix round 1` to workflow/stages/02_build/output/task-T832-build.md with the rerun results.
Gates to rerun, in Git Bash: gate 1 (`node workflow/stages/02_build/output/logs/T832-gates.cjs text` -> bad 0); gate 8 numstat (refactor-log 11 0, baseline 8 0 unchanged); gate 10 (0 em dashes; baseline bareLF 0, refactor-log crlf 0); gate 11 (scope unchanged). No code gate is needed: only these two doc lines change.
```
