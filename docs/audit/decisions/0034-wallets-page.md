# 0034: The Wallets page owns a wallet's details, and the wallet popup is gone

**Status:** Accepted.
- **Implements** spec 6.3, the third page of the redesign (spec 9, step 4).
- **Amends** ADR `0008` (wallet surface ownership): `WalletPopupModal` is deleted, and the Wallets page is the one place a wallet is inspected, edited, adjusted, archived or deleted. ADR `0008`'s "Revisit if" clause named this trigger: a Wallets-page card that opens a wallet's details.
- **Keeps** ADR `0008`'s other rule: Transfer and Add wallet stay shell-level modals in `App.tsx`.

**Date:** 2026-10-01

## Context

Before this phase the Wallets page was a grid of cards. Each card had a floating trash button, an "Active Source" badge and a "Created: 2026-09-18" line. The page had no detail view. A wallet's activity and its only Adjust balance editor lived in the Dashboard's `WalletPopupModal`, which this page never opened.

Spec 6.3 asks for a master-detail page:
- a PageHeader that reads "฿X across N wallets", with Transfer and Add wallet buttons;
- on the left (4/12), an AllocationBar, a row per wallet, and a dashed "Add wallet";
- on the right (8/12), the selected wallet:
  - a 52px tile, its name, and "type · created <date>";
  - Edit, and a "⋯" menu with Archive wallet and Delete wallet…;
  - a 40px balance with Transfer out and Adjust balance;
  - "Recent activity in <wallet>", grouped by day, with each transfer signed by its direction, cancelling adjustment pairs folded (L8), and a link to the Transactions page filtered to the wallet;
- a delete confirmation that says what happens to the wallet's transactions.

The owner's decisions (2026-10-01):
- a Dashboard wallet row opens the Wallets page with that wallet selected, and the popup is deleted;
- archive **and** unarchive are built, with archived wallets in a collapsed "Archived (N)" group;
- Edit changes the name, type and colour, never the balance;
- antislop runs afterwards, as audit 008 (mode 2).

No migration: `wallets.is_archived` already existed and was already mapped. It is written through the same table update that `deleteWallet` uses.

## Decision

### Actions (`FinanceContext.tsx`)
- **`editWallet(id, { name, type, color })`.**
  - It is validated by a new `WalletEditSchema`, which receives the wallet's current balance. A wallet with a negative balance can only be a credit card, mirroring `WalletSchema`'s opening-balance rule (ADR `0024`).
  - The icon follows the type, as `AddWalletForm` sets it.
- **`setWalletArchived(id, archived)`.** Archiving a wallet that is already archived succeeds and writes nothing.
- **`updateWallet` stays private**, and now sends only the columns it is given. Before, every call sent `balance: updates.balance`. That was harmless only because `JSON.stringify` drops an `undefined` value. A screen's edit can now never carry a balance: a balance moves only through the ledger (ADR `0023`).

### Selectors (`selectors/wallets.ts`)
- `archivedWallets(wallets)`: archived and not deleted.
- `walletActivity(transactions, walletId)`: live rows that moved the wallet, a transfer from either side, newest first.
- `byNewest`: the Transactions page's own comparator, moved here so both pages sort alike.

An archived wallet was already outside `activeWallets`, so it already left net worth.

### Pickers
New-entry pickers now offer **active wallets only** (`isActiveWallet`): Quick Add, the Transactions page's Add form, and `useDebts` (the repay modal). `TransferFundsModal` already used `useWallets()`. These keep archived wallets on purpose:
- the ledger guards, so an edit of an existing row in an archived wallet still saves;
- `EditTransactionPanel`'s options, which keep the row's own wallet;
- the CSV name lookup;
- the Transactions page's wallet filter, since history stays searchable.

### The page
- **`WalletsView`** owns the selection. From `lg` a wallet is always selected: the first active one by default, or the one handed off. Below `lg` the list stands alone, and a tapped wallet opens in a bottom sheet. That is one render path through `useMediaQuery`, never two copies hidden by CSS (ADR `0031`).
- **`WalletList`:**
  - each row is a `<button id="wallet-entity-{id}" aria-pressed>` that holds `data-testid="wallet-balance-{id}"`;
  - the selected row uses `TransactionRow`'s selected look;
  - a dashed "Add wallet" (`#wallet-list-add-btn`) sits under the rows;
  - "Archived (N)" (`#wallet-archived-toggle`) lists each archived wallet with Unarchive (`#wallet-unarchive-btn-{id}`).
- **`WalletDetail`:**
  - the header holds `#wallet-detail-title`, `#wallet-detail-meta` ("Cash · created Oct 1, 2026"), Edit (`#wallet-edit-btn`), and a menu `#wallet-detail-menu-btn` with `#archive-wallet-{id}` and `#delete-wallet-{id}`;
  - the balance (`#wallet-detail-balance`) sits with Transfer out (`#wallet-transfer-out-btn`, preselects the source) and Adjust balance (`#wallet-adjust-btn-{id}`);
  - the activity rows are `#wallet-tx-{id}`, which open the row on the Transactions page; "View all" is `#wallet-view-all-tx-btn`.
- **The Adjust balance editor moved unchanged from the popup**, ids included, and still writes the signed difference (ADR `0024`). It now keeps the editor open with the reason when the write fails; the popup closed it either way.
- **Edit** is an inline form (`#wallet-edit-form`) that stays open with the reason on failure (`#wallet-edit-error`).
- **Delete and Archive** both use `ConfirmDialog`:
  - Delete: "Its N transactions stay in your history and still count toward spending and income. Its ฿X balance leaves your wallet total and net worth."
  - Archive (not destructive): it leaves the list, the pickers and net worth, the rows stay, and it can be unarchived.
- **`ActivityFeed`** (`transaction/`) is the day-grouped feed with the L8 fold, extracted from `RecentActivityCard`. It takes the page's id prefix (`dashboard` or `wallet`), and a `walletId` that signs transfers. The Dashboard's ids did not change, and `unit/dashboard.test.tsx` passed unedited before and after.

### The hand-off and the popup
`App.tsx` holds `walletsSelectedWallet`, shaped like the Transactions page's `initialSelectedTxId`, and `WalletsView` consumes it on mount. A Dashboard wallet row (`#dashboard-wallet-card-{id}`) opens the page with that wallet selected; "Manage wallets" opens the page. `WalletPopupModal` is deleted, along with what only it used:
- `TxTypeIcon`'s `compact` variant and `TX_TYPE_META`'s `compactIcon` (the Trending icons);
- the `sm` size;
- `tintOverride`.

The app now draws one transaction icon set everywhere (spec 4.9).

### Deviations from spec 6.3
- **The 4/8 split starts at `xl` (1280), as the spec says, but the page is master-detail from `lg` (1024), at 5/7.** At 1024 a 4/12 list truncated every wallet name. Spec 8 asks for one column from 768 to 1279. The Transactions page's inline panel set the `lg` precedent (ADR `0033`).
- **The balance and its two buttons sit side by side only from `xl`.** Narrower (the 5/7 detail and the sheet), the buttons go under the figure; side by side they wrapped into a column.
- **The selected row is `brand-soft` with the inset violet edge**, not the spec's `#1C1930` / `#4B3F86`. This is the same deviation DESIGN.md records for the Transactions panel.
- **Existing wallets keep their old colours**, the starter wallets' included, until spec 5.1's migration. The picker itself offers only spec section 1's twelve identity colours since audit 008.

## Spec edits (locator and copy moves only, each in the code's own commit)
- `soft-delete.spec.ts`:
  - `div[id^="wallet-entity-"]` became `[id^="wallet-entity-"]`, because the row is now a button;
  - deleting now selects the row and opens `#wallet-detail-menu-btn` first;
  - the count-0 assertions stay as they were.
- `account-and-mobile-nav.spec.ts`: `#modal-wallet-balance-wal-main-checking` became `#wallet-detail-balance`. The click path is unchanged; it now runs through the hand-off.
- `theme.spec.ts`: the heading `/Wallets & Accounts/` became `'Wallets'` (exact), a copy change like Phase 53's diary heading.
- `date-boundary.spec.ts`:
  - it clicks the Main Checking row and reads `#wallet-detail-meta`;
  - "Created: 2026-09-18" / not "2026-09-17" became "created Sep 18, 2026" / not "created Sep 17, 2026";
  - both halves of the boundary check are kept.

`wallets.spec.ts`, `wallet-forms.spec.ts` and `transaction-edit.spec.ts` passed unedited. A new wallet is not auto-selected, so its name appears once, and `getByText` stays strict.

## Consequences
- **One wallet-detail surface.** The Dashboard no longer mounts any wallet modal; `QuickAddModal`, `TransferFundsModal`, `AddWalletModal` and `AccountModal` remain the shell's lazy modals.
- **Archived wallets can be brought back.** An archived wallet's balance is out of every total until it is unarchived; the archive dialog says so.
- **Delete still keeps a wallet's rows in spending and income.** The dialog now says that plainly instead of "Its transaction history is kept".
- **Audit 008, the owner's decisions (2026-10-01):**
  - finding 2: `WALLET_COLOR_PALETTE` is spec section 1's twelve identity colours, so neither Add wallet nor Edit offers a red or a near-black;
  - finding 1: `Modal` gives focus back to the element that had it when the dialog opened, however it closes, if that element is still on the page. This holds for every dialog and sheet in the app, not only this page's;
  - findings 3 to 5 are accepted and watched.
- **`OverflowMenu` stops its own Escape** (audit 008). This page is the first to put the menu inside a `Modal`, whose `document` listener closed the whole sheet on the menu's Escape.
- **A full-page Playwright screenshot is not a safe way to check this page.** Chromium resizes the viewport to 1px wide during the capture, which flips `useMediaQuery`, and the sheet's exit animation can stick. A real resize across 1024 was checked and gives one copy each way. The walk-through uses viewport screenshots.
