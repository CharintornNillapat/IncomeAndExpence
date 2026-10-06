# 0075: A backup restores into a guest's browser, by replacement, after a strict check; three specs intercept requests

**Status:** Accepted. Implemented on branch `phase-99-doc-alignment-and-data-restore`. Not merged yet. No migration: the schema is unchanged.
- **Extends** ADR `0073`: the export's file can be read back.
- **Settles** the count of request-intercepting specs, on which CLAUDE.md's Testing section and its Do NOT list disagreed.

**Date:** 2026-10-06

## Context

1. **The export had no way back in.** ADR `0073` writes a `finlife-export-YYYY-MM-DD.json` with every row, but nothing reads it. A person who deleted their account (ADR `0072`), or who moves to another browser as a guest, cannot use the file they kept.
2. **The file is untrusted input.** Anyone can hand-edit or fabricate one. The app's balances and ledger rules (ADR `0016`, `0024`) assume rows that its own write paths made.
3. **Signed in, the cloud is the record.** Every load replaces the device's slices with the account's rows (`loadSupabaseData`), so a copy restored into a signed-in device's state would be overwritten on the next load. Restoring into the account itself would need a new server function that writes six tables in one transaction, with its own migration and probe.
4. **Two numbers for one rule.** The Testing section said three specs intercept requests and "adding a fourth is fine if it meets the principle". The Do NOT list said "Do NOT add a fifth". Counting `page.route(` in `tests/` finds four files, but `tests/express-input.spec.ts` names it only in a comment ("No `page.route()` here"), so three specs intercept.

## Decision

### 1. Reading the file: `parseAccountBackup`

`src/utils/accountExport.ts` accepts exactly what `buildAccountExport` writes, and nothing else:
- **The header:**
  - `format: "finlife-tracker-export"` and `version: 1`, both literal, so another file or a later version is refused, not guessed at;
  - `source` and `currency: "THB"`;
  - an ISO `exportedAt`.
- **Rows:**
  - **strict objects, so an unknown field is refused**, not dropped: a file is a copy of this app's rows, and an extra field means it is not one;
  - enums for wallet, transaction and food types;
  - `YYYY-MM-DD` calendar days and ISO timestamps (`z.iso.date()`, `z.iso.datetime()`);
  - finite amounts within the ledger's bound, and mood an integer from 1 to 5;
  - strings capped at 10,000 characters, and ids at 100.
- **Across the file:**
  - every count matches its rows, and ids are unique per slice;
  - ADR `0024`'s sign rule: an ADJUSTMENT is non-zero, every other type positive;
  - every `walletId`, `destinationWalletId`, `categoryId`, `debtId` and rule `categoryId` resolves to a row in the file. Soft-deleted rows count, since they are in the file.
- **Limits and errors:**
  - a file over 20,000,000 characters is refused before it is parsed;
  - the function never throws;
  - a refusal names up to three problems by path, e.g. `transactions[0].walletId: no wallet in the file has this id`.
- **One known refusal:** the export keeps a timestamp it cannot parse as it was (ADR `0073`), and the restore refuses such a file, naming the row. No row the app writes has one.

### 2. Applying it: guest only, by replacement, after a confirmation

- **`restoreBackup(data)` (`FinanceContext`) replaces the six slices.** It never merges: merging two ledgers needs a definition of "the same row", the question CSV import also leaves open (CLAUDE.md, "There is no import deduplication").
  - Rows take the guest's user id, since an account's rows carry its uuid.
  - A template (device only, never in the file) stays unless it names a wallet or category the backup lacks.
  - The batched writer stores the new slices, so a reload keeps them.
- **Signed in, it is refused**: "Sign out first. A backup restores into this browser in guest mode, not into an account." A cloud restore is a later phase's decision (Context 3).
- **`AccountModal`'s section is now "Back up and restore."**
  - **For a guest:** an "Import backup (JSON)" button opens the file picker. A refused file shows "This file cannot be restored:" and the reason, with no dialog.
  - **Before anything changes**, a `ConfirmDialog` ("Replace this browser's data with the backup?", "Replace with backup") says what the file holds, how many transactions the browser holds now, that restoring replaces them and cannot be undone, and to export first to keep them. Cancel changes nothing; success flashes "Restored the backup from <time>."
  - **Signed in:** no import button. A line says restoring works in guest mode on this browser only, and to sign out first.
- **Zod validates before any state changes**, as on every write path: the dialog opens only with a parsed file, and `restoreBackup` receives only what `parseAccountBackup` returned.

### 3. Three specs intercept requests

CLAUDE.md's Testing section names the three (`jev-classify`, `csv-classify`, `insights`) and notes `express-input`'s comment. A fourth is allowed only if it meets the principle **and** no unit test can reach the code. The Do NOT line that said "fifth" is removed: its section now states the rule in full (ADR `0074`).

## Verification

- **`unit/account-export.test.ts`, +10:**
  - a written file reads back unchanged;
  - refusals of non-JSON, another format or version, an unknown field (named by path), a wrong type, an unknown enum value and a bad calendar day;
  - refusals of a negative expense and a zero adjustment, counts that disagree, a dangling wallet, category or debt, a duplicate id, and an oversized file.
- **`unit/backup-restore.test.tsx`, 4, new** (the real `AccountModal` over the guest `FinanceProvider`):
  - the dialog shows the file's counts and the browser's, and nothing changes until "Replace with backup"; then every slice is the backup's, a soft-deleted row included, rows carry the guest's id, and `localStorage` holds them;
  - a file with a dangling wallet is refused by path, with no dialog;
  - Cancel changes nothing;
  - a template with its wallet and category stays, one without is dropped, one with neither stays.
- **`unit/authenticated-ledger.test.tsx`, +2:** signed in, `restoreBackup` refuses and changes nothing, and the modal offers no import and says why.
- **Negative controls:** each fails at least one test:
  - strict objects made plain (1);
  - no wallet reference check (2);
  - restore allowed while signed in (1);
  - restore applied on file pick without the dialog (3);
  - rows keeping the account's id (1).
- **`tests/account-and-mobile-nav.spec.ts`, +2, in all three browsers:**
  - a guest exports, adds a transaction, imports the file, sees "3 wallets, 1 transaction," and "This browser holds 2 transactions now", confirms, and the later transaction is gone, before and after a reload;
  - a JSON file that is not a backup is refused and changes nothing.
- **Gate:** in the refactor log.

## Consequences

- **A guest can move their data between browsers, or keep it after deleting an account**, through the one file.
- **A new field on a ledger type now needs two edits:** the export's field list (which `tsc` enforces) and the restore's schema. Nothing enforces the second: the strict schema refuses every file holding the new field until it is listed, so add the field to the round-trip test's rows too.
- **A file from a later version is refused.** When `version` changes, the reader learns it first.
- **Restoring into an account stays open:** it needs a server function that writes six tables atomically, with a migration and probe for the owner.
