import { test, expect } from '@playwright/test';
import { gotoTab } from './helpers';

/**
 * Characterizes the keyword-to-category auto-matcher (`matchSmartDescription`)
 * as exercised through the Categories view's "Smart Rules" sub-tab, plus the
 * write path that adds a new rule to the configured list. `250 coffee with
 * friends` exercises one of the app's default seeded rules (`coffee` ->
 * Food & Dining) so the sandbox test needs no setup of its own.
 *
 * Phase 30: this view (formerly the standalone `KeywordRulesView` under a
 * "Smart Rules" nav tab) merged into `CategoriesView` under a "Categories"
 * nav tab, with the sandbox/rules table living behind a `SegmentedControl`
 * sub-tab. Every element id/`data-testid` this spec targets is unchanged -
 * only the navigation and the one-time sub-tab click are new.
 */
test.describe('Keyword auto-categorization rules', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'categories');
    await page.locator('#category-subtab-rules').click();
  });

  test('sandbox evaluates amount, category, type, and cleaned description from a default rule', async ({ page }) => {
    await page.locator('#test-parser-input').fill('250 coffee with friends');

    // `data-testid` (T32) replaces a `div.flex.justify-between` + label-text
    // filter, which was both class-structural and copy-dependent.
    const amountRow = page.locator('[data-testid="metric-extracted-amount"]');
    await expect(amountRow).toContainText('฿250.00');

    const categoryRow = page.locator('[data-testid="metric-matched-category"]');
    await expect(categoryRow).toContainText('Food & Dining');

    const typeRow = page.locator('[data-testid="metric-inferred-type"]');
    await expect(typeRow).toContainText('EXPENSE');

    const descRow = page.locator('[data-testid="metric-cleaned-description"]');
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
    const categoryRow = page.locator('[data-testid="metric-matched-category"]');
    await expect(categoryRow).toContainText('Groceries');
    const amountRow = page.locator('[data-testid="metric-extracted-amount"]');
    await expect(amountRow).toContainText('฿80.00');
  });
});
