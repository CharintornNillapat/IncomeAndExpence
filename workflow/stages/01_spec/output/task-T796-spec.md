# Spec: T796

Phase 143, branch `phase-143-paper-ledger-light-theme`, cut from `main` at `1344a1c`. Docs-only; this task ships the phase. The T796 row already exists in the ledger (`docs/audit/task-ledger.md:92`, written by T792 as the phase's planned closing task), so the id is this task's own, not a collision.

## 1. Goal

Close Phase 143 on paper, in the Phase 142 pattern (T791): the `refactor-log.md` entry for T792-T796 (with Surprises and Deliberately not done, including the four T794 "stays" decisions), the `baseline-metrics.md` Phase 143 section, the ledger Commit cells for T792 to T795, the new unit and Playwright counts in `AGENTS.md`, `README.md` and `docs/contexts/ui-and-e2e.md`, the promoted rule that theme-dependent colours live in `:root` and `.dark` with an `@theme inline` map, the `DESIGN.md` status line and D-label fixes, and the ADR 0103 Amendment (T795) D-c/D-d fix. The owner also asks for one full Playwright run (all specs, three browsers), recorded in the ledger and the refactor-log.

## 2. Target files

```
AGENTS.md
README.md
DESIGN.md
docs/contexts/ui-and-e2e.md
docs/audit/decisions/0103-paper-ledger-light-theme.md
docs/audit/refactor-log.md
docs/audit/baseline-metrics.md
```

Bookkeeping, always allowed: `docs/audit/task-ledger.md` (four Commit cells and the T796 row; section 6a step 8).

**Pause list:** `AGENTS.md` is a target, so the orchestrator pauses for the owner's go-ahead before `build T796`. The `AGENTS.md` edit is the four numbers on line 11 and nothing else.

## 3. Context to read

none (docs-only). The builder reads, as the shapes to copy: the template block and the Phase 142 entry at the top of `docs/audit/refactor-log.md`, the Phase 142 section of `docs/audit/baseline-metrics.md`, and the Phase 142 and 143 sections of `docs/audit/task-ledger.md`. `docs/contexts/ui-and-e2e.md` is a target, not context: edit only the lines in 6a.

## 4. Current behaviour

1. **ADR:** ADR 0103 (`docs/audit/decisions/0103-paper-ledger-light-theme.md`) is the phase's ADR, written by T792 and amended by T794 (`:195`) and T795 (`:244`). No new ADR.
2. **Phase 143 commits** (`git log --grep`, verified by the spec author): T792 `eddfd96` (2026-10-22, docs), T793 `c702aef` (2026-10-22), T794 `c5c2358` (2026-10-22), T795 `45b9e87` (2026-10-23). Merge base with `main` is `1344a1c`.
3. **Reviews:** T792 CHANGES REQUESTED in round 1 (three ADR citations wrong: `DESIGN.md:155` and `DESIGN.md:107` pointed at lines the same task shifted by 43 lines, and "4.1 item 5" pointed at the spec's own numbering), APPROVED in round 2. T793, T794 and T795 APPROVED in round 1 (`workflow/stages/03_review/output/task-T79N-review.md`).
4. **Ledger** (`docs/audit/task-ledger.md:82-92`): T792 to T795 rows are `done` with empty Commit cells and filled Gate results (`:88-91`); T796 at `:92` is `todo` with the old one-line task text and three files. No Backlog row is touched by this phase. File is 145 lines.
5. **Unit counts:** before the phase 64 files, 1465 tests (`AGENTS.md:11`, `README.md:157`). At `45b9e87`: 66 files (`ls unit` gives 66 `*.test.ts(x)`), 1475 tests (`workflow/stages/03_review/output/logs/T795-unit.log`: 66 passed, 1475 passed). Delta +10 tests, +2 files: `unit/theme-tokens.test.ts` (7 tests: T793 4, T794 3) and `unit/identity-display.test.ts` (3 tests, T795).
6. **Playwright counts:** `npx playwright test --list` at `45b9e87` prints `Total: 543 tests in 35 files`; `--project=chromium` prints `Total: 181 tests in 35 files`. So 181 tests, 35 specs, 543 runs (+2 tests, +6 runs: T795's `Dashboard identity colours (ADR 0103 D7)` describe in `tests/dashboard.spec.ts`). Stale statements: `AGENTS.md:11` (`179 tests, 35 specs, 537 runs`), `README.md:10` (badge `179%20E2E%20tests`), `README.md:158` (`179 tests in 35 spec files ... (537 runs)`), `docs/contexts/ui-and-e2e.md:64` (`179 tests in 35 specs ...: 537 runs, 531 pass, 6 skip by design`). No full suite has run since T794 (531 passed, 6 skipped, at 179 tests); T795 ran 10 specs only.
7. **Bundle** (spec author, clean `dist/`, `.env` present, `npm run build` exit 0, gzip level 9 over `dist/assets`, at `45b9e87`):
   - Entry `index-TU2ZOqF8.js` 193,293 B / 56,428 B gzip (Phase 142 `index-CQ64gmHG.js` 193,169 / 56,374: +124 / +54).
   - All app JS 884,987 B / 268,756 B gzip, 39 files (Phase 142 884,709 / 268,592: +278 / +164, 0 file delta).
   - CSS `index-BNXJTUPd.css` 53,895 B / 10,526 B gzip (Phase 142 `index-BJZ9fITB.css` 52,877 / 10,216: +1,018 / +310).
8. **Rule to promote, code complies:** plain `@theme` in `src/index.css:370-390` holds only radii, shadows, the font stack and the hero size, no `--color-` entry; the theme fills, the five T794 tokens and the twelve identity variables are set in `:root` (`:170-238`) and `.dark` (`:240-307`) and mapped in `@theme inline` (`:309-363`, e.g. `:310` `--color-canvas: var(--canvas)`). `unit/theme-tokens.test.ts:113-116` fails on any `--color-` in plain `@theme`. The rule is not written in `docs/contexts/ui-and-e2e.md` today (lines 7-8 list the token classes and the `dark:` twin ban only). `--shadow-quick-add` (`src/index.css:379`) keeps one violet rgba for both themes; it is a shadow, not a colour token, so the rule does not reach it.
9. **`identityDisplayColor` rule already promoted:** `docs/contexts/ui-and-e2e.md:8` says data colours are painted only through `identityDisplayColor(color)`, guarded by `unit/identity-display.test.ts`; T795 wrote it (its spec section 6 told T796 not to add a second copy). ADR 0103 Consequences (`:182`) still says T796 adds it.
10. **DESIGN.md:** the "Phases 143" typo the T792 review named is already gone: T793 rewrote the status line, which now reads (`DESIGN.md:68`) `**Status:** in force from T793 (Phase 143) for the Light column and palette values; identity colours (D7) follow in T795.`, stale since T795 shipped. `(D3a)` and `(D3b)` at `:91` and `(D7)` at `:68` and `:93` do not say they are ADR 0103's numbers; `:70` names the ADR.
11. **ADR 0103 Amendment (T795):** `:268` D-c omits the spec's idempotence note; `:269` labels the static guard "D-d", while T795's spec D-d (`workflow/stages/01_spec/output/task-T795-spec.md:95`) is "Sign, not colour", which the amendment does not record (T795 review, non-blocking item 4). The file ends at `:269` with CRLF.
12. **File lengths:** `refactor-log.md` 95 lines, `baseline-metrics.md` 135, `task-ledger.md` 145. After this task about 108, 144 and 145: all under the ~150 archive threshold. All eight files are `w/crlf` (`git ls-files --eol`).

## 5. Parity map

none.

## 6. Tests to add

none. Docs-only; the change cannot alter behaviour. Stage 02 step 4 and stage 03 step 6 do not apply.

## 6a. Edits (exact)

Order: run gates 1 to 5 of section 7 first (they measure the figures the edits record), then make the edits, then run gates 6 onward. Keep CRLF in every file. Placeholders: `<X>` is the seconds of gate 1's unit run; `<P>`, `<S>`, `<M>` are gate 5's passed count, skipped count and minutes (one decimal).

1. **`AGENTS.md:11`**: replace `1465 tests, 64 files` with `1475 tests, 66 files`, and `179 tests, 35 specs, 537 runs` with `181 tests, 35 specs, 543 runs`. Nothing else in `AGENTS.md`.

2. **`README.md`**:
   - `:10`: `Playwright-179%20E2E%20tests` becomes `Playwright-181%20E2E%20tests`.
   - `:157`: `1465 tests in 64 files` becomes `1475 tests in 66 files`.
   - `:158`: `179 tests in 35 spec files` becomes `181 tests in 35 spec files`, and `(537 runs)` becomes `(543 runs)`.
   - Nothing else.

3. **`docs/contexts/ui-and-e2e.md`**:
   - `:64`: replace `179 tests in 35 specs on Chromium, Firefox and WebKit: 537 runs, 531 pass, 6 skip by design` with `181 tests in 35 specs on Chromium, Firefox and WebKit: 543 runs, <P> pass, <S> skip by design`. Expect `<P>` 537 and `<S>` 6; if gate 5 gives any failure, or a skip count other than 6, stop and report it in the build report instead of writing any count.
   - Insert one new bullet directly after line 8 (the `**Never a raw palette class**` bullet), before the `**One face, IBM Plex Sans Thai,**` bullet:

     ```markdown
     - **A colour whose value differs by theme is a variable set in `:root` (light) and `.dark` (dark), mapped in `@theme inline` (`--color-<name>: var(--<name>)`), never a value in plain `@theme`,** which holds one value for both themes [0103]. `unit/theme-tokens.test.ts` fails on any `--color-` entry in plain `@theme`.
     ```

   - Do not edit line 8's `identityDisplayColor` sentence (already the rule; section 4 item 9). Nothing else.

4. **`DESIGN.md`**:
   - `:68`: replace the whole line with `**Status:** in force since Phase 143: the Light column and palette values from T793, the component tokens from T794 and the identity colours from T795.`
   - `:70`: append ` D3a, D3b and D7 below are ADR 0103's decision numbers.` to the end of the line (after `dark unchanged.`).
   - Leave `(D3a)`, `(D3b)` at `:91` and `(D7)` at `:93` as they are. Nothing else.

5. **`docs/audit/decisions/0103-paper-ledger-light-theme.md`** (Amendment (T795) only; do not edit D1 to D8, Consequences, Deliberately not done or Amendment (T794)):
   Lines `:268` and `:269` become these four lines (line 1 is `:268` with one sentence appended; line 2 is new; line 3 is `:269` with its label changed from `**D-d. Static guard test:**` to `**Guard:**` and the rest kept; then a blank line and item 3, which ends the file with CRLF). The minus in line 2 is U+2212, not an em dash or hyphen. Copy the text from this block with a script or by paste, not retyped.

   ```markdown
      - **D-c. Primitive wrapping:** Primitives `Chip`, `AllocationBar`, and `ProgressBar` wrap `color` internally so callers require no redundant transformation. `identityDisplayColor` is idempotent (`var(--identity-N)` is not a palette hex, so it comes back unchanged), so a caller that already converted is harmless.
      - **D-d. Sign, not colour:** income and expense do not change; they stay told apart by `+` and the `−` (U+2212) and by their tokens. Identity colours only name a category or wallet next to its text.
      - **Guard:** `unit/identity-display.test.ts` scans all `.tsx` files in `src/components/` and `src/views/` for colour styling patterns, enforcing that every colour paint site uses `identityDisplayColor` or `SYSTEM_CATEGORY_COLOR`.

   3. **The `identityDisplayColor` rule** entered `docs/contexts/ui-and-e2e.md:8` with T795, once the code complied, not with T796 as Consequences says; T796 confirmed it and added no second copy.
   ```

   The block's three-space indent before `- **D-c` etc. is the file's own indent; the block itself is indented three more spaces only because it sits in this list. Lines 1 and 3 must equal today's `:268` and `:269` except for the appended sentence and the label.

6. **`docs/audit/baseline-metrics.md`**: insert this block after `## Figures` and its blank line, above `### Phase 142 - delta against Phase 141`. If gate 3 prints a different entry name, CSS name or byte count than below, stop and report it instead of writing the block. Leave out a `Measured at <sha>` line; the post-merge deploy record adds it.

   ```markdown
   ### Phase 143 - delta against Phase 142

   - **Entry chunk** `index-TU2ZOqF8.js`: 193,293 B (+124 B), 56,428 B gzip (+54 B against Phase 142 `index-CQ64gmHG.js`, 193,169 / 56,374).
   - **All app JS**: 884,987 B (+278 B), 268,756 B gzip (+164 B against Phase 142 884,709 / 268,592, 39 files, 0 file delta).
   - **CSS**: `index-BNXJTUPd.css`: 53,895 B (+1,018 B), 10,526 B gzip (+310 B against Phase 142 `index-BJZ9fITB.css`, 52,877 / 10,216): the theme variables T793 to T795 added to `:root`, `.dark` and `@theme inline`.
   - **Vitest**: 66 files, 1475 tests (+10 tests, +2 files against Phase 142: `unit/theme-tokens.test.ts`, 7 tests from T793 and T794, and `unit/identity-display.test.ts`, 3 tests from T795), 1475 passed in <X> s (`workflow/stages/02_build/output/logs/T796-unit.log`). Per-task runs: T793 1469 passed in 71.38 s, T794 1472 in 61.33 s, T795 1475 in 43.47 s (`workflow/stages/02_build/output/logs/T79N-unit.log`).
   - **Playwright**: `npx playwright test --list` reports 181 tests in 35 files, 543 runs across 3 projects (+2 tests, +6 runs: T795's two identity colour tests in `tests/dashboard.spec.ts`). Full run by T796, at the owner's request: <P> passed, <S> skipped, 0 failed across 3 projects (<M> min, `workflow/stages/02_build/output/logs/T796-playwright.log`). Earlier full runs at 179 tests: T793 and T794, 531 passed, 6 skipped (8.8 and 9.4 min).

   ```

7. **`docs/audit/refactor-log.md`**: insert this block after the `---` that follows the template (line 20) and its blank line, above `## Phase 142 - ...`, followed by a blank line, `---` and a blank line. Keep `docs <sha>` and `merged <sha>` literal; fill `<X>`, `<P>`, `<S>`, `<M>`.

   ```markdown
   ## Phase 143 - Paper Ledger light theme: T792-T796 (2026-10-22 to 2026-10-23, code `c702aef` to `45b9e87`, docs `<sha>`, merged `<sha>`)

   ADR `0103`. Maps the owner's Paper Ledger light palette (`docs/design/finlife-light-theme.md`) onto the existing tokens in light mode only, with dark byte-identical: new light `:root` values, theme-dependent fills moved out of plain `@theme`, five theme tokens for the components the file re-points, and display-only `--identity-1..12` colours that paint stored category and wallet colours in light mode without rewriting them.

   **Changed:** T792 (`eddfd96`, docs: ADR 0103 with D1 to D8; `DESIGN.md` Light palette section, overview sentence and Deviations row; the owner's design file committed unchanged, 77 lines, blob `a9e7578`; `docs/audit/task-ledger.md` Phase 143 section). T793 (`src/index.css`: Paper Ledger values in `:root`, eleven fills moved from plain `@theme` into `:root` and `.dark` with `@theme inline` maps; `scripts/wcag-tokens.mjs`: reads the fills from the blocks and adds seven light text-on-`brand-tint` checks; `unit/theme-tokens.test.ts`: new, 4 tests; `DESIGN.md` Tokens table Light column). T794 (`src/index.css`: `hero-line`, `segment-active`, `mood-tile`, `mood-empty`, `wallet-fallback` in `:root`, `.dark` and `@theme inline`; `LeftOverCard.tsx` border, `SegmentedControl.tsx` selected pill, `MoodSpendingCard.tsx` day tile, `MoodMeter.tsx` empty bar, `WalletTransferForm.tsx` fallback `#a8a29e` to `bg-wallet-fallback`; `scripts/wcag-tokens.mjs`: four new pairs; `unit/theme-tokens.test.ts`: +3 tests; ADR 0103 Amendment (T794) with 27 verdicts; `DESIGN.md`; `docs/contexts/ui-and-e2e.md:7` token list). T795 (`src/index.css`: `--identity-1..12` in `:root` and `.dark`; `src/utils/identityPalette.ts`: `identityDisplayColor()`; 15 paint sites in 11 components, the donut ring now `style={{ stroke }}`; `unit/identity-display.test.ts`: new, 3 tests including a static guard; `unit/categories-page.test.tsx`, `unit/tx-row.test.tsx`, `unit/ui-display.test.tsx`, `unit/wallets-page.test.tsx`: expected colours become `var(--identity-N)`; `tests/dashboard.spec.ts`: +2 tests for the resolved light and dark colours; ADR 0103 Amendment (T795); `docs/contexts/ui-and-e2e.md:8` rule). T796 (`AGENTS.md`, `README.md` and `docs/contexts/ui-and-e2e.md`: unit 1475 tests in 66 files, Playwright 181 tests in 35 specs, 543 runs; `docs/contexts/ui-and-e2e.md`: the theme-variable rule; `DESIGN.md`: status line and a note that D3a, D3b and D7 are ADR 0103's; ADR 0103 Amendment (T795): D-c idempotence, D-d "Sign, not colour", guard relabelled, a note on the rule's home; `docs/audit/baseline-metrics.md`: Phase 143 section; `docs/audit/task-ledger.md`: T792 to T795 commits and the T796 row; this file).
   **Verified:** T792: docs checks passed (53 hexes in ADR 0103; wcag-tokens clean; input hash a9e7578 matched, 77 lines; CRLF kept; 0 em dashes). T793: Red gate verified (3 failed in unit/theme-tokens.test.ts); wcag-tokens all pairs pass (white on fill 7.90/9.93, 7 text-on-tint pairs pass); npm run lint clean; theme-tokens 4 passed; full unit 65 files 1469 passed (71.38s); e2e 7 specs on chr 48 passed (47.0s), 138 passed 6 skipped on 3 browsers (2.3m); full e2e 35 specs 531 passed 6 skipped (8.8m); CRLF kept; 0 em dashes. T794: Red gate verified (3 failed in unit/theme-tokens.test.ts); wcag-tokens all pairs pass (white on wallet-fallback 3.84, fg on segment-active 14.31, fg-muted on mood-tile 5.63, expense-text on mood-tile 5.38, brand-text vs mood-empty 5.59/5.72); npm run lint clean; theme-tokens 7 passed; full unit 65 files 1472 passed (61.33s); e2e 7 specs on chr 35 passed (31.4s); full e2e 35 specs 531 passed 6 skipped on 3 browsers (9.4m); CRLF kept; 0 em dashes. T795: Red gate verified (3 failed in unit/identity-display.test.ts); npm run lint clean; related unit 8 files 145 passed (3.89s); full unit 66 files 1475 passed (43.47s); wcag-tokens clean; targeted e2e 10 specs on chr 50 passed (27.1s), 144 passed 6 skipped on 3 browsers (2.3m); CRLF kept; 0 em dashes. T796: full unit 66 files 1475 passed (<X>s); playwright list 181 tests in 35 files, 543 runs; full e2e 35 specs <P> passed <S> skipped on 3 browsers (<M>m); clean production build index-TU2ZOqF8.js 193,293 B / 56,428 B gzip, all app JS 884,987 B / 268,756 B gzip, 39 files, CSS index-BNXJTUPd.css 53,895 B / 10,526 B gzip; CRLF kept across 8 touched files; 0 em dashes in git diff. The T792 review requested changes in round 1 and approved in round 2; T793, T794 and T795 were APPROVED in round 1.
   **Surprises:** (a) T792 round 1: three ADR citations pointed at `DESIGN.md` lines that the same task moved by 43 lines, or at the spec's own section numbers; the fix round cited the post-edit lines and named the paint sites by role (a rule candidate, not promoted: one occurrence). (b) The design file's `surface-2` debt payoff track would vanish: `ProgressBar` sits inside a `surface-2` `Inset` (1.00:1), and dark `surface-2` is darker than `line`, so the track stays `line`. (c) White on the dark `wallet-fallback` `#A8A29E` is 2.52:1, a figure the hard-coded hex already had; D6 keeps dark unchanged, so the ADR amendment records it as known. (d) The `identityDisplayColor` rule ADR 0103 gave to T796 landed in `docs/contexts/ui-and-e2e.md:8` with T795, once the code complied; T796 only confirmed it. (e) The "Phases 143" typo a T792 review note asked T796 to fix was already gone, because T793 rewrote that status line; the line was stale instead ("identity colours follow in T795") and T796 rewrote it. (f) T795's ADR amendment labelled its guard "D-d", the spec's number for "Sign, not colour", and left out the D-c idempotence note; T796 corrected both. (g) T795's builder session went idle mid-build; the review reproduced every reported number.
   **Deliberately not done:** the progress and Spent/Kept gap tracks stay `line`, not the file's `surface-2` (surprise b; the gap track is not a progress track in the file); the inactive tab stays `fg-secondary`, not `text-muted` (`fg-secondary` is ADR 0103 D4's step between `fg` and `fg-muted`, the dark value would change, and a new token would re-state `fg-muted` for one control); "Make a repayment" stays `Button variant="soft"`, not an outline (an outline needs a per-button variant and two more tokens, and `soft` is shared with other buttons); links keep an underline-only hover, no colour change (new behaviour, not a re-point, and `brand-fill-hover` as dark text is under 4.5:1); the active tab stays `font-medium` (typography, which the file's own rule 4 forbids changing); rewriting stored colours, changing dark, `theme-color` and manifest colours (`index.html:10`, `vite.config.ts:25-26`), a `[data-theme]` selector and new `--cat-*` tokens (ADR 0103's list); `identityDisplayColor` in CSV export, backup or any non-visual output; `--shadow-quick-add`'s violet glow in light (a shadow in plain `@theme`, not a colour token); the code nits from non-blocking review notes, since this task is docs-only (T795: the new `identityDisplayColor` import sits above `import React` in each edited component, `ColorGrid.tsx` imports `../../utils/identityPalette` twice, the `identityPalette.ts` header comment wraps to a short line, a stray blank line in `unit/wallets-page.test.tsx`; T794: the long `LeftOverCard.tsx` doc comment, a class-order assertion in `unit/theme-tokens.test.ts`); the ADR Context note on `useTheme.ts` setting `data-theme` (optional T792 note); archiving `task-ledger.md`, `refactor-log.md` or `baseline-metrics.md` (all under the 150-line threshold).

   ---
   ```

8. **`docs/audit/task-ledger.md`** (Phase 143 table only):
   - Commit cells: T792 (`:88`) `eddfd96`, T793 (`:89`) `c702aef`, T794 (`:90`) `c5c2358`, T795 (`:91`) `45b9e87`. Change no other cell of those rows.
   - Replace the T796 row (`:92`) with:
     - `#`: `T796`
     - Task: `Phase 143 closing docs: refactor-log entry, baseline-metrics section, T792 to T795 Commit cells, unit 1475 / 66 files and Playwright 181 / 35 / 543 in AGENTS.md, README.md and ui-and-e2e.md, the theme-variable rule in ui-and-e2e.md, DESIGN.md status line and D labels, ADR 0103 Amendment (T795) D-c and D-d; full Playwright run`
     - Files: `` `AGENTS.md`, `README.md`, `DESIGN.md`, `docs/contexts/ui-and-e2e.md`, `docs/audit/decisions/0103-paper-ledger-light-theme.md`, `docs/audit/refactor-log.md`, `docs/audit/baseline-metrics.md`, `docs/audit/task-ledger.md` ``
     - Status: `done`
     - Commit: empty
     - Gate result: `unit 66 files 1475 passed (<X>s); playwright list 181/35/543; full e2e 35 specs <P> passed <S> skipped on 3 browsers (<M>m); clean prod build (index-TU2ZOqF8.js 193,293 B, all app JS 884,987 B 39 files, CSS 53,895 B); CRLF kept; 0 em dashes`
   - Do not edit the heading, the branch line `:84`, any earlier phase, or any Backlog row.

## 7. Gates

Docs-only tier: nothing mandatory beyond checking every stated count, path and sha; the owner adds the full Playwright run, and the unit run and build supply the recorded figures. Commands (PowerShell, from the repo root):

```powershell
# 1-5: before any edit
npm run test:unit *> workflow/stages/02_build/output/logs/T796-unit.log    # expect 66 files, 1475 passed; record seconds as <X>
npx playwright test --list | Select-Object -Last 1                         # expect "Total: 543 tests in 35 files"; starts no server
if (Test-Path dist) { Remove-Item -Recurse -Force dist }; npm run build    # .env present; never read or print it
node -e "const fs=require('fs'),z=require('zlib'),p='dist/assets/';let t=0,g=0,n=0;for(const f of fs.readdirSync(p)){const b=fs.readFileSync(p+f),c=z.gzipSync(b,{level:9}).length;if(f.endsWith('.js')){t+=b.length;g+=c;n++}if(/^index-.*\.(js|css)$/.test(f))console.log(f,b.length,c)}console.log('allJS',t,g,n)"
netstat -ano | Select-String ':3000 |:3100 ' | Select-String LISTENING      # expect nothing; stop any stale server you started, else report
npx playwright test *> workflow/stages/02_build/output/logs/T796-playwright.log   # all 35 specs, 3 browsers; record <P>, <S>, <M>

# 6 onward: after the edits
git log --format=%h -1 --grep="(T792)"; git log --format=%h -1 --grep="(T793)"; git log --format=%h -1 --grep="(T794)"; git log --format=%h -1 --grep="(T795)"
git diff -U0 HEAD -- AGENTS.md README.md docs/contexts/ui-and-e2e.md DESIGN.md docs/audit/decisions/0103-paper-ledger-light-theme.md
git grep -n "1465\|64 files\|179 \|179%\|537 runs" -- AGENTS.md README.md docs/contexts/ui-and-e2e.md   # expect nothing (exit 1)
git grep -n "D-d. Static guard\|follow in T795" -- DESIGN.md docs/audit/decisions/0103-paper-ledger-light-theme.md   # expect nothing (exit 1)
git ls-files --eol AGENTS.md README.md DESIGN.md docs/contexts/ui-and-e2e.md docs/audit/decisions/0103-paper-ledger-light-theme.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md
node -e "for(const f of process.argv.slice(1)){const s=require('fs').readFileSync(f,'utf8');console.log(f,'crlf',s.split('\r\n').length-1,'bareLF',s.split('\n').length-s.split('\r\n').length)}" AGENTS.md README.md DESIGN.md docs/contexts/ui-and-e2e.md docs/audit/decisions/0103-paper-ledger-light-theme.md docs/audit/refactor-log.md docs/audit/baseline-metrics.md docs/audit/task-ledger.md
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
(Get-Content docs/audit/task-ledger.md).Count; (Get-Content docs/audit/refactor-log.md).Count; (Get-Content docs/audit/baseline-metrics.md).Count
git status --porcelain
```

Expect:
- Unit: 66 files, 1475 passed, 0 failed.
- Playwright list: `Total: 543 tests in 35 files`.
- Bundle: `index-TU2ZOqF8.js 193293 56428`, `index-BNXJTUPd.css 53895 10526`, `allJS 884987 268756 39`. Any difference: report it, do not write the metrics block (6a step 6).
- Ports 3000 and 3100 free before the run.
- Full Playwright: 0 failed; expect 537 passed, 6 skipped. Any failure: rerun the failing spec once alone on its project and report both results; do not write the counts until the owner or reviewer decides.
- Shas: `eddfd96`, `c702aef`, `c5c2358`, `45b9e87`.
- `git diff -U0`: `AGENTS.md` one changed line; `README.md` three; `ui-and-e2e.md` one changed and one added; `DESIGN.md` two changed; the ADR: two changed lines, one inserted line, and the appended blank line and item 3. Nothing else.
- Both `git grep` checks: no output.
- All eight files `w/crlf`, `bareLF 0`.
- Em dash count: `0`.
- Line counts: each file under about 150.
- `git status --porcelain`: only the 7 Target files, `docs/audit/task-ledger.md` and `workflow/stages/*/output/` files (`dist/` is gitignored).

## 8. Production touch points

none. (`AGENTS.md` triggers the automatic pause; it is not a production touch point.) The full Playwright run is hermetic and spends no TypeSafe credits; it signs in nowhere. The owner's post-merge deploy record on `main` later fills the `<sha>` placeholders in `refactor-log.md`, the T796 Commit cell, the branch line `:84`, and the `Measured at` line in `baseline-metrics.md`.

## 9. Out of scope

- Any code, test, config, script or SQL file, including the code nits listed under Deliberately not done (import order, the `ColorGrid.tsx` duplicate import, the `identityPalette.ts` header wrap, the blank line in `unit/wallets-page.test.tsx`); `.claude/agents/`; the `workflow/stages/*/CONTEXT.md` files.
- Any other line of `AGENTS.md`, `README.md`, `DESIGN.md` or `docs/contexts/ui-and-e2e.md`; a second copy of the `identityDisplayColor` rule anywhere; putting the theme-variable rule in `AGENTS.md` or `DESIGN.md`.
- ADR 0103's Status, Context, D1 to D8, Consequences, Deliberately not done and Amendment (T794); the ADR Context `useTheme.ts` note.
- The T792 to T795 rows' Task, Files, Status and Gate result cells; the Phase 143 heading and branch line; earlier phases; every Backlog row.
- Historical counts in earlier `refactor-log.md` and `baseline-metrics.md` entries, ADRs and stage outputs.
- Archiving any `docs/audit/` file; any request to production `/api/*`; any live Supabase SQL.
