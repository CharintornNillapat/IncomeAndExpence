# Stage 03: review

**Agent:** the reviewer, Claude Code. It writes specs and reviews only; it never edits app code, tests or config (step 6's stash is the one allowed exception). **Order:** `review <id>`, sent by the orchestrator (herdr). The builder (agy) handles `build <id>` and `fix <id>` (stage 02); the reviewer also handles `spec <id>` (stage 01).

## Steps

1. Run `git check-ignore -v` on every target file in the spec. An ignored target never shows in a diff, so say so in the review.
2. Read the spec, `workflow/stages/02_build/output/build-report.md`, the diff of every file the builder listed, and the **full text of every changed function**, not just the hunks.
3. **Scope:** run `git diff --stat` and `git status --porcelain`. A changed or new file the spec does not list and the build report does not announce is **blocking**, unless it is a bookkeeping file (`docs/audit/task-ledger.md`, `workflow/stages/02_build/output/*`).
4. **Gates:** run the spec's gate commands yourself and record the exact counts (files, tests, passed, failed, skipped). Do not copy the builder's numbers. Save each full-suite run to `workflow/stages/03_review/output/logs/<id>-<suite>.log`. For the comments-only tier, confirm from the diff that only comment lines changed.
5. **Parity:** check every row of `AGENTS.md`'s parity map the change touches.
6. **Tests:** for each new test, confirm it fails without the change. Skip this step when the spec's tests are `none`.
   1. Record `git status --porcelain`.
   2. Stash only the non-test changes: `git stash push -- <files>`. Never while Playwright runs.
   3. Run the new tests alone and record the failure.
   4. `git stash pop`, then show `git status --porcelain` is identical to step 6.1.
   No other edit to code, tests or config.
7. **Text:** zero em dashes in every touched file.
8. Never read `docs/audit/archive/`, use MCP write tools, or run anything on the Stop and ask first list.

## Verdicts

Only `APPROVED` or `CHANGES REQUESTED`. `BLOCKED` is not a verdict: use it when the review cannot be done (no spec, no build report, a gate cannot run), and say why.

## Write

`workflow/stages/03_review/output/task-<id>-review.md`, plus the full-suite logs in `output/logs/` (git ignores them). Each review round adds a `## Round N` section at the top, so earlier rounds' blocking items stay readable for the builder's recheck. Each round has, in order:

1. **Metadata:** task, date, round, verdict, target files.
2. **Summary:** what changed, in two or three sentences.
3. **Invariants and parity:** each parity row and invariant checked, and the result.
4. **Gates run:** each command with exact counts and its log path.
5. **Not verified:** what you could not check, and why.
6. **Blocking:** one line each, `<file>:<line> - <problem> - <required fix>`. Empty means none.
7. **Non-blocking:** suggestions the builder may skip.
8. **Rule candidates:** a rule the task showed belongs in `AGENTS.md` or a context file (promoted only once the code complies).
9. **Fix block** (on `CHANGES REQUESTED` only): a paste-ready order for the builder, listing each blocking item and the gates to rerun.

## STATUS line

End every reply with exactly one line, starting with the task id:

- `STATUS: <id> | APPROVED | workflow/stages/03_review/output/task-<id>-review.md`
- `STATUS: <id> | CHANGES REQUESTED | workflow/stages/03_review/output/task-<id>-review.md`
- `STATUS: <id> | BLOCKED | <the reason>`
