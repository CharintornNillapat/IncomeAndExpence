import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFinanceActions, useFinanceState } from '../context/FinanceContext';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { Category } from '../types';
import { categoryGroups, categoryUsage, usedColors } from '../selectors/categories';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/Modal';
import { CategoryList } from '../components/category/CategoryList';
import { CategoryEditDetails, CategoryForm, NewCategoryDetails } from '../components/category/CategoryForm';
import { SmartRulesPanel } from '../components/category/SmartRulesPanel';
import { CreatableCategoryType } from '../components/category/categoryLabels';

type CategorySubTab = 'MANAGE' | 'RULES';

/**
 * Spec 6.6 (ADR 0037): the Categories page. The list (7/12) groups the live
 * categories into Expense, Income and a locked System group; the form (5/12)
 * adds a category, or edits the one whose row was clicked. Below `lg` the new
 * form stacks under the list and an edit opens in a sheet, one render path
 * through `useMediaQuery` (as on the Wallets page). The Smart rules tab is
 * `SmartRulesPanel`.
 */
export const CategoriesView: React.FC = () => {
  const { categories, keywordRules, transactions } = useFinanceState();
  const { addCategory, updateCategory, deleteCategory } = useFinanceActions();
  const isWide = useMediaQuery('(min-width: 1024px)');

  const [subTab, setSubTab] = useState<CategorySubTab>('MANAGE');
  const [editingId, setEditingId] = useState<string | null>(null);
  // A new form remounts after each add, so it starts on the next free colour.
  const [newFormKey, setNewFormKey] = useState(0);
  const [newType, setNewType] = useState<CreatableCategoryType>('EXPENSE');

  const groups = useMemo(() => categoryGroups(categories), [categories]);
  // An edit can only be of an Expense or Income category; System rows are not buttons.
  const editing = useMemo(
    () => [...groups.expense, ...groups.income].find((c) => c.id === editingId) ?? null,
    [groups, editingId]
  );

  const inUseIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of transactions) if (!t.isDeleted && t.categoryId) ids.add(t.categoryId);
    for (const r of keywordRules) ids.add(r.categoryId);
    return ids;
  }, [transactions, keywordRules]);

  const used = useMemo(() => usedColors(categories, editing?.id), [categories, editing]);
  const usage = useMemo(
    () => (editing ? categoryUsage(editing.id, transactions, keywordRules) : undefined),
    [editing, transactions, keywordRules]
  );

  // Focus goes somewhere sensible once its target has rendered: the form's
  // heading when a row opens it, the row after Save or Cancel, the list's
  // heading after a delete (the row is gone).
  const focusAfterRef = useRef<string | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const focusLater = (id: string) => {
    focusAfterRef.current = id;
    setFocusTick((tick) => tick + 1);
  };

  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const id = focusAfterRef.current;
    if (!id || toDelete) return;
    focusAfterRef.current = null;
    document.getElementById(id)?.focus();
  }, [focusTick, toDelete, editing]);

  const openCategory = useCallback(
    (category: Category) => {
      setEditingId(category.id);
      if (isWide) focusLater('category-form-heading');
    },
    [isWide]
  );

  const closeEdit = useCallback(
    (returnTo?: string) => {
      setEditingId(null);
      // Below `lg` the sheet's `Modal` returns focus to its opener itself.
      if (returnTo && isWide) focusLater(returnTo);
    },
    [isWide]
  );

  const handleAdd = useCallback(
    (details: NewCategoryDetails) =>
      addCategory({ name: details.name, type: details.type, color: details.color, description: details.description }),
    [addCategory]
  );

  const handleSave = useCallback(
    (id: string, details: CategoryEditDetails) => updateCategory(id, details),
    [updateCategory]
  );

  const confirmDelete = useCallback(async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    const result = await deleteCategory(toDelete.id);
    setIsDeleting(false);
    if (!result.success) {
      setDeleteError(result.error || 'Failed to delete category');
      return;
    }
    setToDelete(null);
    setEditingId(null);
    focusAfterRef.current = 'category-list-heading';
    setFocusTick((tick) => tick + 1);
  }, [toDelete, deleteCategory]);

  const form = (category: Category | null, showHeading: boolean) => (
    <CategoryForm
      key={category ? category.id : `new-${newFormKey}`}
      editing={category}
      used={used}
      usage={usage}
      initialType={newType}
      showHeading={showHeading}
      onAdd={handleAdd}
      onAdded={(type) => {
        setNewType(type);
        setNewFormKey((k) => k + 1);
      }}
      onSave={handleSave}
      onSaved={(id) => closeEdit(`edit-category-${id}`)}
      onCancel={() => closeEdit(category ? `edit-category-${category.id}` : undefined)}
      onRequestDelete={(c) => {
        setDeleteError(null);
        setToDelete(c);
      }}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Group your spending and income, and teach auto-categorization what belongs where"
        actions={
          <SegmentedControl<CategorySubTab>
            size="sm"
            mode="tabs"
            ariaLabel="Categories and smart rules"
            value={subTab}
            onChange={setSubTab}
            className="flex"
            options={[
              { value: 'MANAGE', id: 'category-subtab-manage', label: 'Categories' },
              { value: 'RULES', id: 'category-subtab-rules', label: 'Smart rules' },
            ]}
          />
        }
      />

      {subTab === 'MANAGE' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7">
            <CategoryList groups={groups} inUseIds={inUseIds} selectedId={editing?.id} onSelect={openCategory} />
          </div>
          <Card padding="none" className="lg:col-span-5 p-4 sm:p-6">
            {isWide ? form(editing, true) : form(null, true)}
          </Card>
        </div>
      ) : (
        <SmartRulesPanel />
      )}

      {!isWide && (
        <Modal isOpen={!!editing} onClose={() => closeEdit()} title="Edit category" maxWidthClassName="max-w-md">
          {editing && form(editing, false)}
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!toDelete}
        onClose={() => {
          setToDelete(null);
          setDeleteError(null);
        }}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
        isDestructive
        title="Delete category"
        confirmText="Delete category"
        description={
          !toDelete
            ? ''
            : deleteError
              ? `"${toDelete.name}" was not deleted.`
              : `Delete "${toDelete.name}"? It leaves your categories and every category picker. No transaction or rule uses it.`
        }
        error={deleteError}
      />
    </div>
  );
};
