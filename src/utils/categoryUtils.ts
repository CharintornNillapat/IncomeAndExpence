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

/**
 * Phase 40: fills in the shipped `description` for any category that has never
 * had one, so the defaults added in ADR `0012` reach users who already have a
 * `pf_categories` entry or existing Supabase rows.
 *
 * Without this the feature would only ever benefit a brand-new install:
 * `safeGetLocalStorage('pf_categories', DEFAULT_SYSTEM_CATEGORIES)` returns the
 * *stored* array whenever one exists, so the new defaults would never be seen
 * by the very users whose misclassified notes motivated the change.
 *
 * Two deliberate choices:
 *
 * - **Matched by name, not id.** Local categories are `cat-*` and stable, but
 *   an authenticated user's rows carry server-generated uuids, so id matching
 *   would silently skip every cloud-synced account. The trimmed,
 *   case-insensitive name key is the same one `dedupeCategoriesByName` uses.
 * - **Only `undefined` is filled.** `''` means the user opened the category and
 *   deliberately cleared its description; refilling that on the next reload
 *   would make the field impossible to empty.
 *
 * Pure and idempotent: a second pass finds every match already set. It writes
 * nothing to Supabase - the database remains the source of truth for a
 * description the user actually typed - and is applied at the same two seams as
 * `dedupeCategoriesByName` (hydration and Supabase load).
 */
export function withDefaultDescriptions(
  categories: Category[],
  defaults: Category[]
): Category[] {
  const byName = new Map<string, string>();
  for (const d of defaults) {
    if (d.description) byName.set(d.name.trim().toLowerCase(), d.description);
  }

  return categories.map((c) => {
    if (c.description !== undefined) return c;
    const fallback = byName.get(c.name.trim().toLowerCase());
    return fallback ? { ...c, description: fallback } : c;
  });
}
