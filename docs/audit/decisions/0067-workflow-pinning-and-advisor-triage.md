# 0067: Workflows pin every action to a commit and grant each job only `contents: read`; the Supabase advisors are triaged

**Status:** Accepted. Implemented on branch `phase-91-workflow-hardening-and-advisors` (commit `64bd024`, docs `d30a759`), draft PR #41. Not merged yet.
- **Amends** ADR `0044`, the Playwright workflow's container and actions.
- **Amends** ADR `0066`: the drift workflow is held to the same rules, and its first runs are recorded.

**Date:** 2026-10-05

## Context

**Every action was referenced by a tag** (`actions/checkout@v5` and so on). A tag can be moved to any commit by whoever controls the action's repository, or by an attacker who gains that control. Each run then executes whatever the tag points to that day. Since Phase 90 one of these workflows holds a database credential, `SUPABASE_DRIFT_DB_URL`.

**`playwright.yml` declared no permissions.** Its jobs got the repository's default token permissions, which are set outside the repo and can be read-write. `actions/checkout` also leaves that token in `.git/config` for the rest of the job by default.

**Supabase's advisors had not been reviewed** in recent phases.

**The drift check's first live runs (ADR `0066`), all three started by hand, 2026-10-05:**
1. `37313599877`: "not checked: no connection (password authentication failed for user "schema_drift_reader")";
2. `37314039789`: "not checked: the check failed (permission denied for schema supabase_migrations)";
3. `37314271932`: "no drift. Live matches all 15 migrations (as schema_drift_reader)".

Each setup problem was reported as "not checked" (exit 2), never as a pass, as designed. The second run shows the role on live lacked `USAGE` on `supabase_migrations`, which the owner then granted. The repo's script has carried that grant since `edb8109` (its line 60), so the copy that ran must have lacked it. A read-only look after the third run found the live role matching the script, except for one of its three login settings: `idle_in_transaction_session_timeout = '60s'` is missing. That does not affect the check: the runner rolls its transaction back at once, and a role setting is not a row of the drift catalog.

## Decision

### 1. Every action is pinned to the commit its tag pointed to on 2026-10-05

| Action | Was | Commit | Release |
|---|---|---|---|
| `actions/checkout` | `@v5` | `fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09` | v5.1.0 |
| `actions/setup-node` | `@v5` | `a0853c24544627f65ddf259abe73b1d18a591444` | v5.0.0 |
| `actions/upload-artifact` | `@v7` | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` | v7.0.1 |
| `actions/download-artifact` | `@v8` | `3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c` | v8.0.1 |

- **The same code runs as before.** Each commit is the one its major tag resolved to when pinned, read through the GitHub API, with an annotated tag dereferenced to its commit. The comment names the exact release on that commit.
- **Newer majors exist** (`checkout` v7.0.1, `setup-node` v7.0.0). Moving to them is a change of behaviour, for its own phase.
- **To update a pin:** run `gh api repos/<owner>/<action>/git/ref/tags/<tag>`. When `object.type` is `tag`, follow it with `gh api repos/<owner>/<action>/git/tags/<sha>`. Then replace both the hash and the comment.

### 2. No token permission by default; each job gets `contents: read`

- **Both workflows** set `permissions: {}` at the top, and every job declares `permissions: contents: read`, for the checkout. Nothing else is needed: artifact upload and download within a run, and the npm cache, use the run's own runtime token, not `GITHUB_TOKEN`.
- **Every checkout sets `persist-credentials: false`:** nothing pushes, so the token is not left on disk for later steps.

### 3. `unit/workflow-hardening.test.ts` holds every workflow to these rules

It checks every file in `.github/workflows/`, so a new workflow is held to the rules from its first commit:
- every `uses:` is a 40-character commit with a `# vX.Y.Z` comment;
- `permissions: {}` at the top;
- each job declares exactly `contents: read`;
- every checkout sets `persist-credentials: false`;
- no `pull_request_target`, which runs a fork's change with this repository's secrets;
- secrets appear only in the drift workflow, and only its two.

It reads lines rather than parsing YAML, since the repository has no YAML parser and a dependency for one test is not worth it.

### 4. The Playwright container image stays on its version tag (accepted)

`mcr.microsoft.com/playwright:v1.63.0-noble` is Microsoft's image for that release, and the workflow already fails when it differs from the lockfile's Playwright (ADR `0044`). Pinning it by digest as well would make every Playwright update three coupled edits. The jobs that run in it hold no secret and a read-only token. Revisit if a secret ever reaches those jobs.

### 5. The advisors, triaged (read-only, 2026-10-05)

**Security:** 3 lints, 11 findings.

| # | Lint (level) | Finding | Decision |
|---|---|---|---|
| S1 | Leaked password protection disabled (WARN) | Supabase Auth does not check new passwords against HaveIBeenPwned. | **Owner: turn it on**, in Authentication settings, if the project's plan offers it. A dashboard setting, not code. Until then sign-up accepts a breached password. |
| S2 | Signed-in users can execute a SECURITY DEFINER function (WARN) | 9 functions: `consume_ai_quota`, `create_wallet`, `import_transactions`, `list_my_sessions`, `record_transaction`, `seed_starter_account`, `set_transaction_deleted`, `transfer_funds`, `update_transaction`. | **Accept: they are the API.** Each must run as its owner to lock rows and apply relative updates across tables under row-level security in one transaction (ADR `0023`), to read `auth.sessions` (ADR `0024`), or to count in a table clients cannot touch (ADR `0049`). Each takes the user from `auth.uid()` and filters by owner; `anon` cannot execute any of them; the private `_ledger_*` helpers are revoked from every client role. |
| S2a | (same) | `transfer_funds` alone takes a `p_user_id` argument, against ADR `0023`'s rule. | **Accept, schedule the clean-up.** Checked: it refuses a signed-in caller whose `auth.uid()` is not `p_user_id`, and wallets not owned by `p_user_id` (lines 87, 145, 150 of its migration). The check is skipped only without a user, which `anon` cannot reach and `service_role` is trusted for. Removing the argument changes the function's signature and the client's call together. Low priority. |
| S3 | RLS enabled, no policy (INFO) | `public.ai_request_counts` | **Accept: by design** (ADR `0049`). No client may read or write it; only `consume_ai_quota()` does. |

**Performance:** 3 lints, 10 findings.

| # | Lint (level) | Finding | Decision |
|---|---|---|---|
| P1 | Multiple permissive policies (WARN) | `categories` and `keyword_rules`: two SELECT policies for `authenticated`, "manage their own" (ALL) and "view system and their own" (`user_id is null or own`). | **Schedule a migration** to drop the two "view system" policies. Live has no row with `user_id is null` in either table (0 of 20 and 0 of 5): starter rows are per account (ADR `0039`). So the second policy shows nothing the first does not, and costs a second check on every row read. Drift then expects 7 policies, not 9. It needs a probe and the owner's apply, like any migration. |
| P2 | Unindexed foreign keys (INFO) | `keyword_rules.category_id`; `transactions.category_id`, `debt_id`, `destination_wallet_id`, `wallet_id`. | **Accept, with a trigger.** An index on a foreign key serves deletes of the parent and queries by that column. The app soft-deletes every financial record, so a parent row is deleted only when an account is (cascading from `auth.users`). Every read filters by `user_id` first (`transactions_user_date_idx`). With 103 transactions, five more indexes would add write cost to every ledger RPC for nothing measurable. **Revisit** when a hard delete of a wallet, category or debt, an in-app account deletion, or a query by one of these columns appears. |
| P3 | Unused indexes (INFO) | `debts_user_created_idx`, `diary_entries_user_date_idx`, `keyword_rules_user_idx`. | **Accept.** The tables are a handful of rows, where the planner rightly scans instead. Each index matches the load's own filter and order (`user_id`, then date or creation), so it serves those reads once a table grows. Dropping one is a migration for no gain now. |

**Nothing needs fixing in the database now.** S1 is the owner's switch; P1 and S2a are migrations for a later phase.

## Verification

- **`unit/workflow-hardening.test.ts`, 12 tests:**
  - **Against the old workflows,** 8 fail: the four rules, in each file.
  - **Negative controls on the new ones,** each failing exactly its own test: one action back on a tag; a pin without its release comment; a job asking for `actions: write`; a checkout keeping its credentials; `pull_request_target`; a secret in the Playwright workflow.
- **Unit 1009 in 38 files** (997 before). Lint clean. **Playwright:** in the refactor log.
- **On CI:** the pull request's run `37316574331` passed every job, 445 passed and 2 skipped with no flaky test, every action fetched by its commit (24 downloads); the drift workflow, started by hand on this branch (`37316584371`), ran its pinned actions and found no drift as `schema_drift_reader`, in 31 s.
- **Drift:** `npm run schema:drift` is unchanged (no migration). Live was compared read-only: see the refactor log.

## Consequences

- **A moved tag cannot change what CI runs;** updating an action is a reviewed change to a hash.
- **A job's token can read the repository and nothing else,** and does not stay on disk.
- **Every advisor finding has a decision, and each "accept" a reason** to check when the facts change.
- **Owner:** turn on leaked password protection, if the plan allows. Optionally, add the missing login setting: `alter role schema_drift_reader set idle_in_transaction_session_timeout = '60s';`.
