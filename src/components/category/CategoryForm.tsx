import React, { useState } from 'react';
import { Category } from '../../types';
import type { MutationResult } from '../../context/FinanceContext';
import { useSubmitHandler } from '../../hooks/useSubmitHandler';
import { CategoryUsage, paletteExhausted } from '../../selectors/categories';
import { IDENTITY_COLORS } from '../../utils/identityPalette';
import { ERROR_BANNER_CLASS, LABEL_CLASS, inputClass } from '../../utils/formStyles';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ColorGrid } from './ColorGrid';
import { CreatableCategoryType, TYPE_NOUN, usageText } from './categoryLabels';

export interface NewCategoryDetails {
  name: string;
  type: CreatableCategoryType;
  color: string;
  description: string;
}

export interface CategoryEditDetails {
  name: string;
  color: string;
  description: string;
}

interface CategoryFormProps {
  /** The category being edited, or `null` for "New category". Mount with `key={editing?.id ?? 'new'}`. */
  editing: Category | null;
  /** `usedColors(categories, editing?.id)`. */
  used: Map<string, string>;
  /** `nextColor(...)`: where a new category starts, a repeat once all twelve are taken. */
  startColor: string;
  /** What still points at `editing`, for its Delete. */
  usage?: CategoryUsage;
  /** The type a new form starts on, so several incomes in a row keep Income. */
  initialType?: CreatableCategoryType;
  /** Off in the narrow-width sheet, whose `Modal` title is the heading. */
  showHeading?: boolean;
  onAdd: (details: NewCategoryDetails) => Promise<MutationResult>;
  onAdded: (type: CreatableCategoryType) => void;
  onSave: (id: string, details: CategoryEditDetails) => Promise<MutationResult>;
  onSaved: (id: string) => void;
  onCancel: () => void;
  onRequestDelete: (category: Category) => void;
}

/**
 * Spec 6.6: one form for "New category" and "Edit category". Its fields start
 * from the category it is mounted for (the parent keys it), so no effect copies
 * a category into state. A category's type is fixed once it exists.
 */
export const CategoryForm: React.FC<CategoryFormProps> = ({
  editing,
  used,
  startColor,
  usage,
  initialType = 'EXPENSE',
  showHeading = true,
  onAdd,
  onAdded,
  onSave,
  onSaved,
  onCancel,
  onRequestDelete,
}) => {
  const isEdit = editing !== null;
  const prefix = isEdit ? 'edit-category' : 'new-category';
  const [type, setType] = useState<CreatableCategoryType>(initialType);
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [color, setColor] = useState(editing?.color ?? startColor);

  const { error, isSubmitting, handleSubmit } = useSubmitHandler({
    defaultErrorMessage: isEdit ? 'Failed to update category' : 'Failed to create category',
    onSuccess: () => (editing ? onSaved(editing.id) : onAdded(type)),
  });

  // Past twelve, colours repeat rather than blocking a new category (audit 012 finding 1).
  const sharing = paletteExhausted(IDENTITY_COLORS, used);
  const inUse = usage ? usage.transactions + usage.rules > 0 : false;

  return (
    <form
      id={`${prefix}-form`}
      className="flex flex-col gap-4"
      onSubmit={(e) =>
        handleSubmit(e, () =>
          editing
            ? onSave(editing.id, { name, color, description })
            : onAdd({ name, type, color, description })
        )
      }
    >
      {showHeading && (
        <div>
          <h2 id="category-form-heading" tabIndex={-1} className="text-base font-semibold text-fg">
            {isEdit ? 'Edit category' : 'New category'}
          </h2>
          {editing && <p className="text-xs text-fg-secondary mt-0.5">{TYPE_NOUN[editing.type as CreatableCategoryType]}</p>}
        </div>
      )}
      {!showHeading && editing && <p className="text-xs text-fg-secondary -mt-2">{TYPE_NOUN[editing.type as CreatableCategoryType]}</p>}

      {!isEdit && (
        <SegmentedControl<CreatableCategoryType>
          ariaLabel="Type"
          value={type}
          onChange={setType}
          fill
          className="flex"
          options={[
            { value: 'EXPENSE', id: 'new-category-type-expense', label: 'Expense' },
            { value: 'INCOME', id: 'new-category-type-income', label: 'Income' },
          ]}
        />
      )}

      <div>
        <label htmlFor={`${prefix}-name`} className={LABEL_CLASS}>
          Name
        </label>
        <input
          id={`${prefix}-name`}
          type="text"
          required
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isEdit ? undefined : 'e.g., Subscriptions, Pet care'}
          className={inputClass('plain')}
        />
      </div>

      {/* Its main reader is the Jev classifier, which receives it as this category's criteria (ADR 0012). */}
      <div>
        <label htmlFor={`${prefix}-description`} className={LABEL_CLASS}>
          Description
        </label>
        <textarea
          id={`${prefix}-description`}
          rows={2}
          maxLength={120}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Streaming, music and app subscriptions"
          className={inputClass('plain')}
        />
        <p className="mt-1 text-xs text-fg-muted">Optional. Helps auto-categorization recognize what belongs here.</p>
      </div>

      <div>
        <span id={`${prefix}-color-label`} className={`${LABEL_CLASS} mb-1.5`}>
          Color
        </span>
        <ColorGrid
          idPrefix={prefix}
          labelId={`${prefix}-color-label`}
          value={color}
          onChange={setColor}
          used={used}
          currentColor={editing?.color}
        />
        {sharing && (
          <p id={`${prefix}-color-sharing`} className="mt-1 text-xs text-fg-secondary">
            All 12 colors are in use, so this category will share one with another.
          </p>
        )}
      </div>

      {error && <div className={ERROR_BANNER_CLASS}>{error}</div>}

      {isEdit ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button id="edit-category-save-btn" type="submit" disabled={isSubmitting}>
              Save changes
            </Button>
            <Button id="edit-category-cancel-btn" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </div>
          <div className="border-t border-line pt-3 flex flex-col gap-1.5">
            {editing.isSystem ? (
              <p className="text-xs text-fg-secondary">Default categories can't be deleted.</p>
            ) : (
              <>
                <div>
                  <Button
                    id={`delete-category-${editing.id}`}
                    variant="danger"
                    disabled={inUse}
                    onClick={() => onRequestDelete(editing)}
                  >
                    Delete category
                  </Button>
                </div>
                {inUse && usage && (
                  <p className="text-xs text-fg-secondary">
                    {usageText(usage)}, so it can't be deleted.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <Button id="save-category-btn" type="submit" size="lg" block disabled={isSubmitting}>
          Add category
        </Button>
      )}
    </form>
  );
};
