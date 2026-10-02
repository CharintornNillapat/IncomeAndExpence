import { test, expect } from '@playwright/test';
import { gotoTab, addQuickTransaction } from './helpers';

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
    const descriptionInput = modal.locator('input[id$="-desc"]');
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

  test('should record an income transaction via the Navbar Quick Add modal', async ({ page }) => {
    // The Dashboard's "Record a Transaction" CTA card was removed; the Navbar
    // quick-add button is now the only entry point into this same modal.
    await page.locator('#navbar-quick-add-btn').click();

    const modal = page.getByRole('dialog', { name: /Quick Record Transaction/i });
    await expect(modal).toBeVisible();

    // Toggle to Income type
    const incomeTypeBtn = modal.locator('button').filter({ hasText: /^Income$/i }).first();
    await expect(incomeTypeBtn).toBeVisible();
    await incomeTypeBtn.click();

    // Enter Amount
    const amountInput = modal.locator('input[name="amount_expression"]');
    await amountInput.fill('2500');

    // Enter Description
    const descInput = modal.locator('input[id$="-desc"]');
    await descInput.fill('E2E Freelance Income');

    // Submit
    const submitBtn = modal.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Assert transaction is visible
    await expect(page.getByText('E2E Freelance Income')).toBeVisible();
  });

  test('should filter transactions by search term and allow clearing search', async ({ page }) => {
    // A fresh context has no transactions, so seed one. Without this the list is
    // empty either way and any assertion about filtering is vacuous.
    const marker = 'E2E Searchable Latte';
    await addQuickTransaction(page, marker);

    // Navigate to Transactions tab (waits for the lazy view chunk to resolve)
    await gotoTab(page, 'transactions');

    const row = page.getByText(marker);
    await expect(row).toBeVisible();

    // Locate the search input
    const searchInput = page.locator('#tx-search-input');
    await expect(searchInput).toBeVisible();

    // Type a term that cannot match. The input is debounced by 250ms, so assert
    // that the seeded row actually disappears rather than sleeping past the
    // debounce - the assertion retries until the filtered list settles.
    await searchInput.fill('NonexistentQuery12345');
    await expect(row).toHaveCount(0);
    await expect(page.getByText(/No transactions match your current filters/i)).toBeVisible();

    // Locate and click clear button
    const clearBtn = page.locator('button[title="Clear search"]');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // Clearing restores the unfiltered list.
    await expect(searchInput).toHaveValue('');
    await expect(row).toBeVisible();
  });

  // Phase 65 (ADR 0041): a fresh context has no transactions, so its empty
  // list is a first run, not a list the filters emptied.
  test('a fresh guest sees a first-run empty state, not the filtered one', async ({ page }) => {
    await gotoTab(page, 'transactions');
    await expect(page.getByText('No transactions yet')).toBeVisible();
    await expect(page.getByText(/No transactions match your current filters/i)).toHaveCount(0);

    // A filter does not change that: nothing is recorded yet.
    await page.locator('#tx-filter-type-income').click();
    await expect(page.getByText('No transactions yet')).toBeVisible();
    await expect(page.getByText(/No transactions match your current filters/i)).toHaveCount(0);
  });

  test('should evaluate inline math expressions correctly in amount field', async ({ page }) => {
    await page.locator('#navbar-quick-add-btn').click();

    const modal = page.getByRole('dialog', { name: /Quick Record Transaction/i });
    await expect(modal).toBeVisible();

    const amountInput = modal.locator('input[name="amount_expression"]');
    await amountInput.fill('120 + 30 * 2');

    // The inline math preview should compute 180.00. Target the "Calculated:" badge
    // specifically - the value also renders in the submit button, so a bare text
    // match resolves to more than one element.
    const calculatedBadge = modal.locator('span', { hasText: /Calculated:/i });
    await expect(calculatedBadge).toBeVisible();
    await expect(calculatedBadge).toContainText('180.00');
  });

  // Phase 66 (ADR 0042, audit 013 finding 7): Quick Add says each thing once.
  test('Quick Add shows one title, the formula result once and formula help once', async ({ page }) => {
    await page.locator('#navbar-quick-add-btn').click();
    const modal = page.getByRole('dialog', { name: /Quick Record Transaction/i });
    await expect(modal).toBeVisible();

    // One heading: the dialog's own. The form inside it adds none.
    await expect(modal.getByRole('heading')).toHaveCount(1);
    await expect(modal.getByRole('heading', { name: 'Quick Record Transaction' })).toBeVisible();
    await expect(modal.getByText('Log an expense or income')).toHaveCount(0);

    // Formula help is the placeholder only.
    const amountInput = modal.locator('input[name="amount_expression"]');
    await expect(amountInput).toHaveAttribute('placeholder', /500\+500/);
    await expect(modal.getByText(/Supports inline arithmetic/i)).toHaveCount(0);
    await expect(modal.getByLabel(/Supports formulas/i)).toHaveCount(0);

    // The result shows in the badge; the apply button names its action.
    await amountInput.fill('120/4');
    await expect(modal.locator('span', { hasText: /Calculated:/i })).toContainText('฿30.00');
    // The submit button still carries the amount it will record; the result
    // itself is not repeated on the apply button.
    const useResult = modal.getByRole('button', { name: 'Use result' });
    await expect(useResult).toBeVisible();
    await expect(useResult).not.toContainText('฿');
    await useResult.click();
    await expect(amountInput).toHaveValue('30');
  });
});
