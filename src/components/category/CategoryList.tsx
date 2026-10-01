import React from 'react';
import { ChevronRight, Lock } from 'lucide-react';
import { Category } from '../../types';
import { CategoryGroups } from '../../selectors/categories';
import { systemCategoryLabel } from '../../selectors/display';
import { SYSTEM_CATEGORY_COLOR } from '../../selectors/ledger';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

interface CategoryListProps {
  groups: CategoryGroups;
  /** Categories some live transaction or keyword rule still uses. */
  inUseIds: Set<string>;
  /** The category in the edit form, if any. */
  selectedId?: string;
  onSelect: (category: Category) => void;
}

function tagFor(category: Category, inUse: boolean): string {
  if (category.isSystem) return 'Default';
  return inUse ? 'Custom · in use' : 'Custom';
}

const GROUPS = [
  { key: 'expense', title: 'Expense', headingClass: 'text-expense' },
  { key: 'income', title: 'Income', headingClass: 'text-income' },
] as const;

/**
 * Spec 6.6: the categories in three groups. An Expense or Income row is one
 * button that opens the category in the form; a System row (L10) is locked and
 * is not a button, since there is nothing it could open.
 */
export const CategoryList: React.FC<CategoryListProps> = ({ groups, inUseIds, selectedId, onSelect }) => (
  <Card padding="none" className="p-4 sm:p-6 flex flex-col gap-5">
    <h2 id="category-list-heading" tabIndex={-1} className="text-base font-semibold text-fg">
      Your categories
    </h2>

    {GROUPS.map(({ key, title, headingClass }) => {
      const items = groups[key];
      return (
        <section key={key} id={`category-group-${key}`} aria-labelledby={`category-group-${key}-heading`} className="flex flex-col gap-2">
          <h3 id={`category-group-${key}-heading`} className={`text-xs font-semibold ${headingClass}`}>
            {title} <span className="text-fg-muted font-normal">· {items.length}</span>
          </h3>
          {items.length === 0 ? (
            <p className="text-xs text-fg-muted">No {title.toLowerCase()} categories yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {items.map((category) => {
                const isSelected = category.id === selectedId;
                return (
                  <li key={category.id} id={`category-row-${category.id}`}>
                    <button
                      id={`edit-category-${category.id}`}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onSelect(category)}
                      className={`w-full min-h-[44px] flex items-center gap-3 px-3 py-2.5 rounded-inner border text-left transition-control duration-150 cursor-pointer ${
                        isSelected ? 'bg-brand-soft border-brand-soft-line' : 'bg-surface-2 border-line hover:border-line-strong'
                      }`}
                    >
                      <span aria-hidden="true" className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: category.color }} />
                      <span className="flex-1 min-w-0 text-sm font-medium text-fg break-words">{category.name}</span>
                      <Badge className="shrink-0 font-semibold">{tagFor(category, inUseIds.has(category.id))}</Badge>
                      <ChevronRight aria-hidden="true" className="w-4 h-4 shrink-0 text-fg-muted" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      );
    })}

    <section id="category-group-system" aria-labelledby="category-group-system-heading" className="flex flex-col gap-2">
      <h3 id="category-group-system-heading" className="text-xs font-semibold text-fg-muted">
        System <span className="font-normal">· {groups.system.length}</span>
      </h3>
      <ul className="flex flex-col gap-1.5">
        {groups.system.map((category) => (
          <li
            key={category.id}
            id={`category-row-${category.id}`}
            className="min-h-[44px] flex items-center gap-3 px-3 py-2.5 rounded-inner border border-line"
          >
            <span aria-hidden="true" className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: SYSTEM_CATEGORY_COLOR }} />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-fg">{systemCategoryLabel(category)}</span>
              <span className="block text-xs text-fg-muted">Not counted as income or spending</span>
            </span>
            <Lock role="img" aria-label="Locked" className="w-4 h-4 shrink-0 text-fg-muted" />
          </li>
        ))}
      </ul>
    </section>
  </Card>
);
