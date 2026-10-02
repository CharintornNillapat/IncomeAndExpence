import { test, expect } from '@playwright/test';
import { gotoTab, addQuickTransaction, seedLedger, SAMPLE_WALLETS } from './helpers';

/**
 * Phase 52 (ADR 0024) end to end: the five-slot mobile nav and its More sheet,
 * the Account & Security modal that replaced the Security tab, the guest-data
 * notice at sign-in, and two ledger fixes that a user sees - a downward
 * balance adjustment lowers the balance, and a new wallet's opening balance is
 * a ledger row.
 *
 * Intercepts no requests. Everything runs as a guest, like every other spec.
 *
 * Deliberately absent: the swipe guard. A Chromium swipe synthesised through
 * the DevTools protocol that starts inside an overflowing scroller is consumed
 * by the browser's own scrolling and never completes as a swipe - with the
 * guard removed as much as with it - so an end-to-end test of it could only
 * pass vacuously. The guard is covered by `unit/swipe-guard.test.ts`; its
 * effect on real iOS/Android touch hardware is unverified (ADR 0024).
 */

const PHONE = { width: 390, height: 844 };

test.describe('mobile navigation (five slots)', () => {
  test.use({ viewport: PHONE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows Home, Transactions, a centre Quick Add, Wallets and More - and nothing else', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Mobile Navigation' });
    await expect(nav.locator('#mobile-nav-tab-dashboard')).toBeVisible();
    await expect(nav.locator('#mobile-nav-tab-transactions')).toBeVisible();
    await expect(nav.locator('#mobile-nav-quick-add-btn')).toBeVisible();
    await expect(nav.locator('#mobile-nav-tab-wallets')).toBeVisible();
    await expect(nav.locator('#mobile-nav-more-btn')).toBeVisible();
    // The three tabs that moved live in the More sheet, not the bar.
    await expect(nav.locator('#mobile-nav-tab-debts')).toHaveCount(0);
    await expect(page.locator('#mobile-nav-tab-security')).toHaveCount(0);
    await expect(nav.locator('#mobile-nav-tab-dashboard')).toHaveAttribute('aria-current', 'page');
  });

  for (const tab of ['debts', 'diary', 'categories'] as const) {
    test(`More reaches ${tab}, and marks it current`, async ({ page }) => {
      await page.locator('#mobile-nav-more-btn').click();
      const sheet = page.getByRole('dialog', { name: 'More' });
      await expect(sheet).toBeVisible();
      await sheet.locator(`#mobile-nav-tab-${tab}`).click();
      await expect(sheet).not.toBeVisible();
      await expect(page.locator('#view-loading-fallback')).toHaveCount(0);

      // The More slot stands in for the tab it holds...
      await expect(page.locator('#mobile-nav-more-btn')).toHaveAttribute('data-active', 'true');
      // ...and the tab itself is current when the sheet is reopened.
      await page.locator('#mobile-nav-more-btn').click();
      await expect(page.locator(`#mobile-nav-tab-${tab}`)).toHaveAttribute('aria-current', 'page');
    });
  }

  test('the centre button opens Quick Add', async ({ page }) => {
    await page.locator('#mobile-nav-quick-add-btn').click();
    await expect(page.getByRole('dialog', { name: /Quick Record Transaction/i })).toBeVisible();
  });

  test('More reaches Account & Security, which describes guest mode', async ({ page }) => {
    await page.locator('#mobile-nav-more-btn').click();
    await page.locator('#mobile-nav-account-btn').click();
    const modal = page.locator('#account-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('#account-status-card')).toContainText('Guest mode');
    await expect(modal.locator('#account-signin-btn')).toBeVisible();
    // Sessions are an account feature; a guest has none to show.
    await expect(modal.locator('#account-sessions')).toHaveCount(0);
  });
});

test.describe('Account & Security on desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('left the tab bar and opens from the navbar instead', async ({ page }) => {
    await expect(page.locator('#nav-tab-security')).toHaveCount(0);
    await page.locator('#navbar-account-btn').click();
    await expect(page.locator('#account-modal')).toBeVisible();
    await expect(page.locator('#account-status-card')).toContainText('Guest mode');
  });

  test('its Sign in button hands over to the sign-in modal', async ({ page }) => {
    await page.locator('#navbar-account-btn').click();
    await page.locator('#account-signin-btn').click();
    await expect(page.locator('#account-modal')).not.toBeVisible();
    await expect(page.locator('#auth-email-input')).toBeVisible();
  });
});

test.describe('the guest-data notice at sign-in (F5 policy)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('does not appear while the guest ledger is empty', async ({ page }) => {
    await page.locator('#navbar-signin-btn').click();
    await expect(page.locator('#auth-email-input')).toBeVisible();
    await expect(page.locator('#auth-guest-data-notice')).toHaveCount(0);
  });

  test('says how many guest transactions sign-in will replace, and offers an export', async ({ page }) => {
    await addQuickTransaction(page, 'E2E guest notice');
    await page.locator('#navbar-signin-btn').click();

    const notice = page.locator('#auth-guest-data-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('1 guest transaction');
    await expect(notice).toContainText('not merged');

    const download = page.waitForEvent('download');
    await notice.locator('#auth-guest-export-btn').click();
    expect((await download).suggestedFilename()).toMatch(/^transactions_export_\d{4}-\d{2}-\d{2}\.csv$/);
  });
});

test.describe('ledger fixes a user can see (ADR 0024)', () => {
  test.beforeEach(async ({ page }) => {
    // The starters open at ฿0.00 (ADR 0040); lowering a balance needs one to lower.
    await seedLedger(page, { wallets: SAMPLE_WALLETS });
    await page.goto('/');
  });

  test('lowering a balance in the wallet editor lowers it', async ({ page }) => {
    // The sample checking account holds ฿2,500.00. The editor used to
    // write |diff| as a credit, so setting ฿2,000 produced ฿3,000.
    await page.locator('#dashboard-wallet-card-wal-main-checking').click();
    await page.locator('#wallet-adjust-btn-wal-main-checking').click();
    await page.locator('#wallet-adjust-input').fill('2000');
    await page.locator('#wallet-adjust-save-btn').click();

    // Phase 59 (ADR 0034): the card opens the Wallets page with this wallet selected.
    await expect(page.locator('#wallet-detail-balance')).toHaveText('฿2,000.00');
  });

  test('a new wallet\'s opening balance is a ledger row (F7)', async ({ page }) => {
    await page.locator('#hero-add-wallet-btn').click();
    await page.locator('#new-wallet-name').fill('E2E Opening Vault');
    await page.locator('#new-wallet-init-balance').fill('900');
    await page.locator('#save-new-wallet-btn').click();
    await expect(page.getByText('E2E Opening Vault').first()).toBeVisible();

    await gotoTab(page, 'transactions');
    const row = page.locator('button[id^="tx-row-"]').filter({ hasText: 'Opening balance' });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('฿900.00');
  });
});
