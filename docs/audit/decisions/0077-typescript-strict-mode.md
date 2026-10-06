# 0077: Both TypeScript configs are `strict`; `tsconfig.parity.json` is gone

**Status:** Accepted. Implemented on branch `phase-101-typescript-strict-mode`. Not merged yet. No migration, and no change to what ships: the build is byte-identical to production's.
- **Amends** ADR `0076`: its strict pass (`tsconfig.parity.json`) is folded into the root config.

**Date:** 2026-10-06

## Context

1. **Neither config was strict.** The root `tsconfig.json` set no `strict`, and `api/tsconfig.json` set `"strict": false`. So `strictNullChecks` was off everywhere: `string | null` and `string` were one type, and a value that can be null or undefined could be used as if it never was, in `FinanceContext`, the selectors and the proxies alike.
2. **Phase 100 worked around it for one module.** ADR `0076` needed nullability to hold the backup schemas to their types, and ran a second `tsc` project (`tsconfig.parity.json`, strict) over `accountExport.ts` and its check file only.
3. **The cost was measured before deciding** (Phase 100's post-merge check, on `main` at `85870c7`):
   - `--strictNullChecks` alone: 2 errors, both in `src/components/category/categoryLabels.ts`;
   - full `--strict`: 7 errors, 1 in `src/` and 6 in `unit/`;
   - `api/` under `--strict`: none.

   The categoryLabels pair shows only without `noImplicitAny`: there an empty array literal is `never[]`, while under full `strict` it is an array that takes its type from what is pushed.

## Decision

### 1. `strict: true` in both configs

`tsconfig.json` and `api/tsconfig.json` set `"strict": true`, with no flag of the family turned back off. That is `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `useUnknownInCatchVariables` and `alwaysStrict`.

### 2. The errors, fixed where they arise

- **`categoryLabels.ts`:** `const parts: string[] = []`, explicit, so it holds under either rule.
- **`csvExchange.ts`:** papaparse's `error` callback is `(err: Error)`, the type its own declaration gives. The parameter got no type from the call, so `noImplicitAny` refused it.
- **`unit/feedback-ordering.test.tsx`:** the handlers were typed `(...args: never[]) => Promise<Result>`, which `strictFunctionTypes` refuses for `(id: string) => ...`. They are now `Partial<Pick<ComponentProps<typeof TransactionDetails>, 'onSave' | 'onDelete' | 'onRestore'>>`, the component's own prop types.
- **`unit/csp-report.test.ts`:** the `console.warn` spy is `MockInstance<typeof console.warn>`, so its calls are typed.
- **`scripts/lib/migrationReplay.mjs`:** `readCatalog` declares its return type in JSDoc. `tsc` reads JSDoc in an imported `.mjs` (`allowJs`), so all four callers in `unit/migration-replay.test.ts` are typed by one line, rather than each annotated.

### 3. `tsconfig.parity.json` is deleted

The root config now sees nullability, so the separate pass checked nothing the root `tsc` does not. `npm run lint` is back to `check:node-globals`, the root `tsc`, and `tsc -p api/tsconfig.json`. `unit/schema-parity.check.ts` moves into the root program; it was excluded only because its nullable case could not fail there.

The check file now also guards strict mode itself: with `strict` turned off, its nullable `@ts-expect-error` goes unused and `tsc` fails.

### Left as it is

Phase 99 narrowed `parseAccountBackup`'s result with `'error' in result` and `'backup' in result`, because the old config did not narrow on `ok: true | false`. Under `strict` it does, so `!result.ok` would now work too. Both forms are correct, and changing them belongs with the next edit to those lines, not this phase.

## Verification

- **Controls** (each undoes one part, runs `npm run lint`, restores the file; every one fails lint):

  | Control | Errors | First error |
  |---|---|---|
  | root `strict` turned off | 1 | `unit/schema-parity.check.ts`: unused `@ts-expect-error` (the nullable case) |
  | `Debt.dueDate` becomes `string \| null` | 2 | `DebtRow` and the file schema, from the root `tsc`, with no parity config |
  | `csvExchange`'s `err` untyped again | 1 | `TS7006` implicit `any` |
  | `feedback-ordering`'s handlers back to `never[]` | 4 | `TS2322`, not assignable to `(id: string, edit) => Promise<WriteResult>` |
  | `readCatalog` without its JSDoc | 1 | `TS7006` in `migration-replay.test.ts` |
  | `api/`: a `string \| null` read as a string | 1 | `TS18047` `'s' is possibly 'null'` |

- **Bundle:** `npm run build` on the branch gives the same 51 files in `dist/assets/`, every one byte-identical to the file of the same name on production, and the same `index.html`. Strict mode changes what `tsc` accepts, not what Vite emits.
- **Gate:** in the refactor log.

## Consequences

- **Null and undefined are checked everywhere `tsc` runs:** the app, its tests, the backup schemas and the Vercel functions. A new `undefined` on a money path is a compile error before it is a runtime one.
- **A new file needs nothing extra:** there is no second config to add it to.
- **A future change that needs a flag of the family off** turns off that one flag, in the config that needs it, with its reason written beside it.
