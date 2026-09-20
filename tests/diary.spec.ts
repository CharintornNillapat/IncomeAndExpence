import fs from 'fs';
import { test, expect } from '@playwright/test';
import { gotoTab } from './helpers';

test.describe('Holistic Mini Diary E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate to Diary view, rate daily mood, and save wellbeing entry', async ({ page }) => {
    // 1. Navigate to Diary tab (waits for the lazy view chunk to resolve)
    await gotoTab(page, 'diary');

    // 2. Verify Diary header
    await expect(page.getByRole('heading', { name: /Holistic Mini Diary/i })).toBeVisible();

    // 3. Select 5-star Peak Flow mood
    const mood5Btn = page.locator('#mood-btn-5');
    await expect(mood5Btn).toBeVisible();
    await mood5Btn.click();

    // 4. Fill in reflection notes
    const notesInput = page.locator('#diary-notes-textarea');
    await notesInput.fill('Playwright automated wellbeing log: High energy & productive day.');

    // 5. Save Diary entry
    const saveBtn = page.locator('#save-diary-entry-btn');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // 6. Wait for the save to be confirmed, then assert the entry reached the
    // historical list. Saving is async (validation + persistence), so assert on
    // the success badge first rather than racing straight to the list.
    await expect(page.getByText(/Diary entry logged/i)).toBeVisible();
    // `data-testid` (T32) replaces a bare `page.locator('p')`, which broke
    // if the note element ever stopped being a `<p>`.
    await expect(page.locator('[data-testid="diary-entry-notes"]')).toContainText(
      /Playwright automated wellbeing log/i
    );

    // 7. Export downloads a JSON file (T77: split from `csvExchange.ts` into
    // its own module) - the one action in this view with no other coverage;
    // a broken export would otherwise only surface as "nothing happens".
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#export-diary-btn').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^holistic_diary_export_\d{4}-\d{2}-\d{2}\.json$/);
    const jsonPath = await download.path();
    expect(jsonPath).not.toBeNull();
    const jsonContent = fs.readFileSync(jsonPath as string, 'utf-8');
    expect(jsonContent).toContain('Playwright automated wellbeing log');
  });
});
