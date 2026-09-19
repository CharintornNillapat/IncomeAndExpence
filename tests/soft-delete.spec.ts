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
});
