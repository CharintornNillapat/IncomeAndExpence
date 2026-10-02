import { test, expect } from '@playwright/test';
import { gotoTab, seedLedger, SAMPLE_WALLETS } from './helpers';

/**
 * The Wallets page (Phase 59, spec 6.3, ADR 0034), as a guest. A fresh context
 * has the three starter wallets at ฿0.00 and no debt (ADR 0040), which the
 * first test pins. The page tests then seed the sample wallets: Main Checking
 * ฿2,500, Cash Wallet ฿150 and Savings Reserve ฿5,000, so ฿7,650.00 across
 * 3 wallets.
 *
 * Nothing is intercepted.
 */
test('a fresh guest starts with three ฿0.00 wallets and no debt (ADR 0040)', async ({ page }) => {
  await page.goto('/');
  await gotoTab(page, 'wallets');

  await expect(page.getByText('฿0.00 across 3 wallets')).toBeVisible();
  for (const id of ['wal-main-checking', 'wal-cash', 'wal-savings']) {
    await expect(page.getByTestId(`wallet-balance-${id}`)).toHaveText('฿0.00');
  }

  await gotoTab(page, 'debts');
  await expect(page.getByText('No debts tracked yet')).toBeVisible();
  await expect(page.locator('div[id^="debt-card-"]')).toHaveCount(0);
});

test.describe('The Wallets page', () => {
  test.beforeEach(async ({ page }) => {
    await seedLedger(page, { wallets: SAMPLE_WALLETS });
    await page.goto('/');
  });

  test('archiving a wallet takes it out of the list, the total and the pickers, and unarchiving brings it back', async ({ page }) => {
    await gotoTab(page, 'wallets');
    await expect(page.getByText('฿7,650.00 across 3 wallets')).toBeVisible();

    await page.locator('#wallet-entity-wal-cash').click();
    await page.locator('#wallet-detail-menu-btn').click();
    await page.locator('#archive-wallet-wal-cash').click();
    await page.locator('#confirm-destructive-btn').click();

    await expect(page.locator('#wallet-entity-wal-cash')).toHaveCount(0);
    await expect(page.getByText('฿7,500.00 across 2 wallets')).toBeVisible();

    // A new entry cannot be filed under an archived wallet.
    await page.locator('#navbar-quick-add-btn').click();
    const quickAdd = page.getByRole('dialog', { name: /Quick Record Transaction/i });
    const walletSelect = quickAdd.locator('select[id$="-wallet"]');
    await expect(walletSelect).toBeVisible();
    await expect(walletSelect.locator('option', { hasText: 'Cash Wallet' })).toHaveCount(0);
    await expect(walletSelect.locator('option', { hasText: 'Main Checking' })).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(quickAdd).not.toBeVisible();

    await page.locator('#wallet-archived-toggle').click();
    await page.locator('#wallet-unarchive-btn-wal-cash').click();

    await expect(page.locator('#wallet-entity-wal-cash')).toBeVisible();
    await expect(page.getByText('฿7,650.00 across 3 wallets')).toBeVisible();
    await expect(page.locator('#wallet-archived-toggle')).toHaveCount(0);
  });

  test("an edit renames the wallet and survives a reload", async ({ page }) => {
    const name = `E2E Renamed ${Date.now().toString().slice(-6)}`;
    await gotoTab(page, 'wallets');
    await page.locator('#wallet-entity-wal-savings').click();
    await page.locator('#wallet-edit-btn').click();
    await page.locator('#wallet-edit-name').fill(name);
    await page.locator('#wallet-edit-save-btn').click();

    await expect(page.locator('#wallet-edit-form')).toHaveCount(0);
    await expect(page.locator('#wallet-entity-wal-savings')).toContainText(name);

    await page.reload();
    await gotoTab(page, 'wallets');
    await expect(page.locator('#wallet-entity-wal-savings')).toContainText(name);
  });

  test('a Dashboard wallet row opens the Wallets page with that wallet selected', async ({ page }) => {
    await page.locator('#dashboard-wallet-card-wal-cash').click();

    await expect(page.locator('#nav-tab-wallets')).toHaveAttribute('aria-current', 'page');
    // The first wallet is the default selection, so Cash being selected is the hand-off's doing.
    await expect(page.locator('#wallet-entity-wal-cash')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#wallet-entity-wal-main-checking')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#wallet-detail-title')).toHaveText('Cash Wallet');
  });
});
