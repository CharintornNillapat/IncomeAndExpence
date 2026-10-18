# Review: T778

## Round 1

### 1. Metadata

- Task: T778, Phase 139 closing docs (branch `phase-139-subagent-trial`)
- Date: 2026-10-18
- Round: 1
- Verdict: APPROVED
- Reviewer model: Opus 5.5 (`claude-opus-5-5`), as the spec requires for an `AGENTS.md` target
- Target files: `AGENTS.md`, `README.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`; bookkeeping `docs/audit/task-ledger.md`. `git check-ignore -v` on all five: exit 1, so none is ignored.

### 2. Summary

Docs-only close of Phase 139. The unit count moves from 1438 / 62 files to 1444 / 63 files on `AGENTS.md:11` and `README.md:157` (one line each, number pair only). The Phase 139 `refactor-log.md` entry sits above Phase 138, the `baseline-metrics.md` Phase 139 section sits above Phase 137, and the T778 ledger row sits under T777.

### 3. Invariants and parity

- Parity map: no row touched (docs only; the spec says none).
- **Surprises (c) is verbatim.** A script took the `>` block from spec section 6a step 5 and compared it with the text after `(c) ` on the log line: identical, 762 = 762 chars. (a), (b), Changed and Deliberately not done also match the spec text exactly.
- **Counts and figures checked against the code or a fresh measurement:**
  - Unit: 63 files and 1444 tests, from my own run and from `ls unit/*.test.ts*` (63).
  - Playwright: `--list` gives `Total: 537 tests in 35 files`, 179 `[chromium]` entries and 35 unique spec files. `tests/*.spec.ts` count is 35.
  - Bundle (my clean build, gzip level 9 over `dist/assets`): `index-DdI940YI.js` 193,377 / 56,330; all JS 39 files 884,689 / 268,554; `index-BJZ9fITB.css` 52,877 / 10,216. Every figure matches the section. Deltas against Phase 137 also check out: +42 / -28, +20 / -34, 0 / 0. `dist/index.html` loads `index-DdI940YI.js` as the entry.
  - Per-task logs: T776-unit.log shows 63 files, 1440 passed, 43.94s. T777-unit.log shows 1444 passed, 60.60s. T778-unit.log shows 1444 passed, 75.76s. All match the baseline bullet. The per-task Playwright counts (T776: 12 / 36, T777: 6 / 18) match the T776 and T777 reviews.
  - Both earlier reviews are `## Round 1`, `Verdict: APPROVED`, so the "APPROVED in round 1" clause holds.
  - The Verified clauses for T776 and T777 are the ledger Gate result cells word for word.
  - Line references hold: `useTransactions.ts:68` was the removed line in `7e732d6^`, and it was the only reader of `showSoftDeleted` in the memo. No caller passes `includeDeleted`: the only call, at `TransactionsView.tsx:147`, does not. `FinanceContext.tsx:771-782` is the T69 comment plus `cloudRevisionRef`, and that comment names only `addTransaction`. `authenticated-ledger.test.tsx:833-859` is the "reload under it read nothing" test.
  - Repo-wide `1438|62 files` grep outside archive and output: only historical entries, ADRs and ledger rows remain, all of which the spec leaves alone.
- Shape: the entry follows the template headings, and the `<sha>` placeholders stay literal. It has no Release clause, as specified, and the `---` separators are in place.
- Line endings: all five files show `i/lf w/crlf`, with no `w/mixed`.
- Em dashes: 0 in added lines and 0 in each touched file, including the build report.

### 4. Gates run

| Command | Result | Log |
|---|---|---|
| `npm run test:unit` | 63/63 files passed; 1444 passed, 0 failed, 0 skipped (43.73s) | `workflow/stages/03_review/output/logs/T778-unit.log` |
| `npx playwright test --list` | Total: 537 tests in 35 files; 179 per project; read-only, no server | `workflow/stages/03_review/output/logs/T778-pw-list.log` |
| `npm run clean` + `npm run build` (`.env` present, not read) | exit 0; figures as in section 3 | `workflow/stages/03_review/output/logs/T778-build.log` |
| `git ls-files --eol` (5 files) | all `w/crlf` | - |
| `git diff -U0 HEAD -- AGENTS.md README.md` | one line each, number pair only | - |
| em dash count in added lines | 0 | - |
| `grep -rnE "1438" AGENTS.md README.md` | no match (exit 1) | - |
| `git diff --stat` / `git status --porcelain` | 5 tracked files (22+, 2-); untracked only `task-T778-spec.md` and `task-T778-build.md`. The build left no tracked change. | - |

### 5. Not verified

- Surprises (c)'s model counts come from sub-agent transcripts outside the repo, which the text itself says. I checked only that the text is verbatim from the owner's amendment, not the counts behind it.
- No red/green step: the spec's tests are `none` (docs only).

### 6. Blocking

None.

### 7. Non-blocking

- `docs/audit/refactor-log.md:24`: "T776 removes a redundant guard". The spec says "removes a guard". The guard was not redundant for an explicit `includeDeleted: true`; that is exactly the case where it did the wrong thing (CS-01). A more accurate wording would be "removes a guard that overrode an explicit `includeDeleted: true`". This is optional, and the owner's post-merge deploy record could fix it when it fills the shas.

### 8. Rule candidates

None.
