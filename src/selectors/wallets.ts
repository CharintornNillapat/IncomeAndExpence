import { Debt, Wallet } from '../types';
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

/** The sum of every active wallet's balance. A credit card's negative balance counts. */
export function walletTotal(wallets: Wallet[]): number {
  let total = 0;
  for (const wallet of wallets) if (isActiveWallet(wallet)) total += Number(wallet.balance || 0);
  return roundToCents(total);
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
