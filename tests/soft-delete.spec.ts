import { test, expect } from '@playwright/test';
import { gotoTab, addQuickTransaction } from './helpers';

/**
 * Every delete in this app is a soft delete (`isDeleted: true`), never a row
 * removal - CLAUDE.md's Data Integrity rule. This spec pins that contract
 * across the three entities that expose a delete action in the UI: the
 * record must disappear from the active view, and where a "show deleted"
 * toggle exists (transactions), switching it on must reveal the same record
 * flagged rather than gone, with a restore path back to active. Wallets and
 * debts have no such toggle, so their omission is instead verified to
 * survive a reload - proving the flag was actually persisted, not just held
 * in the current render's filtered array.
 */
test.describe('Soft-delete lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('transaction: soft-delete hides it, the toggle reveals it, restore brings it back', async ({ page }) => {
    const marker = `E2E SoftDelete Tx ${Date.now().toString().slice(-6)}`;
    await addQuickTransaction(page, marker);
    await gotoTab(page, 'transactions');

    const row = page.locator('tr[id^="tx-row-"]').filter({ hasText: marker });
    await expect(row).toBeVisible();

    await row.locator('button[id^="tx-delete-btn-"]').click();
    // Default view (Show Soft Deleted unchecked) excludes deleted rows entirely.
    await expect(page.locator('tr[id^="tx-row-"]').filter({ hasText: marker })).toHaveCount(0);

    // The record still exists - it is flagged, not gone. The toggle reveals it.
    const showDeletedToggle = page.locator('#tx-show-deleted');
    await expect(showDeletedToggle).not.toBeChecked();
    await showDeletedToggle.check();

    const deletedRow = page.locator('tr[id^="tx-row-"]').filter({ hasText: marker });
    await expect(deletedRow).toBeVisible();
    await expect(deletedRow.getByText('[Soft Deleted]')).toBeVisible();

    const restoreBtn = deletedRow.locator('button[id^="tx-restore-btn-"]');
    await expect(restoreBtn).toBeVisible();
    await restoreBtn.click();

    // Restored: no longer flagged, while the toggle is still on.
    await expect(deletedRow.getByText('[Soft Deleted]')).toHaveCount(0);

    // Turning the toggle back off still shows it - it is active again, not deleted.
    await showDeletedToggle.uncheck();
    await expect(page.locator('tr[id^="tx-row-"]').filter({ hasText: marker })).toBeVisible();
  });

  test('wallet: soft-delete removes it from the active grid and survives a reload', async ({ page }) => {
    await gotoTab(page, 'wallets');
    await page.locator('#wallet-add-modal-btn').click();

    const walletName = `E2E SoftDelete Wallet ${Date.now().toString().slice(-6)}`;
    await page.locator('#new-wallet-name').fill(walletName);
    await page.locator('#save-new-wallet-btn').click();

    const card = page.locator('div[id^="wallet-entity-"]').filter({ hasText: walletName });
    await expect(card).toBeVisible();

    await card.locator('button[id^="delete-wallet-"]').click();
    // T42: deletion now gates behind a confirmation dialog.
    await page.locator('#confirm-destructive-btn').click();
    await expect(page.locator('div[id^="wallet-entity-"]').filter({ hasText: walletName })).toHaveCount(0);

    await page.reload();
    await gotoTab(page, 'wallets');
    await expect(page.locator('div[id^="wallet-entity-"]').filter({ hasText: walletName })).toHaveCount(0);
  });

  test('debt: soft-delete removes it from the goals grid and survives a reload', async ({ page }) => {
    await gotoTab(page, 'debts');
    await page.locator('#open-add-debt-btn').click();

    const debtName = `E2E SoftDelete Debt ${Date.now().toString().slice(-6)}`;
    await page.locator('#new-debt-name').fill(debtName);
    await page.locator('#save-new-debt-btn').click();

    const card = page.locator('div[id^="debt-card-"]').filter({ hasText: debtName });
    await expect(card).toBeVisible();

    await card.locator('button[id^="delete-debt-"]').click();
    // T42: deletion now gates behind a confirmation dialog.
    await page.locator('#confirm-destructive-btn').click();
    await expect(page.locator('div[id^="debt-card-"]').filter({ hasText: debtName })).toHaveCount(0);

    await page.reload();
    await gotoTab(page, 'debts');
    await expect(page.locator('div[id^="debt-card-"]').filter({ hasText: debtName })).toHaveCount(0);
  });

  test('transaction soft-delete and restore reverses and reapplies its exact effect on wallet balance', async ({ page }) => {
    const marker = `E2E Balance Invariant ${Date.now().toString().slice(-6)}`;

    // Seeded default wallets are Main Checking (฿2,500), Cash Wallet (฿150),
    // Savings Reserve (฿5,000) - `addQuickTransaction` selects the 2nd
    // <option> in the Quick Add wallet select whenever more than one wallet
    // exists, which is Cash Wallet (`wal-cash`). Asserting against this one
    // wallet's own card (not a dashboard total) keeps the test independent
    // of any other wallet's balance and of AnimatedCounter's own render
    // strategy - only its settled text content is asserted, never a
    // render count, so a later change there cannot break this spec.
    await gotoTab(page, 'wallets');
    const cashWalletCard = page.locator('#wallet-entity-wal-cash');
    const balance = cashWalletCard.locator('div.text-2xl.font-bold.font-mono');
    await expect(balance).toContainText('฿150.00');

    // A ฿150 EXPENSE against Cash Wallet must drop its balance to exactly ฿0.00.
    await addQuickTransaction(page, marker);
    await gotoTab(page, 'wallets');
    await expect(balance).toContainText('฿0.00');
    await expect(balance).not.toContainText('฿150.00');

    // Soft-deleting the expense must reverse its effect: the balance returns
    // to exactly ฿150.00, not merely "no longer zero."
    await gotoTab(page, 'transactions');
    const row = page.locator('tr[id^="tx-row-"]').filter({ hasText: marker });
    await expect(row).toBeVisible();
    await row.locator('button[id^="tx-delete-btn-"]').click();

    await gotoTab(page, 'wallets');
    await expect(balance).toContainText('฿150.00');

    // Restoring the transaction must reapply the expense: the balance drops
    // back to exactly ฿0.00.
    await gotoTab(page, 'transactions');
    await page.locator('#tx-show-deleted').check();
    const deletedRow = page.locator('tr[id^="tx-row-"]').filter({ hasText: marker });
    await expect(deletedRow).toBeVisible();
    await deletedRow.locator('button[id^="tx-restore-btn-"]').click();

    await gotoTab(page, 'wallets');
    await expect(balance).toContainText('฿0.00');
  });

  /*
   * ADR 0016. The test above uses an EXPENSE, which is why the debt half of
   * this invariant went unnoticed until Phase 44: `setTransactionDeleted` had
   * no debt handling at all, so soft-deleting a repayment refunded the wallet
   * and kept the debt reduction (free money, repeatable), while restoring
   * debited the wallet again with no debt movement (paid twice for one
   * reduction). These two cases are what would have caught it.
   */
  test('debt repayment soft-delete and restore reverses and reapplies the debt reduction', async ({ page }) => {
    await gotoTab(page, 'debts');

    // The seeded Student Loan: ฿4,500 remaining of a ฿10,000 target, so
    // 55.0% paid off before anything in this test happens.
    const card = page.locator('div[id^="debt-card-"]').filter({ hasText: 'Student Loan' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('฿4,500.00');
    await expect(card).toContainText('55.0%');

    const marker = `E2E Debt Invariant ${Date.now().toString().slice(-6)}`;
    await card.locator('button[id^="open-repay-modal-"]').click();
    await page.locator('#repay-amount-math').fill('500');
    await page.locator('input[id$="-desc"]').fill(marker);
    await page.locator('#confirm-repay-btn').click();
    await expect(page.locator('#repay-wallet-select')).toHaveCount(0);

    // ฿4,500 - ฿500 = ฿4,000 remaining, 60.0% paid off.
    await expect(card).toContainText('฿4,000.00');
    await expect(card).toContainText('60.0%');

    // Soft-deleting must give the debt back exactly, not merely "more than
    // ฿4,000" - this is the assertion the missing handling failed.
    await gotoTab(page, 'transactions');
    const row = page.locator('tr[id^="tx-row-"]').filter({ hasText: marker });
    await expect(row).toBeVisible();
    await row.locator('button[id^="tx-delete-btn-"]').click();

    await gotoTab(page, 'debts');
    await expect(card).toContainText('฿4,500.00');
    await expect(card).toContainText('55.0%');

    // Restoring must reapply it exactly.
    await gotoTab(page, 'transactions');
    await page.locator('#tx-show-deleted').check();
    const deletedRow = page.locator('tr[id^="tx-row-"]').filter({ hasText: marker });
    await expect(deletedRow).toBeVisible();
    await deletedRow.locator('button[id^="tx-restore-btn-"]').click();

    await gotoTab(page, 'debts');
    await expect(card).toContainText('฿4,000.00');
    await expect(card).toContainText('60.0%');
  });

  test('soft-deleting the repayment that settled a debt un-settles it', async ({ page }) => {
    await gotoTab(page, 'debts');

    const card = page.locator('div[id^="debt-card-"]').filter({ hasText: 'Student Loan' });
    await expect(card).toBeVisible();

    // Clear the whole ฿4,500 remainder, which auto-settles the debt.
    const marker = `E2E Settle Reverse ${Date.now().toString().slice(-6)}`;
    await card.locator('button[id^="open-repay-modal-"]').click();
    await page.locator('#repay-payoff-full').click();
    await page.locator('input[id$="-desc"]').fill(marker);
    await page.locator('#confirm-repay-btn').click();
    await expect(page.locator('#repay-wallet-select')).toHaveCount(0);

    await expect(card).toContainText('✓ Debt Fully Settled');
    await expect(card.locator('button[id^="open-repay-modal-"]')).toHaveCount(0);

    // Reversing the payment must un-settle it: `isSettled` is recomputed in
    // both directions, so the card becomes actionable again rather than
    // staying settled against a non-zero balance.
    await gotoTab(page, 'transactions');
    const row = page.locator('tr[id^="tx-row-"]').filter({ hasText: marker });
    await expect(row).toBeVisible();
    await row.locator('button[id^="tx-delete-btn-"]').click();

    await gotoTab(page, 'debts');
    await expect(card).not.toContainText('✓ Debt Fully Settled');
    await expect(card).toContainText('฿4,500.00');
    await expect(card.locator('button[id^="open-repay-modal-"]')).toBeVisible();
  });
});
