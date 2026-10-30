# 0113: opt-in ESLint for the React hooks rules

**Status:** Accepted. To be implemented in Phase 158 (T827). D6's follow-on is ADR 0115 (Phase 161), which supersedes D2 once T832 wires ESLint into `npm run lint`.
The owner approved adding the dev dependencies eslint, eslint-plugin-react-hooks and typescript-eslint on 2026-10-29.

**Date:** 2026-10-29

## Context

The repository has no linter beyond `tsc` and two small guard scripts (`scripts/check-node-globals.mjs` and `scripts/check-safe-ids.mjs`). A long-standing Backlog row asked for "ESLint with `react-hooks/exhaustive-deps`".

A measured run (scratchpad install, 2026-10-29) over `src/` and `api/` gives 0 `rules-of-hooks` errors and 7 `exhaustive-deps` warnings across 3 files: `src/components/Modal.tsx:212`, `src/components/ui/OverflowMenu.tsx:67`, and five in `src/context/FinanceContext.tsx` (lines 881, 967, 1320, 1710, and 2094). Three older sites are already silenced by a bare `// eslint-disable-next-line` (`src/views/DiaryView.tsx:48`, `src/views/TransactionsView.tsx:152`, and `src/views/WalletsView.tsx:78`); they were not audited and stay as they are.

Adding a dependency is on AGENTS.md's Stop and ask first list. The owner explicitly approved adding these three dev dependencies (`eslint@9.39.5`, `eslint-plugin-react-hooks@7.1.1`, and `typescript-eslint@8.72.1`) on 2026-10-29, and no other.

## Decision

- **D1: Exact pinned versions.** Pin `eslint` to `9.39.5`, `eslint-plugin-react-hooks` to `7.1.1`, and `typescript-eslint` to `8.72.1` (the exact versions measured; `eslint` 9.39.5 is npm's `maintenance` tag and `10.13.0` is `latest`, not evaluated; `typescript-eslint` 8.72.1 peers `typescript >=4.8.4 <6.1.0`, the repo is `~5.8.2`; `eslint-plugin-react-hooks` 7.1.1 peers `eslint` up to `^10`; all three engines accept Node 24).
- **D2: Opt-in script, not wired into lint or CI.** Add a separate script, `"lint:hooks": "eslint src api"`, run by hand. It is not added to `npm run lint`, not added to CI, and `AGENTS.md`, `.github/workflows/`, `vercel.json` and `.claude/` are not edited. Exit codes follow ESLint defaults: 0 when there are only warnings or nothing, 1 when any error is reported (a `rules-of-hooks` error or a parse error), and 2 on a configuration failure. No `--max-warnings` flag is used, so warnings never fail the script.
- **D3: Flat config `eslint.config.js`.** Use `typescript-eslint`'s parser only (no type-aware rules, no `typescript-eslint` rule set), and register the `react-hooks` plugin by hand with exactly two rules: `react-hooks/exhaustive-deps` at `warn` and `react-hooks/rules-of-hooks` at `error`. The plugin's recommended preset and its React Compiler rules are not enabled, as they would report on code that compiles and runs today. Set `reportUnusedDisableDirectives: 'off'` so the three bare disable comments raise nothing.
- **D4: Read-only script.** `lint:hooks` does not include `--fix` or `--cache`. ESLint writes no file without them; `.gitignore:64` already lists `.eslintcache`.
- **D5: Two behaviour-neutral fixes.** Fix the two non-money warnings: `Modal.tsx` reads `panelRef.current` once at effect setup instead of in the cleanup (the panel is one element for a whole open session, because `Presence` keeps one keyed child and mounts it in the first commit, `motion.tsx:30-40`; layout effects run after child refs attach, as the effect at `Modal.tsx:239` already relies on); `OverflowMenu.tsx` focuses `itemRefs.current[0]` directly instead of calling `focusItem(0)`, which `focusItem` does when there is at least one item and does nothing otherwise (with no item rendered every `itemRefs` slot is null, because React calls each old ref callback with null), so the effect depends on `isOpen` alone and cannot re-run on every render (adding `focusItem` to the deps would re-run it, and move focus, on every render while the menu is open).
- **D6: FinanceContext.tsx left untouched.** `FinanceContext.tsx` is a money path: its five warnings are left, and a new Backlog row schedules fixing them and wiring ESLint into `npm run lint` and CI (AGENTS.md Commands line and tier rows) as a later phase the owner merges.

## Consequences

- Three dev dependencies added (`eslint` 9.39.5, `eslint-plugin-react-hooks` 7.1.1, `typescript-eslint` 8.72.1); the dry-run install adds 99 packages to the lockfile (`eslint`'s tree, `typescript-eslint`'s `@typescript-eslint/*` and `eslint-plugin-react-hooks`'s `@babel/*`).
- Vercel and CI `npm ci` fetch them though nothing there runs ESLint. Runtime dependencies remain unchanged at 7.
- `npm run lint:hooks` ends with 5 warnings, all in `FinanceContext.tsx`, until the later phase.
- The default production build does not contain ESLint (it is not imported by `src/` or `vite.config.ts`), though two small chunks change because `Modal.tsx` and `OverflowMenu.tsx` change.

## Not done

- Fixing the five `FinanceContext.tsx` warnings.
- Wiring ESLint into `npm run lint` or CI.
- `AGENTS.md` Commands and tier-row edits.
- The React Compiler rules or recommended preset.
- Type-aware linting rules.
- `eslint` 10.
- Auditing or altering the three bare disables.
- `--max-warnings`.
- An ESLint cache (`--cache`).
- Any ESLint rule beyond the two React hooks rules.

## Release

One pull request for Phase 158. No database migration, no production touch points, and no files on the pause list. The pull request is eligible for automated merge (`gh pr merge --auto --merge`).
