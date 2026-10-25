# Spec: T807

Phase 148, branch `phase-148-add-entry-close`, cut from `main` at `45b6c24`. First task of the phase. T807 is free: the ledger's highest id is T806 (`docs/audit/task-ledger.md:130`) and no `task-T807-*` exists. The next free ADR number is 0108 (the last is `0107-ask-before-updating-the-offline-app.md`). The order names no Backlog row, so no Backlog status changes.

## 1. Goal

Signed in on production, the entry popup that Navbar's "Add entry" opens closes again right after the first page load. Find why, and make the first open of that popup (and of the three other shell popups that share its mounting) appear at once, so it stays open.

## 2. Target files

```
docs/audit/decisions/0108-shell-dialogs-mount-at-idle.md
src/App.tsx
tests/tab-preload.spec.ts
docs/contexts/ui-and-e2e.md
docs/audit/test-selector-contract.md
```

- The ADR is written first, before any code (AGENTS.md workflow). CRLF, like `0107` (`w/crlf`). Content:
  - `# 0108: Shell dialogs mount at idle, so a first open is instant`, `**Status:** Accepted`, `**Date:** 2026-10-25`.
  - Context: section 4 below, items 1 to 6, in prose (the owner's report, the 300 ms throttle, the repeat click on the scrim, the measurements, what was ruled out).
  - Decision: the idle callback that preloads the tab views also flips the four `hasOpened*` latches, so `QuickAddModal`, `TransferFundsModal`, `AddWalletModal` and `AccountModal` mount closed at idle; a first open after that only flips `isOpen` and commits in the click's own update. The open handlers keep setting their latch, for a click before idle.
  - Amends: ADR 0010 (the latches now also flip at idle; its "Revisit if" second bullet, an idle-time prefetch to remove first-tap latency, is what this does) and ADR 0104 (its idle callback also mounts the shell dialogs).
  - Verification: the four new tests in `tests/tab-preload.spec.ts` (section 6), red before and green after on three browsers.
  - Consequences: every load, guest included, fetches the four modal chunks at idle (production build: `QuickAddModal` 2,497 B, `TransferFundsModal` 6,986 B, `AddWalletModal` 2,955 B, `AccountModal` 16,577 B, about 29 KB raw; `TransactionForm` and the other shared chunks are already fetched by the tab-view preload); the entry chunk does not change. `QuickAddModal` and `TransferFundsModal` subscribe to finance state from idle instead of from first open, so they re-render on a ledger write while closed; closed, `Modal` renders nothing (`Presence` returns null), so that render is cheap, and it is what already happens after a first open today.
  - Not done: a click before the idle callback runs still mounts the boundary and takes the slow path (in the measured runs idle came about 240 ms after navigation; the cap is `runWhenIdle`'s 3 s timeout); no guard on the scrim click (a click outside the dialog closing it is the intended behaviour); no loading state on the trigger buttons; supabase-js stays out of a guest's load (none of the four modules imports it at runtime).
- `src/App.tsx`: the three edits in section 4, item 7, exactly as written there. No other line changes.
- `tests/tab-preload.spec.ts`: the test block in section 6, added inside the existing `test.describe`, after the second test.
- `docs/contexts/ui-and-e2e.md:43`: replace the whole bullet with this one line. Do not change line 67's counts; T808 does.
  ```
  - **Shell modals** (`QuickAddModal`, `TransferFundsModal`, `AddWalletModal`, `AccountModal`) sit behind `React.lazy` and a `hasOpened` latch that never resets [0010]. The latch flips at idle, in the callback that preloads the tab views, so each mounts closed and a first open only flips `isOpen` [0108]: a click that mounts a `Suspense` boundary waits out React's 300 ms reveal throttle. A bare `{isOpen && <Modal/>}` kills the exit tween.
  ```
- `docs/audit/test-selector-contract.md:53`: replace the line with this one.
  ```
  - `tab-preload.spec.ts`: ids `#dashboard-wallets-add-btn`, `#dashboard-wallets-transfer-btn`, `#nav-tab-*`, `#navbar-account-btn`, `#navbar-quick-add-btn`, `#view-loading-fallback`
  ```
- Bookkeeping, always allowed: `docs/audit/task-ledger.md`. It has no Phase 148 section yet: add one from the file's "Template for the next phase" block, after Phase 147's section and before `## Backlog`, heading `## Phase 148 - Add entry stays open on first open (ADR 0108)`, a branch line like Phase 147's (`Branch \`phase-148-add-entry-close\`, cut from \`main\` at \`45b6c24\`.`), and rows T807 (this task) and T808 (Phase 148 closing docs: refactor-log entry, baseline-metrics section, T807 Commit cell, Playwright counts in `AGENTS.md`, `README.md` and `docs/contexts/ui-and-e2e.md`; status `todo`). Set T807 to `in-progress` at start and `done` with the gate result at the end.
- Not targets: `src/components/Modal.tsx`, `src/utils/modalHistory.ts`, `src/utils/lazyView.tsx`, `src/components/QuickAddModal.tsx` and the other three modal files, `src/components/Navbar.tsx`, `src/components/MobileBottomNav.tsx`, `src/components/ReloadPrompt.tsx`, `vite.config.ts`, `AGENTS.md`, `README.md`.
- Pause rule: no money path, nothing under `supabase/`, `api/` or `.claude/agents/`, no `AGENTS.md`, no CONTEXT.md, Production touch points `none`. The orchestrator sends `build T807` without asking.

## 3. Context to read

`docs/contexts/ui-and-e2e.md` (App.tsx, modals, the Playwright rules: no fixed waits, hermetic, ports). ADR 0010 (`docs/audit/decisions/0010-deferred-shell-modal-mounting.md`, the latch design and its "Revisit if" section) and ADR 0104 (`0104-preload-tab-views.md`, the idle preload), so the new ADR amends them correctly. Not needed: `DESIGN.md` (nothing looks different), `client-state.md` (no state, hook or money rule changes; `FinanceContext.tsx` is not touched).

## 4. Current behaviour

1. **The first open of a shell dialog mounts a Suspense boundary.** `src/App.tsx:30-34` makes the four shell modals `React.lazy` imports. Each renders only behind its latch: `{hasOpenedQuickAdd && (<Suspense fallback={null}><QuickAddModal isOpen=... /></Suspense>)}` (`:338-347`; the same for Transfer `:350-358`, Add Wallet `:359-363`, Account `:364-368`). The latches start `false` (`:56-60`) and flip only in the open handlers (`handleOpenQuickAdd` `:151-154`, `handleOpenTransfer` `:159-163`, `handleOpenAddWallet` `:165-168`, `handleOpenAccount` `:170-173`). So the click on "Add entry" (`src/components/Navbar.tsx:168-176`, `onClick={onOpenQuickAdd}`) mounts the boundary; `React.lazy` suspends on its first render even when the module is already cached, and the boundary commits its `null` fallback.
2. **React then holds the dialog back for at least 300 ms.** react-dom 19.2.8 throttles a retry that reveals Suspense content to 300 ms after the most recent fallback commit (`node_modules/react-dom/cjs/react-dom-client.production.js:10793`, `globalMostRecentFallbackTime + 300 - now()`). Measured with a production build (`vite build` with a fake Supabase URL, served by `vite preview`, chunk already cached): the `QuickAddModal` chunk finished at 1,655 ms, the dialog's history entry was pushed and the dialog appeared at 1,960 ms, about 330 ms after the click at 1,628 ms. Click-to-dialog for the first open, guest, three browsers, both the dev server and the production build: 333 to 375 ms. The second open of the same dialog (mounted, closed, only `isOpen` flips): 17 to 65 ms. At 6x CPU throttling (a phone), first open took 650 to 1,400 ms.
3. **A click or tap in that gap closes the dialog.** Nothing on screen answers the first click for that time. The scrim covers the whole page, `fixed inset-0` (`src/components/Modal.tsx:354`), and closes on a click whose target is the scrim itself (`:355-357`). A second click on "Add entry", top right of the header, after the dialog appears lands on the scrim, outside the panel, and calls `onClose`. Reproduced: first click at 633 ms, dialog open at 971 ms, second click at the same point at 1,170 ms hit `motion-scrim`, dialog closed at 1,189 ms, then `modalHistory` took its entry off (`history.back()`, `popstate` with state `null`). This is the only close path the code allows right after a load: the others are Escape (`Modal.tsx:339-348`), the X and the mobile handle (`:375`, `:393`), Back (`:322-332`), and a successful save or template (`src/components/QuickAddModal.tsx:53-55`, `:69-71`), none of which runs without input.
4. **Why "upon the initial loading" and signed in.** Only the first open after a page load goes through the boundary; the latch keeps the modal mounted afterwards (`App.tsx:50-55`), so later opens take 17 to 65 ms. Signed in, the boot is busier (supabase-js, six cloud reads, the realtime socket), which stretches the gap on a real device. Before ADR 0107 the autoUpdate worker reloaded the page around the same moment, which hid this.
5. **Ruled out, each with a production build and a fake signed-in session** (a stored session for a fake Supabase host, every request fulfilled by Playwright, no real credentials, nothing sent to the live project): a single click never closed the dialog in Chromium, WebKit or Firefox, desktop or 390 px touch, at 1x or 6x CPU, with the cloud reads delayed 150 to 1,500 ms each, with a stored session that had expired (token refresh at boot), with a template in `pf_presets`, with the "Ready to use offline" toast and with the "A new version is ready" toast mounting while the dialog was open. `FinanceProvider` renders its children unconditionally (`src/context/FinanceContext.tsx:2943-2955`), so a cloud load never remounts `MainApp`; no auth event, cloud load or realtime handler touches history or the modal state (`FinanceContext.tsx:956-1209`).
6. **The open is instant once the boundary is already mounted.** With the modal mounted and closed, a click only flips `isOpen`; the dialog commits in the click's own update (a SyncLane update, flushed in a microtask), with no boundary and no throttle. That is the 17 to 65 ms second-open figure in item 2, and it is what the fix gives the first open.
7. **The fix, `src/App.tsx`, three edits** (comments in plain hyphens, no em dash):
   - Edit A, the latch comment at `:50-55`. Replace these six lines:
     ```
       // ADR 0010: latches, not mirrors of the `isOpen*` state above. Each flips to
       // `true` on first open and never flips back, so the lazy-loaded modal below
       // mounts once and stays mounted - only `isOpen` toggles thereafter, exactly
       // as it did before these were deferred. Gating on the bare `isOpen` state
       // instead would unmount the modal (and its exit animation) the instant it
       // closes.
     ```
     with:
     ```
       // ADR 0010: latches, not mirrors of the `isOpen*` state above. Each flips to
       // `true` at idle (ADR 0108, the effect below) or on first open, whichever
       // comes first, and never flips back, so the lazy-loaded modal below mounts
       // once and stays mounted - only `isOpen` toggles thereafter, exactly as it
       // did before these were deferred. Gating on the bare `isOpen` state instead
       // would unmount the modal (and its exit animation) the instant it closes.
     ```
   - Edit B, the idle effect at `:89-90`. Replace:
     ```
       // ADR 0104: Fetch view chunks in idle time after first paint.
       useEffect(() => runWhenIdle(preloadViews), []);
     ```
     with:
     ```
       // ADR 0104: Fetch view chunks in idle time after first paint. ADR 0108: the
       // four shell dialogs mount there too, closed, so their first open only flips
       // `isOpen`. Mounted by the click instead, a dialog waited for React's 300 ms
       // Suspense reveal throttle, and a second click in that gap landed on the
       // scrim and closed it.
       useEffect(
         () =>
           runWhenIdle(() => {
             preloadViews();
             setHasOpenedQuickAdd(true);
             setHasOpenedTransfer(true);
             setHasOpenedAddWallet(true);
             setHasOpenedAccount(true);
           }),
         []
       );
     ```
   - Edit C, the JSX comment at `:335-337`. Replace:
     ```
           {/* Quick Add Modal / Responsive Mobile Bottom Sheet with Glassmorphism.
               ADR 0010: lazy-loaded, mounted on first open via the `hasOpened*`
               latch, and never unmounted after - only `isOpen` toggles thereafter. */}
     ```
     with:
     ```
           {/* Quick Add Modal / Responsive Mobile Bottom Sheet with Glassmorphism.
               ADR 0010: lazy-loaded, mounted at idle (ADR 0108) or on first open
               via the `hasOpened*` latch, and never unmounted after - only
               `isOpen` toggles thereafter. */}
     ```
   The open handlers (`:151-174`), the `?action=quick-add` effect (`:80-87`), the lazy imports and the JSX gates stay as they are. Closed, each modal renders nothing to the DOM (`Modal.tsx:350-412`: `Presence` holds `{isOpen && ...}`), so no id, dialog or `inert` mark appears before an open; `TransferFundsModal`'s `WalletTransferForm` still mounts on open and reads `initialSourceWalletId` then, as on every later open today. None of the four modules imports `@supabase/supabase-js` at runtime (only `import type`), so `tests/auth.spec.ts:96`'s guest check is unaffected.

## 5. Parity map

- "Spec-asserted DOM ids | `docs/audit/test-selector-contract.md` and the specs": the new tests use four ids already in the contract for other specs; the `tab-preload.spec.ts` line gains them (section 2).
- No other row.

## 6. Tests to add

`tests/tab-preload.spec.ts`, inside `test.describe('Tab view idle preloading', ...)`, after the second test (it reuses `EXPECTED_VIEWS` and `VIEW_REGEX` from the top of the file). Add exactly:

```ts
  // ADR 0108 (T807): the shell dialogs mount, closed, in the idle callback that
  // preloads the views, so a first open commits in the click's own update.
  // Mounted by the click, a dialog waited for React's 300 ms Suspense reveal
  // throttle, and a second click in that gap landed on the scrim and closed it.
  const SHELL_DIALOGS = [
    { trigger: '#navbar-quick-add-btn', title: 'Quick Record Transaction' },
    { trigger: '#dashboard-wallets-transfer-btn', title: 'Transfer Funds' },
    { trigger: '#dashboard-wallets-add-btn', title: 'Add Wallet' },
    { trigger: '#navbar-account-btn', title: 'Account & Security' },
  ];

  for (const { trigger, title } of SHELL_DIALOGS) {
    test(`${title} opens in the click's own update after the idle preload`, async ({ page }) => {
      const requestedViews = new Set<string>();
      page.on('request', (req) => {
        const match = req.url().match(VIEW_REGEX);
        if (match) {
          requestedViews.add(match[1]);
        }
      });

      await page.goto('/');
      await expect
        .poll(() => Array.from(requestedViews).sort(), { timeout: 15000 })
        .toEqual(EXPECTED_VIEWS);
      await page.waitForLoadState('networkidle');
      await expect(page.locator(trigger)).toBeVisible();

      // A click's update renders in a microtask, so one macrotask later a dialog
      // that only had to flip `isOpen` is on the page.
      const openedAtOnce = await page.evaluate(async ({ trigger, title }) => {
        (document.querySelector(trigger) as HTMLElement).click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        return Array.from(document.querySelectorAll('[role="dialog"] h3')).some((h) => h.textContent === title);
      }, { trigger, title });

      expect(openedAtOnce).toBe(true);
      await expect(page.getByRole('dialog', { name: title })).toBeVisible();
    });
  }
```

Why each of the four fails today: after the idle preload and `networkidle`, no shell modal is mounted (`App.tsx:56-60`, the latches only flip on a click), so the click mounts the `Suspense` boundary, `React.lazy` suspends, the `null` fallback commits, and the dialog arrives at least 300 ms later (section 4, items 1 and 2). One macrotask after the click there is no dialog, so `expect(openedAtOnce).toBe(true)` fails with `Expected: true, Received: false` on all four. The two existing tests in the file pass in both states. Red run (stage 02 step 4): stash `src/App.tsx` only, run `npx playwright test tests/tab-preload.spec.ts --project=chromium`, expect 4 failed and 2 passed, each failure at that `toBe(true)` line, and save the output to `workflow/stages/02_build/output/logs/T807-red.log`; then restore `src/App.tsx` and confirm 6 passed.

The test never uses `page.waitForTimeout`, signs in or intercepts a request (guest, dev server on port 3000, as the rest of the file). `#navbar-account-btn` is the guest's Account icon button, shown from `sm` (`src/components/navbar/NavbarLedgerStatus.tsx:187-191`); the three projects run at desktop size.

## 7. Gates

Changed paths: `src/App.tsx` (App.tsx tier), `tests/tab-preload.spec.ts` (spec tier), docs. Union of tiers, as commands, in this order:

```
npm run lint
npm run test:unit
npx playwright test tests/tab-preload.spec.ts --project=chromium
npx playwright test tests/tab-preload.spec.ts
npm test
```

- `npm test` (every spec on three browsers) is the "affected specs" run: the change alters when all four shell modals mount, and most specs open one of them. Expected: 187 tests in 36 specs, 561 runs, 555 passed and 6 skipped (today 183 / 36 / 549, 543 passed, 6 skipped, plus 4 tests on three browsers). Report the real figures. Do not edit the counts in `AGENTS.md`, `README.md` or `docs/contexts/ui-and-e2e.md:67`; T808 does.
- Save the full `npm run test:unit` and `npm test` output with `tee` to `workflow/stages/02_build/output/logs/` (AGENTS.md). Unit count stays 1510 tests in 69 files.
- Check ports 3000 and 3100 for stale dev servers before Playwright. Never edit `src/` while Playwright runs.
- The red run in section 6, saved to `workflow/stages/02_build/output/logs/T807-red.log`.
- Line endings: `git ls-files --eol src/App.tsx tests/tab-preload.spec.ts docs/contexts/ui-and-e2e.md docs/audit/test-selector-contract.md docs/audit/task-ledger.md` still shows `w/crlf` on each; the new ADR is CRLF, checked with `node -e "const s=require('fs').readFileSync('docs/audit/decisions/0108-shell-dialogs-mount-at-idle.md','utf8');console.log('crlf',s.split('\r\n').length-1,'bare-lf',s.replace(/\r\n/g,'').split('\n').length-1)"` (bare-lf 0).
- Em dashes: 0 in the added lines, with `node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"`, and 0 in the new ADR and the build report, with `node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" docs/audit/decisions/0108-shell-dialogs-mount-at-idle.md workflow/stages/02_build/output/task-T807-build.md`.
- Text landed: `git diff src/App.tsx` shows only edits A, B and C of section 4, item 7, with their text as written there and nothing outside those three hunks; `docs/contexts/ui-and-e2e.md` and `docs/audit/test-selector-contract.md` each change one line.
- Scope: `git status --porcelain` lists only section 2's files, the ledger and the build report.

## 8. Production touch points

none. No sign-in, no request to the live Supabase project or to `/api/*`, no `vercel.json` or workflow change. After the owner merges and deploys, the owner checks on production, signed in: reload, press "Add entry" once, and the popup stays open. If it still closes after a single press with no second click or tap, the cause is not the one in section 4; report the browser, device and whether the update notice was showing, for a follow-up task.

## 9. Out of scope

- `Modal.tsx`'s scrim rule (a click outside the panel closes it; do not add a time guard or a pointerdown check), its focus, history and `inert` logic, and `modalHistory.ts`.
- Converting the four modals to `lazyView` or making the open handlers wait for the chunk (the click-before-idle residual is accepted in the ADR's Not done).
- `AuthModal` and `ReloadPrompt` (eager, ADR 0010), `MobileBottomNav`, `Navbar`, the `?action=quick-add` effect, any copy or style.
- The stale-sounding comments elsewhere that say a modal "never unmounts once opened" (`src/hooks/useSpeechRecognition.ts:170`, `src/utils/jevClassifier.ts:74`, `src/components/account/AccountModal.tsx:46`, `unit/speech-support.test.tsx:241`): they stay true.
- Counts in `AGENTS.md`, `README.md` and `docs/contexts/ui-and-e2e.md:67`, `refactor-log.md` and `baseline-metrics.md` (T808, the closing task).
