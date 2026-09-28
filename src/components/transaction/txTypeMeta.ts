import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Landmark, Minus, Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { Transaction, TransactionType } from '../../types';
import { MINUS } from '../../utils/currency';

export interface TxTypeMeta {
  /** Canonical display name for the type (e.g. used where the full word is shown verbatim). */
  label: string;
  /** Full-size badge icon: the spec's one set, ↙ income, ↗ expense, ⇄ transfer, +/− adjustment (section 4.9). */
  icon: React.FC<{ className?: string }>;
  /** Compact icon for space-constrained surfaces (e.g. `WalletPopupModal`'s activity list) - binary Trending{Up,Down}, matching that surface's existing ternary exactly. */
  compactIcon: React.FC<{ className?: string }>;
  /** Badge background + text classes, one token pair per meaning. */
  tint: string;
  /** Amount prefix: '+' for money in, the shared `MINUS` (U+2212) for money out, '' for a transfer seen from outside either wallet. */
  sign: string;
  /** Amount text colour (spec section 3): income green, expense red, transfer blue, adjustment and repayment grey. */
  text: string;
}

/**
 * T35: centralizes the type -> icon/label/tint/sign mapping that was the
 * single most duplicated fragment across the app's transaction renderers
 * (see docs/audit/ui-ux-audit-report.md finding D).
 *
 * Phase 55a (spec sections 3 and 4.8, ADR 0027): a transfer carries no sign,
 * because it moves money between the user's own wallets. A balance adjustment
 * and a debt repayment are grey: neither is income or spending (spec L1), so
 * neither takes the income or expense colour. That reverses Phase 53b's
 * "upward adjustment is green" rule, by the owner's decision.
 *
 * `WalletPopupModal` still uses `compactIcon`; its page phase moves it onto
 * `TransactionRow`, as Phase 57 did for the Dashboard's recent activity.
 */
export const TX_TYPE_META: Record<TransactionType, TxTypeMeta> = {
  INCOME: {
    label: 'Income',
    icon: ArrowDownLeft,
    compactIcon: TrendingUp,
    tint: 'bg-income-tint text-income',
    sign: '+',
    text: 'text-income',
  },
  EXPENSE: {
    label: 'Expense',
    icon: ArrowUpRight,
    compactIcon: TrendingDown,
    tint: 'bg-expense-tint text-expense',
    sign: MINUS,
    text: 'text-expense',
  },
  TRANSFER: {
    label: 'Transfer',
    icon: ArrowLeftRight,
    compactIcon: ArrowLeftRight,
    tint: 'bg-transfer-tint text-transfer',
    sign: '',
    text: 'text-transfer',
  },
  DEBT_REPAYMENT: {
    label: 'Debt Repayment',
    icon: Landmark,
    compactIcon: TrendingDown,
    tint: 'bg-adjust-tint text-adjust',
    sign: MINUS,
    text: 'text-adjust',
  },
  ADJUSTMENT: {
    label: 'Adjustment',
    icon: Minus,
    compactIcon: TrendingDown,
    tint: 'bg-adjust-tint text-adjust',
    sign: MINUS,
    text: 'text-adjust',
  },
};

/** An upward ADJUSTMENT: the same grey, with the plus sign and icon. */
const ADJUSTMENT_UP: TxTypeMeta = {
  ...TX_TYPE_META.ADJUSTMENT,
  icon: Plus,
  compactIcon: TrendingUp,
  sign: '+',
};

/** A transfer seen from the wallet it arrives in, or the one it leaves (spec section 4.8). */
const TRANSFER_IN: TxTypeMeta = { ...TX_TYPE_META.TRANSFER, sign: '+' };
const TRANSFER_OUT: TxTypeMeta = { ...TX_TYPE_META.TRANSFER, sign: MINUS };

/** Which way a transfer moved for one wallet: `IN`, `OUT`, or `undefined` when that wallet is neither end. */
export type TransferDirection = 'IN' | 'OUT';

export function transferDirection(
  tx: Pick<Transaction, 'type' | 'walletId' | 'destinationWalletId'>,
  walletId: string
): TransferDirection | undefined {
  if (tx.type !== 'TRANSFER') return undefined;
  if (tx.walletId === walletId) return 'OUT';
  if (tx.destinationWalletId === walletId) return 'IN';
  return undefined;
}

/**
 * ADR 0024: the metadata for one transaction. An ADJUSTMENT's amount is
 * signed, so its direction - and with it the glyph and icon - comes from the
 * amount, not the type: `TX_TYPE_META.ADJUSTMENT` alone rendered every upward
 * correction as a debit. Every other type's amount is always positive.
 *
 * `direction` is for a transfer shown inside one wallet's own view (ADR 0027):
 * there it is money in or out of that wallet, so it takes a sign. Everywhere
 * else a transfer is unsigned.
 *
 * Callers pair it with `Math.abs(amount)`: the sign is carried by `.sign`.
 */
export function txTypeMetaFor(type: TransactionType, amount: number, direction?: TransferDirection): TxTypeMeta {
  if (type === 'ADJUSTMENT' && amount > 0) return ADJUSTMENT_UP;
  if (type === 'TRANSFER' && direction) return direction === 'IN' ? TRANSFER_IN : TRANSFER_OUT;
  return TX_TYPE_META[type];
}
