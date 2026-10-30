# Task T833 review

## Round 1

### 1. Metadata

- Task: T833 (Phase 162, branch `phase-162-orchestrator-in-repo`)
- Date: 2026-10-30
- Round: 1
- Reviewer: strict
- Verdict: APPROVED
- Target files: `docs/audit/decisions/0116-orchestrator-prompts-in-the-repo.md`, `workflow/orchestrator/MASTER.md`, `workflow/orchestrator/runtimes.md`, `workflow/orchestrator/loaders/finlife.md`, `workflow/orchestrator/loaders/fin-master.agent.md`, `AGENTS.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` (unchanged, as the spec requires), plus the bookkeeping file `docs/audit/task-ledger.md`.

### 2. Summary

The five new files were extracted from their spec blocks and match them byte for byte after normalization (Gate 1). `AGENTS.md` got its three edits: the pause bullet adds `workflow/orchestrator/` and names itself the one home, the Otherwise item becomes a pointer, and a new Orchestrator prompt bullet goes in (numstat `3 2`). The ledger gains the Phase 162 section and T833 row, and the refactor log gains the Phase 162 entry. `baseline-metrics.md` is untouched.

### 3. Invariants and parity

- AGENTS.md parity map: the change touches no row (spec section 5). Confirmed.
- Step 1 check-ignore: none of the nine target and bookkeeping paths is ignored (`git check-ignore -v` exit 1, no output).
- Scope (step 3): `git diff --stat` shows only `AGENTS.md`, `docs/audit/refactor-log.md` and `docs/audit/task-ledger.md`. `git status --porcelain -uall` shows those three plus the five new files and the T833 spec and build report. No unannounced file.
- One home for the pause list: Gate 3 passes. I also read the AGENTS.md diff by hand. In the ICM section only the Pause after the spec bullet lists risk paths, and both Release items point at it.
- Read-only files outside the repo: all five hashed files match their spec-time sha256 (Gate 9).
- **Owner's line-22 note:** the build report's "Pointer Fix (Owner Note)" section says that `finlife.md:22`'s wrong "(section 4)" now reads "MASTER.md section 5", and it names both places. The new files bear it out: `workflow/orchestrator/loaders/finlife.md:27` reads `3. Send the BUILDER role prompt (MASTER.md section 5) verbatim:` and `workflow/orchestrator/loaders/fin-master.agent.md:49` reads `3. Send the BUILDER role prompt (MASTER.md section 5) verbatim, without its enclosing double quotes, in one shell call:`. MASTER.md section 5 is the role prompt. The refactor log's Surprise 1 records it too.
- runtimes.md facts, checked against the repo and the global files:
  - `.claude/agents/fin-reviewer.md:5` has `model: sonnet` and `fin-reviewer-strict.md:5` has `model: opus`.
  - Both `-g` agents have `model: inherit` at `:12`.
  - `.claude/settings.json` has 8 allow rules: the three ADR 0114 forms with their Bash/PowerShell and `2>&1` variants, auto-merge, and `herdr notification show`.
  - It has 7 ask rules: `git merge`, `git rebase`, PowerShell push/merge/rebase, and two GitHub MCP tools.
  - Its deny rules cover squash, rebase and admin merges, `--no-verify`, a second base or head, `-R`/`--repo`, `vercel`, and the MCP writes.
  - The live `finlife.md` frontmatter pins no model.
- **Section map:** I filled it in the appendix below, reading the live `finlife.md` (96 lines) and the live `fin-master/agent.md` (125 lines) section by section against MASTER.md and the loaders. No row is lost. Every change is a planned one.

### 4. Gates run

| Gate | Command | Result |
|---|---|---|
| 0 | Block EXTRACT, `GATES` to `workflow/stages/03_review/output/logs/T833-gates.cjs` | `wrote ...T833-gates.cjs` |
| 1-10 | `node workflow/stages/03_review/output/logs/T833-gates.cjs` (exit 0) | 75 OK lines, 0 BAD, `bad 0`. G4 shows the lines not verbatim in MASTER.md are `26,27,35,45,63,65,69,71,82,93`, and those not verbatim in loader A are `4,22`; no backtick spans are missing. G5 shows the missing spans are exactly the four in `B_DROPPED`. G8 shows CRLF counts of 144, 195 and 187 with 0 bare LF, and the five new files are LF only. G10 shows 10 changed paths, none out of scope. Log: `workflow/stages/03_review/output/logs/T833-gates.log` |
| 11 | `git ls-files --eol AGENTS.md docs/audit/task-ledger.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md` | All 4 files `i/lf w/crlf` |
| 12 | `git diff --numstat AGENTS.md`; `git diff --stat docs/audit/baseline-metrics.md` | `3	2	AGENTS.md`; empty |
| Text (step 7) | em-dash count over the touched files and the added ledger and refactor-log lines | 0 everywhere (G6 covers the new files and the AGENTS.md lines that were added) |

Docs-only tier: no lint, unit or Playwright run is required. The task changes no code, test or config file. Step 6 (red run) does not apply: the spec's tests are `none`.

### 5. Not verified

- `~/.gemini/config/config.json`: spec section 2 says Gate 9 hashes it, but the gate script's `HASH` table leaves it out. I did not open it, because it may hold secrets. So I cannot say it is unchanged, nor confirm runtimes.md's 12-entry deny list against it. The build never had a reason to touch it.
- Whether agy enforces its deny list for `fin-master` (Surprise 4). This can only be proven by a live run.
- The loaders' runtime behaviour. They are prompts, and the first real task through each installed loader is the live check (ADR 0116 Not done).

### 6. Blocking

None.

### 7. Non-blocking

- `workflow/stages/02_build/output/task-T833-build.md:33`: the report says "all 45 individual assertions passed", but the script prints 75 OK lines. The figure appears only in the build report; the ledger and the refactor log do not repeat it.
- `workflow/stages/02_build/output/logs/T833-gates.log` is UTF-16LE with a BOM because PowerShell 5.1 `>` wrote it, so `grep` finds nothing in it. A later build could use `| Out-File -Encoding utf8`.
- Option B behaviour changes the owner should know about before installing loader B. All of them follow from "Option B now follows the Option A body" (ADR 0116 Consequences), but the ADR does not name them one by one:
  - (a) A `task ... last` order now runs `release` step 1, the push, by itself. The old fin-master pushed only on an explicit `push`.
  - (b) The old `push` order's CI wait after the push is gone.
  - (c) MASTER.md's `merged` step 3b (read-only `list_migrations`) and step 2 (the Vercel read checks) assume MCP read tools that fin-master's frontmatter tool list does not include. Step 2 already had this gap in the old prompt.
- The spec's Gate 9 sentence and its `HASH` table disagree on `config.json` (see Not verified). This is a spec gap, not a build defect.

### 8. Rule candidates

- None for AGENTS.md. A possible line for stage 02: a builder running under PowerShell 5.1 saves gate logs as UTF-8, not with a bare `>`, so the reviewer can grep them.

### Appendix: section map (filled)

| Live `finlife.md` (lines) | New location | Planned change | Review |
|---|---|---|---|
| Frontmatter (1-3) | Loader A lines 1-3 | Verbatim | kept |
| Identity (4) | MASTER.md intro; loader A intro; models in runtimes.md Roles | Reviewer names become roles in MASTER.md; Sonnet and Opus move to runtimes.md | changed as planned (MASTER.md:3 uses roles; loader A:4 maps fin-reviewer to light and fin-reviewer-strict to strict; runtimes.md Roles has `model: sonnet` and `model: opus`) |
| 0. Preflight (6-16) | Loader A section 0 | Verbatim, plus three lines: read MASTER.md, say which branch it came from, `/clear` with `MSYS_NO_PATHCONV=1` | changed as planned (lines 7-16 are verbatim; the three additions are loader A:12, :15 and :21) |
| 1. Spawn fin-builder (18-23) | Loader A section 1 | Verbatim except line 22: "(section 4)" becomes "(MASTER.md section 5)" | changed as planned (loader A:27) |
| 2. Choosing the reviewer (25-29) | MASTER.md section 2 | Lines 26-27: pause-list pointer, light and strict reviewer roles | changed as planned. The pointer covers the old list plus `.github/workflows/`, `.claude/settings.json` and `workflow/orchestrator/`, and keeps "lists any Production touch point" |
| 3. Task loop (31-41) | MASTER.md section 3 | Line 35: pause-list pointer; overrides kept word for word | changed as planned (`pause after spec` and `no pause` are verbatim; lines 32-34 and 36-41 are verbatim) |
| 4. Send, wait, read (43-56) | MASTER.md section 4; loader A Runtime notes | Line 45: "the way your loader says"; loader A names the Agent tool and subagent_type names | changed as planned (loader A:31) |
| 5. BUILDER role prompt (58-59) | MASTER.md section 5 | Verbatim | kept |
| 6. status, ask, stop, reset, phase (62-66) | MASTER.md section 6 | Line 63: light reviewer; line 65: `MSYS_NO_PATHCONV=1` moves to loader A | changed as planned (the MSYS note is at loader A:21) |
| 6. Commit procedure (67) | MASTER.md section 6 | Verbatim | kept |
| 6. release (68-72) | MASTER.md section 6 | Line 69: "unpiped"; line 71: pause-list pointer | changed as planned. The pointer reads "no changed file and no Production touch point hits the pause list", which still excludes any touch point, because the pause bullet covers "Production touch points lists anything but none". The other release steps are verbatim |
| 6. merged (73-83) | MASTER.md section 6 | Line 82: "and unpiped" | changed as planned |
| 6. usage (84) | MASTER.md section 6 | Verbatim | kept |
| 7. Every report (86-87) | MASTER.md section 7 | Verbatim | kept |
| Rules for MASTER (89-96) | MASTER.md Rules | New never-pipe bullet after line 91; line 93: reviewer roles | changed as planned (bullet order kept; the new bullet is MASTER.md Rules 3) |
| Memory note `never-pipe-pushes.md` | MASTER.md Rules and release step 1, merged step 4 | Rule kept, its `> <log>` form not adopted (ADR 0116 Not done) | changed as planned |
| `fin-master/agent.md` 1-16, 22-49, 71-91, 102, 113, 121 | Loader B | Kept, with the hook check added and Option B narrowing (no `gh pr`) | kept. Frontmatter 1-16 is verbatim (G5). Shell rules 23, 25-27 are verbatim, and 24 says "see the translation rule below" in place of "(section 6)". Preflight 30-37 is verbatim, with "skip section 1" for the new numbering. Spawn is verbatim with the MASTER.md section 5 pointer. The reviewer call, here-string order, wait loop and 5-minute note match 71-91. `manage_subagents` stop (102), usage (113) and the subagent rule (121) are kept. The hook check is loader B:40. Identity line 18 is reworded only to map the light and strict roles |
| `fin-master/agent.md` 51-67, 93-100, 103-112, 115-125 | MASTER.md, translated by loader B | Option B now follows the Option A body (ADR 0116 Consequences) | changed as planned. The stale lists at 52 and 61 become pointers. The `push` order (106) becomes `release` step 1 only, which loader B narrows. The plain `git push` (111) becomes `git push origin main` through the `$env:` translation. The `$LASTEXITCODE` check (104) is kept by loader B's shell rule. See Non-blocking for the behaviour changes this brings to Option B |
