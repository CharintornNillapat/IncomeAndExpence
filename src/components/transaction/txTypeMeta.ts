import { ArrowDownLeft, ArrowUpRight, RefreshCw, Landmark, TrendingUp, TrendingDown } from 'lucide-react';
import { TransactionType } from '../../types';
import { MINUS } from '../../utils/currency';

export interface TxTypeMeta {
  /** Canonical display name for the type (e.g. used where the full word is shown verbatim). */
  label: string;
  /** Full-size badge icon, per `TransactionTableRow`'s existing 4-way vocabulary - the most granular of the app's several icon sets, so it is the one centralized here. */
  icon: React.FC<{ className?: string }>;
  /** Compact icon for space-constrained surfaces (e.g. `WalletPopupModal`'s activity list) - binary Trending{Up,Down}, matching that surface's existing ternary exactly. */
  compactIcon: React.FC<{ className?: string }>;
  /** Badge background + text classes (light + dark), matching `TransactionTableRow`'s existing 4-way scheme exactly. */
  tint: string;
  /** Canonical amount-prefix glyph: '+' for INCOME, the shared `MINUS` (U+2212) for everything else. */
  sign: string;
}

/**
 * T35: centralizes the type -> icon/label/tint/sign mapping that was the
 * single most duplicated fragment across the app's transaction renderers
 * (see docs/audit/ui-ux-audit-report.md finding D). `ADJUSTMENT` mirrors
 * `EXPENSE` because that is its existing fallback appearance everywhere it
 * is not explicitly branched on today - it has no dedicated visual
 * treatment of its own to preserve.
 *
 * Not every renderer can consume every field losslessly: `RecentTransactionsTable`'s
 * Type column and `WalletPopupModal`'s activity-tab badge background each use
 * their own distinct icon/color scheme that has already diverged from this
 * one (see the audit finding). Forcing full adoption there would change what
 * is on screen, which this task explicitly avoids - only `label`/`sign` (and,
 * for `WalletPopupModal`, `compactIcon`) are adopted in those two files,
 * matching fields that already agree exactly with the shared token.
 */
export const TX_TYPE_META: Record<TransactionType, TxTypeMeta> = {
  INCOME: {
    label: 'Income',
    icon: ArrowDownLeft,
    compactIcon: TrendingUp,
    tint: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400',
    sign: '+',
  },
  EXPENSE: {
    label: 'Expense',
    icon: ArrowUpRight,
    compactIcon: TrendingDown,
    tint: 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400',
    sign: MINUS,
  },
  TRANSFER: {
    label: 'Transfer',
    icon: RefreshCw,
    compactIcon: TrendingDown,
    tint: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400',
    sign: MINUS,
  },
  DEBT_REPAYMENT: {
    label: 'Debt Repayment',
    icon: Landmark,
    compactIcon: TrendingDown,
    tint: 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400',
    sign: MINUS,
  },
  ADJUSTMENT: {
    label: 'Adjustment',
    icon: ArrowUpRight,
    compactIcon: TrendingDown,
    tint: 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400',
    sign: MINUS,
  },
};
