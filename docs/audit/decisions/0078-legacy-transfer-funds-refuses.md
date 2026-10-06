# 0078: The 20260909 `transfer_funds` signature refuses every call, now, rather than being dropped

**Status:** Accepted. Implemented on branch `phase-102-deprecate-legacy-transfer` (code `0b036d4`, docs `0871b15`, probe fix `f23832c`), draft PR #53. Not merged yet, and **not applied to live yet**: the owner applies the migration. The client does not change.
- **Amends** ADR `0069`, whose decision 4 said a later phase drops the 20260909 signature: this phase refuses with it first, and the drop waits.
- **Amends** ADR `0067`'s advisor triage (and ADR `0074`'s count): ten `SECURITY DEFINER` functions, one signature each, not eleven signatures.

**Date:** 2026-10-06

## Context

1. **Two `transfer_funds` signatures since Phase 93.** The client calls the one that reads the user from the session. The 20260909 one, which takes `p_user_id`, stayed for builds cached before Phase 93 (a PWA runs its cached build until it reloads). It is `SECURITY DEFINER` and executable by `authenticated`, so the advisor lists it (S2a).
2. **A drop is not safe for those builds.** A dropped function answers `PGRST202`. Every client since 20260909 reads that as "migration not applied" and takes the legacy transfer: three separate writes, not atomic (ADR `0069`, Context).
3. **Nothing can count the old builds' calls.** Read on live on 2026-10-06: `track_functions` is `none`, so `pg_stat_user_functions` has no calls for either signature, and the API logs record `/rpc/transfer_funds` without the argument names that choose one. The plan had been to wait a week (to about 2026-10-13) and drop.
4. **What an old build does with any other error.** Read in its `FinanceContext.tsx` (`main` at `f44d3e4`, Phase 92's release, the last before Phase 93):
   - `isMissingRpcError` matches only `42883`, `PGRST202`, or a message containing "could not find the function";
   - any other error is thrown; the catch restores the optimistic wallets, debts and transactions; nothing remote was written yet, so there is nothing to compensate;
   - the result is `{ success: false, error: message }`, which the transfer form shows.

   An error with a SQLSTATE (`P0001`) is also not an unknown outcome there (`isUnknownOutcomeError` is "no code").
5. **The owner's decisions** (2026-10-06): refuse first, drop later (Option B); then to do it now, without waiting for 2026-10-13, since a refusal cannot send a build down the legacy path at any point.

## Decision

`supabase/migrations/20261006_phase102_deprecate_legacy_transfer_funds.sql` re-creates the 20260909 signature:
- **Same name, parameters, defaults and return type (`jsonb`)**, so an old build's call still resolves to it and is not answered `PGRST202`.
- **Body:** `raise exception 'OUTDATED_CLIENT: Please reload the app to continue.';`, the owner's wording, which is `P0001`. An old build shows this text as it is, prefix included.
- **`SECURITY INVOKER`, `search_path = ''`:** it reads nothing, so it needs neither the owner's rights nor a search path. That takes it off the advisor's list.
- **Grants restated as they were:** `authenticated` and `service_role` execute, `public` and `anon` do not. Without `authenticated`, an old build would get `42501` instead of the message.

The session signature is untouched: its body's md5 with carriage returns removed (as `supabase/catalog.sql` hashes it) is `03b469921a7c0d01909608cb8c6a53d7` on live and in a replay, and the probe pins it.

**The file name** is the one the owner gave. It sorts before `20261006_phase93_*` and `_phase96_*` (`1` before `9`), which is harmless: Phase 93 creates only the session signature and Phase 96 does not touch `transfer_funds`, so a replay ends in the same state in either order. The history records it by name, at its apply time.

**Dropping the signature** waits until no build from before Phase 93 can still be running, since the drop brings back `PGRST202` for one. Nothing measures that (Context 3), so it is a judgement for a later phase.

## Verification

- **Live, read-only, before writing anything:** both signatures' arguments, return type, `prosecdef`, `proconfig`, grants and owner. Their bodies' md5 (raw: `8b900ec3…` for 20260909, `0f4ef840…` for the session one) equal a PGlite replay of the repo's 18 migrations from this Windows checkout. Live's bodies hold carriage returns, so a Linux replay matches only without them, as the drift check compares. Eleven `SECURITY DEFINER` signatures that `authenticated` may execute.
- **Replay:** with the migration, the 20260909 signature is `SECURITY INVOKER` with `search_path=""`, the session signature's md5 and grants are unchanged, and the count is ten.
- **Probe** `supabase/tests/20261006_phase102.probe.sql`, in `BEGIN ... ROLLBACK`, checks:
  1. both signatures' shape and grants, the session body's md5, and the advisor's count of ten;
  2. the old signature returns `P0001 OUTDATED_CLIENT: ...` for the caller's own transfer, for a call naming another account, and with no session, and moves nothing;
  3. the session signature still moves money, replays a retry, and refuses no session (`42501`), another account's wallet (`P0002`) and the same wallet (`22023`).
- **Unit** (`unit/migration-replay.test.ts`, +3):
  - the probe before the migration (applies, passes, rolls back);
  - after it, against every file;
  - against the pre-Phase 102 schema with the migration left out, where it must fail ("still security definer").

  The Phase 93 probe's after-run now uses the files up to Phase 102: its section 4 checks that the old signature still moves money, which this phase ends on purpose.
- **Controls on the migration** (each fails the Phase 102 test on its intended assertion):

  | Control | Fails with |
  |---|---|
  | drop the signature instead | "the 20260909 signature is gone: an old build would get PGRST202 and the legacy path" |
  | keep `SECURITY DEFINER` | "the old signature is still security definer" |
  | raise with `errcode = '42883'` | "the old signature did not refuse A's own transfer" |
  | revoke `authenticated` | "authenticated cannot call the old signature: an old build would get 42501, not the reload message" |

- **First CI run:** the probe pinned the raw md5, which CI's Linux checkout (LF) cannot match; both Phase 102 tests failed there and passed on Windows. The probe now hashes without carriage returns, like `catalog.sql`.
- **Gate:** in the refactor log.
- **On CI:** the pull request's first run (`37470255332`) failed two unit tests, the Phase 102 probe before and after, because it pinned the raw md5 of a body that holds carriage returns on Windows and live but not on CI's Linux checkout (T628); after the fix, run `37470710876` passed every job in 269 s, 468 passed and 6 skipped with no flaky test, unit 1080. Before the apply, the drift workflow on the branch (`37470252617`) reports exactly the three expected rows: the 20260909 signature as live has it (`security definer`, the old body), as the repo has it (`search_path=""`, the refusal), and the missing history row `phase102_deprecate_legacy_transfer_funds`.

## Consequences

- **A build from before Phase 93 can no longer transfer** until it reloads, and says so. Nothing else in it changes: its other writes use functions this phase does not touch.
- **The advisor lists ten `SECURITY DEFINER` functions**, one signature each, once the migration is applied.
- **Until it is applied,** live keeps the old body, and the weekly drift check reports this function's body and the missing history row: that is the expected drift, gone once the migration and its history row are in.
- **The drop stays open** (Decision, last paragraph).
