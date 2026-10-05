// TEMPORARY (Phase 86): proves a failed attempt's trace reaches the merged
// report. Removed before the PR is marked ready.
import { test, expect } from '@playwright/test';

test('merge probe: always fails', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#merge-probe-missing')).toBeVisible({ timeout: 2000 });
});

test('merge probe: fails on its first attempt only', async ({ page }, testInfo) => {
  await page.goto('/');
  expect(testInfo.retry, 'first attempt fails on purpose').toBeGreaterThan(0);
});
