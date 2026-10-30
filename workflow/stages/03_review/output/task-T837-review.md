# Review T837: one shared skeleton for the three ICM stage files

## Round 1

### 1. Metadata

- Task: T837 (Phase 164, branch `phase-164-icm-neutral-stages`, on top of T836 at `111b079`)
- Date: 2026-10-30
- Round: 1
- Verdict: APPROVED
- Target files: `workflow/stages/01_spec/CONTEXT.md`, `workflow/stages/02_build/CONTEXT.md`, `workflow/stages/03_review/CONTEXT.md` (bookkeeping: `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/task-T837-build.md`). `git check-ignore -v` on the three targets: none ignored (exit 1).

### 2. Summary

The three stage files now share the eight-section skeleton (Role and orders, Inputs, Process, Outputs, Verify, Never, Shell notes, STATUS line), with old non-skeleton headings kept as `###`. Stages 01 and 02 open Shell notes with the owner's tag definition and carry five tagged notes (4 `[generic]`, 1 `[local]`); stage 03 asks for one tag per rule candidate and says `None.` under Shell notes. The sentence-level proof shows every old sentence kept word for word and only the three allowed sentences added.

### 3. Invariants and parity

- Parity map: none touched (docs only).
- Before text pinned: `R1` sha256 of `HEAD:` each stage file matches the spec's pins (T836 landed as specced).
- Pure restructure: `R2` each target equals its spec block; `P1` to `P7` OK for all three files (55, 61 and 53 old sentences, 0 missing; new sentences exactly the definition (01, 02) and the Instruction then `None.` (03)).
- Cross-referenced step numbers: `R3` OK (stage 02 steps 4, 5 and step 5's two sub-bullets before step 6; stage 03 step 6 with 6.1 to 6.4).
- T836 done-when: `R4` no runtime names in the three files.
- Tags checked by hand against the owner's rule ([generic] = helps any project on Windows, PowerShell 5.1, Git Bash; [local] = depends on FinLife's own files, tools or layout):
  - 01 "A gate that checks line endings": `[generic]`. Only `git ls-files --eol`, Node, `grep`, Git Bash. Correct.
  - 01 "A gate that counts em dashes": `[generic]`. Only `grep -P`, Git Bash, two `node -e` counters over `git diff` and arbitrary files. Correct.
  - 02 "In Windows PowerShell 5.1, `>`, `>>`": `[generic]`. A PowerShell 5.1 encoding fact; T833 is cited evidence, not a path or tool. Correct.
  - 02 "Run the command through `cmd /c`": `[local]`. Its only commands are `npm run test:unit` and `workflow\stages\02_build\output\logs\`; making it generic would need a reword, which the spec forbids. Correct.
  - 02 "Use `| Out-File -Encoding utf8 <log>`": `[generic]`. PowerShell, `Out-File`, `Get-FileHash`, general npm/npx/node/git. Correct.
  - Stage 03 step 6.2's `core.autocrlf` sentence stays in the procedure, untagged, as the spec decides.
- Build report tag list: `## Shell note tags` holds the five lines above, matching the files in order (`R9` OK, 5 listed, 5 notes, one section).
- Text: 0 em dashes in the three targets, the ledger and the build report (whole-file Node count), and in the added diff lines (`R5`).
- Line endings: all four files `i/lf w/crlf`, 0 bare LF (`R6`).
- Ledger: exactly one `| T837 |` row (`R7`), in the Phase 164 table after T836, Commit empty.
- Scope: `git diff --stat` shows only the three targets and the ledger (81 insertions, 38 deletions); `git status --porcelain -uall` adds only the T837 spec, the T838 spec (a reviewer spec output, allowed by `R8`) and the T837 build report. No T838 target (`workflow/orchestrator/MASTER.md` etc.) is changed; `git diff --stat HEAD -- workflow/orchestrator .claude AGENTS.md CLAUDE.md` is empty. `R8` scope clean.

### 4. Gates run

- Gate 0: script extracted from the spec's one `js` block with the spec's `node -e` command to `workflow/stages/03_review/output/logs/T837-restructure.cjs` (9760 bytes).
- Gate 1: `node workflow/stages/03_review/output/logs/T837-restructure.cjs check`: 43 OK lines, 0 BAD, last line `bad 0`, exit 0 (both `R9` lines OK, as the spec expects for the reviewer's run). Log: `workflow/stages/03_review/output/logs/T837-check.log`.
- Gate 2: `npx vitest run unit/workflow-hardening.test.ts`: 1 file passed, 17 tests passed, 0 failed, 0 skipped, exit 0. Log: `workflow/stages/03_review/output/logs/T837-workflow-hardening.log`.
- Gate 3: `node workflow/stages/03_review/output/logs/T837-restructure.cjs selftest`: 2 `S0` OK, all 11 mutations `changed` and `caught` OK, 24 OK lines, `bad 0`, exit 0. Log: `workflow/stages/03_review/output/logs/T837-selftest.log`.
- Playwright: none (docs-only tier).

### 5. Not verified

- That the build report's `## Shell note tags` lines were copied from the builder's `INFO R9 expects` output rather than retyped: the builder's saved `workflow/stages/02_build/output/logs/T837-check.log` holds 43 OK lines and no `INFO` lines, so it is a later run made after the report existed and overwrote the first. The content is proven right by `R9` either way.
- Step 6 test red run: skipped, the spec's tests are `none`.

### 6. Blocking

None.

### 7. Non-blocking

- `docs/audit/task-ledger.md` T837 Gate result and the build report say Gate 1 had "40 OK lines", but the saved builder log shows 43 (a rerun after the report existed). Both counts are the spec's expected values for their run; the cell could name the 43-line run its log holds, or the builder could save the first run under a separate name.
- The build report skips section 3 (headings run 1, 2, Shell note tags, 4) and its Gate 1 summary does not mention `R9`. Cosmetic.

### 8. Rule candidates

- `[generic]` A gate log that the build report quotes should not be overwritten by a later rerun of the same command; save a rerun under its own name so the quoted run stays readable.
