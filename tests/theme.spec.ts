import { test, expect } from '@playwright/test';
import { gotoTab } from './helpers';

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

    await expect(themeToggleBtn).toBeVisible();

    // useTheme always stamps a resolved data-theme, so waiting on it confirms
    // the app has applied a theme before we start clicking.
    await expect(htmlElement).toHaveAttribute('data-theme', /^(light|dark)$/);

    // cycleTheme steps light -> dark -> system -> light. A fresh context has no
    // stored preference so it starts on 'system', meaning the first click can
    // resolve to the same visual theme. At most three clicks reach an explicitly
    // dark document from any starting point.
    for (let i = 0; i < 3; i++) {
      if ((await htmlElement.getAttribute('data-theme')) === 'dark') break;
      await themeToggleBtn.click();
      // Re-assert the attribute so the next read happens after React has
      // committed, rather than racing the state update with a bare classList
      // read the way this test used to.
      await expect(htmlElement).toHaveAttribute('data-theme', /^(light|dark)$/);
    }

    await expect(htmlElement).toHaveAttribute('data-theme', 'dark');
    await expect(htmlElement).toHaveClass(/dark/);

    // Cycling onward must leave dark mode again.
    await themeToggleBtn.click();
    await expect(htmlElement).not.toHaveClass(/dark/);
  });

  test('should navigate between tabs via desktop navbar and verify view loading', async ({ page }) => {
    await gotoTab(page, 'wallets');
    await expect(page.getByRole('heading', { name: /Wallets & Accounts/i })).toBeVisible();

    await gotoTab(page, 'debts');
    await expect(page.getByRole('heading', { name: /Debts & Loans/i })).toBeVisible();

    await gotoTab(page, 'diary');
    await expect(page.getByRole('heading', { name: /Holistic Mini Diary/i })).toBeVisible();

    await gotoTab(page, 'dashboard');
    await expect(page.getByText(/Total Money Across All Wallets/i)).toBeVisible();
  });
});
