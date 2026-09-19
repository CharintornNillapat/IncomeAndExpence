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
});
