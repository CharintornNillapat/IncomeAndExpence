## Round 1

### 1. Metadata
- Task: T793. Date: 2026-10-22. Round: 1. Verdict: APPROVED.
- Target files: `src/index.css`, `scripts/wcag-tokens.mjs`, `unit/theme-tokens.test.ts` (new), `DESIGN.md`, `docs/audit/task-ledger.md`. None is git-ignored (`git check-ignore -v` printed nothing).

### 2. Summary
`:root` now holds the ADR 0103 Paper Ledger values (every value in spec 5.1.A matches, and the ADR contains every hex). The eleven fills moved out of `@theme` into `:root` (light) and `.dark` (today's values), with eleven `--color-*` maps added to `@theme inline`. `wcag-tokens.mjs` reads fills and tints from the blocks and adds the light-only text-on-`brand-tint` checks. `DESIGN.md` Tokens table, fill sentence and status line are updated. The new unit test guards the fills, the maps, the empty `@theme` colour set and the 37 frozen dark variables.

### 3. Invariants and parity
- Parity map: no row touched (spec 6). The ADR/DESIGN.md pair agrees (14 rows, 11 fills, 7.90 and 5.70).
- `.dark`: diffed HEAD's block against the working tree; the only difference is the eleven appended fill lines. The 37 existing lines are byte-identical.
- `--scrim`, `--pending-body`, radii, shadows, font and hero size are unchanged. No `}` inside a comment in `:root` or `.dark`.
- Line endings: all four existing files stay `w/crlf`; the new test file is CRLF, ASCII.
- Em dashes: 0 in added diff lines, the new test file and the build report.
- Scope: `git status --porcelain` lists only the five targets plus the spec and build files. No unannounced change.
- `wcag-tokens.mjs`: edits are exactly spec 5.2 (dynamic tint, dynamic fill checks, light-only tint loop, header comment).

### 4. Gates run (logs in `workflow/stages/03_review/output/logs/`)
- `node scripts/wcag-tokens.mjs`: exit 0, "All token pairs pass." Light: white on brand-fill 7.90, on hover 9.93; on brand-tint fg 14.42, fg-secondary 8.14, fg-muted 5.24, expense 5.01, income 4.70, pending 4.63, transfer 4.59; expense-text on surface-3 and control-active 4.57. Dark: 5.70 and 7.10.
- `npm run lint`: exit 0, 132 files (`T793-lint.log`).
- `npx vitest run unit/theme-tokens.test.ts`: 1 file, 4 passed.
- `npm run test:unit`: 65 files, 1469 tests, 1469 passed, 0 failed (`T793-unit.log`).
- Playwright, 7 named specs, chromium: 48 passed (`T793-pw-chromium.log`).
- Playwright, same 7 specs, three browsers: 138 passed, 6 skipped, 0 failed (`T793-pw-all.log`).
- `npm test` (all specs, all browsers): 531 passed, 6 skipped, 0 failed (`T793-pw-full.log`).
- Red run: stashed only `src/index.css` (`w/crlf`, so safe to stash), ran the new test alone: 3 failed (cases 1, 2, 3), 1 passed (case 4), as the spec requires. `git stash pop --index` restored the tree; `git status --porcelain` identical before and after.

### 5. Not verified
- The visual check (cream page, white cards, indigo button) was not repeated; the resolved tokens are confirmed through the CSS diff and the 531-test suite.
- Ports 3000 and 3100 were free before Playwright.

### 6. Blocking
None.

### 7. Non-blocking
- The build report calls the `.dark` fill values "frozen dark values" but the red log is in the Builder's output folder, which is gitignored; nothing to do.
- The `@theme inline` helper `extractBlock('@theme inline')` finds the first `}`; if a future nested block is added the test would need to change. Acceptable now.

### 8. Rule candidates
- Theme-dependent colour fills belong in `:root` and `.dark` with an `@theme inline` map, never in plain `@theme` (promote in T796 once the code complies, which it now does).

### 9. Fix block
Not applicable.
