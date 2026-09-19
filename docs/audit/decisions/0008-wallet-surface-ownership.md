# 0008 — Wallet surface ownership: collapse `WalletPopupModal`, lift Transfer/Add-Wallet to shell level

**Status:** Accepted
**Date:** 2026-09-19

## Context

Before Phase 23, wallet-related flows were split across two uncoordinated implementations of the same actions. `WalletPopupModal` (opened only by clicking a wallet card) had 4 tabs — OVERVIEW, TRANSACTIONS, TRANSFER, ADD_WALLET — but TRANSFER and ADD_WALLET are actions a user reasonably wants from *outside* a wallet-card click too (`WalletsView`'s own header buttons, `DashboardView`'s hero section). `WalletsView` solved that by hand-rolling its own second, independent `<Modal>` pair for the same two flows, rather than reaching the popup's tabs. Two implementations of "transfer funds" and "add a wallet" existed, each capable of drifting from the other — which is exactly what happened during the Phase 23 migration itself (see Consequences).

## Options considered

**(a) Keep both independent implementations, just document the split.** Rejected — this is the status quo the phase was called to fix; documenting drift risk isn't the same as removing it.

**(b) Promote `WalletPopupModal` itself above view level** (mount it once in `App.tsx`, like `QuickAddModal`), so every view reaches the same instance instead of each view/mechanism hand-rolling its own trigger. Rejected. `implementation-roadmap.md`'s Phase 23 brief explicitly rejects this: the popup is only ever opened by clicking a wallet card, and a wallet card already lives inside whichever view renders it — reachability was never actually broken for the popup itself, only for the two flows (Transfer, Add-Wallet) that don't need a wallet card to trigger them. Hoisting the whole modal would fix a problem that didn't exist while adding an "always mounted" cost that did.

**(c) Collapse `WalletPopupModal` to only the tabs a wallet-card click actually needs (OVERVIEW + TRANSACTIONS), and give Transfer/Add-Wallet their own shell-level modals, following the exact pattern `QuickAddModal` already established.** Chosen.

## Decision

**(c), in three steps (T39/T40/T41):**

1. **`WalletPopupModal` collapsed from 4 tabs to 2** — `WalletModalTab` is now `'OVERVIEW' | 'TRANSACTIONS'` (`src/components/WalletPopupModal.tsx:27`). TRANSFER and ADD_WALLET tabs are retired outright, not hidden. The per-wallet balance-adjustment editor (`isAdjustingBalance`) was never a separate tab — it has always lived inline inside OVERVIEW's wallet card — and stays exactly there.
2. **TRANSACTIONS became a 5-row preview**, not the transaction log itself: `walletTransactions.slice(0, 5)` (down from a 15-row list) plus a `#wallet-modal-view-all-tx-btn` that hands off to `TransactionsView`, pre-filtered to that wallet via a filter state lifted to `App.tsx`.
3. **Transfer and Add-Wallet moved to two new shell-level components**, `src/components/wallet/TransferFundsModal.tsx` and `AddWalletModal.tsx`, each mounted exactly once in `App.tsx` alongside `QuickAddModal` — self-subscribing (they call `useWallets()`/`useFinanceActions()` themselves; `App.tsx` owns only the `isOpen` boolean and, for transfer, an optional preselected wallet id), reached identically from `DashboardView` (hero button, wallet-card shortcuts) and `WalletsView` (header button). `WalletsView` no longer mounts any modal of its own for these two flows — it only calls `onOpenTransfer`/`onOpenAddWallet` callback props.

The shell-level choice for Transfer/Add-Wallet (rather than a `WalletsView`-local instance, matching how each view still mounts its own `WalletPopupModal`) was forced by a concrete reachability constraint, not chosen by default: `wallet-forms.spec.ts` clicks the Dashboard's `#hero-transfer-funds-btn` and asserts the transfer fields are visible immediately, with no intermediate navigation. Whatever renders those fields must already exist the instant that button is clicked — which a `WalletsView`-local modal instance cannot satisfy, since only one view is mounted at a time under `App.tsx`'s `AnimatePresence`/`key={activeTab}` remount (ADR 0005). `WalletPopupModal` has no equivalent constraint, because it is only ever triggered by a wallet card that is already part of whichever view is currently mounted.

## Consequences

- **`AddWalletForm` and `WalletTransferForm` (`src/components/wallet/`) are no longer consumed by `WalletsView` or `WalletPopupModal` directly.** Their only 2 call sites are now `AddWalletModal` and `TransferFundsModal` respectively — both shell-level, both mounted once in `App.tsx`. (`CLAUDE.md`'s pre-Phase-23 text describing these forms as "used by both `WalletsView` and `WalletPopupModal`" is stale as of this ADR and is corrected in the same commit that adds it.)
- **The retired TRANSFER tab's "Transfer completed successfully!" success-flash behavior had to be explicitly reproduced, not just its fields.** The first `TransferFundsModal` draft closed immediately on success (matching what `WalletsView`'s own retired local modal did); `wallet-forms.spec.ts`'s `/Transfer completed successfully/i` assertion then failed, because that text only ever came from the popup's `useTransientFlash`-driven banner. Fixed by giving `TransferFundsModal` the same flash-then-delayed-close pattern. This is now `WalletsView`'s behavior too (it previously closed instantly) — an accepted side effect of both entry points sharing one modal instance, not a separate decision.
- **`WalletsView`'s own wallet cards still do not open `WalletPopupModal`.** They never did before this ADR either (display-only, with their own inline delete button) — unchanged, not a gap this decision introduced.
- Any future wallet-related trigger that needs to work from more than one view (matching Transfer/Add-Wallet's shape) should default to a new shell-level, self-subscribing modal mounted in `App.tsx`, following this and `QuickAddModal`'s precedent — not a per-view local instance, unless that new flow's own reachability requirement is actually different from the one that forced this decision (verify against a concrete constraint like `wallet-forms.spec.ts`'s immediate-assertion pattern, not by default).

## Revisit if

- A wallet card's own view-level rendering (`WalletsView`'s grid, `WalletAccountsGrid`) is asked to open `WalletPopupModal` directly — re-evaluate whether the popup itself then needs shell-level promotion (option (b), previously rejected because no view lacked a wallet card to trigger it from).
- A 3rd flow needs the same "reachable from more than one view, instantly, no navigation" property Transfer/Add-Wallet have — add it as a 3rd shell-level modal in `App.tsx`, not by special-casing it onto `WalletPopupModal` or duplicating it per view.
