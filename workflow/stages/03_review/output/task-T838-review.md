# Review T838: MASTER.md release and migration-check fixes, NO_COLOR in the build log rule

## Round 1

### 1. Metadata

- Task: T838 (Phase 164, branch `phase-164-icm-neutral-stages`, on top of T836 `111b079` and T837 `0988d34`); the task that ships the phase
- Date: 2026-10-30
- Round: 1
- Verdict: APPROVED
- Target files: `workflow/orchestrator/MASTER.md`, `workflow/stages/02_build/CONTEXT.md`, `docs/audit/refactor-log.md` (bookkeeping: `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/task-T838-build.md`). `git check-ignore -v` on the three targets prints nothing (exit 1): none is ignored.

### 2. Summary

MASTER.md release step 4 now stops at the PR link for an owner-merged PR, and `merged` runs its first hand-merge wait only on `merged`, `status` or the next order. Step 3b gives a runtime with no read-only Supabase tool (option B) a manual owner check of the migration history. Stage 02's last `[generic]` shell note gains the `NO_COLOR` sentence. The ledger gets the T838 row and the refactor log gets the Phase 164 entry.

### 3. Invariants and parity

- Parity map: no row is touched (docs only).
- Diff read hunk by hunk against spec section 7. MASTER.md changes only lines 57, 58 and 66 (edits 1 to 4, word for word). Stage 02 changes only the last Shell note (edit 5). T836's lines 36, 44 and 69 are untouched (`R0` pin, `R1` numstat 3 3).
- Sibling text stays consistent. MASTER.md:25 (`last` runs `release` in the same report), :47 (`status`), :53 (`release` trigger) and :72 (the `Your next step` examples already include "merge PR #N on GitHub") all match the new step 4. `loaders/fin-master.agent.md:76` (option B: push only, then "reply merged") has the same shape the fix gives option A's hand merge. `runtimes.md:25` (option B tools: no MCP) backs the new 3b sentence, and `runtimes.md:29` stays true. AGENTS.md's Release and Deploy record bullets are unchanged since `3ae3327` (`R9`).
- Role-only rule (T836's done-when): no runtime or model name in MASTER.md or stage 02 (`R2`). The new 3b sentence names "option B", a column, not a runtime.
- Tag: the `NO_COLOR` sentence names PowerShell, `cmd /c`, Git Bash, vitest, vite and `grep`, and no FinLife path or script, so it fits the `[generic]` note it ends. T837's tag counts (4 `[generic]`, 1 `[local]`) are unchanged.
- Phase-closing items:
  - Refactor-log entry: newest, directly above Phase 163, in the 11-line shape. The brief and the Deliberately not done line match the spec blocks exactly, and the file diff is +11/-0 (`R3`). The Changed line names every file of the T836 and T837 commits plus T838's (`R4`). The Verified line copies all three ledger Gate result cells word for word (`R4`). The Surprises line reads `none`. That is accurate: neither the T836 nor the T837 build report names one, both reviews have empty Blocking sections, and the T838 build report names none.
  - Ledger: one T838 row, directly after T837, with Task and Files cells exactly as specced, Status `done` and Commit empty (`R5`).
  - The owner's two amendments are recorded accurately. The brief has T836 covering MASTER.md lines 36, 44 and 69. It has T837 tagging by the owner's `[generic]`/`[local]` definition (four `[generic]`, one `[local]`, matching the T837 review's hand check), and the `NO_COLOR` sentence ending a `[generic]` note. `baseline-metrics.md` is correctly left alone: there are no bundle or test count changes.
- Em dashes: 0 in the full text of all four touched files, not only in the added lines, and 0 in the spec and the build report (`R6`).
- Line endings: all four files are `w/crlf` with 0 bare LF (`R7`).

### 4. Gates run

Logs are in `workflow/stages/03_review/output/logs/` (gitignored).

- Gate 0: a script pulled the spec's one `js` block out to `T838-gates.cjs`, using the spec's `node -e` command.
- Gate 1: not run (builder only, per the spec).
- Gate 2: `node workflow/stages/03_review/output/logs/T838-gates.cjs check` gave 40 OK lines, 0 BAD, 0 INFO, last line `bad 0`, exit 0. This matches the spec's expected 40 lines once the T838 row is `done`. Log: `T838-check.log`.
- Gate 3: `npx vitest run unit/workflow-hardening.test.ts unit/pre-push-guard.test.ts` gave 2 files passed, 35 tests passed, 0 failed, 0 skipped (22.70 s), exit 0. Log: `T838-guards.log`.
- Scope: `git diff --stat` shows 4 files (+16/-4): the three targets and the ledger. `git status --porcelain -uall` adds only the T838 spec and build report. Nothing is changed without being announced (`R8` clean).
- Playwright: none (docs-only tier).

### 5. Not verified

- Step 6 (red run) does not apply: the spec's tests are `none`.
- The full unit and Playwright suites were not run. The docs-only tier asks for neither.
- Whether the orchestrator follows the new step 4 at this phase's own release depends on it rereading MASTER.md after the T838 commit (spec section 9). If it does not reread it, the Phase 164 release may still go straight into the 9-minute wait.

### 6. Blocking

None.

### 7. Non-blocking

- The T837 review's non-blocking note (the ledger cell says 40 OK lines, while the builder's saved log holds a 43-line rerun) could have counted as a Surprise. It is a reporting detail, not a behaviour change, so `none` is defensible.
- Edit 4 writes `workflow/orchestrator/runtimes.md` without backticks, unlike MASTER.md's other path mentions. The text is as specced; this is cosmetic.
- The hand-merge `merged` path still does not say what to do when its one wait prints `waiting` (owner not merged yet). That gap was already there and is out of this task's scope.

### 8. Rule candidates

None. The `NO_COLOR` rule is now in stage 02, and the code complies.
