# T782 spec: add two Backlog rows from the blind Opus review of T781

Phase 140 (branch `phase-140-gemini-trial`). Docs-only task.

## 1. Goal

Add two Backlog rows to `docs/audit/task-ledger.md` from the blind Opus review of T781: (1) rounding `data.amount` once at the entry of `addTransaction` before `TransactionSchema.safeParse` and the ADR 0016 overpayment guard (`src/context/FinanceContext.tsx:1675` and `:1749`), and (2) rounding with `roundToCents` before the zero/negative check in CSV import (`src/utils/csvExchange.ts:184-196` and `:209`). Make no code changes.

## 2. Target files

- `docs/audit/task-ledger.md`

No ADR, no `docs/audit/refactor-log.md` edit, and no `docs/audit/baseline-metrics.md` edit.

## 3. Context to read

none (docs-only task).

## 4. Current behaviour

- `docs/audit/task-ledger.md:48-55`: the `## Phase 140 - Gemini trial (no ADR)` table currently ends at row `T781` (`docs/audit/task-ledger.md:54`).
- `docs/audit/task-ledger.md:56-91`: the `## Backlog` table currently ends at line 90 (`addTransaction assigns unrounded amount on guest transaction record`, marked `done in Phase 140 (T781)`).
- `src/context/FinanceContext.tsx:1675` and `:1749`: `addTransaction` validates `data` with `TransactionSchema.safeParse(data)` at `:1675` (`src/utils/zodSchemas.ts:25-45`, which checks `data.amount === 0` for `ADJUSTMENT` and `!(data.amount > 0)` for other types) and runs the ADR 0016 overpayment guard (`if (data.amount > targetDebt.remainingAmount)`) at `:1749` against the unrounded `data.amount`. Rounding happens only later at the optimistic balance updates (`:1777`, `:1779`, `:1784`, `:1813`) and at the guest transaction construction (`:1943`). Consequently, in guest mode an `EXPENSE` of `0.004` passes `safeParse` and stores a `0.00` row, and a `DEBT_REPAYMENT` of `100.004` against `100.00` remaining is rejected; in SQL, `record_transaction` (`supabase/migrations/20260928_phase52_security_ledger.sql:221-229` and `:292`) rounds first (`v_amount := round(p_amount, 2)`) and then checks `v_amount`.
- `src/utils/csvExchange.ts:184-196` and `:209`: `parseAndValidateCSV` parses `const numAmount = parseFloat(rawAmount)` at `:184`, checks `numAmount === 0` (`:188`) and `numAmount <= 0` (`:189`) before rounding, and rounds with an inline `Math.round(numAmount * 100) / 100` copy at `:196`, `:209`, and `:223` instead of `roundToCents` (`src/utils/money.ts:22`). A CSV row with `0.004` passes `numAmount <= 0`, becomes `amount: 0` at `:209`, and when committed by a signed-in user via `commitBulkImport` (`src/context/FinanceContext.tsx:2528`), causes `import_transactions` (`supabase/migrations/20260928_phase52_security_ledger.sql:404` and `:417-421`) to reject the whole batch.

## 5. Parity map

none (docs-only change to `docs/audit/task-ledger.md`).

## 6. Tests to add

none. This task only appends rows to `docs/audit/task-ledger.md` and cannot alter application behaviour. Stage 02 step 4 and stage 03 step 6 do not apply.

### Exact edits to `docs/audit/task-ledger.md`

1. **Phase 140 task table (`docs/audit/task-ledger.md:54`)**: immediately after the `T781` row, add the `T782` row (flipping `Status` to `in-progress` when starting and `done` when gates pass, with `Commit` left empty):

```markdown
| T782 | Add two Backlog rows from the blind Opus review of T781 (addTransaction entry rounding and CSV import roundToCents check) | `docs/audit/task-ledger.md` | done | | <gate summary> |
```

2. **Backlog table (`docs/audit/task-ledger.md:90`)**: immediately after the SL-03 row (`| addTransaction assigns unrounded amount on guest transaction record | Audit 2026-10-16 (T759), finding SL-03, low; \`src/context/FinanceContext.tsx:1943\` | done in Phase 140 (T781) |`), append these exact two rows:

```markdown
| Guest `addTransaction` runs its Zod amount check and the ADR 0016 overpayment guard on the raw amount before rounding (`src/context/FinanceContext.tsx:1675` and `:1749`), so a guest `EXPENSE` of `0.004` stores a `0.00` row and a `DEBT_REPAYMENT` of `100.004` against `100.00` remaining is rejected; SQL rounds first, then checks. Fix: round once at the entry of `addTransaction`, before `safeParse` | Phase 140, blind Opus review of T781; `src/context/FinanceContext.tsx:1675`, `:1749` | todo |
| CSV import checks `numAmount <= 0` before rounding (`src/utils/csvExchange.ts:184-196`) and uses an inline `Math.round` copy, so `0.004` becomes a `0.00` row that fails the whole `import_transactions` batch for a signed-in user. Fix: check the rounded value and use `roundToCents` | Phase 140, blind Opus review of T781; `src/utils/csvExchange.ts:184-196`, `:209` | todo |
```

Change no other lines in `docs/audit/task-ledger.md`.

## 7. Gates

Docs-only tier (`AGENTS.md`): no unit or Playwright suite is required, but because the new rows state file paths and line numbers, verify those paths and lines against the code, verify the diff and line count, check CRLF line endings, and verify 0 em dashes:

```powershell
node -e "const fs=require('fs');const fc=fs.readFileSync('src/context/FinanceContext.tsx','utf8').split(/\r?\n/);console.log('1675:',fc[1674].trim());console.log('1749:',fc[1748].trim());const csv=fs.readFileSync('src/utils/csvExchange.ts','utf8').split(/\r?\n/);console.log('184-196:',csv.slice(183,196).map((l,i)=>(184+i)+':'+l.trim()).join(' | '));console.log('209:',csv[208].trim());"
git diff -U0 HEAD -- docs/audit/task-ledger.md
git ls-files --eol docs/audit/task-ledger.md
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
git status --porcelain
```

Expect:
- The first Node check confirms `src/context/FinanceContext.tsx:1675` (`const validation = TransactionSchema.safeParse(data);`), `src/context/FinanceContext.tsx:1749` (`if (data.amount > targetDebt.remainingAmount) {`), `src/utils/csvExchange.ts:184-196` (`const numAmount = parseFloat(rawAmount);` through `totalAmount += Math.round(numAmount * 100) / 100;`), and `src/utils/csvExchange.ts:209` (`amount: isNaN(numAmount) ? 0 : Math.round(numAmount * 100) / 100,`).
- `git diff -U0 HEAD -- docs/audit/task-ledger.md` shows exactly 3 added lines and 0 deleted lines (the `T782` row and the 2 Backlog rows).
- `git ls-files --eol docs/audit/task-ledger.md` reports `w/crlf`.
- The Node em-dash check prints `0`.
- `git status --porcelain` shows only `docs/audit/task-ledger.md` and `workflow/stages/*/output/` files.

## 8. Production touch points

none.

## 9. Out of scope

- Any code or test file, including `src/context/FinanceContext.tsx`, `src/utils/csvExchange.ts`, `src/utils/zodSchemas.ts`, `src/utils/money.ts`, `unit/ledger-guards.test.tsx`, and `unit/csv-exchange.test.ts`.
- Any existing Phase 136 to 140 row or existing Backlog row in `docs/audit/task-ledger.md`.
- `docs/audit/refactor-log.md` and `docs/audit/baseline-metrics.md`.
