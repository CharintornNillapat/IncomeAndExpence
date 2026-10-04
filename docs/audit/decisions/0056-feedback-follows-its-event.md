# 0056: Feedback follows the event that produced it, not a passive effect

**Status:** Accepted. Implemented on branch `phase-80-audit-effect-handler-races` (commit `68a8559`, docs `6285323`), draft PR. Not merged yet.
- **Generalises** ADR `0055`'s CI finding (a late effect's "resumed" replaced the import's note) into a rule for every piece of UI feedback.

**Date:** 2026-10-04

## Context

A passive `useEffect` runs after the render it belongs to, sometimes a whole task later. Two shapes of bug follow when feedback state is written both by an effect and by a handler or an async callback:

1. **An effect writes after a later update.** The render commits, a handler or callback queues a newer value, then the effect runs and queues its older one, which wins. This was ADR `0055`'s WebKit failure.
2. **A result lands after the user moved on.** A "reset when the row changes" effect runs, then a save started on the old row finishes and writes its "saved" or its error into the new row's state.

Both pass under `act`, which flushes effects before the next event, so jsdom rarely shows them; ADR `0055`'s showed only on WebKit.

## The audit

- **The script.** A scratch script listed every setter called both inside a `useEffect`/`useLayoutEffect` body and anywhere else in the same file (comments and strings blanked).
  - It flagged nine files.
  - The components named for this phase were read as well, including those the script could not flag, because their state comes from a hook or a prop.
- **The verdicts:**

  | Place | What | Verdict |
  |---|---|---|
  | `EditTransactionPanel` | effects cleared error and status on `tx.id` and reset the draft on `tx.updatedAt` | **Race (2):** a save in flight when another row opened said "Changes saved", or its error, on the new row, and held the new row's buttons. **Race (1):** a keystroke between a new version's render and its draft-reset effect was replaced. Fixed. |
  | `DeletedTransactionDetails` | effect cleared the error on `tx.id` | **Race (2):** a failed restore showed its error on the next deleted row. Fixed. |
  | `WalletDetail` | effect closed both editors on `wallet.id` | **Race (2):** an edit succeeding after another wallet was selected closed that wallet's editor and lost its draft; a failed adjustment showed on the next wallet's editor. Fixed. |
  | `TransactionsView` paging | effect reset the count to 25 on any filter change | **Race (1):** the search settles on a timer, so a "Load more" on the new list could be undone by the late reset. Fixed. |
  | `TransactionsView` selection | effect set the selection to `null` when the row left the list | **Race (1):** a row picked between that render and the effect was cleared. Fixed. |
  | `TransactionsView` search debounce | timer in an effect; Clear search sets both values | Safe: the timer is cancelled on every change, and a stale value corrects itself 250 ms later. |
  | `TransactionForm` wallet | effect picks the first wallet when the current one is invalid | Safe: it writes only when the value is invalid, so it cannot replace a valid choice. |
  | `InlineMathInput` seed | effect pushes the note's amount into the field | Left: replacing a typed amount needs a click on the amount field within one frame of a note keystroke, and seeds stop after a manual edit (ADR `0013`). Not feedback. |
  | `App.tsx` quick-add URL | mount-only effect | Safe: runs once, before any tap. |
  | `OverflowMenu`, `FinanceContext` auth | setters inside listeners an effect registers | Safe: those are handlers; auth is guarded by `authEpochRef` (ADR `0024`). |
  | Sync badge (`NavbarLedgerStatus`) | derived from context | Safe: no state of its own. |
  | PWA toast (`ReloadPrompt`) | the plugin's own state; Close sets both | Safe. |
  | "Saved" flashes (`useTransientFlash`: the form, the rule chip, transfers, account, diary, import) | one hook, timer per flash | Safe: a new flash cancels the old timer. Now tested under rapid flashes. |
  | Voice input (`useSpeechRecognition`) | one session at a time; its effects mirror a ref and clean up | Safe. |
  | Import live region (`ImportCsvModal`) | fixed in ADR `0055`; its one effect drives the countdown clock | Safe. |

## Decision

- **Feedback for an action belongs to the instance the action started on.** Where a panel shows one entity, it is keyed by that entity's id, so a different row or wallet is a new instance. A late result then writes to the old instance, which is gone, and React drops it.
  - `TransactionDetails` keys `EditTransactionPanel` and `DeletedTransactionDetails` by `tx.id`.
  - `WalletDetail` is a one-line wrapper that keys `WalletDetailBody` by `wallet.id`, so every caller gets it.
  - The three reset effects are deleted.
- **"Reset when an input changes" happens during render, not in an effect.** The component keeps the input it last reset for in state and, when the input differs, sets both in the same render. That is React's documented pattern for it. A handler that runs after that render sees the reset state already.
  - `EditTransactionPanel`'s draft resets when `tx.updatedAt` changes (`baseVersion`).
  - `TransactionsView`'s count resets when the filter key changes (`shownFor`).
  - `TransactionsView`'s selection clears in the render that finds the row gone.
- **Text a live region speaks is set where its event happens** (ADR `0055`); this ADR adds the general form above.

**Rejected:**
- **A sequence number or `AbortController` per action in each panel:** more code in every panel, for what a key gives for free.
- **Keeping the effects, with functional updates:** a guard narrows which writes win but leaves the window open.
- **`useLayoutEffect`:** it runs before paint but still after the render, and costs a second synchronous render every time.

## Verification

- **Unit:** `unit/feedback-ordering.test.tsx`, new, 17 tests. Each holds the first action's promise open, switches, then settles it, and has a same-row twin so the check is not vacuous.
  - **Transaction panel:**
    - a late success says nothing on the next row, but "Changes saved" on its own;
    - a late failure shows nothing on the next row, but the error on its own;
    - the next row's buttons are not held;
    - the saved version keeps "Changes saved" and becomes the baseline;
    - a keystroke after it is kept.
  - **Deleted row:** a late restore error, the same pair.
  - **Wallet:**
    - a late edit success does not close the next wallet's editor or lose its draft, and closes its own;
    - a late adjustment error stays off the next wallet's editor.
  - **Transactions list:**
    - "Load more" on the list the search settled on is kept;
    - one pressed on the old list before the search applied starts from the top;
    - a filter change, and the change back, starts from the top.
  - **`useTransientFlash`:** a second flash runs its full time; a clear between two flashes does not cut the second short.
- **Negative controls** (each source file from `main`, the new tests against it):
  - the two transaction panels: 4 tests fail;
  - `WalletDetail`: 2 fail;
  - `TransactionsView`: 0 fail. Under `act`, jsdom flushes effects before the next event, so its window cannot be opened in a unit test. Its two fixes close it by construction, and the tests pin the behaviour.
- **Gate:** lint clean; unit 802/802 in 31 files; Playwright 441/441 in 8.2 m, first pass, no retries. Near miss: `toast-layering.spec.ts`'s two tests took 28.5 s and 29.4 s on chromium, the first requests to the cold PWA server on port 3100, against the 30 s navigation timeout. **Bundle** (local builds with `.env`, gzip level 9): `TransactionsView` 34,825 -> 34,823 B (-2 B, +33 B gzip) and `WalletsView` 14,765 -> 14,740 B (-25 B, 0 B gzip). No other chunk changed, and the entry `index-*.js` is identical to `main`'s once its hashed chunk names are normalised.

## Consequences

- **Switching rows or wallets now discards the old panel's local state entirely,** including an unsaved draft. It already reset the draft and closed the editors; now nothing of the old instance can reach the new one.
- **A new feedback state should follow the same two rules:** key per entity, and reset during render.
