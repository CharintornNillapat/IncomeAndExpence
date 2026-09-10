import { test, expect } from '@playwright/test';
import { gotoTab } from './helpers';

/**
 * Covers the wallet add/transfer flows shared by WalletsView and
 * WalletPopupModal. Both render the same extracted form components, so these
 * exercise each container's wiring: id sets, seeding, and success callbacks.
 *
 * The modal cases go through the dashboard hero buttons rather than the modal's
 * own tabs, so they also cover the open-sync: the modal stays mounted between
 * opens, so it has to re-apply `initialTab` each time it is opened.
 */
test.describe('Wallet forms (shared AddWalletForm / WalletTransferForm)', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('WalletsView: transfer moves money between wallets', async ({ page }) => {
    await gotoTab(page, 'wallets');
    await page.locator('#wallet-transfer-modal-btn').click();

    const src = page.locator('#transfer-source-wallet');
    const dst = page.locator('#transfer-dest-wallet');
    await expect(src).toBeVisible();
    await expect(dst).toBeVisible();
    // Seeded to two different wallets, so submit is reachable.
    expect(await src.inputValue()).not.toBe(await dst.inputValue());

    await page.locator('#transfer-amount-math').fill('100');
    const submit = page.locator('#execute-transfer-btn');
    await expect(submit).toBeEnabled();
    await expect(submit).toContainText('฿100.00');
    await submit.click();

    // View closes its transfer modal on success.
    await expect(src).toHaveCount(0);

    // The transfer must actually be in the ledger.
    await gotoTab(page, 'transactions');
    await expect(page.getByText('Funds transfer').first()).toBeVisible();
  });

  test('Modal: transfer from dashboard seeds distinct wallets and reports status', async ({ page }) => {
    await page.locator('#hero-transfer-funds-btn').click();

    const src = page.locator('#modal-transfer-source');
    const dst = page.locator('#modal-transfer-dest');
    await expect(src).toBeVisible();
    // Regression guard: these used to seed to the SAME wallet from the dashboard.
    expect(await src.inputValue()).not.toBe(await dst.inputValue());

    await page.locator('#modal-transfer-amount-input').fill('75');
    const submit = page.locator('#modal-submit-transfer-btn');
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByText(/Transfer completed successfully/i)).toBeVisible();
  });

  test('Modal: add wallet works and returns to overview', async ({ page }) => {
    await page.locator('#hero-add-wallet-btn').click();

    const name = page.locator('#modal-new-wallet-name');
    await expect(name).toBeVisible();
    await name.fill('Modal Vault');
    await page.locator('#modal-new-wallet-balance').fill('900');
    await page.locator('#modal-create-wallet-submit').click();

    await expect(page.getByText('Modal Vault').first()).toBeVisible();
  });

  test('Modal: rejects an unnamed wallet without losing input', async ({ page }) => {
    await page.locator('#hero-add-wallet-btn').click();
    await page.locator('#modal-new-wallet-balance').fill('50');
    // Bypass the native required attribute to reach the Zod layer.
    await page.locator('#modal-new-wallet-name').evaluate((el: HTMLInputElement) => el.removeAttribute('required'));
    await page.locator('#modal-create-wallet-submit').click();

    await expect(page.getByText(/Wallet name is required/i)).toBeVisible();
    await expect(page.locator('#modal-new-wallet-balance')).toHaveValue('50');
  });
});
