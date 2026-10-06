# 0073: Every account's data exports as one JSON file; the erasure cascade needs no index yet; Node 24.x

**Status:** Accepted. Implemented on branch `phase-97-account-export-and-cascade-check` (commit `b860bbe`, docs `71c9e15`), draft PR #48. Not merged yet. No migration: the schema is unchanged.
- **Amends** ADR `0072`: Delete account points to the new export, not to the Transactions CSV.
- **Amends** ADR `0067`'s accepted "five unindexed foreign keys": the hard delete it named as the reason to revisit now exists, and is measured below.
- **Amends** ADR `0071`'s Node range: `>=22.0.0` becomes `24.x`.

**Date:** 2026-10-06

## Context

1. **No way to take all of one's data out.** Thailand's PDPA gives a data subject the right to receive their personal data in a readable, portable form. The app could export transactions as CSV (Transactions page, `GuestDataNotice`) and diary entries as JSON (Daily diary), but not wallets, debts, categories or smart rules, and neither export holds soft-deleted rows. Since ADR `0072` an account can be erased for good, so the copy taken before that is the only one left.
2. **The erasure cascades through five foreign keys without an index:** `transactions.wallet_id`, `destination_wallet_id`, `category_id`, `debt_id` and `keyword_rules.category_id`. For every wallet, category and debt it deletes, Postgres finds the rows that reference it, and without an index that means reading the whole table, every account's rows included. ADR `0067` accepted these keys while nothing hard-deleted a parent. The `authenticated` role runs with `statement_timeout=8s` on live, so a cascade that grows past that cancels the delete, and the account stays.
3. **Vercel warned about the open Node range.** `>=22.0.0` (ADR `0071`) "will automatically upgrade when a new major Node.js Version is released": the functions would move to Node 26 on Vercel's schedule, untested. CI ran Node 22, and the functions already run 24.

## Decision

### 1. The export

- **`src/utils/accountExport.ts`'s `buildAccountExport`** writes one object:
  - the six slices, `wallets`, `transactions`, `debts`, `categories`, `keywordRules` and `diaryEntries`, **soft-deleted rows included**;
  - `format: "finlife-tracker-export"`, `version: 1`, `exportedAt`, `currency: "THB"`, the row `counts`;
  - `source`: `account` signed in (the cloud rows this device loaded) or `this-device` as a guest.
- **Each row goes through a field list per type.** A field the type does not declare never reaches the file: a guest row is parsed from `localStorage` and can carry anything. The lists are typed `{ [K in keyof Required<T>]: ... }`, so a field added to a type fails `tsc` until it is listed, and someone decides whether it belongs in the file.
- **What is not in it:** the email, the display name, the password, any token, the session list. None of them is in the six types. Templates are not in it either: they live on the device only and never belonged to the account (ADR `0024`).
- **Dates:**
  - timestamps (`createdAt`, `updatedAt`) are rewritten with `toISOString()`, since Supabase sends microseconds and `+00:00` while a guest row has the `Z` form;
  - a timestamp that does not parse is kept as it was, never dropped;
  - calendar days (`transactionDate`, `dueDate`, a diary `date`) are written as stored and never parsed, so no day moves (CLAUDE.md, "Dates").
- **Rows are sorted by id**, so the same data gives the same file whatever order the device holds it in.
- **The file is `finlife-export-YYYY-MM-DD.json`**, the local day. `saveJsonFile` makes the download; the diary export uses it too, instead of its own copy.
- **`AccountModal`'s "Export your data" section, for a guest and an account alike**, with "Export all data (JSON)". It writes what the app holds, so it refuses when that is not the whole account:
  - signed in while a load is running: "Your data is still loading";
  - signed in after a load failed a read (`syncError`): "could not all be loaded, so the file would be incomplete. Use Sync now, then export again";
  - a file the browser cannot make: "Could not create the file. Nothing was saved."
- **Not built:** an import of this file. Nothing reads it back yet; `version` is there so a reader can tell later.

### 2. The cascade: measured, no index yet

`scripts/bench-cascade-delete.mjs` replays every migration in PGlite, seeds one account, times `delete from auth.users` for it (median of 3, each rolled back), then adds the five indexes and times it again. The heavy account has 20 wallets, 40 categories, 10 debts, 20,000 transactions, 200 rules and 1,000 diary days; "other rows" are other accounts with 1,000 transactions each.

| Scenario | Transactions in the table | Without indexes | With them |
|---|---|---|---|
| Live's shape today (2 accounts) | 206 | 1 ms | 3 ms |
| Heavy account alone | 20,000 | 36 ms | 28 ms |
| Heavy + 100k other rows | 120,000 | 756 ms | 21 ms |
| Heavy + 500k other rows | 520,000 | 3,777 ms | 26 ms |

- **The cost is the table's size times the parents deleted**, not the account's own rows: 90 scans of `transactions` here (two per wallet, one per category and debt), plus 40 of `keyword_rules`.
- **At live's size there is none.** Live held 2 accounts and 103 transactions on 2026-10-06, read-only. At that size the indexes would only add write work to every transaction insert.
- **No migration.** Revisit when `public.transactions` passes **100,000 rows**, where a heavy account's erasure takes most of a second in PGlite. That is long before the 8 s timeout, which this shape reaches at about a million rows. The fix is ready in the script: the five `create index` statements.
- PGlite is single-threaded WebAssembly, so absolute times on live will be lower; the ratio is the finding.

### 3. Node 24.x

- `package.json` and the lockfile's root say `"node": "24.x"`. Vercel keeps the functions on 24 until the range changes in a commit.
- **CI runs 24:** every `setup-node` in `playwright.yml` and `schema-drift.yml`. Testing on 22 while production ran 24 was the gap.

## Verification

- **`unit/account-export.test.ts`, 8 tests:**
  - every row of every slice, soft-deleted ones included, with every field;
  - an unchanged JSON round trip;
  - the header (`format`, `version`, `source`, `exportedAt`);
  - timestamps as `toISOString()` with calendar days unmoved;
  - an unreadable timestamp kept;
  - the same file for the same data in any order;
  - no undeclared field (`access_token`, `password`, a `session` object) on a row reaching the file;
  - an absent optional field left out rather than written as `null`.
- **`unit/authenticated-ledger.test.tsx`, +3:** in the real `AccountModal` over the signed-in provider:
  - the file holds the cloud rows (a soft-deleted transaction included) and not the account's email or any token;
  - the export refuses after a failed read and writes nothing;
  - a failure to create the file says so.
- **Negative controls:** each fails at least one test:
  - export without the failed-load refusal (1);
  - rows written with a spread instead of the field lists (1);
  - no sort (1);
  - no timestamp rewrite (2).
- **`tests/account-and-mobile-nav.spec.ts`, +1:** a guest's export in all three browsers downloads `finlife-export-YYYY-MM-DD.json` holding the three starter wallets and the transaction just added, with `source: "this-device"` and an `exportedAt` in `toISOString()` form. It intercepts nothing.
- **Gate:** in the refactor log.
- **On CI:** the pull request's run `37419198793` passed every job in 269 s on Node 24.21, 462 passed and 6 skipped with no flaky test, unit 1061; the drift workflow on the branch (`37419198799`) found no drift with all 18 migrations.

## Consequences

- **A person can take all of their data out before deleting their account**, and Delete account says so.
- **A new field on a ledger type needs a line in `accountExport.ts`**, or `tsc` fails.
- **The five foreign keys stay unindexed until `public.transactions` passes 100,000 rows.** Run `node scripts/bench-cascade-delete.mjs` again before adding them, and add them in a migration with the drift check, as any schema change.
- **The next Node major is a commit**, not Vercel's schedule.
