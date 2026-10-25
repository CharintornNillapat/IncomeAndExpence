# Review: T807

## Round 1

### 1. Metadata

- Task: T807, shell dialogs mount at idle, so a first open is instant (ADR 0108)
- Date: 2026-10-25
- Round: 1
- Verdict: APPROVED
- Branch: `phase-148-add-entry-close` (HEAD `45b6c24`)
- Target files: `docs/audit/decisions/0108-shell-dialogs-mount-at-idle.md`, `src/App.tsx`, `tests/tab-preload.spec.ts`, `docs/contexts/ui-and-e2e.md`, `docs/audit/test-selector-contract.md`; bookkeeping `docs/audit/task-ledger.md`. `git check-ignore -v` on all five targets: none ignored (exit 1).

### 2. Summary

The idle callback that already preloads the tab views (ADR 0104) now also flips the four `hasOpened*` latches, so `QuickAddModal`, `TransferFundsModal`, `AddWalletModal` and `AccountModal` mount closed at idle. A first open then only flips `isOpen` and commits in the click's own update, instead of mounting a `Suspense` boundary and waiting out React's 300 ms reveal throttle, the gap in which a repeat click lands on the scrim and closes the dialog. Four Playwright tests check that each dialog is on the page one macrotask after a DOM click; ADR 0108 records the cause and the decision, and the two docs lines follow.

### 3. Invariants and parity

- `src/App.tsx` diff: exactly edits A, B and C from spec section 4 item 7, text identical; no other hunk. The open handlers (`:165-188`), the `?action=quick-add` effect, the lazy imports and the JSX gates are unchanged.
- Effect cleanup: the arrow returns `runWhenIdle(...)`, whose return value cancels the idle callback or timer (`src/utils/lazyView.tsx:50-62`), so an unmount before idle still cancels it, as before.
- Mounted-closed cost: `AccountModal`'s body (with its `useEffect` and `loadSupabase` use) is `AccountModalBody`, rendered as `Modal` children, which `Presence` renders only when open. `QuickAddModal` and `AddWalletModal` have no effects; `TransferFundsModal`'s only effect is `useTransientFlash`'s timer cleanup on unmount. Nothing runs while closed beyond context subscription, which the ADR's Consequences cover.
- Guest supabase-js: `src/lib/supabase.ts` imports `@supabase/supabase-js` as a type and loads it dynamically (`:89`), so mounting `AccountModal` at idle puts no supabase code on a guest's load. `tests/auth.spec.ts`'s guest check passed on three browsers in the full run.
- Parity row "Spec-asserted DOM ids": the four trigger ids the new tests use are added to the `tab-preload.spec.ts` line of `docs/audit/test-selector-contract.md` (sorted, as the rest of the file). No other parity row is touched (no money path, `api/`, `supabase/`, types, `index.html`, `vercel.json`).
- AGENTS.md non-negotiables: no state or animation library, no `React.memo`, relative imports, no user-facing text changed.
- Docs: `docs/contexts/ui-and-e2e.md` and `docs/audit/test-selector-contract.md` each change exactly one line, text as in the spec. `ui-and-e2e.md:67` counts untouched (T808).
- Line endings: `git ls-files --eol` shows `w/crlf` on `src/App.tsx`, `tests/tab-preload.spec.ts`, `docs/contexts/ui-and-e2e.md`, `docs/audit/test-selector-contract.md`, `docs/audit/task-ledger.md`. ADR 0108: crlf 47, bare-lf 0.
- Em dashes: 0 in the added lines of `git diff -U0 HEAD`; 0 in ADR 0108, the build report, the spec and every touched file.
- Ledger: Phase 148 section added after Phase 147 and before `## Backlog`, with the branch line, T807 `done` and T808 `todo`, as the spec asked.

### 4. Gates run

Ports 3000 and 3100 checked free before Playwright and again after the full run (no listener).

| Command | Result | Log |
|---|---|---|
| `npm run lint` | clean (node-globals 133 files, safe-ids 133 files, both `tsc` runs clean), exit 0 | `workflow/stages/03_review/output/logs/T807-lint.log` |
| `npm run test:unit` | 69 files passed, 1510 tests passed, 0 failed (108.19s) | `workflow/stages/03_review/output/logs/T807-unit.log` |
| `npx playwright test tests/tab-preload.spec.ts --project=chromium` | 6 passed (20.2s) | `workflow/stages/03_review/output/logs/T807-tab-preload-chromium.log` |
| `npx playwright test tests/tab-preload.spec.ts` | 18 passed, three browsers (47.5s) | `workflow/stages/03_review/output/logs/T807-tab-preload-all.log` |
| `npm test` | 561 runs (187 tests x 3 browsers, 36 files per `--list`): 555 passed, 6 skipped, 0 failed, 0 flaky (10.4m) | `workflow/stages/03_review/output/logs/T807-e2e.log` |

Red run (step 6): `git status --porcelain` recorded; `git stash push -- src/App.tsx` (`w/crlf`, so allowed); `npx playwright test tests/tab-preload.spec.ts --project=chromium` gave 4 failed, 2 passed (46.3s), each of the four new tests at `tests/tab-preload.spec.ts:113` with `Expected: true, Received: false`, as the spec predicts. `git stash pop --index`; `git status --porcelain` identical to the recorded one (diff empty), `git diff --stat src/App.tsx` back to 24 insertions, 9 deletions. Log: `workflow/stages/03_review/output/logs/T807-red.log`.

The builder pane's "1 failed" command is consistent with its own red run (an expected failure); every gate is green in my runs.

### 5. Not verified

- The production behaviour itself: whether a signed-in owner on a real device still sees the popup close after one press. The fix removes the 300 ms gap the spec measured; spec section 8's post-deploy check by the owner is the only proof for production, and stays the owner's.
- The click-before-idle residual (accepted in the ADR's Not done) is not exercised by any test.
- The ~29 KB modal-chunk figures in the ADR came from the spec's build measurement; I did not rebuild (no gate asks for it, and T808 records bundle figures).

### 6. Blocking

None.

### 7. Non-blocking

- `docs/audit/decisions/0108-shell-dialogs-mount-at-idle.md`, Context item 5 ends "The sole cause is the repeat tap landing on the scrim due to Suspense boundary reveal latency." The spec and the owner treat it as the probable cause, pending the production check in spec section 8. T808 could soften it to "the only close path found" when it fills the Verification line with counts.
- ADR 0108's Verification line gives no counts; T808, which writes the phase figures, can add 1510 / 69 unit and 555 passed, 6 skipped of 561 runs.

### 8. Rule candidates

- None new. The `ui-and-e2e.md` Shell modals bullet already carries the rule (a click that mounts a `Suspense` boundary waits out the 300 ms reveal throttle), and the code complies.
