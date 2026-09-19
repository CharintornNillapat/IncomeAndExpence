import { test, expect } from '@playwright/test';
import { gotoTab } from './helpers';

/**
 * Covers the wallet add/transfer flows shared by WalletsView and the
 * shell-level TransferFundsModal/AddWalletModal (T41). All four render the
 * same extracted form components, and since T41 the dashboard hero buttons
 * and WalletsView's own header buttons open the *same* modal instance (owned
 * by App.tsx, mounted once) rather than two separate copies - so both sets of
 * cases below assert against the same canonical ids
 * (#transfer-source-wallet, #new-wallet-name, etc.).
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

    // T41: the dashboard hero button now opens the same shell-level
    // TransferFundsModal WalletsView uses, so this targets WalletsView's
    // canonical ids rather than the retired WalletPopupModal TRANSFER tab's
    // own `#modal-transfer-*` ids.
    const src = page.locator('#transfer-source-wallet');
    const dst = page.locator('#transfer-dest-wallet');
    await expect(src).toBeVisible();
    // Regression guard: these used to seed to the SAME wallet from the dashboard.
    expect(await src.inputValue()).not.toBe(await dst.inputValue());

    await page.locator('#transfer-amount-math').fill('75');
    const submit = page.locator('#execute-transfer-btn');
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByText(/Transfer completed successfully/i)).toBeVisible();
  });

  test('Modal: add wallet works and returns to overview', async ({ page }) => {
    await page.locator('#hero-add-wallet-btn').click();

    // T41: same shell-level AddWalletModal WalletsView uses - canonical ids,
    // not the retired WalletPopupModal ADD_WALLET tab's `#modal-new-wallet-*`.
    const name = page.locator('#new-wallet-name');
    await expect(name).toBeVisible();
    await name.fill('Modal Vault');
    await page.locator('#new-wallet-init-balance').fill('900');
    await page.locator('#save-new-wallet-btn').click();

    await expect(page.getByText('Modal Vault').first()).toBeVisible();
  });

  test('Modal: rejects an unnamed wallet without losing input', async ({ page }) => {
    await page.locator('#hero-add-wallet-btn').click();
    await page.locator('#new-wallet-init-balance').fill('50');
    // Bypass the native required attribute to reach the Zod layer.
    await page.locator('#new-wallet-name').evaluate((el: HTMLInputElement) => el.removeAttribute('required'));
    await page.locator('#save-new-wallet-btn').click();

    await expect(page.getByText(/Wallet name is required/i)).toBeVisible();
    await expect(page.locator('#new-wallet-init-balance')).toHaveValue('50');
  });
});
