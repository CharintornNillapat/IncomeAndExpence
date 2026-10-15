# Stage 01: spec

**Agent:** the reviewer, Claude Code. It writes specs and reviews only; it never edits app code, tests or config. **Order:** `spec <id>`, sent by the orchestrator (herdr). The other orders are `build <id>` and `fix <id>` (builder, stage 02) and `review <id>` (reviewer, stage 03).

## Task id

Ids continue the T-numbers in `docs/audit/task-ledger.md`: take the next number after the highest one used in the ledger or in any `workflow/stages/01_spec/output/task-T*-spec.md`. Write it with its `T`, e.g. `T750`.

## Read

1. `AGENTS.md` in full.
2. `docs/audit/task-ledger.md`.
3. Only the `docs/contexts/*.md` files the task touches, chosen from `AGENTS.md`'s routing table.
4. The current code and tests the task touches, enough to cite `file:line`.

Never read `docs/audit/archive/` or open `docs/design/*.html`.

## Write

One file: `workflow/stages/01_spec/output/task-<id>-spec.md`. Nothing else.

## Spec sections, in this order

1. **Goal:** one or two sentences, in the owner's terms.
2. **Target files:** the exact allowlist of files the builder may change, one path per line. If the task needs an ADR, list `docs/audit/decisions/NNNN-<slug>.md` with the next free number. Bookkeeping files are always allowed and need not be listed (see stage 02).
3. **Context to read:** which `docs/contexts/*.md` files the builder must read, and why.
4. **Current behaviour:** what the code does today, each claim with `file:line`.
5. **Parity map:** the rows of `AGENTS.md`'s cross-file parity map this task touches, or "none".
6. **Tests to add:** each test, its file, and why it fails today (the line or behaviour it catches).
7. **Gates:** the exact commands from `AGENTS.md`'s tiered gates for every changed path, copied as commands, not tier names.
8. **Production touch points:** anything on `AGENTS.md`'s Stop and ask first list the task comes near, or "none". A task that needs one names who does it (the owner) and when.
9. **Out of scope:** what the builder must not change, including tempting neighbours.

## Rules

- A spec is specific enough that the builder needs no other judgment call. If the owner's intent is unclear, stop with `BLOCKED` and the question.
- Money paths (ledger, contexts, selectors, `api/`) get a failing test first, per `AGENTS.md`.
- No em dash in the spec.
- Stop after writing the spec. The orchestrator decides whether to pause for the owner.

## STATUS line

End every reply with exactly one line:

- `STATUS: SPEC DONE | workflow/stages/01_spec/output/task-<id>-spec.md`
- `STATUS: BLOCKED | <the question or missing input>`
