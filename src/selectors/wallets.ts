import { Debt, Transaction, Wallet } from '../types';
import { roundToCents } from '../utils/money';

/**
 * Spec L3 (ADR 0028). One predicate for an active wallet: before Phase 55b,
 * `totalNetWorth` left archived wallets out while the list that feeds the
 * hero's count and the wallet grid kept them in.
 */
export function isActiveWallet(wallet: Wallet): boolean {
  return !wallet.isDeleted && !wallet.isArchived;
}

export function activeWallets(wallets: Wallet[]): Wallet[] {
  return wallets.filter(isActiveWallet);
}

/**
 * Wallets that were archived and not deleted (Phase 59, ADR 0034), oldest
 * first like the active list. They leave net worth and the pickers, and the
 * Wallets page lists them under "Archived" to unarchive.
 */
export function archivedWallets(wallets: Wallet[]): Wallet[] {
  return wallets.filter((wallet) => !wallet.isDeleted && wallet.isArchived);
}

/** Newest first: by calendar day, then by when the row was recorded. */
export function byNewest(a: Transaction, b: Transaction): number {
  if (a.transactionDate !== b.transactionDate) return a.transactionDate < b.transactionDate ? 1 : -1;
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
}

/**
 * Spec 6.3: one wallet's live rows, newest first - every row that moved its
 * money, so a transfer appears in both its From and its To wallet.
 */
export function walletActivity(transactions: Transaction[], walletId: string): Transaction[] {
  return transactions
    .filter((tx) => !tx.isDeleted && (tx.walletId === walletId || tx.destinationWalletId === walletId))
    .sort(byNewest);
}

/** The sum of every active wallet's balance. A credit card's negative balance counts. */
export function walletTotal(wallets: Wallet[]): number {
  let total = 0;
  for (const wallet of wallets) if (isActiveWallet(wallet)) total += Number(wallet.balance || 0);
  return roundToCents(total);
}

/**
 * Each active wallet's share of the money it holds, in percent, keyed by id -
 * the Dashboard's AllocationBar and the "type · share%" line under each
 * wallet. Only a positive balance takes a share, the same rule as
 * `AllocationBar`, so a credit card in debt neither gets a share nor shrinks
 * the others'. A wallet with no share is absent from the map.
 */
export function walletShares(wallets: Wallet[]): Map<string, number> {
  const holding = wallets.filter((wallet) => isActiveWallet(wallet) && Number(wallet.balance) > 0);
  const total = holding.reduce((sum, wallet) => sum + Number(wallet.balance), 0);
  const shares = new Map<string, number>();
  for (const wallet of holding) shares.set(wallet.id, (Number(wallet.balance) / total) * 100);
  return shares;
}

/** An active debt: not deleted and not settled. */
export function isActiveDebt(debt: Debt): boolean {
  return !debt.isDeleted && !debt.isSettled;
}

/** What is still owed across active debts - `useDebts().metrics.remainingTarget`'s figure. */
export function debtRemaining(debts: Debt[]): number {
  let total = 0;
  for (const debt of debts) if (isActiveDebt(debt)) total += Number(debt.remainingAmount || 0);
  return roundToCents(total);
}

/** Spec L3: what you own minus what you still owe. */
export function netWorth(wallets: Wallet[], debts: Debt[]): number {
  return roundToCents(walletTotal(wallets) - debtRemaining(debts));
}
