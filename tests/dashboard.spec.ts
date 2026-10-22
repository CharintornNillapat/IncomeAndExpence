import { test, expect, type Locator, type Page } from '@playwright/test';
import { SAMPLE_STUDENT_LOAN, SAMPLE_WALLETS, gotoTab, seedLedger } from './helpers';
import type { Wallet } from '../src/types';

async function expectCleanCard(region: Locator) {
  const text = await region.innerText();
  const labels = await region.locator('[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || ''));
  const combined = `${text} ${labels.join(' ')}`;
  expect(combined).not.toMatch(/NaN|Infinity/);
  expect(combined).not.toMatch(/(^|[^0-9])%/);
}

async function seedTestTransactions(
  page: Page,
  debts = [SAMPLE_STUDENT_LOAN],
  wallets?: Wallet[],
  diary: unknown[] = []
) {
  await seedLedger(page, { debts, wallets });
  await page.addInitScript((diary) => {
    const userId = 'usr-guest-01';
    const walletId = 'wal-main-checking';
    const now = new Date().toISOString();
    const base = {
      userId,
      walletId,
      description: '',
      isDeleted: false,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };
    localStorage.setItem(
      'pf_transactions',
      JSON.stringify([
        { ...base, id: 'tx-e2e-dash-income', type: 'INCOME', amount: 10000, categoryId: 'cat-salary', transactionDate: '2026-10-01' },
        { ...base, id: 'tx-e2e-dash-housing', type: 'EXPENSE', amount: 6000, categoryId: 'cat-housing', transactionDate: '2026-09-05' },
        { ...base, id: 'tx-e2e-dash-food', type: 'EXPENSE', amount: 2500, categoryId: 'cat-food', transactionDate: '2026-10-10' },
        { ...base, id: 'tx-e2e-dash-groceries', type: 'EXPENSE', amount: 500, categoryId: 'cat-groceries', transactionDate: '2026-10-16' },
      ])
    );
    localStorage.setItem('pf_diary', JSON.stringify(diary));
  }, diary);
}

test.describe('Dashboard row 1: left over, income and spending', () => {
  test.use({ timezoneId: 'Asia/Bangkok' });

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-16T15:00:00+07:00'));
  });

  test('Past 30 days (default)', async ({ page }) => {
    await seedTestTransactions(page);
    await page.goto('/');

    const leftOverRegion = page.getByRole('region', { name: 'Left over', exact: true });
    await expect(leftOverRegion).toContainText('+฿7,000.00');
    await expect(leftOverRegion).toContainText('70% of income kept');
    await expect(leftOverRegion).toContainText('฿5,500.00 after debt due');
    await expect(leftOverRegion).toContainText('Spent 30%');
    await expect(leftOverRegion).toContainText('Kept 70%');
    await expect(leftOverRegion).toContainText('Sep 16 \u2013 Oct 16');

    await expect(
      leftOverRegion.getByRole('img', { name: 'Daily spending, past 30 days: highest ฿2,500.00 on Sat, Oct 10' })
    ).toBeVisible();

    await expect(page.getByTestId('metric-card-income')).toContainText('+฿10,000.00');
    await expect(page.getByTestId('metric-card-expense')).toContainText('\u2212฿3,000.00');
  });

  test('Today and This week', async ({ page }) => {
    await seedTestTransactions(page);
    await page.goto('/');

    const leftOverRegion = page.getByRole('region', { name: 'Left over', exact: true });
    const dayBtn = page.locator('#time-filter-day');
    await dayBtn.click();
    await expect(dayBtn).toHaveAttribute('aria-pressed', 'true');

    await expect(leftOverRegion).toContainText('\u2212฿500.00');
    await expect(leftOverRegion).toContainText('No income this period');
    await expect(leftOverRegion).not.toContainText('after debt due');
    await expect(leftOverRegion.getByRole('img')).toHaveCount(0);

    await expect(page.getByTestId('metric-card-expense')).toContainText('\u2212฿500.00');
    await expect(page.getByTestId('metric-card-income')).toContainText('฿0.00');

    const weekBtn = page.locator('#time-filter-week');
    await weekBtn.click();
    await expect(weekBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(
      leftOverRegion.getByRole('img', { name: 'Daily spending, this week: highest ฿2,500.00 on Sat, Oct 10' })
    ).toBeVisible();
    await expect(leftOverRegion).not.toContainText('after debt due');
  });

  test('Phone width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedTestTransactions(page);
    await page.goto('/');

    const leftOverRegion = page.getByRole('region', { name: 'Left over', exact: true });
    const incomeRegion = page.getByRole('region', { name: 'Income', exact: true });

    const leftOverBox = await leftOverRegion.boundingBox();
    const incomeBox = await incomeRegion.boundingBox();
    expect(leftOverBox).not.toBeNull();
    expect(incomeBox).not.toBeNull();
    expect(incomeBox!.y).toBeGreaterThanOrEqual(leftOverBox!.y + leftOverBox!.height - 1);

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });

  test('New account', async ({ page }) => {
    await page.goto('/');

    const leftOverRegion = page.getByRole('region', { name: 'Left over', exact: true });
    await expect(leftOverRegion).toContainText('฿0.00');
    await expect(leftOverRegion.locator('p')).toHaveCount(0);
    await expect(leftOverRegion).not.toContainText('No income');
    await expect(leftOverRegion).not.toContainText('after debt due');
    await expect(
      leftOverRegion.getByRole('img', { name: 'Daily spending, past 30 days: nothing spent' })
    ).toBeVisible();

    for (const id of ['#time-filter-day', '#time-filter-week', '#time-filter-month', '#time-filter-all']) {
      const btn = page.locator(id);
      await btn.click();
      await expect(btn).toHaveAttribute('aria-pressed', 'true');
      await expect(leftOverRegion.locator('p')).toHaveCount(0);
      await expectCleanCard(leftOverRegion);
    }
  });

  test('Every period, seeded (Amendment 1)', async ({ page }) => {
    await seedTestTransactions(page);
    await page.goto('/');

    const leftOverRegion = page.getByRole('region', { name: 'Left over', exact: true });
    for (const id of ['#time-filter-day', '#time-filter-week', '#time-filter-month', '#time-filter-all']) {
      const btn = page.locator(id);
      await btn.click();
      await expect(btn).toHaveAttribute('aria-pressed', 'true');
      await expectCleanCard(leftOverRegion);
    }
  });
});

test.describe('Dashboard row 2: spending by category and debt payoff', () => {
  test.use({ timezoneId: 'Asia/Bangkok' });

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-16T15:00:00+07:00'));
  });

  test('Past 30 days', async ({ page }) => {
    await seedTestTransactions(page);
    await page.goto('/');

    const categoryRegion = page.getByRole('region', { name: 'Spending by category', exact: true });
    const debtRegion = page.getByRole('region', { name: 'Debt payoff', exact: true });

    await expect(categoryRegion).toContainText('฿3,000.00');
    await expect(categoryRegion).toContainText('total spent');
    await expect(categoryRegion).toContainText('Food & Dining');
    await expect(categoryRegion).toContainText('83.3%');
    await expect(categoryRegion).toContainText('฿2,500.00');
    await expect(categoryRegion).toContainText('Groceries');
    await expect(categoryRegion).toContainText('16.7%');
    await expect(categoryRegion).toContainText('฿500.00');

    await expect(
      categoryRegion.getByRole('img', { name: 'Spending by category: Food & Dining 83.3%, Groceries 16.7%' })
    ).toBeVisible();

    await expect(categoryRegion).toContainText('October 1 to 16:');
    await expect(categoryRegion).toContainText('฿3,000.00 spent, against ฿6,000.00 in September 1 to 16.');
    await expect(categoryRegion).toContainText('+฿7,000.00 left over.');
    await expect(categoryRegion).toContainText('\u221250% vs Sep');

    await expect(debtRegion).toContainText('55.0%');
    await expect(debtRegion).toContainText('paid off');
    await expect(debtRegion).toContainText('฿5,500.00 of ฿10,000.00');
    await expect(debtRegion).toContainText('Needed this month');
    await expect(debtRegion).toContainText('฿1,500.00');
    await expect(debtRegion).toContainText('Student Loan');
    await expect(debtRegion).toContainText('\u2212฿4,500.00');
    await expect(debtRegion).toContainText('55.0% · due Dec 31, 2026');
    await expect(debtRegion).toContainText('฿1,500.00 / month needed');
    await expect(debtRegion.getByRole('note')).toHaveCount(0);
  });

  test('The month line ignores the period', async ({ page }) => {
    await seedTestTransactions(page);
    await page.goto('/');

    const categoryRegion = page.getByRole('region', { name: 'Spending by category', exact: true });
    const dayBtn = page.locator('#time-filter-day');
    await dayBtn.click();
    await expect(dayBtn).toHaveAttribute('aria-pressed', 'true');

    await expect(categoryRegion).toContainText('Groceries');
    await expect(categoryRegion).toContainText('100.0%');
    await expect(categoryRegion).toContainText('October 1 to 16:');
    await expect(categoryRegion).toContainText('\u221250% vs Sep');
  });

  test('Links', async ({ page }) => {
    await seedTestTransactions(page);
    await page.goto('/');

    await page.locator('#dashboard-category-details-btn').click();
    await expect(page.locator('#nav-tab-transactions')).toHaveAttribute('aria-current', 'page');

    await gotoTab(page, 'dashboard');
    await page.locator('#dashboard-repay-btn').click();
    await expect(page.locator('#nav-tab-debts')).toHaveAttribute('aria-current', 'page');
  });

  test('New account', async ({ page }) => {
    await page.goto('/');

    const categoryRegion = page.getByRole('region', { name: 'Spending by category', exact: true });
    const debtRegion = page.getByRole('region', { name: 'Debt payoff', exact: true });

    await expect(categoryRegion).toContainText('No spending in this period.');
    await expect(categoryRegion).toContainText('October 1 to 16:');
    await expect(categoryRegion).toContainText('฿0.00 spent, against ฿0.00 in September 1 to 16.');
    await expect(categoryRegion).not.toContainText('vs Sep');
    await expectCleanCard(categoryRegion);

    await expect(debtRegion).toContainText('No active debts.');
  });

  test('The warning sits in the card', async ({ page }) => {
    await seedTestTransactions(page, [
      { ...SAMPLE_STUDENT_LOAN, id: 'debt-e2e-big', name: 'Big loan', totalAmount: 60000, remainingAmount: 60000 },
    ]);
    await page.goto('/');

    const debtRegion = page.getByRole('region', { name: 'Debt payoff', exact: true });
    const warning = debtRegion.getByRole('note');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('Big loan needs ฿20,000.00 a month');
    await expect(page.getByTestId('dashboard-debt-warning')).toHaveCount(1);
  });
});

const DIARY_NOW = '2026-10-16T15:00:00.000Z';
const DIARY = [
  { id: 'diary-e2e-1', userId: 'usr-guest-01', date: '2026-10-10', mood: 2, workout: false, foodQuality: 'AVERAGE', isDeleted: false, createdAt: DIARY_NOW, updatedAt: DIARY_NOW },
  { id: 'diary-e2e-2', userId: 'usr-guest-01', date: '2026-10-16', mood: 4, workout: false, foodQuality: 'AVERAGE', isDeleted: false, createdAt: DIARY_NOW, updatedAt: DIARY_NOW },
];

test.describe('Dashboard row 3: recent activity, net worth and wallets, mood and spending', () => {
  test.use({ timezoneId: 'Asia/Bangkok' });

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-16T15:00:00+07:00'));
  });

  test('Past 30 days', async ({ page }) => {
    await seedTestTransactions(page, [SAMPLE_STUDENT_LOAN], SAMPLE_WALLETS, DIARY);
    await page.goto('/');

    const netWorthRegion = page.getByRole('region', { name: 'Net worth and wallets', exact: true });
    await expect(netWorthRegion).toContainText('฿3,150.00');
    await expect(netWorthRegion).toContainText('THB');
    await expect(netWorthRegion).toContainText('In 3 wallets');
    await expect(netWorthRegion).toContainText('฿7,650.00');
    await expect(netWorthRegion).toContainText('\u2212฿4,500.00');
    await expect(netWorthRegion.getByTestId('net-worth-card')).toBeVisible();
    await expect(netWorthRegion.locator('#dashboard-wallet-card-wal-main-checking')).toContainText('Main Checking');
    await expect(netWorthRegion.locator('#dashboard-wallet-card-wal-main-checking')).toContainText('Bank Account · 32.7%');
    await expect(netWorthRegion.getByRole('img', { name: /^Share of money by wallet: / })).toBeVisible();

    const recentRegion = page.getByRole('region', { name: 'Recent activity', exact: true });
    await expect(recentRegion).toContainText('Today · Fri, Oct 16');
    await expect(recentRegion.locator('[id^="dashboard-tx-"]')).toHaveCount(4);

    const moodRegion = page.getByRole('region', { name: 'Mood and spending', exact: true });
    await expect(moodRegion.getByRole('listitem')).toHaveCount(2);
    await expect(moodRegion.getByRole('listitem').nth(0)).toContainText('Sat, Oct 10');
    await expect(moodRegion.getByRole('listitem').nth(0)).toContainText('\u2212฿2,500.00');
    await expect(moodRegion.getByRole('listitem').nth(1)).toContainText('Fri, Oct 16');
    await expect(moodRegion.getByRole('listitem').nth(1)).toContainText('\u2212฿500.00');
    await expect(moodRegion.getByRole('img', { name: 'Mood 2 of 5' })).toBeVisible();
    await expect(moodRegion.getByRole('img', { name: 'Mood 4 of 5' })).toBeVisible();
    await expect(moodRegion).toContainText('Only 2 days logged in this period.');
    await expect(moodRegion.locator('#dashboard-log-mood-btn')).toHaveText("Edit today's entry");

    const insightsFollows = await moodRegion.evaluate((el) => {
      const insights = document.querySelector('section[aria-label="Spending insights"]');
      if (!insights) return false;
      return Boolean(el.compareDocumentPosition(insights) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(insightsFollows).toBe(true);
  });

  test('The strip follows the period', async ({ page }) => {
    await seedTestTransactions(page, [SAMPLE_STUDENT_LOAN], SAMPLE_WALLETS, DIARY);
    await page.goto('/');

    const dayBtn = page.locator('#time-filter-day');
    await dayBtn.click();
    await expect(dayBtn).toHaveAttribute('aria-pressed', 'true');

    const moodRegion = page.getByRole('region', { name: 'Mood and spending', exact: true });
    await expect(moodRegion.getByRole('listitem')).toHaveCount(1);
    await expect(moodRegion.getByRole('listitem').first()).toContainText('Fri, Oct 16');
    await expect(moodRegion).toContainText('Only 1 day logged in this period.');
  });

  test('Links', async ({ page }) => {
    await seedTestTransactions(page, [SAMPLE_STUDENT_LOAN], SAMPLE_WALLETS, DIARY);
    await page.goto('/');

    await page.locator('#dashboard-view-all-transactions-btn').click();
    await expect(page.locator('#nav-tab-transactions')).toHaveAttribute('aria-current', 'page');

    await gotoTab(page, 'dashboard');
    await page.locator('#dashboard-wallets-manage-btn').click();
    await expect(page.locator('#nav-tab-wallets')).toHaveAttribute('aria-current', 'page');

    await gotoTab(page, 'dashboard');
    await page.locator('#dashboard-log-mood-btn').click();
    await expect(page.locator('#nav-tab-diary')).toHaveAttribute('aria-current', 'page');
  });

  test('New account', async ({ page }) => {
    await page.goto('/');

    const netWorthRegion = page.getByRole('region', { name: 'Net worth and wallets', exact: true });
    await expect(netWorthRegion).toContainText('฿0.00');
    await expect(netWorthRegion).toContainText('In 3 wallets');
    await expect(netWorthRegion).toContainText('No money in your wallets yet');

    const recentRegion = page.getByRole('region', { name: 'Recent activity', exact: true });
    await expect(recentRegion).toContainText('No transactions recorded yet');

    const moodRegion = page.getByRole('region', { name: 'Mood and spending', exact: true });
    await expect(moodRegion).toContainText('No diary days logged in this period.');
    await expect(moodRegion.getByRole('listitem')).toHaveCount(0);
    await expect(moodRegion.locator('#dashboard-log-mood-btn')).toHaveText('Log today (Fri, Oct 16)');

    await expectCleanCard(netWorthRegion);
    await expectCleanCard(recentRegion);
    await expectCleanCard(moodRegion);
  });

  test('Phone width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedTestTransactions(page, [SAMPLE_STUDENT_LOAN], SAMPLE_WALLETS, DIARY);
    await page.goto('/');

    const recentRegion = page.getByRole('region', { name: 'Recent activity', exact: true });
    const netWorthRegion = page.getByRole('region', { name: 'Net worth and wallets', exact: true });
    const moodRegion = page.getByRole('region', { name: 'Mood and spending', exact: true });

    await expect(recentRegion).toBeVisible();
    await expect(netWorthRegion).toBeVisible();
    await expect(moodRegion).toBeVisible();

    const recentBox = await recentRegion.boundingBox();
    const netWorthBox = await netWorthRegion.boundingBox();
    const moodBox = await moodRegion.boundingBox();

    expect(recentBox).not.toBeNull();
    expect(netWorthBox).not.toBeNull();
    expect(moodBox).not.toBeNull();

    expect(netWorthBox!.y).toBeGreaterThanOrEqual(recentBox!.y + recentBox!.height - 1);
    expect(moodBox!.y).toBeGreaterThanOrEqual(netWorthBox!.y + netWorthBox!.height - 1);

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });
});

test.describe('Dashboard identity colours (ADR 0103 D7)', () => {
  test.use({ timezoneId: 'Asia/Bangkok' });

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-16T15:00:00+07:00'));
  });

  test('resolves Paper Ledger identity colours in light theme', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('finlife_theme_preference', 'light'));
    await seedTestTransactions(page);
    await page.goto('/');

    // Main Checking wallet tile: Blue identity-2 -> light rgb(30, 64, 175)
    const walletTile = page.locator('#dashboard-wallet-card-wal-main-checking > span[aria-hidden="true"]');
    await expect(walletTile).toHaveCSS('color', 'rgb(30, 64, 175)');

    // Donut circles: Food & Dining (2500) -> Rose identity-5 light rgb(219, 39, 119)
    // Groceries (500) -> Peach identity-4 light rgb(217, 119, 6)
    const donutCircles = page.getByRole('img', { name: /^Spending by category/ }).locator('circle[stroke-dasharray]');
    await expect(donutCircles.nth(0)).toHaveCSS('stroke', 'rgb(219, 39, 119)');
    await expect(donutCircles.nth(1)).toHaveCSS('stroke', 'rgb(217, 119, 6)');
  });

  test('resolves stored identity colours in dark theme', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('finlife_theme_preference', 'dark'));
    await seedTestTransactions(page);
    await page.goto('/');

    // Main Checking wallet tile: Blue identity-2 -> dark rgb(108, 142, 239)
    const walletTile = page.locator('#dashboard-wallet-card-wal-main-checking > span[aria-hidden="true"]');
    await expect(walletTile).toHaveCSS('color', 'rgb(108, 142, 239)');

    // Donut circles: Food & Dining -> Rose identity-5 dark rgb(232, 121, 166)
    // Groceries -> Peach identity-4 dark rgb(245, 158, 107)
    const donutCircles = page.getByRole('img', { name: /^Spending by category/ }).locator('circle[stroke-dasharray]');
    await expect(donutCircles.nth(0)).toHaveCSS('stroke', 'rgb(232, 121, 166)');
    await expect(donutCircles.nth(1)).toHaveCSS('stroke', 'rgb(245, 158, 107)');
  });
});
