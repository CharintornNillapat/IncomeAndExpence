# T799 spec: an own save never triggers a full cloud reload

Phase 144 (`phase-144-smooth-sync-and-tabs`). Follows T797 (8633c17) and T798 (2868d31). Does not close the phase.

## 1. Goal

When this client saves something while signed in, the page should not re-read every table afterwards. A change made on another device must still reload. The recovery re-reads for an unknown outcome or a reload that lands mid-write (T69, ADR 0022/0023) stay exactly as they are, and no ledger arithmetic changes.

## 2. Target files

The builder writes the ADR amendment first, before any code.

```
docs/audit/decisions/0003-localstorage-and-realtime.md
src/context/FinanceContext.tsx
src/context/DiaryContext.tsx
unit/authenticated-ledger.test.tsx
docs/contexts/client-state.md
```

(`docs/audit/task-ledger.md` is bookkeeping and always allowed: see section 9.)

No new ADR number. ADR 0003 defined echo suppression (T17), so this is an amendment to it, the same way T798 amended ADR 0026.

## 3. Context to read

- `docs/contexts/client-state.md`: the signed-in harness rules (no `act()`, macrotask fakes, `landed`, `quietPeriod` only to prove an absence), the "Every write" and reconnection rules this task must not break.
- `docs/audit/decisions/0003-localstorage-and-realtime.md` (to amend), and `0023-atomic-server-ledger-writes.md` for the recovery re-reads that must stay.

## 4. Current behaviour, and the verdict on each suspected gap

Line numbers are at HEAD `2868d31` (T798 shifted the ones in the order by about 10).

### How echo suppression works today

- `markLocalWrite(id)` adds the id to `recentLocalWriteIds` and deletes it after `LOCAL_ECHO_SUPPRESS_MS` = 5000 (`src/context/FinanceContext.tsx:585-593`).
- The realtime handler (`:1140-1147`): when the row id is in the set it **deletes it** (`:1143`) and drops the event; otherwise it calls `scheduleReload()` (`:1146`), which after a 400 ms debounce (`:1123-1132`) calls `loadSupabaseData`, a full read of all six tables that sets `isSyncing` and replaces every slice (`:897-944`).
- The decision is made when the event arrives. An id marked a few ms later (after the response) cannot undo a reload already scheduled.
- There are no row triggers on the five synced tables. The only `create trigger` statements are on `auth.users` (`supabase/migrations/20260901_baseline_schema.sql:230`, `20260930_phase58s_profiles_hardening.sql:76`).
- The harness's fake channel ignores `.on()` (`unit/authenticated-ledger.test.tsx:235-243`), so no unit test has ever delivered a `postgres_changes` event. Nothing tests echo suppression today.

### Gap 1: ids marked only after the call. REAL.

- TRANSFER marks the transaction and both wallets only after `transfer_funds` returns (`FinanceContext.tsx:1894-1896`). The SQL updates source, then dest, then inserts the row (`supabase/migrations/20261006_phase93_transfer_funds_from_session.sql:139-161`). An echo of any of the three that beats the HTTP response schedules a reload.
- `record_transaction` marks wallet and debt before the call (`:1910-1911`) but the new row id only after (`:1938`). The row id is server-generated, so it cannot be known earlier; its INSERT echo, if it beats the response, schedules a reload.
- The same server-id race applies to every insert whose id the server makes: `create_wallet` (`:1322`, `:1326`), `addCategory` (`:1516`), `addDebt` (`:2643`), and the diary insert (`src/context/DiaryContext.tsx:132`). The diary **update** also marks its known id only after the call (`DiaryContext.tsx:132`).
- Whether the echo beats the response is a network race not yet seen in a browser; the code allows it on every one of these paths.
- **Fix:** (a) mark every id known before the call, before the call (transfer wallets, diary update, import wallets and debts); (b) decide at the end of the debounce, not on arrival: an unmarked event's id is remembered, and when the 400 ms timer fires the reload runs only if at least one remembered id is still unmarked. That covers every server-generated id whose response lands within 400 ms of its echo, with one change in the shared handler instead of one per write path.

### Gap 2: an id consumed by its first echo. REAL, for two RPCs.

- `update_transaction` with a money change calls `_ledger_apply_effect` twice, reversing the old effect and applying the new (`supabase/migrations/20260930_phase58b_update_transaction.sql:210-217`). An edit that keeps the wallet updates that wallet row twice in one transaction, so it echoes twice. The client marks the wallet once (`FinanceContext.tsx:2339`); the first echo deletes it (`:1143`), and the second schedules a reload. Every amount edit of an expense or income hits this.
- `create_wallet` with a non-zero opening inserts the wallet at 0, then updates it through `_ledger_apply_effect` (`supabase/migrations/20260928_phase52_security_ledger.sql:116-141`): two echoes for one wallet id.
- `record_transaction`, `transfer_funds` and `set_transaction_deleted` touch each row once. `import_transactions` makes one relative update per wallet (`20260928_phase52_security_ledger.sql:552`).
- The trigger case in the order is not real: there are no row triggers (above).
- **Fix:** an echo of a marked id no longer deletes it; the id stays suppressed until its own 5 s timer expires.

### Gap 3: `refreshFromCloud()` after a successful save. REAL in two places; the cited lines are recovery and stay.

- `commitBulkImport` `:2553-2559` (the lines the order cites): both are failure paths, an unknown outcome (`!rpcError || isUnknownOutcomeError`) and the server's `DEBT_OVERPAYMENT`. They are recovery re-reads and **stay unchanged**. So are `addWallet` `:1318` (unexpected response) and `:1334` (unknown outcome), `addTransaction` `:1982`/`:1995`, `setTransactionDeleted` `:2216`/`:2228` and `updateTransaction`'s `undo` `:2327-2336`.
- **Real 1:** the diary save. `upsertDiaryEntry` re-reads all six tables after every successful signed-in save (`DiaryContext.tsx:133`), although both branches already get the saved row back through `.select().single()` (`:112-113`, `:125-126`). **Fix:** apply the returned row and drop the re-read.
- **Real 2:** the CSV import success path calls `refreshFromCloud()` (`FinanceContext.tsx:2574`). That one read **stays**: `import_transactions` returns only `inserted_ids` and `balances`, not the rows, so the client cannot show them without reading. But it marks nothing, so every row's INSERT echo and each wallet's UPDATE echo schedule a **second** full reload 400 ms later (the comment at `:2572-2573` admits "at most one more"). **Fix:** mark the wallets and debts before the call and the inserted ids after it, so the echoes add no second load.

## 5. The change

### 5a. `docs/audit/decisions/0003-localstorage-and-realtime.md` (first, before any code)

Append a section `## Amendment (T799, Phase 144): an own save does not reload`. Keep the file's LF endings. Say, in plain words:

- What was wrong: the three gaps above, each with one line of evidence.
- Decision 1: every write marks the ids it knows before its call. A server-generated id is marked as soon as the response gives it.
- Decision 2: an event is judged when the debounce fires, not when it arrives. An unmarked event's id is remembered. When the 400 ms timer fires, the full reload runs only if a remembered id is still unmarked, or a trigger with no row id asked for one (an event without an id, `online`, `visibilitychange`, re-`SUBSCRIBED`).
- Decision 3: an echo no longer consumes its id. The id stays suppressed for its 5 s window, so one save that changes a row twice (`update_transaction`'s reverse and apply, `create_wallet`'s insert then opening) stays quiet.
- Decision 4: a write that gets its saved row back applies it and does not call `refreshFromCloud()` (the diary save). A write whose response lacks the rows keeps its one read (the CSV import), but its echoes add no second.
- Unchanged: the 400 ms debounce, the 5 s window, the `user_id` filter, every recovery re-read (unknown outcome, T69 mid-flight, `DEBT_OVERPAYMENT`, unexpected response), the reconnection triggers, and all ledger arithmetic.
- Limits (the known trade-offs): (1) an echo that arrives more than 400 ms before its own response still reloads once. That is a wasted read, not a wrong screen. (2) Another device's change to a row this client wrote in the last 5 s, arriving alone, is not reloaded until the next trigger (any other remote change, `online`, a re-subscription, a return to the tab after 30 s, or Sync now). Under the old consume-on-first-echo rule, a remote change that beat the own echo was already dropped the same way.

### 5b. `src/context/FinanceContext.tsx`

1. **Realtime effect (`:1120-1192`).** Inside the effect, beside `reloadTimer`, add a `Set<string>` of pending unmarked ids and a `boolean` "a trigger asked for a reload". Replace `scheduleReload` and the handler so that:

   ```ts
   const pendingEchoIds = new Set<string>();
   let reloadRequested = false;
   // rowId: an unmarked postgres_changes row; none: online, visible, resubscribe
   const scheduleReload = (rowId?: string) => {
     if (rowId) pendingEchoIds.add(rowId);
     else reloadRequested = true;
     if (reloadTimer) clearTimeout(reloadTimer);
     reloadTimer = setTimeout(() => {
       reloadTimer = null;
       // An id marked since its event arrived was this client's own write whose
       // response came after the echo (ADR 0003 amendment, T799).
       const remote = reloadRequested || [...pendingEchoIds].some((id) => !recentLocalWriteIds.current.has(id));
       pendingEchoIds.clear();
       reloadRequested = false;
       if (remote) loadSupabaseDataRef.current?.(currentUser.id);
     }, REALTIME_RELOAD_DEBOUNCE_MS);
   };
   ```

   The handler becomes: `const rowId = payload.new?.id ?? payload.old?.id; if (rowId && recentLocalWriteIds.current.has(rowId)) return; scheduleReload(rowId);` with **no** `delete`. An event with no id calls `scheduleReload(undefined)`, so it still always reloads. The three other callers (`:1156` re-`SUBSCRIBED`, `:1165` `online`, `:1171` visible) keep calling `scheduleReload()` with no argument, and so always reload. The cleanup (`:1184`) is unchanged. The effect's deps are unchanged.
2. **Comments.** Rewrite the `recentLocalWriteIds` comment (`:575-584`) and the "Self-echo suppression" bullet (`:1091-1094`) to describe the new rule: marked before the call where the id is known; judged at the end of the debounce; not consumed; expires after 5 s; ADR 0003 amendment (T799). No em dash.
3. **TRANSFER (`:1848-1898`).** Move `markLocalWrite(sourceWallet.id)` and `markLocalWrite(destWallet.id)` to just before `await supabase.rpc('transfer_funds', ...)`. Keep `markLocalWrite(mapped.id)` after the response, where it is now. Nothing else in the branch moves.
4. **`commitBulkImport` signed-in branch (`:2533-2580`).** Just before `await supabase.rpc('import_transactions', ...)`, call `markLocalWrite` for every key of `walletDeltas` and every key of `debtTotals`. On success, before `await refreshFromCloud()` at `:2574`, call `markLocalWrite` for every id in `payload!.inserted_ids`. Keep that `refreshFromCloud()`. Rewrite the comment at `:2572-2573` to say the rows arrive by this one read and their echoes add none. The failure branch `:2544-2570` is unchanged, byte for byte.
5. Nothing else in this file changes. In particular: `addWallet`, `addCategory` and `addDebt` keep marking after the response (their ids are server-made, and 5b.1 covers them); `record_transaction`, `setTransactionDeleted` and `updateTransaction` already mark before; `LOCAL_ECHO_SUPPRESS_MS`, `REALTIME_RELOAD_DEBOUNCE_MS` and `CLOUD_STALE_AFTER_MS` keep their values.

### 5c. `src/context/DiaryContext.tsx` (`upsertDiaryEntry`, `:93-160`)

- Update branch: call `markLocalWrite(existing.id)` before the `update(...)` call.
- After `if (error) return ...` (`:128-130`), replace `markLocalWrite(existing?.id ?? upserted?.id); await refreshFromCloud();` with:
  - if `upserted` is falsy: `await refreshFromCloud()` (the same unexpected-response re-read `create_wallet` uses at `FinanceContext.tsx:1316-1319`), then return `{ success: true }` as today;
  - otherwise: `const saved = mapDiaryRow(upserted); markLocalWrite(saved.id); setDiaryEntries((prev) => prev.some((e) => e.id === saved.id) ? prev.map((e) => (e.id === saved.id ? saved : e)) : [saved, ...prev]);`. A new day is prepended, as the guest branch does (`:147-155`).
- Update the doc comment at `:76` ("A signed-in save reloads from the cloud, as before") to say that a signed-in save applies the row the server returns.
- `deleteDiaryEntry` is unchanged. The `refreshFromCloud` parameter stays, since the fallback uses it.

### 5d. `docs/contexts/client-state.md` (once the code complies)

Under "Every write", add one bullet after the reconnection bullet (`:30`): "**Own echoes never reload** [0003 amendment]: mark every row id known before the call, before it, and a server-made id as soon as the response gives it (`markLocalWrite`). The realtime handler judges an event when its 400 ms debounce fires, so an id marked meanwhile does not reload, and an echo does not consume its id. A write whose response carries the saved row applies it; never call `refreshFromCloud()` after a success, only to recover." Keep CRLF.

## 6. Parity map

- `addTransaction` / `setTransactionDeleted` arithmetic vs `_ledger_apply_effect`: **touched by position only**. 5b.3 moves two `markLocalWrite` calls inside the TRANSFER branch; no arithmetic, rounding or RPC argument changes. The reviewer confirms from the diff that no arithmetic line moved. Guarded by `unit/authenticated-ledger.test.tsx`, `unit/ledger-guards.test.tsx`.
- No other row.

## 7. Tests to add (red first, all in `unit/authenticated-ledger.test.tsx`)

### Harness additions (in the hoisted `fake`, keep every existing behaviour when off)

- `state.realtime: Map<string, (payload: { new?: Record<string, unknown> | null; old?: Record<string, unknown> | null }) => void>` and `state.echo: boolean` (default `false`).
- The fake channel's `on(_event, opts: { table: string }, cb)` stores `cb` under `opts.table` and returns the channel.
- `emit(table, row)` on the fake: when `state.echo` is true, calls the stored handler with `{ new: { ...row } }`. Synchronous, so an echo fired inside a write lands before the caller's `await` resumes, as an echo that beats the response.
- The builder's `insert` emits each inserted row; its `update` emits each matched row after the assign, and returns the matched rows when the call chained `.select()` (`single` gives the first or `null`, otherwise the array), as PostgREST does. An update without `.select()` still returns `data: null`.
- The JS stand-ins emit what the SQL writes: `applyEffect` emits each wallet and debt row it changes (so `update_transaction`'s reverse and apply emit the same wallet twice); `insertTransaction` emits the new row; `create_wallet` emits the wallet row on insert; `set_transaction_deleted` and `update_transaction` emit the transaction row after changing it.
- `beforeEach` sets `fake.state.echo = false` and clears `fake.state.realtime` before `mountSignedIn()`.

### New `describe('an own save does not reload (T799, ADR 0003 amendment)')`

Each test sets `fake.state.echo = true` and calls `installLedgerRpcs()`. `quietPeriod` is the 600 ms helper, used only to prove an absence. "No reload" means `writes('wallets', 'select')` has length 0 after the action and a `quietPeriod`.

| # | Test | Why it fails today |
|---|---|---|
| 1 | An expense whose echoes arrive before its response: `expense(200)`, `landed`, quiet; no reload; wallet 4800. | The INSERT echo arrives before `markLocalWrite(mapped.id)` (`:1938`), so `:1146` schedules a reload. |
| 2 | A transfer whose echoes arrive before its response. Install a local `transfer_funds` stand-in in the test: update source, update dest, insert the TRANSFER row with `destination_wallet_id`, emit each, return `{ reused: false, transaction, source_balance, dest_balance }`. `addTransaction` TRANSFER 250 WALLET to CASH; no reload; balances 4750 and 1250. | Both wallets and the row are marked only after the response (`:1894-1896`). |
| 3 | A money edit that keeps its wallet: `expense(200)` with `echo` still false, `landed`, then set `echo = true`, clear `calls`, `updateTransaction(id, editOf(id, { amount: 250 }))`; no reload; wallet 4750. | The first wallet echo deletes the mark (`:1143`); the second (the apply after the reverse) reloads. |
| 4 | A new wallet with an opening balance: `addWallet({ name: 'Visa', type: 'CREDIT_CARD', ... }, -5000)`; no reload; the wallet shows at −5000 (compare the number, not text). | The wallet's INSERT echo arrives before `:1322`, and its UPDATE echo is a second echo of the same id. |
| 5 | A diary save for a new day (a new test in this block): no select on any table (check `writes('wallets', 'select')` and `writes('diary_entries', 'select')`), and `entries()` shows the row. Also rename the existing test at `:2135` from "...then a reload shows it" to "...and the saved row shows without a reload". | `DiaryContext.tsx:133` re-reads every table on success. |
| 6 | A diary save for a day already logged: seed `ROW` and `refreshFromCloud()` first, clear `calls`, then save mood 5; no select; `entries()[0].mood` is 5. | Same line. |
| 7 | A CSV import reads once: `commitBulkImport([importRow({ amount: 300 })], 'import-key-t799')`; after `quietPeriod`, `writes('wallets', 'select')` has length **1**. | Today it is 2: the import's own `refreshFromCloud()` plus the reload the unmarked row echo schedules. |
| 8 | Guard: a change from another device still reloads. Set the server wallet's balance to 7777 and `fake.emit('wallets', serverWallet(WALLET))` with no local write; the wallet shows 7777. | Passes today and after; pins that a remote echo still reloads. |
| 9 | Guard: another device's row in the same window as an own save still reloads. `expense(200)`, then at once push a remote transaction row (id `transactions-remote-1`, on WALLET, EXPENSE 50) into the fake table and `emit` it; `waitFor` that row in `state().transactions`. | Passes today and after; pins "reload when any remembered id is unmarked". |

Red run: with the two source edits stashed (`git stash push -- src/context/FinanceContext.tsx src/context/DiaryContext.tsx`), run `npx vitest run unit/authenticated-ledger.test.tsx -t "T799"` and save the output to `workflow/stages/02_build/output/logs/T799-red.log`. Tests 1 to 7 must fail and 8 and 9 must pass. Then `git stash pop`.

## 8. Gates

```
npm run lint
npx vitest run unit/authenticated-ledger.test.tsx unit/diary-context.test.tsx unit/ledger-guards.test.tsx unit/navbar-sync-badge.test.tsx unit/entity-ids.test.tsx unit/rerender-matrix.test.tsx unit/supabase-lazy-provider.test.tsx
npm run test:unit 2>&1 | tee workflow/stages/02_build/output/logs/T799-unit.log
```

Check ports 3000 and 3100 for stale dev servers first, and never edit `src/` while Playwright runs.

```
npx playwright test tests/transaction.spec.ts tests/transaction-edit.spec.ts tests/wallets.spec.ts tests/csv.spec.ts tests/debt-repayment.spec.ts tests/diary.spec.ts tests/diary-page.spec.ts --project=chromium
npx playwright test tests/transaction.spec.ts tests/transaction-edit.spec.ts tests/wallets.spec.ts tests/csv.spec.ts tests/debt-repayment.spec.ts tests/diary.spec.ts tests/diary-page.spec.ts 2>&1 | tee workflow/stages/02_build/output/logs/T799-e2e.log
```

To catch timing flakes in the new realtime tests, run `npx vitest run unit/authenticated-ledger.test.tsx --sequence.shuffle` three times. All three must pass.

Line endings, with `git ls-files --eol <file>`: `w/crlf` kept for `src/context/FinanceContext.tsx`, `src/context/DiaryContext.tsx`, `unit/authenticated-ledger.test.tsx`, `docs/contexts/client-state.md`, `docs/audit/task-ledger.md`; `w/lf` kept for `docs/audit/decisions/0003-localstorage-and-realtime.md`.

Em dashes in added lines, which must print 0:

```
node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"
```

Scope: `git status --porcelain` and `git diff --stat` list only the five target files, `docs/audit/task-ledger.md` and the stage outputs.

## 9. Ledger

In `docs/audit/task-ledger.md`, Phase 144:

- Change the heading to `## Phase 144 - Smooth sync and tabs (ADR 0104, ADR 0026 amendment, ADR 0003 amendment)`.
- Add a row after T798: `| T799 | Stop a full cloud reload after this client's own save: mark known ids before the call, judge echoes when the debounce fires, keep marks for their 5 s window, apply the diary save's returned row (ADR 0003 amendment) | <the five target files>, docs/audit/task-ledger.md | in-progress | | |`. Set Status to `done` with the gate results when it lands. Leave Commit empty.
- Do not write `refactor-log.md` or `baseline-metrics.md`; a later docs task closes the phase. The unit test count rises by 9 (7 red tests and 2 guards; the renamed test at `:2135` is not new). Record the new total in the Gate result only.

## 10. Production touch points

none. No migration, no SQL, no live probe, no `/api/*` request, no sign-in from a dev server. (The pause rule still applies because `src/context/FinanceContext.tsx` is a money path.)

## 11. Out of scope

- Any file under `supabase/`, including making `import_transactions` return its rows or letting the client supply insert ids. That needs a migration and its own task.
- The recovery re-reads, byte for byte: `addTransaction` `:1976-1997`, `setTransactionDeleted` `:2212-2230`, `updateTransaction`'s `undo` `:2327-2336`, `addWallet` `:1316-1319` and `:1334`, `commitBulkImport` `:2544-2570`.
- Ledger arithmetic, `adoptLedgerState`, optimistic updates, rollbacks, guards, idempotency keys.
- `loadSupabaseData`, `readCloudSlices`, `cloudRevisionRef`, `lastCloudLoadAtRef`, `isSyncing`/`isManualSync` and the T798 badge.
- The reconnection triggers and `verifySession` wiring in the realtime effect, beyond the `scheduleReload` change in 5b.1.
- `addWallet`, `addCategory`, `addDebt`, `updateWallet`, the category and debt writes, `deleteDiaryEntry`, `KeywordRulesContext.tsx`, `TemplateContext.tsx`.
- The timing constants (400 ms, 5 s, 30 s).
- Exporting anything from `src/` for a test.
