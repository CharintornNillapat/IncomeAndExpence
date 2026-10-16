# T752 review

## Round 1

### Metadata

- **Task:** T752, Phase 126 (`phase-126-icm-tuneup`)
- **Date:** 2026-10-16
- **Round:** 1
- **Verdict:** APPROVED
- **Target files:** `src/components/transaction/txTypeMeta.ts`, `src/components/ui/Card.tsx`, `src/components/ui/OverflowMenu.tsx`, `tests/categories.spec.ts`, `docs/audit/refactor-log.md`; bookkeeping `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/build-report.md`
- **Ignored targets:** none (`git check-ignore -v` on every target returned nothing, rc 1)

### Summary

Five comments that pointed into `docs/audit/archive/` now cite ADR 0006, ADR 0039 and `docs/contexts/ui-and-e2e.md`, and the stale framer-motion clause in `Card.tsx` is gone. Each block matches the spec's section 7 text exactly. The Phase 126 refactor-log entry and the ledger (T752 row, heading, Backlog row) are updated as section 7 edit 6 and section 9a asked.

### Invariants and parity

- **Parity map:** no row applies (comments only).
- **Comments only:** every changed `+`/`-` line in the four code files starts with ` *`; the spec's filter printed nothing. The full JSDoc blocks around each hunk were read; no code, import or whitespace outside them changed. `git diff --check` clean; `--ignore-cr-at-eol` numstat matches the plain stat (no line-ending churn).
- **Faithful to the cited docs:** `Card.tsx` cites ADR 0006 only for the closed padding enum, as ADR 0006's Consequences say; `categories.spec.ts` says the fix moved to the server "in place of" Phase 30's guard, matching ADR 0039's "no longer guards inserts" and `FinanceContext.tsx:766-769`; `OverflowMenu.tsx` cites `ui-and-e2e.md:39`, which states the rule.
- **Scope:** `git status --porcelain` shows the six listed files, the spec, and the build report. Nothing unannounced.

### Gates run

| Command | Result |
|---|---|
| `npm run lint` | rc 0; node-globals 132 files, safe-ids 132 files, both `tsc` runs clean. Log: `workflow/stages/03_review/output/logs/T752-lint.log` |
| comments-only `git diff -U0 ... \| grep` filter | 0 lines |
| archived-pointer grep on the four code files | 0 matches |
| `ls` of ADR 0006, 0039, 0082 and `docs/contexts/ui-and-e2e.md` | all 4 resolve |
| `seed_starter_account` grep | `20261002_phase64_seed_starter_account.sql:31` |
| `isSeedingRef` grep | 4 matches in `FinanceContext.tsx` |
| em-dash count (6 touched files and the build report) | 0 in each |

No Vitest or Playwright run: the spec's tests are `none` and only the comments-only and docs rows apply.

### Not verified

- Step 6 (failing-test check) does not apply: the spec's tests are `none`.

### Blocking

None.

### Non-blocking

- The ledger's Phase 126 line still reads "One docs commit." The spec left it to the orchestrator; if T752 goes in as a second commit, the deploy record can correct it.
- The refactor-log `Verified` addition repeats "zero em dashes" and "`npm run lint` clean" from the T751 half of the same line. Harmless.

### Rule candidates

None.
