# Build Report - T827

## 1. Summary of Changes

Phase 158 (`phase-158-eslint-hooks`): installed and configured ESLint as an opt-in script (`npm run lint:hooks`), not part of `npm run lint` or CI, with only two React hooks rules (`react-hooks/exhaustive-deps: warn` and `react-hooks/rules-of-hooks: error`) across `src/` and `api/`. Fixed the two non-money warnings in `src/components/Modal.tsx` and `src/components/ui/OverflowMenu.tsx` with zero behaviour change. Left the five warnings in `src/context/FinanceContext.tsx` untouched as a scheduled future phase. Shipped Phase 158 closing docs.

- **ADR 0113 (`docs/audit/decisions/0113-opt-in-eslint-hooks-rules.md`)**:
  - Documents the decision to add `eslint@9.39.5`, `eslint-plugin-react-hooks@7.1.1`, and `typescript-eslint@8.72.1` with owner approval.
  - Explains the flat config, opt-in script `"lint:hooks": "eslint src api"`, behaviour-neutral fixes to `Modal.tsx` and `OverflowMenu.tsx`, and deferral of `FinanceContext.tsx` warnings to a future money-path phase.
- **`package.json` & `package-lock.json`**:
  - Added exact pins `eslint: "9.39.5"`, `eslint-plugin-react-hooks: "7.1.1"`, and `typescript-eslint: "8.72.1"` to `devDependencies`.
  - Added script `"lint:hooks": "eslint src api"`.
  - Added 99 packages in lockfile (+1368 lines, -2 flag-only lines on `esbuild`).
- **`eslint.config.js`**:
  - Created flat config exporting configuration targeting `**/*.{ts,tsx}`, using `tseslint.parser` with JSX enabled, registering `react-hooks` plugin with `exhaustive-deps: "warn"` and `rules-of-hooks: "error"`, and `reportUnusedDisableDirectives: "off"`.
- **`src/components/Modal.tsx`**:
  - In the first `useLayoutEffect` (focus return), captured `panelRef.current` into `const panel = panelRef.current;` at effect setup and referenced `panel?.contains(active)` in cleanup.
- **`src/components/ui/OverflowMenu.tsx`**:
  - In `useEffect([isOpen])`, focused the first item directly via `itemRefs.current[0]?.focus()` rather than calling `focusItem(0)`, ensuring the effect depends on `isOpen` alone.
- **`README.md`**:
  - Added `npm run lint:hooks` line under `## Testing`.
- **`docs/audit/refactor-log.md`**:
  - Added Phase 158 entry with Changed, Verified, Surprises, and Deliberately not done sections.
- **`docs/audit/baseline-metrics.md`**:
  - Added `### Phase 158 - delta against Phase 156` section recording build bundle metrics, dev dependencies count, warnings count, and gate run metrics.
- **`docs/audit/task-ledger.md`**:
  - Added `## Phase 158 - Opt-in ESLint for the React hooks rules (ADR 0113)` section with branch details and T827 row marked as `done` with gate verification results. Updated Backlog row for ESLint with `react-hooks/exhaustive-deps` and added next row for `FinanceContext.tsx` warnings and CI integration.

## 2. Files Changed (10 files)

1. `docs/audit/decisions/0113-opt-in-eslint-hooks-rules.md` (new)
2. `package.json` (modified)
3. `package-lock.json` (modified)
4. `eslint.config.js` (new)
5. `src/components/Modal.tsx` (modified)
6. `src/components/ui/OverflowMenu.tsx` (modified)
7. `README.md` (modified)
8. `docs/audit/refactor-log.md` (modified)
9. `docs/audit/baseline-metrics.md` (modified)
10. `docs/audit/task-ledger.md` (modified bookkeeping)

## 3. Tests Added and Fail-then-Pass Evidence

Per spec section 6, `tests to add: none` deliberately. Both fixes are behaviour-neutral refactors of existing effects, so verification relies on the existing test suite and the 11 Playwright specs. Red-to-green evidence is provided by the gate checks:

- **Gate 1 (Text Landed Control Check):**
  - Pre-edit control run: `blocks 11 bad 11` (exit 1).
  - Post-edit run: `blocks 11 bad 0` (exit 0). All 11 spec-asserted blocks matched expected content exactly once.
- **Gate 4 (`lint:hooks` Count and List Check):**
  - Before fixes: 7 warnings, 0 errors, match true (exit 0). Warnings reported at `Modal.tsx:212`, `OverflowMenu.tsx:67`, and 5 in `FinanceContext.tsx` (lines 881, 967, 1320, 1710, 2094).
  - After fixes: 5 warnings, 0 errors, match true (exit 0). Warnings reported exclusively in `FinanceContext.tsx` (lines 881, 967, 1320, 1710, 2094). The warnings in `Modal.tsx` and `OverflowMenu.tsx` are completely eliminated.

## 4. Verification Gates Run

### Gate 1: Text Landed Script
- Command:
  ```bash
  node -e "const fs=require('fs');const t=fs.readFileSync(process.argv[1],'utf8').split(String.fromCharCode(96).repeat(3));let bad=0,n=0;for(let i=1;i<t.length;i+=2){const l=t[i-1].trim().split('\n').pop();if(!l.startsWith('**Landed in '))continue;const f=l.slice(12).split(',')[0];const b=t[i].split('\n').slice(1,-1).join('\n');if(!fs.existsSync(f)){n++;bad++;console.log(f,'missing');continue}const c=fs.readFileSync(f,'utf8').split('\r\n').join('\n');const k=c.split(b).length-1;n++;console.log(f,k);if(k!==1)bad++}console.log('blocks',n,'bad',bad);process.exit(bad||n!==11?1:0)" workflow/stages/01_spec/output/task-T827-spec.md
  ```
- Output: `blocks 11 bad 0` (exit 0). Control before edits was `blocks 11 bad 11` (exit 1).
- `git diff --numstat src/components/Modal.tsx src/components/ui/OverflowMenu.tsx`:
  - `4 1 src/components/Modal.tsx` (2 hunks, +4 -1 lines)
  - `3 2 src/components/ui/OverflowMenu.tsx` (1 hunk, +3 -2 lines)

### Gate 2: Baseline Build (Before Edits)
- Command: `npm run clean && npm run build 2>&1 | tee workflow/stages/02_build/output/logs/T827-build-before.log`
- Snapshot: `workflow/stages/02_build/output/logs/T827-dist-before.txt`
- Output: 57 files. Entry chunk `index-CsN9mAj5.js` 198,233 B (57,965 B gzip). All app JS 39 files 910,982 B (275,886 B gzip). CSS `index-BNwLrid8.css` 54,969 B (10,720 B gzip).

### Gate 3: Config Isolation (Dependencies & Config Do Not Reach Bundle)
- Command: `npm run clean && npm run build 2>&1 | tee workflow/stages/02_build/output/logs/T827-build-config.log`
- Snapshot: `workflow/stages/02_build/output/logs/T827-dist-config.txt`
- Comparison: `diff workflow/stages/02_build/output/logs/T827-dist-before.txt workflow/stages/02_build/output/logs/T827-dist-config.txt`
- Output: Empty diff (exit 0). Dist files and byte sizes are byte-identical to baseline.

### Gate 4: `lint:hooks` Count and List
- Before fixes:
  - Command: `npm run lint:hooks -- -f json -o workflow/stages/02_build/output/logs/T827-hooks-before.json`
  - Verification: `warnings 7 errors 0`, `match true` (exit 0). `npm run lint:hooks` exit code 0.
  - Reported: `Modal.tsx:212`, `OverflowMenu.tsx:67`, and `FinanceContext.tsx` lines 881, 967, 1320, 1710, 2094.
- After fixes:
  - Command: `npm run lint:hooks -- -f json -o workflow/stages/02_build/output/logs/T827-hooks-after.json`
  - Verification: `warnings 5 errors 0`, `match true` (exit 0). `npm run lint:hooks` exit code 0.
  - Reported: `FinanceContext.tsx` lines 881, 967, 1320, 1710, 2094 only.

### Gate 5: Money Path Untouched and No Pause-List Path
- Commands:
  - `git diff --quiet HEAD -- src/context/FinanceContext.tsx` -> exit 0
  - Pause-list check on `git diff --name-only HEAD` -> exit 1 (empty match)
  - Pause-list check on `git status --porcelain` -> exit 1 (empty match)
  - `grep -c "eslint-disable" src/context/FinanceContext.tsx` -> 0

### Gate 6: Default Build After Fixes
- Command: `npm run clean && npm run build 2>&1 | tee workflow/stages/02_build/output/logs/T827-build-after.log`
- Snapshot: `workflow/stages/02_build/output/logs/T827-dist-after.txt`
- Output: 57 files (unchanged count).
  - Entry chunk: `index-CAxfG7Qp.js` 198,228 B (-5 B raw) / 57,957 B (-8 B gzip).
  - All app JS: 39 files 911,014 B (+32 B raw) / 275,891 B (+5 B gzip).
  - CSS: `index-BNwLrid8.css` 54,969 B / 10,720 B gzip (0 delta).
  - `grep -rli "eslint" dist` returned exit 1 (0 occurrences).
  - Snapshot diff shows only changed hashes for entry chunk, chunks referencing Modal or OverflowMenu, `index.html`, and `sw.js`.

### Gate 7: Install Consistency
- Commands:
  - `npm ci --dry-run` exited 0 with no sync errors.
  - `npm ls eslint eslint-plugin-react-hooks typescript-eslint` -> exact versions `eslint@9.39.5`, `eslint-plugin-react-hooks@7.1.1`, `typescript-eslint@8.72.1`.
  - `npm ls --omit=dev eslint` -> `(empty)` (exit 1).
  - `npm ls --all 2>&1 | grep -iE "invalid|missing|ERR"` -> empty (0 errors).
  - `node -e "const p=require('./package.json');console.log('dev',Object.keys(p.devDependencies).length,'runtime',Object.keys(p.dependencies).length)"` -> `dev 21 runtime 7`.
  - `git diff --numstat package-lock.json` -> `1368 2 package-lock.json` (+1368 lines, -2 flag lines, 99 packages added).

### Gate 8: Read-Only Verification
- Status checked before and after `npm run lint:hooks`: identical porcelain status.
- `.eslintcache` confirmed absent.
- `package.json` script confirmed free of `--fix` and `--cache`.

### Gate 9: Lint
- Command: `npm run lint 2>&1 | tee workflow/stages/02_build/output/logs/T827-lint.log`
- Output: 139 files in src checked for node-globals (0 found), 139 files in src checked for safe-ids (0 found), `tsc --noEmit` passed, `tsc -p api/tsconfig.json` passed (exit 0).
- Confirmed `lint` command does not contain `eslint` or `lint:hooks`.

### Gate 10: Unit Tests
- Targeted unit tests: `npx vitest run unit/modal-focus.test.tsx unit/modal-history.test.tsx unit/ui-controls.test.tsx unit/dialog-names.test.tsx` -> 4 files, 61 passed in 4.87s.
- Full unit suite: `npm run test:unit 2>&1 | tee workflow/stages/02_build/output/logs/T827-unit.log` -> 72 files, 1606 passed in 61.01s (0 delta).

### Gate 11: Playwright Tests
- Ports 3000 and 3100 confirmed free.
- Chromium run (11 specs):
  - Command: `npx playwright test tests/account-and-mobile-nav.spec.ts tests/categories-page.spec.ts tests/debts-page.spec.ts tests/diary-page.spec.ts tests/ios-field-zoom.spec.ts tests/reduced-motion.spec.ts tests/routing.spec.ts tests/soft-delete.spec.ts tests/tab-preload.spec.ts tests/transactions-views.spec.ts tests/wallets-page.spec.ts --project=chromium 2>&1 | tee workflow/stages/02_build/output/logs/T827-pw-chromium.log`
  - Result: 11 passed (83 tests passed in 1.3m).
- All browsers run (Chromium, Firefox, WebKit, 11 specs):
  - Command: `npx playwright test tests/account-and-mobile-nav.spec.ts tests/categories-page.spec.ts tests/debts-page.spec.ts tests/diary-page.spec.ts tests/ios-field-zoom.spec.ts tests/reduced-motion.spec.ts tests/routing.spec.ts tests/soft-delete.spec.ts tests/tab-preload.spec.ts tests/transactions-views.spec.ts tests/wallets-page.spec.ts 2>&1 | tee workflow/stages/02_build/output/logs/T827-pw-all.log`
  - Result: 33 passed (249 tests passed in 7.9m).

### Gate 12: Docs and Housekeeping
- Baseline metrics in `docs/audit/baseline-metrics.md` match exact gate outputs.
- `git ls-files --eol` shows `w/crlf` across all modified tracked files; new files `docs/audit/decisions/0113-opt-in-eslint-hooks-rules.md` and `eslint.config.js` have 0 bare LF.
- 0 em dashes present in any touched or newly created file.
- All numbers and paths confirmed against codebase.

### Gate 13: Diff Shape and Scope
- `git status --porcelain` and `git diff --stat` list exactly the 9 Target files, `docs/audit/task-ledger.md`, and stage output files.
- `git diff -U0 package.json` shows exactly 3 hunks (+4 lines, 0 lines deleted).

## 5. Deliberately Not Done

- The five `react-hooks/exhaustive-deps` warnings in `src/context/FinanceContext.tsx` (lines 881, 967, 1320, 1710, 2094); deferred to a scheduled future money-path phase.
- Wiring ESLint into `npm run lint` or CI, or modifying `AGENTS.md` (Commands line or tier rows).
- The React Compiler rules or recommended preset.
- Type-aware rules or `@typescript-eslint` rule sets.
- `eslint` 10 (`latest`); pinned to `9.39.5` (`maintenance`).
- The three pre-existing bare `// eslint-disable-next-line` comments (`DiaryView.tsx:48`, `TransactionsView.tsx:152`, `WalletsView.tsx:78`).
- `--max-warnings`, `--fix`, or `--cache` flags.
- Any ESLint rules beyond the two React hooks rules.
- No unit test added that shells out to ESLint.
- No archiving of `task-ledger.md` rows (ledger expanded from 150 to 160 lines).
- Empty `Commit` cell in `docs/audit/task-ledger.md` and `<sha>` placeholders in `docs/audit/refactor-log.md` heading left for the owner-approved post-merge deploy record.
