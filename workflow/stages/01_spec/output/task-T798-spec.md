# Spec: T798

Phase 144, branch `phase-144-smooth-sync-and-tabs` (T797 committed as `8633c17`). Second task of the phase; it does not ship the phase (no `refactor-log.md` or `baseline-metrics.md` entry). Target files include `src/context/FinanceContext.tsx`, a money-path file, so the orchestrator pauses for the owner before `build T798`. Production touch points: `none`.

## 1. Goal

A signed-in user stops seeing a spinning Syncing badge every time the app opens and after every save. Background loads (startup, sign-in, realtime, visibility, online, post-write re-reads) show no Syncing pill unless they run past 1 s; a load the user starts (Sync now in Account & Security, or tapping Sync failed) still shows Syncing at once. Offline, Sync failed and Synced keep their precedence and meaning. Display only: what loads, when, and every ledger figure stay as they are.

## 2. Target files

```
docs/audit/decisions/0026-static-money-motion-and-sync-status.md
src/context/FinanceContext.tsx
src/components/navbar/NavbarLedgerStatus.tsx
src/components/account/AccountModal.tsx
unit/navbar-sync-badge.test.tsx
unit/authenticated-ledger.test.tsx
DESIGN.md
docs/contexts/client-state.md
docs/audit/task-ledger.md
```

Order: the ADR amendment first, then the tests (red run, section 6), then the code, then the docs.

- **`docs/audit/decisions/0026-static-money-motion-and-sync-status.md`** (an amendment, not a new ADR; see "Decisions taken" below). Append at the end of the file a section `## Amendment (T798, Phase 144): background loads stay quiet for 1 s`, dated 2026-10-23, covering:
  - Context: the owner saw the Syncing pill spin on every app open and after saves. Every load sets `isSyncing` (`FinanceContext.tsx:890`), including the startup load, the debounced realtime/online/visibility reloads and the `refreshFromCloud()` re-reads after writes, while the cached copy is already on screen.
  - Decision: `FinanceStateContext` gains `isManualSync`, true for the duration of a load started with `refreshFromCloud({ manual: true })`. Only two callers pass it: AccountModal's Sync now and the badge's Sync failed button. `isSyncing` keeps its meaning (a load is running): Sync now's disabled state and spinner, the export guard and the signed-in test harness still read it. `NavbarSyncBadge` shows Syncing when `isSyncing && (isManualSync || the load has run 1 s)`; otherwise it shows what it would show with no load running, in the same order (Offline, Sync failed, Synced). The 1 s timer lives in the badge.
  - Options rejected: (a) the delay in context state (a `showSyncing` flag set by a timer inside `loadSupabaseData`): a display timer inside the money provider, and every state subscriber re-renders when it fires; (b) the badge alone with no context change: it cannot see a click in AccountModal; (c) a module-level store shared by the two buttons: a second state mechanism beside the context.
  - Consequences: a startup or sign-in load under 1 s shows Synced (or the current Sync failed) instead of Syncing; a load over 1 s still shows Syncing from 1 s on; overlapping loads behave as before (the first to finish clears `isSyncing`, unchanged and out of scope).
  - Also amend nothing else in the file. The original "Syncing: amber, with the spinner" line stays; the amendment supersedes it.
- **`src/context/FinanceContext.tsx`**: section 4a.
- **`src/components/navbar/NavbarLedgerStatus.tsx`**: section 4b.
- **`src/components/account/AccountModal.tsx`**: one line, section 4c.
- **`unit/navbar-sync-badge.test.tsx`** (new) and **`unit/authenticated-ledger.test.tsx`**: section 6.
- **`DESIGN.md`**: the Sync indicator table (`DESIGN.md:345`). Replace only the Syncing row with:
  `| Syncing | A load the user started (Sync now, or tapping Sync failed) is running, or any cloud load has run longer than 1 s | Amber pill, `⟳` spinning | Spins only while a sync runs. A background load under 1 s leaves the badge as it was |`
- **`docs/contexts/client-state.md`**:
  - `:13`: in "What decides a load (`isSyncing`, the epoch, ...)", add `isManualSync` after `isSyncing`.
  - `:29`: append one sentence to the bullet: "Syncing shows at once only for `refreshFromCloud({ manual: true })` (Sync now and that retry); any other load shows it after 1 s, a timer in the badge [0026 amendment]."
- **`docs/audit/task-ledger.md`**: add the T798 row to the Phase 144 table, after T797, same six columns: task text `Show the Syncing badge only for a load the user starts or one past 1 s (ADR 0026 amendment)`, Files = the target list above, Status `in-progress` while working and `done` with the Gate result at the end, Commit empty. Change the Phase 144 heading to `## Phase 144 - Smooth sync and tabs (ADR 0104, ADR 0026 amendment)`.

Bookkeeping files under `workflow/stages/*/output/` need no listing.

### Decisions taken (the order asked for them)

- **The 1 s delay lives in the badge component, not in context.** Context holds facts (`isSyncing`: a load runs; `isManualSync`: the user started it); the badge decides when to show them. Context state is still needed for the fact "the user started it", because AccountModal and the navbar badge are siblings that share only the context.
- **ADR: an amendment to ADR 0026, not to ADR 0104 and not a new ADR.** ADR 0026 is the decision that defined the five badge states (`0026...md:100-108`); ADR 0104 is about preloading tab views and would mislead anyone looking for the badge rule. Amendments inside a phase have precedent (ADR 0103's T794 and T795 amendments, ADR 0024's).
- **Names:** `isManualSync` and `refreshFromCloud({ manual: true })`, matching AccountModal's existing `handleManualSync`.
- **The DOM ids:** `#navbar-sync-status` and `#navbar-sync-badge-btn` are kept unchanged. Note: neither is in `docs/audit/test-selector-contract.md` today, because no Playwright spec signs in or asserts them (grep of `tests/` finds no `navbar-sync`); the component's own comment (`NavbarLedgerStatus.tsx:55-56`) calls them the contract. The new unit tests query both, so they are now guarded. No edit to the contract file.

## 3. Context to read

- `docs/contexts/client-state.md`: the context file (`FinanceStateContext` shape, "what decides a load", the signed-in harness rules at `:126`: no `act()`, macrotask fakes, `beforeEach` waits for `isSyncing === false`).
- `docs/contexts/ui-and-e2e.md`: the badge is a component; motion rule at `:24` (continuous motion only while real work runs), and no spec signs in (`:67`).
- `DESIGN.md` only the Sync indicator section (`:338-347`).

## 4. Current behaviour and the change

### Current behaviour

- `loadSupabaseData` sets `isSyncing` true at its start (`src/context/FinanceContext.tsx:890`) and false in `finally` (`:932`) for every load. Callers: the startup session (`:963`), `onAuthStateChange` (`:983`), the seed reload (`:878`), the debounced realtime/online/visibility/resubscribe reload (`:1116-1122`, triggers `:1136`, `:1146`, `:1155`, `:1161`), and `refreshFromCloud` (`:1184-1188`).
- `refreshFromCloud` is called after writes on unknown outcomes and rollback re-reads (`:1308`, `:1324`, `:1972`, `:1985`, `:2206`, `:2218`, `:2320`, `:2325`, `:2544`, `:2549`, `:2564`; `src/context/DiaryContext.tsx:133`), by the badge's Sync failed button (`NavbarLedgerStatus.tsx:99`) and by AccountModal's Sync now (`AccountModal.tsx:77`).
- `NavbarSyncBadge` picks: guest Local (`NavbarLedgerStatus.tsx:63-78`), then Offline (`:81`), Syncing whenever `isSyncing` (`:88-94`), Sync failed (`:95-109`), Synced (`:110-119`), all signed-in states inside `#navbar-sync-status` (`:122`).
- AccountModal's Sync now button is disabled and spins with "Syncing…" while `isSyncing` (`AccountModal.tsx:124-132`); the export refuses while `isSyncing` (`:387`).
- The state value is memoised over its members (`FinanceContext.tsx:2811-2836`); the type is `FinanceStateContextType` (`:79-89`); the action type is `refreshFromCloud: () => Promise<void>` (`:227`). `loadSupabaseDataRef` is typed `(userId: string) => Promise<void>` (`:755`) and needs no change (a function with an extra optional parameter is assignable).

### 4a. `src/context/FinanceContext.tsx`

1. In `FinanceStateContextType`, after `isSyncing: boolean;` (`:83`), add:
   ```ts
   /**
    * True while a load the user started runs: `refreshFromCloud({ manual: true })`,
    * from Sync now and the badge's Sync failed button. The badge shows Syncing at
    * once for it and only after 1 s for any other load (ADR 0026 amendment, T798).
    */
   isManualSync: boolean;
   ```
2. Change the action type at `:227` to:
   ```ts
   /** `manual: true` marks a load the user started (`isManualSync`). */
   refreshFromCloud: (options?: { manual?: boolean }) => Promise<void>;
   ```
3. After `const [isSyncing, setIsSyncing] = useState<boolean>(false);` (`:538`) add `const [isManualSync, setIsManualSync] = useState<boolean>(false);`.
4. `loadSupabaseData` (`:889`): signature `async (userId: string, options?: { manual?: boolean }) =>`. After `setIsSyncing(true);` add `if (options?.manual) setIsManualSync(true);`. In `finally`, after `setIsSyncing(false);` add `if (options?.manual) setIsManualSync(false);`. Nothing else in the function changes; the dependency array stays `[seedInitialUserAccount]`.
5. `refreshFromCloud` (`:1184-1188`): `async (options?: { manual?: boolean }) => { if (currentUser.id) { await loadSupabaseData(currentUser.id, options); } }`, same deps.
6. `stateValue` (`:2811-2836`): add `isManualSync` after `isSyncing` in both the object and the dependency array.

No other line in the file changes: no caller of `loadSupabaseDataRef`, `scheduleReload`, the auth effect or any write path passes `manual`.

### 4b. `src/components/navbar/NavbarLedgerStatus.tsx`

1. Import: `import React, { useEffect, useState, useSyncExternalStore } from 'react';`.
2. A module-private constant above the component (not exported; nothing in `src/` is exported only for a test):
   ```ts
   /** A background load shows Syncing only once it has run this long (ADR 0026 amendment). */
   const SLOW_LOAD_MS = 1000;
   ```
3. In `NavbarSyncBadge`, read `isManualSync` too, and before the `if (!isAuthenticated)` early return (hooks first):
   ```tsx
   const [loadIsSlow, setLoadIsSlow] = useState(false);
   useEffect(() => {
     if (!isSyncing) return;
     const timer = setTimeout(() => setLoadIsSlow(true), SLOW_LOAD_MS);
     return () => {
       clearTimeout(timer);
       setLoadIsSlow(false);
     };
   }, [isSyncing]);
   const showSyncing = isSyncing && (isManualSync || loadIsSlow);
   ```
4. Replace `} else if (isSyncing) {` (`:88`) with `} else if (showSyncing) {`. The Offline, Sync failed and Synced branches and all markup, classes, ids and `role="status"` stay byte-identical.
5. The Sync failed button's handler (`:99`) becomes `onClick={() => void refreshFromCloud({ manual: true })}`.
6. Update the component doc comment (`:47-57`): Syncing is "the only state that moves: at once for a load the user started, after 1 s for any other load; a quicker background load leaves the badge as it was (ADR 0026 amendment)". Keep the rest of the comment.

### 4c. `src/components/account/AccountModal.tsx`

`:77` becomes `await refreshFromCloud({ manual: true });`. Nothing else: the button keeps `disabled={isSyncing}`, its spinner and its "Syncing…" text (`:128-131`), and the export guard keeps `isSyncing` (`:387`).

## 5. Parity map

- "Spec-asserted DOM ids" row: `#navbar-sync-status` and `#navbar-sync-badge-btn` keep their elements; no spec asserts them (section 2, Decisions). No other row: no ledger arithmetic, no `api/`, no SQL, no type in `src/types.ts`.

## 6. Tests to add

Write all tests first and run them against the unfixed code: `npx vitest run unit/navbar-sync-badge.test.tsx unit/authenticated-ledger.test.tsx 2>&1 | tee workflow/stages/02_build/output/logs/T798-red.log`. The red log must show exactly the tests marked RED below failing (7 tests), and the GUARD tests passing. Then write the code.

### `unit/navbar-sync-badge.test.tsx` (new)

Mocks the context module so the timer runs under fake timers (the pattern of `unit/motion.test.tsx`: `vi.useFakeTimers()`, `act(() => vi.advanceTimersByTime(n))`, `vi.useRealTimers()` in `afterEach`):

```tsx
const mock = vi.hoisted(() => ({
  state: { isAuthenticated: true, isSyncing: false, isManualSync: false, syncError: null as string | null },
  refreshFromCloud: vi.fn(async (_options?: { manual?: boolean }) => {}),
}));
vi.mock('../src/context/FinanceContext', () => ({
  useFinanceState: () => mock.state,
  useFinanceActions: () => ({ refreshFromCloud: mock.refreshFromCloud }),
}));
```

`beforeEach` resets `mock.state` to the values above and calls `mock.refreshFromCloud.mockClear()`; `afterEach` runs `cleanup()`, `vi.useRealTimers()` and restores any `navigator.onLine` spy. A state change is `Object.assign(mock.state, patch)` followed by `rerender(<NavbarSyncBadge onOpenAuth={onOpenAuth} />)`. Read the badge as `document.getElementById('navbar-sync-status')!.textContent`.

1. RED: "keeps Synced while a background load runs under 1 s": `isSyncing: true`; text is `Synced` at once and after advancing 999 ms. Fails today: `:88` shows Syncing at once.
2. GUARD: "shows Syncing once a background load has run 1 s": `isSyncing: true`; advance 999 ms then 1 ms; text contains `Syncing`.
3. RED: "keeps Sync failed, still a retry button, while a background load runs under 1 s": `syncError: 'Could not read debts'`, `isSyncing: true`; `screen.getByRole('button', { name: 'Sync failed. Try again' })` exists and the text has no `Syncing`. Fails today: Syncing outranks Sync failed.
4. RED: "starts the 1 s again for the next background load": `isSyncing: true`, advance 1000 ms (Syncing), then `isSyncing: false` (Synced), then `isSyncing: true` again; text is `Synced` with no time advanced. Fails today (Syncing at once). Also guards the reset in the effect cleanup.
5. GUARD: "shows Syncing at once for a load the user started": `isSyncing: true, isManualSync: true`; text contains `Syncing` with no time advanced.
6. GUARD: "Offline still outranks Syncing": `vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)`, `isSyncing: true, isManualSync: true`; text contains `Offline` and not `Syncing`.
7. RED: "the Sync failed button starts a load the user sees": `syncError` set, `isSyncing: false`; click the button; `expect(mock.refreshFromCloud).toHaveBeenCalledWith({ manual: true })`. Fails today: called with no argument.
8. GUARD: "a guest keeps the Local button and its id": `isAuthenticated: false`; `#navbar-sync-badge-btn` exists with text `Local`, `#navbar-sync-status` is absent, and a click calls `onOpenAuth`.

### `unit/authenticated-ledger.test.tsx`

Import `NavbarSyncBadge` from `../src/components/navbar/NavbarLedgerStatus`. Add a new `describe('which loads show Syncing (T798, ADR 0026 amendment)', ...)` after the `'the Account & Security modal (ADR 0024)'` describe, with `beforeEach(() => installLedgerRpcs())`. Hold a load open with a gate, as the existing tests do (`:835`, `:2359`):

```tsx
const holdLoad = () => {
  let release!: () => void;
  fake.state.gates.set('wallets:select', new Promise<void>((resolve) => (release = resolve)));
  return () => release();
};
const badgeText = () => document.getElementById('navbar-sync-status')!.textContent;
```

9. RED: "marks a load the user starts, for as long as it runs": `holdLoad()`; `const pending = actions().refreshFromCloud({ manual: true })`; `await waitFor(() => expect(state().isSyncing).toBe(true))`; `expect(state().isManualSync).toBe(true)`; release; `await pending`; `await waitFor(() => expect(state().isSyncing).toBe(false))`; `expect(state().isManualSync).toBe(false)`. Fails today: `isManualSync` is `undefined`.
10. RED: "leaves a background load unmarked, and the badge keeps Synced while it runs": `showUi!(<NavbarSyncBadge onOpenAuth={() => {}} />)`; `holdLoad()`; `const pending = actions().refreshFromCloud()`; wait for `isSyncing` true; `expect(state().isManualSync).toBe(false)` and `expect(badgeText()).toBe('Synced')`; release; `await pending`. Fails today: `isManualSync` is `undefined` and the badge says Syncing.
11. RED: "Sync now shows Syncing at once, and keeps its own spinner": `showUi!(<><NavbarSyncBadge onOpenAuth={() => {}} /><AccountModal isOpen onClose={() => showUi!(null)} onRequestSignIn={() => {}} /></>)`; `holdLoad()`; `fireEvent.click(await screen.findByText('Sync now'))`; wait for `isSyncing` true; `expect(state().isManualSync).toBe(true)`; `expect(badgeText()).toContain('Syncing')`; the `#account-sync-btn` element is `disabled` and its text contains `Syncing…`; release; wait for `isSyncing` false. Fails today: `isManualSync` is `undefined` (the badge and button assertions guard the rest).

The harness runs on real timers and without `act()` (`client-state.md:126`); tests 10 and 11 assert within milliseconds of the load starting, far inside the 1 s window. Do not add fake timers to this file.

## 7. Gates

Check ports 3000 and 3100 for stale dev servers before Playwright. Save full-suite output under `workflow/stages/02_build/output/logs/`. Do not edit `src/` while Playwright runs.

1. Red run (section 6): `npx vitest run unit/navbar-sync-badge.test.tsx unit/authenticated-ledger.test.tsx 2>&1 | tee workflow/stages/02_build/output/logs/T798-red.log`; 7 RED tests fail, the rest pass.
2. `npm run lint`
3. `npx vitest run unit/navbar-sync-badge.test.tsx unit/authenticated-ledger.test.tsx unit/rerender-matrix.test.tsx unit/ledger-guards.test.tsx unit/backup-restore.test.tsx unit/dom-id-convention.test.ts`
4. `npm run test:unit 2>&1 | tee workflow/stages/02_build/output/logs/T798-unit.log` (expect 68 files)
5. `npx playwright test tests/account-and-mobile-nav.spec.ts tests/auth.spec.ts tests/theme.spec.ts tests/layout-stability.spec.ts --project=chromium`
6. `npx playwright test tests/account-and-mobile-nav.spec.ts tests/auth.spec.ts tests/theme.spec.ts tests/layout-stability.spec.ts 2>&1 | tee workflow/stages/02_build/output/logs/T798-e2e.log` (all three browsers). These specs render the guest badge and the navbar row; no spec signs in, so the signed-in states are covered by the unit tests only.
7. Line endings kept: `git ls-files --eol src/context/FinanceContext.tsx src/components/navbar/NavbarLedgerStatus.tsx src/components/account/AccountModal.tsx unit/authenticated-ledger.test.tsx DESIGN.md docs/contexts/client-state.md docs/audit/task-ledger.md docs/audit/decisions/0026-static-money-motion-and-sync-status.md` shows the same `w/` column as before (`w/crlf` for all except ADR 0026, which is `w/lf`). The new test file may be either; match `unit/motion.test.tsx` (`w/crlf`).
8. Em dashes in added lines: `node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"` prints 0, and `node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" unit/navbar-sync-badge.test.tsx` prints 0.
9. Scope: `git diff --stat` and `git status --porcelain` list only the target files and `workflow/` outputs.

## 8. Production touch points

none. No SQL, no `api/`, no sign-in from a dev server (the harness fakes Supabase), no deploy.

## 9. Out of scope

- What loads and when: `loadSupabaseData`'s reads, `scheduleReload`, the 400 ms debounce, the 30 s staleness rule, `verifySession`, the auth effect, every write path. None of them gains a `manual` argument.
- The meaning of `isSyncing`: AccountModal's Sync now `disabled`/spinner/"Syncing…" (`AccountModal.tsx:128-131`), the export guard (`:387`) and the harness's `isSyncing` waits stay on it.
- Overlapping loads: the first load to finish clears `isSyncing` while a second still runs. Pre-existing; do not add a counter.
- The badge's markup, colours, ids, `role="status"`, the guest Local button, the Synced dot, and DESIGN.md beyond the one Syncing row.
- `docs/audit/test-selector-contract.md` (no spec uses the badge ids), ADR 0104, `AGENTS.md` and `README.md` test counts (the phase's closing task updates counts), `refactor-log.md`, `baseline-metrics.md`.
- `DiaryContext.tsx`: its `refreshFromCloud: () => Promise<void>` prop type still accepts the new function; leave it.
- No new dependency, no new state library, no `React.memo` on the badge.
