# Build report: T759

Phase 131: Whole-app read-only audit (commit `cb9e109`) by four read-only domain sub-agents. High and medium findings added to the task ledger's Backlog. No code changed.

## Files changed (4 files + build report & validation script)

1. `docs/audit/audit-2026-10-16.md`:
   - Whole-app audit report containing 16 findings (2 high, 7 medium, 7 low) across Client State (`CS`), Supabase and the Ledger (`SL`), API Proxies (`AP`), and UI & E2E (`UI`).
   - Summary table, Needs a live check section, Checked no finding bullets, and Dropped in review section.
2. `docs/audit/README.md`:
   - Added `audit-2026-10-16.md` row to the Live files table after `test-selector-contract.md`.
3. `docs/audit/refactor-log.md`:
   - Added Phase 131 entry above Phase 130 entry with finding counts, gate results, surprises (none), and deliberately not done items.
4. `docs/audit/task-ledger.md`:
   - Added Phase 131 section before Backlog with T759 marked `done`.
   - Appended 9 Backlog rows for all high and medium findings in report order (CS-01, SL-01, SL-02, SL-03, UI-01, UI-02, UI-03, UI-04, UI-05).
5. `workflow/stages/02_build/output/logs/T759-check.mjs`:
   - Saved Gate G2 citation, structure, and Backlog rows validation script.

## Tests added

- None (per spec section 6: docs-only task; changes documentation only and cannot alter behaviour; stage 02 step 4 does not apply).

## Gate commands and results

1. Gate G1 (scope):
   - Command: `git status --porcelain; git diff --stat main`
   - Result: Only target files (`docs/audit/audit-2026-10-16.md`, `docs/audit/README.md`, `docs/audit/refactor-log.md`), bookkeeping (`docs/audit/task-ledger.md`, `workflow/stages/02_build/output/*`), and untracked spec (`workflow/stages/01_spec/output/task-T759-spec.md`) changed. Exit 0.

2. Gate G2 (citations, structure and Backlog rows):
   - Command: `node workflow/stages/02_build/output/logs/T759-check.mjs docs/audit/audit-2026-10-16.md docs/audit/task-ledger.md`
   - Result:
     `{ cites: 67, bad: 0, findings: 16, high: 2, medium: 7, low: 7, grouped: false, ledgerRows: 9, dup: [], noField: [], noCite: [], missingRows: [], extraRows: 0, badShape: false }`
     Exit 0.

3. Gate G3 (counts):
   - Summary table counts match G2 output:
     CS: 0 high, 1 medium, 2 low (3 total)
     SL: 2 high, 1 medium, 0 low (3 total)
     AP: 0 high, 0 medium, 2 low (2 total)
     UI: 0 high, 5 medium, 3 low (8 total)
     Total: 2 high, 7 medium, 7 low (16 total).
   - Refactor log counts match: 16 findings in total, 2 high, 7 medium, 7 low across four domains.

4. Gate G4 (skip list):
   - Checked finding titles against open Backlog rows, done Backlog rows, and accepted Supabase advisors / intended designs. Zero repeated items.

5. Gate G5 (em dashes):
   - Command: `node -e "for (const f of process.argv.slice(1)) console.log(f, (require('fs').readFileSync(f, 'utf8').split(String.fromCharCode(8212)).length - 1))" docs/audit/audit-2026-10-16.md docs/audit/README.md docs/audit/refactor-log.md docs/audit/task-ledger.md workflow/stages/02_build/output/task-T759-build.md`
   - Result: All files show 0 em dashes.

6. Gate G6 (line endings):
   - Command: `git ls-files --eol docs/audit/README.md docs/audit/refactor-log.md docs/audit/task-ledger.md`
   - Result: All show `w/crlf`.
   - Command: `node -e "const t = require('fs').readFileSync(process.argv[1], 'utf8'); const crlf = (t.match(/\r\n/g) || []).length; const lf = (t.match(/\n/g) || []).length - crlf; console.log({ crlf, bareLf: lf })" docs/audit/audit-2026-10-16.md`
   - Result: `{ crlf: 0, bareLf: 288 }` (uniform line endings).

7. Gate G7 (no code changed):
   - Command: `git diff --stat main -- src unit tests api supabase scripts index.html vercel.json package.json package-lock.json .github`
   - Result: Empty output. No code files changed.

## Not done

- No code fixes applied (all 16 findings recorded for future implementation phases).
- No live checks against production Supabase or Vercel firewall executed (left for owner).
- Low findings (7 items) not added to the Backlog per spec.

## Fix round 1

Applied all 11 blocking items from `workflow/stages/03_review/output/task-T759-review.md` (Round 1):

1. **CS-01:** Downgraded from medium to `[low]`, set **Rule:** to `none`, and updated **Impact:** to note latency (no caller passes `includeDeleted` today).
2. **SL-01:** Downgraded from high to `[medium]`, updated **Impact:** to note that balance updates roll back with the exception block so money never moves twice, and the defect is a refused retry returning a 23505 error.
3. **SL-02:** Kept `[high]`, updated **Impact:** to clarify stale balances persist until next cloud reload and re-entering in a new form moves money twice.
4. **SL-03:** Downgraded from medium to `[low]`, set **Rule:** to `none`, and appended note to **Impact:** on latency (UI amounts pre-rounded by `evaluateAmountInput`).
5. **UI-01:** Downgraded from medium to `[low]`, updated **Impact:** to note that the frame is a non-focusable `div`.
6. **UI-02 to UI-05:** Set **Rule:** to `none` on all four accessible name / label findings.
7. **Summary table:** Updated counts to CS 0/0/3, SL 1/1/1, AP 0/0/2, UI 0/4/4, Total 1/5/10.
8. **Report sections:** Preserved `## Dropped in review` as `None.` and added `## Changed in review` detailing the six adjustments.
9. **Backlog rows (`docs/audit/task-ledger.md`):** Removed CS-01, SL-03, and UI-01 rows. Updated SL-01 severity to `medium`. Kept exactly 6 rows ordered as SL-02 (high), SL-01 (medium), UI-02, UI-03, UI-04, UI-05.
10. **Refactor log (`docs/audit/refactor-log.md`):** Updated Phase 131 entry with 16 findings (1 high, 5 medium, 10 low), 6 Backlog rows, updated G3 counts, 10 low findings, and added note to **Surprises:** regarding the review adjustments.
11. **Gate verification:** Reran all gates G1 to G7.
    - Gate G1 (scope): Clean (only target docs, task ledger, and build output modified).
    - Gate G2 (citations, structure, Backlog rows):
      `{ cites: 69, bad: 0, findings: 16, high: 1, medium: 5, low: 10, grouped: false, ledgerRows: 6, dup: [], noField: [], noCite: [], missingRows: [], extraRows: 0, badShape: false }`, exit 0.
    - Gate G3 (counts): Summary table (CS: 0/0/3, SL: 1/1/1, AP: 0/0/2, UI: 0/4/4; total 1/5/10) matches G2 output and refactor-log entry.
    - Gate G4 (skip list): Clean.
    - Gate G5 (em dashes): 0 across all 5 files.
    - Gate G6 (line endings): Existing files `w/crlf`; report `{ crlf: 0, bareLf: 297 }`.
    - Gate G7 (no code changed): Empty diff against main on code and config paths.

All blocking items from earlier rounds (Round 1) hold as fixed.
