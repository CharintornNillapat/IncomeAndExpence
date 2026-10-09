# 0099: `anon` holds nothing on the ledger tables; the Auth settings are settled; `checkout` and `setup-node` move to v7

**Status:** Accepted. Released: code `da0effb`, docs `d6a399b`, hash backfill `2681c56`, merged into `main` as `baf2ab0` (PR #74); production deployment READY in `icn1`. Migration `20261010_phase123_revoke_client_table_grants.sql` applied to live by the owner (history `20261009234928`); live drift run `38006352360`: none, 21 migrations.
- **Amends** ADR `0098` section 3: `anon`'s default table grants, accepted there, are revoked.
- **Amends** ADR `0067`: the leaked-password finding (S1) becomes an accepted tier constraint, and two pins move to a new major.
- **Records** the owner's Auth settings against ADR `0087`.

**Date:** 2026-10-10

## Context

1. **ADR `0098` found `anon` holding all seven table privileges** (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`) on `wallets`, `transactions`, `debts`, `categories`, `diary_entries` and `keyword_rules`. They were the schema's default privileges. Row-level security gave `anon` no row, so ADR `0098` accepted them.
2. **A read-only look for this phase found the same seven on `authenticated`.** `TRUNCATE` is not subject to row-level security. PostgREST exposes no `TRUNCATE`, so no request reaches it today; it is one more API surface away. `profiles` lost the same three in Phase 58s.
3. **The owner's brief:** revoke `anon`'s grants on the six tables as defence in depth, with a probe and the history statement; move the pinned actions to their newest majors (ADR `0067` decision 1); record the Auth settings.
4. **The owner's Auth settings, 2026-10-10:**
   - the minimum password length is 8;
   - "Prevent use of leaked passwords" is a Pro-plan feature the project's plan does not include.

## Decision

### 1. One migration: `anon` loses everything, `authenticated` keeps the four row privileges

`20261010_phase123_revoke_client_table_grants.sql`, two statements:
- `revoke all on table <the six> from anon;`
- `revoke truncate, references, trigger on table <the six> from authenticated;`

**All seven from `anon`, not only the four the brief named.** `TRUNCATE` is the one row-level security cannot stop, and `profiles` (Phase 58s) and `ai_request_counts` (Phase 73) already hold nothing for `anon`. Every table then has the same shape.

**Why nothing the app does changes:**
- A guest never loads the Supabase client (ADR `0083`) and stores everything on the device.
- Every signed-in read and write runs as `authenticated`. That includes the direct table writes (wallet edits, categories, diary, rules) and Realtime's change feed, and all of them need only the four row privileges.
- The ledger functions are `SECURITY DEFINER` and run as their owner, so no table grant reaches them.
- `service_role` keeps every privilege.

**One visible difference:** a request with no valid session now gets 42501 from these tables, not zero rows. If one ever reached `loadSupabaseData`, it would be a failed read (`syncError`) instead of an empty slice applied over the user's data. That is the stronger behaviour.

**It needs no client change,** so it can be applied before or after the merge. Until it is applied, the drift check reports the twelve table grants it changes (six tables, two roles) and its missing history row, and nothing else.

**A new table takes the same revokes in its own migration:** the default privileges grant all seven to both roles again. `CLAUDE.md` says so beside the cascade rule for a new table (ADR `0072`).

### 2. The Auth settings

| Setting | State | Decision |
|---|---|---|
| Minimum password length | 8 | **Done.** It matches `PASSWORD_MIN_LENGTH` (ADR `0087`), so the server and the form refuse the same passwords. Signing in still needs only a password, so an account made under the old 6-character floor still signs in. |
| Leaked password protection | off | **Accepted tier constraint.** It is a Pro-plan feature. The advisor keeps listing it (ADR `0067` S1, `0098` S1); a later re-read treats it as decided. Revisit on a plan change. |

### 3. `actions/checkout` and `actions/setup-node` move to v7

| Action | Was | Now | Commit |
|---|---|---|---|
| `actions/checkout` | v5.1.0 | **v7.0.1** (2026-07-20) | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node` | v5.0.0 | **v7.0.0** (2026-07-14) | `820762786026740c76f36085b0efc47a31fe5020` |
| `actions/upload-artifact` | v7.0.1 | unchanged, already the newest major | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` |
| `actions/download-artifact` | v8.0.1 | unchanged, already the newest major | `3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c` |

**Read from each release's notes before moving:**
- **`checkout` v6:** credentials persist to a separate file. Every checkout here sets `persist-credentials: false`.
- **`checkout` v7:** blocks checking out a fork's pull request under `pull_request_target` and `workflow_run`. Neither trigger is used, and `unit/workflow-hardening.test.ts` refuses the first.
- **`setup-node` v6:** automatic caching is limited to npm. Every `setup-node` here passes `cache: 'npm'` explicitly, so this changes nothing.
- **`setup-node` v7:** ESM, cache-key outputs, and no dummy `NODE_AUTH_TOKEN`. Nothing here publishes.

**`setup-node` stays one minor behind.** v7.1.0 was published on 2026-10-08, two days before this phase, so it is pinned at v7.0.0 (three months old). Moving to v7.1.0 later is a pin change of its own. The same holds for `upload-artifact` v7.0.2 and `download-artifact` v8.0.2 (2026-10-07), which are patches inside the majors already pinned.

**Resolved as ADR `0067` says:** `gh api repos/actions/<action>/git/ref/tags/<tag>`. Both tags point straight at a commit.

## Verification

- **Probe first, against the schema without the migration:** `unit/migration-replay.test.ts`'s Phase 123 tests failed with `1 anon can select on wallets` (and the before-case on the missing file). With the migration:
  - the probe passes before it (applying it) and after it (against all 21 files), and leaves the catalog as it was;
  - the negative control (`applied: true` without the file) still fails with `anon can select on wallets`;
  - the replayed catalog has `none` for `anon` on all eight tables and `SELECT,INSERT,UPDATE,DELETE` for `authenticated` on the six.
- **The probe:**
  - section 1 checks the grants on every table and that the advisor's count stays ten;
  - section 2, as `anon`, gets 42501 on a select from each of the six tables and on an insert;
  - section 3, as a signed-in user, reads only that user's own two wallets, renames one, writes and deletes a diary entry, cannot rename the other user's wallet, gets 42501 on `TRUNCATE`, and moves money through `transfer_funds`.
- **Replay:** `npm run schema:drift` replays 21 migrations; the expected rows are unchanged except the 21st history row (12 table-grant rows change detail, not count).
- **Gate:** lint clean (`workflow-hardening` 12/12 on the new pins); unit 1364/1364 in 61 files (63 s), shuffled 1364/1364 (seed `1791586917386`); Playwright 486 passed, 6 skipped, 0 failed of 492 (9.6 m, 4 workers), first run. The new pins run for the first time on the pull request's CI.

## Consequences

- **What a client role can do on every table is now stated in a migration, not inherited.** The default privileges still grant all seven to both roles on a new table; the rule in `CLAUDE.md` covers it.
- **The owner applies the migration** in the SQL editor: probe inside `BEGIN ... ROLLBACK` first, then the file, then `npm run migration:print-history -- supabase/migrations/20261010_phase123_revoke_client_table_grants.sql` printed at that moment and run in the same tab. Then a drift run.
- **No dashboard item is open.** The minimum is set, and leaked-password protection is a recorded tier constraint.

## Release

- **Before the merge:** the drift run on the branch with the migration not yet applied (`38003343769`) reported 25 rows, the twelve changed table grants from both sides and the missing history row, and nothing else. The owner then ran the probe, applied the migration in the SQL editor and recorded its history row (`20261009234928`, `owner, SQL editor`); the drift run after it (`38006352360`) found no drift, 21 migrations, as `schema_drift_reader`.
- **Live, read back after the merge (read-only):** `anon` holds no privilege on the six ledger tables; `authenticated` holds `SELECT`, `INSERT`, `UPDATE` and `DELETE`; the history has 21 rows.
- **Merge:** PR #74 merged into `main` as `baf2ab0`. The pull request's CI (run `38003343050`) passed every job on the new action pins.
- **Production:** GitHub deployment `6973360117` on `baf2ab0` completed; it serves `index-B8wLrv24.js`, Phase 121's entry, as no `src/` file changed, and a guest `POST {}` to `/api/classify` answers 400 from `icn1`.
- **`main` CI on the merge** (run `38006417250`, 5 m 33 s) passed every job on its first attempt: unit in order and shuffled (seed `1791589931102`); E2E 486 passed, 6 skipped, none failed or flaky.
