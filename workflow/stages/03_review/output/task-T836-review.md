# Review T836: role-only stage files, AGENTS.md and MASTER.md

## Round 1

### 1. Metadata

- Task: T836 (Phase 164, branch `phase-164-icm-neutral-stages`)
- Date: 2026-10-30
- Round: 1
- Verdict: APPROVED
- Target files: `workflow/stages/01_spec/CONTEXT.md`, `workflow/stages/02_build/CONTEXT.md`, `workflow/stages/03_review/CONTEXT.md`, `AGENTS.md`, `workflow/orchestrator/runtimes.md`, `workflow/orchestrator/MASTER.md` (bookkeeping: `docs/audit/task-ledger.md`, `task-T836-build.md`). `git check-ignore -v` on all six targets prints nothing (exit 1): none is ignored.

### 2. Summary

Eleven whole-line rewrites drop the runtime and model names (Claude Code, agy, Gemini 3.8 Flash) from the three stage files, AGENTS.md (lines 3, 128 to 130) and MASTER.md (lines 36, 44, 69), and point to `workflow/orchestrator/runtimes.md` instead. One sentence added to the end of `runtimes.md:3` says those files name roles only and that the Roles table maps each role to its agent and model. The ledger gets the Phase 164 section and the T836 row.

### 3. Invariants and parity

- Parity map: no row is touched (docs only).
- I compared the diff line by line with spec section 7. Every hunk is one of edits 1 to 11, with old text replaced by new text word for word and nothing else changed. G3 and G4 confirm this mechanically.
- MASTER.md:44, the role prompt sent verbatim: the new parenthetical holds no `"`, backtick or `$` (G5), so option A's Bash double-quoted send stays safe. The rest of the prompt is byte-identical.
- The `runtimes.md` Roles table (lines 10 to 15) has exactly one row each for Orchestrator (MASTER), Light reviewer, Strict reviewer and Builder, and line 30 is the Usage tracking row, so every pointer the edits add leads to a real row. Every dropped fact is still in that table (reviewers on Claude Code under Option A, builder agy on Gemini 3.8 Flash, ccusage for Option A only).
- AGENTS.md: the grep matches no line (exit 1). `GEMINI_API_KEY` is untouched, as the spec requires.
- `unit/workflow-hardening.test.ts` still passes, and the Release text it reads is unchanged.
- Em dashes: 0 in the full text of all seven touched files, not only in the added lines.
- Line endings: all targets and the ledger are `w/crlf` with 0 bare LF (G7).

### 4. Gates run

Logs are in `workflow/stages/03_review/output/logs/` (gitignored, confirmed with `git check-ignore`).

- Gate 0: a script pulled the spec's one `js` block out to `T836-gates.cjs`. It is byte-identical to the builder's copy (`cmp` printed nothing).
- Gate 1: `grep -nE 'Claude Code|agy|Gemini|Sonnet|Opus' workflow/stages/*/CONTEXT.md workflow/orchestrator/MASTER.md`. 0 lines, `exit=1`. Log: `T836-grep.log`.
- Gate 2: `npx vitest run unit/workflow-hardening.test.ts`. 1 file passed, 17 tests passed, 0 failed, 0 skipped. Log: `T836-workflow-hardening.log`.
- Gate 3: `node workflow/stages/03_review/output/logs/T836-gates.cjs`. Exit 0. All 41 check lines print OK and the last line is `bad 0`: G1 none on all 4 files, G2 none, G3 22 blocks with old 0 / new 1 on all 11 edits, G4 numstat 1 1 ×4 files, 4 4 on AGENTS.md, 3 3 on MASTER.md, G5 exists plus 5 rows plus shell-safe, G6 0/0/0, G7 7 files w/crlf with 0 bare LF, G8 scope clean. Log: `T836-gates.log`. I ran it before writing this review file, which G8's allow list also covers.
- Scope: `git diff --stat` shows the 6 targets and the ledger (7 files, +19 / -11). `git status --porcelain -uall` adds only the T836, T837 and T838 spec files and the T836 build report. No T837 or T838 build file appears, and nothing is changed without being announced.

### 5. Not verified

- Step 6 (red run) does not apply: the spec's tests are `none`, since the task is docs only.
- The Playwright and full unit suites were not run. The docs-only tier asks for neither, and the spec's gates are the three listed above.
- A builder pane or orchestrator session that is already running keeps the old wording until it is reset or rereads MASTER.md (spec section 9). Behaviour is the same either way.

### 6. Blocking

None.

### 7. Non-blocking

- MASTER.md:69 says the Usage tracking row "names the runtime it reads". The row itself says only "Option A", and `runtimes.md:5` defines Option A as Claude Code, so the claim holds through that indirection. No change needed.
- The ledger row's Status reads `done` before the commit. That matches how earlier phases' rows read, and the orchestrator fills in the Commit cell.

### 8. Rule candidates

None. The done-when grep could become a lint guard later, but the spec puts that out of scope as not asked for.
