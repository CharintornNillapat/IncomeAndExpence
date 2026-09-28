import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Pencil,
  Tag,
  Sparkles,
  Utensils,
  ShoppingCart,
  Car,
  ShoppingBag,
  Home,
  Briefcase,
  Laptop,
  CreditCard,
  Gift,
  Gamepad,
  LucideIcon,
} from 'lucide-react';
import { useFinanceState, useFinanceActions } from '../context/FinanceContext';
import { useSubmitHandler } from '../hooks/useSubmitHandler';
import { matchSmartDescription } from '../utils/smartMatcher';
import { formatCurrencyAmount } from '../utils/currency';
import { buildLookupMap } from '../utils/mapUtils';
import { Category } from '../types';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Card } from '../components/ui/Card';
import { Chip } from '../components/ui/Chip';
import { EmptyState } from '../components/ui/EmptyState';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import {
  LABEL_CLASS,
  inputClass,
  selectClass,
  OPTION_CLASS,
  ERROR_BANNER_CLASS,
} from '../utils/formStyles';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';

type CategorySubTab = 'MANAGE' | 'RULES';
type CreatableCategoryType = 'EXPENSE' | 'INCOME';

/**
 * Only EXPENSE/INCOME are offered here. TRANSFER/ADJUSTMENT/DEBT_REPAYMENT
 * each already have exactly one fixed system category
 * (`FinanceContext.tsx`'s `DEFAULT_SYSTEM_CATEGORIES`) that other mutators
 * resolve by type, not by letting the user pick among several - there's
 * nothing for a user-created category of those types to actually do.
 */
const CATEGORY_TYPE_OPTIONS: ReadonlyArray<{ value: CreatableCategoryType; label: string }> = [
  { value: 'EXPENSE', label: 'Expense' },
  { value: 'INCOME', label: 'Income' },
];

/** Swatch offered when creating or recoloring a category - same shape as `WALLET_COLOR_PALETTE`, kept local since this file is its only consumer. */
const CATEGORY_COLOR_PALETTE = [
  '#f87171', '#fb923c', '#facc15', '#4ade80', '#34d399',
  '#38bdf8', '#818cf8', '#a78bfa', '#f472b6', '#94a3b8',
] as const;

/** Icon offered when re-iconing a category in the edit modal - kebab-case values match `DEFAULT_SYSTEM_CATEGORIES`'s existing icon convention in `FinanceContext.tsx`. */
const CATEGORY_ICON_OPTIONS: ReadonlyArray<{ value: string; Icon: LucideIcon }> = [
  { value: 'tag', Icon: Tag },
  { value: 'utensils', Icon: Utensils },
  { value: 'shopping-cart', Icon: ShoppingCart },
  { value: 'car', Icon: Car },
  { value: 'shopping-bag', Icon: ShoppingBag },
  { value: 'home', Icon: Home },
  { value: 'briefcase', Icon: Briefcase },
  { value: 'laptop', Icon: Laptop },
  { value: 'credit-card', Icon: CreditCard },
  { value: 'gift', Icon: Gift },
  { value: 'gamepad', Icon: Gamepad },
  { value: 'plus', Icon: Plus },
] as const;

/**
 * Phase 30: merges the standalone "Smart Rules" view into a "Categories &
 * Smart Rules" hub. The Smart Rules half (sandbox + configured-rules table)
 * is a verbatim port of the retired `KeywordRulesView` - same element ids,
 * same `data-testid`s - so `tests/keywords.spec.ts` only needed its
 * navigation target updated. The Categories half is new: create/edit/delete
 * for user-created categories, with delete guarded against system defaults
 * and anything still referenced by a transaction or keyword rule.
 */
export const CategoriesView: React.FC = () => {
  const { categories, keywordRules, transactions } = useFinanceState();
  const { addCategory, updateCategory, deleteCategory, addKeywordRule, deleteKeywordRule } = useFinanceActions();

  const [subTab, setSubTab] = useState<CategorySubTab>('MANAGE');

  const activeCategories = useMemo(() => categories.filter((c) => !c.isDeleted), [categories]);
  const categoryMap = useMemo(() => buildLookupMap(categories), [categories]);

  // A category is safe to delete only when it's user-created and nothing
  // still points at it - deleting anything else would leave a live
  // transaction or keyword rule resolving to nothing.
  const inUseCategoryIds = useMemo(() => {
    const ids = new Set<string>();
    transactions.forEach((t) => {
      if (!t.isDeleted && t.categoryId) ids.add(t.categoryId);
    });
    keywordRules.forEach((r) => ids.add(r.categoryId));
    return ids;
  }, [transactions, keywordRules]);

  // --- Add Category ---
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryType, setNewCategoryType] = useState<CreatableCategoryType>('EXPENSE');
  const [newCategoryColor, setNewCategoryColor] = useState<string>(CATEGORY_COLOR_PALETTE[0]);
  const [newCategoryDescription, setNewCategoryDescription] = useState<string>('');

  const { error: addCategoryError, handleSubmit: submitAddCategory } = useSubmitHandler({
    defaultErrorMessage: 'Failed to create category',
    onSuccess: () => {
      setNewCategoryName('');
      setNewCategoryDescription('');
    },
  });

  const handleAddCategory = (e: React.FormEvent) =>
    submitAddCategory(e, () =>
      addCategory({
        name: newCategoryName,
        type: newCategoryType,
        color: newCategoryColor,
        description: newCategoryDescription,
      })
    );

  // --- Edit Category ---
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editColor, setEditColor] = useState<string>(CATEGORY_COLOR_PALETTE[0]);
  const [editIcon, setEditIcon] = useState<string>(CATEGORY_ICON_OPTIONS[0].value);
  const [editDescription, setEditDescription] = useState<string>('');

  const {
    error: editCategoryError,
    setError: setEditCategoryError,
    handleSubmit: submitEditCategory,
  } = useSubmitHandler({
    defaultErrorMessage: 'Failed to update category',
    onSuccess: () => setEditingCategory(null),
  });

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setEditName(cat.name);
    setEditColor(cat.color);
    setEditIcon(cat.icon || CATEGORY_ICON_OPTIONS[0].value);
    setEditDescription(cat.description ?? '');
    setEditCategoryError(null);
  };

  const handleEditCategory = (e: React.FormEvent) =>
    submitEditCategory(e, () =>
      editingCategory
        ? updateCategory(editingCategory.id, {
            name: editName,
            color: editColor,
            icon: editIcon,
            description: editDescription,
          })
        : undefined
    );

  // --- Delete Category ---
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState<boolean>(false);
  const [deleteCategoryError, setDeleteCategoryError] = useState<string | null>(null);

  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setIsDeletingCategory(true);
    const res = await deleteCategory(categoryToDelete.id);
    setIsDeletingCategory(false);
    if (res.success) {
      setCategoryToDelete(null);
      setDeleteCategoryError(null);
    } else {
      setDeleteCategoryError(res.error || 'Failed to delete category');
    }
  };

  // --- Smart Keyword Rules (unchanged from the retired KeywordRulesView) ---
  const [keyword, setKeyword] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(activeCategories[0]?.id || '');
  const [testInput, setTestInput] = useState<string>('500 buy new shirt');

  const matchResult = useMemo(
    () => matchSmartDescription(testInput, keywordRules, categories),
    [testInput, keywordRules, categories]
  );

  const { error: ruleError, handleSubmit: submitKeywordRule } = useSubmitHandler({
    defaultErrorMessage: 'Failed to save keyword rule',
    onSuccess: () => setKeyword(''),
  });

  const handleAddRule = (e: React.FormEvent) =>
    submitKeywordRule(e, () => addKeywordRule(keyword, selectedCategoryId));

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Categories & Smart Rules"
        subtitle="Organize your categories and set up keywords that auto-categorize matching transactions"
        action={
          <SegmentedControl<CategorySubTab>
            size="sm"
            mode="tabs"
            ariaLabel="Categories and smart rules"
            value={subTab}
            onChange={setSubTab}
            options={[
              { value: 'MANAGE', id: 'category-subtab-manage', label: 'Categories' },
              { value: 'RULES', id: 'category-subtab-rules', label: 'Smart Rules' },
            ]}
          />
        }
      />

      {subTab === 'MANAGE' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Add Category (5 cols) */}
          <Card padding="lg" className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-line">
              <Plus className="w-4 h-4 text-fg-secondary" />
              <h3 className="text-sm font-bold text-fg">Add Category</h3>
            </div>

            <form onSubmit={handleAddCategory} className="space-y-4">
              <div>
                <label className={LABEL_CLASS}>Category Name *</label>
                <input
                  id="new-category-name"
                  type="text"
                  required
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., Subscriptions, Pet Care"
                  className={inputClass('plain')}
                />
              </div>

              {/*
                Optional, but its primary reader is the Jev classifier, which
                receives it as this category's `criteria` (ADR 0012). The helper
                text says so plainly - a field whose purpose is invisible gets
                filled in badly or not at all.
              */}
              <div>
                <label className={LABEL_CLASS}>Description</label>
                <textarea
                  id="new-category-description"
                  rows={2}
                  maxLength={120}
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  placeholder="e.g., Streaming, music and app subscriptions"
                  className={inputClass('plain')}
                />
                <p className="mt-1 text-[11px] text-fg-muted">
                  Optional. Helps auto-categorization recognize what belongs here.
                </p>
              </div>

              <div>
                <label className={LABEL_CLASS}>Type *</label>
                <select
                  id="new-category-type"
                  value={newCategoryType}
                  onChange={(e) => setNewCategoryType(e.target.value as CreatableCategoryType)}
                  className={selectClass('plain')}
                >
                  {CATEGORY_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className={OPTION_CLASS}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`${LABEL_CLASS} mb-1.5`}>Color</label>
                {/* A 28px swatch inside a 44px hit box; the selected one takes the focus ring, not a scale. */}
                <div className="flex flex-wrap items-center gap-1">
                  {CATEGORY_COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewCategoryColor(c)}
                      aria-label={`Colour ${c}`}
                      aria-pressed={newCategoryColor === c}
                      className="w-11 h-11 inline-flex items-center justify-center rounded-full cursor-pointer"
                    >
                      <span
                        className={`w-7 h-7 rounded-full ${
                          newCategoryColor === c ? 'ring-2 ring-focus ring-offset-2 ring-offset-surface-1' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {addCategoryError && <div className={ERROR_BANNER_CLASS}>{addCategoryError}</div>}

              <Button id="save-category-btn" type="submit" block>
                Add Category
              </Button>
            </form>
          </Card>

          {/* Right: Categories List (7 cols) */}
          <Card padding="lg" className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-fg-secondary" />
                <h3 className="text-sm font-bold text-fg">Your Categories</h3>
              </div>
              <span className="text-xs text-fg-muted">{activeCategories.length} active</span>
            </div>

            {activeCategories.length === 0 ? (
              <EmptyState
                icon={Tag}
                title="No categories yet"
                subtitle="Add one on the left to start organizing your transactions"
              />
            ) : (
              <div id="category-list" className="space-y-1.5">
                {activeCategories.map((cat) => {
                  const canDelete = !cat.isSystem && !inUseCategoryIds.has(cat.id);
                  return (
                    <div
                      key={cat.id}
                      id={`category-row-${cat.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg border border-line hover:bg-surface-2 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-xs font-semibold text-fg truncate">{cat.name}</span>
                        <span className="text-[10px] font-semibold text-fg-muted uppercase tracking-wider shrink-0">
                          {cat.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {cat.isSystem ? (
                          <span className="text-[10px] text-fg-muted uppercase font-semibold px-1.5">Default</span>
                        ) : !canDelete ? (
                          <span className="text-[10px] text-fg-muted uppercase font-semibold px-1.5">In use</span>
                        ) : null}
                        <IconButton
                          id={`edit-category-${cat.id}`}
                          label="Edit category"
                          onClick={() => openEditCategory(cat)}
                          className="-my-2"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </IconButton>
                        {canDelete && (
                          <IconButton
                            id={`delete-category-${cat.id}`}
                            label="Delete category"
                            tone="danger"
                            onClick={() => {
                              setCategoryToDelete(cat);
                              setDeleteCategoryError(null);
                            }}
                            className="-my-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </IconButton>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Add Rule + Live Test Sandbox (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Add Rule Form */}
            <Card padding="lg" className="space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-line">
                <Plus className="w-4 h-4 text-fg-secondary" />
                <h3 className="text-sm font-bold text-fg">Add Keyword Rule</h3>
              </div>

              <form onSubmit={handleAddRule} className="space-y-4">
                <div>
                  <label className={LABEL_CLASS}>
                    Trigger Keyword / Phrase *
                  </label>
                  <input
                    id="new-keyword-input"
                    type="text"
                    required
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="e.g., starbucks, netflix, gas, groceries"
                    className={inputClass('plain')}
                  />
                </div>

                <div>
                  <label className={LABEL_CLASS}>
                    Assign to Category *
                  </label>
                  <select
                    id="keyword-category-select"
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className={selectClass('plain')}
                  >
                    {activeCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>

                {ruleError && (
                  <div className={ERROR_BANNER_CLASS}>
                    {ruleError}
                  </div>
                )}

                <Button id="save-keyword-rule-btn" type="submit" block>
                  Add Rule
                </Button>
              </form>
            </Card>

            {/* Smart Parser Live Sandbox */}
            <Card padding="lg" className="space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-line">
                <Sparkles className="w-4 h-4 text-brand" />
                <h3 className="text-sm font-bold text-fg">Try Quick-Input Test</h3>
              </div>

              <div>
                <label className="text-xs font-semibold text-fg-secondary block mb-1">
                  Type sample text:
                </label>
                <input
                  id="test-parser-input"
                  type="text"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="e.g. 500 buy new shirt or 45 uber to airport"
                  className={inputClass('plain')}
                />
              </div>

              <div className="bg-surface-2 rounded-lg p-3.5 border border-line space-y-2 text-xs">
                <div className="flex justify-between" data-testid="metric-extracted-amount">
                  <span className="text-fg-secondary">Extracted Amount:</span>
                  <span className="font-bold text-fg">
                    {matchResult.extractedAmount ? formatCurrencyAmount(matchResult.extractedAmount) : 'None detected'}
                  </span>
                </div>
                <div className="flex justify-between" data-testid="metric-matched-category">
                  <span className="text-fg-secondary">Matched Category:</span>
                  <span className="font-semibold text-brand">
                    {matchResult.categoryName || 'No keyword matched'}
                  </span>
                </div>
                <div className="flex justify-between" data-testid="metric-inferred-type">
                  <span className="text-fg-secondary">Inferred Type:</span>
                  <span className="text-fg">{matchResult.type || 'EXPENSE'}</span>
                </div>
                <div className="flex justify-between" data-testid="metric-cleaned-description">
                  <span className="text-fg-secondary">Cleaned Description:</span>
                  <span className="text-fg font-medium">"{matchResult.cleanDescription}"</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right: Configured Rules Table (7 cols) */}
          <Card padding="lg" className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-fg-secondary" />
                <h3 className="text-sm font-bold text-fg">Configured Keyword Mappings</h3>
              </div>
              <span className="text-xs text-fg-muted">{keywordRules.length} rules active</span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2 text-fg-secondary uppercase tracking-wider font-semibold border-b border-line">
                  <tr>
                    <th className="py-3 px-4">Keyword</th>
                    <th className="py-3 px-4">Mapped Category</th>
                    <th className="py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {keywordRules.length === 0 ? (
                    <tr>
                      <td colSpan={3}>
                        <EmptyState
                          icon={Tag}
                          title="No keyword rules configured yet"
                          subtitle="Add a rule on the left to auto-categorize matching transactions"
                        />
                      </td>
                    </tr>
                  ) : (
                  keywordRules.map((rule) => {
                    const cat = categoryMap.get(rule.categoryId);
                    return (
                      <tr key={rule.id} id={`rule-row-${rule.id}`} className="hover:bg-surface-2">
                        <td className="py-3 px-4 font-semibold text-fg">
                          "{rule.keyword}"
                        </td>
                        <td className="py-3 px-4">
                          {cat ? (
                            <Chip label={cat.name} color={cat.color} />
                          ) : (
                            <span className="text-fg-muted">Unknown</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <IconButton label="Delete rule" tone="danger" onClick={() => deleteKeywordRule(rule.id)} className="-my-2">
                            <Trash2 className="w-3.5 h-3.5" />
                          </IconButton>
                        </td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Category Modal */}
      <Modal
        isOpen={!!editingCategory}
        onClose={() => setEditingCategory(null)}
        title="Edit Category"
        maxWidthClassName="max-w-sm"
      >
        <form onSubmit={handleEditCategory} className="space-y-4">
          <div>
            <label className={LABEL_CLASS}>Category Name *</label>
            <input
              id="edit-category-name"
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className={inputClass('plain')}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Description</label>
            <textarea
              id="edit-category-description"
              rows={2}
              maxLength={120}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="e.g., Streaming, music and app subscriptions"
              className={inputClass('plain')}
            />
            <p className="mt-1 text-[11px] text-fg-muted">
              Optional. Helps auto-categorization recognize what belongs here.
            </p>
          </div>

          <div>
            <label className={`${LABEL_CLASS} mb-1.5`}>Color</label>
            <div className="flex flex-wrap items-center gap-1">
              {CATEGORY_COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setEditColor(c)}
                  aria-label={`Colour ${c}`}
                  aria-pressed={editColor === c}
                  className="w-11 h-11 inline-flex items-center justify-center rounded-full cursor-pointer"
                >
                  <span
                    className={`w-7 h-7 rounded-full ${
                      editColor === c ? 'ring-2 ring-focus ring-offset-2 ring-offset-surface-1' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={`${LABEL_CLASS} mb-1.5`}>Icon</label>
            <div className="flex flex-wrap items-center gap-2">
              {CATEGORY_ICON_OPTIONS.map(({ value, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEditIcon(value)}
                  title={value}
                  aria-label={`Icon ${value}`}
                  aria-pressed={editIcon === value}
                  className={`w-11 h-11 rounded-lg flex items-center justify-center transition-colors duration-150 cursor-pointer ${
                    editIcon === value
                      ? 'bg-brand-fill text-white'
                      : 'bg-surface-2 text-fg-secondary hover:bg-surface-3'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          {editCategoryError && <div className={ERROR_BANNER_CLASS}>{editCategoryError}</div>}

          <Button id="edit-category-save-btn" type="submit" block>
            Save Changes
          </Button>
        </form>
      </Modal>

      {/* Delete Category Confirmation */}
      <ConfirmDialog
        isOpen={!!categoryToDelete}
        onClose={() => {
          setCategoryToDelete(null);
          setDeleteCategoryError(null);
        }}
        onConfirm={handleConfirmDeleteCategory}
        isLoading={isDeletingCategory}
        title="Delete Category"
        description={
          deleteCategoryError
            ? deleteCategoryError
            : categoryToDelete
            ? `Delete "${categoryToDelete.name}"? This cannot be undone.`
            : ''
        }
      />
    </div>
  );
};
