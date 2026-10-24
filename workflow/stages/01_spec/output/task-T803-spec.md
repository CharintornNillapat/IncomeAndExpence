# Spec: T803

Phase 146, branch `phase-146-no-blink`, cut from `main` at `d0e8c69`. First task of the phase. T803 is free: the ledger's highest id is T802 (`docs/audit/task-ledger.md:112`) and no `task-T803-*` exists. The next ADR is 0106 (`ls docs/audit/decisions` ends at `0105-one-cloud-load-per-session.md`).

## 1. Goal

Switching tabs shows the new page in the same frame, with no blank gap and no slide, and every popup (Modal) appears at once without fading in or rising. The owner reported both as "blinking" on Brave desktop.

## 2. Target files

```
docs/audit/decisions/0106-instant-tabs-and-popups-open-without-motion.md
src/App.tsx
src/index.css
src/components/Modal.tsx
tests/reduced-motion.spec.ts
docs/contexts/ui-and-e2e.md
```

- The ADR is written first, before any code (AGENTS.md workflow).
- Bookkeeping, always allowed: `docs/audit/task-ledger.md`. It has no Phase 146 section yet: the builder adds one from the file's "Template for the next phase" block (heading `## Phase 146 - Instant tabs and popups (ADR 0106)`, a branch line `Branch \`phase-146-no-blink\`, cut from \`main\` at \`d0e8c69\`.`, then the T803 row, Status `done` at the end of the build).
- Not targets: `src/components/ui/motion.tsx` (Presence stays, Modal and the chips still use it), `unit/motion.test.tsx` (it tests Presence, which does not change).
- Not on the pause list: no money path, no `supabase/`, no `api/`, no `AGENTS.md`, no CONTEXT.md. The orchestrator sends `build T803` without asking.

## 3. Context to read

`docs/contexts/ui-and-e2e.md` (components, modals, Playwright). `DESIGN.md` MOTION dial only (`DESIGN.md:8-11`). ADRs 0082, 0026 (motion section, `:60-75`), 0010 and 0005 are cited below; read 0082 in full, the others only at the lines named.

## 4. Current behaviour

1. **Tab switch blanks the page for 200 ms.** `src/App.tsx:318-324` renders `<Suspense><Presence><div key={activeTab} className="motion-page w-full">{renderActiveView()}</div></Presence></Suspense>`. `Presence` (`src/components/ui/motion.tsx:30-61`) keeps the old keyed child mounted for `exitMs` (200, `motion.tsx:12`) marked `data-leaving`, and only then mounts the next key (`motion.tsx:37-47`, `:49-58`). During those 200 ms the old page plays `motion-page-out` (to opacity 0, `src/index.css:482-484`, `:497`), so the page is blank until the new one starts `motion-page-in` (from opacity 0, `:479-481`, `:496`) and fades back in. That is the blink. The slide direction comes from `direction` state (`App.tsx:40`), set in `showTab` (`App.tsx:106-114`, line `:110`) and read as `--page-dir` on `<main>` (`App.tsx:315`).
2. **Popups fade and rise in.** `Modal` wraps its scrim and panel in `Presence` (`src/components/Modal.tsx:351-412`). The scrim has `motion-scrim` (`:354`) and the panel `motion-sheet` (`:372`). `index.css:492` plays `motion-fade-in` 200 ms on the scrim, `:494` plays `motion-rise-in` (opacity plus 24 px) on the sheet. Exit: `:493` and `:495` play `motion-fade-out` and `motion-rise-out` while `Presence` holds the element with `data-leaving`. `Modal` is the one dialog primitive (`docs/contexts/ui-and-e2e.md:36`), so this reaches Quick Add (`#navbar-quick-add-btn`), Auth, Account, Transfer, Add wallet and every confirmation.
3. **Reduced motion** already skips all of it: `index.css:505-514` sets `animation: none !important` on `.motion-scrim`, `.motion-sheet`, `.motion-page`, `.motion-chip`; `Presence` swaps at once (`motion.tsx:42-44`).
4. **Tests that touch this.** `tests/reduced-motion.spec.ts:66-74` (`ALL`) requires the non-reduced run to record `motion-page-in`, `slide`, `motion-fade-in`, `motion-rise-in`, `motion-fade-out`, `motion-rise-out`, `motion-page-out` (`:76-81`); the reduced run requires none (`:86-93`). `unit/motion.test.tsx` tests `Presence` and `slidePill` with its own boxes, not `App` or `Modal`, and stays valid. Searched `tests/` and `unit/` for `motion-page`, `motion-scrim`, `motion-sheet`, `data-leaving`, `page-dir`: only the two files above (`tests/reduced-motion.spec.ts:67,73`; `unit/motion.test.tsx` `data-leaving` on its own boxes). `tests/helpers.ts:5-10` (`settle`) waits for finite animations to end; with fewer animations it returns sooner and needs no change. `unit/modal-focus.test.tsx:294` mentions the exit tween only in a comment about controls staying in the DOM; the exit is kept, so it holds.
5. **ADR trail.** ADR 0082 made the tweens CSS and kept framer's values (200 ms). ADR 0026 (`:60-75`) turned the tab slide into a 200 ms `easeOut` tween with no scale. ADR 0010 requires the shell modals to stay mounted for their exit (`{hasOpened && ...}` latch). ADR 0005 keeps the view remount on tab change (`key={activeTab}`). `DESIGN.md:11` already says MOTION 1: "hover, focus, and 150 to 200ms state transitions only"; `docs/contexts/ui-and-e2e.md:24` says "no entrance animations". The page slide and the sheet entrance contradict both.

## 5. Parity map

none.

## 6. Tests to add

Red first, as the task also changes `src/`: the builder edits the spec before the source, runs it against the unfixed code and saves the failure to `workflow/stages/02_build/output/logs/T803-red.log`; the reviewer repeats it with the usual stash of the non-test files.

Both changes are in `tests/reduced-motion.spec.ts` (a Playwright spec is the only place keyframes and `animationstart` exist; jsdom runs no CSS animation):

1. **Replace `ALL`** (`:66-74`) with `['slide', 'motion-fade-out', 'motion-rise-out']`, the animations that remain, keep `expect.arrayContaining(ALL)` and the `busyAnimations` check, and rename the test (`:76`) to `'the period pill animates and a dialog fades out on close'`. On its own this passes today (a superset is recorded), so step 2 is what fails.
2. **In the same test, after the `expect.poll` (`:79`)**, read `const names = await page.evaluate(() => window.__motion);` and assert each of `'motion-page-in'`, `'motion-page-out'`, `'motion-fade-in'`, `'motion-rise-in'` is `not.toContain`ed in `names`. One test, no new `test(...)`, so the Playwright count stays 183 / 549 and no count doc changes. Why it fails today: `motion-page-in` fires on the first mount and every tab change, `motion-page-out` on every tab change, `motion-fade-in` and `motion-rise-in` on every dialog open (`index.css:492,494,496,497`).
3. **Temporary edit to repeat the red state after the build** (reviewer, stage 03 step 6): `git stash` the non-test target files (`src/App.tsx`, `src/index.css`, `src/components/Modal.tsx`), run `npx playwright test tests/reduced-motion.spec.ts --project=chromium`; the new test must fail naming one of the four animations. Restore the stash.

No unit test is added: `Presence` is unchanged and jsdom cannot see keyframes.

## 7. Gates

Changed paths: `src/App.tsx`, `src/components/Modal.tsx`, `src/index.css`, `tests/`, docs. Union of tiers:

```
npm run lint
npx vitest run unit/motion.test.tsx unit/modal-focus.test.tsx
npm run test:unit
npx playwright test tests/reduced-motion.spec.ts tests/routing.spec.ts tests/tab-preload.spec.ts tests/layout-stability.spec.ts tests/account-and-mobile-nav.spec.ts tests/toast-layering.spec.ts tests/wallet-forms.spec.ts tests/transaction.spec.ts --project=chromium
npx playwright test tests/reduced-motion.spec.ts tests/routing.spec.ts tests/tab-preload.spec.ts tests/layout-stability.spec.ts tests/account-and-mobile-nav.spec.ts tests/toast-layering.spec.ts tests/wallet-forms.spec.ts tests/transaction.spec.ts
```

Also, because `Modal` and the app shell sit under every spec, one full run on three browsers before handing back: `npm test`. Save full-suite output with `tee` under `workflow/stages/02_build/output/logs/`. Check ports 3000 and 3100 for stale dev servers first. Never edit `src/` while Playwright runs.

Other checks:

- Docs count check: the edited `ui-and-e2e.md` line states no count; no unit or Playwright test is added, so `AGENTS.md`, `README.md` and `ui-and-e2e.md:66` counts (1506 unit, 183 / 549 Playwright) stay. Confirm with `npx playwright test --list` (expect `Total: 549 tests in 36 files`).
- `git ls-files --eol` on each changed file: `w/crlf` kept.
- Em dash count in added lines via the Node one-liner from stage 01 CONTEXT: 0.

## 8. Production touch points

none. No SQL, no `/api/*`, no `vercel.json`, no dependency.

## 9. Edits (exact)

1. **ADR `0106-instant-tabs-and-popups-open-without-motion.md`**, first. Status: Accepted (the builder fills commit hashes later, as the other ADRs do). Sections: Context (the owner's blink report; sections 4.1 and 4.2 of this spec), Decision (below), Amends (0082: the `motion-page` tween and the `motion-scrim`/`motion-sheet` entrances go, the exit tweens stay; 0026 `:60-75`: the tab slide is removed; keeps 0005 and 0010), Verification (the red and green runs), Not done. Decision text:
   - **A tab change is instant.** `App.tsx` drops `Presence`, the `motion-page` class and the `--page-dir` direction. `key={activeTab}` stays (ADR 0005), so the view still remounts and `Suspense` still shows `#view-loading-fallback` only while a lazy chunk is missing (ADR 0104 preloads them).
   - **A popup opens instantly; it still fades out.** `Modal` keeps `Presence`, `motion-scrim`, `motion-sheet` and the `data-leaving` exit (so ADR 0010 and focus return in `Modal.tsx:203-231` are untouched). Only the entrance keyframes are removed.
   - Why the exit stays: the owner's report is about the page going blank on open and on tab switch; a closing dialog leaves a page that is already showing, so there is no blank frame. If the owner also dislikes the close fade, removing it is one more line in `index.css` plus dropping `Presence` from `Modal`, and ADR 0010's latch can then stay unchanged.
2. **`src/App.tsx`**:
   - Delete `import { Presence } from './components/ui/motion';` (`:6`).
   - Delete `const [direction, setDirection] = useState<number>(0);` (`:40`).
   - Replace `showTab` (`:106-114` through its closing `[activeTab]` deps) with a stable callback with no dependencies: `const showTab = useCallback((newTab: ActiveTab) => { setActiveTab(newTab); }, []);`. Rewrite the comment above it (`:101-105`, which says it depends on `activeTab` to compute `direction`) to say only that it is stabilised so the navbars and views do not get a new function each render. `TAB_ORDER` stays imported: `handleNextTab` and `handlePrevTab` (`:147-154`) still use it.
   - In `<main>` (`:313-317`) delete the `style={{ '--page-dir': direction } as React.CSSProperties}` line. If `React` becomes unused as a namespace, `tsc` says so; leave imports as `tsc` requires.
   - Replace `<Presence><div key={activeTab} className="motion-page w-full">{renderActiveView()}</div></Presence>` (`:319-323`) with `<div key={activeTab} className="w-full">{renderActiveView()}</div>` inside the same `Suspense`.
   - Rewrite the two comments `:304-312`: drop "Framer Slide Animations" and the sentence about "a tab's exit tween empties it" (the min-height rule still serves the lazy-chunk wait); delete the `--page-dir` comment block (`:310-312`).
3. **`src/index.css`**: delete `@keyframes motion-fade-in`, `motion-rise-in`, `motion-page-in`, `motion-page-out` and the rules `.motion-scrim { ... }` (`:492`), `.motion-sheet { ... }` (`:494`), `.motion-page { ... }`, `.motion-page[data-leaving] { ... }` (`:496-497`), and the `--page-dir` comment (`:477-478`). Keep `motion-fade-out`, `motion-rise-out`, `motion-drop-in`, `motion-drop-out`, the two `[data-leaving]` Modal rules (`:493`, `:495`) and the chip rules. In the reduced-motion block (`:505-514`) delete only `.motion-page,`; keep `.motion-scrim,` and `.motion-sheet,` (the leaving rules `:493`, `:495` have higher specificity than the plain class, but the `!important` on the plain class in that block still wins, which is what turns the exit off). Update the comment block `:458-464` to say entrances were removed in Phase 146 (ADR 0106) and only exits and the chip remain.
4. **`src/components/Modal.tsx`**: no logic change. Update nothing unless a comment there says the dialog "rises" or fades in (`grep -n "fade\|rise\|entrance\|tween" src/components/Modal.tsx`); reword those to "the exit tween". If none, leave `Modal.tsx` untouched and drop it from the build report's changed files (it stays on the allowlist only for such comments).
5. **`docs/contexts/ui-and-e2e.md:24`**: append to the motion bullet, before the final sentence about reduced motion: `A tab change and a dialog opening are instant; only a dialog's close and the suggestion chips tween [0106].` Keep the rest of the line byte for byte.
6. **`tests/reduced-motion.spec.ts`**: as section 6, with the assertions folded into the one existing test; also update the header comment (`:4-11`) to say the page and the dialog's entrance no longer animate and the spec pins that.

## 10. Out of scope

- Removing the dialog's close fade, the chip tweens (`motion-chip`, 150 ms), `slidePill` or the period/nav pill slide.
- `Presence`'s code or `unit/motion.test.tsx`.
- The Suspense fallback / lazy-chunk wait on a cold tab (ADR 0104 handles preloading); if the owner still sees a flash on a never-visited tab after this, that is a separate task.
- Any change to `MOTION_MS`, theme tokens, `DESIGN.md`, `AGENTS.md`, `README.md`.
- Adding or renaming any DOM id (`docs/audit/test-selector-contract.md` is unaffected).
- Refactor log and baseline metrics: the task that ships the phase writes them (this task is not documented as shipping the phase).
- Do not edit `src/` while Playwright runs.
