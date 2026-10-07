import { test, expect, type Page } from '@playwright/test';
import { gotoTab } from './helpers';

/**
 * The open tab lives in the URL's hash (Phase 112, ADR 0088, audit finding
 * 14): Back and Forward walk between tabs, a refresh keeps the tab, and a
 * bookmarked `#/<tab>` opens it. The Dashboard is the bare URL.
 */

async function expectTab(page: Page, tabId: string) {
  await expect(page.locator(`#nav-tab-${tabId}`)).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#view-loading-fallback')).toHaveCount(0);
}

const hashOf = (page: Page) => new URL(page.url()).hash;

test.describe('Tabs in the URL', () => {
  test('each tab writes its hash, and Back and Forward walk between them', async ({ page }) => {
    await page.goto('/');
    await expectTab(page, 'dashboard');
    expect(hashOf(page)).toBe('');

    await gotoTab(page, 'transactions');
    await expect(page).toHaveURL(/#\/transactions$/);
    await gotoTab(page, 'wallets');
    await expect(page).toHaveURL(/#\/wallets$/);

    // Opening the tab already open adds no entry: one Back still reaches Transactions.
    await gotoTab(page, 'wallets');

    await page.goBack();
    await expectTab(page, 'transactions');
    await page.goBack();
    await expectTab(page, 'dashboard');
    expect(hashOf(page)).toBe('');

    await page.goForward();
    await expectTab(page, 'transactions');
    await expect(page).toHaveURL(/#\/transactions$/);
  });

  test('a refresh keeps the open tab', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'debts');

    await page.reload();

    await expectTab(page, 'debts');
    await expect(page).toHaveURL(/#\/debts$/);
  });

  test('a bookmarked tab opens directly, and anything else opens the Dashboard', async ({ page }) => {
    await page.goto('/#/diary');
    await expectTab(page, 'diary');

    await page.goto('/#/settings');
    await expectTab(page, 'dashboard');
  });

  test('a hash typed into the address bar opens its tab', async ({ page }) => {
    await page.goto('/');
    await expectTab(page, 'dashboard');

    await page.evaluate(() => {
      window.location.hash = '#/categories';
    });

    await expectTab(page, 'categories');
  });
});
