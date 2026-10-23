# Spec: T797

Phase 144, branch `phase-144-smooth-sync-and-tabs`, cut from `main` at `da2f475`. First task of the phase. Not a money path, nothing under `supabase/` or `api/`, Production touch points `none`, so the orchestrator goes straight from this spec to `build T797`. The T797 row does not exist yet: the builder adds it under a new Phase 144 section (section 2).

## 1. Goal

After the app's first paint, in idle time, fetch the chunks of all six tab views so a tab switch renders the view at once and never shows the loading skeleton. The code split stays (six `*View` chunks), the 200 ms `motion-page` slide and the `key={activeTab}` remount stay as they are, and no dependency is added.

## 2. Target files

```
docs/audit/decisions/0104-preload-tab-views.md
src/utils/lazyView.tsx
src/App.tsx
unit/lazy-view.test.tsx
tests/tab-preload.spec.ts
tests/helpers.ts
docs/audit/test-selector-contract.md
docs/contexts/ui-and-e2e.md
docs/audit/task-ledger.md
```

- **`docs/audit/decisions/0104-preload-tab-views.md`**: the builder writes it first, before any code (0103 is the last ADR). Status Accepted, date 2026-10-23, in the house format (Context, Options considered, Decision, Consequences, Revisit if). It records the measured finding in section 4 and these options:
  - (a) idle-time `import()` calls with the views kept on `React.lazy`: rejected, because a measured experiment (React 19.2.8, jsdom) showed that a `React.lazy` whose chunk is already fetched still suspends on its first render, commits the fallback, and React's fallback throttle kept the skeleton up for about 260 ms;
  - (b) a small `lazyView` helper that wraps the same dynamic `import()` in a memoised promise read with `use()`, and marks the promise `fulfilled` as soon as it settles, so a preloaded view renders on the first pass without suspending: chosen;
  - (c) `<link rel="modulepreload">` in `index.html`: rejected, the inline script's hash is pinned in `vercel.json`'s CSP and Vite owns the entry's preload list;
  - (d) keep all views mounted: already rejected by ADR 0005, which is not reopened.
  - Consequences: first visit to a tab before the idle preload finishes still shows the skeleton (offline-first-load, slow network); a failed preload is forgotten, so the tab click retries; the ADR 0005 remount stays; the preload costs five extra chunk fetches at idle on every first load (the service worker already precaches them, so a repeat visit reads the cache). Revisit if: a view chunk grows large enough that the idle fetch matters on mobile data (a `saveData` or `effectiveType` gate was left out on purpose).
- **`src/utils/lazyView.tsx`** (new): exports `lazyView` and `runWhenIdle`, behaviour in section 4a.
- **`src/App.tsx`**: the six `lazy(...)` view constants become `lazyView(...)` (section 4b), plus one effect that starts the preload. The four shell modals (`QuickAddModal`, `TransferFundsModal`, `AddWalletModal`, `AccountModal`) stay on `React.lazy` (ADR 0010).
- **`unit/lazy-view.test.tsx`** and **`tests/tab-preload.spec.ts`** (both new): section 6.
- **`tests/helpers.ts`**: comment only. The `gotoTab` doc comment says "Every view in `App.tsx` is a `React.lazy` import"; change it to say the views are `lazyView` imports preloaded at idle, and that a first click before the preload ends can still show the fallback. Do not change any code line (a docs-only edit of a test helper: it falls under the `tests/` tier, which is already run).
- **`docs/audit/test-selector-contract.md`**: one new bullet in alphabetical position for `tab-preload.spec.ts`: ids `#nav-tab-*`, `#view-loading-fallback`. Also update any line that lists the spec count if one exists (grep for "35 spec" first).
- **`docs/contexts/ui-and-e2e.md`**: add one bullet near the "Loading is a static outline" line (`:25`) and fix the "Shell modals ... behind `React.lazy`" line only if it now reads as covering the views: tab views are `lazyView` (preloaded at idle, [0104]); a preloaded view never shows `ViewLoadingFallback`; new tab views must be added to the preload list in `App.tsx`. If the file states the Playwright spec count, check it against the code (it will be 182 specs files 36; the phase's closing task updates counts, so only fix a count this task makes wrong inside this file).
- **`docs/audit/task-ledger.md`**: add, after the Phase 143 table and before `## Backlog`, a section `## Phase 144 - Smooth sync and tabs (ADR 0104)`, a line "Branch `phase-144-smooth-sync-and-tabs`, cut from `main` at `da2f475`. No migration.", the same six-column table header as Phase 143, and the T797 row. Flip Status `in-progress` when starting and `done` with the Gate result at the end, leaving Commit empty (the orchestrator fills it).

Bookkeeping files under `workflow/stages/*/output/` need no listing.

## 3. Context to read

- `docs/contexts/ui-and-e2e.md` (views, Playwright, the spec-edit policy, the `#view-loading-fallback` contract).
- `docs/contexts/client-state.md` is not needed: no state, selector or money change.
- `docs/audit/decisions/0005-view-remount-on-tab-change.md` and `0010-deferred-shell-modal-mounting.md` for the remount and lazy-modal rules this task must not disturb.

## 4. Current behaviour

- `src/App.tsx:14-19`: each of the six views is `lazy(() => import('./views/XView').then(m => ({ default: m.XView })))`. Nothing requests a view's chunk until the view first renders, so every first visit to a tab fetches its chunk behind the skeleton. (`vite.config.ts:66` precaches `**/*.js` in the service worker, but that only helps once the worker is installed.)
- `src/App.tsx:311-317`: `<Suspense fallback={<ViewLoadingFallback view={activeTab} />}>` wraps `<Presence><div key={activeTab} className="motion-page w-full">{renderActiveView()}</div></Presence>`. The Suspense boundary is outside the keyed div (ADR 0005 option b), so the tab's remount does not re-show the fallback by itself, only a suspending view does.
- `src/components/ViewLoadingFallback.tsx:53`: the fallback is `#view-loading-fallback`, a static outline per tab.
- No idle scheduling exists in `src/` (grep `requestIdleCallback` and `idle`: none). `src/main.tsx` renders `<App />` in `StrictMode`, so mount effects run twice in dev; the effect below must clean up.
- Measured by the spec author (scratch script, not committed; jsdom, React 19.2.8, two components, the second one's promise already settled and never rendered, then a synchronous update that switches to it inside `Suspense`):
  - `React.lazy`: one fallback commit on the switch, and the fallback stayed up about 260 ms before the view replaced it. Fetching the chunk early is therefore not enough to remove the skeleton.
  - A component that reads a memoised promise with `use()` after the promise got `status = 'fulfilled'` and `value` set by our own `.then`: zero fallback commits, view rendered on the same pass. React 19's `use` returns a thenable's value synchronously when its `status` is `'fulfilled'`.
- Existing specs wait for the fallback to detach (`tests/helpers.ts:59`, `routing.spec.ts:12`, `layout-stability.spec.ts:38,73`, `safe-area.spec.ts:27,50`, `account-and-mobile-nav.spec.ts:51`); they stay valid when it appears less often.

### 4a. `src/utils/lazyView.tsx`

```ts
export interface LazyView<P extends object> {
  View: ComponentType<P>;
  preload: () => Promise<void>;
}
export function lazyView<P extends object>(load: () => Promise<ComponentType<P>>): LazyView<P>;
export function runWhenIdle(fn: () => void): () => void;
```

- `lazyView`: keeps one memoised promise from `load()`. The first call to the getter (from `preload` or from a render) calls `load()` once and attaches `.then`, which stores `status = 'fulfilled'` and `value = Component` on the promise object (a local `Promise<ComponentType<P>> & { status?: 'fulfilled'; value?: ComponentType<P> }` type, no `any`). On rejection the memo is cleared, so the next call to the getter calls `load()` again (a failed idle fetch must not poison a later click).
- `View`: `function View(props: P) { const C = use(getPromise()); return <C {...props} />; }`. Inside a `Suspense` it suspends exactly like `React.lazy` while the chunk is in flight, and a rejection throws to the nearest error boundary as `React.lazy` did.
- `preload`: `() => getPromise().then(() => undefined, () => undefined)`. It never rejects (no unhandled rejection) and never throws.
- `runWhenIdle`: uses `requestIdleCallback(fn, { timeout: 3000 })` when `typeof requestIdleCallback === 'function'`, else `setTimeout(fn, 1000)` (Safari has no `requestIdleCallback`). Returns a cancel function that calls `cancelIdleCallback` or `clearTimeout`.
- `// ponytail:` comments are not required; one short comment on the `status` assignment saying why it is there (React's `use` reads it to skip suspending) is.

### 4b. `src/App.tsx` change

Replace the six constants with, for example (names are the builder's; the JSX in `renderActiveView` must keep using `<DashboardView ... />` etc.):

```ts
const { View: DashboardView, preload: preloadDashboard } = lazyView(() => import('./views/DashboardView').then(m => m.DashboardView));
// ... same for TransactionsView, WalletsView, DebtsView, DiaryView, CategoriesView
const preloadViews = () => [preloadDashboard, preloadTransactions, preloadWallets, preloadDebts, preloadDiary, preloadCategories].forEach(p => p());
```

and in `MainApp`, next to the other mount effects: `useEffect(() => runWhenIdle(preloadViews), []);`. All six are preloaded, not "the other five": the active one's promise is already memoised, so the extra call is free, and the active tab at mount is not known to the effect. The `import('./views/...')` expressions stay literal and in `App.tsx` so Vite still emits one chunk per view. Do not touch `Suspense`, `Presence`, `key={activeTab}`, `motion-page`, `--page-dir`, `ViewLoadingFallback` or the modals.

## 5. Parity map

None. (`docs/audit/test-selector-contract.md` is edited for the new spec only; no id is renamed or removed.)

## 6. Tests to add

Order: write `tests/tab-preload.spec.ts` first, run it on chromium against the unfixed code and save the failure to `workflow/stages/02_build/output/logs/T797-red.log`; then write the ADR, `lazyView.tsx`, the App change and `unit/lazy-view.test.tsx`.

**`tests/tab-preload.spec.ts`** (Playwright; desktop `#nav-tab-*`, no mobile project logic):

1. `the other views are requested without a tab click`: collect `page.on('request')` URLs before `page.goto('/')`; match `/\b(Dashboard|Transactions|Wallets|Debts|Diary|Categories)View\b/` on the URL path (matches `/src/views/XView.tsx` in dev and `assets/XView-<hash>.js` in a build); `await expect.poll(() => sorted set of matched names, { timeout: 15000 }).toEqual([all six, sorted])` with no click in between. Fails today: only the active view (Dashboard) is requested, so the poll times out with one name.
2. `switching through every tab never shows the loading skeleton`: `page.goto('/')`, wait for the same six requests, then `await page.waitForLoadState('networkidle')`, then `page.evaluate` installs a `MutationObserver` on `document.body` (`childList`, `subtree`) that increments `window.__fallbackSeen` whenever an added node is `#view-loading-fallback` or contains it. Then `gotoTab` (from `./helpers`) through `transactions`, `wallets`, `debts`, `diary`, `categories`, `dashboard`, and finally `expect(await page.evaluate(() => window.__fallbackSeen)).toBe(0)`. Declare the window field with a local cast, no `any` on the page type. Fails today: each first visit fetches its chunk behind the skeleton, so the counter is 5 or more.
3. No third test is needed. Do not assert timing numbers.

Stability check the builder must do and report: run the new spec `--repeat-each=5` on chromium, then once on all three browsers. If test 2 is flaky because `networkidle` returns before the preload promises settle, wait instead on a second condition that is observable (for example poll until `performance.getEntriesByType('resource')` shows each view's file finished) rather than adding a sleep; never `waitForTimeout`.

**`unit/lazy-view.test.tsx`** (`// @vitest-environment jsdom`, `@testing-library/react`): fails today because `src/utils/lazyView.tsx` does not exist; the file's cases pin the behaviour so a later swap back to `React.lazy` is caught:

1. `preload requests the loader once`: a `vi.fn` loader; call `preload()` twice and render `View` once; the loader ran once.
2. `a preloaded view renders without committing the fallback`: two `lazyView`s A and B; render `Suspense` with a fallback component that increments a counter in its render body (a counter, not a DOM query, so `act` flushing cannot hide it), show A, `await B.preload()`, then switch to B inside `act`; B's text is on screen and the fallback counter did not change from before the switch. (This is the assertion `React.lazy` would fail.)
3. `an unpreloaded view suspends, then renders`: the fallback shows, then B's text after the loader resolves.
4. `a failed preload is forgotten`: the loader rejects first, resolves second; `preload()` resolves without throwing, a later render calls the loader again and shows the view.
5. `runWhenIdle uses requestIdleCallback when present and setTimeout when not`: stub `requestIdleCallback`/`cancelIdleCallback` on `window`, assert the call and the timeout option, and that the returned cancel calls `cancelIdleCallback`; then delete the stub, use `vi.useFakeTimers()`, assert `fn` runs after 1000 ms and does not run when cancelled first. Restore globals in `afterEach`.

The Playwright spec is the red-first test for the money-path-free behaviour; the unit file is red by absence of the module and the builder records both in `T797-red.log`.

## 7. Gates

Changed paths: `src/utils/`, `src/App.tsx`, `unit/`, `tests/*.spec.ts`, `tests/helpers.ts`, docs. Run, in this order, and save full-suite output to `workflow/stages/02_build/output/logs/`:

```
npm run lint
npx vitest run unit/lazy-view.test.tsx
npm run test:unit
npx playwright test tests/tab-preload.spec.ts --project=chromium
npx playwright test tests/tab-preload.spec.ts --project=chromium --repeat-each=5
npx playwright test tests/tab-preload.spec.ts tests/routing.spec.ts tests/layout-stability.spec.ts tests/safe-area.spec.ts tests/account-and-mobile-nav.spec.ts tests/reduced-motion.spec.ts tests/dashboard.spec.ts --project=chromium
npx playwright test tests/tab-preload.spec.ts tests/routing.spec.ts tests/layout-stability.spec.ts tests/safe-area.spec.ts tests/account-and-mobile-nav.spec.ts tests/reduced-motion.spec.ts tests/dashboard.spec.ts
npm test
```

(`App.tsx` is the shell every spec loads through, so the last line, the full Playwright run on three browsers, is required, not optional. Check ports 3000 and 3100 for stale dev servers first.)

Bundle-size check, from a clean build with the repo's `.env` present (VITE_ values are inlined into the entry):

```
npm run clean
npm run build
node -e "const fs=require('fs'),z=require('zlib'),d='dist/assets/';let tot=0,n=0;for(const f of fs.readdirSync(d).filter(f=>f.endsWith('.js'))){const b=fs.readFileSync(d+f);tot+=b.length;n++;if(f.startsWith('index-'))console.log(f,b.length,z.gzipSync(b,{level:9}).length)}console.log('app js',tot,'files',n);console.log('view chunks',fs.readdirSync(d).filter(f=>/^(Dashboard|Transactions|Wallets|Debts|Diary|Categories)View-.*\.js$/.test(f)).length)"
node -e "console.log('views named in index.html',(require('fs').readFileSync('dist/index.html','utf8').match(/(Dashboard|Transactions|Wallets|Debts|Diary|Categories)View/g)||[]).length)"
```

Baseline (T796, `baseline-metrics.md` top section): entry `index-TU2ZOqF8.js` 193,293 B raw, all app JS 884,987 B in 39 files. Pass when: the entry grows by at most 1,500 B raw; all app JS by at most 2,500 B; the file count is still 39; the six view chunks are six separate files; `index.html` names none of them. Report the new figures in the build report (the phase's closing task writes them into `baseline-metrics.md`; this task does not).

Docs and hygiene checks:

```
git ls-files --eol src/App.tsx src/utils/lazyView.tsx unit/lazy-view.test.tsx tests/tab-preload.spec.ts tests/helpers.ts docs/audit/task-ledger.md docs/audit/decisions/0104-preload-tab-views.md
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" src/utils/lazyView.tsx unit/lazy-view.test.tsx tests/tab-preload.spec.ts docs/audit/decisions/0104-preload-tab-views.md
```

Keep the repo's CRLF working-copy endings on the files that have them; every em dash count must be 0.

## 8. Production touch points

None. No SQL, no `/api/*` request, no MCP or CLI write, no `vercel.json` or `index.html` edit, no workflow edit, no dependency. The preload fetches the app's own static chunks only.

## 9. Out of scope

- The `motion-page` slide, `--page-dir`, `Presence`, `key={activeTab}` and the remount (ADR 0005 stays accepted).
- `ViewLoadingFallback` and its shapes, the `Suspense` placement, the shell modals' `React.lazy` (ADR 0010), `AccountModal`'s own lazy imports.
- `index.html`, `vercel.json`, `vite.config.ts` (`manualChunks`, PWA globs), the service worker, `<link rel="modulepreload">`.
- A `navigator.connection.saveData` or `effectiveType` gate, ordering the preload by tab distance, per-view prefetch of data, or preloading the modals.
- Any state, selector, ledger or sync code; the rest of Phase 144's sync work is other tasks.
- Counts in `AGENTS.md`, `README.md` and `baseline-metrics.md`, and the refactor-log entry: the task that ships Phase 144 writes them.
