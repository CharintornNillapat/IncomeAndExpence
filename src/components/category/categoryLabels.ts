import { TransactionType } from '../../types';
import { CategoryUsage } from '../../selectors/categories';

/**
 * Only EXPENSE and INCOME categories are created here. Debt repayment and
 * Balance adjustment each have one fixed system category that the ledger
 * resolves by type, so a second one would have nothing to do.
 */
export type CreatableCategoryType = 'EXPENSE' | 'INCOME';

export const TYPE_NOUN: Record<CreatableCategoryType, string> = {
  EXPENSE: 'Expense category',
  INCOME: 'Income category',
};

const TYPE_WORD: Partial<Record<TransactionType, string>> = {
  EXPENSE: 'Expense',
  INCOME: 'Income',
  TRANSFER: 'Transfer',
  DEBT_REPAYMENT: 'Debt repayment',
  ADJUSTMENT: 'Balance adjustment',
};

/** A transaction type as a word, never the raw enum (spec L10 and checklist 10). */
export function typeLabel(type: TransactionType): string {
  return TYPE_WORD[type] ?? 'Expense';
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** "Used by 3 transactions and 1 rule": what keeps a category from being deleted. */
export function usageText(usage: CategoryUsage): string {
  const parts: string[] = [];
  if (usage.transactions > 0) parts.push(plural(usage.transactions, 'transaction'));
  if (usage.rules > 0) parts.push(plural(usage.rules, 'rule'));
  return `Used by ${parts.join(' and ')}`;
}
