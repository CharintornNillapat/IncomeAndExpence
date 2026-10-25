## Round 1

### 1. Metadata

- Task: T803, Phase 146 (`phase-146-no-blink`)
- Date: 2026-10-24
- Round: 1
- Verdict: APPROVED
- Target files: `docs/audit/decisions/0106-instant-tabs-and-popups-open-without-motion.md`, `src/App.tsx`, `src/index.css`, `src/components/Modal.tsx` (comments only), `tests/reduced-motion.spec.ts`, `docs/contexts/ui-and-e2e.md`, `docs/audit/task-ledger.md`. None is git-ignored (`git check-ignore -v` printed nothing).

### 2. Summary

Tab switches no longer go through `Presence`/`motion-page` (no direction state, no `--page-dir`, `key={activeTab}` kept). The popup entrance keyframes and rules are deleted; the exit tweens, `Presence` in `Modal`, the chip rules and the reduced-motion block (minus `.motion-page`) stay. The reduced-motion spec now pins that the four removed animations never start. `Modal.tsx` changed only two comments, which the spec allowed.

### 3. Invariants and parity

- Parity map: no row touched (spec says none). Confirmed: no money path, no `supabase/`, no `api/`.
- Scope: `git status --porcelain` shows the 7 listed files plus the task's own spec/build output; no unannounced file. `Presence` and `unit/motion.test.tsx` untouched.
- `App.tsx`: the `Presence` import and `direction` state are gone; `TAB_ORDER` is still used (`handleNextTab`/`handlePrevTab`); `showTab` has `[]` deps; `tsc` clean (lint exit 0).
- `index.css`: the exit rules (`.motion-scrim[data-leaving]`, `... .motion-sheet`) are intact, and `.motion-scrim,.motion-sheet` stay in the reduced block so the exit is still off under reduced motion (covered by the passing reduced-motion run).
- ADR 0106 exists before the code, with Context, Decision, Amends, Verification and Not done.
- Em dashes: 0 in added lines (`git diff -U0 HEAD`) and 0 in ADR 0106.
- Line endings: the six tracked files are `i/lf w/crlf`, as before. ADR 0106 (untracked) has no CR (w/lf), unlike ADR 0105 (w/crlf). The build report claims CRLF on all 7 files, which is wrong for the ADR. See Non-blocking.
- Counts: `npx playwright test --list` gives `Total: 549 tests in 36 files`. No test was added, so the count docs hold. The unit count is 1506 / 68 files, as documented.

### 4. Gates run

- `npm run lint`: exit 0 (node-globals 133 files, safe-ids 133 files, both `tsc` clean).
- `npx vitest run unit/motion.test.tsx unit/modal-focus.test.tsx`: 2 files, 37 passed.
- `npm run test:unit`: 68 files, 1506 passed, 0 failed. Log: `workflow/stages/03_review/output/logs/T803-unit.log`.
- Playwright, 8 specs, `--project=chromium`: 46 passed. Log: `.../logs/T803-pw-chr.log`.
- Playwright, same 8 specs, three browsers: 136 passed, 2 skipped, 0 failed. Log: `.../logs/T803-pw-all.log`.
- Red check (stage 03 step 6): `git stash push -- src/App.tsx src/index.css src/components/Modal.tsx` (all `w/crlf`, so none left out), then `npx playwright test tests/reduced-motion.spec.ts --project=chromium`. 1 failed, 1 passed. The failure was `expect(names).not.toContain('motion-page-in')`, with received `["motion-page-in","slide","motion-rise-in","motion-fade-in","motion-rise-out","motion-fade-out","slide","motion-page-out","motion-page-in"]`. After `git stash pop --index`, `git status --porcelain` was identical to the pre-stash capture. Log: `.../logs/T803-red.log`. With the change applied, the reduced-motion spec passes in both runs above.
- Full `npm test`: not rerun by me (see Not verified). The builder's log `workflow/stages/02_build/output/logs/T803-playwright.log` ends `6 skipped, 543 passed`.

### 5. Not verified

- Full `npm test` (549 runs): I did not repeat the 10-minute run. I ran the spec's eight affected specs on all three browsers and read the builder's full-run log tail. The change is CSS and a view wrapper, so the affected-spec run covers it.
- No visual check on Brave desktop; the Playwright animation recording is the evidence that no entrance keyframes start.

### 6. Blocking

None.

### 7. Non-blocking

- `docs/audit/decisions/0106-...md`: the file is LF on disk while sibling ADRs are CRLF (`git ls-files --eol` shows `i/lf w/crlf` for 0105), and the build report says CRLF was verified on all 7 files. The staged blob normalises to LF under autocrlf, so it is harmless in git; the builder may convert it to CRLF for consistency.
- `src/App.tsx` comment above `<main>` still says "Touch Swipe Gestures & Suspense" and keeps the 84 history, which is fine; no change needed.

### 8. Rule candidates

None. `docs/contexts/ui-and-e2e.md:24` already carries the new motion sentence [0106].
