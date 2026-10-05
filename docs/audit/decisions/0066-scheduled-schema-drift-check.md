# 0066: A weekly job compares the live schema with the migrations, as a read-only role; the cold token check is closed

**Status:** Accepted. Implemented on branch `phase-90-scheduled-schema-drift`, draft PR. Not merged yet. **The workflow checks nothing until the owner creates the role and the secret** (see "Order of release").
- **Amends** ADR `0063`: the drift check also runs on a schedule, over a connection.
- **Amends** ADRs `0064` and `0065`: no more work on the cold token check (decision 4).

**Date:** 2026-10-05

## Context

**The drift check runs only when someone runs it.** Since Phase 87 (ADR `0063`), `npm run schema:drift` prints a read-only query, and someone pastes it into the SQL editor or MCP's `execute_sql`. It ran at every release of Phases 87, 88 and 89, and never in between.

**The live schema has changed outside the migrations before:**
- the original schema was built in the dashboard;
- Phase 64's cleanup and Phase 73's quota were run in the SQL editor with no history row;
- the two Phase 88 migrations were applied the same way, their rows written by hand.

Nothing would notice a dashboard change made between releases until the next one.

**Running it automatically needs a database login.** The admin login (`postgres`) can read and write every row of every account's ledger. A job that runs weekly, on a public repository's CI, should hold a credential that can read only the catalog.

## Decision

### 1. `schema_drift_reader`, a role that reads the catalog and nothing else

`supabase/ops/20261005_phase90_schema_drift_reader.sql` creates it. It is not a migration: a role belongs to the cluster, and nothing it creates is a row of `supabase/catalog.sql`, so the drift check does not see it.

**What it has:**
- **`LOGIN`, no password.** The owner sets the password in the SQL editor; it is never in the repo.
- **`USAGE` on the schemas `public` and `extensions`.** This is for name lookup only. Without it PostgreSQL skips those schemas in the search path, and prints `extensions.uuid_generate_v4()` and `public.categories(id)` where the catalog has the short names. The check would then report every such row as drift; the unit suite shows it. `USAGE` reads no row of any table.
- **`USAGE` on `supabase_migrations` and `SELECT` on `schema_migrations`:** the history.
- **The system catalogs,** which every role can read in PostgreSQL.

**What it lacks:**
- no grant on any app table or function. On live, `PUBLIC` holds no privilege on any table or function in `public` (read-only check, 2026-10-05), so the role inherits none;
- `nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls`;
- `connection limit 2`.

**Defaults when it logs in:** `default_transaction_read_only = on`, `statement_timeout = 30s`, `idle_in_transaction_session_timeout = 60s`.

**It is idempotent,** and its header says how to remove it.

### 2. `npm run schema:drift` compares live itself when given a connection

**With `SUPABASE_DRIFT_DB_URL` set,** it replays the migrations, connects with node-postgres (`pg`, a new devDependency used by tooling only) and runs the comparison. It exits:

| Exit | Meaning |
|---|---|
| 0 | No drift. |
| 1 | Drift: rows only in the repo or only in the database. An unrecorded migration is one of them. |
| 2 | Not checked: no connection, a credential that can reach app data, or a query that failed. Never reported as no drift. |

**Without the URL it prints the SQL-editor query, as before** (byte-identical). `--live` makes a missing URL exit 2, so the workflow can never pass for lack of its secret.

**One read-only transaction, rolled back:**
- `begin read only`, the catalog's search path, and a 30 s statement timeout.
- **A check that the transaction is read-only**, then a check that the connected role is not a superuser, does not bypass row-level security and can reach no table in `public`. Otherwise it exits 2 and names `schema_drift_reader`. The secret cannot be a copy of the admin login.
- **The comparison is `buildDriftQuery()`:** one SELECT with the catalog as a CTE and the expected rows as a parameter. A read-only transaction refuses any `CREATE`, the SQL editor's temporary view included. Both forms share the comparison text and the catalog's SELECT (`catalogSelect()` lifts it out of `supabase/catalog.sql`), and they return the same rows.

**TLS is always checked.** The URL's `ssl*` parameters are dropped, so the URL cannot turn verification off. The certificate is checked against `SUPABASE_DRIFT_DB_CA` (the project's CA, PEM) when set, and the system's CAs otherwise. A connection that fails says why.

**The report:**
- **Log:** one line per drift row.
- **Job summary** (`GITHUB_STEP_SUMMARY`): a table per kind (migrations, live, only in the repo, only live), each differing row, and what to do. A missing history row is recorded with `npm run migration:print-history` (ADR `0065`); anything else is a change to bring back into a migration file (ADR `0063`).

### 3. `.github/workflows/schema-drift.yml`, weekly and by hand

- **When:** Mondays at 02:17 UTC (09:17 in Bangkok), and `workflow_dispatch`. Not on pushes or pull requests: a pull request from a fork gets no secrets, and the check is about live, not the branch.
- **Settings:** `contents: read` only, a 10-minute limit, and one run at a time.
- **Steps:** `npm ci`, then `npm run schema:drift -- --live` with the secrets `SUPABASE_DRIFT_DB_URL` and `SUPABASE_DRIFT_DB_CA` (optional).
- **The repository is public, so its Actions logs and summaries are too.** They name schema objects: table, column, index and policy names, defaults, function body hashes. They never show a row of data. The live-only objects a run could name would also be public. The connection string is a secret, which GitHub masks.
- **GitHub turns off a public repository's scheduled workflows after 60 days with no commit.** A run started by hand still works.

### 4. The cold token check is closed (amends ADRs `0064` and `0065`)

After Phase 89, a new instance's first request waited 319 to 483 ms in `auth` (five samples, median 341 ms). The next function started on the same host waited 29 to 65 ms. A warm request waits under 1 ms.
- **The cost is the first connection from a new host to Supabase.** Vercel evaluates the module close to handing it its first request, so no change to when the module fetches can remove it (ADR `0065`).
- **It is the first request of each new instance only.** A warm instance's `auth` is under a millisecond, and its `ai` step (TypeSafe, about 196 ms, ADR `0051`) dominates.

**Rejected:**
- **Keep-warm traffic** (a scheduled request): it costs invocations, and only helps the instances it happens to reach.
- **A per-function region or memory change:** ADR `0051` set the region by measurement, and nothing suggests memory.
- **Caching keys outside the instance** (Edge Config, a KV store): another service, for a key set the instance already holds after one fetch.

**Reopen only if** a real signed-in request's `Server-Timing` shows a cold instance's `auth` plus `quota` as the larger part of what people wait for.

## Order of release (owner)

1. Merge. The workflow exists from then on; until step 4, a run fails with exit 2 ("needs `SUPABASE_DRIFT_DB_URL`").
2. **SQL editor:** run `supabase/ops/20261005_phase90_schema_drift_reader.sql`, then set a password:
   ```sql
   alter role schema_drift_reader with password '<from: openssl rand -hex 32>';
   ```
   A hex password needs no URL encoding.
3. **The connection string:** Dashboard > Connect > Session pooler, with the user `schema_drift_reader.<project ref>` and that password. GitHub's runners reach the pooler over IPv4; the direct host is IPv6 only.
4. **The secret:** GitHub > Settings > Secrets and variables > Actions > `SUPABASE_DRIFT_DB_URL`. Or, on the owner's machine: `gh secret set SUPABASE_DRIFT_DB_URL`.
5. **Actions > Schema drift > Run workflow.** Expected: "Schema drift: none", as `schema_drift_reader`. A certificate error means the pooler's certificate is not signed by a public CA. In that case, download the project's CA (Database settings > SSL configuration) and add it as `SUPABASE_DRIFT_DB_CA`.

## Verification

- **Unit, 997 in 37 files** (970 before). `unit/drift-runner.test.ts` (27) replays every migration into PGlite, records the history with the Phase 89 helper, and applies the role script. The runner then runs as `schema_drift_reader` (`SET ROLE` standing in for a login):
  - **The role:** its attributes and login defaults; the script is idempotent and adds nothing to the catalog.
  - **What it cannot do:** read a row of six app tables, write to the history, or call an app function.
  - **What it sees:** the catalog exactly as the admin login does; without `USAGE` on `extensions`, defaults print with the schema.
  - **Exit 0** on the matching database. **Exit 1** on a new index, a dropped policy and a deleted history row, each named in the summary with the per-kind counts, then 0 again after the repair.
  - **The same rows as the SQL-editor query.**
  - **Exit 2:** as the admin login, as the reader granted one app table, when the query fails, and when the connection is refused (real `pg`, on a local port that refuses). The password stays out of the log and the summary.
  - **`connectionConfig`:** drops `sslmode=no-verify` and every other `ssl*` parameter, always verifies, and refuses anything but `postgres://`.
  - **`--live` without the URL** exits 2 and prints nothing.
- **Negative controls,** each failing only its own tests:
  - no privilege check (2);
  - the role without `USAGE` (5);
  - the role granted every app table (11);
  - `--live` falling through to the print mode (1);
  - the `ssl*` parameters kept (1);
  - a failed query reported as clean (3);
  - a transaction that is not read-only (6).
- **The SQL-editor query** printed by `npm run schema:drift` is byte-identical to Phase 89's.
- **Lint** clean. **Playwright:** in the refactor log.
- **Not yet run against live:** the role and the secret come after the merge (release steps 2 to 5).

## Consequences

- **Drift is found within a week,** whoever caused it, without anyone remembering to look.
- **The job's credential can read the catalog and the history, nothing else.** The runner refuses one that can do more.
- **A failed run is either drift or "not checked",** never a silent pass.
- **The cold token check needs no further work** unless a signed-in measurement says otherwise.
