# Stage 02: build

**Read `AGENTS.md` first, in full, before anything else.** Do not assume it was loaded for you.

**Agent:** the builder, agy (Gemini 3.8 Flash). **Orders:** `build <id>` and `fix <id>`, sent by the orchestrator (herdr). The reviewer (Claude Code) handles `spec <id>` (stage 01) and `review <id>` (stage 03).

## Inputs

- `workflow/stages/01_spec/output/task-<id>-spec.md`: the spec. Its target-file allowlist is binding.
- The `docs/contexts/*.md` files the spec names.
- On `fix <id>`: `workflow/stages/03_review/output/task-<id>-review.md`.

## Allowed writes

- The spec's target files.
- **Bookkeeping files**, always allowed and never a scope violation: `docs/audit/task-ledger.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, `workflow/stages/02_build/output/*`.
- Nothing else. A change the spec did not foresee means `BLOCKED`, not a wider edit.

## How to build

1. Read the spec, the named context files, and every target file and its tests **in full** before the first edit.
2. Sub-agents may only read. They never edit files or run commands that write.
3. Tests first: add the spec's tests and run them against the unchanged code; they must fail for the reason the spec gives.
4. Make the change, then run the spec's gates **once**, after all edits. Never edit `src/` while Playwright runs.
5. Set the task's row in `docs/audit/task-ledger.md` (add it if missing; status `in-progress`, then `done` with the gate result).
6. Write `workflow/stages/02_build/output/build-report.md`: task id, files changed (with the count), tests added and their fail-then-pass evidence, each gate command with its exact counts, and anything not done.

`build-report.md` is overwritten by each `build <id>`; a `fix <id>` appends a `## Fix round N` section to it.

## On `fix <id>`

- Fix only the blocking items in the latest round of `task-<id>-review.md`.
- Rerun the spec's gates.
- Recheck every blocking item from all earlier rounds still holds as fixed, and say so in the fix-round section.

## Never

- Read `docs/audit/archive/` or open `docs/design/*.html`.
- Use MCP write tools (Supabase, Vercel, GitHub) or sign in on the dev server.
- Run anything on `AGENTS.md`'s Stop and ask first list, including `git commit` and `git push`.
- Create `GEMINI.md`, or edit `AGENTS.md` or `CLAUDE.md`, unless the spec lists them as targets.
- Write an em dash in any file you touch.

## STATUS line

End every reply with exactly one line:

- `STATUS: BUILT | <n> files changed`
- `STATUS: FIXED | <n> files changed`
- `STATUS: BLOCKED | <n> files changed` (put the reason in the line above)
