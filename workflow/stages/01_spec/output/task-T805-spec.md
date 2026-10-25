# Spec: T805

Phase 147, branch `phase-147-update-prompt`, cut from `main` at `e0de2f4`. First task of the phase. T805 is free: the ledger's highest id is T804 (`docs/audit/task-ledger.md:121`) and no `task-T805-*` exists. The next free ADR number is 0107 (last is `0106-instant-tabs-and-popups-open-without-motion.md`). The order names no Backlog row, so no Backlog status changes.

## 1. Goal

When a new version of the app is deployed, the installed or open app shows the existing "A new version is ready" notice with its Reload button and waits for the user to press it. It no longer reloads the page by itself in the middle of what the user is doing.

## 2. Target files

```
docs/audit/decisions/0107-ask-before-updating-the-offline-app.md
vite.config.ts
src/components/ReloadPrompt.tsx
unit/reload-prompt.test.tsx
docs/contexts/ui-and-e2e.md
```

- The ADR is written first, before any code (AGENTS.md workflow). Content: Status Accepted, Date 2026-10-25. Context (section 4 below), Decision (`registerType: 'prompt'`; the notice is the only path to a new version; Dismiss leaves the new worker waiting until every tab of the app is closed; the hourly `r.update()` check stays), Amends (ADR 0041 and ADR 0042 keep their toast layout and layering; they never decided the update policy, so this adds to them), Verification, Not done (a "reload when idle" timer, a countdown, a changelog in the notice, a Playwright update test: needs two builds and a real deploy).
- `src/components/ReloadPrompt.tsx`: comment edit only (see section 4, item 4). No logic or markup change.
- `docs/contexts/ui-and-e2e.md`: add one bullet to the same list that holds line 32's safe-area bullet, or to the nearest PWA bullet if one exists: "**An app update waits for the user** [0107]: `registerType: 'prompt'`, so a new service worker stays waiting until `ReloadPrompt`'s Reload is pressed; never switch back to `autoUpdate`, which reloads the page by itself." No count changes.
- Bookkeeping, always allowed: `docs/audit/task-ledger.md`. It has no Phase 147 section yet: add one from the file's "Template for the next phase" block, heading `## Phase 147 - Ask before updating the offline app (ADR 0107)`, a branch line like Phase 146's (`Branch \`phase-147-update-prompt\`, cut from \`main\` at \`e0de2f4\`.`), and rows T805 (this task) and T806 (Phase 147 closing docs, status `todo`). Set T805 to `in-progress` at start and `done` with the gate result at the end.
- Conditional target, only if section 6 test 2's `vi.mock` of the virtual module fails to resolve under Vitest: `vitest.config.ts`, adding a `resolve.alias` for `virtual:pwa-register/react` that points at a stub inside `unit/fixtures/`, plus that stub file. Try the `vi.mock` factory first; add the alias only on that failure, and say in the build report which happened.
- Not targets: `src/App.tsx` (the mount at `:324` stays), `playwright.config.ts`, `tests/toast-layering.spec.ts`, `AGENTS.md`, `README.md`.
- Pause rule: no money path, no `supabase/`, no `api/`, no `AGENTS.md`, no CONTEXT.md, Production touch points `none`. The orchestrator sends `build T805` without asking.

## 3. Context to read

`docs/contexts/ui-and-e2e.md` (component and Playwright rules). `AGENTS.md` for the tier table. ADR 0041 (toast position) and ADR 0042 (toast layering, the `pwa-dev` server) so the ADR does not contradict them. Not needed: `DESIGN.md`, since the notice's look does not change.

## 4. Current behaviour

1. **The build is `autoUpdate`.** `vite.config.ts:12` sets `registerType: 'autoUpdate'`. In `vite-plugin-pwa` 1.3.0 that value does two things (`node_modules/vite-plugin-pwa/dist/index.js:874-877`): it sets `workbox.skipWaiting = true` and `workbox.clientsClaim = true`, so a new service worker takes over the moment it installs, and the generated register code (`node_modules/vite-plugin-pwa/dist/client/build/register.js`, the `auto` branch) listens for `activated` and calls `window.location.reload()` when `event.isUpdate`. The page reloads by itself, with whatever the user had open.
2. **The notice exists but never shows an update.** `src/components/ReloadPrompt.tsx:13-17` reads `needRefresh` from `useRegisterSW`. In `autoUpdate` mode the register code never calls `onNeedRefresh` (that call lives only in the non-auto branch, `register.js` `showSkipWaitingPrompt`), so `needRefresh` stays `false`. Only the "Ready to use offline" variant (`offlineReady`, first install) can render today. The `needRefresh` branches (`:56`, `:65`, `:68-70`, `:74-78`) and the Reload button `#pwa-reload-btn` (`:75`) are dead code in production.
3. **What the notice already does when `needRefresh` is true.** Title "A new version is ready" (`:65`), body "Reload to start using it." (`:69`), `Reload` calls `updateServiceWorker(true)` (`:75`), `Dismiss` and the X call `close`, which clears both flags (`:31-34`). No copy or markup change is needed.
4. **The component's comment** (`:7-11`) is about `React.memo`; it says nothing of the update policy. The builder adds one comment line above `useRegisterSW` (`:17`) naming ADR 0107: "ADR 0107: `registerType: 'prompt'` keeps a new worker waiting, so `needRefresh` goes true and the notice asks before reloading." The comment must contain no em dash.
5. **The update check** is hourly: `ReloadPrompt.tsx:18-25` calls `r.update()` every 60 minutes. It stays.
6. **The test server** `vite --mode pwa-dev` (`vite.config.ts:19`, `playwright.config.ts:141`) registers the dev service worker. `tests/toast-layering.spec.ts:46` waits for the real "Ready to use offline" notice. First install fires `offlineReady` in both modes (`register.js`: `installed` with `isUpdate` false), so this spec is unaffected.
7. **Target behaviour in `prompt` mode** (`register.js`, the non-auto branch): a new worker installs and stays `waiting`; `showSkipWaitingPrompt` fires `onNeedRefresh`; `needRefresh` becomes `true`; the notice shows. Reload calls `updateServiceWorker(true)`, which posts the skip-waiting message to the waiting worker (`messageSkipWaiting`); the worker activates, `controlling` fires with `isUpdate`, and the library calls `window.location.reload()`. Workbox's `generateSW` adds the `SKIP_WAITING` message handler to `sw.js` whenever `skipWaiting` is false, so no `injectManifest` or custom worker is needed. The builder confirms this in the built `dist/sw.js` (gate 5).
8. **Known edge, accepted in the ADR:** Dismiss hides the notice but leaves the worker waiting, so the next visit after every tab is closed runs the new version, or the notice returns on the next page load that finds a waiting worker. A user who never reloads stays on the old version; the old worker keeps serving its own precache, so old lazy chunks still resolve.

## 5. Parity map

none. (Nothing in `AGENTS.md`'s map touches the PWA registration. `vite.config.ts` and `ReloadPrompt.tsx` are not paired by any row.)

## 6. Tests to add

New file `unit/reload-prompt.test.tsx` (CRLF like its neighbours), first line `// @vitest-environment jsdom`. Red first, because the task changes a non-test file: the builder writes test 1, runs it against the unfixed `vite.config.ts`, saves the failure to `workflow/stages/02_build/output/logs/T805-red.log`, then makes the change. The reviewer repeats it by stashing `vite.config.ts` (stage 03 step 6).

1. **`vite.config.ts` asks before updating** (fails today). Read `vite.config.ts` with `node:fs` (`path.resolve(__dirname, '../vite.config.ts')` or the pattern `unit/dom-id-convention.test.ts` uses) and assert it contains `registerType: 'prompt'` and does not contain `registerType: 'autoUpdate'`. Fails today on `vite.config.ts:12` (the value is `'autoUpdate'`). Why a source read and not the generated worker: `vitest.config.ts` deliberately loads no plugins (its header comment), and a build inside a unit test costs tens of seconds; the real build output is checked by gate 5.
2. **`ReloadPrompt` shows the notice and Reload asks the library to update** (characterisation: passes today, because the component already handles `needRefresh`; it exists so the dead branch is covered and cannot rot). Mock `virtual:pwa-register/react` with `vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: () => ({ needRefresh: [true, setNeedRefresh], offlineReady: [false, setOfflineReady], updateServiceWorker }) }))`, with `setNeedRefresh`, `setOfflineReady` and `updateServiceWorker` as `vi.fn()` created through `vi.hoisted`. Render `<ReloadPrompt />` with Testing Library. Assert:
   - `getByRole('complementary', { name: 'App update notification' })` is present and contains the text `A new version is ready`;
   - clicking `#pwa-reload-btn` calls `updateServiceWorker` once with `true`, and the test does not set `window.location` (the page must not reload by itself: assert `updateServiceWorker` was called only after the click, i.e. zero calls right after render);
   - clicking `#pwa-dismiss-btn` calls `setNeedRefresh` with `false` and `setOfflineReady` with `false`, and `updateServiceWorker` is still called exactly once.
   Add a second case with `needRefresh: [false, ...]` and `offlineReady: [false, ...]` asserting the component renders nothing (`container` is empty), and a third with `offlineReady: [true, ...]` asserting `Ready to use offline` and no `#pwa-reload-btn`. Use a factory whose return values come from a mutable `const state = vi.hoisted(...)` object so each case sets its flags before render.
3. **Temporary edit to repeat the red state after the build** (reviewer, stage 03 step 6): `git stash push -- vite.config.ts`, run `npx vitest run unit/reload-prompt.test.tsx`; test 1 must fail on the `registerType` assertion and tests 2 to 4 must pass; `git stash pop`.

No Playwright test is added: a real update needs two builds and a deploy; `jsdom` plus the mocked hook covers the component, and gate 5 covers the generated worker.

## 7. Gates

Changed paths: `vite.config.ts`, `src/components/` (comment only in `ReloadPrompt.tsx`, which takes the comments-only row for that file but the file set also holds `vite.config.ts`), `unit/`, docs. Union of tiers, as commands:

```
npm run lint
npx vitest run unit/reload-prompt.test.tsx
npm run test:unit
npx playwright test tests/toast-layering.spec.ts --project=chromium
npx playwright test tests/toast-layering.spec.ts
npm run build
```

Gate 5 after `npm run build` (the check that the worker is really in prompt mode), with Node, no `jq`:

```
node -e "const s=require('fs').readFileSync('dist/sw.js','utf8');console.log('SKIP_WAITING',s.includes('SKIP_WAITING'));console.log('clientsClaim',/clientsClaim|\.clients\.claim\(\)/.test(s));console.log('skipWaiting call',/self\.skipWaiting\(\)/.test(s))"
```

Expected: `SKIP_WAITING true`, `clientsClaim false`, `skipWaiting call false`. Record the three lines in the build report. If `SKIP_WAITING` is false or either of the others is true, stop and report: the premise in section 4 item 7 is wrong.

Other checks:

- Save the full `npm run test:unit` output with `tee` to `workflow/stages/02_build/output/logs/` (AGENTS.md). Unit count rises from 1506 tests / 68 files by this task's new file (4 tests, 1 file expected: 1510 / 69). Do not edit the counts in `AGENTS.md`, `README.md` or `docs/contexts/ui-and-e2e.md:66`; T806 (the closing task) does, from the real numbers.
- Check ports 3000 and 3100 for stale dev servers before Playwright. Never edit `src/` while Playwright runs.
- `git ls-files --eol` on each changed or new file: `w/crlf` kept (the new ADR and the new test are written CRLF to match their neighbours).
- Em dash count in the added lines is 0, with the Node command in `workflow/stages/01_spec/CONTEXT.md`, plus the same count on each new untracked file.
- Scope: `git status --porcelain` lists only section 2's files, the ledger and the build report.

## 8. Production touch points

none. No SQL, no `/api/*` request, no env var, no deploy. The change reaches users only when the owner later merges the phase branch to `main`; the first deploy after it still installs the new worker silently on already-open clients under the old `autoUpdate` worker, which reloads them one last time (the old worker's code runs the old policy); from then on updates ask first. Name this in the ADR's Consequences.

## 9. Out of scope

- Do not change the notice's text, layout, z-index or position (ADR 0041, 0042), the Reload and Dismiss ids, or `src/App.tsx`'s mount.
- Do not add a countdown, an idle auto-reload, a "what changed" line, a `localStorage` flag, a new dependency, or `injectManifest` with a custom worker.
- Do not touch `workbox.globPatterns`, the manifest, `devOptions`, `includeAssets`, the hourly `r.update()` interval, or `manualChunks` in `vite.config.ts`. Only the `registerType` value changes (plus an optional one-line comment above it citing ADR 0107).
- Do not edit `tests/toast-layering.spec.ts` or `playwright.config.ts`.
- Do not edit `AGENTS.md`, `README.md`, `refactor-log.md` or `baseline-metrics.md`; T806 closes the phase.
- Do not run `vercel dev`, any `/api/*` request, or any live Supabase command.
