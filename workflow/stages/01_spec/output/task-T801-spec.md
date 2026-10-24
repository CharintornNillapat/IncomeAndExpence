# T801 spec: one cloud load per signed-in user

Phase 145, branch `phase-145-one-load-per-session` (cut from `main` at `c9269ba`). First task of the phase; it does not ship the phase.

## 1. Goal

Opening the app signed in should read the account from the cloud once, and coming back to the tab or a token refresh should not start a full reload. The auth listener loads cloud data only when a different user signs in. It ignores the session-ready event (`INITIAL_SESSION`), the token refresh (`TOKEN_REFRESHED`) and any repeat of `SIGNED_IN` or `USER_UPDATED` for the user already loaded. A rename still shows.

## 2. Target files

```
docs/audit/decisions/0105-one-cloud-load-per-session.md
src/context/FinanceContext.tsx
unit/authenticated-ledger.test.tsx
docs/contexts/supabase-ledger.md
```

The builder writes the ADR first, before any code. Bookkeeping (`docs/audit/task-ledger.md`, the build report, logs) is allowed as usual.

## 3. Context to read

- `docs/contexts/client-state.md`: the provider's load rules (`cloudRevisionRef`, Syncing, the realtime effect's reconnection rules) and the `authenticated-ledger.test.tsx` harness rules (no `act()`, `beforeEach` waits for `isSyncing === false`).
- `docs/contexts/supabase-ledger.md`: auth, sessions, `resetToGuestState`, `verifySession`. This task adds one bullet to it.

## 4. Current behaviour

Installed versions: `@supabase/supabase-js` 2.116.0 and `@supabase/auth-js` 2.116.0 (`package.json:26` asks for `^2.112.4`). Line numbers below are from `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js`; the `dist/module` build has the same code a few lines up (for example `TOKEN_REFRESHED` at `:4279`).

The app:

- `setupAuth` awaits `client.auth.getSession()` (`src/context/FinanceContext.tsx:964`), and when it has a user, sets `isAuthenticated` and `currentUser` (`:966-972`) and awaits a full `loadSupabaseData` (`:973`).
- It then subscribes with `onAuthStateChange` (`:978`). The handler resets on `SIGNED_OUT` only (`:982-985`). For every other event that carries a user, it calls `setCurrentUser` with a new object (`:988-992`) and awaits a full `loadSupabaseData` (`:993`), whatever the event and whether that user is already loaded.
- `loadSupabaseData` sets `isSyncing` true at the start (`:898`) and false in `finally` (`:941`), and reads all six tables through `readCloudSlices` (`:909-920`). The context's state value is a `useMemo` over `currentUser`, `isSyncing` and the slices (`:2832-2860`), so each extra load, and each new `currentUser` object, gives every state subscriber a new value and re-renders it.
- `resetToGuestState` (`:817-858`) runs on an explicit sign-out (`:1032`) and on `SIGNED_OUT` (`:983`). Nothing records which user's data was loaded.
- The realtime effect already reloads on a return to the tab, but only when the last clean load is over 30 s old (`handleVisible`, `:1176-1180`; `CLOUD_STALE_AFTER_MS` `:1126`; ADR 0023).
- The comment at `:765-776` says the startup `getSession()` load and the listener's initial event both load the same session. That stops being true with this task.

What supabase-js emits (verified, not assumed):

- `onAuthStateChange` registers the callback, waits for `initializePromise`, then calls `_emitInitialSession`, which calls the new callback with `INITIAL_SESSION` and the current session (`:3631-3669`). The app subscribes right after its own `getSession()` load, so every signed-in open runs two full loads back to back.
- During `initialize()`, a stored session that is still valid makes `_recoverAndRefresh` notify `SIGNED_IN` (`:4165`). Those notifications are queued and flushed once `initializePromise` settles (`:360-377`, `:4336-4346`). The app usually subscribes after the flush, but the timing allows a third load on open.
- Every hidden-to-visible change calls `_recoverAndRefresh` (`_onVisibilityChanged`, `:4747-4777`). That notifies `SIGNED_IN` again for a session that is not close to expiry (`:4165`), or refreshes it, which notifies `TOKEN_REFRESHED` (`:4282`). So each return to the tab runs one full reload through the auth listener, as well as the realtime effect's own stale check.
- The auto-refresh ticker refreshes the token before it expires (about hourly), which notifies `TOKEN_REFRESHED` (`:4282`), and that runs another full reload.
- Each tab re-broadcasts its events to the other tabs through a `BroadcastChannel` (`:277-286`, `:4352-4353`), so a refresh or sign-in in one tab reloads every other open tab too.
- `updateUser` notifies `USER_UPDATED` (`:2885`, `:3953`). The Account modal's rename calls `updateUser({ data: { name } })` (`src/components/account/AccountModal.tsx:598`), and the header name only changes because the handler copies `user_metadata.name` into `currentUser` (`:991`). That copy must keep working.

The orchestrator's reading is right, and the tab-return `SIGNED_IN` is a cause it did not name. A fix that filters by event name (load only on `SIGNED_IN`) would leave the tab-return reload in place. The fix must key on the user id.

Tests that use an auth event as a reload trigger and stop reloading under this change:

- `unit/authenticated-ledger.test.tsx:876` and `:907` (`a cloud reload that fails (F6)`), `:1268` and `:1306` (T69 delete and restore re-fetch): each calls `fake.state.authCallback!('SIGNED_IN', fake.session)` to make a reload land mid-flight. After the change, `:907`, `:1268` and `:1306` fail (they wait for 7777), and `:876` would pass without testing what it says.
- `:2392` (`a cloud load still in flight at sign-out`) starts its load with `'TOKEN_REFRESHED'`. After the change it would pass without starting a load.
- `:2368` (`keeps the data through an auth event that is not a sign-out`) stays as it is and keeps passing.
- `unit/supabase-lazy-provider.test.tsx:121` fires `SIGNED_IN` after a guest load (no user loaded). It must still load, and it does under the design below.

## 5. Parity map

None of the map's rows. The ledger arithmetic, the RPCs and the guest starter set are untouched. `unit/authenticated-ledger.test.tsx` is changed, but only its reload triggers and a new describe, not any arithmetic assertion.

## 6. Tests to add

### 6a. The new describe

Add it at the end of `unit/authenticated-ledger.test.tsx`, after the `an own save does not reload (T799, ADR 0003 amendment)` describe. It uses the file's existing `fake`, `latest`, `state()`, `actions()` and `waitFor`.

```tsx
describe('one cloud load per signed-in user (T801, ADR 0105)', () => {
  // Longer than the realtime debounce (400 ms), so a reload would have started.
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 450));
  const reads = () => fake.state.calls.filter((c) => c.op === 'select');

  it.each(['INITIAL_SESSION', 'TOKEN_REFRESHED', 'SIGNED_IN'])(
    'reads nothing and redraws nothing on %s for the user already loaded',
    async (event) => {
      const before = latest!.state;
      await fake.state.authCallback!(event, fake.session);
      await settle();
      expect(reads()).toEqual([]);
      expect(latest!.state).toBe(before);
    }
  );

  it('takes a rename from USER_UPDATED without a reload', async () => {
    await fake.state.authCallback!('USER_UPDATED', {
      user: { ...fake.session.user, user_metadata: { name: 'Renamed' } },
    });
    await waitFor(() => expect(state().currentUser.name).toBe('Renamed'));
    await settle();
    expect(reads()).toEqual([]);
  });

  it('loads when a different user signs in', async () => {
    await fake.state.authCallback!('SIGNED_IN', {
      user: { ...fake.session.user, id: 'user-test-2', email: 'second@example.com', user_metadata: { name: 'Second' } },
    });
    await waitFor(() => {
      expect(state().currentUser.id).toBe('user-test-2');
      expect(state().isSyncing).toBe(false);
    });
    expect(reads().some((c) => c.table === 'wallets')).toBe(true);
  });

  it('loads again when the same user signs back in after signing out', async () => {
    await actions().signOut();
    await settle();
    fake.state.calls = [];
    await fake.state.authCallback!('SIGNED_IN', fake.session);
    await waitFor(() => {
      expect(state().isAuthenticated).toBe(true);
      expect(state().isSyncing).toBe(false);
    });
    expect(reads().some((c) => c.table === 'wallets')).toBe(true);
  });
});
```

Why each test fails or passes on today's code:

- The three `it.each` cases fail: the handler awaits a full load (`src/context/FinanceContext.tsx:993`), so `reads()` holds the six table selects. `latest!.state` is also a new object, because of the new `currentUser` object (`:988`) and the `isSyncing` flips (`:898`, `:941`).
- `takes a rename` fails on `reads()`: the rename lands, but `:993` reloads.
- `loads when a different user signs in` passes today and must keep passing. It guards against an over-wide fix that stops every listener load.
- `loads again ... after signing out` passes today and must keep passing. It guards the reset of the loaded-user ref in `resetToGuestState`.

Red run (stage 02 step 4): add the describe and the 6b edits, then run, with the source unchanged:

```
npx vitest run unit/authenticated-ledger.test.tsx -t "one cloud load per signed-in user" 2>&1 | tee workflow/stages/02_build/output/logs/T801-red.log
```

It must show 4 failed and 2 passed: the three `it.each` cases and `takes a rename`.

Negative control (the builder runs it after the fix is green and records it in the build report): temporarily delete the `loadedUserIdRef.current = null;` line from `resetToGuestState` and run the same command. `loads again when the same user signs back in after signing out` must fail. Restore the line and confirm `git diff` shows it back.

### 6b. Existing tests that must change their reload trigger

Apply these exact replacements in `unit/authenticated-ledger.test.tsx`. Each one swaps an auth event used as a reload trigger for the existing `refreshFromCloud` action, the same trigger the file already uses at `:928` and `:2154`.

- `:876`, `:907`, `:1268`, `:1306`: replace `await fake.state.authCallback!('SIGNED_IN', fake.session);` with `await actions().refreshFromCloud();`
- `:2392`: replace `const reload = fake.state.authCallback!('TOKEN_REFRESHED', fake.session);` with `const reload = actions().refreshFromCloud();`

At `:874` and `:905`, the comments ("A reload lands mid-flight...", "Another device moved this wallet; the reload picks that up.") stay as they are. Leave `:2368` unchanged.

## 7. Code change (`src/context/FinanceContext.tsx`)

1. Type import (`:16`): `import type { SupabaseClient, User as AuthUser } from '@supabase/supabase-js';`. It must stay `import type` (supabase-ledger.md: no value import from supabase-js in `src/`).
2. New ref, placed right after `authEpochRef` (`:802`):
   ```ts
   // ADR 0105: the user whose cloud data this provider holds or is loading.
   // The auth listener loads only for a different user; `resetToGuestState`
   // clears it, so signing back in loads again.
   const loadedUserIdRef = useRef<string | null>(null);
   ```
3. In `resetToGuestState`, add `loadedUserIdRef.current = null;` right after `lastCloudLoadAtRef.current = 0;` (`:857`). The callback's deps stay `[]`.
4. Inside the auth effect, add an inner function just above `const setupAuth` (`:963`):
   ```ts
   // ADR 0105: one cloud load per signed-in user. supabase-js announces the
   // same session again as INITIAL_SESSION on subscribe, TOKEN_REFRESHED on
   // each refresh, SIGNED_IN on every return to the tab and USER_UPDATED on
   // a rename. Those only refresh the profile fields, and keep the same
   // object when none changed, so they redraw nothing. A return to the tab
   // reloads through the realtime effect's stale check (ADR 0023) instead.
   const adoptSession = async (user: AuthUser) => {
     const next: User = {
       id: user.id,
       email: user.email || 'user@supabase.io',
       name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
     };
     setIsAuthenticated(true);
     setCurrentUser((prev) =>
       prev.id === next.id && prev.email === next.email && prev.name === next.name ? prev : next
     );
     if (loadedUserIdRef.current === user.id) return;
     loadedUserIdRef.current = user.id;
     await loadSupabaseData(user.id);
   };
   ```
   The ref is set before the `await`, so an event that arrives while the load runs does not start a second one. A load that fails leaves the ref set. The badge's retry, Sync now and the realtime effect's triggers recover from it, as they do today.
5. In `setupAuth`, replace the body of `if (session?.user) { ... }` (`:967-973`) with `await adoptSession(session.user);`. Keep the `else { setIsAuthenticated(false); }`.
6. In the `onAuthStateChange` handler, replace the body of `if (newSession?.user) { ... }` (`:987-993`) with `await adoptSession(newSession.user);`. Keep the `SIGNED_OUT` branch (`:982-985`) and the `else { setIsAuthenticated(false); }` as they are.
7. Replace the comment at `:765-776` (the line above `const isSeedingRef`) with:
   ```ts
   // Phase 30: guards against concurrent seed attempts. Two loads can overlap
   // for one brand-new (wallets-empty) account: before ADR 0105 the auth-state
   // effect below loaded from `getSession()` and again on `onAuthStateChange`'s
   // initial event, and a startup load can still overlap a reload from another
   // trigger (`online`, Sync now). Each concurrent call would independently see
   // "empty" and insert its own full set of starter wallets/categories - the
   // root cause of "each default category appearing 2-3 times" in every
   // category picker. This ref stops one tab calling `seed_starter_account()`
   // twice at once; the function's own per-account lock covers every other
   // caller (ADR 0039).
   ```

The effect's deps (`[loadSupabaseData, resetToGuestState]`, `:1018`) stay the same. Nothing else in the file changes.

## 8. ADR 0105 (`docs/audit/decisions/0105-one-cloud-load-per-session.md`)

Use ADR 0104's layout: title `# 0105: One cloud load per signed-in user`, `**Status:** Accepted`, `**Date:** 2026-10-24`, then `## Context`, `## Options considered`, `## Decision`, `## Consequences`, `## Revisit if`. Contents:

- **Context:** the owner still saw Syncing on open and a refresh-like redraw after Phase 144. Give the evidence from section 4: the two loads on open (`getSession` plus `INITIAL_SESSION`), the `SIGNED_IN` or `TOKEN_REFRESHED` on every hidden-to-visible change, the hourly `TOKEN_REFRESHED`, the cross-tab `BroadcastChannel` re-emit, and the new `currentUser` object on every event. Cite auth-js 2.116.0 and the `GoTrueClient.js` line numbers above.
- **Options considered:**
  - A: load only on `SIGNED_IN` (filter by event name). Rejected: auth-js emits `SIGNED_IN` on every return to the tab and re-broadcasts it to other tabs, and ADR 0083 counts on `INITIAL_SESSION` carrying a sign-in that finished before the listener subscribed.
  - B: key on the user id (`loadedUserIdRef`). Chosen.
  - C: drop the `getSession()` load and load only from `INITIAL_SESSION`. Rejected: it changes ADR 0083's startup path for no gain over B, and the tab-return `SIGNED_IN` still needs B's guard.
- **Decision:** section 7's rule. The listener loads only when the session's user differs from `loadedUserIdRef`. The startup `getSession()` path goes through the same `adoptSession`. `resetToGuestState` clears the ref. Same-user events update only a changed profile field and keep the same `currentUser` object otherwise. `SIGNED_OUT` handling is unchanged (ADR 0024).
- **Consequences:**
  - One load per signed-in open.
  - A return to the tab reloads only under ADR 0023's 30 s stale rule.
  - A token refresh and another tab's events reload nothing; another device's writes still arrive through realtime.
  - A single cold load slower than 1 s still shows Syncing, by the ADR 0026 amendment.
  - The unit harness now triggers reloads through `refreshFromCloud`, not auth events.
- **Revisit if:** supabase-js changes which events it emits for an existing session, or the app ever switches users without a sign-out in between.

## 9. Context doc bullet (`docs/contexts/supabase-ledger.md`)

Add this bullet right after the `**Sign-out clears the device:**` bullet (`:61`), and add `0105` to the section heading's bracket list (`:55`), giving `## Accounts and sessions [0024, 0072, 0087, 0099, 0105]`:

```
- **One cloud load per signed-in user** [0105]: the auth listener loads only when the session's user differs from `loadedUserIdRef`, which the startup `getSession()` load sets and `resetToGuestState` clears. `INITIAL_SESSION`, `TOKEN_REFRESHED`, `USER_UPDATED` and a repeated `SIGNED_IN` for that user update only a changed profile field, keeping the same `currentUser` object otherwise. A return to the tab reloads through the realtime effect's 30 s rule [0023], never through an auth event.
```

## 10. Ledger

Add a `## Phase 145 - One cloud load per session (ADR 0105)` section above `## Backlog` in `docs/audit/task-ledger.md`. Give it the line ``Branch `phase-145-one-load-per-session`, cut from `main` at `c9269ba`.``, the usual table header, and the T801 row (Files: the four target files plus `docs/audit/task-ledger.md`). Leave the Commit cell empty.

## 11. Gates

Check ports 3000 and 3100 for stale dev servers before Playwright. Save each full-suite run to `workflow/stages/02_build/output/logs/`.

```
npm run lint
npx vitest run unit/authenticated-ledger.test.tsx unit/supabase-lazy-provider.test.tsx
npm run test:unit 2>&1 | tee workflow/stages/02_build/output/logs/T801-unit.log
npx playwright test tests/auth.spec.ts tests/account-and-mobile-nav.spec.ts tests/storage-persistence.spec.ts --project=chromium
npx playwright test tests/auth.spec.ts tests/account-and-mobile-nav.spec.ts tests/storage-persistence.spec.ts 2>&1 | tee workflow/stages/02_build/output/logs/T801-e2e.log
```

Plus:

- The red run and the negative control in 6a, both logged.
- Line endings kept: `git ls-files --eol src/context/FinanceContext.tsx unit/authenticated-ledger.test.tsx docs/contexts/supabase-ledger.md docs/audit/task-ledger.md` still shows `w/crlf`. The new ADR is CRLF like ADR 0104: check it with `node -e "const s=require('fs').readFileSync('docs/audit/decisions/0105-one-cloud-load-per-session.md','utf8');console.log((s.match(/\r\n/g)||[]).length,(s.match(/(^|[^\r])\n/g)||[]).length)"`, which must print a CRLF count and `0`.
- 0 em dashes: run the two Node commands from `workflow/stages/01_spec/CONTEXT.md`'s Rules section: the added-lines count over `git diff -U0 HEAD`, and the whole-file count on `docs/audit/decisions/0105-one-cloud-load-per-session.md`. Both print 0.
- Docs check: each `file:line` and auth-js line the ADR cites exists at the installed 2.116.0.
- Scope: `git status --porcelain` shows only the target files, the ledger and the stage outputs.

## 12. Production touch points

None. No migration, no SQL, no `/api/*` request, no dashboard or Vercel change, and no sign-in from a local dev server. The orchestrator still pauses for the owner before `build T801`, because `src/context/FinanceContext.tsx` is a money-path target. After the phase merges, the owner can check the deployed app (one Syncing at most on open, nothing on a return to the tab within 30 s). That is the owner's own check, not a task step.

## 13. Out of scope

- The realtime effect: `scheduleReload`, `handleVisible`, `CLOUD_STALE_AFTER_MS`, `verifySession` and its timers (`:1122-1200`).
- `NavbarSyncBadge`'s 1 s timer and the ADR 0026 amendment. If one cold load is still slow enough to show Syncing, that is a separate task.
- The `SIGNED_OUT` branch, the null-session `else` branches, `resetToGuestState`'s other steps, and `signOut`.
- `loadSupabaseData`, `readCloudSlices`, the seed flow and `isSeedingRef` (comment text only, section 7 item 7).
- `src/lib/supabase.ts`, `whenSupabaseLoads` and `sessionMayExist`.
- Upgrading or pinning supabase-js. A new Playwright spec: a signed-in e2e needs real credentials, which is stop-and-ask.
- `profiles.name` drift (ADR 0032) and the Account modal.
- The other auth-event tests (`:964`, `:2202`, `:2278`, `:2358`, `:2368`) and `unit/supabase-lazy-provider.test.tsx`.
- `docs/contexts/client-state.md`, `AGENTS.md` and README counts: the phase's closing task updates the test counts.
