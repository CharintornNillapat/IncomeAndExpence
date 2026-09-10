import { test, expect } from '@playwright/test';
import { gotoTab } from './helpers';

test.describe('Wallets & Accounts E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate to Wallets view and create a new wallet', async ({ page }) => {
    // 1. Navigate to the Wallets tab (waits for the lazy view chunk to resolve)
    await gotoTab(page, 'wallets');

    // 2. Open Add Wallet modal
    const addWalletBtn = page.getByRole('button', { name: /Add Wallet/i }).first();
    await expect(addWalletBtn).toBeVisible();
    await addWalletBtn.click();

    // 3. Fill in Wallet Name
    const walletNameInput = page.locator('#new-wallet-name');
    await expect(walletNameInput).toBeVisible();
    const uniqueWalletName = `E2E Vault ${Date.now().toString().slice(-4)}`;
    await walletNameInput.fill(uniqueWalletName);

    // 4. Fill in Starting Balance
    const initBalanceInput = page.locator('#new-wallet-init-balance');
    await initBalanceInput.fill('1250');

    // 5. Submit form
    const submitBtn = page.locator('#save-new-wallet-btn');
    await submitBtn.click();

    // 6. Assert new wallet appears on the grid
    await expect(page.getByText(uniqueWalletName)).toBeVisible();
  });
});
