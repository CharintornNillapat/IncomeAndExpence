# T760 review

## Round 1

### Metadata

- **Task:** T760, a transfer with an unknown outcome re-reads the cloud (SL-02). Phase 132, branch `phase-132-transfer-unknown-outcome`.
- **Date:** 2026-10-17
- **Round:** 1
- **Verdict:** APPROVED
- **Target files:** `unit/authenticated-ledger.test.tsx`, `src/context/FinanceContext.tsx`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md` (plus bookkeeping: `docs/audit/task-ledger.md`, the build report). `git check-ignore -v` on all five tracked targets: none ignored (exit 1).

### Summary

`addTransaction`'s TRANSFER branch now sets `rpcOutcomeUnknown = true` on an error with no SQLSTATE and on a success with no row (`src/context/FinanceContext.tsx:1848-1859`), so its `catch` rolls back and then calls `refreshFromCloud()` (`:1983-1985`), exactly as the `record_transaction` branch does. Three tests in the transfer block pin it: a lost response and an empty payload both re-read inside the call, and a coded refusal (42501) only rolls back. The ledger, refactor log and metrics carry the phase paperwork, including the owner's new Backlog row for `setTransactionDeleted`.

### Invariants and parity

- **Diff matches spec section 7 line for line:** the replacement block is the spec's text, 10-space indent, CRLF kept. Nothing else in `FinanceContext.tsx` changed (`git diff --stat`: 8 insertions, 2 deletions).
- **Full `addTransaction` re-read (`:1695-2010`):**
  - `isMissingRpcError` needs a code (`42883`/`PGRST202`) and `isUnknownOutcomeError` needs none, so the two branches cannot both fire. The missing-function path still returns `databaseUpdateNeeded()` with no re-read, as before.
  - The T69 branch (`:1965`) still re-reads on a concurrent reload, whatever the flag.
  - The `finally` still releases the key. After the re-read the committed row carries `clientKey`, so a retry from the same form takes the `existingTx` replay (`:1708-1711`) and sends no second RPC.
- **Parity row 1 (`addTransaction` arithmetic vs `_ledger_apply_effect`):** untouched. The optimistic arithmetic (`:1775-1797`) and the adopt-balances block are unchanged. **Transfer preview row:** untouched. No other parity row applies.
- **ADR 0023 rule (`docs/contexts/supabase-ledger.md:18`):** an error with no SQLSTATE, or a success payload with no row, now rolls back then re-reads for every ledger RPC in `FinanceContext.tsx`. The spec's call-site table (section 4) still holds against the code.
- **Tests use the harness as it is:** `lostResponses`, `failures` and `rpcs` are unchanged; no `act()`; `reads()` copies the `update_transaction` block's counter (`:1265`).
- **Ledger:** the Phase 132 section is in the template's shape and the Commit cell is empty. SL-02 is `done in Phase 132 (T760)`. The new Backlog row is byte-identical to spec section 9 and is the last row.
- **Refactor log:** `code <sha>, merged <sha>` placeholders follow the Phase 129 entry as committed in `613b26c`; the deploy record fills them. `Surprises` and `Deliberately not done` are present.
- **Line endings:** `git ls-files --eol` shows `w/crlf` for all five tracked files.

### Gates run

| # | Command | Result | Log |
|---|---|---|---|
| 1 | Stash check: `git stash push -- src/context/FinanceContext.tsx`; `npx vitest run unit/authenticated-ledger.test.tsx -t "transfer_funds"`; `git stash pop` | 4 run, 2 failed, 2 passed, 118 skipped. Test A and Test B both fail on `expect(reads()).toBeGreaterThan(readsBefore)` (`expected 0 to be greater than 0`); Test C and the existing transfer test pass. `git status --porcelain` identical before and after (diffed) | `workflow/stages/03_review/output/logs/T760-red.log` |
| 2 | `npm run lint` | exit 0: node-globals 132 files clean, safe-ids 132 files clean, both `tsc` clean | n/a |
| 3 | `npx vitest run unit/authenticated-ledger.test.tsx unit/ledger-guards.test.tsx` | 2 files, 171 passed, 0 failed, 0 skipped (92.4 s) | n/a |
| 4 | `npm run test:unit` | 62 files, 1378 tests, 1378 passed, 0 failed, 0 skipped (49.9 s) | `workflow/stages/03_review/output/logs/T760-unit.log` |
| 5 | `Get-NetTCPConnection -LocalPort 3000,3100 -State Listen` | no listeners | n/a |
| 6 | `npx playwright test tests/transfer-preview.spec.ts tests/wallet-forms.spec.ts --project=chromium` | 11 passed, 0 failed (30.2 s) | `workflow/stages/03_review/output/logs/T760-e2e-chromium.log` |
| 7 | `npx playwright test tests/transfer-preview.spec.ts tests/wallet-forms.spec.ts` | 33 passed, 0 failed, Chromium, Firefox, WebKit (1.2 m) | `workflow/stages/03_review/output/logs/T760-e2e.log` |
| 8 | `npm run clean; npm run build` with `.env` present, then gzip level 9 | exit 0. `index-C7LsbYem.js` 191,696 / 55,810; all app JS 878,229 / 266,912, 40 files; `index-CqllkKUj.css` 52,759 / 10,159. All match `baseline-metrics.md` | n/a |
| 9 | Static: `git diff --stat`, `git status --porcelain`, `grep -c 'rpcOutcomeUnknown = true'`, em dash count | 5 tracked files changed (4 targets + ledger); untracked are only the T760 spec and build report; 6 flag sets in the file (was 4); 0 em dashes in added lines | n/a |

### Not verified

- **Real supabase-js lost-response shape:** the harness stands in for it with `{ code: '' }` (`unit/authenticated-ledger.test.tsx:226-230`), the same stand-in the other unknown-outcome tests use. No live call was made (stop-and-ask).
- **Signed-in transfer in a browser:** no Playwright spec signs in (AGENTS.md forbids real credentials). The two specs cover the guest transfer path through the same `addTransaction`; the changed lines run only signed in and are covered by Tests A to C.

### Blocking

None.

### Non-blocking

- `unit/authenticated-ledger.test.tsx:23-24` hold 2 em dashes in the file's header comment. They are on `main` already, are not user-facing, and are outside this task's allowlisted change, so I left them. A later docs or comments task could swap them for commas.
- After an unknown outcome the user still sees the raw `TypeError: Failed to fetch` as the error, though the re-read may show the transfer as done. `record_transaction` behaves the same; a clearer message would be its own UI task.

### Rule candidates

- Stage 03 step 7 ("zero em dashes in every touched file") reads stricter than AGENTS.md ("No em dash in user-facing text") and stage 02's added-lines check. It should say whether it means added lines or whole files, so a pre-existing comment never becomes a blocker outside the spec's scope.
