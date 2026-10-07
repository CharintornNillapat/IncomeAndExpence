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

  // Phase 113 (ADR 0089): the title names the tab, and Back restores it.
  test('the page title names the open tab', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('FinLife Tracker');

    await gotoTab(page, 'transactions');
    await expect(page).toHaveTitle('Transactions · FinLife Tracker');
    await gotoTab(page, 'debts');
    await expect(page).toHaveTitle('Debt payoff · FinLife Tracker');

    await page.goBack();
    await expectTab(page, 'transactions');
    await expect(page).toHaveTitle('Transactions · FinLife Tracker');

    await page.goto('/#/diary');
    await expect(page).toHaveTitle('Daily diary · FinLife Tracker');
  });
});

/**
 * Phase 113 (ADR 0089): an open dialog has a history entry of its own, so
 * Back closes it and the tab stays; a dialog closed any other way leaves no
 * entry behind, so the next Back changes the tab.
 */
test.describe('Dialogs and Back', () => {
  const quickAdd = (page: Page) => page.getByRole('dialog', { name: /Quick Record Transaction/i });

  // From the keyboard, so the button is the opener in every browser: a click
  // does not focus a button in WebKit, as in Safari.
  async function openQuickAddOnWallets(page: Page) {
    await page.goto('/');
    await gotoTab(page, 'wallets');
    await page.locator('#navbar-quick-add-btn').focus();
    await page.keyboard.press('Enter');
    await expect(quickAdd(page)).toBeVisible();
    await expect(page).toHaveURL(/#\/wallets$/);
  }

  test('Back closes the open dialog and keeps the tab; the next Back changes the tab', async ({ page }) => {
    await openQuickAddOnWallets(page);

    await page.goBack();
    await expect(quickAdd(page)).toHaveCount(0);
    await expectTab(page, 'wallets');
    await expect(page).toHaveURL(/#\/wallets$/);
    // Focus goes back to the button that opened it, as on Escape.
    await expect(page.locator('#navbar-quick-add-btn')).toBeFocused();

    await page.goBack();
    await expectTab(page, 'dashboard');
  });

  test('a dialog closed by its button leaves no Back step behind', async ({ page }) => {
    await openQuickAddOnWallets(page);

    await page.locator('#close-quick-record-modal-btn').click();
    await expect(quickAdd(page)).toHaveCount(0);

    await page.goBack();
    await expectTab(page, 'dashboard');
  });

  test('a hand-off to another dialog leaves one Back step, for the dialog now open', async ({ page }) => {
    await openQuickAddOnWallets(page);

    await quickAdd(page).locator('[id$="-shortcut-transfer"]').click();
    const transfer = page.getByRole('dialog').filter({ has: page.locator('#transfer-source-wallet') });
    await expect(transfer).toBeVisible();
    await expect(quickAdd(page)).toHaveCount(0);

    await page.goBack();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expectTab(page, 'wallets');

    await page.goBack();
    await expectTab(page, 'dashboard');
  });

  test("a dialog link that changes the tab takes the dialog's place in history", async ({ page }) => {
    await openQuickAddOnWallets(page);

    await quickAdd(page).locator('[id$="-shortcut-repay-debt"]').click();
    await expectTab(page, 'debts');
    await expect(quickAdd(page)).toHaveCount(0);

    await page.goBack();
    await expectTab(page, 'wallets');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

