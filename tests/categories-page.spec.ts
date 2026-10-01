import { test, expect } from '@playwright/test';
import { gotoTab } from './helpers';

/**
 * The Categories page (Phase 62, spec 6.6, ADR 0037), as a guest. A fresh
 * context has the nine shipped categories, whose colours predate the identity
 * palette (spec 5.1's migration is Phase 63), so every one of the twelve
 * swatches starts free. Nothing is intercepted.
 */
test.describe('The Categories page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'categories');
  });

  test("L9: a new category's colour is not offered to the next one, after a reload too", async ({ page }) => {
    const name = `E2E Colour ${Date.now().toString().slice(-6)}`;
    // A new form starts on the first free colour, tan.
    const tan = page.locator('#new-category-color-d9a066');
    await expect(tan).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#new-category-name').fill(name);
    await page.locator('#save-category-btn').click();
    await expect(page.locator('#category-group-expense [id^="category-row-"]').filter({ hasText: name })).toBeVisible();

    await expect(tan).toBeDisabled();
    await expect(tan).toHaveAttribute('aria-label', `Tan, used by ${name}`);
    await expect(page.locator('#new-category-color-6c8eef')).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await gotoTab(page, 'categories');
    await expect(page.locator('#new-category-color-d9a066')).toBeDisabled();
  });

  test('the System categories are locked, under readable names', async ({ page }) => {
    const debt = page.locator('#category-group-system [id^="category-row-"]').filter({ hasText: 'Debt repayment' });
    await expect(debt).toContainText('Not counted as income or spending');
    await expect(debt.getByRole('img', { name: 'Locked' })).toBeVisible();
    await expect(debt.locator('button')).toHaveCount(0);
    await expect(page.locator('#category-group-system')).toContainText('Balance adjustment');
  });

  test('a row opens "Edit category", and Cancel returns to "New category" with focus on the row', async ({ page }) => {
    const row = page.locator('#edit-category-cat-groceries');
    await row.click();
    await expect(page.locator('#category-form-heading')).toHaveText('Edit category');
    await expect(page.locator('#edit-category-name')).toHaveValue('Groceries');
    await expect(row).toHaveAttribute('aria-pressed', 'true');

    await page.locator('#edit-category-cancel-btn').click();
    await expect(page.locator('#category-form-heading')).toHaveText('New category');
    await expect(page.locator('#edit-category-name')).toHaveCount(0);
    await expect(row).toBeFocused();
  });
});
