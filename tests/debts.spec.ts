import { test, expect } from '@playwright/test';
import { gotoTab } from './helpers';

/**
 * Characterizes the debt payoff lifecycle end-to-end: creating a goal, a
 * partial repayment updating its progress bar, and a second repayment that
 * exhausts the remaining balance and auto-settles it.
 *
 * `repayDebtAtomic` (FinanceContext.tsx) records the repayment as a normal
 * DEBT_REPAYMENT transaction and separately decrements the debt's
 * remainingAmount, auto-flipping isSettled the moment it reaches zero - this
 * spec exists to pin that behavior before any T13-T15 context refactor or
 * T29's wallet-filtering fix touches this view.
 */
test.describe('Debt payoff lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('create a debt, apply a partial repayment, then fully settle it', async ({ page }) => {
    await gotoTab(page, 'debts');

    // 1. Create a debt goal, accepting the form's own defaults (5,000 total /
    // remaining, 4.5% APR, 200 minimum payment) aside from a unique name.
    await page.locator('#open-add-debt-btn').click();
    const debtName = `E2E Payoff Goal ${Date.now().toString().slice(-6)}`;
    const nameInput = page.locator('#new-debt-name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill(debtName);
    await page.locator('#save-new-debt-btn').click();

    const card = page.locator('div[id^="debt-card-"]').filter({ hasText: debtName });
    await expect(card).toBeVisible();
    await expect(card).toContainText('฿5,000.00');
    await expect(card).toContainText('4.5% APR');

    // 2. Partial repayment: pay 1,000 of the 5,000 total.
    await card.locator('button[id^="open-repay-modal-"]').click();
    const amountInput = page.locator('#repay-amount-math');
    await expect(amountInput).toBeVisible();
    await amountInput.fill('1000');
    await page.locator('#confirm-repay-btn').click();

    // The modal closes on success - its own inputs stop being reachable.
    await expect(page.locator('#repay-wallet-select')).toHaveCount(0);

    // Progress bar and remaining balance both reflect the partial payment.
    await expect(card).toContainText('20.0%');
    await expect(card).toContainText('฿4,000.00');
    // Still open - the goal isn't settled yet.
    await expect(card.locator('button[id^="open-repay-modal-"]')).toBeVisible();

    // 3. Second repayment covers the remaining 4,000 exactly - the debt
    // auto-settles the moment remainingAmount hits zero.
    await card.locator('button[id^="open-repay-modal-"]').click();
    await page.locator('#repay-amount-math').fill('4000');
    await page.locator('#confirm-repay-btn').click();
    await expect(page.locator('#repay-wallet-select')).toHaveCount(0);

    await expect(card).toContainText('100% Fully Settled!');
    await expect(card).toContainText('✓ Debt Fully Settled');
    await expect(card.locator('button[id^="open-repay-modal-"]')).toHaveCount(0);
    await expect(card.locator('button[id^="settle-debt-"]')).toHaveCount(0);
  });
});
