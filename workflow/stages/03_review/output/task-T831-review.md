# T831 review

## Round 2

### Metadata

- Task: T831, fix the five `react-hooks/exhaustive-deps` warnings in `src/context/FinanceContext.tsx` with no behaviour change (Phase 161, branch `phase-161-finance-hooks-lint`)
- Date: 2026-10-30
- Round: 2 (after `fix T831`, build report `## Fix round 1`)
- Reviewer tier: strict (money path)
- Verdict: APPROVED
- Target files: unchanged from round 1 (`docs/audit/decisions/0115-hooks-lint-joins-npm-run-lint.md`, `docs/audit/decisions/0113-opt-in-eslint-hooks-rules.md`, `unit/rerender-matrix.test.tsx`, `src/context/FinanceContext.tsx`; bookkeeping `docs/audit/task-ledger.md`). None ignored (round 1 check).

### Summary

The fix put the UTF-8 BOM back on `FinanceContext.tsx` and touched nothing else in the file: the file minus its first 3 bytes hashes to `d2be82ad50e104c54e4aec1efcc9b38f`, the md5 I recorded in round 1 (`logs/T831-md5-before.txt`). The build report's fix round and the ledger row now carry git's real gate 8 output (`8 7`, 6 hunks). Both round 1 blocking items are fixed.

### Round 1 blocking items

- `FinanceContext.tsx:1` BOM: fixed. `head -c 3 | od` prints `ef bb bf` in both the working file and `HEAD`; `git diff -U0` shows 6 hunks (124 doc comment, 881, 967, 1320, 1710, 2094), no `@@ -1 +1 @@`.
- Gate 8 misreport: fixed. `git diff --numstat` prints `8 7` for `FinanceContext.tsx` and `42 0` for the test; the fix round says so and explains the spec's `9 8`; the ledger row reads `Gate 8 6 hunks, numstat 8 7`.

### Invariants and parity

- Tree since round 1: `FinanceContext.tsx` differs only by the BOM (hash match above); `unit/rerender-matrix.test.tsx`, ADR 0113 and ADR 0115 have mtimes before my round 1 logs (06:55 vs 07:07); the ledger changed only in the T831 row's Gate 8 text. So the round 1 Playwright run (117 passed, all three browsers) and the round 1 parity checks still apply to this tree.
- Parity map rows: unchanged from round 1 (no ledger arithmetic, no DOM id, no types touched).
- Em dashes: 0 in `FinanceContext.tsx`, the ledger and the build report. Line endings: `FinanceContext.tsx` bareLF 0, ledger crlf 0, build report bareLF 0.

### Gates run

Logs in `workflow/stages/03_review/output/logs/`.

| Gate | Command | Result |
|---|---|---|
| 1 | `node T831-gates.cjs` | all OK, `bad 0`, exit 0 (`T831-r2-gate1.log`) |
| 2 after | `npm run lint:hooks -- --max-warnings 0` | exit 0, no warnings (`T831-r2-hooks-after.log`) |
| 3 | `npm run lint` | exit 0: node-globals, safe-ids (139 files), both `tsc` runs (`T831-r2-lint.log`) |
| 4a | `npx vitest run unit/rerender-matrix.test.tsx` | 1 file, 2 passed (`T831-r2-g4a.log`) |
| 5 | `npm run test:unit` | 73 files passed, 1625 passed, 0 failed, 0 skipped, 58.01 s (`T831-r2-unit.log`) |
| 7 | reused round 1 (tree identical outside the BOM byte) | 117 passed, 0 failed, three browsers (`T831-e2e.log`) |
| 8 | `git diff --numstat`, `git diff -U0 -- src/context/FinanceContext.tsx` | `8 7`, 6 hunks; test `42 0` |
| 11 | `git status --porcelain`, `git diff --stat` | only the target files and bookkeeping, plus `workflow/stages/01_spec/output/task-T832-spec.md` (T832's spec: leave unstaged in T831's commit) |

### Not verified

- Gate 4b (8 related files) not rerun alone: the full unit run covers those files and passed.
- Playwright not rerun: round 1's run applies, as shown above. Signed-in paths keep unit coverage only, as in round 1.

### Blocking

None.

### Non-blocking

None.

### Rule candidates

- Round 1's candidate stands (keep a file's BOM; check the hunk count against the spec before reporting). Still one occurrence; do not promote yet.

## Round 1

### Metadata

- Task: T831, fix the five `react-hooks/exhaustive-deps` warnings in `src/context/FinanceContext.tsx` with no behaviour change (Phase 161, branch `phase-161-finance-hooks-lint`)
- Date: 2026-10-30
- Round: 1
- Reviewer tier: strict (money path)
- Verdict: CHANGES REQUESTED
- Target files: `docs/audit/decisions/0115-hooks-lint-joins-npm-run-lint.md` (new), `docs/audit/decisions/0113-opt-in-eslint-hooks-rules.md`, `unit/rerender-matrix.test.tsx`, `src/context/FinanceContext.tsx`; bookkeeping `docs/audit/task-ledger.md`. `git check-ignore -v` on all four targets: none ignored (exit 1).

### Summary

The five dependency arrays gain exactly the slice setters and refs the rule names, the actions doc comment is updated (Edit 6), the identity characterization test is appended, ADR 0115 is written and ADR 0113 gets its pointer. All of that matches the spec text byte for byte (gate 1 `bad 0`) and every gate passes. One unannounced change blocks: the UTF-8 BOM at the start of `FinanceContext.tsx` was stripped, adding a seventh hunk on line 1, and the build report's gate 8 misstates the numstat.

### Invariants and parity

- Callback bodies: full text of `resetToGuestState`, `loadSupabaseData`, `restoreBackup`, `deleteCategory` and `applyPreset` read; only the closing `}, [...]` line of each changed. No arithmetic, no body line, no other deps array touched.
- Stability of the added deps: `useKeywordRuleStore` (`KeywordRulesContext.tsx:59-66`), `useTemplateStore` (`TemplateContext.tsx:47-54`) and `useDiaryEntriesState` (`DiaryContext.tsx:67-74`) each return a raw `useState` setter and a `useRef` object, so `useCallback`'s `Object.is` comparison never sees a change. Identity of every derived callback and `actionsValue` is preserved; the new test confirms it at runtime.
- Parity map: `addTransaction` / `setTransactionDeleted` / `setTransactionsDeleted` rows untouched (no ledger arithmetic changed). Transfer preview, guest starter set, types/export rows: not touched. Spec-asserted DOM ids: none touched.
- ADR 0115 / ledger counts: 1625 tests in 73 files matches my full run; line numbers 881, 967, 1320, 1710, 2094 match my stash-check lint run; `883a6a6` resolves to a commit.
- Em dashes: 0 added in the diff, 0 in every touched file.

### Gates run

Logs in `workflow/stages/03_review/output/logs/`.

| Gate | Command | Result |
|---|---|---|
| 1 | `node T831-gates.cjs` (extracted from the spec by script) | every line OK, `bad 0`, exit 0 (`T831-gate1.log`) |
| 2 after | `npm run lint:hooks -- --max-warnings 0` | no output lines, exit 0 (`T831-hooks-after.log`) |
| 2 before / 6 | stash `src/context/FinanceContext.tsx`; `npm run lint:hooks` | exactly 5 warnings at 881:6, 967:6, 1320:6, 1710:6, 2094:6, `5 problems (0 errors, 5 warnings)` (`T831-hooks-before.log`) |
| 6 | stash; `npx vitest run unit/rerender-matrix.test.tsx` | 1 file, 2 passed, 0 failed (`T831-stash-unit.log`); pop `--index`; `git status --porcelain` identical; file md5 identical |
| 6c | builder's `workflow/stages/02_build/output/logs/T831-red.log` | 1 failed, 1 skipped, `Object.is equality` at `expect(latest!.actions).toBe(before)`: confirmed |
| 3 | `npm run lint` | exit 0: node-globals, safe-ids (139 files), `tsc --noEmit`, `tsc -p api/tsconfig.json` (`T831-lint.log`) |
| 4a | `npx vitest run unit/rerender-matrix.test.tsx` | 1 file, 2 passed (`T831-g4a.log`) |
| 4b | the 8 related unit files | 8 files passed, 262 passed, 0 failed (`T831-g4b.log`) |
| 5 | `npm run test:unit` | 73 files passed, 1625 passed, 0 failed, 0 skipped, 65.96 s (`T831-unit.log`) |
| 7 | ports 3000/3100 free; `npx playwright test tests/categories.spec.ts tests/presets.spec.ts tests/account-and-mobile-nav.spec.ts tests/auth.spec.ts` (all three browsers) | 117 passed, 0 failed, 2.5 m (`T831-e2e.log`) |
| 8 | `git diff --numstat` / `git diff -U0 -- src/context/FinanceContext.tsx` | `9 8`, **7 hunks**: the 6 expected plus `@@ -1 +1 @@` removing the BOM. Test file `42 0` OK. See Blocking |
| 9 | `git cat-file -t 883a6a6`; branch; `git diff --stat HEAD -- AGENTS.md README.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md` | `commit`; `phase-161-finance-hooks-lint`; empty |
| 10 | the three spec scripts | 0 added em dashes; 0 in all 7 files; 4 CRLF files `bareLF 0`; ledger `crlf 0` |
| 11 | `git status --porcelain`, `git diff --stat` | only the target files and bookkeeping, plus `workflow/stages/01_spec/output/task-T832-spec.md` (the next task's spec, not T831's; leave it unstaged for this commit) |

### Not verified

- Gate 6 step b/c (the control edit) not repeated: the stage allows no code edit; checked the builder's red log instead.
- Signed-in paths of `loadSupabaseData` and `resetToGuestState` have unit coverage only (no spec signs in; stop-and-ask).

### Blocking

- `src/context/FinanceContext.tsx:1` - the UTF-8 BOM (`EF BB BF`) present in `HEAD` was removed; this is a seventh hunk the spec does not allow ("No line in any edit changes beyond the text below"; gate 8: 6 hunks) and the build report does not announce - put the three BOM bytes back so line 1 is byte-identical to `HEAD` and `git diff -U0` shows exactly 6 hunks.
- `workflow/stages/02_build/output/task-T831-build.md:97` - gate 8 claims numstat "8 additions, 7 deletions" and 6 hunks, but git printed `9 8` with 7 hunks - after the BOM fix, rerun gate 8 and record git's real output (it should then be `8 7`, 6 hunks; the spec's `9 8` counted Edit 6's unchanged first line, see Non-blocking).

### Non-blocking

- The spec's gate 8 expectation `9 8` is itself off by one: Edit 6's first line is unchanged, so the correct figure is `8 7` (5+5 for Edits 1 to 5, 3+2 for Edit 6). The BOM hunk happened to make the wrong figure match. Record `8 7` in the fix round and say why.
- The ledger row's "Gate 8 diff shape clean" becomes true only after the fix; reword if you like (for example `Gate 8 6 hunks, numstat 8 7`).

### Rule candidates

- A BOM-stripping editor slips past every text gate (the helper normalises CRLF, `tsc` and ESLint ignore a BOM). Candidate for `workflow/stages/02_build/CONTEXT.md`: "check `git diff -U0` hunk count against the spec before reporting; keep a file's BOM as found." Promote only if it recurs.

### Fix block

```
fix T831 (stage file: workflow/stages/02_build/CONTEXT.md)
Round 1 blocking items (workflow/stages/03_review/output/task-T831-review.md):
1. src/context/FinanceContext.tsx:1 - restore the UTF-8 BOM removed from HEAD, touching nothing else:
   node -e "const fs=require('fs');const f='src/context/FinanceContext.tsx';const b=fs.readFileSync(f);if(!(b[0]===0xEF&&b[1]===0xBB&&b[2]===0xBF))fs.writeFileSync(f,Buffer.concat([Buffer.from([0xEF,0xBB,0xBF]),b]))"
   Then `git diff -U0 -- src/context/FinanceContext.tsx` must show exactly 6 hunks (no `@@ -1 +1 @@`), and `git diff --numstat -- src/context/FinanceContext.tsx` must print `8	7`.
2. workflow/stages/02_build/output/task-T831-build.md - append `## Fix round 1` with git's real gate 8 output (`8	7`, 6 hunks) and note the spec's `9 8` counted Edit 6's unchanged first line. Update the ledger row's Gate 8 text to match.
Gates to rerun and log: gate 1 (`node workflow/stages/02_build/output/logs/T831-gates.cjs` -> bad 0); gate 2 after (`npm run lint:hooks -- --max-warnings 0`, exit 0); gate 3 (`npm run lint`); `npx vitest run unit/rerender-matrix.test.tsx` (2 passed); gate 8; gate 10 (line endings: FinanceContext.tsx bareLF 0); plus `head -c 3 src/context/FinanceContext.tsx | od -An -tx1` printing `ef bb bf`. No Playwright rerun is needed for a BOM-only change; the reviewer reruns lint and the full unit suite in round 2.
```
