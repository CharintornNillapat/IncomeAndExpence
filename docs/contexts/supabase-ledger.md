# Supabase: schema, ledger RPCs, auth and sessions

Read this before touching `supabase/`, `src/lib/supabase.ts`, a signed-in write path in `FinanceContext.tsx`, auth, sessions or account deletion. **Applying anything to the live project is a stop-and-ask action** (see `AGENTS.md`). Reasons live in the ADRs named in brackets.

## The client: `src/lib/supabase.ts` [0083]

- **No fallback credentials.** The client reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only. Without both the app runs in offline local-storage mode (`isSupabaseConfigured` is false).
- **supabase-js loads on demand.** At boot only when `sessionMayExist()` (a stored `sb-<project>-auth-token`, an auth redirect in the URL, or unreadable storage); otherwise when `AuthModal` opens, another tab stores a session, or a caller awaits `loadSupabase()`. `FinanceContext` starts its auth listener through `whenSupabaseLoads`.
- **`supabase` is a live binding, undefined until loaded.** Only signed-in code uses it directly; guest-reachable code awaits `loadSupabase()` or checks it.
- **Never import a value from `@supabase/supabase-js` in `src/`; `import type` only.** One value import puts the chunk back on every cold start (`tests/auth.spec.ts` fails if a guest load requests it).
- **`onDataApiUnauthorized`** wraps the client's `fetch` and reports `/rest/v1/` 401s only. A 401 is a reason to verify the session, never a sign-out by itself.
- **`authorizationHeader()`** is `{}` for a guest and never throws.

## A signed-in ledger write is one database function or nothing [0023, 0091]

- **The functions:** `record_transaction` (every type except TRANSFER), `transfer_funds`, `set_transaction_deleted` (idempotent by state), `update_transaction` [0033], `import_transactions` (all rows or none, row keys `importKey:rowIndex`), `create_wallet`. Plus `seed_starter_account`, `delete_user_account`, `list_my_sessions`, `consume_ai_quota`.
- **No client-side fallback.** A missing function (`isMissingRpcError()`: `42883` or `PGRST202` only) rolls back, writes no table and returns `databaseUpdateNeeded()` (`code: 'DATABASE_UPDATE_NEEDED'`, "This needs the latest database update. Nothing was changed."). Inside a write's `try` it throws `MissingLedgerFunction`. Do not add a fallback back.
- **On success the client adopts the returned balances and debt remainder** (`adoptLedgerState`). **An error with no SQLSTATE is an unknown outcome:** roll back, then `refreshFromCloud()`. So is a success payload with no row.
- **The user comes from `auth.uid()` only.** No user-id parameter; every `security definer` lookup filters by owner explicitly.
- **Replay runs before the overpayment guard,** and matches any row with the key, live or soft-deleted. `update_transaction`'s replay check runs before its stale guard (`TRANSACTION_CHANGED`); send the `updated_at` the client edited, read before the optimistic write.
- **No overdraft check in SQL** [0014]. The overpayment error is `DEBT_OVERPAYMENT` with the remainder in `detail`; the client formats the text. Money is never formatted in SQL.
- **`_ledger_apply_effect` is the one SQL implementation of the ledger arithmetic** and mirrors `addTransaction`/`setTransactionDeleted` term for term. `_ledger_source_sign`, `_ledger_row_state`, `_ledger_import_state` are private, revoked from every client role.
- **`transfer_funds` has one signature** since Phase 114 [0069, 0078, 0090]: `(p_source_wallet_id, p_dest_wallet_id, p_amount, p_idempotency_key, p_notes, p_date, p_raw_input, p_allow_negative)`, no `p_user_id`. `unit/authenticated-ledger.test.tsx` pins the client's seven arguments.
- **Known drift kept on purpose:** live also has the non-partial `transactions_user_idempotency_uidx`, so a key on a soft-deleted row blocks reuse, matching the replay rule.

## Migrations [0063, 0065, 0066]

- **SQL files in `supabase/migrations/`, PostgreSQL 17.** `20260901_baseline_schema.sql` creates the dashboard-built schema with every statement guarded, so on live it changes nothing; it holds nothing a later file drops.
- **Every file replays from empty.** `unit/migration-replay.test.ts` applies them in order to PGlite (`@electric-sql/pglite` pinned at `0.4.6`; 0.5 is PostgreSQL 18) on top of `supabase/replay/prelude.sql` (roles, `auth.users`/`auth.sessions`, `auth.uid()`, the publication). Do not move PGlite off 0.4.x without re-checking `catalog.sql` against live.
- **Apply schema changes only as migration files.** A dashboard or SQL editor change is drift.
- **The owner applies migrations by hand in the SQL editor,** then runs the history insert from `npm run migration:print-history -- supabase/migrations/<file>.sql` in the same tab. It is idempotent.
- **Ordering:** apply a migration the client depends on *before* deploying that client (a ledger function, a new column: PostgREST rejects an unknown column with `PGRST204`). A data-only colour or seed migration may follow its client [0038]. The migration's ADR says which.
- **Never re-run a migration a later file replaced** (e.g. `20261003_phase73_ai_request_quota.sql` would drop the session check).
- **Re-creating a deployed function starts from the deployed body,** md5-checked against its file (bodies hashed without CR), and ends with the previous phase's probe re-run.
- **A new table holding account data** references `auth.users` with `ON DELETE CASCADE`, joins the Phase 96 probe's `rows_of` count, and revokes `anon`'s grants and `authenticated`'s `TRUNCATE`, `REFERENCES` and `TRIGGER` [0099].
- **Never write a row with `user_id is null`** in `categories` or `keyword_rules` [0069].
- **`public.profiles` has no client write** [0032]; `role` changes only through the service role. Do not read `role` client-side as meaningful.

## Probes: `supabase/tests/*.probe.sql`

- Each is the migration plus assertions inside `BEGIN ... ROLLBACK`. Run it against the real schema before applying (keep the `\ir` line) and after (remove it). **A probe never commits.**
- Several run in the unit suite on a replayed database, before and after their migration (`inlineProbe(..., { applied: true })` leaves out a replaced migration's include).

## Drift check: `supabase/catalog.sql` [0063, 0066]

- `npm run schema:drift` replays offline and prints one read-only query that returns every row of drift. Running that query on live is a stop-and-ask action.
- `npm run schema:drift -- --live` connects with `SUPABASE_DRIFT_DB_URL` as `schema_drift_reader` (catalog and history only, read-only, refused if over-privileged). Exit 0 clean, 1 drift, 2 not checked. CI runs it Mondays 02:17 UTC (`schema-drift.yml`).
- `supabase/ops/` holds SQL that is not a migration (the history backfill, the reader role). Its password is never in the repo.

## Starter seed and colour migration: two copies each

- **`seed_starter_account()`** [0039, 0040] decides on the server whether an account is new (never a wallet or category row, deleted ones included), serialises with an advisory lock, and seeds three ฿0.00 wallets and no debt. The client's guest defaults are the second copy ("Main Checking" client, "Checking Account" server, on purpose). Change both together. A failed seed stops the load and sets `syncError`; a missing function is "Setting up this account needs the latest database update".
- **Identity colours** [0038]: `utils/identityColorMigration.ts` (device storage only, never the Supabase load) and `20261002_phase63_identity_colors.sql` move together.

## Accounts and sessions [0024, 0072, 0087, 0099, 0105]

- **Passwords:** a chosen password needs 8 (`NewPasswordSchema`, `PASSWORD_MIN_LENGTH`); signing in needs only one typed. The auth server's minimum (dashboard) is 8.
- **Sessions are real or absent.** `listMySessions` returns `sessions: null` when unavailable, never `[]`. Revocation is only `signOutOtherDevices` (`scope: 'others'`) and `signOut({ everywhere: true })`. No per-device revoke.
- **`verifySession`** calls `auth.getUser()` on reconnection triggers, `focus`, mount, every 60 s while visible and after a Data API 401. A rejection signs this device out locally; no answer (offline, 5xx, 429) keeps the session.
- **`signOut()` passes `scope: 'local'`** (supabase-js defaults to global).
- **Sign-out clears the device:** `resetToGuestState` runs on an explicit sign-out and on a `SIGNED_OUT` event only, never `INITIAL_SESSION`. It drops the write queue, removes `LEDGER_STORAGE_KEYS` and `pf_insights::*`, and resets every slice. `authEpochRef` stops an in-flight load; keep that check after every `await` in `loadSupabaseData`.
- **One cloud load per signed-in user** [0105]: the auth listener loads only when the session's user differs from `loadedUserIdRef`, which the startup `getSession()` load sets and `resetToGuestState` clears. `INITIAL_SESSION`, `TOKEN_REFRESHED`, `USER_UPDATED` and a repeated `SIGNED_IN` for that user update only a changed profile field, keeping the same `currentUser` object otherwise. A return to the tab reloads through the realtime effect's 30 s rule [0023], never through an auth event.
- **Sign-in replaces, never merges;** `GuestDataNotice` offers a CSV export first.
- **Delete account** calls `delete_user_account('DELETE')` (the only function writing `auth`, the one hard delete), then `signOut()`. An error with no SQLSTATE runs `verifySession()`.
- **Since Phase 123 the ledger tables refuse a request with no session (42501)** instead of returning zero rows; an empty read was never evidence of a new account.

## Advisors (accepted, do not "fix")

The ten `SECURITY DEFINER` functions `authenticated` may execute (each takes the user from `auth.uid()`); `ai_request_counts` with RLS and no policy; five unindexed foreign keys (add indexes past 100,000 transactions, after `scripts/bench-cascade-delete.mjs`); three unused indexes; leaked password protection (a Pro-plan feature, [0099]). Read ADRs 0067, 0074, 0098, 0099 before re-triaging.
