import { test, expect } from '@playwright/test';
import { gotoTab } from './helpers';

/**
 * Characterizes the keyword-to-category auto-matcher (`matchSmartDescription`)
 * as exercised through KeywordRulesView's live sandbox, plus the write path
 * that adds a new rule to the configured list. `250 coffee with friends`
 * exercises one of the app's default seeded rules (`coffee` -> Food & Dining)
 * so the sandbox test needs no setup of its own.
 */
test.describe('Keyword auto-categorization rules', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'keywords');
  });

  test('sandbox evaluates amount, category, type, and cleaned description from a default rule', async ({ page }) => {
    await page.locator('#test-parser-input').fill('250 coffee with friends');

    const amountRow = page.locator('div.flex.justify-between', { hasText: 'Extracted Amount:' });
    await expect(amountRow).toContainText('฿250.00');

    const categoryRow = page.locator('div.flex.justify-between', { hasText: 'Matched Category:' });
    await expect(categoryRow).toContainText('Food & Dining');

    const typeRow = page.locator('div.flex.justify-between', { hasText: 'Inferred Type:' });
    await expect(typeRow).toContainText('EXPENSE');

    const descRow = page.locator('div.flex.justify-between', { hasText: 'Cleaned Description:' });
    await expect(descRow).toContainText('coffee with friends');
  });

  test('adding a new rule makes it available to the sandbox immediately', async ({ page }) => {
    const uniqueKeyword = `zzzteste2e${Date.now().toString().slice(-6)}`;

    await page.locator('#new-keyword-input').fill(uniqueKeyword);
    await page.locator('#keyword-category-select').selectOption({ label: 'Groceries (EXPENSE)' });
    await page.locator('#save-keyword-rule-btn').click();

    const ruleRow = page.locator('tr[id^="rule-row-"]').filter({ hasText: uniqueKeyword });
    await expect(ruleRow).toBeVisible();
    await expect(ruleRow).toContainText('Groceries');

    // Local Storage Mode has no network round-trip - the new rule is live in
    // state immediately, so the sandbox above should pick it up right away.
    await page.locator('#test-parser-input').fill(`80 ${uniqueKeyword}`);
    const categoryRow = page.locator('div.flex.justify-between', { hasText: 'Matched Category:' });
    await expect(categoryRow).toContainText('Groceries');
    const amountRow = page.locator('div.flex.justify-between', { hasText: 'Extracted Amount:' });
    await expect(amountRow).toContainText('฿80.00');
  });
});
