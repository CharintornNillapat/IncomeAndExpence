import { test, expect, type Page, type Route } from '@playwright/test';
import { gotoTab } from './helpers';

/**
 * Layered auto-categorization in the CSV importer (ADR 0019).
 *
 * NETWORK MOCKING. This is the **second** spec permitted to intercept
 * requests, alongside `jev-classify.spec.ts`. The rule's purpose - the suite
 * spends no TypeSafe credits and needs no API key, on CI or on a laptop that
 * happens to have one exported - is upheld here, not breached: every response
 * below is fulfilled locally and nothing reaches `api.typesafe.ai`.
 *
 * Note what is NOT mocked in the offline test: `npm run dev` does not serve
 * `api/`, so with no route handler `/api/classify` 404s, the client latches
 * off, and the importer reports Jev unavailable while still committing.
 */

const CLASSIFY_ROUTE = '**/api/classify';

/** `cat-groceries` is an EXPENSE category with a seeded rule (`groceries`) we avoid triggering. */
const GROCERIES = { id: 'cat-groceries', name: 'Groceries' };
const TRANSPORT = { id: 'cat-transport', name: 'Transport & Fuel' };

interface MockAnswer {
  categoryId: string | null;
  categoryConfidence: number;
  detectedType: 'INCOME' | 'EXPENSE';
  typeConfidence: number;
}

/**
 * Mocks the classifier and reports live request state. `maxInFlight` is what
 * lets a test assert the concurrency cap is real rather than aspirational.
 */
async function mockClassifier(page: Page, answer: MockAnswer, delayMs = 0) {
  const state = { count: 0, texts: [] as string[], maxInFlight: 0 };
  let inFlight = 0;

  await page.route(CLASSIFY_ROUTE, async (route: Route) => {
    state.count += 1;
    inFlight += 1;
    state.maxInFlight = Math.max(state.maxInFlight, inFlight);
    const body = route.request().postDataJSON() as { text: string };
    state.texts.push(body.text);

    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));

    inFlight -= 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(answer),
    });
  });

  return state;
}

/** Builds a CSV against the seeded `Main Checking` wallet, with no Category column. */
function csv(rows: Array<{ desc: string; amount: string }>): string {
  const header = 'Date,Wallet,Category,Type,Amount,Description,DestinationWallet';
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const lines = rows.map((r) => `${iso},Main Checking,,EXPENSE,${r.amount},${r.desc},`);
  return [header, ...lines].join('\n');
}

async function openImportWith(page: Page, content: string) {
  await gotoTab(page, 'transactions');
  await page.locator('#tx-import-csv-btn').click();
  const fileInput = page.locator('#csv-file-input');
  await expect(fileInput).toBeVisible();
  await fileInput.setInputFiles({
    name: 'import.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(content),
  });
  // The dry-run preview is the signal that parsing finished.
  await expect(page.locator('#commit-import-btn')).toBeEnabled();
}

test.describe('CSV import auto-categorization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('layer 1 categorizes rule hits with no network call at all', async ({ page }) => {
    const calls = await mockClassifier(page, {
      categoryId: TRANSPORT.id,
      categoryConfidence: 0.99,
      detectedType: 'EXPENSE',
      typeConfidence: 0.99,
    });

    // "coffee" is a seeded rule -> cat-food. "zzznovelmerchant" matches nothing.
    await openImportWith(page, csv([
      { desc: 'coffee run', amount: '80' },
      { desc: 'zzznovelmerchant', amount: '95' },
    ]));

    // The rule layer is synchronous and authoritative: it has already run by
    // the time the preview paints, and it costs nothing.
    await expect(page.getByTestId('csv-row-category-2')).toHaveValue('cat-food');
    await expect(page.getByTestId('csv-row-category-3')).toHaveValue('');
    expect(calls.count).toBe(0);

    // Only the unmatched row is offered to layer 2.
    await expect(page.locator('#csv-classify-btn')).toBeVisible();
    await expect(page.getByText(/1 matched by rules/)).toBeVisible();
    await expect(page.getByText(/1 uncategorized/)).toBeVisible();
  });

  test('a high-confidence answer fills the category and reaches the ledger', async ({ page }) => {
    const calls = await mockClassifier(page, {
      categoryId: TRANSPORT.id,
      categoryConfidence: 0.96,
      detectedType: 'EXPENSE',
      typeConfidence: 0.97,
    });

    const marker = `zzztaxi${Date.now().toString().slice(-6)}`;
    await openImportWith(page, csv([{ desc: marker, amount: '210' }]));

    await page.locator('#csv-classify-btn').click();
    await expect(page.getByTestId('csv-classify-note')).toBeVisible();

    await expect(page.getByTestId('csv-row-category-2')).toHaveValue(TRANSPORT.id);
    await expect(page.getByTestId('csv-row-confidence-2')).toContainText('96%');
    expect(calls.count).toBe(1);
    // Only the stripped description is sent - never the whole CSV row.
    expect(calls.texts[0]).toBe(marker);

    await page.locator('#commit-import-btn').click();
    await expect(page.getByText(/Successfully imported 1 transactions/i)).toBeVisible();

    // The preview is not the proof - the committed ledger row is.
    const row = page.locator('tr[id^="tx-row-"]').filter({ hasText: marker });
    await expect(row).toContainText(TRANSPORT.name);
  });

  test('a mid-confidence answer is offered but not applied until clicked', async ({ page }) => {
    await mockClassifier(page, {
      categoryId: GROCERIES.id,
      categoryConfidence: 0.62,
      detectedType: 'EXPENSE',
      typeConfidence: 0.9,
    });

    await openImportWith(page, csv([{ desc: 'zzzunknownshop', amount: '140' }]));
    await page.locator('#csv-classify-btn').click();
    await expect(page.getByTestId('csv-classify-note')).toBeVisible();

    // Below the 0.85 gate, so nothing was written - the same rule the live
    // form applies, so one confidence number means one thing in both places.
    await expect(page.getByTestId('csv-row-category-2')).toHaveValue('');

    const offer = page.getByTestId('csv-row-confidence-2');
    await expect(offer).toContainText(GROCERIES.name);
    await offer.click();
    await expect(page.getByTestId('csv-row-category-2')).toHaveValue(GROCERIES.id);
  });

  test('a manual override wins over both layers and survives the commit', async ({ page }) => {
    await mockClassifier(page, {
      categoryId: TRANSPORT.id,
      categoryConfidence: 0.99,
      detectedType: 'EXPENSE',
      typeConfidence: 0.99,
    });

    const marker = `zzzoverride${Date.now().toString().slice(-6)}`;
    await openImportWith(page, csv([{ desc: marker, amount: '55' }]));

    await page.locator('#csv-classify-btn').click();
    await expect(page.getByTestId('csv-row-category-2')).toHaveValue(TRANSPORT.id);

    await page.getByTestId('csv-row-category-2').selectOption(GROCERIES.id);
    await page.locator('#commit-import-btn').click();
    await expect(page.getByText(/Successfully imported 1 transactions/i)).toBeVisible();

    const row = page.locator('tr[id^="tx-row-"]').filter({ hasText: marker });
    await expect(row).toContainText(GROCERIES.name);
    await expect(row).not.toContainText(TRANSPORT.name);
  });

  test('repeated descriptions cost one request, not one per row', async ({ page }) => {
    const calls = await mockClassifier(page, {
      categoryId: TRANSPORT.id,
      categoryConfidence: 0.95,
      detectedType: 'EXPENSE',
      typeConfidence: 0.95,
    });

    // The shape of a real bank statement: the same merchant over and over.
    await openImportWith(page, csv([
      { desc: 'zzzrepeatmerchant', amount: '10' },
      { desc: 'zzzrepeatmerchant', amount: '20' },
      { desc: 'zzzrepeatmerchant', amount: '30' },
      { desc: 'zzzrepeatmerchant', amount: '40' },
    ]));

    await page.locator('#csv-classify-btn').click();
    await expect(page.getByTestId('csv-classify-note')).toBeVisible();

    // The classifier's module-level LRU cache is what makes a bulk import
    // affordable, and it is load-bearing for cost rather than just latency.
    expect(calls.count).toBe(1);

    // Every row still got the answer.
    for (const rowIndex of [2, 3, 4, 5]) {
      await expect(page.getByTestId(`csv-row-category-${rowIndex}`)).toHaveValue(TRANSPORT.id);
    }
  });

  test('concurrency never exceeds the cap', async ({ page }) => {
    const calls = await mockClassifier(
      page,
      { categoryId: TRANSPORT.id, categoryConfidence: 0.95, detectedType: 'EXPENSE', typeConfidence: 0.95 },
      120
    );

    // Ten distinct descriptions, so the cache cannot collapse them.
    await openImportWith(
      page,
      csv(Array.from({ length: 10 }, (_, i) => ({ desc: `zzzmerchant${i}`, amount: `${10 + i}` })))
    );

    await page.locator('#csv-classify-btn').click();
    await expect(page.getByTestId('csv-classify-note')).toBeVisible();

    expect(calls.count).toBe(10);
    // Not flooding is the actual rate-limit protection; retry is secondary.
    expect(calls.maxInFlight).toBeLessThanOrEqual(4);
  });

  test('the progress indicator reports counts while classifying', async ({ page }) => {
    await mockClassifier(
      page,
      { categoryId: TRANSPORT.id, categoryConfidence: 0.95, detectedType: 'EXPENSE', typeConfidence: 0.95 },
      250
    );

    await openImportWith(
      page,
      csv(Array.from({ length: 8 }, (_, i) => ({ desc: `zzzslowshop${i}`, amount: `${20 + i}` })))
    );

    await page.locator('#csv-classify-btn').click();

    const progress = page.getByTestId('csv-classify-progress');
    await expect(progress).toBeVisible();
    await expect(progress).toContainText(/Classifying \d+ of 8 with Jev/);

    // And it clears itself when the run finishes.
    await expect(progress).toHaveCount(0);
    await expect(page.getByTestId('csv-classify-note')).toBeVisible();
  });

  test('with no endpoint the importer says so and still commits', async ({ page }) => {
    // Deliberately no mock: the Vite dev server does not serve `api/`, so
    // this is the genuine offline / unconfigured-deployment path.
    const marker = `zzzoffline${Date.now().toString().slice(-6)}`;
    await openImportWith(page, csv([{ desc: marker, amount: '65' }]));

    await page.locator('#csv-classify-btn').click();

    await expect(page.getByTestId('csv-classify-note')).toContainText(/Jev is unavailable/i);
    await expect(page.getByTestId('csv-row-category-2')).toHaveValue('');

    // "Unavailable" must never mean "cannot import".
    await page.locator('#commit-import-btn').click();
    await expect(page.getByText(/Successfully imported 1 transactions/i)).toBeVisible();
    await expect(page.locator('tr[id^="tx-row-"]').filter({ hasText: marker })).toBeVisible();
  });
});
