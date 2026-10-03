# 0024 — Real sessions, sign-out hygiene, directed adjustments and a ledger that explains every balance

**Status:** Accepted. **Amends** ADR `0023` (the ledger RPCs accept a signed ADJUSTMENT amount; `import_transactions` gains a per-row debt), ADR `0019` (the CSV gains a Debt column), and ADR `0008`/`0010` (an `AccountModal` joins the shell-level lazy modals; the Security tab leaves the tab bar). **Closes** the post-Phase-49 review's F5, F7 and F8. **Amended by** ADR `0048` (2026-10-03): the 3 production rows below are repaired, by intent rather than by the script here, which would have over-corrected one wallet by ฿920.00.
**Date:** 2026-09-28

## Context

Four findings, from reading the code and — read-only — the live project, shaped this phase.

### 1. The Security tab's sessions are fiction

"Active Authorized Sessions" were built in the browser: `initializeSessionList` read `pf_sessions` from `localStorage`, `detectCurrentDevice` guessed a device name from the user agent and set the IP to the literal `'127.0.0.1 (Current Client)'`, and "Revoke" stamped `revokedAt` on a local object. Nothing ever reached Supabase. A user who "revoked" a stolen laptop left it signed in.

`supabase-js` cannot list a user's sessions — the client only knows its own. The database can: `auth.sessions` holds `id, user_id, created_at, refreshed_at, not_after, user_agent, ip`, and every access token carries a `session_id` claim naming its row.

### 2. `handle_new_user` is callable by anyone

The `on_auth_user_created` trigger function is `SECURITY DEFINER`, has no `search_path`, and is executable by `PUBLIC`, `anon` and `authenticated` — so it is reachable as `/rest/v1/rpc/handle_new_user`. The advisors flag both (lints 0011 and 0028). The auth service's own role, `supabase_auth_admin`, holds EXECUTE **only through `PUBLIC`**, so a naive `revoke … from public` would also take it from the one role that should have it.

### 3. ADJUSTMENT has no direction — a live data bug

`WalletPopupModal`'s inline balance editor computed `diff = target - current` and wrote `amount: Math.abs(diff)` as an ADJUSTMENT. Every ledger path treats ADJUSTMENT as a credit, so **lowering a wallet from ฿5,000 to ฿4,000 raised it to ฿6,000**, under a row whose description read "Manual balance adjustment (-฿1,000.00)". The display compounded it: `TX_TYPE_META.ADJUSTMENT` hard-codes a minus glyph and a rose tint, so every *upward* adjustment rendered as a debit.

The live database holds **3** such rows, all undeleted (14 ADJUSTMENT rows in total). The same gap blocks F7: a credit card that opens owing ฿5,000 needs a negative opening row, and the type could not carry one.

### 4. F5, F7, F8 as they stand

- **F5 — sign-out leaves the ledger behind.** `signOut` reset `currentUser` and `isAuthenticated` and nothing else. Wallets, transactions, debts, diary and templates stayed in memory and in every `pf_*` key, so the next person to use the device as a guest saw the previous account's money. A device signed out *remotely* (token refresh failing after another device's "sign out others") did the same. And signing in silently overwrote a guest's own ledger with the account's.
- **F7 — balances the ledger cannot explain.** Signed in, `addWallet` inserted the wallet and then, as a second unchecked write, an "Initial balance setup" ADJUSTMENT — only when the balance was positive. A guest wallet got no row; a negative opening got none in either mode. Summing a wallet's ledger rows did not reproduce its balance.
- **F8 — CSV repayments pay nothing off.** The CSV had no debt column. An imported DEBT_REPAYMENT debited the wallet, linked no debt, never moved `remaining_amount`, bypassed ADR `0016`'s overpayment guard, and could not be reversed on delete because it named no debt. One such row is live.

## Decision: ADJUSTMENT is signed; every other type stays positive

An ADJUSTMENT's `amount` is the signed correction: positive raises the balance, negative lowers it, zero is rejected. Every other type keeps `amount > 0`.

This is the smallest change that gives the type a direction, because the arithmetic already supports it everywhere: the client computes `balance + amount` for ADJUSTMENT in `addTransaction`, `setTransactionDeleted` and `commitBulkImport`, and `_ledger_apply_effect` computes `balance + sign * amount`. What changes is only the validation that forbade the sign, at every layer that validates:

| Layer | Rule |
|---|---|
| `TransactionSchema` (Zod) | ADJUSTMENT: `amount ≠ 0`; others `> 0`; the max bound applies to `|amount|` |
| `record_transaction`, `import_transactions` | the same, raised as `22023` |
| CSV import | a negative amount is valid only on an ADJUSTMENT row |

`WalletPopupModal` writes the signed `diff`. The display derives ADJUSTMENT's glyph and tint from the amount's sign and formats `Math.abs(amount)` — `formatCurrencyAmount(-1000)` renders `฿-1,000.00`, so the sign must never reach the formatter. ADJUSTMENT was already excluded from every income, spending and insights figure, so a negative one distorts none of them.

Rejected: a new `ADJUSTMENT_DOWN` type (a `CHECK` constraint change plus every `Record<TransactionType, …>` in the app, for the same information a sign carries); blocking downward edits (leaves F7 unable to represent a credit card).

### The 3 production rows are reported, not repaired

An automatic repair — flip each row negative and take `2 × amount` off its wallet — is correct only if nobody re-corrected those wallets by hand after seeing the wrong balance, and the database cannot know that. The repair is therefore left to the account owner. **Run it only after this phase's migration is applied**, and only for rows you have confirmed were meant to lower the balance:

```sql
-- 1. Look first. Each row was written as a +amount but described as a decrease.
select t.id, t.wallet_id, t.amount, t.description, t.transaction_date, w.name, w.balance
  from public.transactions t
  join public.wallets w on w.id = t.wallet_id
 where t.type = 'ADJUSTMENT'
   and t.amount > 0
   and t.is_deleted = false
   and t.description like 'Manual balance adjustment (-%';

-- 2. Repair the ones you confirm, in one transaction. The wallet loses the
--    wrong credit AND gains the intended debit: 2 x amount.
begin;
with bad as (
  select id, wallet_id, amount
    from public.transactions
   where id in ( /* confirmed ids from step 1 */ )
     and type = 'ADJUSTMENT' and amount > 0 and is_deleted = false
)
update public.wallets w
   set balance = round(w.balance - 2 * b.total, 2), updated_at = now()
  from (select wallet_id, sum(amount) as total from bad group by wallet_id) b
 where w.id = b.wallet_id;
update public.transactions
   set amount = -amount, updated_at = now()
 where id in ( /* the same confirmed ids */ )
   and type = 'ADJUSTMENT' and amount > 0;
commit;
```

Row ids are deliberately not recorded here; the predicate in step 1 finds them.

**Repaired on 2026-10-03 (ADR `0048`).** The second of the two rows on one wallet was the owner re-correcting the first by hand, the case this section warns about, so it was soft-deleted instead of flipped; the other two were flipped. Step 1 now finds 0 rows.

## Decision: sessions come from `auth.sessions`, revocation from the official API

- **Listing** — a new read-only RPC, `list_my_sessions()`, `security definer`, granted to `authenticated` only. It returns `id, created_at, refreshed_at, not_after, user_agent, host(ip), is_current` for `user_id = auth.uid()`, where `is_current` compares the row id with the JWT's `session_id` claim. The client turns the user agent into a device label.
- **Revoking** — `supabase.auth.signOut({ scope: 'others' })` ("Sign out other devices") and `{ scope: 'global' }` ("Sign out everywhere"). Both are supported GoTrue operations.
- **No per-device revoke.** It would mean deleting rows from the `auth` schema, which Supabase manages and does not support writing to. An honest list with two coarse, working buttons replaces a fine-grained control that did nothing.
- **Retired** — `SessionDevice`, the `sessions`/`currentSession` state, `revokeSession`, `revokeAllOtherSessions`, `initializeSessionList`, `detectCurrentDevice`, and the `pf_sessions`/`pf_device_fingerprint` keys.

## Decision: `handle_new_user` is hardened without breaking sign-up

`alter function public.handle_new_user() set search_path = public, pg_temp`; `revoke execute … from public, anon, authenticated`; `grant execute … to supabase_auth_admin`. The explicit grant is load-bearing: that role had EXECUTE only through `PUBLIC`. The probe proves the trigger still creates a `profiles` row.

## Decision: sign-out leaves nothing behind (F5)

A provider-internal `resetToGuestState()` runs on an explicit sign-out **and** on an `onAuthStateChange` `SIGNED_OUT` event. In order:

1. **Drop the batched writer's pending writes.** They hold the signed-in ledger.
2. Remove `pf_wallets`, `pf_categories`, `pf_keywords`, `pf_presets`, `pf_transactions`, `pf_debts`, `pf_diary`, `pf_user`, `pf_sessions`, `pf_device_fingerprint`.
3. Reset every slice to the guest defaults a brand-new device sees.

*Corrected during implementation (Phase 52, T172).* This section first called step 1 the load-bearing one - "the 250 ms flush would otherwise write it straight back". A negative control disproved that: with step 1 removed, **no test failed**, because step 3's state changes schedule writes of the guest defaults over the same keys before the flush runs, and a later write to a key replaces the queued one. What keeps the account out of storage is steps 2 and 3 together. Step 1 stays as defence in depth for the window before step 3's effects run (a `pagehide` flush landing in between). A separate guard does carry real weight and was added: an `authEpochRef`, checked after every read in `loadSupabaseData`, stops a cloud load that was in flight at sign-out from landing the account's rows in guest state - its control failed exactly its own test.

**Templates are cleared too.** They never sync — no `presets` table exists — so this deletes them for good; the sign-out confirmation says so. Their amounts and descriptions are financial data, and a shared device is exactly the case F5 is about.

**Guest data at sign-in: warn, never merge.** When the guest ledger holds transactions, `AuthModal` shows how many will be replaced by the account's data and offers an Export CSV button (the existing exporter). Merging guest data into an account is a separate feature — id remapping, duplicate handling — and is not attempted.

## Decision: every user-created wallet opens with a ledger row (F7)

- **Signed in** — a new RPC, `create_wallet(p_name, p_type, p_currency, p_color, p_icon, p_opening_balance, p_idempotency_key)`, inserts the wallet at balance 0 and, for a non-zero opening, records an ADJUSTMENT "Opening balance" of the signed amount through `_ledger_apply_effect`, in one transaction. It replays on the key. `AddWalletForm` arms the key per form, reuses it on retry and rotates it on success — the transfer form's pattern.
- **Guest** — the wallet is created with its opening balance and one local ADJUSTMENT row of the same signed amount; no row for zero.
- **Missing function** — the old insert, then the opening row, now checked and compensated.
- **Starter wallets are exempt, by decision.** The guest `DEFAULT_STARTER_WALLETS` and the signed-in `seedInitialUserAccount` wallets are demo fixtures the app provides, not money a user entered, and a fresh context with no transactions is what `tests/helpers.ts` and the suite rely on. The exemption is recorded in the helper's comment and here.
  - **Amended by ADR `0040`:** the starter wallets open at ฿0.00, so they write no opening row under the rule as written, and the exemption no longer has anything to exempt.

## Decision: a CSV repayment names its debt (F8)

- **Export** gains a `Debt` column holding the debt's name.
- **Import** resolves `Debt` (or `DebtName`) against live debts, case-insensitively. A DEBT_REPAYMENT row with no debt, an unknown one or an ambiguous name is invalid in the preview, with a reason.
- **Commit** — signed in, each row's `debt_id` goes to `import_transactions`, which locks the debts (after the wallets, in id order), applies a **per-debt aggregate guard** — a batch's repayments to one debt may not exceed its remainder — and decrements through the helper. The guest path applies the same guard and decrement. A delete or restore then moves the debt, because the row now names it.
- **Server leniency, on purpose** — `import_transactions` still accepts a DEBT_REPAYMENT with a null `debt_id` (wallet only), so a cached older PWA bundle keeps importing until it updates. The new client never sends one.

## Decision: Security becomes an Account modal; mobile gets five slots

- **`AccountModal`** (shared `Modal`, shell-level, `React.lazy` + a `hasOpened` latch per ADR `0010`, self-subscribing) holds sync status, sessions, profile, password and sign-out. The navbar's signed-in pill opens it (`#navbar-account-btn`); `#navbar-signout-btn` lives inside it. `'security'` leaves `ActiveTab`, the swipe order and both tab bars; no spec referenced `#nav-tab-security`.
- **Mobile bottom nav** — Home · Transactions · centre Quick Add · Wallets · More. More opens a bottom sheet with Debts, Diary, Categories and Account & Security. The moved tabs keep their `mobile-nav-tab-*` ids and `aria-current`; every desktop `#nav-tab-*` except security is unchanged.
- **Swipe guard** — a swipe that starts inside a horizontal scroller (computed `overflow-x: auto|scroll` with overflowing content, found by walking up to `<main>`) does not change tabs. A computed-style check rather than a per-table flag, so a future scroller is covered without remembering to mark it.

*Recorded during implementation (Phase 52, T175).* The planned end-to-end test of the guard was written and dropped. A Chromium touch swipe synthesised through the DevTools protocol that starts inside an overflowing scroller is consumed by the browser's own scrolling and never completes as a swipe - two controls with the guard removed both passed - so the reported conflict does not reproduce there and any such test passes vacuously. The guard is covered by `unit/swipe-guard.test.ts` only; whether it changes anything on real iOS or Android touch hardware is **unverified**.

## Migration strategy

`supabase/migrations/20260928_phase52_security_ledger.sql`, following ADR `0023`'s protocol:

1. **Re-created functions start from the deployed bodies.** `record_transaction` and `import_transactions` are fetched from the live database and their md5s checked against `20260927_ledger_rpcs.sql` before editing, so nothing Phase 51 shipped is silently lost.
2. **Probe before apply** — `supabase/tests/20260928_phase52.probe.sql` runs the migration and its assertions inside `BEGIN … ROLLBACK`. Phase 51's probe runs too, unchanged.
3. **Apply only with explicit confirmation**, then byte-compare every deployed body against the file, re-run both probes against the deployed functions, and re-read the advisors.
4. **Deploy the frontend after.** Every new call has a missing-function fallback (`create_wallet` → the legacy insert; `list_my_sessions` → "session list unavailable"; a row `debt_id` is ignored by the old function), so the wrong order degrades rather than breaks.

## Consequences

- A lowered balance is lowered. A credit card can open negative. Summing a user-created wallet's live rows reproduces its balance.
- The session list is true, and the buttons under it work.
- A shared device keeps no trace of an account after sign-out — including templates, which cannot be recovered.
- The CSV round-trips repayments with their debts.
- New surfaces carry new tests: `unit/csv-exchange.test.ts`, `unit/user-agent.test.ts`, a swipe-guard test, additions to both ledger harnesses, and a new Playwright spec, `tests/account-and-mobile-nav.spec.ts`, which intercepts no requests. No existing spec is edited.
- Deferred, by name: lazy-loading `@supabase/supabase-js` (Phase 53); merging guest data; per-device revoke; repairing the 3 production rows (the query is above); leaked-password protection, which is a dashboard setting.

## Amendment (2026-09-27): a revoked device evicts itself within a minute

**Found in manual testing.** "Sign out other devices" on a desktop left a phone signed in and working.

**The server did its part.** The auth log shows `POST /logout` answering 204, and a refresh with a revoked token 25 s later refused with `400 Refresh Token Not Found`. But revocation reaches **refresh tokens only**. An access token is a JWT that PostgREST and Realtime check by signature and expiry alone, and this project's tokens live an hour (the same log shows refreshes ~59 minutes apart). supabase-js notices only at its next refresh. So a revoked device went on reading and writing the account for up to an hour. This ADR's line "those devices find out on their next token refresh" was accurate; the delay was the defect.

**Decision: the provider asks the auth server.** `auth.getUser()` is the one client call that checks the session itself: GoTrue answers `session_not_found` for a revoked `session_id`. `verifySession` runs it:

- **When.** On every ADR 0023 reconnection trigger (`online`, becoming visible, the channel resubscribing), on window `focus`, once when the signed-in effect mounts (a PWA reopened after revocation), every 60 s while the page is visible, and after any 401 from the Data API. One check runs at a time. Focus and visibility skip a check made in the last 10 s.
- **A rejected session signs this device out.** That means `AuthSessionMissingError`, or an `AuthApiError` that is a 401 or 403 or carries `refresh_token_not_found`/`refresh_token_already_used`. The device signs out locally and `resetToGuestState` clears it. On `session_not_found` supabase-js has already dropped the session and emitted `SIGNED_OUT` (auth-js `_getUser` → `_removeSession`), so F5's handler has run and the provider's epoch check stops it signing out a second time.
- **No answer keeps the session.** That covers offline and 5xx (`AuthRetryableFetchError`) and 429. Clearing a device's ledger because the network blinked would be worse than a late eviction.

**A Data API 401 prompts a check; it does not sign out.** The request was for a 401 to sign the device out at once. Instead it runs `verifySession`, which signs out in one round trip if the session is really gone. A 401 also happens when a token expires in transit, and signing out then would wipe the device on a race, not a revocation. The signal comes from a fetch wrapper in `src/lib/supabase.ts` (`onDataApiUnauthorized`): every table call and RPC goes through the client's fetch, so no call site is touched. It reports `/rest/v1/` 401s only, because the auth endpoints handle their own.

**Residual.**
- A device on screen is evicted within 60 s. A backgrounded one is evicted as soon as it is looked at, but until then its realtime channel can still pull the account's changes into memory.
- Instant eviction would need the revoking device to push a message, for example a Realtime broadcast on a per-user topic. That is not built.
- Neither this amendment nor the fix has been exercised against a real second device. Everything above is from the library source, the auth log and the unit tests.

**Tests.**
- **`authenticated-ledger.test.tsx`, 14 tests, all red first:**
  - each trigger;
  - a cold start;
  - `user_not_found`;
  - a 401 both ways;
  - three no-answer cases;
  - the 10 s gap;
  - no checks once signed out.
- **`unit/supabase-client.test.ts` (new), 7 tests:** they drive the real client over a stubbed `fetch`, because the harness mocks that module out.
- **Controls:** every piece has a negative control that fails its own test. There are 12 in all:
  - 10 on the provider;
  - 2 on the wrapper: the path filter, and 401-only.
