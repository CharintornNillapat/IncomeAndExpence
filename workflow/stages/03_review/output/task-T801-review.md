# Review: T801

## Round 2

### 1. Metadata

- Task: T801, one cloud load per signed-in user (ADR 0105)
- Date: 2026-10-24
- Round: 2 (after the builder's `## Fix round 1`)
- Verdict: APPROVED
- Target files: `docs/audit/decisions/0105-one-cloud-load-per-session.md`, `src/context/FinanceContext.tsx`, `unit/authenticated-ledger.test.tsx`, `docs/contexts/supabase-ledger.md` (+ bookkeeping `docs/audit/task-ledger.md`). None git-ignored (checked in round 1, same paths).

### 2. Summary

The fix round touched only prose and spacing. The `isSeedingRef` comment and the context bullet now match the spec's text exactly, and a blank line now sits before the new describe. No code line changed since round 1.

### 3. Invariants and parity

- Round 1 blocking item 1: `FinanceContext.tsx:765-774` is byte-identical to spec section 7 item 7 (compared by `diff` after trimming indent and CR). Resolved.
- Round 1 blocking item 2: `supabase-ledger.md:62` is byte-identical to spec section 9's bullet; the heading `:55` reads `[0024, 0072, 0087, 0099, 0105]`. Resolved.
- Code lines in the `FinanceContext.tsx` diff (every non-comment `+`/`-` line) are the same set reviewed in round 1: the `AuthUser` type import, `loadedUserIdRef`, its reset in `resetToGuestState`, `adoptSession` and its two call sites. Spec section 7 holds.
- Parity map: no row touched (unchanged from round 1).
- Line endings: all five files CRLF only, 0 bare LF (counted with Node).
- Em dashes: 0 in added lines of `git diff -U0 HEAD`; 0 in the ADR, the context file, the ledger and FinanceContext.
- Scope: `git status --porcelain` and `git diff --stat` show only the 4 targets, the ledger and the stage 01/02/03 outputs. No unannounced file.

### 4. Gates run

| Command | Result | Log |
|---|---|---|
| `npm run lint` | exit 0: node-globals and safe-ids 133 files clean, both `tsc` clean | `workflow/stages/03_review/output/logs/T801-r2-lint.log` |
| `npx vitest run unit/authenticated-ledger.test.tsx` | 1 file passed, 145 tests passed, 0 failed, 0 skipped (49.46s) | `workflow/stages/03_review/output/logs/T801-r2-targeted.log` |
| `npm run test:unit` | 68 files passed, 1506 tests passed, 0 failed, 0 skipped (53.05s) | `workflow/stages/03_review/output/logs/T801-r2-unit.log` |

### 5. Not verified

- Playwright and the stash red run were not rerun this round: the fix changed only comments, a doc bullet and a blank line, so round 1's results (27 chromium, 81 on three browsers, red run 4 failed as specified) cover the same code lines.
- As in round 1: the negative control, and real auth-js timing in a signed-in browser (the owner's post-merge check).

### 6. Blocking

None.

### 7. Non-blocking

- `unit/authenticated-ledger.test.tsx:24-25`: two em dashes in the file's header comment. They predate this task (present at `HEAD`) and are not user-facing; leave them for a separate cleanup.

### 8. Rule candidates

- None. The context bullet this task promotes has landed as written, and the code complies.

## Round 1

### 1. Metadata

- Task: T801, one cloud load per signed-in user (ADR 0105)
- Date: 2026-10-24
- Round: 1
- Verdict: CHANGES REQUESTED
- Target files: `docs/audit/decisions/0105-one-cloud-load-per-session.md`, `src/context/FinanceContext.tsx`, `unit/authenticated-ledger.test.tsx`, `docs/contexts/supabase-ledger.md` (+ bookkeeping `docs/audit/task-ledger.md`). `git check-ignore -v` on all four targets: none ignored (exit 1).

### 2. Summary

`FinanceContext.tsx` adds `loadedUserIdRef` (cleared in `resetToGuestState`) and an inner `adoptSession` that both the startup `getSession()` path and the `onAuthStateChange` handler now call. It keeps the same `currentUser` object when no profile field changed and loads only for a different user id. The unit file swaps five auth-event reload triggers for `refreshFromCloud()` and adds the spec's six-test describe. The code, the tests, the ADR and the ledger row match the spec. Two pieces of prose do not match the spec's exact text, and one of them misdescribes the code.

### 3. Invariants and parity

- Parity map: no row touched. Ledger arithmetic, RPCs and the guest starter set are unchanged. The test edits only change reload triggers, and no arithmetic assertion moved.
- `adoptSession` matches spec section 7 item 4 line for line. The ref is set before the `await`, and the effect deps are still `[loadSupabaseData, resetToGuestState]`.
- `SIGNED_OUT` branch and the null-session `else` branches are unchanged (ADR 0024).
- `import type` kept for `User as AuthUser`: no value import from supabase-js.
- StrictMode double effect: the first run's `cancelled` check comes before `adoptSession`, so the cancelled run never sets the ref. No load is lost.
- `isSeedingRef` behaviour is unchanged (`:873-892`). Only its comment changed, and that comment is now wrong (see Blocking).
- ADR 0105: layout matches ADR 0104 and has every section the spec asks for. Every cited auth-js 2.116.0 line exists: `dist/main/GoTrueClient.js` `:3631` onAuthStateChange, `:3669` INITIAL_SESSION, `:4165` SIGNED_IN, `:360`, `:4336`, `:4747` `_onVisibilityChanged`, `:4282` TOKEN_REFRESHED, `:277`, `:4352` broadcast.
- Line endings: all four tracked files are `i/lf w/crlf` with 0 bare LF. The ADR has 46 CRLF and 0 bare LF.
- Em dashes: 0 in added lines of `git diff -U0 HEAD`, and 0 in the ADR.
- Scope: `git status --porcelain` shows only the 4 targets, the ledger and the stage 01/02 outputs. No unannounced file.

### 4. Gates run

| Command | Result | Log |
|---|---|---|
| `npm run lint` | exit 0: node-globals 133 files clean, safe-ids 133 files clean, both `tsc` clean | `workflow/stages/03_review/output/logs/T801-lint.log` |
| `npx vitest run unit/authenticated-ledger.test.tsx unit/supabase-lazy-provider.test.tsx` | 2 files passed, 148 tests passed, 0 failed, 0 skipped (48.33s) | `workflow/stages/03_review/output/logs/T801-targeted.log` |
| `npm run test:unit` | 68 files passed, 1506 tests passed, 0 failed, 0 skipped (53.21s) | `workflow/stages/03_review/output/logs/T801-unit.log` |
| Red run: `git stash push -- src/context/FinanceContext.tsx`, then `npx vitest run unit/authenticated-ledger.test.tsx -t "one cloud load per signed-in user"`, then `git stash pop --index` | 4 failed (3 `it.each` + `takes a rename`), 2 passed, 139 skipped, matching the spec. `git status --porcelain` identical before and after; FinanceContext still `w/crlf` | `workflow/stages/03_review/output/logs/T801-red.log` |
| Ports 3000/3100 | free | |
| `npx playwright test tests/auth.spec.ts tests/account-and-mobile-nav.spec.ts tests/storage-persistence.spec.ts --project=chromium` | 27 passed (54.7s) | `workflow/stages/03_review/output/logs/T801-e2e-chromium.log` |
| Same, all three browsers | 81 passed (1.7m) | `workflow/stages/03_review/output/logs/T801-e2e.log` |

### 5. Not verified

- The negative control (removing `loadedUserIdRef.current = null;`). I relied on the builder's report and did not rerun it, because it needs a source edit the reviewer may not make outside the stash step.
- Real auth-js event timing in a signed-in browser. A signed-in e2e needs real credentials, which is stop-and-ask. That is the owner's post-merge check (spec section 12).

### 6. Blocking

- `src/context/FinanceContext.tsx:765-770` - The new comment on `isSeedingRef` says it "Tracks the current cloud load so we don't start a second one while one is in flight (F6)". The ref guards concurrent `seed_starter_account()` calls (`:873-892`), not loads, and F6 is unrelated. The comment also drops the duplicate-categories root cause and the ADR 0039 note. Spec section 7 item 7 gave the exact replacement text. - Replace lines 765-770 with spec section 7 item 7's comment, verbatim.
- `docs/contexts/supabase-ledger.md:62` - The bullet does not match spec section 9. "The auth listener ignores `INITIAL_SESSION`" reads as unconditional, but an `INITIAL_SESSION` for a different user does load. The bullet also drops that the startup `getSession()` load sets the ref and `resetToGuestState` clears it, which is the rule a future agent most needs. - Replace the bullet with spec section 9's text, verbatim.

### 7. Non-blocking

- `unit/authenticated-ledger.test.tsx:3182`: no blank line between the previous describe's `});` and the new `describe(`, unlike the rest of the file.

### 8. Rule candidates

- None new. The context bullet in spec section 9 is the rule this task promotes, once it lands as written.

### 9. Fix block

```
fix T801 (stage file: workflow/stages/02_build/CONTEXT.md)

1. src/context/FinanceContext.tsx:765-770: replace the comment above `const isSeedingRef = useRef(false);` with spec section 7 item 7's comment, verbatim (it starts "// Phase 30: guards against concurrent seed attempts." and ends "caller (ADR 0039)."). Change no code line.
2. docs/contexts/supabase-ledger.md:62: replace the "One cloud load per signed-in user" bullet with spec section 9's bullet, verbatim.
3. Optional: add a blank line before `describe('one cloud load per signed-in user (T801, ADR 0105)'` in unit/authenticated-ledger.test.tsx.

Keep CRLF in all files. Gates to rerun: `npm run lint`; `git ls-files --eol` on the changed files (still w/crlf, 0 bare LF); 0 em dashes in added lines of `git diff -U0 HEAD`; if you take item 3, also `npx vitest run unit/authenticated-ledger.test.tsx`. Append a `## Fix round 1` section to task-T801-build.md.
```
