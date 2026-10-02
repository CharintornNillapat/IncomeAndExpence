import { test, expect } from '@playwright/test';
import { gotoTab, addQuickTransaction, seedLedger, SAMPLE_WALLETS, SAMPLE_STUDENT_LOAN } from './helpers';

/**
 * Editing a transaction (Phase 58b, ADR 0033), as a guest. Each edit must move
 * the wallet by exactly the difference: the old row's effect reversed, the new
 * one applied. The signed-in path is one `update_transaction` RPC, pinned in
 * `unit/authenticated-ledger.test.tsx` and the SQL probe; no spec signs in.
 *
 * `addQuickTransaction` records a ฿150 EXPENSE against the Quick Add select's
 * second wallet, the sample Cash Wallet (`wal-cash`, ฿150), so the balance
 * checks below read that one wallet's own card. A fresh context opens its
 * wallets at ฿0.00 and has no debt (ADR 0040), so each test seeds the sample
 * wallets and the sample Student Loan first.
 *
 * Nothing is intercepted.
 */
test.describe('Editing a transaction', () => {
  test.beforeEach(async ({ page }) => {
    await seedLedger(page, { wallets: SAMPLE_WALLETS, debts: [SAMPLE_STUDENT_LOAN] });
    await page.goto('/');
  });

  const cashBalance = (page: import('@playwright/test').Page) =>
    page.locator('#wallet-entity-wal-cash').getByTestId('wallet-balance-wal-cash');

  test("an amount edit moves the wallet by the difference only", async ({ page }) => {
    const marker = `E2E Edit Amount ${Date.now().toString().slice(-6)}`;
    await addQuickTransaction(page, marker);
    await gotoTab(page, 'wallets');
    await expect(cashBalance(page)).toContainText('฿0.00');

    await gotoTab(page, 'transactions');
    await page.locator('button[id^="tx-row-"]').filter({ hasText: marker }).click();
    const save = page.locator('button[id^="tx-save-btn-"]');
    await expect(save).toBeDisabled();

    await page.locator('#tx-edit-amount').fill('100');
    await expect(save).toBeEnabled();
    await save.click();
    await expect(save).toBeDisabled();

    // ฿150 - ฿100 instead of ฿150 - ฿150.
    await gotoTab(page, 'wallets');
    await expect(cashBalance(page)).toContainText('฿50.00');
  });

  test('an expense turned into income flips its effect on the wallet', async ({ page }) => {
    const marker = `E2E Edit Type ${Date.now().toString().slice(-6)}`;
    await addQuickTransaction(page, marker);

    await gotoTab(page, 'transactions');
    const row = page.locator('button[id^="tx-row-"]').filter({ hasText: marker });
    await row.click();
    await page.locator('#tx-edit-type-income').click();
    await page.locator('button[id^="tx-save-btn-"]').click();
    await expect(row).toContainText('+฿150.00');

    // The ฿150 spent comes back, and ฿150 more arrives: ฿150 + ฿150.
    await gotoTab(page, 'wallets');
    await expect(cashBalance(page)).toContainText('฿300.00');
  });

  test("a debt repayment edits only its note and date, and its debt stays where it was", async ({ page }) => {
    await gotoTab(page, 'debts');
    const card = page.locator('div[id^="debt-card-"]').filter({ hasText: 'Student Loan' });
    await expect(card).toContainText('฿4,500.00');

    const marker = `E2E Edit Repay ${Date.now().toString().slice(-6)}`;
    await card.locator('button[id^="open-repay-modal-"]').click();
    await page.locator('#repay-amount-math').fill('500');
    await page.locator('input[id$="-desc"]').fill(marker);
    await page.locator('#confirm-repay-btn').click();
    await expect(page.locator('#repay-wallet-select')).toHaveCount(0);
    await expect(card).toContainText('฿4,000.00');

    await gotoTab(page, 'transactions');
    await page.locator('button[id^="tx-row-"]').filter({ hasText: marker }).click();
    // Its money is shown, not offered.
    await expect(page.locator('#tx-edit-description')).toHaveValue(marker);
    await expect(page.locator('#tx-edit-amount')).toHaveCount(0);
    await expect(page.locator('#tx-edit-wallet')).toHaveCount(0);

    const renamed = `${marker} (Sept)`;
    await page.locator('#tx-edit-description').fill(renamed);
    await page.locator('button[id^="tx-save-btn-"]').click();
    await expect(page.locator('button[id^="tx-row-"]').filter({ hasText: renamed })).toBeVisible();

    await gotoTab(page, 'debts');
    await expect(card).toContainText('฿4,000.00');
  });
});
