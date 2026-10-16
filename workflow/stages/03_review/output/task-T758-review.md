# T758 review

## Round 1

### 1. Metadata

- Task: T758, drop the bare `git commit` ask rules; ADR `0101` amendment; ships Phase 130
- Date: 2026-10-16
- Round: 1
- Verdict: APPROVED
- Branch: `phase-130-eol-check`, at `f2045f0` (T757), uncommitted working tree
- Target files: `.claude/settings.json`, `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`, `docs/audit/refactor-log.md`; bookkeeping `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/task-T758-build.md`

### 2. Summary

`.claude/settings.json` loses exactly `Bash(git commit:*)` and `PowerShell(git commit:*)` from `permissions.ask`. Nothing else moves. ADR `0101` gets the Status-line pointer and the Phase 130 amendment, word for word as in the spec. The Phase 130 refactor-log entry is rewritten to cover T757-T758 (T757's Verified text kept unchanged), and the ledger gets the renamed Phase 130 heading and T758's row (`done`, `Commit` empty).

### 3. Invariants and parity

- Parity map: no row touched.
- Kept rules: deny is identical to HEAD (91 entries). Ask is HEAD's list minus the two rules, order unchanged (11 entries). It still holds every push, merge, rebase and `gh pr create` rule for Bash and PowerShell, plus `Bash(ALLOW_GIT_WRITE=1 git push:*)` and the two GitHub MCP rules. No `allow` key was added.
- JSON validity and schema: `valid` against `https://json.schemastore.org/claude-code-settings.json` with `ajv` 8.20.0.
- ADR facts checked against the repo: `.git/hooks/pre-commit` and `pre-push` exist, are untracked, and block only when `HERDR_ENV=1` and `ALLOW_GIT_WRITE` is not `1` (read at spec time, unchanged). `AGENTS.md:39` still names `git commit` in Stop and ask first. No user-level settings file has a `git commit` rule, so removing the project rules does remove the prompt.
- The ADR still ends with a CRLF after the new item. T757's stale "No ADR `0101` amendment" claim is gone from the refactor log.
- `git check-ignore -v` on the three targets: none ignored (exit 1).

### 4. Gates run

All in Git Bash from the repo root; full output in `workflow/stages/03_review/output/logs/T758-gates.log`, schema run also in `workflow/stages/03_review/output/logs/T758-settings-schema.log`.

- G1 seven named paths: all listed, exit 0.
- G2 settings numstat `0 2`; the `-U0` diff is exactly `-      "Bash(git commit:*)",` and `-      "PowerShell(git commit:*)",`.
- G3 `deny 91 ask 11 OK`, exit 0, with the 11 rules listed above.
- G4 `valid`, exit 0 (six expected `unknown format "uri"` warnings).
- G5 `w/crlf` for all four files; Node CRLF 111 / 135 / 122 / 96, bareLF 0 each.
- G6 numstat `5 1` ADR, `6 6` refactor log, `2 1` ledger. ADR hits at `:3`, `:133`, `:135`. Ledger at `:59`, `:65`, `:66`, `:68`. Refactor log at `:22` (T757-T758 title) and `:33` (Phase 129).
- G7 em dashes: 0 across the four targets, the build report and the spec.
- G8 scope: `git diff --stat` shows 4 files, 13 insertions, 10 deletions; `git status --porcelain` shows the same 4 modified plus the untracked `task-T758-spec.md` and `task-T758-build.md`. No unannounced file.

No lint or test suite: no code tier applies (`AGENTS.md:92`). Tests `none` per spec section 6, so step 6's stash check does not apply.

### 5. Not verified

- That Claude Code really stops prompting for the orchestrator's commit. It cannot be checked without running a commit, which is on the Stop and ask first list. The reasoning holds (no other layer carries a `git commit` rule), but the first automatic commit is the real test.
- The refactor-log and ADR `<sha>` and release cells: left for the deploy record.

### 6. Blocking

None.

### 7. Non-blocking

- Once the ask prompt is gone, commits outside a herdr pane are guarded only by `AGENTS.md` and the session's permission mode, and the hooks live only in the owner's clone. The ADR amendment records this; the owner already saw it at spec time. No change asked.

### 8. Rule candidates

None.
