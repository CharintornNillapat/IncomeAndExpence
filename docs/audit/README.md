# `docs/audit/`: index

The working memory of the audit and refactor work: what is planned, what shipped, how it measured, and why each decision was made. The rules themselves live in `AGENTS.md` and `docs/contexts/`, not here.

## Reading order

1. **`AGENTS.md`'s routing table**: which context file your task needs.
2. **`task-ledger.md`**: what is next.
3. Anything below only when the task calls for it.

## Live files

| File | What it holds | Read it when |
|---|---|---|
| `task-ledger.md` | Tasks from Phase 136 on, their status, and the Backlog | Always, after the routing table |
| `refactor-log.md` | One entry per shipped phase from Phase 136 on | Asked what has shipped recently |
| `baseline-metrics.md` | How to measure, and the latest bundle and test figures | Shipping a phase, or proving a change |
| `test-selector-contract.md` | Every id and `data-testid` the specs use today, and their hazards | Renaming, moving or removing an id |
| `audit-2026-10-16.md` | The whole-app audit of 2026-10-16 (T759): findings by domain and severity | Picking up a Backlog row it raised |
| `decisions/NNNN-*.md` | ADRs, one per decision with a live alternative | A rule or task names the ADR |

## `archive/`: do not read

**Never read a file inside `archive/` unless the user explicitly asks for historical research.** Archived files are never edited. It holds:

- `task-ledger-phases-001-124.md` and `refactor-log-phases-001-124.md`: the ledger and log before Phase 125. `task-ledger-phases-125-135.md` and `refactor-log-phases-125-135.md`: the ledger rows and the log entries for Phases 125 to 135.
- `baseline-metrics-phases-000-124.md`: every measured column before Phase 125.
- `test-selector-log-phases-019-124.md`: how each selector was added, moved or retired.
- `claude-monolith-v124.md` and `claude-md-history.md`: the pre-split `CLAUDE.md` and its release history.
- `audit-report.md`, `perf-audit-report.md`, `ui-ux-audit-report.md`, `implementation-roadmap.md`, `spec-acceptance-2026-10-02.md`: the early audits and plans and the 2026-10-02 acceptance check, holding the findings older ADRs cite by letter or number.
- `constraints-to-promote.md`: the old staging table (its open rows moved to the ledger's Backlog).
- `AGY_AUDIT300926.md` and `SUGGESTS.md`: the Antigravity review of 2026-09-30.

## Update discipline

- **Who writes what.** Under herdr, the reviewer's spec is the plan. An ADR the task needs is a spec target the builder writes first, before any code. The builder keeps the task's ledger row. `refactor-log.md` and `baseline-metrics.md` are written by the task that ships the phase. Outside herdr, one session does all of it, in the same order.
- **`task-ledger.md` is the only file edited by every task mid-phase.** Flip a row to `in-progress` when started; fill `Gate result` when it lands and leave `Commit` empty. The owner-approved deploy record fills every task's `Commit` cell once per phase, after the merge. The row goes under the section for the phase in the branch name, created from the template if missing.
- **Every `refactor-log.md` entry has `Surprises` and `Deliberately not done`,** even when they say "none".
- **`baseline-metrics.md` gains one section per shipped phase, at the top.** Never rewrite an archived column.
- **Keep each live file short.** Past about 150 lines, move finished phases into a new file in `archive/`.
- **An ADR is written before the code that implements it.** Under herdr it is a spec target the builder writes first.
- **Do not create** a `TODO.md` (the Backlog is in the ledger) or per-file notes.

## Relationship to the rule files

- **`AGENTS.md` and `docs/contexts/*.md`**: the agent-facing contract, present tense. `CLAUDE.md` only imports `AGENTS.md`.
- **`docs/audit/`** (here): the history and evidence behind it.
- **`README.md`** (repo root): human onboarding.

**A rule enters `AGENTS.md` or a context file only once the code complies.** Until then it waits as a Backlog row in `task-ledger.md`.
