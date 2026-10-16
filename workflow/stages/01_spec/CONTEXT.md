# Stage 01: spec

**Agent:** the reviewer, Claude Code. It writes specs and reviews only; it never edits app code, tests or config. **Order:** `spec <id>`, sent by the orchestrator (herdr). The other orders are `build <id>` and `fix <id>` (builder, stage 02) and `review <id>` (reviewer, stage 03).

## Task id and phase

- Ids continue the T-numbers in `docs/audit/task-ledger.md`: take the next number after the highest one used in the ledger or in any `workflow/stages/01_spec/output/task-T*-spec.md`. Write it with its `T`, e.g. `T750`.
- The phase number is the `NNN` in the current branch name, `phase-NNN-<slug>`.

## Read

1. `AGENTS.md` in full.
2. `docs/audit/task-ledger.md`.
3. Only the `docs/contexts/*.md` files the task touches, chosen from `AGENTS.md`'s routing table. A comments-only or docs-only task needs none.
4. The current code and tests the task touches, enough to cite `file:line`.

Never read `docs/audit/archive/` or open `docs/design/*.html`.

## Write

One file: `workflow/stages/01_spec/output/task-<id>-spec.md`. Nothing else. Under herdr the spec is the plan: an ADR the task needs is a target the builder writes first, and the builder keeps the task's ledger row.

## Spec sections, in this order

1. **Goal:** one or two sentences, in the owner's terms.
2. **Target files:** the exact allowlist of files the builder may change, one path per line.
   - If the task needs an ADR, list `docs/audit/decisions/NNNN-<slug>.md` with the next free number; the builder writes it first, before any code.
   - If the task ships the phase, list `docs/audit/refactor-log.md` and `docs/audit/baseline-metrics.md`.
   - Bookkeeping files are always allowed and need not be listed (see stage 02).
3. **Context to read:** which `docs/contexts/*.md` files the builder must read, and why, or "none" for a comments-only or docs-only task.
4. **Current behaviour:** what the code does today, each claim with `file:line`.
5. **Parity map:** the rows of `AGENTS.md`'s cross-file parity map this task touches, or "none".
6. **Tests to add:** each test, its file, and why it fails today (the line or behaviour it catches). `none` is valid only when the change cannot alter behaviour (comments, docs); give the reason. With `none`, stage 02 step 4 and stage 03 step 6 do not apply.
7. **Gates:** the union of `AGENTS.md`'s tier rows for every changed path, copied as commands, not tier names. An owner's task description may add gates but never remove a tier.
8. **Production touch points:** anything on `AGENTS.md`'s Stop and ask first list the task comes near, or "none". A task that needs one names who does it (the owner) and when.
9. **Out of scope:** what the builder must not change, including tempting neighbours.

## Rules

- A spec is specific enough that the builder needs no other judgment call. If the owner's intent is unclear, stop with `BLOCKED` and the question.
- Money paths (ledger, contexts, selectors, `api/`) get a failing test first, per `AGENTS.md`.
- No em dash in the spec.
- Stop after writing the spec. The orchestrator decides whether to pause for the owner.

## STATUS line

End every reply with exactly one line, starting with the task id:

- `STATUS: <id> | SPEC DONE | workflow/stages/01_spec/output/task-<id>-spec.md`
- `STATUS: <id> | BLOCKED | <the question or missing input>`
