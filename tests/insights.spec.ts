import { test, expect, type Page, type Route } from '@playwright/test';
import { addQuickTransaction } from './helpers';

/**
 * Monthly spending insights (ADR 0020), as a guest sees them.
 *
 * Since Phase 112 (ADR 0088) `/api/insights` serves accounts only, and the
 * client sends a guest nothing: a guest's wrap-up is written on the device.
 * No spec signs in, so the model path (the payload's privacy, the rendered
 * verdict, the cache, Refresh, a 429) is `unit/insights-card.test.tsx`.
 *
 * NETWORK MOCKING. This spec still intercepts `/api/insights`, to count the
 * requests a guest makes, which must be none. The rule is a principle rather
 * than a file count: every intercepting spec fulfils every response locally,
 * so the suite spends no TypeSafe credits and needs no API key.
 */

const INSIGHTS_ROUTE = '**/api/insights';

/** Counts requests to the proxy, answering any that come as the model would. */
async function countInsightsRequests(page: Page) {
  const state = { count: 0 };
  await page.route(INSIGHTS_ROUTE, async (route: Route) => {
    state.count += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pattern: 'STEADY', focus: null, confidence: 0.9 }),
    });
  });
  return state;
}

/** Seeds a couple of this-month expenses so the card has something to summarize. */
async function seedSpending(page: Page, marker: string) {
  await addQuickTransaction(page, `${marker} one`, '320');
  await addQuickTransaction(page, `${marker} two`, '180');
}

const card = (page: Page) => page.getByTestId('insights-card');

test.describe('Monthly spending insights', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test("a guest's summary is written on this device, with no request, and says signing in adds Jev", async ({ page }) => {
    const calls = await countInsightsRequests(page);
    await seedSpending(page, 'zzzguest');

    await expect(card(page)).toBeVisible();
    await page.locator('#insights-generate-btn').click();

    const body = page.getByTestId('insights-body');
    await expect(body).toBeVisible();
    // 320 + 180 = 500, formatted by the app.
    await expect(body).toContainText('฿500.00');
    await expect(page.getByTestId('insights-signin-note')).toHaveText('Written on this device. Sign in for a summary from Jev.');
    await expect(page.getByTestId('insights-offline-note')).toHaveCount(0);
    await expect(card(page)).not.toContainText(/error|failed|unavailable|something went wrong/i);

    // The summary is on screen, so the one request it could have made is over.
    expect(calls.count).toBe(0);
  });

  test('collapsing the card persists across a reload', async ({ page }) => {
    await seedSpending(page, 'zzzcollapse');

    await expect(page.locator('#insights-generate-btn')).toBeVisible();
    await page.locator('#insights-collapse-btn').click();
    await expect(page.locator('#insights-generate-btn')).toHaveCount(0);

    await page.reload();

    await expect(card(page)).toBeVisible();
    await expect(page.locator('#insights-collapse-btn')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#insights-generate-btn')).toHaveCount(0);
  });
});
