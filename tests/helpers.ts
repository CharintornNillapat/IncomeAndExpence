import { expect, type Page } from '@playwright/test';
import type { Debt, Wallet } from '../src/types';

/**
 * Navigates to a top-level tab and waits for its view to finish mounting.
 *
 * Every view in `App.tsx` is a `React.lazy` import, so clicking a tab kicks off
 * a dynamic chunk fetch before the view renders. Under the Vite dev server with
 * parallel workers that fetch can take noticeably longer in Firefox, which is
 * what made the navigation specs flaky.
 *
 * Each step here is an auto-retrying assertion:
 *   1. the tab exists and is clickable,
 *   2. the tab actually became active (the app has committed the state change),
 *   3. the lazy-loading fallback has detached (the chunk resolved).
 *
 * The previous `if (await tab.isVisible())` guard was a single non-retrying
 * probe - if the navbar had not painted yet it silently skipped the whole
 * block, so the test passed without asserting anything.
 */
export async function gotoTab(page: Page, tabId: string): Promise<void> {
  const tab = page.locator(`#nav-tab-${tabId}`);
  await expect(tab).toBeVisible();
  await tab.click();

  // The active tab carries `aria-current="page"` (T31) - a semantic
  // attribute, not a Tailwind class, so a restyle of the active-tab fill
  // cannot silently break every navigation in the suite the way asserting
  // on `bg-stone-900` could.
  await expect(tab).toHaveAttribute('aria-current', 'page');

  // Suspense fallback is removed once the lazy chunk has resolved.
  await expect(page.locator('#view-loading-fallback')).toHaveCount(0);
}

const SEED_STAMP = new Date().toISOString();

/**
 * The guest starter wallets as they were before Phase 54 (ADR 0040): same ids,
 * names, order and colours, holding ฿7,650 in all. The app now opens them at
 * ฿0.00, so a spec that needs money in them seeds this through `seedLedger`.
 */
export const SAMPLE_WALLETS: Wallet[] = [
  {
    id: 'wal-main-checking',
    userId: 'usr-guest-01',
    name: 'Main Checking',
    type: 'BANK_ACCOUNT',
    currency: 'THB',
    balance: 2500,
    color: '#6C8EEF',
    icon: 'landmark',
    isArchived: false,
    isDeleted: false,
    createdAt: SEED_STAMP,
    updatedAt: SEED_STAMP,
  },
  {
    id: 'wal-cash',
    userId: 'usr-guest-01',
    name: 'Cash Wallet',
    type: 'CASH',
    currency: 'THB',
    balance: 150,
    color: '#D9A066',
    icon: 'banknote',
    isArchived: false,
    isDeleted: false,
    createdAt: SEED_STAMP,
    updatedAt: SEED_STAMP,
  },
  {
    id: 'wal-savings',
    userId: 'usr-guest-01',
    name: 'Savings Reserve',
    type: 'SAVINGS',
    currency: 'THB',
    balance: 5000,
    color: '#4FB7A8',
    icon: 'piggy-bank',
    isArchived: false,
    isDeleted: false,
    createdAt: SEED_STAMP,
    updatedAt: SEED_STAMP,
  },
];

/**
 * The starter debt the app seeded before Phase 54 (ADR 0040): ฿4,500 left of
 * ฿10,000. A fresh context now has no debt, so a spec that repays, settles or
 * edits one seeds this through `seedLedger`.
 */
export const SAMPLE_STUDENT_LOAN: Debt = {
  id: 'debt-starter-01',
  userId: 'usr-guest-01',
  name: 'Student Loan',
  totalAmount: 10000,
  remainingAmount: 4500,
  interestRate: 4.5,
  minimumPayment: 250,
  dueDate: '2026-12-31',
  isSettled: false,
  isDeleted: false,
  createdAt: SEED_STAMP,
  updatedAt: SEED_STAMP,
};

/**
 * Seeds the guest ledger before the app first loads. **Call it before
 * `page.goto`**: it registers an init script, which runs ahead of the page's
 * own scripts on every navigation of this page.
 *
 * It writes only once per context, behind the `pf_seeded` marker, so a
 * `page.reload()` keeps whatever the test saved instead of re-seeding over it.
 * A slice left out keeps the app's own default (three ฿0.00 wallets, no debt).
 */
export async function seedLedger(
  page: Page,
  { wallets, debts }: { wallets?: Wallet[]; debts?: Debt[] }
): Promise<void> {
  await page.addInitScript(
    ({ wallets, debts }) => {
      if (localStorage.getItem('pf_seeded') !== null) return;
      if (wallets) localStorage.setItem('pf_wallets', JSON.stringify(wallets));
      if (debts) localStorage.setItem('pf_debts', JSON.stringify(debts));
      localStorage.setItem('pf_seeded', '1');
    },
    { wallets: wallets ?? null, debts: debts ?? null }
  );
}

/**
 * Records a transaction through the navbar Quick Add modal.
 *
 * A fresh browser context has three ฿0.00 wallets, no debts and no
 * transactions (ADR 0040), so any test that needs a populated ledger has to
 * create one first, and a test that needs money or a debt seeds it with
 * `seedLedger` before `goto`.
 *
 * F7 (ADR 0024): a wallet the USER creates with a non-zero starting balance
 * opens with an ADJUSTMENT "Opening balance" row, so a spec that creates one
 * also creates one transaction. The starter wallets open at ฿0.00 and carry
 * none.
 */
export async function addQuickTransaction(
  page: Page,
  description: string,
  amount = '150'
): Promise<void> {
  await page.locator('#navbar-quick-add-btn').click();

  const modal = page.getByRole('dialog', { name: /Quick Record Transaction/i });
  await expect(modal).toBeVisible();

  await modal.locator('input[name="amount_expression"]').fill(amount);

  const walletSelect = modal.locator('select[id$="-wallet"]');
  await expect(walletSelect).toBeVisible();
  const optionsCount = await walletSelect.locator('option').count();
  await walletSelect.selectOption({ index: optionsCount > 1 ? 1 : 0 });

  await modal
    .locator('input[id$="-desc"]')
    .fill(description);

  await modal.locator('button[type="submit"]').click();

  // The modal closing is the app's own confirmation that the write succeeded.
  await expect(modal).not.toBeVisible();
}
