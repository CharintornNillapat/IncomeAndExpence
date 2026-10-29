# T828 review: Unattended pushes behind a pre-push guard

## Round 1

### Metadata

- **Task:** T828, phase 159, branch `phase-159-unattended-pushes`
- **Date:** 2026-10-29
- **Round:** 1
- **Verdict:** APPROVED
- **Target files:** `docs/audit/decisions/0114-unattended-pushes-pre-push-guard.md`, `unit/pre-push-guard.test.ts`, `scripts/git-hooks/pre-push`, `.gitattributes`, `.git/hooks/pre-push` (untracked), `.claude/settings.json`, `AGENTS.md`, `README.md`, `docs/audit/decisions/0101-hierarchical-icm-context-and-herdr-stages.md`, `~/.claude/commands/finlife.md` (outside the repo), `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, `docs/audit/task-ledger.md`
- `git check-ignore -v` on every repo target: none ignored (exit 1). `.git/hooks/pre-push` and `finlife.md` never show in a diff, so I checked them by hash and by `diff -u` against the backup.

### Summary

The builder added a versioned pre-push guard (`scripts/git-hooks/pre-push`, Block B1 byte-exact, LF) and installed a byte copy in `.git/hooks/pre-push`. It added an 18-case bare-repository test (Block B2, exact) and ADR 0114. Only after the red run, the green run, the install and the replay did it change `.claude/settings.json`: 6 allow rules, 14 deny rules and 4 removed ask rules. It also edited the AGENTS.md, README, ADR 0101 and audit docs, and made exactly the five spec'd edits to MASTER's `finlife.md`.

### Invariants and parity

- **Parity map:** no row touched. `.gitattributes` gained `scripts/git-hooks/* text eol=lf`; the `index.html` CSP-hash row is unaffected, and `unit/security-headers.test.ts` passes (Gate 9).
- **Build order (owner addition 1):** file mtimes show the steps ran in order: spec 19:14:24, ADR 0114 19:17:56, back-ups 19:18:30, test file 19:19:17, `scripts/git-hooks/` created 19:19:21, red log 19:22:13 (run started 19:21:33), new hook source 19:43:12, `.gitattributes` 19:43:42, green log 19:44:45, installed hook 19:45:03, install log 19:45:32, replay log 19:46:37, `.claude/settings.json` 19:47:26, docs 19:48 to 19:50, `finlife.md` 19:50:09, build report 19:56:25. Gate 5, which I ran myself: `push allow rules 3 installed true red true green true replay true ordered true`, exit 0. No push allow rule exists without the installed, tested hook.
- **The builder's red log is genuine and came from the OLD hook.**
  - (a) It was written at 19:22:13. The new hook source was not written until 19:43:12, and the scripts folder (holding the copied old hook) was created at 19:19:21.
  - (b) It shows 13 failed and 5 passed. A missing hook file would make `copyFileSync` throw in `beforeEach` and fail all 18.
  - (c) Its failure pattern can only come from the old hook. Every "refuses" case outside herdr fails on `expected +0 not to be +0`, meaning the push succeeded. "refuses deleting main" fails on the bare remote's `deletion of the current branch prohibited` without the `pre-push guard:` message. The herdr-without-ALLOW case passes.
  - (d) I reproduced it myself against the backup (below): the same 13 test names fail.
  - The backup `T828-pre-push.old` equals the spec's Old hook text (CRLF folded: true; sha256 `cdf850de...`).
- **Installed hook is byte-identical:** sha256 `fecc13dde800d0b31f7441d1f3a1652b58e5404f5229040ef923ae7003e64208` for both `scripts/git-hooks/pre-push` and `.git/hooks/pre-push`, and `cmp` reports them identical. `git check-attr eol` gives `lf`, the file has 0 CR, and `core.hooksPath` is unset (D2 holds). `.git/hooks/pre-commit` still has its 2026-10-16 mtime.
- **Hook logic (read in full):**
  - The herdr guard comes first.
  - The `while read` loop is not in a pipeline, so `fail`'s `exit 1` ends the script.
  - Non-main refs outside herdr are skipped. Delete and create are handled through `is_zero`, and fast-forward through `merge-base --is-ancestor`. An unknown remote sha fails closed with "fetch first".
  - A push to main refuses any merge in the range. Each commit's subject must match `docs(deploy): ... [skip ci]`, and `diff-tree --no-renames --name-status` must hold only `M` of the four allowed paths, so a rename or a new ADR is refused.
  - The script is POSIX sh only (`case`, `[[:space:]]`, `read -r`), so it runs under dash on CI.
- **`.claude/settings.json`:** Gate 6 gives `allow 8 deny 113 ask 7 OK`, numstat `22 6`, 139 lines, CRLF. The diff holds only the B14, B15 and B16 rules and the four removed ask lines.
- **`finlife.md` against `T828-finlife.md.orig`:** `diff -u` shows exactly B9 inserted after line 11, line 51 replaced by B10, B13 replacing the old text inside line 69 (rest of line unchanged), B12 replacing the old text inside line 81 (rest of line unchanged), and B11 inserted after line 90. Nothing else changed. The file stays LF (96 lines, 0 CRLF) and has 0 em dashes.
- **Ledger:**
  - Backlog Row A ends `| done in Phase 159 (T828) |` (B17 present, G7 gone).
  - Backlog Row B (builder chromium-only runs) is still `todo`.
  - The Phase 159 section and the T828 row sit directly before `## Backlog`, with the Commit cell empty.
- **Counts in docs:** AGENTS.md and README now say 1624 tests in 73 files, which matches my passing full-suite run (73 files, 1624 tests).

### Gates run

All logs are in `workflow/stages/03_review/output/logs/`.

| Gate | Command | Result | Log |
|---|---|---|---|
| Step 6 red repeat (replaces Gate 1) | `cp T828-pre-push.old scripts/git-hooks/pre-push`; `npx vitest run unit/pre-push-guard.test.ts`; `cp .git/hooks/pre-push scripts/git-hooks/pre-push && cmp ...` | `Tests  13 failed \| 5 passed (18)`, the 13 spec'd tests (1, 3 to 11, 15, 17, 18); `restored`; the source hash is back to `fecc13dd...`; `git status --porcelain` is identical before and after | `T828-red.log` |
| 3 | installed-copy check plus `git check-attr eol` | `identical true CR 0 shebang true final LF true`; `eol: lf` | `T828-gates.log` |
| 4 | replay of real history through `.git/hooks`, pushing only to a temp bare repo (the temp clone's `origin` is the local path; I pushed by path) | `accepted 36 refused 0; merge 160c4b7 onto 5d993de refused: pre-push guard: refusing a merge commit on refs/heads/main`; local `main` and `origin/main` unchanged at `f35ab99` | `T828-replay.log` |
| 5 | order check (reads the builder's logs) | `push allow rules 3 installed true red true green true replay true ordered true`, exit 0 | `T828-gates.log` |
| 6 | rule lists against HEAD | `allow 8 deny 113 ask 7 OK`; numstat `22 6`; 139 lines | `T828-gates.log` |
| 7 | blocks and gones | `blocks 27 bad 0`; B1 exact true; B2 exact true (CRLF folded); `finlife.md` diff as above | `T828-gates.log` |
| 8 | `npm run lint` | exit 0 (node-globals 139 files, safe-ids 139 files, both tsc clean) | `T828-lint.log` |
| 9 | `npx vitest run unit/pre-push-guard.test.ts unit/security-headers.test.ts` | 2 files passed, 28 tests passed, 25.75 s | `T828-gate9.log` |
| 10 | `npm run test:unit` | Run 1: `Test Files 1 failed \| 72 passed (73)`, `Tests 1606 passed \| 18 skipped (1624)` (`unit/migration-history.test.ts` `beforeAll` `PGlite.create()` hit the 10 s hook timeout). Alone: 1 file, 18 passed, 2.03 s. Run 2: `Test Files 73 passed (73)`, `Tests 1624 passed (1624)`, 78.86 s | `T828-unit.log`, `T828-migration-history-alone.log`, `T828-unit-run2.log` |
| 11 | line endings | the first eight files have bareLF 0; both hooks and `finlife.md` have crlf 0; ADR 0114 (50 CRLF) and the test file (213 CRLF) are not mixed | `T828-gates.log` |
| 12 | em dashes | added lines 0; whole files 0 (hook, test, ADR 0114, `finlife.md`, spec, build report) | `T828-gates.log` |
| 13 | scope | `git status --porcelain` matches the spec's list exactly; `scripts/git-hooks` holds only `pre-push`; numstat `2 1` AGENTS.md, `1 1` README.md, `1 0` `.gitattributes`, `4 0` ADR 0101 | `T828-gates.log` |

None of my vitest runs hung; each returned its exit code. No Playwright tier applies: nothing under `src/`, `tests/`, `index.html` or `public/` changed.

### Not verified

- **Claude Code's matcher on the new rules.** By design (ADR 0114, Not done): nothing tests it, and this phase's release push, `gh pr create` and deploy-record push are the first live checks.
- **Earlier writes to `.claude/settings.json`.** An mtime shows only the last write (19:47:26). I cannot prove the file had no earlier, later-reverted write before the hook was installed. The order and every log are consistent with a single write in step 6.
- **`~/.claude/settings.json`** has mtime 19:56:33, 8 s after the build report. Its shape matches the spec's section 4: no `permissions` key, `autoMode` keys `soft_deny,environment`, 3 `soft_deny` entries, no `classifyAllShell`. The change is probably Claude Code's own state write, but I cannot attribute it, and I have no backup to diff against.
- **The pre-phase text of Backlog rows A and B.** The owner's hand edit was never committed, so there is no older copy to diff. Only Row A's status cell changed, according to B17 and G7.

### Blocking

None.

### Non-blocking

- **Possible flake in the full suite (Gate 10, run 1).** `unit/migration-history.test.ts:15` (`beforeAll` with `PGlite.create()`) timed out at the default 10 s hook timeout. The file passed alone in 2.03 s and the full suite passed on rerun. The refactor log records no such flake before, and the new test spawns about 10 git processes per case for about 25 s in a parallel worker, so CPU contention on this Windows machine is a plausible cause. Watch the PR's CI run. The orchestrator or the deploy record may add a line to the Phase 159 refactor-log Surprises.

### Rule candidates

None.
