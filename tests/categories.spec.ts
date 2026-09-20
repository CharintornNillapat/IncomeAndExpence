import { test, expect } from '@playwright/test';
import { gotoTab } from './helpers';

/**
 * Phase 30: characterizes the "Categories" hub - the merge of category
 * management into what used to be the standalone "Smart Rules" view - and
 * pins the fix for the triple-duplicated default categories bug
 * (`FinanceContext.tsx`'s `seedInitialUserAccount` race; see
 * `docs/audit/decisions` and `refactor-log.md` Phase 30 for the root cause).
 */
test.describe('Categories hub', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'categories');
  });

  test('default categories appear exactly once in the management list', async ({ page }) => {
    const foodRows = page.locator('[id^="category-row-"]').filter({ hasText: 'Food & Dining' });
    await expect(foodRows).toHaveCount(1);

    const salaryRows = page.locator('[id^="category-row-"]').filter({ hasText: 'Primary Salary' });
    await expect(salaryRows).toHaveCount(1);
  });

  test('a default category has no delete action - only user-created, unused categories do', async ({ page }) => {
    // "Food & Dining" is a system default (`cat-food`) - deletable would let a
    // user break the fixed taxonomy other mutators resolve by type.
    await expect(page.locator('#delete-category-cat-food')).toHaveCount(0);
    await expect(page.locator('#edit-category-cat-food')).toBeVisible();
  });

  test('the keyword-rule category picker has strictly unique options, zero duplicates', async ({ page }) => {
    await page.locator('#category-subtab-rules').click();

    const optionLabels = await page.locator('#keyword-category-select option').allTextContents();
    expect(optionLabels.length).toBeGreaterThan(0);
    expect(new Set(optionLabels).size).toBe(optionLabels.length);
  });

  test('creating a new category appears in the management list and in the rule-assignment dropdown immediately', async ({ page }) => {
    const uniqueName = `ZZZ Test Category ${Date.now().toString().slice(-6)}`;

    await page.locator('#new-category-name').fill(uniqueName);
    await page.locator('#new-category-type').selectOption({ label: 'Income' });
    await page.locator('#save-category-btn').click();

    const newRow = page.locator('[id^="category-row-"]').filter({ hasText: uniqueName });
    await expect(newRow).toBeVisible();
    await expect(newRow).toContainText('INCOME');

    // Local Storage Mode has no network round-trip - the new category is live
    // in state immediately, so the Smart Rules picker should offer it right away.
    await page.locator('#category-subtab-rules').click();
    const option = page.locator('#keyword-category-select option', { hasText: uniqueName });
    await expect(option).toHaveCount(1);
  });

  test('editing a category name updates the management list', async ({ page }) => {
    const originalName = `ZZZ Edit Source ${Date.now().toString().slice(-6)}`;
    const renamedName = `ZZZ Edit Target ${Date.now().toString().slice(-6)}`;

    await page.locator('#new-category-name').fill(originalName);
    await page.locator('#new-category-type').selectOption({ label: 'Expense' });
    await page.locator('#save-category-btn').click();

    const newRow = page.locator('[id^="category-row-"]').filter({ hasText: originalName });
    await expect(newRow).toBeVisible();
    const categoryId = await newRow.getAttribute('id');
    const catId = categoryId!.replace('category-row-', '');

    await page.locator(`#edit-category-${catId}`).click();
    const editNameInput = page.locator('#edit-category-name');
    await expect(editNameInput).toBeVisible();
    await editNameInput.fill(renamedName);
    await page.locator('#edit-category-save-btn').click();

    await expect(page.locator(`#edit-category-name`)).toHaveCount(0);
    await expect(page.locator(`#category-row-${catId}`)).toContainText(renamedName);
  });

  test('deleting an unused user-created category removes it from the management list', async ({ page }) => {
    const uniqueName = `ZZZ Delete Me ${Date.now().toString().slice(-6)}`;

    await page.locator('#new-category-name').fill(uniqueName);
    await page.locator('#new-category-type').selectOption({ label: 'Expense' });
    await page.locator('#save-category-btn').click();

    const newRow = page.locator('[id^="category-row-"]').filter({ hasText: uniqueName });
    await expect(newRow).toBeVisible();
    const categoryId = await newRow.getAttribute('id');
    const catId = categoryId!.replace('category-row-', '');

    await page.locator(`#delete-category-${catId}`).click();
    await expect(page.getByRole('dialog', { name: 'Delete Category' })).toBeVisible();
    await page.locator('#confirm-destructive-btn').click();

    await expect(page.locator(`#category-row-${catId}`)).toHaveCount(0);
  });

  test('attempting to delete an in-use category surfaces the guard error in the confirm dialog', async ({ page }) => {
    // `deleteCategory`'s in-use guard is a server-side re-check independent
    // of the UI's own `canDelete` precondition (which pre-emptively hides the
    // delete button once a category is referenced). To exercise the guard
    // itself, open the confirm dialog while the category is still unused,
    // then reference it from the globally-mounted Quick Add modal before
    // confirming the delete. The confirm dialog's own full-viewport overlay
    // sits on top of the navbar at that point, so a coordinate-based click
    // (even with `force: true`, which only skips Playwright's actionability
    // checks, not real hit-testing) would land on the overlay instead -
    // `dispatchEvent` fires directly on the target node and reaches the
    // button's React handler regardless of what's visually on top.
    const uniqueName = `ZZZ In Use ${Date.now().toString().slice(-6)}`;

    await page.locator('#new-category-name').fill(uniqueName);
    await page.locator('#new-category-type').selectOption({ label: 'Expense' });
    await page.locator('#save-category-btn').click();

    const newRow = page.locator('[id^="category-row-"]').filter({ hasText: uniqueName });
    await expect(newRow).toBeVisible();
    const categoryId = await newRow.getAttribute('id');
    const catId = categoryId!.replace('category-row-', '');

    await page.locator(`#delete-category-${catId}`).click();
    const confirmDialog = page.getByRole('dialog', { name: 'Delete Category' });
    await expect(confirmDialog).toBeVisible();

    await page.locator('#navbar-quick-add-btn').dispatchEvent('click');
    const quickAddModal = page.getByRole('dialog', { name: /Quick Record Transaction/i });
    await expect(quickAddModal).toBeVisible();

    await quickAddModal.locator('input[name="amount_expression"]').fill('50');
    await quickAddModal.locator('select[id$="-category"]').selectOption({ label: uniqueName });
    await quickAddModal.locator('button[type="submit"]').click();
    await expect(quickAddModal).not.toBeVisible();

    await expect(confirmDialog).toBeVisible();
    await page.locator('#confirm-destructive-btn').click();

    await expect(confirmDialog).toContainText('used by existing transactions or keyword rules');
  });
});
