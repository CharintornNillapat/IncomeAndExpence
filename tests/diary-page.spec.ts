import { test, expect, Page } from '@playwright/test';
import { addQuickTransaction, gotoTab } from './helpers';

/**
 * The Daily diary (Phase 61, spec 6.5, ADR 0036), as a guest. A fresh context
 * has no diary entries and no transactions.
 *
 * Nothing is intercepted. Dates are read in the page, so they are the
 * browser's own local calendar days.
 */
async function localDay(page: Page, offset: number): Promise<string> {
  return page.evaluate((days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, offset);
}

async function saveEntry(page: Page, mood: number, notes: string) {
  await page.locator(`#mood-btn-${mood}`).click();
  await page.locator('#diary-notes-textarea').fill(notes);
  await page.locator('#save-diary-entry-btn').click();
  await expect(page.locator('#diary-save-status')).toContainText('Diary entry logged');
}

test.describe('The Daily diary page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test("a calendar day loads that day's entry into the form", async ({ page }) => {
    await gotoTab(page, 'diary');
    const today = await localDay(page, 0);
    const yesterday = await localDay(page, -1);

    // Log yesterday, then come back to today, which has no entry.
    await page.locator('#diary-prev-day-btn').click();
    await saveEntry(page, 2, 'E2E yesterday entry');
    await page.locator('#diary-next-day-btn').click();
    await expect(page.locator('#diary-next-day-btn')).toBeDisabled();
    await expect(page.locator('#mood-btn-2')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#save-diary-entry-btn')).toBeDisabled();

    if (yesterday.slice(0, 7) !== today.slice(0, 7)) await page.locator('#diary-cal-prev-month-btn').click();
    const day = page.locator(`#diary-cal-day-${yesterday}`);
    await expect(day).toHaveAttribute('aria-label', /, logged$/);
    await day.click();

    await expect(page.locator('#mood-btn-2')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#diary-notes-textarea')).toHaveValue('E2E yesterday entry');
  });

  test('Delete in an entry\'s menu asks first, and Cancel keeps the entry', async ({ page }) => {
    await gotoTab(page, 'diary');
    await saveEntry(page, 4, 'E2E entry to delete');
    const card = page.locator('[id^="diary-card-"]').filter({ hasText: 'E2E entry to delete' });
    await expect(card).toBeVisible();

    await card.locator('button[id^="diary-menu-btn-"]').click();
    await card.locator('button[id^="delete-diary-"]').click();
    const dialog = page.getByRole('dialog', { name: 'Delete diary entry' });
    await expect(dialog).toContainText("That day's transactions are not touched.");
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(card).toBeVisible();

    await card.locator('button[id^="diary-menu-btn-"]').click();
    await card.locator('button[id^="delete-diary-"]').click();
    await page.locator('#confirm-destructive-btn').click();
    await expect(card).toHaveCount(0);

    await page.reload();
    await gotoTab(page, 'diary');
    await expect(page.locator('[id^="diary-card-"]').filter({ hasText: 'E2E entry to delete' })).toHaveCount(0);
  });

  test('"N transactions" opens the Transactions page on that day, and the chip clears it', async ({ page }) => {
    const marker = `E2E Diary Day ${Date.now().toString().slice(-6)}`;
    await addQuickTransaction(page, marker, '75');
    await gotoTab(page, 'diary');
    await expect(page.locator('#diary-day-spending')).toContainText('Today · spent ฿75.00 in 1 transaction so far');
    await saveEntry(page, 3, 'E2E day with spending');

    const today = await localDay(page, 0);
    await page.locator(`#diary-day-tx-link-${today}`).click();
    await expect(page.locator('#nav-tab-transactions')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#tx-day-filter')).toBeVisible();
    await expect(page.locator('button[id^="tx-row-"]').filter({ hasText: marker })).toBeVisible();

    await page.locator('#tx-day-filter').click();
    await expect(page.locator('#tx-day-filter')).toHaveCount(0);
    await expect(page.locator('button[id^="tx-row-"]').filter({ hasText: marker })).toBeVisible();
  });
});
