# 0115: the React hooks lint joins npm run lint

**Status:** Accepted. To be implemented in Phase 161 (T831: D1 and D2; T832: D3). Carries out ADR 0113 D6, and supersedes ADR 0113 D2 once T832 lands.

**Date:** 2026-10-30

## Context

ADR 0113 added `npm run lint:hooks` (`eslint src api`, the two React hooks rules only) as an opt-in script, not part of `npm run lint` or CI (D2), and left the five `react-hooks/exhaustive-deps` warnings in `src/context/FinanceContext.tsx` for a later money-path phase (D6). On `883a6a6` the script reports exactly those five warnings and 0 errors:

- `resetToGuestState` (line 881) asks for `setKeywordRules`, `setPresets` and `setDiaryEntries`;
- `loadSupabaseData` (line 967) asks for `setKeywordRules` and `setDiaryEntries`;
- `restoreBackup` (line 1320) asks for `setKeywordRules`, `setDiaryEntries` and `setPresets`;
- `deleteCategory` (line 1710) asks for `keywordRulesRef`;
- `applyPreset` (line 2094) asks for `presetsRef`.

Every name comes from the three slice store hooks (`useKeywordRuleStore`, `useTemplateStore` and `useDiaryEntriesState`), each of which returns its own `useState` setter and `useRef` object. React keeps both the same object for the component's lifetime, but the rule cannot see that through a custom hook's return value. The slices' own mutation hooks already list the same values in their dependency arrays.

The identities matter: the auth listener effect depends on `loadSupabaseData` and `resetToGuestState`, and the actions context value lists `signOut`, `restoreBackup`, `deleteCategory`, `applyPreset` and `refreshFromCloud`, so a new identity would re-run the effect or re-render every actions subscriber.

## Decision

- **D1: List the stable values.** Each of the five `useCallback` dependency arrays gains exactly the names the rule reports. No callback body changes, no other dependency changes, and no disable comment is added. `useCallback` compares dependencies with `Object.is` and each added value is the same object on every render, so every callback keeps its identity for a session as before, and no money arithmetic changes.
- **D2: A characterization test proves it.** A behaviour-neutral change has no test that fails before it. `unit/rerender-matrix.test.tsx` gains a test that the actions object and `signOut`, `refreshFromCloud`, `restoreBackup`, `deleteCategory` and `applyPreset` keep their identity through a write to every slice and a sign-out. It passes before and after the change; a temporary unstable dependency turns it red. The failing-first half is `npm run lint:hooks`: 5 warnings before, 0 after.
- **D3: The rules join `npm run lint` (T832).** With `npm run lint:hooks` at 0 warnings and 0 errors across `src api`, ESLint becomes part of `npm run lint`, so a hooks warning fails it. CI's type-check job already runs `npm run lint`. `AGENTS.md`'s Commands line and tier rows say so. T832's spec fixes the exact script and flags and whether any workflow file changes.

## Consequences

- `FinanceContext.tsx` changes in five dependency arrays and one doc comment; no runtime behaviour, render count or bundle logic changes.
- One unit test is added (1625 tests in 73 files).
- After T832, a new `exhaustive-deps` warning anywhere in `src` or `api` fails `npm run lint` locally and in CI.

## Not done

- The three bare `// eslint-disable-next-line` sites ADR 0113 left (`DiaryView.tsx`, `TransactionsView.tsx`, `WalletsView.tsx`).
- The React Compiler rules, the recommended preset, type-aware rules, `eslint` 10 and `--cache` (as ADR 0113).

## Release

One pull request for Phase 161, on the pause list (a money path), merged by the owner, never auto-merged. No database migration and no production touch points.

## Amendments

### Phase 161, T832: D3 as built

- **The scripts.** `"lint:hooks": "eslint --max-warnings 0 --cache --cache-location .cache/eslint/ src api"`, and `npm run lint` keeps its four steps in their order and appends `&& npm run lint:hooks`. A failed step stops the chain, so ESLint runs last, only after both `tsc` runs pass. `npm run lint:hooks` stays as the hooks-only command for a hand run.
- **Why `--max-warnings 0`, not `error` severity.** `react-hooks/exhaustive-deps` stays at `warn` in `eslint.config.js`, as ADR 0113 D3 set it, so an editor still shows it as a warning, while the flag fails the script on any warning from any rule, now or later. One flag in `package.json` serves `npm run lint`, CI and a hand run alike. ESLint then prints `ESLint found too many warnings (maximum: 0).` and exits 1.
- **CI.** The `checks` job already runs `npm run lint` after `npm ci`, which installs the dev dependencies, so no workflow file changes. Its step is still named `Type-check (tsc --noEmit)`; renaming it is a `.github/workflows/` edit left to the owner, and it renames no required check, since those are job names.
- **Cache.** `--cache --cache-location .cache/eslint/` keeps ESLint's per-file results in `.cache/eslint/`, which `.gitignore`'s `.cache/` line already ignores and which no guard, `tsc` config or test runner reads. A cached run prints a cached file's warnings again, and ESLint re-lints a file whose size or modification time changed, so the cache hides no warning.
- **Shell.** Both scripts hold only `&&`, bare words and two flag values: no quote, `$`, glob, `;`, pipe, redirection or variable assignment, so they mean the same in `cmd.exe`, which npm uses on Windows, and in `sh` on CI.
- **AGENTS.md.** The Commands line names the ESLint step. The tier rows need no change: each row that names `npm run lint`, and the rule that every code-tier task runs it, now include ESLint.
- **Proof.** On a scratch copy of the working tree outside the repo, with the cache warmed by a clean `npm run lint`, an injected `exhaustive-deps` warning makes `npm run lint` exit 1, a second, cached run exits 1 too, the same copy with the old scripts exits 0, and the copy without the injection exits 0.
