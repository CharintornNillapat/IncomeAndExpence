# 0110: transfer_funds replays on any row with its key, live or soft-deleted

**Status:** Accepted. Implemented in Phase 151 (T819): code `<sha>`, merged `<sha>`. The migration `20261028_phase151_transfer_funds_replay_any_row.sql` is not applied to live yet; the owner applies it (see Release).
- **Amends** ADR 0069 (the Phase 93 `transfer_funds` body, whose two lookups matched live rows only).
- **Completes** ADR 0023's replay rule ("Replay matches any row, live or deleted, deliberately") for the one ledger function that did not follow it.

**Date:** 2026-10-28

## Context

ADR 0023 found the two idempotency indexes (the partial `transactions_user_idempotency_key_uniq` and the non-partial `transactions_user_idempotency_uidx`, created by `20260901_baseline_schema.sql:151-153`, which live also holds) and made `record_transaction` replay on any row; `transfer_funds` kept `and is_deleted = false` in its replay check and its `unique_violation` handler (`20261006_phase93_transfer_funds_from_session.sql:80-86`, `:176-181`). So a retry whose transfer the user had since deleted passed the check, moved the money, hit `transactions_user_idempotency_uidx` on insert, found no live row in the handler and re-raised 23505. The block rolled back (nothing moved), but the retry could never succeed. Reproduced on a PGlite replay of every migration on 2026-10-28: `ERR 23505 duplicate key value violates unique constraint "transactions_user_idempotency_uidx"`, balances unchanged.

## Decision

- **D1:** Re-create `transfer_funds` from the deployed body (md5 `03b469921a7c0d01909608cb8c6a53d7`, carriage returns removed, the value the Phase 102 and 114 probes pin), changing only the two lookups: no `is_deleted` filter, `order by is_deleted asc, created_at asc`, as `record_transaction` (`20260928_phase52_security_ledger.sql:244-249`, `:326-331`).
- **D2:** The return shape is unchanged: a replay of a deleted transfer returns `reused: true`, that row (with `is_deleted: true`), and the two wallets' balances as they stand now.
- **D3:** No client change: the signed-in transfer path in `src/context/FinanceContext.tsx` already replaces any local row by id and adopts the returned server balances, so a replayed deleted transfer leaves state as deleted with balances untouched, identical to `record_transaction`. A retry that previously failed with 23505 and kept the transfer form open now completes successfully without moving money. Furthermore, local replay checks and cloud hydration already include soft-deleted rows, so server replay is only hit when local state lacks the row.
- **D4:** Neither idempotency index changes.

## Consequences

A retried transfer whose row was deleted closes the form as a success and moves nothing, which is what a retried expense already does. The Phase 102 and 114 probes pin the Phase 93 body, so their after-migration runs in `unit/migration-replay.test.ts` stop before Phase 151.

## Not done

The `unique_violation` handler is not exercised by the probe (it needs two concurrent sessions); the probe's text and md5 checks cover it. No client test for a deleted replay (the client path is the existing replay path, unchanged). No change to `record_transaction` or the other ledger functions.

## Release

Not applied yet. After T819 is approved, the owner, in the Supabase SQL editor:
1. Read-only check that live's body is the one the migration starts from: `select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = 'public.transfer_funds(uuid, uuid, numeric, text, text, date, text, boolean)'::regprocedure;` must return `03b469921a7c0d01909608cb8c6a53d7`. If it does not, stop: the migration must be re-specified from the live body.
2. Apply `supabase/migrations/20261028_phase151_transfer_funds_replay_any_row.sql`.
3. Run the history row that `npm run migration:print-history -- supabase/migrations/20261028_phase151_transfer_funds_replay_any_row.sql` prints (ADR 0065).
4. Run the read-only query that `npm run schema:drift` prints: zero rows.
5. Optional, the owner's call: the Phase 151 probe with its `\ir` line removed (it rolls back).
