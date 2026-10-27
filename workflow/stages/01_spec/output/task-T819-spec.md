# T819 spec: transfer_funds replays a soft-deleted transfer instead of raising unique_violation

Phase 151, branch `phase-151-transfer-replay-soft-deleted` (cut from `main` at `a6147d7`). T819 is the only task of the phase and ships it. ADR `0110` (next free number; `docs/audit/decisions/` ends at `0109`).

## 1. Goal

Fix the Backlog row "transfer_funds breaks replay on soft-deleted transactions and throws unique_violation" (Audit 2026-10-16 (T759), finding SL-01, medium): a retry of a transfer the user has since deleted must replay that row (`reused: true`, nothing moves), the way `record_transaction` already does, instead of failing with 23505. Server-side only: a new migration that re-creates `transfer_funds` from its deployed body, a probe, and the PGlite replay tests, written failing first.

## 2. Target files

The builder writes the ADR first, before any SQL or test.

```
docs/audit/decisions/0110-transfer-funds-replays-any-row.md
supabase/migrations/20261028_phase151_transfer_funds_replay_any_row.sql
supabase/tests/20261028_phase151.probe.sql
unit/migration-replay.test.ts
AGENTS.md
README.md
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
docs/audit/task-ledger.md
```

The three `supabase/` and `docs/audit/decisions/` files are new. `AGENTS.md` and `README.md` change one stated count each (section 2e). Bookkeeping: `docs/audit/task-ledger.md` (also listed) and `workflow/stages/02_build/output/*`.

### 2a. ADR `docs/audit/decisions/0110-transfer-funds-replays-any-row.md`

Title: `# 0110: transfer_funds replays on any row with its key, live or soft-deleted`. Sections, in this order:

- **Status:** `Accepted. Implemented in Phase 151 (T819): code \`<sha>\`, merged \`<sha>\`. The migration \`20261028_phase151_transfer_funds_replay_any_row.sql\` is not applied to live yet; the owner applies it (see Release).` Then two bullets: **Amends** ADR 0069 (the Phase 93 `transfer_funds` body, whose two lookups matched live rows only). **Completes** ADR 0023's replay rule ("Replay matches any row, live or deleted, deliberately") for the one ledger function that did not follow it.
- **Date:** 2026-10-28
- **Context:** ADR 0023 found the two idempotency indexes (the partial `transactions_user_idempotency_key_uniq` and the non-partial `transactions_user_idempotency_uidx`, created by `20260901_baseline_schema.sql:151-153`, which live also holds) and made `record_transaction` replay on any row; `transfer_funds` kept `and is_deleted = false` in its replay check and its `unique_violation` handler (`20261006_phase93_transfer_funds_from_session.sql:80-86`, `:176-181`). So a retry whose transfer the user had since deleted passed the check, moved the money, hit `transactions_user_idempotency_uidx` on insert, found no live row in the handler and re-raised 23505. The block rolled back (nothing moved), but the retry could never succeed. Reproduced on a PGlite replay of every migration on 2026-10-28: `ERR 23505 duplicate key value violates unique constraint "transactions_user_idempotency_uidx"`, balances unchanged.
- **Decision:** D1, re-create `transfer_funds` from the deployed body (md5 `03b469921a7c0d01909608cb8c6a53d7`, carriage returns removed, the value the Phase 102 and 114 probes pin), changing only the two lookups: no `is_deleted` filter, `order by is_deleted asc, created_at asc`, as `record_transaction` (`20260928_phase52_security_ledger.sql:244-249`, `:326-331`). D2, the return shape is unchanged: a replay of a deleted transfer returns `reused: true`, that row (with `is_deleted: true`), and the two wallets' balances as they stand now. D3, no client change (the reasons in section 4 of this spec, in two or three sentences). D4, neither idempotency index changes.
- **Consequences:** a retried transfer whose row was deleted closes the form as a success and moves nothing, which is what a retried expense already does. The Phase 102 and 114 probes pin the Phase 93 body, so their after-migration runs in `unit/migration-replay.test.ts` stop before Phase 151.
- **Not done:** the `unique_violation` handler is not exercised by the probe (it needs two concurrent sessions); the probe's text and md5 checks cover it. No client test for a deleted replay (the client path is the existing replay path, unchanged). No change to `record_transaction` or the other ledger functions.
- **Release:** "Not applied yet. After T819 is approved, the owner, in the Supabase SQL editor:" then the five steps of section 8, numbered.

No em dash anywhere.

### 2b. Migration `supabase/migrations/20261028_phase151_transfer_funds_replay_any_row.sql`

1. A header comment in the style of the Phase 93 file, saying: Phase 151 (ADR 0110); finding SL-01; what the Phase 93 lookups did and the 23505 it caused (as in the ADR's Context); that it starts from the deployed Phase 93 body (md5 `03b469921a7c0d01909608cb8c6a53d7`, carriage returns removed) and changes only the two lookups and their comments; that the signature, grants and return shape are unchanged and no client changes; that it is safe to apply before or after the Phase 151 merge, since no client depends on it; `Probe: supabase/tests/20261028_phase151.probe.sql.`
2. Then `20261006_phase93_transfer_funds_from_session.sql:29-205` copied byte for byte (the `create or replace function` statement and the `revoke` and `grant` lines after it), except these two edits:
   - The replay comment and lookup (Phase 93 lines 78-86) become:
     ```sql
       -- Idempotent replay (ADR 0023, ADR 0110): a key that already produced a
       -- transaction, live or soft-deleted, is a no-op that returns that row. A
       -- key names one intent, so a retry of a transfer the user has since
       -- deleted moves nothing. A live row wins if both exist.
       if p_idempotency_key is not null then
         select * into v_existing
           from public.transactions
          where user_id = v_user
            and idempotency_key = p_idempotency_key
          order by is_deleted asc, created_at asc
          limit 1;
     ```
   - The handler (Phase 93 lines 172-181) keeps its three comment lines, adds a fourth, `  -- It matches any row with the key, as the replay check above does.`, and its lookup becomes the same five lines as above (`select * into v_existing` through `limit 1;`, at the handler's indentation, which is the same as the replay's).
3. No other change: not the declarations, the guards, the locking, the updates, the insert, the return objects, the `revoke all ... from public, anon;` and `grant execute ... to authenticated;` lines (no `service_role` grant, as in Phase 93). No comment inside the body may contain the text `and is_deleted = false` (the probe asserts the body has none).

### 2c. Probe `supabase/tests/20261028_phase151.probe.sql`

Write it as below. Its sections run behaviour first so that, against the unfixed body, the first failure is the bug itself. The reviewer drafted and ran this text (the md5 assertion aside) on 2026-10-28 against a PGlite replay: unfixed it fails with `1 a retry of a deleted transfer did not replay it: 23505`, with the two lookups changed it ends `PHASE 151 PROBE OK`.

```sql
-- =============================================================================
-- Phase 151 probe (ADR 0110): transfer_funds replays a retry whose transfer
-- the user has since deleted, instead of raising unique_violation; it still
-- replays a live transfer, moves money for a new key, and keeps one account's
-- key apart from another's.
--
-- Runs inside BEGIN ... ROLLBACK, so nothing it creates or writes survives.
-- Keep the `\ir` line to test the migration before it is applied; a runner
-- without psql pastes the file in its place. After it is applied, remove the
-- `\ir` line and run the rest against the live schema. The unit suite runs it
-- on a replayed database (unit/migration-replay.test.ts).
--
-- Success is the final row, `PHASE 151 PROBE OK`.
-- =============================================================================

begin;

\ir ../migrations/20261028_phase151_transfer_funds_replay_any_row.sql

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000151a01', 'phase151-probe-a@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe A"}'),
  ('00000000-0000-4000-8000-000000151b01', 'phase151-probe-b@example.invalid', 'authenticated', 'authenticated', '{"name":"Probe B"}');

insert into public.wallets (id, user_id, name, type, balance) values
  ('00000000-0000-4000-8000-0000015aa001', '00000000-0000-4000-8000-000000151a01', 'A main',  'CASH', 100.00),
  ('00000000-0000-4000-8000-0000015aa002', '00000000-0000-4000-8000-000000151a01', 'A spare', 'CASH', 0.00),
  ('00000000-0000-4000-8000-0000015bb001', '00000000-0000-4000-8000-000000151b01', 'B main',  'CASH', 50.00),
  ('00000000-0000-4000-8000-0000015bb002', '00000000-0000-4000-8000-000000151b01', 'B spare', 'CASH', 0.00);

-- Calls a transfer as whoever the claims name, as authenticated, and returns
-- what it did: `moved` or `reused`, the two balances it returned, and
-- ` deleted` when the row it returned is soft-deleted; or the SQLSTATE it
-- raised.
create function pg_temp.transfer_as(p_claims text, p_source uuid, p_dest uuid, p_amount numeric, p_key text)
returns text
language plpgsql
as $fn$
declare
  r jsonb;
begin
  perform set_config('request.jwt.claims', p_claims, true);
  r := public.transfer_funds(p_source_wallet_id => p_source, p_dest_wallet_id => p_dest,
         p_amount => p_amount, p_idempotency_key => p_key);
  return (case when (r ->> 'reused')::boolean then 'reused ' else 'moved ' end)
         || (r ->> 'source_balance') || ' ' || (r ->> 'dest_balance')
         || (case when (r -> 'transaction' ->> 'is_deleted')::boolean then ' deleted' else '' end);
exception when others then
  return sqlstate;
end;
$fn$;
grant execute on function pg_temp.transfer_as(text, uuid, uuid, numeric, text) to authenticated;

-- Soft-deletes the caller's row with this key through set_transaction_deleted,
-- and returns `deleted`, or the SQLSTATE it raised.
create function pg_temp.delete_as(p_claims text, p_key text)
returns text
language plpgsql
as $fn$
begin
  perform set_config('request.jwt.claims', p_claims, true);
  perform public.set_transaction_deleted(
    (select id from public.transactions where idempotency_key = p_key and user_id = auth.uid()), true);
  return 'deleted';
exception when others then
  return sqlstate;
end;
$fn$;
grant execute on function pg_temp.delete_as(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 1. A retry of a deleted transfer replays it and moves nothing; a retry of a
--    live one still replays; a key is one account's alone.
-- -----------------------------------------------------------------------------
set local role authenticated;
do $replay$
declare
  a  text := '{"sub":"00000000-0000-4000-8000-000000151a01","role":"authenticated"}';
  b  text := '{"sub":"00000000-0000-4000-8000-000000151b01","role":"authenticated"}';
  a1 uuid := '00000000-0000-4000-8000-0000015aa001';
  a2 uuid := '00000000-0000-4000-8000-0000015aa002';
  b1 uuid := '00000000-0000-4000-8000-0000015bb001';
  b2 uuid := '00000000-0000-4000-8000-0000015bb002';
  v  text;
begin
  -- B moves 7 under the key A uses next, then deletes it: B is back at 50.00.
  assert pg_temp.transfer_as(b, b1, b2, 7, 'p151-1') = 'moved 43.00 7.00', '1 B could not move its own money';
  assert pg_temp.delete_as(b, 'p151-1') = 'deleted', '1 B could not delete its transfer';

  -- A's first call under that key is A's own new transfer, not B's row.
  v := pg_temp.transfer_as(a, a1, a2, 10, 'p151-1');
  assert v = 'moved 90.00 10.00', '1 A''s new key did not move A''s money: ' || coalesce(v, 'null');

  -- A deletes it, then retries with the same key: the retry replays the
  -- deleted row with the balances as they stand, and moves nothing.
  assert pg_temp.delete_as(a, 'p151-1') = 'deleted', '1 A could not delete its transfer';
  v := pg_temp.transfer_as(a, a1, a2, 10, 'p151-1');
  assert v = 'reused 100.00 0.00 deleted', '1 a retry of a deleted transfer did not replay it: ' || coalesce(v, 'null');

  -- A live transfer still replays.
  assert pg_temp.transfer_as(a, a1, a2, 5, 'p151-2') = 'moved 95.00 5.00', '1 A could not move a second transfer';
  v := pg_temp.transfer_as(a, a1, a2, 5, 'p151-2');
  assert v = 'reused 95.00 5.00', '1 a retry of a live transfer did not replay it: ' || coalesce(v, 'null');
end;
$replay$;
reset role;

-- -----------------------------------------------------------------------------
-- 2. The ledger: one row per key and account, the deleted one still deleted.
-- -----------------------------------------------------------------------------
do $ledger$
begin
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000015aa001') = 95.00, '2 A main is not 95.00';
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000015aa002') = 5.00, '2 A spare is not 5.00';
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000015bb001') = 50.00, '2 B main is not 50.00';
  assert (select balance from public.wallets where id = '00000000-0000-4000-8000-0000015bb002') = 0.00, '2 B spare is not 0.00';
  assert (select count(*) from public.transactions
           where user_id = '00000000-0000-4000-8000-000000151a01' and idempotency_key = 'p151-1') = 1,
    '2 A does not have exactly one row under p151-1';
  assert (select is_deleted from public.transactions
           where user_id = '00000000-0000-4000-8000-000000151a01' and idempotency_key = 'p151-1'),
    '2 the replay brought A''s deleted transfer back';
  assert (select count(*) from public.transactions where idempotency_key like 'p151-%') = 3,
    '2 not exactly three transfer rows';
end;
$ledger$;

-- -----------------------------------------------------------------------------
-- 3. One signature, its grants unchanged, neither lookup skipping a deleted
--    row, the Phase 151 body, and the advisor's count unchanged (ADR 0067).
-- -----------------------------------------------------------------------------
do $shape$
declare
  fn regprocedure := to_regprocedure('public.transfer_funds(uuid, uuid, numeric, text, text, date, text, boolean)');
begin
  assert fn is not null, '3 the session signature is missing';
  assert (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'transfer_funds') = 1,
    '3 not exactly one transfer_funds';
  assert (select prosecdef from pg_proc where oid = fn), '3 not security definer';
  assert (select proconfig from pg_proc where oid = fn) = array['search_path=public, pg_temp'], '3 search_path is not pinned';
  assert has_function_privilege('authenticated', fn, 'execute'), '3 authenticated cannot execute';
  assert not has_function_privilege('anon', fn, 'execute'), '3 anon can execute';
  assert (select position('and is_deleted = false' in prosrc) from pg_proc where oid = fn) = 0,
    '3 a lookup still skips soft-deleted rows';
  -- Carriage returns removed, as supabase/catalog.sql does: live's body has
  -- them (applied from a Windows checkout), a Linux replay does not.
  assert (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = fn) = '<NEW_MD5>',
    '3 the body is not the Phase 151 one';
  assert (select count(*) from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.prosecdef
             and has_function_privilege('authenticated', p.oid, 'execute')) = 11,
    '3 the advisor would not list exactly eleven SECURITY DEFINER functions';
end;
$shape$;

select 'PHASE 151 PROBE OK' as result;

rollback;
```

`<NEW_MD5>` is the md5 of the new migration's function body, computed once the migration is final with gate 7's second command, and pasted in.

### 2d. `unit/migration-replay.test.ts`

Three edits, nothing else:

1. Line 50: `toHaveLength(22)` becomes `toHaveLength(23)`.
2. Lines 287-292: the comment gains a final sentence and `upTo148` derives from a new `upTo150`, so every run that stopped before Phase 149 also stops before Phase 151 (the Phase 102 and 114 probes pin the Phase 93 body by md5; without this their after-runs fail with `1 the session signature's body changed`):
   ```ts
     // Its section 4 checks that the 20260909 signature still moves money, which
     // Phase 102 ends on purpose; the Phase 102 probe checks the refusal instead.
     // Phase 114 drops that signature, so both stop before it. Phase 149 adds an
     // eleventh SECURITY DEFINER function the advisor lists, so the probes that
     // count ten (Phases 102, 114 and 123) stop before it. Phase 151 re-creates
     // transfer_funds, whose body the Phase 102 and 114 probes pin by md5, so
     // every run that stops before Phase 149 stops before Phase 151 too.
     const upTo150 = () => migrationFiles().filter(file => !file.includes('_phase151_'));
     const upTo148 = () => upTo150().filter(file => !file.includes('_phase149_'));
   ```
   (`upTo113`, `upTo101` and `upTo122` keep deriving from `upTo148`.)
3. After the test `'Phase 149: the probe fails on the schema before it, with the migration left out'` (ends at line 412) and before `'Phase 73, re-run against the Phase 88 function: still passes'`, add:
   ```ts
     it('Phase 151, before its migration: applies it, passes and rolls back', async () => {
       const { rows, before, after } = await runProbe('20261028_phase151.probe.sql', upTo150(), false);
       expect(rows).toContainEqual({ result: 'PHASE 151 PROBE OK' });
       expect(after).toEqual(before);
     }, 60_000);

     it('Phase 151, after its migration: passes against every file', async () => {
       const { rows, before, after } = await runProbe('20261028_phase151.probe.sql', migrationFiles(), true);
       expect(rows).toContainEqual({ result: 'PHASE 151 PROBE OK' });
       expect(after).toEqual(before);
     }, 60_000);

     // SL-01: before Phase 151 a retry of a deleted transfer raised 23505.
     it('Phase 151: the probe fails on the schema before it, with the migration left out', async () => {
       const probeDb = await createDatabase();
       try {
         await applyMigrations(probeDb, upTo150());
         await expect(probeDb.exec(inlineProbe('20261028_phase151.probe.sql', { applied: true }))).rejects.toThrow(
           /a retry of a deleted transfer did not replay it: 23505/
         );
       } finally {
         await probeDb.close();
       }
     }, 60_000);
   ```

The catalog counts at lines 63-69 do not change (`create or replace` adds no object; the function count stays 17). Leave the comment at lines 58-62 as it is.

### 2e. Closing docs (T819 ships the phase)

- `AGENTS.md:11`: `1598 tests, 72 files` becomes the count gate 6 reports (expected `1601 tests, 72 files`). Nothing else in `AGENTS.md`.
- `README.md:157`: `1598 tests in 72 files` becomes the same count.
- `docs/audit/task-ledger.md`:
  - A new section after Phase 150 and before `## Backlog`:
    ```
    ## Phase 151 - transfer_funds replays a soft-deleted transfer (ADR 0110)

    Branch `phase-151-transfer-replay-soft-deleted`, cut from `main` at `a6147d7`. One migration, `20261028_phase151_transfer_funds_replay_any_row.sql`, applied to live by the owner (ADR 0110 Release).

    | # | Task | Files | Status | Commit | Gate result |
    |---|---|---|---|---|---|
    | T819 | transfer_funds replays on any row with its key, live or soft-deleted: migration, probe, PGlite replay; Phase 151 closing docs (ADR 0110) | <the section 2 paths, in backticks, comma-separated> | done | | <gate results> |
    ```
    The `Commit` cell stays empty (line 3 of the file).
  - The Backlog row at line 65: Status `todo` becomes `done in Phase 151 (T819)`.
- `docs/audit/refactor-log.md`: a new entry directly under the `---` line (above Phase 150), with every heading of the file's template:
  - `## Phase 151 - transfer_funds replays a soft-deleted transfer: T819 (2026-10-28, code \`<sha>\`, merged \`<sha>\`)`
  - `ADR \`0110\`.` plus one or two sentences of brief (the Goal above).
  - **Changed:** each section 2 file and what changed in it. **Verified:** gate commands and results. **Surprises:** what the build actually found, or `none`. **Deliberately not done:** the ADR's Not done list, plus "no Playwright run: no file under `src/` or `tests/` changed".
- `docs/audit/baseline-metrics.md`: a new `### Phase 151 - delta against Phase 149` at the top of `## Figures` (Phase 150 changed docs only and added no section), with:
  - one line: measured at the T819 working tree; no file under `src/`, `index.html`, `vite.config.ts`, `package.json` or `package-lock.json` changed (gate 11), so the entry chunk, all app JS and CSS are Phase 149's (`index-achQGTXo.js` 198,233 B, all app JS 910,934 B in 39 files, CSS 54,969 B) and were not rebuilt;
  - **Vitest:** files and tests from gate 6, the delta against Phase 149's 72 files / 1598 (expected +0 files, +3 tests, all in `unit/migration-replay.test.ts`), the time and the log path;
  - **Playwright:** unchanged, 213 tests in 37 files, 639 runs; not run (no spec or `src/` change).

## 3. Context to read

- `docs/contexts/supabase-ledger.md`: the replay rule (line 20), the known drift of the non-partial index (line 24), re-creating a deployed function from its md5-checked body (line 34), migrations replay from empty and probes (lines 26-43). It needs no edit: line 20 already states the rule this task makes `transfer_funds` follow.
- ADR `docs/audit/decisions/0023-atomic-server-ledger-writes.md`, the "Replay matches any row, live or deleted, deliberately" paragraph (around line 65), for the ADR's wording.

## 4. Current behaviour

- `transfer_funds` (the only signature since Phase 114, `20261008_phase114_drop_legacy_transfer_funds.sql:20`) is defined once, in `supabase/migrations/20261006_phase93_transfer_funds_from_session.sql:29-199`; no later migration re-creates it. Its body hashes to `03b469921a7c0d01909608cb8c6a53d7` (carriage returns removed; computed from the file on 2026-10-28), the value `supabase/tests/20261006_phase102.probe.sql:77` and `20261008_phase114.probe.sql:73` pin, and live matched the repo's catalog (body md5s included, `supabase/catalog.sql:74`) in the zero-row drift check after Phase 149 (`docs/audit/task-ledger.md:20`).
- The replay check matches live rows only: `20261006_phase93_transfer_funds_from_session.sql:80-86` (`and is_deleted = false`). So does the `unique_violation` handler, `:175-185`, which re-raises when it finds no live row.
- Every replayed database, like live, has the non-partial `transactions_user_idempotency_uidx (user_id, idempotency_key) where idempotency_key is not null` (`20260901_baseline_schema.sql:151-153`, asserted at `unit/migration-replay.test.ts:72-78`) beside the partial `transactions_user_idempotency_key_uniq` (`20260909_transfer_funds.sql:43-45`).
- Result: transfer under key K, soft-delete it (`set_transaction_deleted`, `20260927_ledger_rpcs.sql:395-466`, reverses both legs), retry with K: the check misses, both balances move, the insert hits `transactions_user_idempotency_uidx`, the handler finds no live row and raises 23505; the exception block rolls the balance updates back. Reproduced by the reviewer on 2026-10-28 on a PGlite replay of all 22 migrations: `ERR 23505 duplicate key value violates unique constraint "transactions_user_idempotency_uidx"`, wallets back at 100.00 / 0.00.
- `record_transaction` already matches any row, `order by is_deleted asc, created_at asc`, in both places: `20260927_ledger_rpcs.sql:285-297` and `:369-381`, re-created as deployed in `20260928_phase52_security_ledger.sql:241-253` and `:325-337`.
- No unit or probe test covers a replay of a deleted transfer: `supabase/tests/20261006_phase93.probe.sql:131-132` and `20261008_phase114.probe.sql:102-103` replay a live one only; `unit/authenticated-ledger.test.tsx:1997-2112` stubs `transfer_funds` with no replay at all.

### Client: no change needed

- The signed-in transfer path, `src/context/FinanceContext.tsx:1888-1938`, treats any payload with a `transaction` the same way: `mapTransactionRow` (`src/services/financeHydration.ts:20`, `isDeleted: row.is_deleted || false` at `:34`) maps it, `:1920` replaces any local copy by id, `:1925-1935` adopts `source_balance` and `dest_balance` (which also undoes the optimistic debit and credit of `:1826-1848`, as the comment at `:1922-1924` says), and `:1938` returns success. A replayed deleted row therefore lands in state as deleted, the balances match the server, and nothing moved: the same outcome `record_transaction`'s replay gives through `:1977-1983`.
- Today the same retry gets a 23505 error, which has a SQLSTATE, so `isUnknownOutcomeError` (`:347-349`) is false: the client rolls back and the form stays open, and every retry with the armed key (`src/components/wallet/WalletTransferForm.tsx:163`) fails again. After the fix it succeeds with no money moved.
- The client's own replay check, `FinanceContext.tsx:1759-1762`, already matches a local row with the key whether or not it is deleted, and the cloud load reads deleted rows too (`src/services/financeHydration.ts:187-191`, no `is_deleted` filter), so the server path is reached only when this device's state lacks the row.

## 5. Parity map

- **`addTransaction` / `setTransactionDeleted` arithmetic vs `_ledger_apply_effect` and the ledger RPCs:** `transfer_funds` is a ledger RPC, but its arithmetic (`balance - v_amount`, `balance + v_amount`) is copied unchanged; only which existing row a replay returns changes. Guards to run: `unit/authenticated-ledger.test.tsx`, `unit/ledger-guards.test.tsx` (gate 5) and the probes in `unit/migration-replay.test.ts` (gate 3).
- No other row. The transfer preview, the guest starter set and the proxies are untouched.

## 6. Tests to add

All in `unit/migration-replay.test.ts` (section 2d), driving the new probe:

1. `Phase 151, after its migration: passes against every file`: fails today because the probe's section 1 gets `23505` from the Phase 93 body (`20261006_phase93_transfer_funds_from_session.sql:85` and `:180`), with `1 a retry of a deleted transfer did not replay it: 23505`.
2. `Phase 151, before its migration: applies it, passes and rolls back`: fails today because the migration file the probe includes does not exist yet (ENOENT from `inlineProbe`), then passes and leaves the catalog as it was.
3. `Phase 151: the probe fails on the schema before it, with the migration left out`: the permanent guard that the probe catches SL-01. It passes on the red run too (that is its job), and must still pass after.
4. The edited count, `toHaveLength(23)`, fails today with 22.

Red run order (stage 02 step 4): write the ADR, then the probe and the test edits, with no migration file. Run `npx vitest run unit/migration-replay.test.ts 2>&1 | tee workflow/stages/02_build/output/logs/T819-red.log`. It must show exactly 3 failed: the file count (expected 23, received 22), test 2 (ENOENT naming `20261028_phase151_transfer_funds_replay_any_row.sql`) and test 1 (`1 a retry of a deleted transfer did not replay it: 23505`); every other test, test 3 included, passes. Then write the migration, compute `<NEW_MD5>`, paste it into the probe, and go green.

Reviewer's red check (stage 03 step 6): the only non-test change that alters behaviour is the new, untracked migration, so stash it with `git stash push --include-untracked -- supabase/migrations/20261028_phase151_transfer_funds_replay_any_row.sql` (a plain `git stash push -- <file>` skips an untracked file), run `npx vitest run unit/migration-replay.test.ts`, expect the same 3 failures, then `git stash pop --index` and compare `git status --porcelain`.

## 7. Gates

Union of the `supabase/`, `unit/`, docs-only and money-path rows. Run from the repo root; save full-suite output under `workflow/stages/02_build/output/logs/` (builder) or `workflow/stages/03_review/output/logs/` (reviewer).

1. Red run as in section 6, saved to `T819-red.log`.
2. `npm run lint`
3. `npx vitest run unit/migration-replay.test.ts unit/drift-runner.test.ts unit/migration-history.test.ts`: all pass; `unit/migration-replay.test.ts` has 3 tests more than before.
4. `npm run schema:drift`: exits 0 and prints its read-only query (do not run that query anywhere).
5. `npx vitest run unit/authenticated-ledger.test.tsx unit/ledger-guards.test.tsx`: all pass (parity guard; neither file changes).
6. `npm run test:unit 2>&1 | tee workflow/stages/02_build/output/logs/T819-unit.log`: expected 72 files, 1601 tests, all passed. The count written in `AGENTS.md`, `README.md`, `baseline-metrics.md` and the ledger is the one this run prints.
7. md5 of both bodies, carriage returns removed. Phase 93's must print `03b469921a7c0d01909608cb8c6a53d7` (its file is unchanged); the new one must equal the probe's pinned value:
   ```bash
   for f in supabase/migrations/20261006_phase93_transfer_funds_from_session.sql supabase/migrations/20261028_phase151_transfer_funds_replay_any_row.sql; do node -e "const s=require('fs').readFileSync(process.argv[1],'utf8').replace(/\r/g,'');const a=s.indexOf('as \$\$')+5;console.log(process.argv[1],require('crypto').createHash('md5').update(s.slice(a,s.indexOf('\$\$;',a))).digest('hex'))" "$f"; done
   grep -n "md5(replace(prosrc" supabase/tests/20261028_phase151.probe.sql
   ```
8. The new body differs from Phase 93's only in the two lookups, comments aside. Expected output: `removed [ '       and is_deleted = false' ]` and `added [ '     order by is_deleted asc, created_at asc' ]`, and equal line counts:
   ```bash
   node -e "const fs=require('fs');const body=f=>{const s=fs.readFileSync(f,'utf8').replace(/\r/g,'');const a=s.indexOf('as \$\$')+5;return s.slice(a,s.indexOf('\$\$;',a)).split('\n').filter(l=>!/^\s*--/.test(l))};const o=body(process.argv[1]),n=body(process.argv[2]);console.log('lines',o.length,n.length);console.log('removed',o.filter(l=>!n.includes(l)));console.log('added',n.filter(l=>!o.includes(l)))" supabase/migrations/20261006_phase93_transfer_funds_from_session.sql supabase/migrations/20261028_phase151_transfer_funds_replay_any_row.sql
   ```
   and the statements after the body are Phase 93's two lines: `grep -n "^revoke\|^grant" supabase/migrations/20261028_phase151_transfer_funds_replay_any_row.sql` prints exactly the `revoke all ... from public, anon;` and `grant execute ... to authenticated;` lines of `20261006_phase93_transfer_funds_from_session.sql:204-205`.
9. Stated counts: `grep -n "1598" AGENTS.md README.md` prints nothing, and `grep -n "<count from gate 6> tests" AGENTS.md README.md` prints `AGENTS.md:11` and `README.md:157`.
10. Em dashes: 0 in the added lines, `node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"`, and 0 in each new file, `node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" docs/audit/decisions/0110-transfer-funds-replays-any-row.md supabase/migrations/20261028_phase151_transfer_funds_replay_any_row.sql supabase/tests/20261028_phase151.probe.sql`.
11. Bundle unaffected: `git diff --stat a6147d7 -- src index.html vite.config.ts package.json package-lock.json` prints nothing.
12. Line endings: `git ls-files --eol AGENTS.md README.md unit/migration-replay.test.ts docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md` still shows `w/crlf` for each (all six are CRLF today); report the new files' endings from a Node count of `\r\n` and bare `\n`.
13. Scope: `git status --porcelain` lists only section 2's files and `workflow/stages/02_build/output/*`.

No Playwright spec is affected: no file under `src/` or `tests/` changes, and no spec reaches `transfer_funds` (`tests/` has no match for it; the specs run as a guest, and signing in from a local server is stop-and-ask). So the code tier's "affected spec(s)" set is empty and no Playwright run is required.

## 8. Production touch points

- **Applying the migration to live:** the owner, by hand, in the Supabase SQL editor, after the T819 review is APPROVED. It may go before or after the merge, since no client depends on it; doing it after the merge, from `main`, as Phase 149 did, is the default. The builder and reviewer run nothing against live. Steps, all in one SQL editor tab:
  1. Read-only check that live's body is the one the migration starts from: `select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = 'public.transfer_funds(uuid, uuid, numeric, text, text, date, text, boolean)'::regprocedure;` must return `03b469921a7c0d01909608cb8c6a53d7`. If it does not, stop: the migration must be re-specified from the live body.
  2. Apply `supabase/migrations/20261028_phase151_transfer_funds_replay_any_row.sql`.
  3. Run the history row that `npm run migration:print-history -- supabase/migrations/20261028_phase151_transfer_funds_replay_any_row.sql` prints (ADR 0065).
  4. Run the read-only query that `npm run schema:drift` prints: zero rows.
  5. Optional, the owner's call: the Phase 151 probe with its `\ir` line removed (it rolls back).
- **Commit and push:** the orchestrator commits on the phase branch after APPROVED; push and merge only on the owner's order.
- Nothing else: no `vercel.json`, workflow, dashboard, `/api/*`, env var or MCP write.

## 9. Out of scope

- Any file under `src/`, including `FinanceContext.tsx` and `WalletTransferForm.tsx`: no client change (section 4). Not even a comment.
- `record_transaction`, `import_transactions`, `update_transaction`, `create_wallet`, `set_transaction_deleted`, `set_transactions_deleted`, `_ledger_*`: unchanged.
- Both idempotency indexes, `supabase/catalog.sql`, `supabase/replay/`, `supabase/ops/`, every existing migration and every existing probe (`20261006_phase93.probe.sql`, `20261006_phase102.probe.sql`, `20261008_phase114.probe.sql` keep pinning the Phase 93 body; only the test's file filters change).
- `unit/authenticated-ledger.test.tsx` and `unit/ledger-guards.test.tsx`: run, not edited.
- `docs/contexts/supabase-ledger.md` and ADR 0023 / 0069: not edited (ADR 0110 amends 0069 by reference).
- A replayed transfer whose destination wallet row no longer exists returns `dest_balance: null`, which the client reads as `Number(null) = 0` (`FinanceContext.tsx:1916`, `:1930`). Wallets are only soft-deleted in the app, so this is not reachable today and predates this task; leave it, do not add a Backlog row.
- Any SQL against live, the drift query on live, `schema:drift -- --live`.
