import { Category, KeywordRule, Transaction } from '../types';
import { isMovementCategory } from './ledger';

/**
 * Spec L9 (ADR 0028): a colour one category already uses is not offered to
 * another. Maps each colour in use (lower-cased hex) to the name of the
 * category using it, for the picker's disabled state and its "… used by X"
 * label. Deleted categories free their colour, and `exceptId` frees the colour
 * of the category being edited.
 */
export function usedColors(categories: Category[], exceptId?: string): Map<string, string> {
  const used = new Map<string, string>();
  for (const category of categories) {
    if (category.isDeleted || category.id === exceptId) continue;
    const key = category.color.toLowerCase();
    if (!used.has(key)) used.set(key, category.name);
  }
  return used;
}

/** The first colour of `palette` that `used` (from `usedColors`) does not hold, or `null` when all are taken. */
export function firstFreeColor(palette: ReadonlyArray<string>, used: Map<string, string>): string | null {
  return palette.find((hex) => !used.has(hex.toLowerCase())) ?? null;
}

export interface CategoryGroups {
  expense: Category[];
  income: Category[];
  /** L10: Debt repayment and Balance adjustment, matched by type since signed-in rows carry uuids. */
  system: Category[];
}

const byName = (a: Category, b: Category) => a.name.localeCompare(b.name);

/**
 * Spec 6.6: the Categories page's three groups of live categories, each sorted
 * by name. A category of any other type (none is created today) is left out
 * rather than shown under a wrong heading.
 */
export function categoryGroups(categories: Category[]): CategoryGroups {
  const groups: CategoryGroups = { expense: [], income: [], system: [] };
  for (const category of categories) {
    if (category.isDeleted) continue;
    if (isMovementCategory(category)) groups.system.push(category);
    else if (category.type === 'EXPENSE') groups.expense.push(category);
    else if (category.type === 'INCOME') groups.income.push(category);
  }
  groups.expense.sort(byName);
  groups.income.sort(byName);
  groups.system.sort(byName);
  return groups;
}

export interface CategoryUsage {
  transactions: number;
  rules: number;
}

/**
 * What still points at a category: its live transactions and its keyword
 * rules, the same two things `deleteCategory`'s guard checks.
 */
export function categoryUsage(categoryId: string, transactions: Transaction[], rules: KeywordRule[]): CategoryUsage {
  let txCount = 0;
  for (const tx of transactions) if (!tx.isDeleted && tx.categoryId === categoryId) txCount += 1;
  let ruleCount = 0;
  for (const rule of rules) if (rule.categoryId === categoryId) ruleCount += 1;
  return { transactions: txCount, rules: ruleCount };
}
