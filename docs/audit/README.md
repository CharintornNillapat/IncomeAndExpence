# `docs/audit/` — index

## What this is, and is not

This directory is the **working memory** of an ongoing code audit and refactor of FinLife Tracker. It is evidential and historical: every claim carries a `path:line` citation, and files here accumulate over time rather than staying current the way `CLAUDE.md` does.

**This is not `src/context/`.** That is the app's single React context provider (`FinanceContext.tsx`). This directory is documentation about the codebase, unrelated to that file except as a subject of it. If you are looking for the app's state management, go to `src/context/FinanceContext.tsx`, not here.

## Reading order for a new session

1. `README.md` (this file) — orientation.
2. `task-ledger.md` — what is next. This answers "what should I work on" without re-reading the whole audit.
3. `audit-report.md` — the full findings, if you need the evidence behind a task.
4. `decisions/` — only if a task references an ADR number.
5. `refactor-log.md` — history, read only when asked what has already shipped.
6. `baseline-metrics.md` — numbers, read only when asked to prove or disprove an improvement.
7. `constraints-to-promote.md` — staging area, read only during a promotion pass into `CLAUDE.md`.

## File responsibilities

| File | Purpose | Written |
|---|---|---|
| `audit-report.md` | Frozen findings A–H with corrections | Once, in Phase 0. Append-only resolution notes after |
| `baseline-metrics.md` | Numbers, one column per phase | Phase 0, then appended after each phase's gate passes |
| `task-ledger.md` | Ranked tasks + live status | The only file edited mid-phase |
| `refactor-log.md` | One entry per shipped phase | Appended when a phase ships, never per commit |
| `constraints-to-promote.md` | Staging area for `CLAUDE.md` rules | Appended opportunistically; drained in Phase 9 |
| `decisions/NNNN-*.md` | ADRs for decisions with a live alternative | Written before the implementing task begins |

## Update discipline

- **`audit-report.md` is frozen after Phase 0.** Never delete a finding — it is the before-half of every before/after claim. The only edit permitted is appending a resolution note under a finding once its task ships.
- **`task-ledger.md` is the only file touched mid-phase.** Flip a row to `in-progress` when started, fill `Commit` / `Gate result` / `Metric delta` when it lands.
- **`baseline-metrics.md` never rewrites a column.** A regression must stay visible.
- **`refactor-log.md` entries must include `Surprises` and `Deliberately not done`,** even when empty ("none"). These are the sections skipped under time pressure and the ones with the most long-term value.
- **Do not create:** a `metrics-after.md` (it is a column, not a file), a `TODO.md` (duplicates the ledger), or per-file notes (they rot immediately and duplicate citations already in the audit).

## Relationship to `CLAUDE.md` and `README.md`

The split is by tense and audience:

- **`CLAUDE.md`** — durable, agent-facing contract. Short, imperative, present tense, no history, no evidence. States what is true and forbidden, right now.
- **`docs/audit/`** (here) — working memory. Long, evidential, historical.
- **`README.md`** (repo root) — human onboarding: how to run, build, test.

**Promotion rule: nothing enters `CLAUDE.md` until the code already complies.** A rule the code does not satisfy is worse than no rule — see `CLAUDE.md:53`'s `@/*` alias claim, which has zero actual usages anywhere in `src/` or `tests/`. Findings move from `constraints-to-promote.md` into `CLAUDE.md` only after their corresponding task has shipped and the gate has passed.
