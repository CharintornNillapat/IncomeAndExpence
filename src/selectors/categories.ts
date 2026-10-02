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

/**
 * Whether every colour of `palette` is in `used`. From that point L9 lets
 * colours repeat, so a 13th category can still be added (audit 012 finding 1):
 * the picker enables every swatch and the write guards stop refusing.
 */
export function paletteExhausted(palette: ReadonlyArray<string>, used: Map<string, string>): boolean {
  return palette.every((hex) => used.has(hex.toLowerCase()));
}

/**
 * The colour a new category starts on: the first free one, or, once all are
 * taken, the one the fewest live categories share, earliest in the palette on a
 * tie. Colours then cycle evenly instead of piling onto the first.
 */
export function nextColor(palette: ReadonlyArray<string>, categories: Category[]): string {
  const counts = new Map<string, number>();
  for (const category of categories) {
    if (category.isDeleted) continue;
    const key = category.color.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = palette[0];
  for (const hex of palette) {
    if ((counts.get(hex.toLowerCase()) ?? 0) < (counts.get(best.toLowerCase()) ?? 0)) best = hex;
  }
  return best;
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
