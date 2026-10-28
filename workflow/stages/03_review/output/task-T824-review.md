# T824 review

## Round 1

### 1. Metadata

- Task: T824, Phase 155 (`phase-155-rule-candidates`), the phase's last task
- Date: 2026-10-28
- Round: 1
- Verdict: APPROVED
- Target files: `AGENTS.md`, `docs/contexts/ui-and-e2e.md`, `docs/audit/refactor-log.md`, plus bookkeeping `docs/audit/task-ledger.md`. `git check-ignore -v` on all four: none ignored (exit 1).

### 2. Summary

The `src/index.css` tier row in `AGENTS.md` now says a type size, line height, font or spacing token makes `tests/safe-area.spec.ts` and `tests/layout-stability.spec.ts` affected specs. `docs/contexts/ui-and-e2e.md` gets one Styling and type bullet with the tokens, what the two specs check, and the T769/T774 reason. The Phase 155 refactor-log entry covers T823 and T824. The ledger adds the T824 row and flips Backlog row 105.

### 3. Invariants and parity

- Parity map: no row touched (no code, DOM id, type or SQL change).
- Scope: `git diff --stat` shows the 4 announced files (15+, 2-). `git status --porcelain` adds only the untracked `task-T824-spec.md` and `task-T824-build.md`. Nothing unannounced.
- Docs-only PR: `git diff --name-only main` plus status paths, filtered by `^(docs/|anti-slop/)|\.md$`, prints nothing (grep exit 1). Every branch path is under `docs/` or ends in `.md` (T823's `workflow/stages/*/CONTEXT.md` and outputs end in `.md`).
- `docs/audit/baseline-metrics.md` is byte-identical: `git diff --quiet` against both HEAD and `main` exit 0.
- Refactor log, T823 part, checked against commit `7133cc3` (`git show --stat`: `docs/audit/task-ledger.md`, `workflow/stages/01_spec/CONTEXT.md` +1, `workflow/stages/02_build/CONTEXT.md` +1, plus its three stage outputs). The Changed text matches the two added bullets and the ledger diff (Phase 155 section, T823 row, row 104 done). Verified is T823's ledger Gate result, word for word. Deliberately not done ("no ADR", "no prose line under Phase 155 heading") is taken from `task-T823-build.md` section 5. No `workflow/stages/*/output/` file is listed under Changed. "None for T823" under Surprises is right.
- Refactor log, T824 part: matches this diff. The heading keeps the literal `<sha>` placeholders and there is no `**Release:**` paragraph, as the spec says.
- Citations: `9ca857f` (T769) adds `--text-hero--line-height: 1.1` to `src/index.css`; `364e41d` (T774) changes it to `48px`, and its message gives 48.4px and the footer 0.39px under the nav in `safe-area.spec.ts`. The live comment at `src/index.css:398` gives the same cause. ADR 0103 at `:103` says T793 ran both layout specs with no size change. All accurate.
- Bullet facts: `--font-sans` (`:396`), `--text-hero--line-height: 48px` (`:400`), the iOS `--text-xs`/`--text-sm: 1rem` override (`:451-452`), 4 `IBM Plex Sans Thai Fallback` faces with `size-adjust`/`ascent-override`. One `browserName !== 'chromium'` skip in each spec. All accurate.
- Ledger: the T824 row follows T823's in the Phase 155 section, Status `done`, Commit empty. The only change to Backlog row 105 is its Status cell (`done in Phase 155 (T824)`). Row 104 and every other row are untouched.

### 4. Gates run

Log: `workflow/stages/03_review/output/logs/T824-gates.log`.

1. Text landed (the spec's Node command, reading its tagged code blocks): `agents-old AGENTS.md 0`, `agents-row AGENTS.md 1`, `ui-bullet docs/contexts/ui-and-e2e.md 1`, `backlog-old docs/audit/task-ledger.md 0`, `backlog-row docs/audit/task-ledger.md 1`; exit 0.
2. Diff shape: `1 1 AGENTS.md`, `1 0 docs/contexts/ui-and-e2e.md`; the out-of-scope `git diff --quiet` exits 0.
3. Docs-only PR: the filter prints nothing, exit 1.
4. Paths and tokens: both spec files listed; the token grep count is 6; `--text-xs`/`--text-sm` at lines 451 and 452; the `browserName !== 'chromium'` count is 1 in each spec.
5. Stated counts: `AGENTS.md:11` holds both count strings; `ui-and-e2e.md:68` holds `213 tests in 37 specs` (line 68 now because the new bullet pushed it down one line); `ls unit/*.test.* | wc -l` gives 72.
6. Ledger: 1 T824 row and 1 Phase 155 heading; 132 lines.
7. Refactor log: Phase 155 at line 22, above Phase 154 at line 33. Each of the four labels appears once.
8. Line endings: `w/crlf` on all four files. CRLF/bare LF counts: AGENTS.md 140/0, ui-and-e2e.md 80/0, refactor-log.md 112/0, task-ledger.md 132/0.
9. Em dashes: 0 in added diff lines. Whole-file counts are also 0 in all four targets and in the T824 spec and build report.

No lint, unit or Playwright run: no code, test or config file changed (docs-only tier).

### 5. Not verified

- Step 6 (red run) does not apply: the spec's tests are `none`.
- `docs/audit/archive/` was not opened. The T769/T774 history was checked only from the commits `9ca857f` and `364e41d` and from the `src/index.css:398` comment.
- The ADR 0111 docs-only CI path can only be seen on the live PR. That is an owner observation (spec section 8).

### 6. Blocking

None.

### 7. Non-blocking

- `task-T824-build.md` gate 6 gives 133 ledger lines; the file has 132. This does not affect the result.
- The Phase 155 ledger section (written by T823, already committed) has no `Branch ...` line under its heading, unlike Phase 154. The deploy record can add it.

### 8. Rule candidates

None new. This task is itself the promotion of Backlog row 105.

## Files to stage (orchestrator)

- `AGENTS.md`
- `docs/contexts/ui-and-e2e.md`
- `docs/audit/refactor-log.md`
- `docs/audit/task-ledger.md`
- `workflow/stages/01_spec/output/task-T824-spec.md`
- `workflow/stages/02_build/output/task-T824-build.md`
- `workflow/stages/03_review/output/task-T824-review.md`

Release note: the PR is docs-only and touches `AGENTS.md`, so it is never auto-merged. The owner merges it.
