# Spec: T779

Phase 140, branch `phase-140-gemini-trial`. Docs-only task.

## 1. Goal

Fix the wording at `docs/audit/refactor-log.md:24` in the Phase 139 entry, which calls the T776 change "a redundant guard" when it was the CS-01 bug fix (removing a guard that overrode an explicit `includeDeleted: true`).

## 2. Target files

```
docs/audit/refactor-log.md
```

Bookkeeping, always allowed: `docs/audit/task-ledger.md` (add the Phase 140 section and T779 row). No ADR and no `baseline-metrics.md` edit.

## 3. Context to read

none (docs-only task).

## 4. Current behaviour

- `docs/audit/refactor-log.md:24`: the Phase 139 brief currently reads:
  `No ADR (T777 applies the T69 rule ADR 0033 already records to a sibling write; T776 removes a redundant guard). Phase 139 is the first phase run with the \`fin-reviewer\` and \`fin-reviewer-strict\` sub-agents from Phase 138 (ADR 0101 amendment).`
- As recorded in `docs/audit/refactor-log.md:26`, `docs/audit/task-ledger.md:44` and `:80`, and `src/hooks/useTransactions.ts:67`, T776 was the CS-01 bug fix: it removed the `if (includeDeleted && !showSoftDeleted && tx.isDeleted) return false;` guard that overrode an explicit `includeDeleted: true` whenever `showSoftDeleted` was false, not a redundant guard.
- `docs/audit/task-ledger.md:38-46`: the ledger ends its phase tables at Phase 139 (`T776` to `T778`), right above `## Backlog` at `docs/audit/task-ledger.md:48`.

## 5. Parity map

none.

## 6. Tests to add

none. This is a docs-only wording fix in `docs/audit/refactor-log.md` and cannot alter application behaviour. Stage 02 step 4 and stage 03 step 6 do not apply.

### Exact edits

1. **`docs/audit/refactor-log.md:24`**: replace the line:
   ```markdown
   No ADR (T777 applies the T69 rule ADR 0033 already records to a sibling write; T776 removes a redundant guard). Phase 139 is the first phase run with the `fin-reviewer` and `fin-reviewer-strict` sub-agents from Phase 138 (ADR 0101 amendment).
   ```
   with:
   ```markdown
   No ADR (T777 applies the T69 rule ADR 0033 already records to a sibling write; T776 is the CS-01 bug fix, removing a guard that overrode an explicit `includeDeleted: true`). Phase 139 is the first phase run with the `fin-reviewer` and `fin-reviewer-strict` sub-agents from Phase 138 (ADR 0101 amendment).
   ```
   Change no other line in `docs/audit/refactor-log.md`.

2. **`docs/audit/task-ledger.md`**: above `## Backlog` (`docs/audit/task-ledger.md:48`), add the Phase 140 section and the `T779` row (flipping `Status` to `in-progress` when starting and `done` when gates pass, with `Commit` left empty):
   ```markdown
   ## Phase 140 - Gemini trial (no ADR)

   | # | Task | Files | Status | Commit | Gate result |
   |---|---|---|---|---|---|
   | T779 | Fix Phase 139 refactor-log wording for T776 (CS-01 bug fix, not a redundant guard) | `docs/audit/refactor-log.md` | done | | <gate summary> |
   ```

## 7. Gates

Docs-only tier (`AGENTS.md`): no unit or Playwright suite is required because no code or test count changes. Run these verification commands:

```powershell
git diff -U0 HEAD -- docs/audit/refactor-log.md
git ls-files --eol docs/audit/refactor-log.md docs/audit/task-ledger.md
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
git status --porcelain
```

Expect:
- `git diff -U0 HEAD -- docs/audit/refactor-log.md` shows exactly 1 line removed and 1 line added at line 24, matching the replacement block in section 6.
- Both `docs/audit/refactor-log.md` and `docs/audit/task-ledger.md` report `w/crlf` in `git ls-files --eol`.
- The Node em-dash check prints `0`.
- `git status --porcelain` lists only `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`, and untracked/modified files under `workflow/stages/*/output/`.

## 8. Production touch points

none.

## 9. Out of scope

- Any other line in `docs/audit/refactor-log.md` (including the Phase 139 heading, `Changed`, `Verified`, `Surprises`, and `Deliberately not done` paragraphs).
- Any Phase 139 row or Backlog row in `docs/audit/task-ledger.md`.
- Any code, test, config, or stage file.
