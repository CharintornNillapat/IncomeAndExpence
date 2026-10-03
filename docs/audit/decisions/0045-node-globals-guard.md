# 0045: A script keeps Node globals out of src/, because tsc cannot

**Status:** Accepted and released. Commit `626a629` (docs `656195b`), merged into `main` as `89b27a6` (PR #19). PR run `37093195340` and push run `37098175414` on `89b27a6` passed: the guard (`node-globals: 121 files in src, no Node globals.`), both type-checks, unit 666/666 in 29 files, and 141/141 on each of chromium, firefox and webkit. Vercel `dpl_3k2JGRYxSAtiJfQc63zrvPdWh6AB` is READY in production and serves the same entry, `index-BFWd6EeO.js` at 188,651 B: no app file changed.
- **Closes** the open item recorded in `CLAUDE.md` since Phase 50: "That guard is not currently in force, so do not rely on `tsc` to catch `process`/`Buffer` in `src/`".
- **Keeps** the root `tsconfig.json` as it is (no `"types": ["node"]`, no `src/`-only config) and adds no dependency.

**Date:** 2026-10-03

## Context

- **`src/` runs in the browser,** where `process`, `Buffer`, `__dirname`, `global` and `require` do not exist, and Vite cannot load a Node built-in module. A reference to any of them throws at run time, and `src/` has no error boundary, so the likely result is a white screen.
- **`tsc` cannot catch it.** The root config's `types` lists only `vite-plugin-pwa/client`, which was meant to keep Node's types out. But `@types/papaparse` begins with `/// <reference types="node" />`, and `csvExchange.ts` imports papaparse, so Node's types are in the root program anyway; a triple-slash reference is not filtered by `types`.
- **Shown in this phase:** with `const leakedUrl = process.env.VITE_SUPABASE_URL;` and `Buffer.from(...)` added to `src/lib/supabase.ts`, `tsc --noEmit` exits 0.
- **Today's exposure is nil:** no such reference in `src/`, which reads its settings through `import.meta.env`. The risk is the next one, most likely a `process.env` copied from Node code.
- **Options weighed:**
  - **A `src/`-only tsconfig** cannot work while papaparse's reference pulls Node in from inside `src/`'s own import graph.
  - **ESLint** (`no-restricted-globals`, `no-restricted-imports`) would do it, but the project has no ESLint, and a linter, its parser and a config for one rule is more machinery than the hole warrants.
  - **A small Node script** with no dependencies, run by `npm run lint`. Chosen.

## Decision

- **`scripts/check-node-globals.mjs`** reads every `.ts`, `.tsx`, `.js`, `.jsx` (and `.mts`, `.cts`, `.mjs`, `.cjs`) file under `src/`. It replaces comments, string contents, template text and regular expressions with spaces (lines and columns stay put; the code inside a template's `${...}` is still checked), then reports:

  | Pattern | Message names |
  |---|---|
  | `process.env`, `process?.env` | `import.meta.env` |
  | any other `process` (`process.cwd()`, `const { env } = process`, `typeof process`) | a Node global |
  | `Buffer` | `Uint8Array`, `TextEncoder` |
  | `__dirname`, `__filename` | `import.meta.url` |
  | `global.` / `global[` | `globalThis` |
  | `require(` / `require.` | `import` |
  | an `import`, `import()` or `export ... from` of `node:*` or a Node built-in (`fs`, `path`, `fs/promises`, from `module.builtinModules`) | the browser build cannot load it |

  A property (`job.process`, `ArrayBuffer`) and an object key (`{ process: 1 }`, supabase-js's `{ global: { fetch } }`) are not matches.
- **Ignoring a line takes a reason:** `// node-guard-ignore: <why>` (or the block form) on the line, or alone on the line above. An ignore without a reason is an error, and so is one that suppresses nothing, so an exception cannot outlive its cause.
- **`npm run lint` runs it first** (`npm run check:node-globals && tsc --noEmit && tsc -p api/tsconfig.json`), so CI's `checks` job runs it with no workflow change, before any browser job.
- **Output:** `file:line:column  message` per finding and a count; exit 1 on any finding, 0 with the number of files read.
- **The script exports `maskSource`, `scanSource` and `checkDirectory`** for `unit/node-globals-guard.test.ts`. It is a tool, not `src/`, so the rule against exporting from `src/` only for a test does not apply.

## Verification

- **`src/` today:** 121 files, no finding, in about 0.16 s.
- **The negative control asked for:** `process.env` and `Buffer.from` added to `src/lib/supabase.ts`. `tsc --noEmit` exits 0; `npm run lint` exits 1 with `src/lib/supabase.ts:5:19` and `:6:15`, each with its fix. Reverted; `src/` clean.
- **The masking does not hide code:** `process.cwd();` inserted at the start of every line of every file in `src/` (19,944 insertions) was reported every time, except the 1,771 that landed inside a block comment, where hiding it is correct.
- **`unit/node-globals-guard.test.ts`, 51 tests:** each pattern, 19 things that must not match (comments, strings, template text, a regular expression, `import.meta.env`, `globalThis`, `ArrayBuffer`, properties, object keys, supabase-js's `global` option, JSX text and tags), line and column, the ignore rules, `src/` clean, and the command's exit codes and output on a temporary tree.
- **Eleven mutations, each fails at least one test:** comment, string, template and regex masking off; the property lookbehind and the object-key lookahead off; built-in imports off; ignores off; the reason not required; the unused-ignore check off; the next-line reach off.
- Lint clean; unit 666/666 in 29 files (615 + 51).

## Consequences

- **A forbidden word in JSX text is reported** (`<p>we process it</p>`), because the scanner does not parse JSX. Reword the copy or add an ignore with its reason. Nothing in `src/` hits this today.
- **Known gaps, all false negatives:** `process` as a value in a ternary's middle (`a ? process : b`) reads like an object key; an unterminated quote in JSX text (`Don't`) hides the rest of that line; a template literal's import specifier is not checked. Each needs deliberately odd code.
- **`unit/`, `tests/`, `api/` and `scripts/` are not checked:** they run in Node.
- **The rule list lives in one place,** `RULES` in the script; a new pattern needs a test in each of the two `describe` blocks it touches.
