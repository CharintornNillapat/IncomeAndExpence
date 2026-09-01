import { test, expect } from '@playwright/test';

test.describe('Holistic Mini Diary E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate to Diary view, rate daily mood, and save wellbeing entry', async ({ page }) => {
    // 1. Navigate to Diary tab
    const diaryTab = page.locator('#nav-tab-diary');
    if (await diaryTab.isVisible()) {
      await diaryTab.click();
    } else {
      await page.getByRole('button', { name: /Diary/i }).first().click();
    }

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

    // 6. Assert success feedback / entry updated in historical list
    await expect(page.locator('p').filter({ hasText: /Playwright automated wellbeing log/i })).toBeVisible();
  });
});
