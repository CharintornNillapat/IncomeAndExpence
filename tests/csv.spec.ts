import fs from 'fs';
import { test, expect } from '@playwright/test';
import { gotoTab, addQuickTransaction } from './helpers';

/**
 * Exercises the CSV export -> import round trip: `exportTransactionsToCsv`'s
 * output must be a file `parseAndValidateTransactionCsv` can read back into a
 * valid, committable row. This is the one path with no other coverage - a
 * format drift between the exporter and importer (a renamed header, a
 * changed date format) would otherwise only surface in production as a
 * silent "0 valid rows".
 */
test.describe('CSV export/import round trip', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('an exported transaction re-imports as a valid row', async ({ page }) => {
    const marker = `E2E CSV RoundTrip ${Date.now().toString().slice(-6)}`;
    await addQuickTransaction(page, marker, '321');
    await gotoTab(page, 'transactions');
    await expect(page.getByText(marker)).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#tx-export-csv-btn').click();
    const download = await downloadPromise;

    const csvPath = await download.path();
    expect(csvPath).not.toBeNull();
    const csvContent = fs.readFileSync(csvPath as string, 'utf-8');
    expect(csvContent).toContain(marker);
    expect(csvContent).toContain('321.00');

    await page.locator('#tx-import-csv-btn').click();
    const fileInput = page.locator('#csv-file-input');
    await expect(fileInput).toBeVisible();
    await fileInput.setInputFiles({
      name: 'roundtrip.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });

    const commitBtn = page.locator('#commit-import-btn');
    await expect(commitBtn).toBeEnabled();
    await commitBtn.click();

    await expect(page.getByText(/Successfully imported 1 transactions/i)).toBeVisible();

    // The re-imported row is a genuinely new transaction, not a merge - the
    // marker now appears twice in the ledger: the original quick-add plus the
    // round-tripped CSV row.
    await expect(page.getByText(marker)).toHaveCount(2);
  });
});
