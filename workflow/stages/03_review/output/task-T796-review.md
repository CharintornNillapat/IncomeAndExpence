# Review: T796

## Round 1

### 1. Metadata

- Task: T796, Phase 143 closing docs (branch `phase-143-paper-ledger-light-theme`, base `45b9e87`)
- Date: 2026-10-23
- Round: 1
- Verdict: APPROVED
- Target files: `AGENTS.md`, `README.md`, `DESIGN.md`, `docs/contexts/ui-and-e2e.md`, `docs/audit/decisions/0103-paper-ledger-light-theme.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`; bookkeeping `docs/audit/task-ledger.md`. `git check-ignore -v` on all eight: none ignored (exit 1).

### 2. Summary

The task changes docs only. It updates the unit and Playwright counts (1475/66, 181/35/543) in `AGENTS.md`, `README.md` and `ui-and-e2e.md`, and promotes the theme-variable rule to `ui-and-e2e.md`. It also rewrites the `DESIGN.md` status line, adds the D-label note, fixes D-c and D-d in ADR 0103 Amendment (T795) and adds item 3. Finally it adds the Phase 143 `refactor-log.md` entry and the `baseline-metrics.md` section, fills the T792 to T795 Commit cells and marks the T796 ledger row done. A script compared each inserted block with the spec's 6a block after filling the placeholders (X=76.39, P=537, S=6, M=8.9), and all four match exactly. The ledger row and the line edits match the spec word for word.

### 3. Invariants and parity

- Parity map: none touched (the spec says none; the diff touches no code).
- **Scope:** `git diff --stat` shows 8 files, +37/-14: the 7 targets plus the ledger. `git status --porcelain` lists only those 8 and the two untracked stage outputs (`task-T796-spec.md`, `task-T796-build.md`). The ignored list holds only the usual folders (`dist/`, `test-results/`, `playwright-report/`, `dev-dist/`, the stage `logs/` folders, and so on). A `find` of the whole repo outside `node_modules` finds no `measure-assets*`, so the builder's scratch file is gone and left nothing behind.
- **Order of the full run versus the doc edits:** the timestamps show the order the spec asked for. The builder's unit log was written at 05:50:50 (run started 05:49:34). The `dist/assets/index-*` files date from 05:51:51. The Playwright log was created at 05:52:51 and last written at 06:01:48. The first doc edit (`AGENTS.md`) is at 06:02:07, and the other docs follow up to 06:05:11. The `--list` and the build ran before the full run because the spec puts them there (gates 2 and 3 before gate 5). The full run finished before any doc edit.
- **Promoted rule, code complies:** plain `@theme` (`src/index.css:370`) has 0 `--color-` entries, `@theme inline` sits at `:309`, and `unit/theme-tokens.test.ts:113-115` asserts it. The rule went into `ui-and-e2e.md` only, and `identityDisplayColor` still has a single copy (`:8`, unchanged).
- **ADR 0103:** only Amendment (T795) changed. D-c gained the idempotence sentence, D-d "Sign, not colour" was added with a real U+2212 (bytes E2 88 92), the guard label became `**Guard:**`, and item 3 was appended. The file still ends in CRLF.
- **Facts spot-checked:** the shas from `git log --grep` are `eddfd96`, `c702aef`, `c5c2358` and `45b9e87`, matching the ledger cells. `ls unit` gives 66 test files. The Amendment (T795) lists 15 paint sites, matching "15 paint sites in 11 components".
- Text: 0 em dashes in each of the 8 files, in the added diff lines and in the build report. All 8 files are `w/crlf` with `bareLF 0` and end in CRLF.
- Line counts: `task-ledger.md` 145, `refactor-log.md` 106 and `baseline-metrics.md` 143, all under about 150.

### 4. Gates run

| Command | Result | Log |
|---|---|---|
| `npm run test:unit` | 66 files passed (66), 1475 tests passed (1475), 0 failed, 0 skipped, 43.09 s | `workflow/stages/03_review/output/logs/T796-unit.log` |
| `npx playwright test --list` / `--project=chromium` | `Total: 543 tests in 35 files` / `Total: 181 tests in 35 files` | n/a |
| `rm -rf dist && npm run build` + gzip-9 measure | exit 0; `index-TU2ZOqF8.js 193293 56428`, `index-BNXJTUPd.css 53895 10526`, `allJS 884987 268756 39`, all exactly as recorded | `workflow/stages/03_review/output/logs/T796-build.log` |
| ports 3000/3100 before Playwright | none listening | n/a |
| `npx playwright test` (3 browsers) | 537 passed, 6 skipped, 0 failed, 0 flaky, 7.7 min, exit 0 | `workflow/stages/03_review/output/logs/T796-playwright.log` |
| `git log --grep` shas | eddfd96, c702aef, c5c2358, 45b9e87 | n/a |
| stale-count `git grep` / stale-text `git grep` | both exit 1, no output | n/a |
| `git ls-files --eol` + CR/LF count | 8 x `i/lf w/crlf`, bareLF 0 | n/a |
| em dash in diff additions | 0 | n/a |

The builder's figures (1475 passed in 76.39 s; 537/6 in 8.9 min) are its own run times, and the docs cite its logs. My run reproduces every count; only the wall times differ, as expected.

### 5. Not verified

- The narrative claims about earlier tasks in the refactor-log entry (T792 to T795 Verified figures, Surprises a to g, "27 verdicts") are copied word for word from the spec author's text and the earlier reviews. I spot-checked the paint-site count and the shas, not every figure.
- Step 6 (red run) does not apply: docs-only, and the spec lists no tests.

### 6. Blocking

None.

### 7. Non-blocking

- `baseline-metrics.md` and the ledger row cite the builder's 76.39 s unit time. This review's run took 43.09 s on the same tree. Both are valid; no change needed.

### 8. Rule candidates

None new. The theme-variable rule this task promoted was the candidate, and the code complies.
