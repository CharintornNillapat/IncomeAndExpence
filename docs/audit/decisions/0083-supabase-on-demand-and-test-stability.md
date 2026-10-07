# 0083: A guest's load fetches no supabase-js; a timing test checks what happened, not how fast; spinners stop under reduced motion

**Status:** Accepted. Code `75f00e5`, docs `8dc7e5f`, draft PR #58; not merged.
- **Amends** ADR `0024` (sessions): a session is resumed by a client that loads at boot only when one may exist.
- **Amends** ADR `0050` (Server-Timing tests): "no round trip" is a fetch that did not happen.
- **Amends** ADR `0082`: `animate-spin` and `animate-pulse` stop under `prefers-reduced-motion` too.

**Date:** 2026-10-07

## Context

1. **The cold start.** After ADR `0082` a first load fetched 179,535 B of JS (gzip): `vendor-react` 60,257, `vendor-supabase` 58,546, the entry 55,413, `vendor-icons` 5,319. A guest uses no Supabase code at all, yet paid a third of that, because `src/lib/supabase.ts` built the client when it loaded and `FinanceContext` (in the entry) imported it.
2. **Who imports the client:**

   | File | Uses | When it runs |
   |---|---|---|
   | `context/FinanceContext.tsx` | 54 call sites (`from` and `rpc` in the ledger writes and `loadSupabaseData`, `auth.*`, the realtime channel), and two error helpers imported as values from `@supabase/supabase-js` | every call after the auth effect's own is gated on `isAuthenticated`, a signed-in user id, or the signed-in effect; `signOut` only on `isSupabaseConfigured` |
   | `components/AuthModal.tsx` | `signUp`, `signInWithPassword`, `resetPasswordForEmail` | on submit; the dialog is eager |
   | `components/account/AccountModal.tsx` | `updateUser` twice | on submit, signed in; the dialog is lazy |
   | `utils/jevClassifier.ts`, `utils/insightsClient.ts` | `authorizationHeader()` | on each AI request, guest or signed in |

   The helper imports (`isAuthApiError`, `isAuthSessionMissingError`) alone would have kept the whole chunk on the cold start.
3. **A flaky unit test.** `proxy-contract.test.ts`'s "a check with the keys already held ... takes no round trip" asserted the local token check took under 15 ms. Under the full suite's load it once took 28.8 ms (Phase 106). The other figures in that block are lower bounds, which load can only lengthen; this was the suite's one wall-clock ceiling.
4. **Spinners.** ADR `0082` stopped every tween under reduced motion but left `animate-spin` (the sync, insights and sign-in spinners) and `animate-pulse` (the microphone while listening) running. One already used `motion-safe:`.

## Decision

1. **`src/lib/supabase.ts` imports supabase-js only in `loadSupabase()`** (a dynamic `import()`, memoised; a failed import is forgotten so the next call retries). `supabase` stays the export every call site uses, now a live binding set when the client is made.
   - **`sessionMayExist()`** decides whether the client loads at boot: a session under supabase-js's own key (`sb-<first label of the project host>-auth-token`, worked out as the library does, so no stored session moves and nobody is signed out), an auth redirect in the URL (`access_token`, `refresh_token`, `error_description`, `code`; the confirmation and recovery links that `detectSessionInUrl` reads), or storage that cannot be read. When it is true the import starts as the module runs, the earliest it can without a preload.
   - **Otherwise it loads when needed:** `AuthModal` starts it on opening; a `storage` event that writes the session key (another tab signing in) starts it; `loadSupabase()` callers start it.
   - **`whenSupabaseLoads(listener)`** lets `FinanceContext`'s auth effect start `getSession` and `onAuthStateChange` whenever the client arrives; on a signed-in device that is at boot, as before. A sign-in that completes before the listener subscribes still reaches it, as `INITIAL_SESSION`.
   - **Call sites:** `AuthModal` and `AccountModal` await `loadSupabase()` (a failed import reads "Could not reach the server"); `authorizationHeader()` returns `{}` for a guest without loading anything; `signOut()` without a client only clears the device. The signed-in call sites in `FinanceContext` are unchanged.
   - **The two error helpers** are copied into `lib/supabase.ts` with supabase-js's own duck-typed check (`__isAuthError` and the name). Nothing in `src/` imports a value from `@supabase/supabase-js`.
2. **The flaky assertion checks the fetch, not the clock:** the stub's calls during the second request must not include the key set's URL, the steps must arrive in order, and they must fit within `total`. The lower bounds stay.
3. **`animate-spin` and `animate-pulse` are `animation: none` under reduced motion,** in the same `index.css` block as ADR `0082`'s keyframes, so a spinner added later is covered too. Each sits beside text that says what is happening, or in a disabled button.

## Verification

- **Red first, the loader:** `unit/supabase-lazy.test.ts` (15 tests: no client at import, one client however often asked, listeners, the cross-tab load, `sessionMayExist` for a guest, a stored session, three redirect forms, blocked storage and no settings, `authorizationHeader` for a guest, the copied error checks) failed 13 of 14 on the eager module; the 15th, the early start, was added with it.
- **The provider on a guest load:** `unit/supabase-lazy-provider.test.tsx` mounts the real `FinanceProvider` with a controllable loader: a guest load calls nothing; when the client arrives the auth listener starts and a `SIGNED_IN` makes the provider signed in and loading; a guest's sign-out calls nothing. Two negative controls failed their tests: loading at every boot, and starting the listener only at boot.
- **The signed-in paths:** `authenticated-ledger.test.tsx` (session resumption, eviction on a rejected `getUser`, the 401 signal, sign-out, every ledger write) passes unchanged apart from its mock, which now says the client is loaded and a session may exist. `supabase-client.test.ts` drives the real client after `loadSupabase()`. No Playwright spec signs in, and none can on CI (no Supabase settings); this is the same boundary ADR `0022` drew.
- **In the browser:** `tests/auth.spec.ts`'s new test fails if a guest's load and use request the library (`@supabase_supabase-js`, as the dev server serves it) or the project; adding `import '@supabase/supabase-js'` to `main.tsx` made it fail with exactly that request.
- **The flaky test:** with the token check slowed by 30 ms of busy work, the old assertion failed (30.7 ms against 15) and the new one passed; without the first request (the keys not yet held) the new assertion failed on the key set's URL.
- **Spinners:** `tests/reduced-motion.spec.ts` reads the computed `animation-name` of an `animate-spin` and an `animate-pulse` element: `spin` and `pulse` normally, `none` under reduced motion. It failed in all three browsers before the rule.
- **Gate:** in the refactor log.

### Bundle (gzip -9, both sides built with `.env`; `main` is `60b03a3`, whose entry production serves)

| Cold start | `main` | Phase 107 | Change |
|---|---|---|---|
| `index` (entry) | 192,536 / 55,413 | 193,689 / 55,840 | +1,153 / +427 (the loader) |
| `vendor-react` | 193,822 / 60,257 | 193,822 / 60,257 | 0 |
| `vendor-supabase` | 227,036 / 58,546 | not on a guest's load | −58,546 |
| `vendor-icons` | 24,742 / 5,319 | 24,742 / 5,319 | 0 |
| **Guest JS** | **638,136 / 179,535** | **412,253 / 121,416** | **−225,883 / −58,119 (−32.4%)** |
| `index.css` | 52,877 / 10,138 | 52,906 / 10,147 | +29 / +9 |
| **Guest JS and CSS** | **691,013 / 189,673** | **465,159 / 131,563** | **−225,854 / −58,110 (−30.6%)** |

A signed-in load fetches `vendor-supabase` (228,140 / 58,955) after the entry rather than beside it: 180,371 B of JS in all, 836 more than before. All app JS 875,762 / 265,840 to 877,619 / 266,475 B; `sw.js` 4,181 / 1,588, and the chunk stays precached.

### Timing (Chromium, 150 ms round trip, 1.6 Mbps down, median of 5 cold loads, 3 warm; requests to the project aborted)

| Load | `main` first paint | Phase 107 first paint | `main` client ready | Phase 107 client ready |
|---|---|---|---|---|
| Guest, cold | 1,368 ms | 1,080 ms (−288) | 1,279 ms (unused) | not loaded |
| Stored session, cold, no service worker | 1,364 ms | 1,076 ms (−288) | 1,275 ms | 1,888 ms (+613) |
| Stored session, warm (service worker precache) | 52 ms | 52 ms | 12 ms | 21 ms (+9) |

The cold signed-in row is the cost: the chunk's request waits for the entry. It applies only when the precache is gone. A device normally signs in from a guest load, whose service worker has already precached every script.
