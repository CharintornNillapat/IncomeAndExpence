import { Category } from '../types';

/**
 * Phase 30: collapses active categories that share the same trimmed,
 * case-insensitive name down to one, keeping the first occurrence and marking
 * every later duplicate `isDeleted: true` rather than dropping it.
 *
 * Exists to heal duplicate rows a race in `FinanceContext.tsx`'s one-time
 * account-seeding path (`seedInitialUserAccount`, guarded against re-entrancy
 * as of this phase) could previously produce - each default category
 * appearing 2-3 times in every category picker. Marking the losers deleted
 * rather than removing them keeps every id resolvable (a category chip on an
 * already-recorded transaction still renders correctly), while every
 * `!isDeleted` filter already used throughout the app - the category
 * `<select>`s, the Categories management list - naturally stops offering
 * them. Already-`isDeleted` categories are left untouched; a genuinely
 * deleted category and an active one of the same name are not a duplicate to
 * collapse.
 */
export function dedupeCategoriesByName(categories: Category[]): Category[] {
  const seenActiveNames = new Set<string>();
  return categories.map((c) => {
    if (c.isDeleted) return c;
    const key = c.name.trim().toLowerCase();
    if (seenActiveNames.has(key)) {
      return { ...c, isDeleted: true };
    }
    seenActiveNames.add(key);
    return c;
  });
}
