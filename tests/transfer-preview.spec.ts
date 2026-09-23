import { test, expect, type Page } from '@playwright/test';

/**
 * Visual transfer layout and live balance preview (ADR 0014).
 *
 * `wallet-forms.spec.ts` remains the regression guard for the transfer flow
 * itself - it passes unedited through this redesign, which is the whole reason
 * the wallet `<select>`s were kept as real, visible form controls rather than
 * replaced with cards. This spec covers only what the redesign added.
 *
 * Seeded wallets (FinanceContext's defaults): Main Checking ฿2,500.00,
 * Cash Wallet ฿150.00, Savings Reserve ฿5,000.00. The form seeds its source to
 * wallets[0] (Main Checking) and its destination to the first wallet that is
 * not the source (Cash Wallet).
 */

const SOURCE_AFTER = 'transfer-balance-after-source';
const DEST_AFTER = 'transfer-balance-after-dest';

async function openTransfer(page: Page) {
  // The dashboard hero button, so there is no navigation between the click and
  // the assertion - the same reachability property ADR 0008 cites.
  await page.locator('#hero-transfer-funds-btn').click();
  const modal = page.getByRole('dialog', { name: /Transfer Funds/i });
  await expect(modal).toBeVisible();
  return modal;
}

test.describe('Transfer balance preview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('typing an amount previews both balances after the transfer', async ({ page }) => {
    const modal = await openTransfer(page);

    // Seeded defaults, asserted rather than assumed - the arithmetic below
    // depends on them.
    await expect(modal.locator('#transfer-source-wallet')).toHaveValue('wal-main-checking');
    await expect(modal.locator('#transfer-dest-wallet')).toHaveValue('wal-cash');

    // No amount yet, so there is nothing to project.
    await expect(modal.getByTestId(SOURCE_AFTER)).toHaveCount(0);

    await modal.locator('#transfer-amount-math').fill('400');

    // ฿2,500.00 − ฿400.00 and ฿150.00 + ฿400.00.
    await expect(modal.getByTestId(SOURCE_AFTER)).toHaveText('฿2,100.00');
    await expect(modal.getByTestId(DEST_AFTER)).toHaveText('฿550.00');
  });

  test('clearing the amount removes the projection', async ({ page }) => {
    const modal = await openTransfer(page);
    const amount = modal.locator('#transfer-amount-math');

    await amount.fill('400');
    await expect(modal.getByTestId(SOURCE_AFTER)).toHaveText('฿2,100.00');

    await amount.fill('');

    await expect(modal.getByTestId(SOURCE_AFTER)).toHaveCount(0);
    await expect(modal.getByTestId(DEST_AFTER)).toHaveCount(0);
    // The panels still show the untouched balances.
    await expect(modal.getByTestId('transfer-panel-source')).toContainText('฿2,500.00');
  });

  test('an inline math expression drives the preview too', async ({ page }) => {
    const modal = await openTransfer(page);

    await modal.locator('#transfer-amount-math').fill('1000/4');

    // 250 evaluated, not the literal text.
    await expect(modal.getByTestId(SOURCE_AFTER)).toHaveText('฿2,250.00');
    await expect(modal.getByTestId(DEST_AFTER)).toHaveText('฿400.00');
  });

  test('the swap button exchanges source and destination', async ({ page }) => {
    const modal = await openTransfer(page);
    const src = modal.locator('#transfer-source-wallet');
    const dst = modal.locator('#transfer-dest-wallet');

    await modal.locator('#transfer-swap-btn').click();

    await expect(src).toHaveValue('wal-cash');
    await expect(dst).toHaveValue('wal-main-checking');

    // The panels follow the selects, so the preview describes the wallets the
    // user is actually looking at.
    await modal.locator('#transfer-amount-math').fill('50');
    await expect(modal.getByTestId(SOURCE_AFTER)).toHaveText('฿100.00');
    await expect(modal.getByTestId(DEST_AFTER)).toHaveText('฿2,550.00');
  });

  /**
   * Before this redesign the destination `<select>` merely filtered the source
   * out of its options, so choosing the destination's wallet as the source left
   * `destWalletId` pointing at a wallet no longer in the list. Harmless while
   * nothing rendered it; a live preview would have shown balances for a wallet
   * the user had not selected.
   */
  test('choosing the other side as the source swaps instead of desyncing', async ({ page }) => {
    const modal = await openTransfer(page);
    const src = modal.locator('#transfer-source-wallet');
    const dst = modal.locator('#transfer-dest-wallet');

    await src.selectOption('wal-cash');

    await expect(src).toHaveValue('wal-cash');
    await expect(dst).toHaveValue('wal-main-checking');
    expect(await src.inputValue()).not.toBe(await dst.inputValue());
  });

  /**
   * Deliberately non-blocking: a CREDIT_CARD wallet legitimately carries a
   * negative balance, so the preview warns and lets the transfer proceed. This
   * pins that decision so a later phase cannot quietly turn it into a hard gate.
   */
  test('an overdrawing amount warns but does not block submission', async ({ page }) => {
    const modal = await openTransfer(page);

    // Cash Wallet holds ฿150.00. Selecting it as the source swaps the sides.
    await modal.locator('#transfer-source-wallet').selectOption('wal-cash');
    await modal.locator('#transfer-amount-math').fill('500');

    const warning = modal.getByTestId('transfer-overdraft-warning');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('฿350.00');
    await expect(warning).toContainText('Cash Wallet');

    // The point of the test: still submittable.
    await expect(modal.locator('#execute-transfer-btn')).toBeEnabled();
  });

  test('"Transfer all" fills the amount with the whole source balance', async ({ page }) => {
    const modal = await openTransfer(page);

    await modal.locator('#transfer-all-chip').click();

    await expect(modal.locator('#transfer-amount-math')).toHaveValue('2500');
    await expect(modal.getByTestId(SOURCE_AFTER)).toHaveText('฿0.00');
    await expect(modal.getByTestId(DEST_AFTER)).toHaveText('฿2,650.00');
    // Emptying a wallet is not an overdraft.
    await expect(modal.getByTestId('transfer-overdraft-warning')).toHaveCount(0);
  });
});
