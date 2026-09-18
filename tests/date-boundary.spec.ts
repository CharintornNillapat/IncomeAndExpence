import { test, expect } from '@playwright/test';
import { gotoTab } from './helpers';

/**
 * T21 regression coverage: local-calendar-day comparisons must never drift by
 * parsing a bare `YYYY-MM-DD` (or a UTC-formatted timestamp) against a real
 * clock instant. Both specs pin the browser's timezone to `Asia/Bangkok`
 * (UTC+7) via `test.use` and freeze `Date`/`Date.now()` with
 * `page.clock.setFixedTime`, so the app's own `new Date()` calls - including
 * the ones that run at module-eval time when `DEFAULT_STARTER_WALLETS` is
 * built - see the pinned instant regardless of the host machine's real
 * timezone or wall-clock time.
 */
test.describe('Local-calendar date boundary correctness (UTC+7)', () => {
  test.use({ timezoneId: 'Asia/Bangkok' });

  test('wallet created during the midnight-to-dawn window records the correct local calendar day', async ({ page }) => {
    // 02:15 local is squarely inside the 00:00-06:59 danger window CLAUDE.md
    // describes: at UTC+7 this instant is 2026-09-17T19:15:00.000Z, so any
    // code that reads a stored `createdAt` by slicing the first 10 characters
    // of its UTC ISO string (the bug `WalletsView.tsx` had) would show
    // "2026-09-17" - one day behind the local calendar day the wallet was
    // actually created on.
    await page.clock.setFixedTime(new Date('2026-09-18T02:15:00+07:00'));
    await page.goto('/');

    // `DEFAULT_STARTER_WALLETS` stamps `createdAt: new Date().toISOString()`
    // at module-eval time (first page load), so the seeded "Main Checking"
    // wallet's `createdAt` is exactly the pinned instant above.
    await gotoTab(page, 'wallets');
    const card = page.locator('#wallet-entity-wal-main-checking');
    await expect(card).toBeVisible();

    await expect(card).toContainText('Created: 2026-09-18');
    await expect(card).not.toContainText('Created: 2026-09-17');
  });

  test("dashboard 'This Week' filter includes a transaction dated exactly 7 local days ago", async ({ page }) => {
    // Pinned "now" is a normal Bangkok afternoon, deliberately *not* inside
    // the midnight-to-dawn window: `DashboardView`'s pre-fix week/month cutoff
    // mixed a real elapsed-time threshold (`now.getTime() - 7 * 86400000`)
    // with a UTC-midnight-parsed `Date` built from the bare transaction date
    // string. Those two clocks agree only when "now"'s local time-of-day is
    // earlier than the +7 UTC offset; once it drifts past 07:00 local (as it
    // has by mid-afternoon), a transaction dated exactly 7 local days ago -
    // the oldest day "This Week" is meant to include - fell on the wrong side
    // of the cutoff and was silently dropped. Comparing plain ISO date
    // strings (`daysAgoIsoDate(7)` against `tx.transactionDate`) removes the
    // two-clocks mismatch entirely, so this reproduces regardless of the
    // pinned time-of-day; afternoon is chosen so the test does not overlap
    // with (and so stays independent of) the midnight-to-dawn spec above.
    const pinnedNow = new Date('2026-09-18T15:00:00+07:00');
    await page.clock.setFixedTime(pinnedNow);

    // Seed two expenses before the app boots: one exactly 7 local calendar
    // days before the pinned "today" (must be included), one 8 days before
    // it (must stay excluded either way, as a control).
    await page.addInitScript(
      ([includedDate, excludedDate]) => {
        const userId = 'usr-guest-01';
        const walletId = 'wal-main-checking';
        const now = new Date().toISOString();
        const base = {
          userId,
          walletId,
          type: 'EXPENSE',
          isDeleted: false,
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
        };
        localStorage.setItem(
          'pf_transactions',
          JSON.stringify([
            { ...base, id: 'tx-e2e-week-cutoff-included', amount: 1000, description: 'E2E Week Cutoff Included', transactionDate: includedDate },
            { ...base, id: 'tx-e2e-week-cutoff-excluded', amount: 2000, description: 'E2E Week Cutoff Excluded', transactionDate: excludedDate },
          ])
        );
      },
      ['2026-09-11', '2026-09-10']
    );

    await page.goto('/');

    const weekFilterBtn = page.locator('#time-filter-week');
    await expect(weekFilterBtn).toBeVisible();
    await weekFilterBtn.click();

    // Scope to the Total Expense card so the assertion targets the
    // filtered aggregate, not any other total on the page.
    const expenseHeading = page.getByText('Total Expense', { exact: true });
    const expenseCard = expenseHeading.locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');

    // Only the 1,000 transaction (7 days ago) should count; the 2,000
    // transaction (8 days ago) must not be added into the same total.
    await expect(expenseCard).toContainText('฿1,000.00');
    await expect(expenseCard).not.toContainText('฿3,000.00');
  });
});
