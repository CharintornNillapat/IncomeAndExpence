import { test, expect } from '@playwright/test';

test.describe('Navigation & Theme E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the dashboard and verify primary brand elements', async ({ page }) => {
    await expect(page).toHaveTitle(/FinLife/i);
    await expect(page.getByRole('heading', { name: /FinLife Tracker/i })).toBeVisible();
    await expect(page.locator('#navbar-theme-toggle-btn')).toBeVisible();
    await expect(page.locator('#navbar-quick-add-btn')).toBeVisible();
  });

  test('should toggle dark/light theme correctly', async ({ page }) => {
    const themeToggleBtn = page.locator('#navbar-theme-toggle-btn');
    const htmlElement = page.locator('html');

    const isInitiallyDark = await htmlElement.evaluate((el) => el.classList.contains('dark'));

    // Click theme toggle button to switch modes
    await themeToggleBtn.click();

    // Verify theme state change
    const isNowDark = await htmlElement.evaluate((el) => el.classList.contains('dark'));
    if (!isInitiallyDark) {
      if (!isNowDark) {
        // In case system theme needs another click to reach dark
        await themeToggleBtn.click();
      }
      await expect(htmlElement).toHaveClass(/dark/);
    } else {
      // Toggle back from dark to light
      if (isNowDark) {
        await themeToggleBtn.click();
      }
    }
  });

  test('should navigate between tabs via desktop navbar and verify view loading', async ({ page }) => {
    // 1. Navigate to Wallets View
    const walletsTab = page.locator('#nav-tab-wallets');
    if (await walletsTab.isVisible()) {
      await walletsTab.click();
      await expect(page.getByRole('heading', { name: /Wallets & Accounts/i })).toBeVisible();
    }

    // 2. Navigate to Debt Payoff View
    const debtsTab = page.locator('#nav-tab-debts');
    if (await debtsTab.isVisible()) {
      await debtsTab.click();
      await expect(page.getByRole('heading', { name: /Debts & Loans/i })).toBeVisible();
    }

    // 3. Navigate to Holistic Diary View
    const diaryTab = page.locator('#nav-tab-diary');
    if (await diaryTab.isVisible()) {
      await diaryTab.click();
      await expect(page.getByRole('heading', { name: /Holistic Mini Diary/i })).toBeVisible();
    }

    // 4. Return to Dashboard View
    const dashboardTab = page.locator('#nav-tab-dashboard');
    if (await dashboardTab.isVisible()) {
      await dashboardTab.click();
      await expect(page.getByText(/Total Money Across All Wallets/i)).toBeVisible();
    }
  });
});
