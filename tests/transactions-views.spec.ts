import { expect, test, type Page } from '@playwright/test';
import type { Transaction } from '../src/types';
import { gotoTab, SAMPLE_WALLETS, seedLedger, settle } from './helpers';

const SEED_WALLETS = SAMPLE_WALLETS.map((w) =>
  w.id === 'wal-main-checking' ? { ...w, balance: 50000 } : w
);

const SEED_BASE_TIME = Date.parse('2026-10-16T12:00:00.000Z');

function createTx(
  id: string,
  type: Transaction['type'],
  amount: number,
  transactionDate: string,
  categoryId: string | undefined,
  description: string,
  index: number,
  destinationWalletId?: string
): Transaction {
  const stamp = new Date(SEED_BASE_TIME + index * 1000).toISOString();
  return {
    id,
    userId: 'usr-guest-01',
    walletId: 'wal-main-checking',
    destinationWalletId,
    categoryId,
    amount,
    type,
    description,
    transactionDate,
    isDeleted: false,
    createdBy: 'usr-guest-01',
    createdAt: stamp,
    updatedAt: stamp,
  };
}

const STANDARD_TXS: Transaction[] = [
  createTx('tx-e2e-v-sep', 'EXPENSE', 900, '2026-09-20', 'cat-food', 'E2E September Lunch', 1),
  createTx('tx-e2e-v-salary', 'INCOME', 10000, '2026-10-01', 'cat-salary', 'E2E Salary', 2),
  createTx('tx-e2e-v-dinner', 'EXPENSE', 2500, '2026-10-10', 'cat-food', 'E2E Dinner', 3),
  createTx('tx-e2e-v-snacks', 'EXPENSE', 500, '2026-10-10', 'cat-groceries', 'E2E Snacks', 4),
  createTx('tx-e2e-v-move', 'TRANSFER', 400, '2026-10-12', undefined, 'E2E Move to Cash', 5, 'wal-cash'),
  createTx('tx-e2e-v-taxi', 'EXPENSE', 1500, '2026-10-13', 'cat-transport', 'E2E Taxi', 6),
  createTx('tx-e2e-v-bus', 'EXPENSE', 300, '2026-10-14', 'cat-transport', 'E2E Bus', 7),
  createTx('tx-e2e-v-coffee', 'EXPENSE', 120, '2026-10-16', 'cat-food', 'E2E Coffee', 8),
  createTx('tx-e2e-v-future', 'EXPENSE', 200, '2026-10-20', 'cat-food', 'E2E Future', 9),
];

const BULK_30_TXS: Transaction[] = Array.from({ length: 30 }, (_, i) => {
  const num = String(i + 1).padStart(2, '0');
  return createTx(
    `tx-e2e-v-bulk-${num}`,
    'EXPENSE',
    10,
    '2026-10-05',
    'cat-food',
    `E2E Bulk Row ${num}`,
    i + 1
  );
});

const DIARY_SEED = {
  id: 'diary-e2e-v-1',
  userId: 'usr-guest-01',
  date: '2026-10-10',
  mood: 4,
  workout: false,
  foodQuality: 'AVERAGE',
  isDeleted: false,
  createdAt: new Date(SEED_BASE_TIME).toISOString(),
  updatedAt: new Date(SEED_BASE_TIME).toISOString(),
};

async function seedTransactions(
  page: Page,
  { transactions, diary }: { transactions: Transaction[]; diary?: unknown[] }
): Promise<void> {
  await seedLedger(page, { wallets: SEED_WALLETS });
  await page.addInitScript(
    ({ transactions, diary }) => {
      if (localStorage.getItem('pf_e2e_tx_seeded') !== null) return;
      localStorage.setItem('pf_transactions', JSON.stringify(transactions));
      if (diary) {
        localStorage.setItem('pf_diary', JSON.stringify(diary));
      }
      localStorage.setItem('pf_e2e_tx_seeded', '1');
    },
    { transactions, diary: diary ?? null }
  );
}

async function gotoTransactions(page: Page): Promise<void> {
  const mobileTab = page.locator('#mobile-nav-tab-transactions');
  if (await mobileTab.isVisible()) {
    await settle(page);
    await mobileTab.click();
    await expect(mobileTab).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#view-loading-fallback')).toHaveCount(0);
    await settle(page);
  } else {
    await gotoTab(page, 'transactions');
  }
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const hasScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(hasScroll).toBe(false);
}

test.describe('Transactions views', () => {
  test.use({ timezoneId: 'Asia/Bangkok' });

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-16T15:00:00+07:00'));
  });

  test.describe('view switch and memory', () => {
    test('1. defaults to the Table and the tablist reflects it', async ({ page }) => {
      await seedTransactions(page, { transactions: STANDARD_TXS });
      await page.goto('/');
      await gotoTab(page, 'transactions');

      const tableTab = page.locator('#tx-view-table');
      const calendarTab = page.locator('#tx-view-calendar');
      const viewPanel = page.locator('#tx-view-panel');

      await expect(tableTab).toHaveRole('tab');
      await expect(tableTab).toHaveAttribute('aria-selected', 'true');
      await expect(calendarTab).toHaveRole('tab');
      await expect(calendarTab).toHaveAttribute('aria-selected', 'false');
      await expect(viewPanel).toHaveRole('tabpanel');
      await expect(viewPanel).toHaveAttribute('aria-labelledby', 'tx-view-table');
      await expect(page.locator('table')).toBeVisible();
      await expect(page.locator('#tx-cal-heading')).toHaveCount(0);

      await calendarTab.click();

      await expect(calendarTab).toHaveAttribute('aria-selected', 'true');
      await expect(tableTab).toHaveAttribute('aria-selected', 'false');
      await expect(viewPanel).toHaveAttribute('aria-labelledby', 'tx-view-calendar');
      await expect(page.locator('#tx-cal-heading')).toHaveText('October 2026');
      await expect(page.locator('table')).toHaveCount(0);
      await expect(page.locator('#tx-filter-range')).toHaveCount(0);

      const stored = await page.evaluate(() => localStorage.getItem('pf_tx_view'));
      expect(stored).toBe('calendar');
    });

    test('2. remembers the last view per device and falls back to the Table', async ({ page }) => {
      await seedTransactions(page, { transactions: STANDARD_TXS });
      await page.goto('/');
      await gotoTab(page, 'transactions');

      await page.locator('#tx-view-calendar').click();
      await page.reload();
      await gotoTab(page, 'transactions');
      await expect(page.locator('#tx-view-calendar')).toHaveAttribute('aria-selected', 'true');

      await page.locator('#tx-view-table').click();
      await page.reload();
      await gotoTab(page, 'transactions');
      await expect(page.locator('#tx-view-table')).toHaveAttribute('aria-selected', 'true');

      await page.evaluate(() => localStorage.setItem('pf_tx_view', 'garbage'));
      await page.reload();
      await gotoTab(page, 'transactions');
      await expect(page.locator('#tx-view-table')).toHaveAttribute('aria-selected', 'true');
    });

    test('3. a hand-off opens the Table even when the Calendar is remembered', async ({ page }) => {
      // (a) Hand-off from Dashboard row
      await seedTransactions(page, { transactions: STANDARD_TXS });
      await page.goto('/');
      await page.evaluate(() => localStorage.setItem('pf_tx_view', 'calendar'));
      await page.reload();

      await gotoTab(page, 'dashboard');
      await page.locator('[id^="dashboard-tx-"]').first().click();
      await expect(page.locator('#nav-tab-transactions')).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('#tx-view-table')).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('#tx-drawer')).toBeVisible();

      // (b) Hand-off from Diary link
      await page.evaluate(() => {
        localStorage.setItem('pf_diary', JSON.stringify([{
          id: 'diary-e2e-v-1',
          userId: 'usr-guest-01',
          date: '2026-10-10',
          mood: 4,
          workout: false,
          foodQuality: 'AVERAGE',
          isDeleted: false,
          createdAt: new Date('2026-10-16T12:00:00.000Z').toISOString(),
          updatedAt: new Date('2026-10-16T12:00:00.000Z').toISOString(),
        }]));
        localStorage.setItem('pf_tx_view', 'calendar');
      });
      await page.reload();

      await gotoTab(page, 'diary');
      await page.locator('#diary-day-tx-link-2026-10-10').click();
      await expect(page.locator('#nav-tab-transactions')).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('#tx-view-table')).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('#tx-day-filter')).toBeVisible();
      await expect(page.locator('button[id^="tx-row-"]')).toHaveCount(2);
    });
  });

  test.describe('wide Table', () => {
    test('4. lays out a real table with day rows', async ({ page }) => {
      await seedTransactions(page, { transactions: STANDARD_TXS });
      await page.goto('/');
      await gotoTab(page, 'transactions');

      await expect(page.locator('table caption')).toHaveText('Transactions, newest first');
      for (const name of ['Date', 'Note', 'Category', 'Wallet', 'Amount', 'Actions']) {
        await expect(page.getByRole('columnheader', { name })).toBeVisible();
      }
      await expect(page.locator('table thead tr th')).toHaveCount(7);

      const rowgroups = page.locator('th[scope="rowgroup"]');
      await expect(rowgroups.first()).toContainText('Tue, Oct 20');
      await expect(rowgroups.first()).toContainText('−฿200.00');

      const oct10Rowgroup = rowgroups.filter({ hasText: 'Sat, Oct 10' });
      await expect(oct10Rowgroup).toContainText('−฿3,000.00');

      await expect(page.locator('#tx-row-tx-e2e-v-move')).toBeVisible();
      await expect(rowgroups.filter({ hasText: 'Today · Fri, Oct 16' })).toBeVisible();
      await expectNoHorizontalScroll(page);
    });

    test('5. the row menu edits, confirms a delete, lands focus and restores', async ({ page }) => {
      await seedTransactions(page, { transactions: STANDARD_TXS });
      await page.goto('/');
      await gotoTab(page, 'transactions');

      // Edit row
      await page.locator('#tx-menu-btn-tx-e2e-v-bus').click();
      await page.locator('#tx-menu-edit-btn-tx-e2e-v-bus').click();
      await expect(page.locator('#tx-drawer')).toBeVisible();
      await expect(page.locator('#tx-drawer')).toContainText('E2E Bus');
      await page.locator('#tx-drawer-close-btn').click();
      await expect(page.locator('#tx-drawer')).not.toBeVisible();

      // Delete taxi and cancel
      await page.locator('#tx-menu-btn-tx-e2e-v-taxi').click();
      await page.locator('#tx-menu-delete-btn-tx-e2e-v-taxi').click();
      const deleteDialog = page.getByRole('dialog', { name: 'Delete this transaction?' });
      await expect(deleteDialog).toBeVisible();
      await page.locator('#confirm-cancel-btn').click();
      await expect(deleteDialog).not.toBeVisible();
      await expect(page.locator('#tx-row-tx-e2e-v-taxi')).toBeVisible();

      // Delete taxi and confirm -> next row down (move) focused
      await page.locator('#tx-menu-btn-tx-e2e-v-taxi').click();
      await page.locator('#tx-menu-delete-btn-tx-e2e-v-taxi').click();
      await page.locator('#confirm-destructive-btn').click();
      await expect(deleteDialog).not.toBeVisible();
      await expect(page.locator('#tx-row-tx-e2e-v-taxi')).toHaveCount(0);
      await expect(page.locator('#tx-row-tx-e2e-v-move')).toBeFocused();

      // Delete sep (last row) and confirm -> previous row (salary) focused
      await page.locator('#tx-menu-btn-tx-e2e-v-sep').click();
      await page.locator('#tx-menu-delete-btn-tx-e2e-v-sep').click();
      await page.locator('#confirm-destructive-btn').click();
      await expect(page.locator('#tx-row-tx-e2e-v-sep')).toHaveCount(0);
      await expect(page.locator('#tx-row-tx-e2e-v-salary')).toBeFocused();

      // Show deleted on
      await page.locator('#tx-show-deleted').check();
      await expect(page.locator('#tx-row-tx-e2e-v-taxi')).toContainText('[Soft Deleted]');
      await expect(page.locator('#tx-row-tx-e2e-v-sep')).toContainText('[Soft Deleted]');

      // Menu for taxi offers only Restore
      await page.locator('#tx-menu-btn-tx-e2e-v-taxi').click();
      await expect(page.locator('#tx-menu-restore-btn-tx-e2e-v-taxi')).toBeVisible();
      await expect(page.locator('#tx-menu-delete-btn-tx-e2e-v-taxi')).toHaveCount(0);
      await page.locator('#tx-menu-restore-btn-tx-e2e-v-taxi').click();
      await expect(page.locator('#tx-row-tx-e2e-v-taxi')).not.toContainText('[Soft Deleted]');

      // Delete bus while show deleted is on -> menu trigger focused
      await page.locator('#tx-menu-btn-tx-e2e-v-bus').click();
      await page.locator('#tx-menu-delete-btn-tx-e2e-v-bus').click();
      await page.locator('#confirm-destructive-btn').click();
      await expect(page.locator('#tx-row-tx-e2e-v-bus')).toContainText('[Soft Deleted]');
      await expect(page.locator('#tx-menu-btn-tx-e2e-v-bus')).toBeFocused();
    });

    test('6. at 1024px the inline panel opens and the page does not scroll sideways', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await seedTransactions(page, { transactions: STANDARD_TXS });
      await page.goto('/');
      await gotoTab(page, 'transactions');

      await page.locator('#tx-row-tx-e2e-v-dinner').click();
      await expect(page.locator('#tx-drawer')).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expectNoHorizontalScroll(page);
    });
  });

  test.describe('Calendar', () => {
    test.beforeEach(async ({ page }) => {
      await seedTransactions(page, { transactions: STANDARD_TXS });
      await page.goto('/');
      await gotoTab(page, 'transactions');
      await page.locator('#tx-view-calendar').click();
    });

    test('7. shows the month, its totals, the legend and today selected', async ({ page }) => {
      await expect(page.locator('#tx-cal-heading')).toHaveText('October 2026');
      await expect(page.locator('#tx-cal-month-in')).toContainText('+฿10,000.00');
      await expect(page.locator('#tx-cal-month-out')).toContainText('−฿5,120.00');
      await expect(page.locator('#tx-cal-month-net')).toContainText('+฿4,880.00');

      const legend = page.locator('#tx-cal-legend');
      await expect(legend).toContainText('Up to a third of the top day');
      await expect(legend).toContainText('Up to two thirds');
      await expect(legend).toContainText('Over two thirds');
      await expect(legend).toContainText('Today');
      await expect(legend).toContainText('Selected day');

      await expect(page.locator('#tx-cal-day-2026-10-16')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#tx-cal-panel-title')).toHaveText('Today · Fri, Oct 16');
      await expect(page.locator('#tx-row-tx-e2e-v-coffee')).toBeVisible();

      const oct01Week = page.locator('#tx-cal-day-2026-10-01').locator('..');
      await expect(oct01Week.locator('> span')).toHaveCount(3);
    });

    test('8. heat shades the days by spending and day cells state their figures', async ({ page }) => {
      await expect(page.locator('#tx-cal-day-2026-10-10')).toHaveAttribute(
        'aria-label',
        'Sat, Oct 10, spent ฿3,000.00, net −฿3,000.00, 2 transactions'
      );
      await expect(page.locator('#tx-cal-day-2026-10-01')).toHaveAttribute(
        'aria-label',
        'Thu, Oct 1, spent ฿0.00, net +฿10,000.00, 1 transaction'
      );
      await expect(page.locator('#tx-cal-day-2026-10-12')).toHaveAttribute(
        'aria-label',
        'Mon, Oct 12, spent ฿0.00, net ฿0.00, 1 transaction'
      );
      await expect(page.locator('#tx-cal-day-2026-10-16')).toHaveAttribute(
        'aria-label',
        'Fri, Oct 16, spent ฿120.00, net −฿120.00, 1 transaction, today'
      );
      await expect(page.locator('#tx-cal-day-2026-10-20')).toHaveAttribute(
        'aria-label',
        'Tue, Oct 20, spent ฿200.00, net −฿200.00, 1 transaction'
      );
      await expect(page.locator('#tx-cal-day-2026-10-11')).toHaveAttribute(
        'aria-label',
        'Sun, Oct 11, no transactions'
      );

      await expect(page.locator('#tx-cal-day-2026-10-10')).toHaveClass(/bg-heat-3/);
      await expect(page.locator('#tx-cal-day-2026-10-13')).toHaveClass(/bg-heat-2/);
      await expect(page.locator('#tx-cal-day-2026-10-14')).toHaveClass(/bg-heat-1/);
      await expect(page.locator('#tx-cal-day-2026-10-20')).toHaveClass(/bg-heat-1/);

      await expect(page.locator('#tx-cal-day-2026-10-01')).not.toHaveClass(/bg-heat/);
      await expect(page.locator('#tx-cal-day-2026-10-11')).not.toHaveClass(/bg-heat/);
      await expect(page.locator('#tx-cal-day-2026-10-12')).not.toHaveClass(/bg-heat/);

      const bg10 = await page.locator('#tx-cal-day-2026-10-10').evaluate((el) => getComputedStyle(el).backgroundColor);
      const bg13 = await page.locator('#tx-cal-day-2026-10-13').evaluate((el) => getComputedStyle(el).backgroundColor);
      const bg14 = await page.locator('#tx-cal-day-2026-10-14').evaluate((el) => getComputedStyle(el).backgroundColor);
      const bg11 = await page.locator('#tx-cal-day-2026-10-11').evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(new Set([bg10, bg13, bg14, bg11]).size).toBe(4);

      await expect(page.locator('#tx-cal-day-2026-10-17')).toBeDisabled();
      await expect(page.locator('#tx-cal-day-2026-10-21')).toBeDisabled();
      await expect(page.locator('#tx-cal-day-2026-10-20')).toBeEnabled();

      await expect(page.locator('#tx-cal-day-2026-10-10')).toContainText('−฿3,000.00', { useInnerText: true });
    });

    test('10. a day pick shows that day, an empty day says so, and the Table keeps the day', async ({ page }) => {
      await page.locator('#tx-cal-day-2026-10-10').click();
      await expect(page.locator('#tx-cal-day-2026-10-10')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#tx-cal-panel-title')).toHaveText('Sat, Oct 10');
      await expect(page.locator('#tx-cal-panel-out')).toContainText('−฿3,000.00');
      await expect(page.locator('#tx-cal-panel-net')).toContainText('−฿3,000.00');
      await expect(page.locator('#tx-cal-panel-in')).toContainText('฿0.00');
      await expect(page.locator('#tx-row-tx-e2e-v-dinner')).toBeVisible();
      await expect(page.locator('#tx-row-tx-e2e-v-snacks')).toBeVisible();
      await expect(page.locator('#tx-row-tx-e2e-v-coffee')).toHaveCount(0);

      await page.locator('#tx-cal-day-2026-10-11').click();
      await expect(page.locator('#tx-cal-panel-empty')).toHaveText('No transactions on this day');

      await page.locator('#tx-cal-day-2026-10-10').click();
      await page.locator('#tx-view-table').click();
      await expect(page.locator('#tx-day-filter')).toBeVisible();
      await expect(page.locator('#tx-day-filter')).toContainText('Only Sat, Oct 10');
      await expect(page.locator('button[id^="tx-row-"]')).toHaveCount(2);
    });

    test('11. steps through months', async ({ page }) => {
      await expect(page.locator('#tx-cal-next-month-btn')).toBeDisabled();

      await page.locator('#tx-cal-prev-month-btn').click();
      await expect(page.locator('#tx-cal-heading')).toHaveText('September 2026');
      await expect(page.locator('#tx-cal-panel-title')).toHaveText('Sun, Sep 20');
      await expect(page.locator('#tx-row-tx-e2e-v-sep')).toBeVisible();
      await expect(page.locator('#tx-cal-month-out')).toContainText('−฿900.00');

      await expect(page.locator('#tx-cal-next-month-btn')).toBeEnabled();
      await page.locator('#tx-cal-next-month-btn').click();
      await expect(page.locator('#tx-cal-heading')).toHaveText('October 2026');
      await expect(page.locator('#tx-cal-day-2026-10-16')).toHaveAttribute('aria-pressed', 'true');
    });

    test('12. the filters are shared with the Table', async ({ page }) => {
      await page.locator('#tx-view-table').click();
      await page.locator('#tx-search-input').fill('Taxi');
      await expect(page.locator('#tx-row-tx-e2e-v-taxi')).toBeVisible();
      await expect(page.locator('#tx-row-tx-e2e-v-dinner')).toHaveCount(0);

      await page.locator('#tx-view-calendar').click();
      await expect(page.locator('#tx-cal-day-2026-10-13')).toHaveAttribute(
        'aria-label',
        /1 transaction$/
      );
      await expect(page.locator('#tx-cal-day-2026-10-10')).toHaveAttribute(
        'aria-label',
        'Sat, Oct 10, no transactions'
      );

      await page.locator('#tx-search-input').fill('');
      await page.locator('#tx-filter-type-income').click();

      await expect(page.locator('#tx-cal-day-2026-10-01')).toHaveAttribute(
        'aria-label',
        /1 transaction/
      );
      await expect(page.locator('#tx-cal-day-2026-10-10')).toHaveAttribute(
        'aria-label',
        /no transactions/
      );
    });

    test('13. a panel row opens the edit sheet in a dialog and focus comes back', async ({ page }) => {
      await page.locator('#tx-cal-day-2026-10-10').click();
      await page.locator('#tx-row-tx-e2e-v-dinner').click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(page.locator('#tx-drawer')).toHaveCount(0);

      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(page.locator('#tx-row-tx-e2e-v-dinner')).toBeFocused();
    });

    test('14. the diary link shows only for a day with an entry and opens that day', async ({ page }) => {
      await page.evaluate((diary) => {
        localStorage.setItem('pf_diary', JSON.stringify(diary));
      }, [DIARY_SEED]);
      await page.reload();
      await gotoTab(page, 'transactions');
      await page.locator('#tx-view-calendar').click();

      await page.locator('#tx-cal-day-2026-10-13').click();
      await expect(page.locator('#tx-cal-diary-link')).toHaveCount(0);

      await page.locator('#tx-cal-day-2026-10-10').click();
      await expect(page.locator('#tx-cal-diary-link')).toBeVisible();

      await page.locator('#tx-cal-diary-link').click();
      await expect(page.locator('#nav-tab-diary')).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('#diary-cal-day-2026-10-10')).toHaveAttribute('aria-pressed', 'true');
    });

    test('15. Add on the selected day presets its date and the new row lands there', async ({ page }) => {
      await page.locator('#tx-cal-day-2026-10-10').click();
      const addBtn = page.locator('#tx-cal-add-btn');
      await expect(addBtn).toHaveText('Add transaction on Sat, Oct 10');

      await addBtn.click();
      const addDialog = page.getByRole('dialog', { name: /Record New Transaction/i });
      await expect(addDialog).toBeVisible();
      await expect(addDialog.getByLabel(/Transaction Date/i)).toHaveValue('2026-10-10');

      await addDialog.locator('input[name="amount_expression"]').fill('75');
      await addDialog.locator('input[id$="-desc"]').fill('E2E Oct 10 Added Row');
      const walletSelect = addDialog.locator('select[id$="-wallet"]');
      await walletSelect.selectOption({ index: 0 });
      await addDialog.locator('button[type="submit"]').click();

      await expect(addDialog).not.toBeVisible();
      await settle(page);

      await expect(page.locator('#tx-cal-panel')).toContainText('E2E Oct 10 Added Row');
      await expect(page.locator('#tx-cal-day-2026-10-10')).toHaveAttribute(
        'aria-label',
        /3 transactions/
      );

      await page.locator('#tx-open-add-modal-btn').click();
      const todayDialog = page.getByRole('dialog', { name: /Record New Transaction/i });
      await expect(todayDialog).toBeVisible();
      await expect(todayDialog.getByLabel(/Transaction Date/i)).toHaveValue('2026-10-16');
      await page.keyboard.press('Escape');
    });
  });

  test.describe('Calendar theme', () => {
    test.use({ colorScheme: 'dark' });

    test('9. heat stays distinct in the dark theme', async ({ page }) => {
      await seedTransactions(page, { transactions: STANDARD_TXS });
      await page.goto('/');
      await gotoTab(page, 'transactions');
      await page.locator('#tx-view-calendar').click();

      const html = page.locator('html');
      if (!(await html.getAttribute('class'))?.includes('dark')) {
        const toggle = page.locator('#navbar-theme-toggle-btn');
        for (let i = 0; i < 3; i++) {
          if ((await html.getAttribute('class'))?.includes('dark')) break;
          await toggle.click();
        }
      }
      await expect(html).toHaveClass(/dark/);

      const bg10 = await page.locator('#tx-cal-day-2026-10-10').evaluate((el) => getComputedStyle(el).backgroundColor);
      const bg13 = await page.locator('#tx-cal-day-2026-10-13').evaluate((el) => getComputedStyle(el).backgroundColor);
      const bg14 = await page.locator('#tx-cal-day-2026-10-14').evaluate((el) => getComputedStyle(el).backgroundColor);
      const bg11 = await page.locator('#tx-cal-day-2026-10-11').evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(new Set([bg10, bg13, bg14, bg11]).size).toBe(4);
    });
  });

  test.describe('selection and the bulk bar', () => {
    test.beforeEach(async ({ page }) => {
      await seedTransactions(page, { transactions: STANDARD_TXS });
      await page.goto('/');
      await gotoTab(page, 'transactions');
    });

    test('16. a checkbox column with a select-all header', async ({ page }) => {
      const selectAll = page.getByRole('checkbox', { name: 'Select all loaded rows' });
      await expect(selectAll).toBeVisible();
      await expect(selectAll).toHaveId('tx-select-all');

      for (const tx of STANDARD_TXS) {
        await expect(page.locator(`#tx-select-row-${tx.id}`)).toBeVisible();
      }
      await expect(page.locator('#tx-bulk-bar')).toHaveCount(0);
    });

    test('17. selecting shows the count, the net and the uncounted note, and Clear returns focus to select-all', async ({ page }) => {
      await page.locator('#tx-select-row-tx-e2e-v-dinner').check();
      await page.locator('#tx-select-row-tx-e2e-v-salary').check();

      const bulkBar = page.getByRole('region', { name: 'Bulk actions' });
      await expect(bulkBar).toBeVisible();

      const bulkCount = page.locator('#tx-bulk-count');
      await expect(bulkCount).toHaveText('2 selected');
      await expect(bulkCount).toHaveAttribute('role', 'status');

      const bulkNet = page.locator('#tx-bulk-net');
      await expect(bulkNet).toContainText('+฿7,500.00');

      await page.locator('#tx-select-row-tx-e2e-v-move').check();
      await expect(bulkCount).toHaveText('3 selected');
      await expect(bulkNet).toContainText('+฿7,500.00');
      await expect(bulkNet).toContainText('Transfers, repayments, adjustments and deleted rows are not counted');

      const isIndeterminate = await page
        .locator('#tx-select-all')
        .evaluate((el: HTMLInputElement) => el.indeterminate);
      expect(isIndeterminate).toBe(true);

      const clearBtn = page.locator('#tx-bulk-clear-btn');
      await expect(clearBtn).toHaveText('Clear');
      await clearBtn.click();

      await expect(page.locator('#tx-bulk-bar')).toHaveCount(0);
      await expect(page.locator('#tx-select-row-tx-e2e-v-dinner')).not.toBeChecked();
      await expect(page.locator('#tx-select-row-tx-e2e-v-salary')).not.toBeChecked();
      await expect(page.locator('#tx-select-all')).toBeFocused();
    });

    test('18. a row button opens the panel without toggling, and a filter drops a hidden selection', async ({ page }) => {
      await page.locator('#tx-select-row-tx-e2e-v-dinner').check();
      await page.locator('#tx-select-row-tx-e2e-v-salary').check();

      await page.locator('#tx-row-tx-e2e-v-bus').click();
      await expect(page.locator('#tx-drawer')).toBeVisible();
      await expect(page.locator('#tx-bulk-count')).toHaveText('2 selected');

      await page.locator('#tx-filter-type-income').click();
      await expect(page.locator('#tx-bulk-count')).toHaveText('1 selected');
    });

    test('19. bulk Delete confirms, cancels cleanly, deletes together and lands focus on select-all', async ({ page }) => {
      await page.locator('#tx-select-row-tx-e2e-v-dinner').check();
      await page.locator('#tx-select-row-tx-e2e-v-snacks').check();

      await page.locator('#tx-bulk-delete-btn').click();
      const deleteDialog = page.getByRole('dialog', { name: 'Delete 2 transactions?' });
      await expect(deleteDialog).toBeVisible();

      await page.locator('#confirm-cancel-btn').click();
      await expect(deleteDialog).not.toBeVisible();
      await expect(page.locator('#tx-row-tx-e2e-v-dinner')).toBeVisible();
      await expect(page.locator('#tx-row-tx-e2e-v-snacks')).toBeVisible();
      await expect(page.locator('#tx-select-row-tx-e2e-v-dinner')).toBeChecked();
      await expect(page.locator('#tx-select-row-tx-e2e-v-snacks')).toBeChecked();
      await expect(page.locator('#tx-bulk-bar')).toBeVisible();

      await page.locator('#tx-bulk-delete-btn').click();
      await page.locator('#confirm-destructive-btn').click();

      await expect(deleteDialog).not.toBeVisible();
      await expect(page.locator('#tx-row-tx-e2e-v-dinner')).toHaveCount(0);
      await expect(page.locator('#tx-row-tx-e2e-v-snacks')).toHaveCount(0);
      await expect(page.locator('#tx-bulk-bar')).toHaveCount(0);
      await expect(page.locator('#tx-select-all')).toBeFocused();

      await page.locator('#tx-show-deleted').check();
      await expect(page.locator('#tx-row-tx-e2e-v-dinner')).toContainText('[Soft Deleted]');
      await expect(page.locator('#tx-row-tx-e2e-v-snacks')).toContainText('[Soft Deleted]');

      await page.reload();
      await gotoTab(page, 'transactions');
      await expect(page.locator('#tx-show-deleted')).not.toBeChecked();
      await expect(page.locator('#tx-row-tx-e2e-v-dinner')).toHaveCount(0);
      await expect(page.locator('#tx-row-tx-e2e-v-snacks')).toHaveCount(0);
    });

    test('20. an all-deleted selection offers Restore, shows no net and restores without a dialog', async ({ page }) => {
      await page.locator('#tx-select-row-tx-e2e-v-dinner').check();
      await page.locator('#tx-select-row-tx-e2e-v-snacks').check();
      await page.locator('#tx-bulk-delete-btn').click();
      await page.locator('#confirm-destructive-btn').click();

      await page.locator('#tx-show-deleted').check();
      await page.locator('#tx-select-row-tx-e2e-v-dinner').check();
      await page.locator('#tx-select-row-tx-e2e-v-snacks').check();

      await expect(page.locator('#tx-bulk-restore-btn')).toBeVisible();
      await expect(page.locator('#tx-bulk-delete-btn')).toHaveCount(0);
      await expect(page.locator('#tx-bulk-net')).toHaveText('Deleted rows are not in your totals');

      await page.locator('#tx-bulk-restore-btn').click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.locator('#tx-row-tx-e2e-v-dinner')).not.toContainText('[Soft Deleted]');
      await expect(page.locator('#tx-row-tx-e2e-v-snacks')).not.toContainText('[Soft Deleted]');
      await expect(page.locator('#tx-bulk-bar')).toHaveCount(0);
      await expect(page.locator('#tx-select-all')).toBeFocused();
    });

    test('21. select-all covers the loaded rows only', async ({ page }) => {
      await page.evaluate((txs) => {
        localStorage.setItem('pf_transactions', JSON.stringify(txs));
      }, BULK_30_TXS);
      await page.reload();
      await gotoTab(page, 'transactions');

      const selectAll = page.locator('#tx-select-all');
      await selectAll.check();
      await expect(page.locator('#tx-bulk-count')).toHaveText('25 selected');
      await expect(selectAll).toBeChecked();

      await page.locator('#tx-load-more-btn').click();
      const isIndeterminate = await selectAll.evaluate((el: HTMLInputElement) => el.indeterminate);
      expect(isIndeterminate).toBe(true);
      await expect(selectAll).not.toBeChecked();
      await expect(page.locator('#tx-bulk-count')).toHaveText('25 selected');

      await selectAll.click();
      await expect(page.locator('#tx-bulk-count')).toHaveText('30 selected');

      await selectAll.click();
      await expect(page.locator('#tx-bulk-bar')).toHaveCount(0);
    });
  });

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('22. the switch spans the width and the Table is the list', async ({ page }) => {
      await seedTransactions(page, { transactions: STANDARD_TXS });
      await page.goto('/');
      await gotoTransactions(page);

      await expect(page.locator('#tx-view-table')).toBeVisible();
      await expect(page.locator('#tx-view-calendar')).toBeVisible();

      const tablistWidth = await page.getByRole('tablist').evaluate((el) => el.getBoundingClientRect().width);
      expect(tablistWidth).toBeGreaterThanOrEqual(350);

      await expect(page.locator('table')).toHaveCount(0);
      await expect(page.locator('button[id^="tx-row-"]').first()).toBeVisible();
      await expect(page.locator('#tx-select-all')).toHaveCount(0);
      await expect(page.locator('#tx-select-mode-btn')).toBeVisible();
      await expectNoHorizontalScroll(page);
    });

    test('23. Select mode: checkboxes, a pinned bar above the bottom nav, tap to toggle, Cancel', async ({ page }) => {
      await seedTransactions(page, { transactions: STANDARD_TXS });
      await page.goto('/');
      await gotoTransactions(page);

      await page.locator('#tx-select-mode-btn').click();
      await expect(page.locator('#tx-bulk-count')).toHaveText('0 selected');
      await expect(page.locator('#tx-bulk-delete-btn')).toBeDisabled();
      await expect(page.locator('[id^="tx-select-row-"]').first()).toBeFocused();

      await expect(page.locator('button[id^="tx-row-"]')).toHaveCount(0);
      expect(await page.locator('[id^="tx-row-"]').count()).toBeGreaterThan(0);

      await page.locator('label', { hasText: 'E2E Future' }).click();
      await expect(page.locator('#tx-bulk-count')).toHaveText('1 selected');

      await page.locator('label', { hasText: 'E2E Coffee' }).click();
      await expect(page.locator('#tx-bulk-count')).toHaveText('2 selected');
      await expect(page.locator('#tx-bulk-net')).toBeVisible();

      const barBox = (await page.locator('#tx-bulk-bar').boundingBox())!;
      const navBox = (await page.locator('nav[aria-label="Mobile Navigation"]').boundingBox())!;
      expect(barBox.y + barBox.height).toBeLessThanOrEqual(navBox.y + 1);

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const footer = page.getByText(/Showing \d+ of \d+/);
      const footerBox = (await footer.boundingBox())!;
      expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(barBox.y + 1);
      await expectNoHorizontalScroll(page);

      const cancelBtn = page.locator('#tx-bulk-clear-btn');
      await expect(cancelBtn).toHaveText('Cancel');
      await cancelBtn.click();

      await expect(page.locator('[id^="tx-select-row-"]')).toHaveCount(0);
      await expect(page.locator('#tx-bulk-bar')).toHaveCount(0);
      await expect(page.locator('#tx-select-mode-btn')).toBeFocused();

      await page.locator('#tx-select-mode-btn').click();
      await expect(page.locator('#tx-bulk-count')).toHaveText('0 selected');
    });

    test('24. a bulk Delete completes and leaves Select mode', async ({ page }) => {
      await seedTransactions(page, { transactions: STANDARD_TXS });
      await page.goto('/');
      await gotoTransactions(page);

      await page.locator('#tx-select-mode-btn').click();
      await page.locator('#tx-select-row-tx-e2e-v-dinner').check();
      await page.locator('#tx-select-row-tx-e2e-v-snacks').check();

      await page.locator('#tx-bulk-delete-btn').click();
      await page.locator('#confirm-destructive-btn').click();

      await expect(page.locator('#tx-row-tx-e2e-v-dinner')).toHaveCount(0);
      await expect(page.locator('#tx-row-tx-e2e-v-snacks')).toHaveCount(0);
      await expect(page.locator('#tx-bulk-bar')).toHaveCount(0);
      await expect(page.locator('[id^="tx-select-row-"]')).toHaveCount(0);
      await expect(page.locator('#tx-select-mode-btn')).toBeVisible();
      await expect(page.locator('#tx-select-mode-btn')).toBeFocused();
    });

    test('25. the Calendar fits the phone', async ({ page }) => {
      await seedTransactions(page, { transactions: STANDARD_TXS });
      await page.goto('/');
      await gotoTransactions(page);
      await page.locator('#tx-view-calendar').click();

      const oct10Cell = page.locator('#tx-cal-day-2026-10-10');
      const cellBox = (await oct10Cell.boundingBox())!;
      expect(cellBox.height).toBeGreaterThanOrEqual(44);
      await expect(oct10Cell).toHaveText('10', { useInnerText: true });
      await expect(oct10Cell).toHaveAttribute(
        'aria-label',
        /Sat, Oct 10, spent ฿3,000\.00/
      );

      const legendBox = (await page.locator('#tx-cal-legend').boundingBox())!;
      const panelBox = (await page.locator('#tx-cal-panel').boundingBox())!;
      expect(panelBox.y).toBeGreaterThanOrEqual(legendBox.y + legendBox.height - 1);
      await expectNoHorizontalScroll(page);

      await oct10Cell.click();
      await page.locator('#tx-row-tx-e2e-v-dinner').click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(page.locator('#tx-drawer')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(page.locator('#tx-row-tx-e2e-v-dinner')).toBeFocused();
    });

    test('26. a tablet width keeps the list', async ({ page }) => {
      await page.setViewportSize({ width: 900, height: 1000 });
      await seedTransactions(page, { transactions: STANDARD_TXS });
      await page.goto('/');
      await gotoTransactions(page);

      await expect(page.locator('table')).toHaveCount(0);
      await expect(page.locator('#tx-select-mode-btn')).toBeVisible();

      await page.locator('#tx-row-tx-e2e-v-dinner').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.locator('#tx-drawer')).toHaveCount(0);
    });
  });
});
