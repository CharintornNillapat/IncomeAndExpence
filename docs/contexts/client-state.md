# Client state, money rules and entry logic

Read this before touching `src/context/`, `src/hooks/`, `src/selectors/`, `src/services/`, `src/utils/`, `TransactionForm.tsx`, the entry, import or classification flows, or `unit/` suites that mount a provider. Reasons live in the ADRs named in brackets (`docs/audit/decisions/NNNN-*.md`).

## Where state lives

- **`src/context/FinanceContext.tsx`** (about 2,900 lines) holds wallets, transactions, debts, categories and sessions in two contexts: `FinanceStateContext` (plain state) and `FinanceActionsContext` (every mutator). Read them with `useFinanceState()` and `useFinanceActions()`. Actions that touch hot state read the ref mirrors (`walletsRef`, `transactionsRef`, `debtsRef`, `categoriesRef`), never a closure over state, so the actions context stays stable.
- **Three slices have their own contexts** under `FinanceProvider` [0092, 0093, 0094]:
  - `DiaryContext.tsx`: `useDiaryState()` (`diaryEntries`), `useDiaryActions()` (`upsertDiaryEntry`, `deleteDiaryEntry`).
  - `KeywordRulesContext.tsx`: `useKeywordRulesState()`, `useKeywordRulesActions()` (`addKeywordRule`, `deleteKeywordRule`), `DEFAULT_KEYWORD_RULES`, `mapKeywordRuleRow`.
  - `TemplateContext.tsx`: `useTemplateState()` (`presets`), `useTemplateActions()`. Templates are local only. Applying one is `useFinanceActions().applyPreset`, a ledger write through `addTransaction`.
- **Three things stay in `FinanceProvider` for every slice:** the batched writer's key (`pf_diary`, `pf_presets`, ...), the one cloud load, and the sign-out reset and backup restore. A new slice moves the same way, and is chosen from `unit/rerender-matrix.test.tsx`, not by guess. Since ADR 0094 no slice split removes a re-render.
- **`src/services/`** [0097]: `readCloudSlices` (`financeHydration.ts`, with `mapWalletRow`, `mapTransactionRow`, `mapDebtRow`) reads the six tables in order, checks the sign-out epoch after every read, applies each slice through the setter it is given, and returns the failed tables or `null` when stopped. `backupAsGuest` (`financeBackup.ts`) rewrites a backup's rows as guest data. A service takes refs, setters and callbacks; it holds no React state. What decides a load (`isSyncing`, `isManualSync`, the epoch, `cloudRevisionRef`, `lastCloudLoadAtRef`, `syncError`, the starter seed) stays in the provider.
- **Views use the domain hooks** where one fits: `useTransactions(options)` (filters, search, metrics, writes), `useWallets()` (`wallets` active only, `allWallets`, `totalNetWorth`), `useDebts()` (`debts`, `activeDebts`, `settledDebts`, `metrics`, `editDebt`).
- **No component above view level subscribes to finance state.** `App.tsx`'s `MainApp`, `Navbar`, the swipe wrapper, `MobileBottomNav` and `AuthModal` call neither hook. A piece that needs data (Quick Add, `GuestDataNotice`, `AccountModal`'s body) subscribes itself.
- **There is no `useFinance()` shim.** Do not add one: a merged object is a new identity every render.
- **Never `React.memo` a component that still subscribes to a context.** Cut the subscription first, then memo.
- **No other state library** (Redux, Zustand).
- **One batched `localStorage` writer.** `pendingWritesRef` and `flushPendingWrites`, flushed on a 250 ms timer and on `pagehide`/`visibilitychange`, are the only `localStorage.setItem` site. Register a new persisted slice there; never add an effect that writes.

## Every write

- **Validate with Zod before mutating** (`src/utils/zodSchemas.ts`): `TransactionSchema` (addTransaction), `WalletSchema`, `DebtSchema`, `DiarySchema`, `CategorySchema`, `KeywordMappingSchema` (also trims and lower-cases), `AuthLoginSchema`. Format failures with `formatZodIssues(error)`.
- **Return `MutationResult`** (`{ success; error? }`), never throw. `addTransaction` adds `txId`; `commitBulkImport` adds `insertedCount`, `totalAmount`, `skippedCount`.
- **Callers keep the form open and filled on failure**, and reset or close only on success.
- **Surface Supabase errors.** Never hide them behind `if (!error && data)`.
- **Optimistic write, then the remote call:** check the returned `error`, roll back local state, compensate any committed remote write, then return the result.
- **`loadSupabaseData` bumps `cloudRevisionRef` only when every read succeeded** [0022 F6]. A reload that read nothing must not disarm an in-flight write's rollback.
- **A failed cloud load is never silent** [0026]: it sets `syncError` (cleared on a clean load and in `resetToGuestState`); `NavbarSyncBadge` shows "Sync failed" and retries through `refreshFromCloud`. Syncing shows at once only for `refreshFromCloud({ manual: true })` (Sync now and that retry); any other load shows it after 1 s, a timer in the badge [0026 amendment].
- **Reconnection lives in the realtime effect** [0023]: `online`, `visibilitychange` to visible (when the last clean load is over 30 s old), and `SUBSCRIBED` after an error or close all go through one debounced `scheduleReload`. None runs signed out; the first `SUBSCRIBED` does not reload; nothing queues writes offline.
- **Own echoes never reload** [0003 amendment]: mark every row id known before the call, before it, and a server-made id as soon as the response gives it (`markLocalWrite`). The realtime handler judges an event when its 400 ms debounce fires, so an id marked meanwhile does not reload, and an echo does not consume its id. A write whose response carries the saved row applies it; never call `refreshFromCloud()` after a success, only to recover.
- **Soft delete** (`isDeleted: true`) on records. The one hard delete is account deletion [0072]. Templates and keyword rules are configuration and hard-delete.
- **Idempotency:** `FinanceContext` tracks in-flight keys in a `Set`. Transfer forms arm one key per form, reuse it on retry, rotate it only on success. Use `generateIdempotencyKey()` from `src/utils/ids.ts`, never bare `crypto.randomUUID()` (undefined on an insecure origin such as a phone on `http://192.168.x.x:3000`).
- **New record ids are `generateEntityId(prefix)`** (`src/utils/ids.ts`, [0095]), never `` `${prefix}-${Date.now()}` ``. `npm run lint` enforces it (`check-safe-ids.mjs`); an exception carries `// safe-id-ignore: <why>`.

## Ordering rules tsc cannot catch

- **Never read a value assigned inside a `setState` updater after the call that scheduled it.** Only the first update in a batch evaluates eagerly. Compute from the ref mirror first and pass the value in.
- **Never build a remote write from a ref read after the optimistic `setState`** [0022 F1]. After an `await` the ref already holds the optimistic value; a repayment was once subtracted twice. Compute once before any `setState` and reuse it. Test with a partial repayment, since the `Math.max(0, ...)` floor hides a full one.
- **Feedback follows the event that produced it, never a passive effect** [0056]:
  - a panel for one entity is keyed by its id (`EditTransactionPanel`/`DeletedTransactionDetails` by `tx.id`, `WalletDetailBody` by `wallet.id`), so a late result lands on the gone instance;
  - "reset when an input changes" happens during render, with the last input kept in state (`baseVersion`, `shownFor`, `InlineMathInput`'s seed key [0057]);
  - text a live region speaks is set where its event happens [0055].
- **StrictMode runs effects, cleanups, then effects again a task later** (on in every Playwright run). A hook whose cleanup cancels pending work must survive that re-run: `useDescriptionClassifier` keeps the armed text and re-arms it [0087].

## Money and dates

- **THB only.** `CurrencyCode` is the one-member union `'THB'`. Use `APP_CURRENCY`/`APP_CURRENCY_SYMBOL` from `src/utils/currency.ts`.
- **Every displayed amount goes through `formatCurrencyAmount(value)`**: `฿1,234.50`, negative `−฿1,234.50` (U+2212). Never hand-roll `฿` with `toFixed(2)` or `toLocaleString`. Exceptions: CSV export values and `mathEvaluator`'s `formattedValue`. A static balance renders through `ui/Money`; balances never count up [0026].
- **`roundToCents` lives in `src/utils/money.ts:22`** and is the only cent rounding in the ledger. `FinanceContext`, the transfer preview and the debt payoff block all import it, so what the user sees is what commits. Never inline `Math.round(x*100)/100` at a ledger site, and never merge it with `mathEvaluator`'s `roundToTwoDecimals` (which nudges half cents). `csvExchange.ts`/`diaryExport.ts` aggregates are not ledger rounding.
- **One cap:** `MAX_AMOUNT` (999,999,999.99) and `MAX_AMOUNT_ERROR` in `utils/money.ts` [0086]. Never re-type the figure.
- **Arithmetic is `evaluateArithmetic` in `mathEvaluator.ts`** [0081]: `+ - * /`, unary signs, brackets, decimals. No library, no `eval`. `%` and `^` are refused; `(2)3` and `6/2(3)` are refused.
- **Dates are local calendar days (UTC+7).** Use `todayIsoDate()`, `toIsoDate(date)`, `daysAgoIsoDate(n)` from `src/utils/date.ts`. Never `new Date().toISOString().slice(0, 10)`. Compare `YYYY-MM-DD` as strings, never as parsed `Date`s. Full ISO timestamps stay right for `createdAt`/`updatedAt`.

## Money rules: `src/selectors/` [0028]

A screen showing spending, income, net, net worth or a debt figure computes it here, never with an inline filter. Every selector takes `today` as an ISO string and never reads the clock.

- **L1:** spending is `isSpending`, income `isIncome`: a live EXPENSE/INCOME not filed under a DEBT_REPAYMENT or ADJUSTMENT category. `spendingByCategory` groups by category id and sums to `sumSpending`. `daySpending` for a day.
- **L2:** `TimeRange` DAY is today, WEEK from `today − 7`, MONTH from `today − 30`; WEEK, MONTH and ALL are open-ended (`date-boundary.spec.ts` depends on WEEK).
- **L3:** `walletTotal`/`activeWallets` (not deleted, not archived); `netWorth(wallets, debts)` subtracts active debts.
- **L4/L5:** `monthsLeft` counts monthly payment dates from today through the due date, at least one [0087]. `requiredMonthly` rounds to cents, `null` without a due date. `debtPlan` warns when the total exceeds `monthlySurplus` (always the past 30 days).
- **`payoffPercent(total, remaining, ifNothingBorrowed)`** (`selectors/debts.ts`, [0079, 0080, 0081, 0084]) clamped 0 to 100. Never re-type the formula.
- **L6 to L13** (`display`, `adjustments`, `categories`, `pagination`): the Transactions page sorts newest first, pages with `visibleRows` before `groupByDay`, and takes each day's net from all its filtered rows. `cashFlow`, `walletShares`, `moodSpendingDays` serve the Dashboard, which computes every figure once in `DashboardView`. The 2026-10 redesign adds `leftOverFor` (Left over card, MONTH-only `afterDebtDue`), `dailySpendingSeries` (`selectors/diary.ts`; one point per day from the range's start through today, WEEK 8, MONTH 31) and `monthToDate` (day 1 to N of this month and last month) [0102].
- **Match a system category by type, never by id** (signed-in rows carry uuids).

## Ledger behaviour (`addTransaction` and friends)

- **Guard order in `addTransaction`:** the `existingTx` replay check, then the category-type check (an EXPENSE/INCOME under another type's category is refused [0085]) and the overpayment guard [0016], then `inFlightIdempotencyKeys.add`. Moving the guard before the replay rejects a retried settling payment; moving it after the key add leaks the key and bricks the form.
- **Repayments:** `Math.max(0, roundToCents(remaining - amount))`. A repayment cannot exceed what is owed (form and action both refuse). `isOverpaying` must test `repayTargetDebt !== null`, or every EXPENSE/INCOME submit is disabled.
- **Soft delete and restore move the debt with the wallet** (`setTransactionDeleted`), uncapped on reversal. `settleDebt` is the deliberate exception: it zeroes a debt with no wallet debit or row.
- **`editDebt` writes name, total, interest, minimum and due date only**, never `remaining_amount` or `is_settled`. `DebtEditSchema` refuses a total below what is owed (read from `debtsRef` before any `setState`).
- **A signed ADJUSTMENT** [0024]: its `amount` is the signed correction, never zero; every other type is strictly positive. Display with `txTypeMetaFor(type, amount)` and `Math.abs(amount)`.
- **Opening balances are ledger rows:** a non-zero opening writes an ADJUSTMENT "Opening balance". Starter wallets open at ฿0.00 [0040].
- **Wallets:** `editWallet` writes name, type and colour; `setWalletArchived` writes `is_archived`; neither sends `balance`. Archived wallets leave net worth and every new-entry picker but stay resolvable for history. Delete is a soft delete of the wallet only.
- **Transfers:** the preview mirrors `addTransaction`'s TRANSFER arithmetic with the shared `roundToCents`. Overdraft warns, never blocks: `overdraftBy(wallet, after)` (0 for a credit card) [0085]. A screen reader hears it through `wallet/OverdraftAnnouncer` [0090]; never put `aria-live` on the visible warning, and never add a confirmation dialog.

## The entry engine: `TransactionForm.tsx` [0007, 0013]

- **Three consumers:** `QuickAddModal`, `TransactionsView`'s Add modal, `DebtsView`'s repay modal (`lockType`/`presetDebtId`). New transaction-creating UI reuses it through its props.
- **The type toggle is EXPENSE/INCOME only.** TRANSFER was removed entirely; `TransferFundsModal`/`WalletTransferForm` is the one transfer surface. `DEBT_REPAYMENT` stays as a preset type.
- **Not entry flows:** `EditTransactionPanel` edits a row [0033]; `WalletDetail`'s Adjust balance writes a signed ADJUSTMENT through its own one-field form (permanent exception). There is one repayment path, through `addTransaction`.
- **No heading of its own;** callers render it inside a titled `Modal`.
- **Category select offers the entry type's categories only** and derives `shownCategoryId` during render [0084].
- **Express note** [0013]: the note is the first field and seeds the amount via `parseExpressInput`. A manual amount edit (`userTouchedRef.current.amount`) disables extraction for that entry; three specs depend on it. The ledger stores the note as typed; only the classifier sees the stripped text. Re-seed through `InlineMathInput`'s `seed: {key, value}` (applied during render, never a remounting `key`), and record the seeded amount in the same handler (`seedAmount`). A trailing number needs a whitespace boundary.
- **Payoff chips** seed through `#debt-repay-amount-math` and latch the amount field. The payoff block stays mounted with no amount typed.
- **A refused save's message clears when the amount changes** [0086].

## Categorization: rules first, Jev second [0011, 0012]

- **`smartMatcher.ts` runs first, synchronously, on every keystroke.** A rule hit short-circuits completely: no debounce, cache or network (`jev-classify.spec.ts` counts requests). `matchSmartDescription` stays leading-only for `keywords.spec.ts`.
- **Jev (`jevClassifier.ts`) only on a rule miss,** behind a 450 ms debounce, an abort of the superseded request and a sequence guard.
- **`classifyDescription()` never throws or rejects;** every failure resolves to `null`. There is no error boundary in `src/`. Its signature is frozen; callers that need a reason use `classifyOnce`.
- **`CONFIDENCE`:** at or above 0.85 auto-fills; 0.50 to 0.85 shows `CategorySuggestionChip`; below is silent. A type disagreement demotes to a chip. A late answer never overwrites a manual pick (`userTouchedRef`).
- **A category's `description` is what Jev sees.** `undefined` means never set (backfilled by name in `withDefaultDescriptions`); `''` means cleared and is never refilled.
- **The client sends the token through `authorizationHeader()`**, `{}` for a guest. A 401 is unavailable for that call and never latches; only 404 latches.

## Smart rules chip [0017]

`SaveRuleChip` offers a rule after a manual categorization. Five render-time conditions: `!lockType`; the category resolves and its type matches the form's; `userTouchedRef.current.category`; no existing rule matches; the keyword (`parseExpressInput(...).cleanDescription`, verbatim) is 3 to 32 characters, never truncated. `addKeywordRule` does not dedupe, so the no-match condition is an invariant. Save is disabled in flight. The confirmation is transient flash state. Nothing in the submit path waits on it.

## Voice [0018]

The transcript goes through `handleDescriptionChange`, the same function `onChange` calls; voice has no pipeline of its own. Support is a constructor **and** `window.isSecureContext`. Dictation appends. A blocked microphone disables the button with a reason; `network` errors do not latch.

## CSV import [0019, 0023, 0052, 0053, 0054, 0068, 0085]

- Layer 1 runs as the preview is built; Jev runs only on `#csv-classify-btn`. `batchClassifier` dedupes by `normalizeText` before dispatch, caps concurrency at 4, retries a rate-limited row once and aborts on `unavailable`.
- A 429 with `Retry-After` pauses every worker until `resumesAt` (at least 400 ms; over a minute stops the run). The firewall's 429 (`firewall: true`) estimates its own 60 s window. The pause and its end are announced in `csv-classify-announcer`, set in `reportProgress`, never from an effect.
- **AI never writes a row's `type`.** Only `categoryId` reaches the ledger; a category of another type is dropped and the row imports uncategorized.
- **`commitBulkImport` moves no money on failure.** Signed in it is one `import_transactions` RPC. One import key per preview (`importKeyRef`); never reuse one across previews. A ref latch guards a double tap; it is not dedupe. **There is no import deduplication** (`csv.spec.ts` asserts a re-import appears twice).
- **A repayment row names its debt;** the overpayment guard applies in aggregate.
- **Export escapes formula cells** with one `'` (Wallet, Destination Wallet, Category, Debt, Description, Raw Calculation); the importer removes exactly one. Amount is never escaped.

## Insights client [0020, 0088]

`SpendingInsightsCard`: the model picks a `pattern` and `focus`; `renderInsight` writes the sentences, every amount from `formatCurrencyAmount` over ledger data. `fetchInsight` never throws; a guest gets the local verdict with `signInNeeded`. One cache reader, the card's `useState` initializer. The pattern vocabulary is coupled to the server and `InsightPattern`.

## Export and restore [0073, 0075, 0076]

- `buildAccountExport` writes the six slices (soft-deleted rows included) through each type's field list; no email, token, session or template. Signed in it refuses while a load runs or after `syncError`.
- `parseAccountBackup` is strict and checks references; every schema is wrapped in `schemaOf<T>()` (`utils/schemaParity.ts`). Never cast the parsed result. `restoreBackup` replaces, never merges, only after confirmation, and is refused signed in.

## Unit tests for this layer (`unit/`)

- **`ledger-guards.test.tsx`** mounts the real `FinanceProvider` (inert under test). Do not extract the ledger arithmetic to make it testable; ordering is the thing tested.
- **`authenticated-ledger.test.tsx`** is the signed-in harness: `vi.mock` of `src/lib/supabase`, every fake call settles on a macrotask, actions run **without `act()`** (`IS_REACT_ACT_ENVIRONMENT = false`), `beforeEach` waits for `isSyncing === false`. Its `rpc()` answers `PGRST202` for an RPC with no handler; `installLedgerRpcs()` adds the JS stand-in. Use `landed(txId)` before a second action on a new row; `quietPeriod` only to prove nothing happened.
- **Do not wait only for a row on screen** before an action whose guard reads a ref mirror; flush effects first.
- Assert what a step did, never a wall-clock ceiling. `findBy*`/`waitFor` wait up to 3 s (`unit/setup.ts`).
- Tests pass in any order (`npm run test:unit:shuffle`); only `migration-replay`'s history block opts out.
- A file that pins `TZ` sets it at the top. Check date tests with `TZ=UTC` and `TZ=Asia/Bangkok`.
- **Nothing in `src/` is exported only for a test.**
- The directory is `unit/`, never `tests/unit/`: Vitest's and Playwright's default globs collide, so the boundary is pinned in `vitest.config.ts` (`include`) and `playwright.config.ts` (`testMatch`).
