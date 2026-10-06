# 0069: The redundant SELECT policies are dropped; transfer_funds takes the user from the session, beside its old signature

**Status:** Accepted. Released: commit `2eeb20c`, docs `11b4f23`, hash backfill `28cc4e8`, merged into `main` as `4744845` (PR #43); Vercel `dpl_DvgAksLjtYP9hEQnPN3ZprPsPWcS` READY in `icn1`. Both migrations were applied to live by the owner before the merge (see "Release").
- **Amends** ADR `0063`: the baseline leaves out the two policies, as it already left out the one Phase 58s dropped, and the replay prelude gains a grant.
- **Amends** ADR `0067`: its two scheduled findings, P1 and S2a, are done.
- **Amends** ADR `0023`'s rule that the user comes from `auth.uid()` only, which `transfer_funds` (older than ADR `0023`) did not follow.
- **Amended by** ADR `0078`: the 20260909 signature is not dropped yet; it refuses every call (`OUTDATED_CLIENT`) and is `SECURITY INVOKER`, and the drop waits until no build from before this phase can be running.

**Date:** 2026-10-06

## Context

ADR `0067` triaged Supabase's advisors and scheduled two database changes:

1. **P1, multiple permissive policies.** `categories` and `keyword_rules` each have two SELECT policies for `authenticated`:
   - "manage their own" (`FOR ALL`, `auth.uid() = user_id`);
   - "view system and their own" (`user_id is null or auth.uid() = user_id`).

   Permissive policies are OR-ed, so every row read evaluates both. The second adds only rows with no owner. Read-only on live on 2026-10-06: there are none in either table. Starter categories are per account since Phase 64 (ADR `0039`).
2. **S2a, `transfer_funds(p_user_id, ...)`.** The 20260909 function takes the user as an argument and compares it with `auth.uid()`, skipping the comparison when there is no session. ADR `0067` read it and found no hole: a signed-in caller cannot name another account. But it is the one ledger RPC that does not take the user from the session alone, and it is older than ADR `0023`'s rule that it should.

## Decision

### 1. Drop the two "view system and their own" policies

- **`20261006_phase93_drop_redundant_select_policies.sql`:** `drop policy if exists` on each table.
- **Effect:** a signed-in user reads the rows "manage their own" gives them, which are the rows they read before. A row with no owner, if one were ever written, would be visible to no client.
- **The baseline no longer creates them.** ADR `0063`'s rule is that the baseline holds nothing a later file drops, so that running it again can never bring a dropped object back. It already left out Phase 58s's profiles policy for that reason. The baseline's policy loop loses its branch for ownerless rows, which only these two used.
- **Drift then expects 7 policies, not 9.**

### 2. A new `transfer_funds` overload without `p_user_id`; the old one stays for now

`20261006_phase93_transfer_funds_from_session.sql` creates `transfer_funds(p_source_wallet_id, p_dest_wallet_id, p_amount, p_idempotency_key, p_notes, p_date, p_raw_input, p_allow_negative)`:
- **The 20260909 body, with `p_user_id` replaced by `auth.uid()`.** Replay, locking in id order, the ownership checks, the currency check, relative updates and the unique-violation replay are unchanged.
- **No session is refused with 42501.** The old signature trusted a call without a session (a service-role caller); nothing in the app makes one, and the new signature has no such path.
- **`SECURITY DEFINER`, `search_path` pinned, executable by `authenticated`;** revoked from `public` and `anon`. `service_role` keeps Supabase's default grant, as every function here does, and is refused anyway (it has no session).

**Why an overload, not a replacement:** a client is a cached PWA, and an older build keeps calling the 20260909 signature with `p_user_id` until it reloads. Dropping that signature now would turn every such transfer into `PGRST202`, which the client reads as "migration not applied" and answers with the legacy non-atomic path (three table writes). So both signatures exist until a later phase drops the old one.

**PostgREST picks the overload by argument names.** The old signature has no default for `p_user_id`, so:
- a call that names `p_user_id` matches only the old one;
- a call without it matches only the new one.

**The client** (`FinanceContext.tsx`'s `addTransaction`) no longer sends `p_user_id`.

### 3. The replay prelude grants `USAGE` on the `auth` schema

The probe reads `categories` as `authenticated`, and the policies call `auth.uid()`. The prelude had never granted the API roles `USAGE` on `auth`, which live grants `anon`, `authenticated` and `service_role` (read 2026-10-06). It does now. No migration reads as an API role, so nothing else changes.

### 4. Tests derive their migration counts

`unit/drift-runner.test.ts` read "15" for the migration row of its summary. It now uses `migrationFiles().length`, so a new migration does not need that edit.

## Order of release

1. **Before the merge, the owner, in the SQL editor:**
   - (a) run the probe with both migrations inlined, inside its `BEGIN ... ROLLBACK`;
   - (b) apply `20261006_phase93_drop_redundant_select_policies.sql`, then its history row from `npm run migration:print-history -- <file>`, printed at that moment;
   - (c) the same for `20261006_phase93_transfer_funds_from_session.sql`;
   - (d) the probe again without its `\ir` lines.
2. **Then:** the drift workflow by hand, which must find no drift with 17 history rows.
3. **Then merge.** The new client calls the new overload.
   - Merged first, without the migration, the client gets `PGRST202` and takes the legacy non-atomic transfer path until the migration lands. The order matters.
   - Older builds keep the old signature, which still works.
4. **A later phase drops the 20260909 signature,** once older builds have had time to reload.

## Verification

- **`unit/migration-replay.test.ts`:**
  - 17 files, 7 policies, 16 functions.
  - The Phase 93 probe runs three ways: before its migrations, after them, and on the live shape, with both policies put back as the dashboard made them (9 policies before, both dropped by the migration). Each passes and leaves the catalog as it was.
  - **Negative controls:**
    - the new function without its no-session check fails "3 a call with no session was not refused";
    - the drop migration emptied, on the old baseline, fails "1 categories has another policy";
    - the drop emptied, on the live shape, fails the same.
- **The probe** (`supabase/tests/20261006_phase93.probe.sql`):
  - each table keeps only "manage their own", and live holds no ownerless row;
  - a signed-in user reads its own category and rule, and not an ownerless one;
  - both signatures exist; the new one is executable by `authenticated` only and is `SECURITY DEFINER` with a pinned `search_path`;
  - the new one refuses no session (42501), another account's wallet on either side (P0002), the same wallet and a zero amount (22023); it moves its own money (amount rounded to cents) and replays a retried key; balances and the one ledger row are checked afterwards;
  - the old signature still moves its caller's money and still refuses another account's id (42501).
- **`unit/authenticated-ledger.test.tsx`, +1:** a signed-in transfer sends exactly the new overload's seven arguments and no `p_user_id`, and the balances follow the server. Against the old client it fails on `"p_user_id": "user-test-1"`.
- **Drift:** the replay expects 75 columns, 28 constraints, 1 extension, 16 functions, 64 function grants, 17 indexes, 7 policies, 5 publication tables, 8 tables, 24 table grants, 2 triggers and 17 migrations. Live matches only after step 1.
- **Gate:** in the refactor log.
- **On CI:** the pull request's run `37378623941` passed every job in 299 s, 454 passed and 2 skipped with no flaky test, unit 1030.

## Release (2026-10-06)

- **Live, before the merge (T562):** the owner applied both migrations in the SQL editor, each with its printed history row, and the after-apply probe passed. The history has 17 rows; the two new ones are `phase93_drop_redundant_select_policies` at `20261005224522` and `phase93_transfer_funds_from_session` at `20261005224812` (UTC print times).
- **Drift:**
  - the workflow on the branch tip `28cc4e8` (run `37385081841`) found no drift with all 17 migrations, as `schema_drift_reader`;
  - one dispatched on the old `main` `f44d3e4` (run `37384933081`) reported 9 rows, all of them this phase (the new function, its 4 grants, the 2 history rows, the 2 dropped policies). That is the expected result of comparing a 15-file replay with a 17-migration live, not drift;
  - after the merge, the workflow on `main` `4744845` (run `37385367893`) found no drift with all 17 migrations.
- **Merge:** PR #43 merged into `main` as `4744845`, whose tree is identical to `28cc4e8`. Vercel `dpl_DvgAksLjtYP9hEQnPN3ZprPsPWcS` is READY in production (`icn1`). Its `index-DmMi73Ay.js` (190,069 B), `index-BsXfRZb2.css` (50,639 B) and the four vendor chunks are byte-identical to the local build of `main`. The shipped `transfer_funds` call names seven arguments and no `p_user_id`.
- **CI:** `main` CI on the merge (run `37385248145`) passed every job with no flaky test in 239 s end to end, 22 s of it the merge job (unit 1030; 152 tests per browser: 454 passed, 2 skipped).
- **Not exercised here:** a signed-in transfer on production (no session). The probe's after-apply run covers the function on live.

## Consequences

- **Every ledger RPC the current client calls takes the user from the session alone.**
- **A category or keyword rule row read is checked against one policy, not two.**
- **Two `transfer_funds` signatures exist until a later phase.** The advisor will keep listing the old one (S2a) until then.
- **The client's legacy transfer path is still the answer to a missing function,** so the order of release above is load-bearing.
