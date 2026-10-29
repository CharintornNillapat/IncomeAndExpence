# T827 review

## Round 1

### 1. Metadata

- Task: T827 (Phase 158, branch `phase-158-eslint-hooks`)
- Date: 2026-10-29
- Round: 1
- Verdict: **APPROVED**
- Target files: `docs/audit/decisions/0113-opt-in-eslint-hooks-rules.md`, `package.json`, `package-lock.json`, `eslint.config.js`, `src/components/Modal.tsx`, `src/components/ui/OverflowMenu.tsx`, `README.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` (plus bookkeeping `docs/audit/task-ledger.md`).
- `git check-ignore -v` on all nine targets: exit 1, none ignored.

### 2. Summary

Adds ESLint (exact pins eslint 9.39.5, eslint-plugin-react-hooks 7.1.1, typescript-eslint 8.72.1) as the opt-in `npm run lint:hooks` over `src api`, with a flat config holding only `exhaustive-deps` (warn) and `rules-of-hooks` (error). `Modal.tsx` now reads `panelRef.current` once at effect setup, `OverflowMenu.tsx` focuses `itemRefs.current[0]` directly. `lint:hooks` goes from 7 warnings to 5, all in `FinanceContext.tsx`, which is untouched. ADR, README line, closing docs and ledger are in. The code diff matches the spec's fenced blocks exactly (11 of 11).

### 3. Invariants and parity

- Parity map: no row touched (spec section 5). Confirmed from the diff: no ledger, context, selector, api, CSP or type change.
- Pause list and money path: `git diff --quiet HEAD -- src/context/FinanceContext.tsx` exit 0; the pause-list grep over `git diff --name-only HEAD` and over `git status --porcelain` both print nothing (exit 1); `grep -c eslint-disable src/context/FinanceContext.tsx` is 0. No change under `src/selectors/`, `supabase/`, `api/`, `.claude/`, `.github/`, `AGENTS.md`, `vercel.json`, or any `workflow/stages/*/CONTEXT.md`. The phase is eligible for auto-merge by the pause-list test (the PR is a code PR: `package.json`, lockfile, `eslint.config.js`, `src/components/*`).
- Scope: `git status --porcelain` lists exactly the nine targets, the ledger, the ADR, `eslint.config.js`, and the spec and build outputs (12 entries; same set as at the start of review). No unannounced file.
- Behaviour neutrality, read in full: `Modal.tsx` first `useLayoutEffect` only gains `const panel = panelRef.current` at setup and uses `panel?.contains(active)` in the cleanup; dependency arrays and the other effects are unchanged. `OverflowMenu.tsx` effect now `itemRefs.current[0]?.focus()` with deps `[isOpen]`, `focusItem` and the handlers unchanged. Both are as the spec states.
- Dependencies: only the three approved packages are named in `package.json`; `git diff -U0 package.json` has 3 hunks (the grep counts 3) and 0 deleted lines. Lockfile: +1368 lines, the 2 "deleted" lines are diff-alignment artifacts of re-indented additions (`glob` engines/funding lines are re-added unchanged), no removed version line; 99 `node_modules/` entries added, 99 `"version"` additions.
- Text: 0 em dashes in all eight touched files and 0 in added diff lines.
- Line endings: all changed tracked files `i/lf w/crlf` (unchanged from the repo norm); the new `eslint.config.js` (21 CR of 21 lines) and ADR (47 of 47) are CRLF like `0112`.

### 4. Gates run (all by me; logs in `workflow/stages/03_review/output/logs/`)

1. Text landed: `blocks 11 bad 0`, exit 0. `--numstat`: `Modal.tsx` 4/1, `OverflowMenu.tsx` 3/2, `package.json` 4/0.
2/3. Baseline and config-only builds: not re-run by me (see Not verified). Used the builder's `T827-dist-before.txt`, which has the entry chunk `index-CsN9mAj5.js` 198,233 B, matching the figures the spec says the local `.env` reproduces.
4. `npm run lint:hooks -- -f json -o T827-hooks-after.json`: exit 0, `warnings 5 errors 0`, `match true`, exactly the five `FinanceContext.tsx` lines 881, 967, 1320, 1710, 2094.
5. See section 3: all expected results.
6. `npm run clean && npm run build`: exit 0, 57 files (equals before). Snapshot diff against the builder's before: only hash renames plus two size changes (entry `index` 198,233 to 198,228 B; `OverflowMenu` 2,021 to 2,058 B); CSS `index-BNwLrid8.css` 54,969 B identical, no file added or removed. All app JS recomputed: 39 files, 911,014 B raw / 275,891 B gzip-9; entry 198,228 B / 57,957 B; CSS 54,969 B / 10,720 B. `grep -rli eslint dist`: nothing, exit 1. My after snapshot is identical to the builder's `T827-dist-after.txt`. Log: `T827-build-after.log`, `T827-dist-after.txt`.
7. `npm ci --dry-run` exit 0; `npm ls` shows eslint 9.39.5, eslint-plugin-react-hooks 7.1.1, typescript-eslint 8.72.1; `npm ls --omit=dev eslint` prints `(empty)`; the spec's loose `grep -iE "invalid|missing|ERR"` matches package names (`es-errors`, `zod-validation-error`), and the strict grep (`invalid|missing|ERR!`) finds none besides the normal `UNMET OPTIONAL DEPENDENCY` platform lines; `dev 21 runtime 7`.
8. `lint:hooks` read-only: `git status --porcelain` identical before and after; `.eslintcache` absent; script has no `--fix` or `--cache`.
9. `npm run lint`: exit 0 (`T827-lint.log`); the `lint` script line contains no `eslint`.
10. `npx vitest run` on the 4 modal and ui specs: 4 files, 61 tests passed. `npm run test:unit`: exit 0, 72 files, 1606 tests passed, 76.66 s (`T827-unit.log`).
11. Ports 3000 and 3100: no listener (only TIME_WAIT sockets) before each run; `src/` not edited during the runs. Chromium, 11 specs: 83 passed (58.8 s), exit 0 (`T827-pw-chromium.log`). All three browsers, same 11 specs: 249 passed (5.9 min), exit 0 (`T827-pw-all.log`).
12. Baseline-metrics figures recomputed and equal to what the gates printed (bytes, gzip, files, dev 21 / runtime 7, lockfile +1368 -2, 99 packages, 72/1606, 213/37/639 unchanged). Em dashes and line endings: see section 3.
13. Diff shape: see section 3.

### 5. Not verified

- Gates 2 and 3 (clean baseline build and the config-only build with `src/` untouched) were not re-run: reproducing them needs `src/` reverted, and stage 03 step 6 (the only allowed stash) does not apply to this task (spec section 6: tests none). The before-state evidence is the builder's snapshot, whose entry chunk and totals match the figures the spec expects from the local `.env`, and my after build differs from it only in the way the two edits predict.
- The ADR's registry-derived claims (peer ranges, `maintenance` and `latest` tags) were not re-queried with `npm view`; the installed versions and lockfile match the pins. `motion.tsx:30-40` behaviour claim is covered indirectly by the passing modal unit tests and the Playwright runs.
- The full 213-test Playwright suite was not run (the spec limits it to the 11 specs; CI runs the rest on the PR).

### 6. Blocking

None.

### 7. Non-blocking

- `docs/audit/refactor-log.md:20` - the heading carries the literal template text `code <sha or "pending the deploy record">, merged <same>`. The deploy record will overwrite it, but a plain `pending the deploy record` would read better.
- `docs/audit/refactor-log.md` Surprises, `docs/audit/task-ledger.md` and the build report say the ledger "reached 160 lines"; `wc -l` gives 159 (CRLF file, 150 plus 9). Also the T827 gate cell has the typo "83 passed on chr". The orchestrator may correct both in the commit or leave them.
- Refactor-log Verified and the ledger cell repeat the builder's unit time (61.01 s) and Playwright times (1.3 m, 7.9 m); my runs took 76.66 s, 58.8 s and 5.9 min. These are timing noise, not defects.

### 8. Rule candidates

- None for `AGENTS.md`. When the Phase 158 follow-on row (FinanceContext warnings plus wiring into lint and CI) ships, the Commands line and the tier rows need `lint:hooks` text; the code does not comply yet, so it stays out for now.

### 9. Fix block

Not applicable (APPROVED).
