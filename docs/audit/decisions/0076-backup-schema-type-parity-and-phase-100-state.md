# 0076: The backup schemas parse to exactly their types, checked by `tsc`; the architecture at Phase 100

**Status:** Accepted. Implemented on branch `phase-100-type-parity-and-milestone` (code `95525fb`, docs `5c474ea`, test fix `955e74b`), draft PR #51. Not merged yet. No migration, and no change to what the app does.
- **Amends** ADR `0075`'s consequence that nothing made a new field reach the restore's schema: `tsc` now does.

**Date:** 2026-10-06

## Context

1. **The restore's output was cast, not checked.** `parseAccountBackup` returned `result.data as AccountExport`. The export side was already exhaustive (ADR `0073`: each type's field list is `{ [K in keyof Required<T>]: ... }`, so a new field fails `tsc` until it is listed), but the restore's Zod schemas were tied to the types by nothing. A field added to `Wallet` would be written by the export and refused by the restore's strict object ("unrecognized key"), so every new backup would fail to restore, and no build or test step would say so before a person tried.
2. **Assignability is not enough.** Without the cast, `result.data` is assignable to `AccountExport` as long as the schema's output has every required field. A schema missing an optional field, or holding a field the type lacks, still assigns.
3. **The root `tsconfig.json` has `strictNullChecks` off** (it sets no `strict`). There, `string | null` and `string` are one type, so no type-level check can see a field turn nullable. Measured on this code: of five drifts (a new field, a field turning nullable, an enum short a member, an optional field made required, a wrong primitive), the root config caught four and missed the nullable one; `--strict` caught all five.
4. **The user named `AccountBackupSchema` and `AccountBackup`.** In the code they are `BackupSchema` and `AccountExport`, kept as they are.

## Decision

### 1. `schemaOf<T>()(schema)`

`src/utils/schemaParity.ts` holds two exports:
- **`Equal<A, B>`:** true only when `A` and `B` are the same type, through the identity check TypeScript applies to two generic functions (`<X>() => X extends A ? 1 : 2`). It sees each field, whether it is optional, and its members, so it refuses what assignability lets through.
- **`schemaOf<T>()(schema)`:** returns the schema unchanged, so the runtime cost is one call per schema at module load. Its parameter is `S & (Equal<z.output<S>, T> extends true ? unknown : Mismatch)`, so a schema that does not parse to exactly `T` fails at its own definition. `Mismatch` names the field: `"schema lacks field: pinned"`, `"type lacks field: extra"`, then "the schema does not parse to exactly this type", which on its own means a field's type or optionality differs.

In `src/utils/accountExport.ts`, each row schema is `schemaOf<Wallet>()(z.strictObject({...}))` (and `Transaction`, `Debt`, `Category`, `KeywordRule`, `DiaryEntry`), and the whole file's schema is `schemaOf<AccountExport>()(...)`, its refinements included. The cast is gone: `parseAccountBackup` returns `result.data` as it is.

The parity chain is then closed at both ends: the export's field lists are exactly each type's keys (ADR `0073`), and each restore schema parses to exactly that type. `AccountExport` itself is the export's declared return type and the file schema's target, so a header field added to it fails on both sides.

### 2. A strict pass, for nullability

`tsconfig.parity.json` extends the root config with `strict: true` and compiles only `src/utils/accountExport.ts` (with what it imports) and `unit/schema-parity.check.ts`. `npm run lint` runs it after the root `tsc`; it took 7 s while Playwright was running. Turning `strictNullChecks` on for the whole app is a separate decision, out of this phase.

### 3. Negative checks that fail when the check stops working

`unit/schema-parity.check.ts` is type-only: Vitest collects `*.test.*` only, and the root config excludes it (there its nullable case cannot fail). Against a small `Row` type it holds one schema that must pass and six that must not, each under `// @ts-expect-error`:
- a field the schema does not list;
- a field the type does not have;
- an optional field made required;
- an enum short a member;
- a field of the wrong type;
- a nullable field the schema refuses null on (strict only).

If `schemaOf` stopped refusing any of them, its directive would be unused, and `tsc` fails on an unused `@ts-expect-error`.

### What it does not check

Formats are not types. A timestamp, a calendar day and free text are all `string`, so writing a calendar day where the export writes a timestamp passes `tsc`. Those stay covered at run time by `unit/account-export.test.ts`'s round trip ("reads back exactly what the export wrote").

## Verification

- **Controls on the real code** (each makes one change, runs `npm run lint`, restores the file; every one fails lint):

  | Control | Errors | Where |
  |---|---|---|
  | `Wallet` gains `pinned: boolean` | 34 | the export's field list, `WalletRow` (`"schema lacks field: pinned"`), the file schema, and `parseAccountBackup`'s return; the rest are fixtures and forms that build a `Wallet` |
  | `Debt.dueDate` becomes `string \| null` | 2 | `DebtRow` and the file schema, from the strict pass only |
  | `AccountExport` gains `appVersion: string` | 3 | `buildAccountExport`'s return, the file schema, `parseAccountBackup`'s return |
  | `FoodQuality` gains a member | 2 | `DiaryEntryRow` and the file schema |
  | the schema makes `rawInput` required | 2 | `TransactionRow` and the file schema |
  | `schemaOf` made to always pass (`Equal<T, T>`) | 6 | every `@ts-expect-error` in `unit/schema-parity.check.ts`, unused |

- **Gate:** in the refactor log.
- **On CI:** the pull request's first run (`37447199860`) failed on one unit test, `proxy-contract.test.ts`'s Server-Timing sum (94.6 against 94.60000000000001, a rounding the test did not allow for; T614); after the fix, run `37447478059` passed every job in 297 s, 468 passed and 6 skipped with no flaky test, unit 1077, the strict pass included; the drift workflow on the branch (`37447199821`) found no drift: live matches all 18 migrations.

## Consequences

- **A new field on a ledger type now fails `tsc` in three places until it is handled:** the export's field list, the restore's row schema, and the file schema above it. The error names the field and the schema.
- **A schema elsewhere can use `schemaOf`** when it stands for a type that already exists. The write-path schemas in `zodSchemas.ts` validate what a form submits, which is not a stored row's shape, so they are not candidates as they are.
- **The strict pass covers only what `tsconfig.parity.json` lists.** A new file that needs it is added there.

## The architecture at Phase 100

The repository's first commit was on 2026-08-31; at Phase 100 `main` holds 525 commits and 76 ADRs. What follows is the shape the decisions add up to, for a reader starting here.

- **Client:** React 19, Vite 6, Tailwind v4 on semantic tokens (ADR `0025`, `0027`), installable as a PWA, Thai Baht only. 123 files and about 21,000 lines in `src/`. Six views, each lazy; four shell modals mount on first open (ADR `0010`).
- **State:** one `FinanceContext`, split into a state and an actions context, with ref mirrors so actions stay stable, and one batched `localStorage` writer. A guest's data lives in the browser; a signed-in account's lives in Supabase, and every load replaces the device's copy.
- **Money rules:** every spending, income, net-worth and debt-plan figure is computed in `src/selectors/` (ADR `0028`), from an ISO `today` passed in, never the clock.
- **Ledger writes:** signed in, each write is one database function that locks its rows, applies relative balance changes, and replays on an idempotency key (ADR `0023`): `record_transaction`, `transfer_funds`, `set_transaction_deleted`, `update_transaction`, `import_transactions`, `create_wallet`. The client validates with Zod first, updates optimistically, adopts the server's balances, and rolls back on any error (the `MutationResult` pattern). Overpayment, signed adjustments and opening balances follow the same rules in TypeScript and SQL (ADR `0016`, `0024`).
- **Schema:** 18 migrations, from a baseline of the dashboard-built schema (ADR `0063`), that replay from empty in PGlite in the unit suite; 12 SQL probes. A weekly read-only check compares live with the migrations (ADR `0066`); it found no drift on each of Phases 96 to 99.
- **Security:**
  - the database functions act only for `auth.uid()`;
  - the AI proxies verify tokens themselves against the project's keys (ADR `0064`), count signed-in requests in the database at 120 a minute (ADR `0049`), and leave guests to one firewall rule (ADR `0032`, `0046`);
  - the content security policy is enforced, and violations are logged (ADR `0068`, `0070`, `0071`);
  - CI actions are pinned to commits (ADR `0067`), and install scripts are an allow-list (ADR `0074`).
- **Data rights:** an account can delete itself in one transaction (ADR `0072`), take everything out as one JSON file (ADR `0073`), and restore that file into a guest's browser (ADR `0075`), with the file's shape now held to the types (this ADR).
- **AI:** keyword rules first, then Jev only on a miss, behind a debounce (ADR `0011`); the CSV import classifies only when asked (ADR `0019`); the monthly insight lets the model pick a pattern and the app write every number (ADR `0020`). The functions run in `icn1`, beside the database (ADR `0051`).
- **Accessibility and layout:** 44 px targets, one focus outline, dialogs that trap focus and make the page behind them inert (ADR `0043`, `0047`), a zoomable page (ADR `0068`), safe-area insets for the installed iPhone app (ADR `0070`), and no layout shift while the app loads (ADR `0060`).
- **Tests:** 158 Playwright tests in 32 specs across Chromium, Firefox and WebKit (474 runs, 6 skipped by design), and 1077 Vitest tests in 42 files for what a browser cannot reach: the signed-in branch of every write, the proxies, migration replay, ordering races. CI runs both in about four and a half minutes, as six shards with one merged report (ADR `0061`, `0062`).

**Still open at Phase 100:**
- dropping the 20260909 `transfer_funds(p_user_id, ...)` signature, from about 2026-10-13 (ADR `0069`);
- restoring a backup into a signed-in account, which needs a six-table database function and a migration (ADR `0075`);
- for the owner: a throwaway account taken through export, delete and restore on production; T571; leaked password protection;
- watched: `public.transactions` against 100,000 rows, the point at which to index the five foreign keys (ADR `0073`).
