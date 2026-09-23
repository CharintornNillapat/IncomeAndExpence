import { expect, type Page } from '@playwright/test';

/**
 * Navigates to a top-level tab and waits for its view to finish mounting.
 *
 * Every view in `App.tsx` is a `React.lazy` import, so clicking a tab kicks off
 * a dynamic chunk fetch before the view renders. Under the Vite dev server with
 * parallel workers that fetch can take noticeably longer in Firefox, which is
 * what made the navigation specs flaky.
 *
 * Each step here is an auto-retrying assertion:
 *   1. the tab exists and is clickable,
 *   2. the tab actually became active (the app has committed the state change),
 *   3. the lazy-loading fallback has detached (the chunk resolved).
 *
 * The previous `if (await tab.isVisible())` guard was a single non-retrying
 * probe - if the navbar had not painted yet it silently skipped the whole
 * block, so the test passed without asserting anything.
 */
export async function gotoTab(page: Page, tabId: string): Promise<void> {
  const tab = page.locator(`#nav-tab-${tabId}`);
  await expect(tab).toBeVisible();
  await tab.click();

  // The active tab carries `aria-current="page"` (T31) - a semantic
  // attribute, not a Tailwind class, so a restyle of the active-tab fill
  // cannot silently break every navigation in the suite the way asserting
  // on `bg-stone-900` could.
  await expect(tab).toHaveAttribute('aria-current', 'page');

  // Suspense fallback is removed once the lazy chunk has resolved.
  await expect(page.locator('#view-loading-fallback')).toHaveCount(0);
}

/**
 * Records a transaction through the navbar Quick Add modal.
 *
 * A fresh browser context seeds wallets and debts but no transactions, so any
 * test that needs a populated ledger has to create one first.
 */
export async function addQuickTransaction(
  page: Page,
  description: string,
  amount = '150'
): Promise<void> {
  await page.locator('#navbar-quick-add-btn').click();

  const modal = page.getByRole('dialog', { name: /Quick Record Transaction/i });
  await expect(modal).toBeVisible();

  await modal.locator('input[name="amount_expression"]').fill(amount);

  const walletSelect = modal.locator('select[id$="-wallet"]');
  await expect(walletSelect).toBeVisible();
  const optionsCount = await walletSelect.locator('option').count();
  await walletSelect.selectOption({ index: optionsCount > 1 ? 1 : 0 });

  await modal
    .locator('input[id$="-desc"]')
    .fill(description);

  await modal.locator('button[type="submit"]').click();

  // The modal closing is the app's own confirmation that the write succeeded.
  await expect(modal).not.toBeVisible();
}
