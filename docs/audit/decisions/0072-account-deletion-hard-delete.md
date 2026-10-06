# 0072: Account deletion erases the whole account, the one hard delete

**Status:** Accepted. Implemented on branch `phase-96-pdpa-account-deletion`. Not merged yet. **The owner applies the migration before the merge** (see "Order of release").
- **Amends** the soft-delete rule (ADR `0016`, CLAUDE.md "Data Integrity"): an account's erasure deletes its rows for good.
- **Amends** ADR `0024`'s note that the app never writes to the `auth` schema: this one function deletes the caller's `auth.users` row.

**Date:** 2026-10-06

## Context

- **No way to erase an account.** A signed-in person could not erase their account. Everything in the ledger is soft-deleted (`is_deleted`) so history stays intact, which is right for a mistaken delete and wrong for a person who wants their data gone. Thailand's PDPA gives a data subject the right to have their personal data erased.
- **Where the personal data is:**
  - `auth.users` (the email and the sign-in);
  - `public.profiles` (the email and the display name, copied by `handle_new_user`);
  - the six ledger tables, which are the person's own records of their money, mood, workouts and meals;
  - `public.ai_request_counts` (the account id and its request counts);
  - `auth.sessions` (devices, IP addresses).
- **What live allows** (read-only, 2026-10-06):
  - every foreign key to `auth.users` cascades on delete, except `auth.scim_users`, which sets null;
  - `postgres`, which owns the app's functions, holds `DELETE` on `auth.users`;
  - `auth.audit_log_entries` is empty, with no foreign key: Supabase keeps auth logs outside the database.

**The owner's decision:** delete the whole account, sign-in included, not only the app's rows. Leaving `auth.users` and `profiles` would keep the email and name, let the person sign in to an empty account, and make `seed_starter_account()` seed it again, since no wallet row would remain.

## Decision

### 1. `delete_user_account(p_confirm text)`

`20261006_phase96_delete_user_account.sql`:
- **What it runs:** a `SECURITY DEFINER` function, `search_path` pinned, executable by `authenticated` only. It does `delete from auth.users where id = auth.uid()`.
- **The cascade does the rest, in the same transaction:**
  - wallets, and transactions through them;
  - debts, categories, keyword rules and diary entries;
  - profiles and the AI quota row;
  - in `auth`, sessions, identities, MFA factors and one-time tokens.
- **Every device's session ends:** each refresh token is gone, and the next `getUser()` on another device is rejected, which signs it out (ADR `0024`).
- **Soft-deleted rows go too.** Erasure is of the account, not of what was visible.
- **Guards:**
  - **The user is `auth.uid()` only.** No session is 42501, and no argument names an account.
  - **`p_confirm` must be exactly `DELETE`**, the phrase the person types, or the call is 22023 and nothing changes, so a client bug cannot erase an account by calling the function bare. A second call for a deleted account is P0002.
- **It returns the account's row count per public table**, read just before the delete. The client does not show it yet; a later receipt could.
- **No order of deletes, no half state.** One statement, and every foreign key cascades. A row added later in a new table must cascade from `auth.users` too, or erasure misses it: the probe counts every table that holds an account's data.

### 2. The client

- **`deleteAccount(confirmation)`** (`FinanceContext.tsx`) calls the function, then `signOut()`, which clears this device (F5, ADR `0024`).
  - **A missing function** says the database needs its update and that nothing was deleted, and the person stays signed in. There is no fallback, because a client-side delete could not reach `auth.users`.
  - **An error with no SQLSTATE** is an unknown outcome: the delete may have committed. `verifySession()` asks the auth server, and a deleted account's session is rejected there, which signs this device out.
  - **Any other error** stays signed in and shows the server's reason.
- **`AccountModal` has a "Delete account" section** under the profile and password forms, signed in only.
  - It names what goes, says every device is signed out and that it cannot be undone, and points to the CSV export first.
  - Its button opens a `ConfirmDialog` with the new `confirmPhrase` prop: a labelled field ("Type DELETE to confirm") that keeps Confirm disabled until the phrase is typed exactly, and is cleared when the dialog closes.
  - **On success:** the dialog closes, and the modal stays open on guest mode with a notice that the account was deleted.
  - **On failure:** the dialog stays open with the reason.
- **A guest sees no Delete account action.** There is nothing in the cloud to erase: a guest's data lives only in that browser's storage.

### 3. What erasure cannot reach

Stated so the claim is not larger than the code:
- Supabase's platform logs (auth, API, Postgres) and any database backups, until their retention ends.
- Vercel's runtime logs: the AI proxies log no ledger text (ADR `0011`), and a CSP report holds no account data (ADR `0071`).
- A CSV the person exported earlier, and any other browser still signed in until its next session check.

## Order of release

1. **Before the merge, the owner, in the SQL editor:**
   - (a) run the probe with the migration inlined, inside `BEGIN ... ROLLBACK`, which creates two test accounts and deletes one;
   - (b) apply `20261006_phase96_delete_user_account.sql`, then its history row from `npm run migration:print-history -- <file>`, printed at that moment;
   - (c) run the probe again without its `\ir` line.
2. **Then:** the drift workflow by hand, which must find no drift with 18 history rows.
3. **Then merge.** Merged first, the client's Delete account answers that the database needs its update, and deletes nothing.

## Verification

- **The probe** (`supabase/tests/20261006_phase96.probe.sql`) sets up two accounts, each with a row in every table above, A with a soft-deleted wallet and transaction:
  1. **Shape:** `SECURITY DEFINER`, `search_path` pinned, `authenticated` only (not `anon`, not `PUBLIC`).
  2. **Refusals change nothing:** no session (42501); no phrase, `delete` or ` DELETE` (22023).
  3. **A deletes A:** the answer is A's row counts; every count of A's, across `auth.users`, `auth.sessions` and the eight public tables, is 0; B's are all unchanged, balance included.
  4. **After the delete:** A's still-valid token gets P0002 from a second delete, and a foreign-key violation from a wallet insert.

  `unit/migration-replay.test.ts` runs it before and after the migration (18 files, 17 functions). **Negative controls:**
  - without the phrase check it fails "2 a call with no phrase was not refused";
  - deleting app data only (wallets) fails "3 a row of account A survived".
- **`unit/authenticated-ledger.test.tsx`, +6:**
  - the phrase reaches the server, then a local sign-out clears the device;
  - a refusal, and a missing function, leave the person signed in with the reason;
  - a lost response triggers the session check, and signs out when the account is gone;
  - in `AccountModal`, Confirm stays disabled for `delete` and enables only for `DELETE`, then guest mode shows the notice;
  - a server error keeps the dialog open with its message.

  **Negative controls:**
  - without the sign-out, the success test and the dialog test fail;
  - without the phrase gate, the dialog test fails.
- **`tests/account-and-mobile-nav.spec.ts`, +1:** a guest's Account & Security has no Delete account section, in all three browsers. No spec signs in, so the signed-in flow is in the unit suite: a spec that faked Supabase's auth and data APIs would be the request-intercepting spec CLAUDE.md rules out when a unit test reaches the same code.
- **Gate:** in the refactor log.

## Consequences

- **A deleted account is gone.** Support cannot restore it; the person can sign up again with the same email as a new account.
- **Every new table that holds an account's data must reference `auth.users` with `ON DELETE CASCADE`, and join the probe's count.**
- **The soft-delete rule still holds for everything else.** Deleting a wallet, a transaction or a debt is reversible, as before.
