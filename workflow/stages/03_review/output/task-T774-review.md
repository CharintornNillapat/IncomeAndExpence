# Review: T774

## Round 1

### 1. Metadata

- **Task:** T774, whole-pixel line height for the Hero token (CI safe-area failure from T769); Backlog row for running the layout specs on token changes
- **Date:** 2026-10-18
- **Round:** 1
- **Verdict:** APPROVED
- **Target files:** `src/index.css`, `unit/dashboard.test.tsx`, `DESIGN.md`, `docs/audit/refactor-log.md` (plus bookkeeping `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/*`)

### 2. Summary

`--text-hero--line-height` goes from `1.1` (48.4px) to `48px` (`src/index.css:327`), with a comment saying why. The existing "sets the figure at the Hero size" test gains one assertion that the declaration ends in whole `px`. `DESIGN.md:80` names the 48px line height, the Phase 137 refactor-log entry and the ledger (T774 row, one Backlog row) are updated. `tests/safe-area.spec.ts` and `LeftOverCard.tsx` are untouched.

### 3. Invariants and parity

- Parity map: none touched, none listed by the spec.
- `git check-ignore -v` on the four target files: no output (exit 1), so none is ignored.
- Scope: `git diff --stat` shows exactly `DESIGN.md`, `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`, `src/index.css`, `unit/dashboard.test.tsx` (15 insertions, 9 deletions). `git diff` for `src/components/dashboard/LeftOverCard.tsx` and `tests/safe-area.spec.ts` is empty; the step 1b temporary edit was reverted. One unannounced untracked path is not the builder's: see Non-blocking 1.
- Diff matches the spec: the CSS comment and value are as written (section 7 step 3); the DESIGN.md row is as written, U+2212 kept; the T774 ledger row and the Backlog row match the spec text, and no other Backlog row changed; the refactor-log edits (heading `T769-T774`, brief sentence, `Changed`, `Verified`, `Surprises`, `Deliberately not done`) are all in the Phase 137 entry only (the Phase 136 entry and the template are not in the diff).
- Full text of the changed test: the new lines sit inside "sets the figure at the Hero size" after the two existing `expect`s; `readFileSync` is imported from `node:fs` like `unit/proxy-parity.test.ts:2`.
- Counts in docs: unit count stays 1438, so `AGENTS.md` and `README.md` (both say 1438) need no edit.
- Line endings: `git ls-files --eol` shows `w/crlf` for all five changed files.
- Em dashes: 0 in the added lines of `git diff -U0 HEAD`, 0 in the build report, 0 in the spec.

### 4. Gates run

All logs in `workflow/stages/03_review/output/logs/`.

| Command | Result | Log |
|---|---|---|
| `npm run lint` | exit 0 (Node globals, safe ids over 132 files, both `tsc` passes) | `T774-lint.log` |
| `npm run test:unit` | 62 files passed, 1438 tests passed, 0 failed | `T774-unit.log` |
| `npx playwright test tests/safe-area.spec.ts tests/layout-stability.spec.ts tests/dashboard.spec.ts --project=chromium` | 19 passed | `T774-e2e-chromium.log` |
| same, no project filter | 51 passed, 6 skipped (safe-area and layout-stability's layout-shift test skip off Chromium), 0 failed | `T774-e2e-all.log` |
| Port 3000 and 3100 check before the runs | no listener; after the runs only TIME_WAIT sockets | n/a |

Section 6 (tests), step 6 (stash of `src/index.css`, which is `w/crlf`; the test depends on no other non-test file):

- `git status --porcelain` recorded before and after (`T774-status-before.txt`, `T774-status-after.txt`): identical. `git stash list` is empty after `git stash pop --index`.
- With `src/index.css` stashed (`:327` back to `1.1;`): `npx vitest run unit/dashboard.test.tsx` gives 1 failed, 48 passed; the failure is "sets the figure at the Hero size", `expected '/*\r\n * ...' to match /--text-hero--line-height:\s*\d+px;/` (`T774-red.log`).
- Same stash, `npx playwright test tests/safe-area.spec.ts --project=chromium`: 1 failed, 1 passed; `Expected: <= 745`, `Received: 745.390625`, which is CI's number (`T774-safe-area-red.log`). After the pop, the same spec passes (19-test run above), so the 48px line height is what clears it.

### 5. Not verified

- I did not re-run the builder's step 1b (`LeftOverCard.tsx` set to `text-4xl`): the stash run above shows the same cause from the other side (the CSS change alone turns 745.390625 into a pass), so the cause is confirmed.
- CI itself: the owner pushes the phase branch to rerun it. WebKit and Firefox do not run `safe-area` (it skips off Chromium by design).

### 6. Blocking

None.

### 7. Non-blocking

1. `workflow/stages/01_spec/output/.claude/jev-router-stats.json` is an untracked file created by a hook when the reviewer session's shell started in that folder (the folder the spec was written from). It is not the builder's and is not a target. The orchestrator must not stage it (`git add` by path only, per ADR 0101); the owner can delete the `.claude` folder there.
2. `unit/dashboard.test.tsx:175` reads the file with `new URL(String('../src/index.css'), import.meta.url)`, one `String(...)` wrap away from the spec's literal. It passes and fails as required (red and green above). The wrap is presumably to stop Vite treating a literal `new URL(..., import.meta.url)` as an asset; the build report does not say so. Harmless.

### 8. Rule candidates

- Already recorded as the new Backlog row: a typography or spacing token change runs `safe-area` and `layout-stability`, for `AGENTS.md`'s `src/index.css` tier row and `docs/contexts/ui-and-e2e.md`. Promote only once the code complies (the layout specs must then be named in that tier row).
- A token whose value is a unitless ratio (`--text-*--line-height`) multiplies into a fractional pixel height at whole-pixel sizes. A guard for the other tokens is not in this task (spec section 10).

### 9. Fix block

Not applicable (APPROVED).
