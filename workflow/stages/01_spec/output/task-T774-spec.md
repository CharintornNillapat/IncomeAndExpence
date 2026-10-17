# T774 spec: give the Hero text a whole-pixel line height (CI safe-area failure), and a Backlog row for running the layout specs on token changes

Phase 137 (`phase-137-small-fixes`). Spec date 2026-10-18. No ADR: ADR 0102 already fixes the Hero size at 44px; this changes the line height of the token T769 added, and no rule or signature changes.

## 1. Goal

CI failed on the phase 137 PR: `tests/safe-area.spec.ts:23` (portrait) fails on Chromium in all 3 tries, the footer's bottom at 745.390625 and the mobile nav's top at 745. The cause is T769's `--text-hero--line-height: 1.1`, which makes the Left over figure's line box 44px x 1.1 = 48.4px, so the page is fractionally tall and the last 0.39px cannot be scrolled clear of the nav. Make the Hero line height a whole number of pixels (48px), do not touch the test, and add a Backlog row so a typography or spacing token change runs the layout specs.

## 2. Target files

```
src/index.css
unit/dashboard.test.tsx
DESIGN.md
docs/audit/refactor-log.md
```

Bookkeeping (always allowed): `docs/audit/task-ledger.md`, `workflow/stages/02_build/output/*`.

Temporary edit (step 1 of section 7, reverted before any other edit): `src/components/dashboard/LeftOverCard.tsx`. It must show no diff when the build ends.

`tests/safe-area.spec.ts` is **not** a target. The test stays as it is.

## 3. Context to read

`docs/contexts/ui-and-e2e.md` (a token and a Playwright spec are in play). Skip `docs/contexts/client-state.md`: the unit test only reads a CSS file. `DESIGN.md` section 2 (the scale table, `:72` to `:81`) for the Hero row.

## 4. Current behaviour

- `src/index.css:326` sets `--text-hero: 2.75rem;` and `:327` `--text-hero--line-height: 1.1;`. At the 16px root that is 44px / 48.4px. Tailwind v4 emits `.text-hero{font-size:var(--text-hero);line-height:var(--tw-leading,var(--text-hero--line-height))}` (T769 review, section 3).
- `src/components/dashboard/LeftOverCard.tsx:113` puts `text-hero` on the Left over figure (`<Money>`), the only user of the token (`grep -rn "text-hero" src/` lists `index.css` and this line only).
- `tests/safe-area.spec.ts:34-39` scrolls to the bottom and asserts `footer.y + footer.height <= nav.y`. It passed before T769 (the figure was `text-4xl`, a 40px line, an integer). With the Hero line box at 48.4px the Dashboard's height gains 0.4px; Chromium snaps layout to 1/64 px, so the footer's bottom lands at 745 + 25/64 = 745.390625, which is exactly the number CI printed. The page cannot scroll those 0.39px under the nav's top edge, so the assertion fails.
- T769's own build report saw "line-height 48.4px" but its gates did not include the layout specs (`AGENTS.md` tier row for `src/index.css` names "the affected spec(s)", and the builder took that as the specs naming the component).
- No unit test reads `src/index.css`. `unit/dashboard.test.tsx:165-172` ("sets the figure at the Hero size") asserts only the class name.

## 5. Parity map

None. (`DESIGN.md`'s Hero row and `src/index.css` are kept in step by hand; no row lists them.)

## 6. Tests to add

**One added assertion**, in the existing test "sets the figure at the Hero size" (`unit/dashboard.test.tsx:165-172`, inside `describe('Left over follows the net rule ...')`), so the unit count stays 1438 and `AGENTS.md` and `README.md` need no edit.

- Add `import { readFileSync } from 'node:fs';` after the vitest import (as `unit/proxy-parity.test.ts:2` does). After the two existing `expect` lines, read `src/index.css` with `readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')` and expect it to match `/--text-hero--line-height:\s*\d+px;/` (backslash-s and backslash-d). Comment above it: a fractional line box makes the page fractionally tall and breaks `tests/safe-area.spec.ts` (T774). Write the regex with Write/Edit, not a shell heredoc (a heredoc collapses `\`; see the memory note), and prove it at runtime (red then green below).
- Fails today: the declaration is `1.1;`, so the match is `null` (`src/index.css:327`).

The red run (stage 02 step 4) is the unit test on the unfixed code, saved to `workflow/stages/02_build/output/logs/T774-red.log`. The Playwright spec `tests/safe-area.spec.ts` is the second guard and is red at HEAD in CI; section 7 step 1 records it locally.

## 7. Steps

1. **Confirm the cause before any fix** (order of the task). Check ports 3000 and 3100 for stale dev servers first. Save each run to `workflow/stages/02_build/output/logs/`.
   - a. At HEAD, unchanged: `npx playwright test tests/safe-area.spec.ts --project=chromium` -> `T774-safe-area-with-token.log`. Expected: portrait fails, `Expected: <= 745`, `Received: 745.390625` (or the same 0.39 fraction). If it **passes** locally, say so in the build report (CI and local fonts may differ), keep going: the analytic cause in section 4 plus the unit test stand, and the report states that the local run could not reproduce.
   - b. Temporarily change `src/components/dashboard/LeftOverCard.tsx:113` from `text-hero` to `text-4xl` (nothing else), run the same command -> `T774-safe-area-without-token.log`. Expected: both safe-area tests pass. Then restore the file with `git checkout -- src/components/dashboard/LeftOverCard.tsx` and confirm `git diff --stat src/components/dashboard/LeftOverCard.tsx` is empty. Never edit `src/` while Playwright runs: edit, then run, then restore.
   - c. The build report states the verdict: the token's fractional line height is the cause (a passes red, b passes green), or not. If b **still fails**, stop and report `BLOCKED` with both logs; the cause is then something else and this spec does not apply.
2. Add the unit test (section 6). Run `npx vitest run unit/dashboard.test.tsx`, save the failure to `T774-red.log`, expected: only "sets the figure at the Hero size" fails, with a `null` match.
3. `src/index.css:327`: replace `--text-hero--line-height: 1.1;` with `--text-hero--line-height: 48px;`, and extend the comment at `:325` to: `/* DESIGN.md's Hero number, the Dashboard's Left over figure. The line height is whole pixels: a fractional line box (44px x 1.1) makes the page fractionally tall and the footer cannot clear the mobile nav (tests/safe-area.spec.ts). */`. Keep CRLF (the file is `w/crlf`).
4. `DESIGN.md:80`: the Hero row becomes `| Hero number (the Dashboard's Left over) | 44px / 600, 48px line height, −1px tracking; the `text-hero` token |`. Keep the file's own minus character (U+2212) as it is on that line; change nothing else.
5. `docs/audit/task-ledger.md` (bookkeeping):
   - Add the T774 row at the end of the Phase 137 table, after T773: `| T774 | Whole-pixel line height for the Hero token (CI safe-area failure from T769); Backlog row for running the layout specs on token changes | `src/index.css`, `unit/dashboard.test.tsx`, `DESIGN.md`, `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md` | done | | <gate result> |`.
   - Add this row at the end of the Backlog table, exactly: `| Any change to a typography or spacing token (`src/index.css` `@theme` sizes, line heights, spacing) runs the layout specs (`tests/safe-area.spec.ts`, `tests/layout-stability.spec.ts`), not only the specs that name the component; rule candidate for `AGENTS.md`'s tier row for `src/index.css`, and for `docs/contexts/ui-and-e2e.md` | Phase 137, T774: T769's `--text-hero` line height of 1.1 (48.4px) passed its gates and failed `safe-area.spec.ts` in CI | todo |`. Touch no other Backlog row.
6. `docs/audit/refactor-log.md`, the Phase 137 entry only (the Phase 136 entry and the template stay unchanged):
   - Heading: `T769-T773` becomes `T769-T774`.
   - Brief paragraph: add at its end: `T774 fixes a CI failure T769 caused: the Hero token's line height of 1.1 (48.4px) made the page fractionally tall, and `safe-area.spec.ts` could not scroll the footer clear of the nav; the line height is now 48px, with an assertion on it.`
   - `**Changed:**`: append `; T774: `src/index.css` (`--text-hero--line-height` 1.1 to 48px, comment); `unit/dashboard.test.tsx` (an assertion on the Hero line height in the Hero size test); `DESIGN.md` (Hero row names the 48px line height); `docs/audit/task-ledger.md` (one Backlog row)` in the line's own style.
   - `**Verified:**`: append the T774 gate results (the ledger Gate result cell, word for word).
   - `**Surprises:**`: append `T769's gates ran only the specs that name the Dashboard; the layout specs (`safe-area`, `layout-stability`) were never run, so the fractional line height reached CI. T769's build report had printed "line-height 48.4px" without comment.`
   - `**Deliberately not done:**`: append `a rule in `AGENTS.md` for the layout specs (Backlog row instead, per "a rule enters this file only once the code complies"); an audit of other fractional line heights in the `@theme` scale.`
   Write the new text by script or Edit from this spec's code, not retyped from memory.

## 8. Gates

Union of the tier rows: `src/index.css` (and `src/components/`), `unit/`, docs, plus the task's additions (safe-area, layout-stability and dashboard specs on all three browsers). Run in order and save full-suite output to logs under `workflow/stages/02_build/output/logs/`:

1. `npm run lint`
2. `npx vitest run unit/dashboard.test.tsx` (red before step 3, green after)
3. `npm run test:unit` (expected 62 files, 1438 tests, unchanged)
4. `npx playwright test tests/safe-area.spec.ts tests/layout-stability.spec.ts tests/dashboard.spec.ts --project=chromium`
5. `npx playwright test tests/safe-area.spec.ts tests/layout-stability.spec.ts tests/dashboard.spec.ts` (no project filter: Chromium, Firefox, WebKit). `safe-area` skips itself off Chromium; report the skips as skips.
6. Counts in docs: no test is added, so `AGENTS.md` and `README.md` stay correct. Confirm `grep -n "1438" AGENTS.md README.md` still matches the unit run.
7. The line-height value landed: `node -e "const s=require('fs').readFileSync('src/index.css','utf8');console.log(/--text-hero--line-height:\s*48px;/.test(s))"` prints `true`, and `grep -c "1\.1;" src/index.css` shows no `--text-hero` match.
8. Line endings: `git ls-files --eol src/index.css unit/dashboard.test.tsx DESIGN.md docs/audit/refactor-log.md docs/audit/task-ledger.md` shows `w/crlf` for every file that showed it before.
9. Em dashes: the added-lines one-liner from `workflow/stages/01_spec/CONTEXT.md:51` (extract it by script, do not retype) prints 0, and the build report has none.
10. Scope: `git status --porcelain` lists only the target files, the ledger and the build output; `git diff --stat src/components/dashboard/LeftOverCard.tsx tests/safe-area.spec.ts` is empty.

## 9. Production touch points

None. No SQL, no `/api/*` request, no MCP write tool. The 3 browser Playwright run uses the local dev server only; the `vercel.json` CSP and `index.html` are untouched. The owner pushes the phase branch to rerun CI.

## 10. Out of scope

- Loosening, skipping or editing `tests/safe-area.spec.ts` (or any spec) to absorb the 0.39px.
- Changing `--text-hero: 2.75rem`, the weight, the tracking, or `LeftOverCard.tsx` beyond the temporary step 1b edit.
- Auditing or changing other line heights in the `@theme` scale or Tailwind's defaults.
- Editing `AGENTS.md`, `docs/contexts/ui-and-e2e.md` or any stage file: the layout-specs rule is a Backlog row only.
- Any commit or push (the orchestrator commits after APPROVED; only the owner pushes).
