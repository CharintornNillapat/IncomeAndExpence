## Round 1

**Metadata:** task T835, 2026-10-30, round 1, verdict APPROVED. Target files: `docs/audit/baseline-metrics.md`, `docs/audit/refactor-log.md` (bookkeeping: `docs/audit/task-ledger.md`, the build report). `git check-ignore -v` on both targets prints nothing, so neither is ignored and both show in the diff.

**Summary:** The Phase 161 Lint bullet in `baseline-metrics.md` now records the builder's +1,681 ms and cites the T832 reviewer's +758 ms once as a noisy cross-check. `refactor-log.md` gains the Phase 163 entry (11 lines, nothing deleted) above Phase 162. The ledger gets the T835 row. The diff is exactly what the spec's Edit 1 to 3 describe.

**Invariants and parity:** No parity row is touched (docs only). The medians were checked against the four time files: builder before 9935/10110/10064 gives 10,064 and after 12642/11745/11644 gives 11,745 (+1,681); reviewer before 11803/13737/13626 gives 13,626 and after 10827/18718/14384 gives 14,384 (+758); spread 18718-10827 = 7,891. All runs exit 0. The Phase 161 and 162 entries, the T832 ledger cell and the T832 review are untouched (refactor-log numstat `11 0`). Line endings are kept: all three docs are `w/crlf` with 0 bare LF. Em dashes: 0 in the added lines and 0 in every touched file. Stale-text check: the new entry and the ledger row state counts and paths that match the gate output.

**Gates run** (docs-only tier, so no lint, unit or Playwright; log `workflow/stages/03_review/output/logs/T835-gates.log`):
- G1: `new 1 old 0`, exit 0.
- G2: four `:2` lines in the specified order, then `7891 758 1681`.
- G3: `grep -c 758` on the refactor log prints 2; `delta +1681ms` has one hit each in the refactor log and the ledger.
- G4: added-lines em dash count 0. Whole files: 0 each for baseline-metrics, refactor-log, task-ledger and the build report. Line endings: `git ls-files --eol` shows `i/lf w/crlf` for all three, bare LF 0 each.
- G5: `true true true true`, exit 0.
- G6: numstat `1 1 baseline-metrics.md` and `11 0 refactor-log.md`; `git diff --stat` lists the three docs; `git status --porcelain` adds only the untracked T835 spec and build report; `workflow/stages/02_build/CONTEXT.md` is unmodified.

**Not verified:** The `T835-edit3.log` and `T835-edit.log` builder logs are gitignored, and I did not rerun the Edit 3 script. G5 proves the same result on the final file.

**Blocking:** none.

**Non-blocking:**
- The build report's G2 line lists only the file counts. It would be clearer with the builder-run line `7891 758 1681`, but the report has it under Deltas, so no change is needed.

**Rule candidates:** none.
