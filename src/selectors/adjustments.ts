import { Transaction } from '../types';
import { formatCurrencyAmount } from '../utils/currency';
import { roundToCents } from '../utils/money';

/**
 * Spec L8 (ADR 0028). A balance adjustment immediately undone - same wallet,
 * same day, equal and opposite - is noise in a short activity list, so the
 * dashboard's and a wallet's recent activity fold the pair into one item that
 * expands on tap. The Transactions page still lists both rows.
 */
export type ActivityItem =
  | { kind: 'tx'; tx: Transaction }
  | { kind: 'adjustment-pair'; walletId: string; date: string; transactions: [Transaction, Transaction] };

function isLiveAdjustment(tx: Transaction): boolean {
  return tx.type === 'ADJUSTMENT' && !tx.isDeleted;
}

/**
 * The rows in their given order, with each cancelling pair folded into one
 * item where the first of the two stood. Each adjustment pairs at most once,
 * with the first unpaired match after it; a deleted row never pairs.
 */
export function foldAdjustmentPairs(txs: Transaction[]): ActivityItem[] {
  const partnerOf = new Map<number, number>();
  const paired = new Set<number>();

  txs.forEach((tx, i) => {
    if (paired.has(i) || !isLiveAdjustment(tx)) return;
    for (let j = i + 1; j < txs.length; j++) {
      const other = txs[j];
      if (
        !paired.has(j) &&
        isLiveAdjustment(other) &&
        other.walletId === tx.walletId &&
        other.transactionDate.slice(0, 10) === tx.transactionDate.slice(0, 10) &&
        tx.amount !== 0 &&
        roundToCents(tx.amount + other.amount) === 0
      ) {
        partnerOf.set(i, j);
        paired.add(i);
        paired.add(j);
        return;
      }
    }
  });

  const items: ActivityItem[] = [];
  txs.forEach((tx, i) => {
    const j = partnerOf.get(i);
    if (j !== undefined) {
      items.push({ kind: 'adjustment-pair', walletId: tx.walletId, date: tx.transactionDate.slice(0, 10), transactions: [tx, txs[j]] });
    } else if (!paired.has(i)) {
      items.push({ kind: 'tx', tx });
    }
  });
  return items;
}

/** The folded row's text, in the spec's words. */
export function describeAdjustmentPair(walletName: string): string {
  return `2 balance adjustments on ${walletName} that cancel out · net ${formatCurrencyAmount(0)}`;
}
