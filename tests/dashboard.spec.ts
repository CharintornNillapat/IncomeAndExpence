import { test, expect, type Locator } from '@playwright/test';
import { SAMPLE_STUDENT_LOAN, seedLedger } from './helpers';

test.describe('Dashboard row 1: left over, income and spending', () => {
  test.use({ timezoneId: 'Asia/Bangkok' });

  async function expectCleanCard(region: Locator) {
    const text = await region.innerText();
    const labels = await region.locator('[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || ''));
    const combined = `${text} ${labels.join(' ')}`;
    expect(combined).not.toMatch(/NaN|Infinity/);
    expect(combined).not.toMatch(/(^|[^0-9])%/);
  }

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-16T15:00:00+07:00'));
  });

  async function seedTestTransactions(page: any) {
    await seedLedger(page, { debts: [SAMPLE_STUDENT_LOAN] });
    await page.addInitScript(() => {
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
          { ...base, id: 'tx-e2e-dash-food', type: 'EXPENSE', amount: 2500, categoryId: 'cat-food', transactionDate: '2026-10-10' },
          { ...base, id: 'tx-e2e-dash-groceries', type: 'EXPENSE', amount: 500, categoryId: 'cat-groceries', transactionDate: '2026-10-16' },
        ])
      );
    });
  }

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
