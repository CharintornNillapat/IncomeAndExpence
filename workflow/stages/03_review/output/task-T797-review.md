# Review: T797

## Round 1

**Metadata:** task T797, date 2026-10-23, round 1, verdict APPROVED. Target files: `docs/audit/decisions/0104-preload-tab-views.md`, `src/utils/lazyView.tsx`, `src/App.tsx`, `unit/lazy-view.test.tsx`, `tests/tab-preload.spec.ts`, `tests/helpers.ts`, `docs/audit/test-selector-contract.md`, `docs/contexts/ui-and-e2e.md`, `docs/audit/task-ledger.md`. None is git-ignored (`git check-ignore -v` printed nothing).

**Summary:** The six tab views move from `React.lazy` to a new `lazyView` helper (memoised promise read with `use()`, marked `status = 'fulfilled'` on settle), and `MainApp` preloads all six through `runWhenIdle`. The modals stay on `React.lazy`. The ADR, ledger row, selector-contract bullet, context bullet and `gotoTab` comment are in place. `Suspense`, `Presence`, `key={activeTab}`, `motion-page` and `ViewLoadingFallback` are untouched.

**Invariants and parity:**
- Parity map: no row touched. No id renamed or removed; the contract gets one new bullet for the new spec.
- Scope: `git status --porcelain` and `git diff --stat` show only the 9 listed files plus the spec and build bookkeeping. No unannounced change.
- `lazyView.tsx` full text read: one `load()` per memo, a rejection clears the memo and rethrows to `use()`, `preload` never rejects. Matches section 4a.
- `App.tsx`: import expressions are literal in `App.tsx`, six separate chunks. The preload effect returns the cancel function, so StrictMode cleanup is correct. `lazy` is still imported for the four modals.
- No dependency added. CRLF kept (the 5 tracked files are `i/lf w/crlf`; the 4 new files have 0 lone LF). Em dashes: 0 in the added diff lines and in the 4 new files.
- Test 2 of the spec uses `gotoTab` and a MutationObserver, with no `waitForTimeout`.

**Gates run (my own runs, logs in `workflow/stages/03_review/output/logs/`):**
- `npm run lint`: clean (node-globals 133 files, safe-ids 133 files, both tsc runs).
- `npx vitest run unit/lazy-view.test.tsx`: 1 file, 5 passed.
- `npm run test:unit`: 67 files, 1480 passed, 0 failed (`T797-unit.log`).
- `tab-preload.spec.ts` chromium: 2 passed (`T797-pw-new.log`).
- `--repeat-each=5` chromium: 10 passed (`T797-pw-repeat.log`).
- Spec's 7-file group, chromium: 53 passed (`T797-pw-chr.log`).
- Spec's 7-file group, all 3 browsers: 153 passed, 6 skipped (`T797-pw-3b.log`).
- `npm test`: 549 runs, 543 passed, 6 skipped, 0 failed (`T797-e2e.log`).
- Clean build (`.env` present): entry `index-CKmfyoLI.js` 194,042 B raw / 56,699 B gzip (+749 B, limit 1,500); all app JS 885,736 B (+749 B, limit 2,500); 39 files; 6 separate view chunks; 0 view names in `dist/index.html`. All pass.
- Red check: stashed `src/App.tsx` only (it is `w/crlf`, so the pop is safe), ran `tab-preload.spec.ts` on chromium: 2 failed, with `Expected - 5 / Received + 0` (only Dashboard requested); `T797-pw-red.log`. After `git stash pop --index`, `git status --porcelain` was identical to the pre-stash record. The unit file is red by absence of `lazyView.tsx` (untracked, so not stashable); not separately re-run red.

**Not verified:**
- The unit file's red run was not reproduced, because `lazyView.tsx` is a new untracked file. Its test 2 (fallback render counter) was not mutation-tested against a `React.lazy` swap.
- No Safari-native `requestIdleCallback`-absent run; the `setTimeout` fallback is covered only by the fake-timer unit case.

**Blocking:** none.

**Non-blocking:**
- `src/utils/lazyView.tsx` `runWhenIdle`: the second branch (global `requestIdleCallback`) duplicates the `window` branch in browsers. It can be dropped for a shorter helper; harmless.
- Build report lists the unit test names differently from the actual file (for example "renders the component after dynamic import resolves" is not a test title). The tests themselves match spec section 6. The report's targeted Playwright spec list also differs from the spec's gate list; I ran the spec's list.

**Rule candidates:** none beyond the bullet already added to `docs/contexts/ui-and-e2e.md`.
