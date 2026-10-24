# Build report: T801

Phase 145, branch `phase-145-one-load-per-session`. First task of the phase; does not ship the phase.

## 1. Files changed (5 files)

- `docs/audit/decisions/0105-one-cloud-load-per-session.md`
- `src/context/FinanceContext.tsx`
- `unit/authenticated-ledger.test.tsx`
- `docs/contexts/supabase-ledger.md`
- `docs/audit/task-ledger.md`

## 2. Tests added and fail-then-pass evidence

Added 6 unit tests in `unit/authenticated-ledger.test.tsx` under `describe('one cloud load per signed-in user (T801, ADR 0105)', ...)`:
- 3 parameterised tests for `INITIAL_SESSION`, `TOKEN_REFRESHED`, `SIGNED_IN` ensuring zero queries and identical state object identity
- 1 test for profile rename from `USER_UPDATED` without ledger queries
- 1 guard test for different user ID triggering a fresh cloud load
- 1 guard test for the same user signing back in after sign-out triggering a fresh cloud load

Also updated 5 existing test calls in `unit/authenticated-ledger.test.tsx` that previously invoked `authCallback` with `SIGNED_IN` or `TOKEN_REFRESHED` to use `actions().refreshFromCloud()`.

### Red run (Gate 1)

Command: `npx vitest run unit/authenticated-ledger.test.tsx -t "one cloud load per signed-in user"`
Log: `workflow/stages/02_build/output/logs/T801-red.log`

Result: 4 failed, 2 passed (6 total in the block; 139 other tests in the file skipped via `-t`):
- `reads nothing and redraws nothing on INITIAL_SESSION for the user already loaded`: FAIL (expected `[]`, received select queries on all ledger tables)
- `reads nothing and redraws nothing on TOKEN_REFRESHED for the user already loaded`: FAIL (expected `[]`, received select queries on all ledger tables)
- `reads nothing and redraws nothing on SIGNED_IN for the user already loaded`: FAIL (expected `[]`, received select queries on all ledger tables)
- `takes a rename from USER_UPDATED without a reload`: FAIL (expected `[]`, received select queries on all ledger tables)
- `loads when a different user signs in`: PASS
- `loads again when the same user signs back in after signing out`: PASS

### Green run (Gate 2)

All 6 new tests passed after implementing `loadedUserIdRef` and `adoptSession` in `FinanceContext.tsx` (`npx vitest run unit/authenticated-ledger.test.tsx -t "one cloud load per signed-in user"`: 6 passed, 0 failed). Full file `unit/authenticated-ledger.test.tsx`: 145 passed.

### Negative control

Temporarily removed `loadedUserIdRef.current = null;` in `resetToGuestState`.
Ran `npx vitest run unit/authenticated-ledger.test.tsx -t "loads again when the same user signs back in after signing out"`:
Failed with `AssertionError: expected false to be true` at line 3227 (`expect(reads().some((c) => c.table === 'wallets')).toBe(true)`).
Restored `loadedUserIdRef.current = null;` and verified all tests pass again.

## 3. Gates

1. **Red run:** verified (4 failed, 2 passed). Log: `workflow/stages/02_build/output/logs/T801-red.log`.
2. **`npm run lint`:** clean (node-globals 133 files clean, safe-ids 133 files clean, `tsc --noEmit` and `tsc -p api/tsconfig.json` 0 errors).
3. **Targeted unit:** `npx vitest run unit/authenticated-ledger.test.tsx unit/supabase-lazy-provider.test.tsx` -> 2 files passed, 148 tests passed (50.09s).
4. **Full unit suite:** `npm run test:unit` -> 68 files passed, 1506 tests passed (71.65s). Log: `workflow/stages/02_build/output/logs/T801-unit.log`.
5. **Playwright Chromium:** `npx playwright test tests/auth.spec.ts tests/account-and-mobile-nav.spec.ts tests/storage-persistence.spec.ts --project=chromium` -> 27 passed (51.0s).
6. **Playwright all browsers:** `npx playwright test tests/auth.spec.ts tests/account-and-mobile-nav.spec.ts tests/storage-persistence.spec.ts` -> 81 passed across 3 browsers (2.0m). Log: `workflow/stages/02_build/output/logs/T801-e2e.log`.
7. **Negative control:** verified.
8. **Line endings:** verified via `git ls-files --eol` and Node inspection: all 5 files have strict CRLF line endings (0 bare LF).
9. **Em dashes:** verified with regex search: 0 em dashes added in `git diff HEAD`, ADR 0105, or this build report.
10. **Scope:** `git status --porcelain` confirms only the 5 target/bookkeeping files were modified, alongside the stage 01 spec.

## 4. Deliberately not done

- No changes to realtime channel reconnect reload: ADR 0023's stale-after-ms check remains the authority on wake/reconnect.
- No changes to guest auth listener behavior: guests still do not run `loadSupabaseData` or clear on `INITIAL_SESSION`.
- Phase closing docs (`refactor-log.md`, `baseline-metrics.md`, test counts in `AGENTS.md` and `README.md`): reserved for the task that ships the phase.


## Fix round 1

Fixed the two blocking items from round 1 of `task-T801-review.md` and added the non-blocking spacing cleanup:

1. `src/context/FinanceContext.tsx:765-776`: replaced the doc comment above `const isSeedingRef = useRef(false);` with spec section 7 item 7's comment verbatim, explaining that two loads can overlap for one brand-new account (before ADR 0105 from `getSession()` and `onAuthStateChange`'s initial event, and still between a startup load and another trigger), which could insert duplicate default categories if not guarded.
2. `docs/contexts/supabase-ledger.md:62`: replaced the "One cloud load per signed-in user" bullet with spec section 9's bullet verbatim, clarifying that the auth listener loads only when the session's user differs from `loadedUserIdRef`, which startup `getSession()` sets and `resetToGuestState` clears, while profile events update only changed fields without reloading the ledger.
3. `unit/authenticated-ledger.test.tsx:3182`: added a blank line before `describe('one cloud load per signed-in user (T801, ADR 0105)'` to match file formatting conventions.

### Gates rerun

1. `npm run lint`: exit 0 (node-globals 133 files clean, safe-ids 133 files clean, both `tsc` clean).
2. `npx vitest run unit/authenticated-ledger.test.tsx`: 1 file passed, 145 passed (49.41s).
3. Line endings: strict CRLF verified on all touched files (`w/crlf`, 0 bare LF).
4. Em dashes: 0 em dashes in added lines of `git diff -U0 HEAD` or in this build report.
5. Scope: exactly the target files and bookkeeping files modified.
