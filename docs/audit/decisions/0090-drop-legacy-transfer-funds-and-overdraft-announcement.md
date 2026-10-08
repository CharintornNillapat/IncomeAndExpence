# 0090: The 20260909 transfer_funds signature is dropped; a screen reader hears the overdraft warning

**Status:** Accepted. Draft PR; not merged. **The migration is not applied to live:** the owner chose to apply it with read-only checks after, and the apply was declined at the permission prompt, so it waits for the owner (see "Release").
- **Completes** ADR `0078`'s scheduled drop and ADR `0067`'s last scheduled finding (S2a).
- **Amends** ADR `0085`: the overdraft warning in the entry and transfer forms is announced.

**Date:** 2026-10-08

## Context

1. **The 20260909 `transfer_funds(p_user_id, ...)` signature.** Phase 93 (ADR `0069`) added the session signature and kept this one for builds cached before it. Phase 102 (ADR `0078`) made it raise `OUTDATED_CLIENT`, because a plain drop answers `PGRST202`, which a pre-Phase 93 build reads as "migration not applied" and answers with the legacy three-write transfer, which is not atomic. The drop was left for when no such build could still be running.
2. **The overdraft warning was silent to a screen reader.** It appears below the amount as plain text (ADR `0085`). A live region on it would speak on every keystroke, since its figure changes with the amount.

## Evidence for the drop (read on 2026-10-08, read-only)

- **The logs** (Supabase's log stream, one 24-hour query per day from 2026-10-06 00:00 UTC to now; every day had entries, so the stream was recording):
  - **No `OUTDATED_CLIENT`** in the Postgres logs. The only lines naming it are the Phase 102 migration and probe text, at 13:48 to 13:50 UTC on 2026-10-06.
  - **No call to `rpc/transfer_funds` at all** in the edge or PostgREST logs after one transfer at 11:43 UTC on 2026-10-06 (200), two hours before Phase 102 was applied. Neither signature has been called since.
- **The sessions** (counts and timestamps only): 3 accounts, 2 live sessions, both last seen after Phase 93's client was merged and deployed (2026-10-05 22:53 UTC): at 2026-10-06 11:27 and 2026-10-07 09:28. No signed-in device was last seen before it.
- **What it cannot show:** a tab left open since before 2026-10-05 22:53 UTC, or a guest on a pre-Phase 93 build who signs in later. Either would now get `PGRST202` and the legacy transfer, which still moves the right amounts unless a request fails midway. With one owner and two sessions, both seen since, that risk is accepted.
- **Live before the drop:** the old signature was the Phase 102 stub (`SECURITY INVOKER`, empty `search_path`); the session signature's body hash (carriage returns removed) was `03b469921a7c0d01909608cb8c6a53d7`, the one the probes pin; nothing depended on either.

## Decision

1. **`20261008_phase114_drop_legacy_transfer_funds.sql` drops the 20260909 signature,** by its full argument list and without `cascade`, so it fails if anything depends on it. The session signature is untouched; the client sends no `p_user_id` and needs no change, so the migration can be applied before or after the merge. Ten `SECURITY DEFINER` functions remain for the advisor, as since Phase 102.
2. **`OverdraftAnnouncer`** (`src/components/wallet/`), used by `TransactionForm` and `WalletTransferForm`, is an always-mounted `sr-only` polite status region (`role="status"`, `aria-atomic`, like the CSV import's announcer, ADR `0054`):
   - **Its text is set during render, only when the overdraft's key changes:** the paying wallet's id and balance, or none. So it speaks when the warning appears, when the wallet changes and when its balance does (a sync), and empties when the warning goes.
   - **A keystroke that only moves the amount changes nothing,** so nothing is announced. The region keeps the figure it was announced with; the visible warning shows the current one.
   - **Not a live region on the visible warning,** which would speak on every keystroke, and not an effect, which would set the text a render late (ADR `0055`).

## Not changed

- **The client's legacy transfer path for `PGRST202`** stays: it is the fallback for a project without the 20260909 migration.
- **The visible warnings** keep their text and test ids.

## Tests

- **`unit/migration-replay.test.ts`:** the Phase 114 probe before its migration (applies it, passes, rolls back), after it, and failing on the schema without it ("the 20260909 signature is still there"). The Phase 93 and 102 probes, which check the old signature, now run against the files up to Phase 114. The replay holds 20 migrations and 16 functions.
- **`supabase/tests/20261008_phase114.probe.sql`:** one `transfer_funds` left, its body, search path and grants unchanged, ten `SECURITY DEFINER` functions; a call naming `p_user_id` is 42883 (`PGRST202` through PostgREST) and moves nothing; the session signature moves money, replays a retry and refuses a call without a session or into another account's wallet.
- **`unit/overdraft-warning.test.tsx` (+2):** in each form the region is a polite status, empty until the warning appears, then names the wallet and figure; further keystrokes make no change to it (counted with a `MutationObserver`); a balance change re-announces with the new figure; a credit card or a smaller amount empties it. Both failed first (no region). Controls: with the amount in the key, both fail; without the balance, the sync check fails.
- **`tests/transfer-preview.spec.ts`:** the overdraft test reads the status region, types one more digit, and the region is unchanged while the visible warning moves.
- **Gate:** lint clean; unit 1301/1301 in 56 files; Playwright, first run 485 passed, 6 skipped, 1 failed of 492 (9.2 m), second run 484 passed, 6 skipped, 2 failed (15.7 m, traces on): all three a WebKit click waiting on "stable" in specs this phase does not change, none with a form open; the local replay of all 20 migrations is clean.
- **WebKit:** the three failures were each a click that waited 15 s for "stable" (ADR `0058`): the Dashboard wallet card (`wallets-page`), the navbar's Quick Add (`jev-classify`) and the Wallets tab (`soft-delete`), each before any form was open, so neither announcer was on the page. The two traces kept show 3 screencast frames, the last within a second of the click, then none. Repeats on WebKit: `wallets-page` 120 of 120; `jev-classify` and `soft-delete` 149 of 150, the one failure the Transactions page's Show deleted checkbox, which moved during the 200 ms tab slide ("element is not stable" twice) and then stalled, as ADR `0089` expected.
- **Bundle:** all app JS 882,669 / 267,804 to 883,188 / 268,070 B (+519 / +266 gzip), 40 files: the chunk the two forms share, named `InlineMathInput` before, is now named `OverdraftAnnouncer` and holds both (6,322 / 2,387 to 6,664 / 2,566); `TransactionForm` +81 / +39 and `TransferFundsModal` +84 / +28; the entry +3 / +6 (chunk names); cold start still three scripts.

## Release

- **The migration is not applied to live.** The owner chose to apply it and check with read-only queries after (a rolled-back probe on live was declined first); `apply_migration` was then declined at the permission prompt as well, so live still holds the Phase 102 stub, which refuses every call.
- **Until it is applied, the drift check reports the difference:** the 20260909 signature and its grants only in the database, and the `phase114_drop_legacy_transfer_funds` history row only in the repo. That is the whole of it; nothing else differs.
- **To apply it:** in the SQL editor, paste `supabase/migrations/20261008_phase114_drop_legacy_transfer_funds.sql`, run it, then run what `npm run migration:print-history -- supabase/migrations/20261008_phase114_drop_legacy_transfer_funds.sql` prints (ADR `0065`), and run the drift check from the Actions tab. Or `apply_migration` through the MCP with the name `phase114_drop_legacy_transfer_funds`. No client change depends on it, so before or after the merge both work; the weekly drift check fails from the merge until it is applied.
