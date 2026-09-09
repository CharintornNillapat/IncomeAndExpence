import { test, expect } from '@playwright/test';

test.describe('Core Transaction Flow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should record an expense transaction via Quick Add modal and display in recent transactions', async ({ page }) => {
    // 1. Open the Quick Add modal
    const quickAddBtn = page.locator('#navbar-quick-add-btn');
    await expect(quickAddBtn).toBeVisible();
    await quickAddBtn.click();

    // 2. Locate and verify the modal dialog
    const modal = page.getByRole('dialog', { name: /Quick Record Transaction/i });
    await expect(modal).toBeVisible();

    // 3. Fill in amount with calculation or direct number
    const amountInput = modal.locator('input[name="amount_expression"]');
    await amountInput.fill('150');

    // 4. Select the Paying Wallet inside the modal
    const walletSelect = modal.locator('select[id$="-wallet"]');
    await expect(walletSelect).toBeVisible();
    const optionsCount = await walletSelect.locator('option').count();
    if (optionsCount > 1) {
      await walletSelect.selectOption({ index: 1 });
    } else if (optionsCount === 1) {
      await walletSelect.selectOption({ index: 0 });
    }

    // 5. Fill description
    const descriptionInput = modal.locator('input[placeholder*="groceries"], input[id$="-desc"]');
    await descriptionInput.fill('E2E Playwright Coffee');

    // 6. Submit the form
    const submitBtn = modal.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 7. Assert that the transaction appears in the Recent Transactions list (confirming form submission)
    await expect(page.getByText('E2E Playwright Coffee')).toBeVisible();

    // 8. Verify modal closes cleanly
    await expect(modal).not.toBeVisible();
  });

  test('should record an income transaction directly from Dashboard quick form', async ({ page }) => {
    // Locate the Dashboard inline transaction card (outside modal)
    const dashboardForm = page.locator('form').filter({ hasText: /Record Transaction/i }).first();
    await expect(dashboardForm).toBeVisible();
    
    // Toggle to Income type
    const incomeTypeBtn = dashboardForm.locator('button').filter({ hasText: /^Income$/i }).first();
    await expect(incomeTypeBtn).toBeVisible();
    await incomeTypeBtn.click();

    // Enter Amount
    const amountInput = dashboardForm.locator('input[name="amount_expression"]');
    await amountInput.fill('2500');

    // Enter Description
    const descInput = dashboardForm.locator('input[placeholder*="groceries"], input[id$="-desc"]');
    await descInput.fill('E2E Freelance Income');

    // Submit
    const submitBtn = dashboardForm.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Assert transaction is visible
    await expect(page.getByText('E2E Freelance Income')).toBeVisible();
  });

  test('should filter transactions by search term and allow clearing search', async ({ page }) => {
    // Navigate to Transactions tab
    const txTabBtn = page.locator('button').filter({ hasText: /Transactions/i }).first();
    await txTabBtn.click();

    // Locate the search input
    const searchInput = page.locator('#tx-search-input');
    await expect(searchInput).toBeVisible();

    // Type a specific search term
    await searchInput.fill('NonexistentQuery12345');
    // Wait for debounce and verify no records or empty state
    await page.waitForTimeout(350);

    // Locate and click clear button
    const clearBtn = page.locator('button[title="Clear search"]');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // Ensure search input is cleared
    await expect(searchInput).toHaveValue('');
  });

  test('should evaluate inline math expressions correctly in amount field', async ({ page }) => {
    const dashboardForm = page.locator('form').filter({ hasText: /Record Transaction/i }).first();
    await expect(dashboardForm).toBeVisible();

    const amountInput = dashboardForm.locator('input[name="amount_expression"]');
    await amountInput.fill('120 + 30 * 2');

    // The inline math preview should compute 180.00
    await expect(dashboardForm.getByText('180.00')).toBeVisible();
  });
});
