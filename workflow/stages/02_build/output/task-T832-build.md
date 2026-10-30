# Task T832 build report: wire ESLint's React hooks rules into npm run lint

Task ID: T832
Branch: phase-161-finance-hooks-lint
Phase: 161

## Files changed (8 files)

- `docs/audit/decisions/0115-hooks-lint-joins-npm-run-lint.md`
- `package.json`
- `eslint.config.js`
- `AGENTS.md`
- `README.md`
- `docs/audit/refactor-log.md`
- `docs/audit/baseline-metrics.md`
- `docs/audit/task-ledger.md`

## Tests added and fail-then-pass evidence

No unit tests added in the repository (the changed behaviour is npm scripts, configuration, and documentation).
Verified via Gate 4's scratch-copy injected warning probe outside the repo with warm and cold ESLint cache runs.

### Gate 4 exit lines

- `warm exit=0`
- `red exit=1`
- `red cached exit=1`
- `old lint exit=0`
- `old hooks exit=0`
- `green exit=0`

### Red log tail (`workflow/stages/02_build/output/logs/T832-probe-red.log`)

```
> finlife-tracker@0.0.0 lint:hooks
> eslint --max-warnings 0 --cache --cache-location .cache/eslint/ src api

C:\Users\MRmar\AppData\Local\Temp\tmp.9T9iH1zdGZ\src\t832-lint-probe.tsx
  8:6  warning  React Hook useEffect has a missing dependency: 'count'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

✖ 1 problem (0 errors, 1 warning)

ESLint found too many warnings (maximum: 0).
```

### Red-cached log tail (`workflow/stages/02_build/output/logs/T832-probe-red-cached.log`)

```
> finlife-tracker@0.0.0 lint:hooks
> eslint --max-warnings 0 --cache --cache-location .cache/eslint/ src api

C:\Users\MRmar\AppData\Local\Temp\tmp.9T9iH1zdGZ\src\t832-lint-probe.tsx
  8:6  warning  React Hook useEffect has a missing dependency: 'count'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

✖ 1 problem (0 errors, 1 warning)

ESLint found too many warnings (maximum: 0).
```

## Gate commands and results

- Gate 0: T831 landed check
  - Branch: `phase-161-finance-hooks-lint`
  - T831 commit: `e25ee1f`
  - Ledger check: 1 completed T831 row
  - Pre-hooks check: `pre-hooks exit=0` (`workflow/stages/02_build/output/logs/T832-pre-hooks.log`)
  - Status clean, `script-shell null`

- Gate 1: text landed
  - Command: `node workflow/stages/02_build/output/logs/T832-gates.cjs text`
  - Result: `bad 0` (exit 0)
  - Control check before edits: `bad 34` (exit 1)

- Gate 2: lint runtime, before and after
  - Before runs: 9935 ms, 10110 ms, 10064 ms -> median: 10064 ms (`workflow/stages/02_build/output/logs/T832-time-before.txt`)
  - After runs: 12642 ms, 11745 ms, 11644 ms -> median: 11745 ms (`workflow/stages/02_build/output/logs/T832-time-after.txt`)
  - Delta: +1681 ms (+1.68 s, well under the 10,000 ms ceiling)
  - CI baseline: 8 s (`2026-10-29T15:57:25Z` to `2026-10-29T15:57:33Z` on run 40906673300)

- Gate 3: npm run lint
  - Command: `npm run lint`
  - Result: `lint exit=0`
  - Log: `workflow/stages/02_build/output/logs/T832-lint.log` (contains `eslint --max-warnings 0 --cache --cache-location .cache/eslint/ src api`, 0 problems)

- Gate 4: injected warning probe on scratch copy
  - Log outputs: `T832-probe-warm.log`, `T832-probe-red.log`, `T832-probe-red-cached.log`, `T832-probe-old-lint.log`, `T832-probe-old-hooks.log`, `T832-probe-green.log`
  - Confirmed: `cache-cold`, `junction-ok`, `warm exit=0`, `cache-warm`, `red exit=1`, `red cached exit=1`, `old lint exit=0`, `old hooks exit=0`, `green exit=0`, `scratch-removed`, `repo-node_modules-ok`, `status-unchanged`

- Gate 5: full unit run
  - Command: `npm run test:unit`
  - Result: Test Files 73 passed (73), Tests 1625 passed (1625), Duration 60.49 s, exit 0
  - Log: `workflow/stages/02_build/output/logs/T832-unit.log`

- Gate 6: stated Playwright counts
  - Command: `npx playwright test --list` -> `Total: 639 tests in 37 files` (`workflow/stages/02_build/output/logs/T832-list.log`)
  - Command: `npx playwright test --list --project=chromium` -> `Total: 213 tests in 37 files` (`workflow/stages/02_build/output/logs/T832-list-chromium.log`)

- Gate 7: bundle figures
  - Command: `npm run build` -> exit 0 (`workflow/stages/02_build/output/logs/T832-build.log`)
  - Command: `node workflow/stages/02_build/output/logs/T832-gates.cjs bundle` -> output saved to `workflow/stages/02_build/output/logs/T832-bundle.txt`
  - Entry chunk: `index-B7YcHRcz.js` 198,250 B (+22 B raw) / 57,976 B gzip (+19 B gzip against Phase 158)
  - All app JS: 911,036 B (+22 B raw) / 275,908 B gzip (+17 B gzip against Phase 158 in 39 files)
  - CSS: `index-BNwLrid8.css` 54,969 B / 10,720 B gzip (0 B delta)
  - Dist files: 57 (0 delta)

- Gate 8: diff shape and dependencies
  - `package.json`: 2 additions, 2 deletions
  - `eslint.config.js`: 3 additions, 2 deletions (all comments, lines start with `//`)
  - `AGENTS.md`: 2 additions, 2 deletions
  - `README.md`: 3 additions, 3 deletions
  - `docs/audit/baseline-metrics.md`: 8 additions, 0 deletions
  - `docs/audit/decisions/0115-hooks-lint-joins-npm-run-lint.md`: 12 additions, 0 deletions
  - `docs/audit/refactor-log.md`: 11 additions, 0 deletions
  - `package-lock.json`: unchanged (`lock-unchanged`)
  - Pinned versions: `eslint@9.39.5`, `eslint-plugin-react-hooks@7.1.1`, `typescript-eslint@8.72.1`

- Gate 9: stated paths and workflow integrity
  - Zero diff across `.github/`, `vercel.json`, `.claude/`, `src/`, `api/`, `unit/`, `tests/`, `supabase/`, `docs/contexts/`, stage `CONTEXT.md` files, or ADR 0113
  - Line 104 in `.github/workflows/playwright.yml`: `run: npm run lint`
  - Stated files tracked in git

- Gate 10: no em dash, line endings kept
  - 0 added em dashes in diff
  - 0 em dashes in all 10 checked files
  - CRLF preserved on the 6 target files and this report (`bareLF 0`)
  - LF preserved on `docs/audit/refactor-log.md` and `docs/audit/task-ledger.md` (`crlf 0`)

- Gate 11: scope
  - `git status --porcelain` lists only the target files and task spec/build reports

- Gate 12: cache stays out of git
  - `.cache/eslint/` created and present
  - Ignored via `.gitignore:62:.cache/`
  - Untracked status shows 0 cache entries; `git ls-files .cache` prints nothing

## Left to the reviewer

None (no Playwright gates for this task; reviewer repeats lint timing stash check, gate 4 scratch probe in its own log folder, full unit run, and checks bundle figures).

## Anything not done

- Renaming the CI step `Type-check (tsc --noEmit)` to reflect ESLint (workflow edit left to the owner).
- `error` severity in `eslint.config.js` (retained at `warn` with `--max-warnings 0`).
- A unit test that pins the two scripts (gate 4 scratch probe proves it).
- Three bare `// eslint-disable-next-line` sites.
- React Compiler rules, recommended preset, type-aware rules, and eslint 10.
- Archiving `docs/audit/task-ledger.md`.
- Filling `<sha>` placeholders and Commit cells (the deploy record's).


## Fix round 1

Fixed the two blocking items from Round 1 of `workflow/stages/03_review/output/task-T832-review.md`:

1. `docs/audit/refactor-log.md:25`: in the T832 part of `**Verified:**`, replaced `Gate 5 full unit 73 files 1625 passed (70.1s)` with `Gate 5 full unit 73 files 1625 passed (60.5s)` so that it matches the T832 ledger Gate result cell word for word.
2. `docs/audit/baseline-metrics.md:31`: in the Vitest bullet, replaced `1625 passed in 71.30 s (`workflow/stages/02_build/output/logs/T831-unit.log`)` with `1625 passed in 60.49 s (`workflow/stages/02_build/output/logs/T832-unit.log`)`.

### Gates rerun in Fix round 1

- Gate 1: `node workflow/stages/02_build/output/logs/T832-gates.cjs text` -> `bad 0` (exit 0)
- Gate 8 numstat: `git diff --numstat HEAD -- ...` -> `refactor-log.md` 11 additions, 0 deletions; `baseline-metrics.md` 8 additions, 0 deletions
- Gate 10: 0 added em dashes in diff and 0 in all files; `baseline-metrics.md` bareLF 0; `refactor-log.md` crlf 0
- Gate 11: scope unchanged (exactly the 8 target files modified)
