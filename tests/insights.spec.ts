import { test, expect, type Page, type Route } from '@playwright/test';
import { addQuickTransaction } from './helpers';

/**
 * Monthly spending insights (ADR 0020).
 *
 * NETWORK MOCKING. This is the **third** spec permitted to intercept
 * requests, after `jev-classify.spec.ts` and `csv-classify.spec.ts`. The rule
 * is a principle rather than a file count: every intercepting spec fulfils
 * every response locally, so the suite spends no TypeSafe credits and needs
 * no API key, on CI or on a laptop that happens to have one exported.
 *
 * Note what is NOT mocked in the fallback test: `npm run dev` does not serve
 * `api/`, so with no route handler `/api/insights` 404s, the client latches
 * off, and the card renders a locally-chosen verdict. That path is the reason
 * the card has no error state at all.
 */

const INSIGHTS_ROUTE = '**/api/insights';

interface MockVerdict {
  pattern: 'CATEGORY_SPIKE' | 'IMPROVED_SAVING' | 'NEW_RECURRING' | 'STEADY';
  focus: string | null;
  confidence: number;
}

async function mockInsights(page: Page, verdict: MockVerdict) {
  const state = { count: 0, bodies: [] as string[] };
  await page.route(INSIGHTS_ROUTE, async (route: Route) => {
    state.count += 1;
    state.bodies.push(route.request().postData() ?? '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(verdict),
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

  test('the card offers a trigger and makes no request until it is pressed', async ({ page }) => {
    const calls = await mockInsights(page, { pattern: 'STEADY', focus: null, confidence: 0.9 });
    await seedSpending(page, 'zzzidle');

    await expect(card(page)).toBeVisible();
    await expect(page.locator('#insights-generate-btn')).toBeVisible();

    // Nothing is spent before the user asks for it.
    expect(calls.count).toBe(0);
    await expect(page.getByTestId('insights-body')).toHaveCount(0);
  });

  test('the payload carries aggregates only, never ledger content', async ({ page }) => {
    const calls = await mockInsights(page, { pattern: 'STEADY', focus: null, confidence: 0.9 });

    const marker = `zzzsecret${Date.now().toString().slice(-6)}`;
    await seedSpending(page, marker);

    await page.locator('#insights-generate-btn').click();
    await expect(page.getByTestId('insights-body')).toBeVisible();

    expect(calls.count).toBe(1);
    const body = calls.bodies[0];

    // The privacy guarantee, made executable. If a future change starts
    // sending raw rows, this fails.
    expect(body).not.toContain(marker);
    expect(body).not.toContain('Main Checking');
    expect(body).not.toMatch(/"(walletId|categoryId|transactionId|userId|id)"\s*:/);
    expect(body).not.toMatch(/\btx-[a-z0-9-]+/i);
    expect(body).not.toMatch(/\bcat-[a-z-]+/i);

    // ...and it does carry what the model actually needs.
    const parsed = JSON.parse(body) as { summary: { month: string; categories: unknown[] } };
    expect(parsed.summary.month).toMatch(/^\d{4}-\d{2}$/);
    expect(parsed.summary.categories.length).toBeGreaterThan(0);
  });

  test('a mocked verdict renders sentences carrying the ledger figures', async ({ page }) => {
    await mockInsights(page, { pattern: 'STEADY', focus: 'Food & Dining', confidence: 0.91 });
    await seedSpending(page, 'zzzfigures');

    await page.locator('#insights-generate-btn').click();

    const body = page.getByTestId('insights-body');
    await expect(body).toBeVisible();

    // 320 + 180 = 500, formatted by the app, never by the model.
    await expect(body).toContainText('฿500.00');
    await expect(body).toContainText(/spent/i);

    // A model-sourced verdict is not marked as an offline summary.
    await expect(page.getByTestId('insights-offline-note')).toHaveCount(0);
  });

  test('the verdict is cached, so the same month costs one request', async ({ page }) => {
    const calls = await mockInsights(page, { pattern: 'STEADY', focus: null, confidence: 0.9 });
    await seedSpending(page, 'zzzcached');

    await page.locator('#insights-generate-btn').click();
    await expect(page.getByTestId('insights-body')).toBeVisible();
    expect(calls.count).toBe(1);

    await page.reload();

    // Seeded straight from the cache: rendered with no press and no request.
    await expect(page.getByTestId('insights-body')).toBeVisible();
    await expect(page.locator('#insights-generate-btn')).toHaveCount(0);
    expect(calls.count).toBe(1);
  });

  test('refresh bypasses the cache and issues exactly one more request', async ({ page }) => {
    const calls = await mockInsights(page, { pattern: 'STEADY', focus: null, confidence: 0.9 });
    await seedSpending(page, 'zzzrefresh');

    await page.locator('#insights-generate-btn').click();
    await expect(page.getByTestId('insights-body')).toBeVisible();
    expect(calls.count).toBe(1);

    await page.locator('#insights-refresh-btn').click();
    await expect(page.getByTestId('insights-body')).toBeVisible();
    await expect.poll(() => calls.count).toBe(2);
  });

  test('with no endpoint the card falls back locally and shows no error', async ({ page }) => {
    // Deliberately no mock - the dev server does not serve `api/`, so this is
    // the genuine offline / unconfigured-deployment path.
    await seedSpending(page, 'zzzoffline');

    await page.locator('#insights-generate-btn').click();

    const body = page.getByTestId('insights-body');
    await expect(body).toBeVisible();
    await expect(body).toContainText('฿500.00');

    // Marked as locally generated - a provenance note, not a failure.
    await expect(page.getByTestId('insights-offline-note')).toBeVisible();

    // And nothing anywhere reads as an error.
    await expect(card(page)).not.toContainText(/error|failed|unavailable|something went wrong/i);
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
