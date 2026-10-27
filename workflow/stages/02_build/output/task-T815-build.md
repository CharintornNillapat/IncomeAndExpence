# Build Report - T815

## 1. Summary of Changes

Closed Phase 149 (Transactions redesign: Table and Calendar views, ADR 0109) on paper:

- **Counts in Authoritative Docs (`AGENTS.md`, `README.md`, `docs/contexts/ui-and-e2e.md`):** Updated Vitest count to 1598 tests in 72 files and Playwright count to 213 tests in 37 specs, 639 runs across three browsers (633 passed, 6 skipped by design).
- **ADR 0109 (`docs/audit/decisions/0109-transactions-table-and-calendar-views.md`):** Updated Status with Phase 149 implementation commit range (`a2634f1` to `9caee5e`), added Implementation section listing T809 to T815, added Verification section with recorded unit and E2E metrics, updated line 74 Consequence to reflect T814 rewriting `DESIGN.md`'s Transactions section, and added Release section detailing pending owner actions on live Supabase before merge. Kept LF line endings.
- **Baseline Metrics (`docs/audit/baseline-metrics.md`):** Added Phase 149 section with exact bundle measurements (`index-achQGTXo.js` 198,233 B / 57,974 B gzip; all app JS 910,934 B / 275,852 B gzip in 39 files; CSS `index-BNwLrid8.css` 54,969 B / 10,720 B gzip), Vitest results (1598 passed in 60.32 s), and Playwright results (633 passed, 6 skipped, 0 failed in 12.0 min).
- **Refactor Log (`docs/audit/refactor-log.md`):** Added Phase 149 entry documenting Changed files across T809-T815, Verified gate strings copied verbatim from the ledger, Surprises (a through f), and Deliberately not done items (pending live migration apply, owner deploy checks, code review notes left as non-blocking, out-of-scope features, and audit file archiving).
- **Task Ledger (`docs/audit/task-ledger.md`):** Filled Commit hashes for T809 (`a2634f1`), T810 (`ec9fa58`), T811 (`4e88626`), T812 (`48e6750`), T813 (`83d5c54`), and T814 (`9caee5e`). Added row T815 and marked as `done` with gate results.

## 2. Files Changed (7 files)

1. `AGENTS.md` (modified)
2. `README.md` (modified)
3. `docs/contexts/ui-and-e2e.md` (modified)
4. `docs/audit/decisions/0109-transactions-table-and-calendar-views.md` (modified)
5. `docs/audit/refactor-log.md` (modified)
6. `docs/audit/baseline-metrics.md` (modified)
7. `docs/audit/task-ledger.md` (modified)

## 3. Tests Added and Fail-then-Pass Evidence

None. The task is docs only and alters no runtime behaviour; stage 02 step 4 does not apply per spec section 6.

## 4. Verification Gates Run

### Pre-Edit Gates (Measurements)

- **Gate 1: Full Unit Suite**
  - Command: `npm run test:unit`
  - Log: `workflow/stages/02_build/output/logs/T815-unit.log`
  - Result: 72 files, 1598 passed (60.32 s).

- **Gate 2: Playwright Test List**
  - Command: `npx playwright test --list` / `npx playwright test --list --project=chromium`
  - Result: `Total: 639 tests in 37 files` / `Total: 213 tests in 37 files`.

- **Gate 3: Production Build and Asset Metrics**
  - Command: `npm run build`
  - Measurements:
    - `index-achQGTXo.js`: 198,233 B raw, 57,974 B gzip
    - `index-BNwLrid8.css`: 54,969 B raw, 10,720 B gzip
    - `TransactionsView-FspLBvoz.js`: 55,405 B raw, 16,616 B gzip
    - `allJS`: 910,934 B raw, 275,852 B gzip across 39 files

- **Gate 4: Stale Server Check**
  - Command: `netstat -ano | findstr "LISTENING" | findstr ":3000 :3100"`
  - Result: Clean (exit 1, no stale servers).

- **Gate 5: Full Playwright Suite (3 Projects)**
  - Command: `npx playwright test`
  - Log: `workflow/stages/02_build/output/logs/T815-e2e.log`
  - Result: 633 passed, 6 skipped, 0 failed across Chromium, Firefox, WebKit (12.0 min).

### Post-Edit Gates

- **Gate 6: Stale Counts Grep**
  - Command: `git grep -n -E "1510 tests|69 files|187 tests|561 runs|555 pass|36 spec|Not implemented yet|phase's last task" -- AGENTS.md README.md docs/contexts/ docs/audit/decisions/0109-transactions-table-and-calendar-views.md`
  - Result: Clean (exit 1, 0 matches).

- **Gate 7: Line Counts**
  - Results:
    - `docs/audit/task-ledger.md`: 206 lines (`<L> = 206`)
    - `docs/audit/refactor-log.md`: 172 lines (`<R> = 172`)
    - `docs/audit/baseline-metrics.md`: 203 lines (`<B> = 203`)

- **Gate 8: Line Endings Check (Node)**
  - `AGENTS.md`: crlf 135, bareLF 0
  - `README.md`: crlf 179, bareLF 0
  - `docs/contexts/ui-and-e2e.md`: crlf 79, bareLF 0
  - `docs/audit/decisions/0109-transactions-table-and-calendar-views.md`: crlf 0, bareLF 109
  - `docs/audit/refactor-log.md`: crlf 172, bareLF 0
  - `docs/audit/baseline-metrics.md`: crlf 203, bareLF 0
  - `docs/audit/task-ledger.md`: crlf 206, bareLF 0

- **Gate 9: Git EOL Check**
  - Command: `git ls-files --eol`
  - Result: `w/crlf` for the six CRLF files, `w/lf` for ADR 0109.

- **Gate 10: Phase 149 Commit Hashes**
  - Verified: `a2634f1` (T809), `ec9fa58` (T810), `4e88626` (T811), `48e6750` (T812), `83d5c54` (T813), `9caee5e` (T814).

- **Gate 11: Placeholder Check**
  - Result: 0 remaining `<gate cell` or `<U>|<P>|<S>|<M>|<L>|<R>|<B>` placeholders.

- **Gate 12 & 13: Zero Em Dashes**
  - Result: 0 em dashes in `git diff -U0 HEAD`, 0 em dashes in spec and this build report.

- **Gate 14: Diff Stat and Status**
  - `git diff --stat`: 7 files changed, 61 insertions, 12 deletions.
  - `git status --porcelain`: Only target files, `task-ledger.md`, and workflow outputs. No code, test, config or SQL files touched.

## 5. Deliberately Not Done

- The pending live step: owner applies migration `supabase/migrations/20261027_phase149_set_transactions_deleted.sql`, runs printed history row, and verifies `npm run schema:drift` before merging.
- T815's own commit hash and the deploy record fields (`docs <sha>`, `merged <sha>`, and `Measured at` line) stay placeholder/omitted for the post-merge deploy record on `main`.
