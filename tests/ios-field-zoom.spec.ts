import { test, expect, Page } from '@playwright/test';
import { gotoTab, addQuickTransaction } from './helpers';

/**
 * ADR 0068: zoom is allowed again, and iOS Safari zooms into a field whose text
 * is under 16px when it takes focus. `index.css` raises every field's
 * `text-xs` and `text-sm` to 16px under `@supports (-webkit-touch-callout:
 * none)`, which only iOS Safari matches. No test browser matches it, so this
 * spec reads that rule's own text from the page's stylesheets and applies it
 * unconditionally, then opens every form and measures each field.
 */

/** The declarations inside the iOS-only `@supports` block, as the page loaded them. */
async function applyIosFieldRule(page: Page): Promise<void> {
  const inner = await page.evaluate(() => {
    const found: string[] = [];
    const walk = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSSupportsRule && rule.conditionText.includes('-webkit-touch-callout')) {
          for (const r of Array.from(rule.cssRules)) found.push(r.cssText);
        } else if ('cssRules' in rule) {
          walk((rule as CSSGroupingRule).cssRules);
        }
      }
    };
    for (const sheet of Array.from(document.styleSheets)) walk(sheet.cssRules);
    return found;
  });
  expect(inner.length, 'the iOS field rule is in the stylesheet').toBeGreaterThan(0);
  await page.addStyleTag({ content: `@layer base { ${inner.join('\n')} }` });
}

/** The visible text-entry fields inside `scope`: how many, and which are under 16px. */
async function measureFields(page: Page, scope: string): Promise<{ measured: number; small: string[] }> {
  return page.evaluate((scope) => {
    const skip = new Set(['checkbox', 'radio', 'range', 'color', 'hidden', 'button', 'submit', 'reset', 'file']);
    const fields = Array.from(document.querySelectorAll<HTMLElement>(`${scope} :is(input, select, textarea)`))
      .filter((el) => !(el instanceof HTMLInputElement && skip.has(el.type)))
      .filter((el) => el.getClientRects().length > 0);
    return {
      measured: fields.length,
      small: fields
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
        .map((el) => `${el.id || el.getAttribute('name') || el.getAttribute('data-testid') || el.tagName} (${getComputedStyle(el).fontSize})`),
    };
  }, scope);
}

/** Fields in `scope` exist, and none is under 16px. Polled: a view or dialog renders its fields after it opens. */
async function expectNoSmallFields(page: Page, scope: string, where: string): Promise<void> {
  await expect
    .poll(async () => {
      const { measured, small } = await measureFields(page, scope);
      return measured === 0 ? ['no field rendered yet'] : small;
    }, { message: where })
    .toEqual([]);
}

/**
 * Closes the open dialog with its own close button. Not Escape: `Modal` attaches
 * its Escape listener in a passive effect, which WebKit can run after a key
 * pressed the moment a lazy dialog appears. Escape is other specs' business.
 */
async function closeDialog(page: Page): Promise<void> {
  await page.getByRole('dialog').getByRole('button', { name: 'Close modal' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Opens a dialog, waits for it, measures its fields, and closes it. */
async function checkDialog(page: Page, opener: string, where: string): Promise<void> {
  await page.locator(opener).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoSmallFields(page, '[role="dialog"]', where);
  await closeDialog(page);
}

test.describe('iOS field size (ADR 0068)', () => {
  test('without the iOS rule, desktop fields keep their 12px text', async ({ page }) => {
    // The negative control: the measurement sees a small field when one exists,
    // and the rule does not apply outside iOS.
    await page.goto('/');
    await gotoTab(page, 'transactions');
    await expect.poll(async () => (await measureFields(page, 'main')).small).toContain('tx-search-input (12px)');
  });

  test('with the iOS rule, every field on every form is at least 16px', async ({ page }) => {
    await page.goto('/');
    await applyIosFieldRule(page);
    await addQuickTransaction(page, 'E2E iOS field size', '75');

    await checkDialog(page, '#navbar-quick-add-btn', 'Quick Add');

    // Transactions: the filter bar, the Add dialog, and a row's edit panel.
    await gotoTab(page, 'transactions');
    await expectNoSmallFields(page, 'main', 'Transactions filters');
    await checkDialog(page, '#tx-open-add-modal-btn', 'Add transaction');
    await page.locator('[id^="tx-row-"]').first().click();
    await expect(page.locator('#tx-edit-amount')).toBeVisible();
    await expectNoSmallFields(page, 'main', 'Edit transaction');

    // A size above 16px is left alone: the edit panel's amount stays 24px.
    await expect(page.locator('#tx-edit-amount')).toHaveCSS('font-size', '24px');

    // The CSV import preview, with its per-row category select.
    await page.locator('#tx-import-export-btn').click();
    await page.locator('#tx-import-csv-btn').click();
    await page.locator('#csv-file-input').setInputFiles({
      name: 'size.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Date,Wallet,Type,Amount,Description\n2026-09-28,Main Checking,EXPENSE,10,Size check\n'),
    });
    await expect(page.locator('[data-testid^="csv-row-category-"]').first()).toBeVisible();
    await expectNoSmallFields(page, '[role="dialog"]', 'CSV import preview');
    await closeDialog(page);

    // Wallets: Add wallet and Transfer.
    await gotoTab(page, 'wallets');
    await checkDialog(page, '#wallet-add-modal-btn', 'Add wallet');
    await checkDialog(page, '#wallet-transfer-modal-btn', 'Transfer');

    // Debt payoff: the add form.
    await gotoTab(page, 'debts');
    await checkDialog(page, '#open-add-debt-btn', 'Add debt');

    // Daily diary.
    await gotoTab(page, 'diary');
    await expectNoSmallFields(page, 'main', 'Diary');

    // Categories: the form and the Smart rules tab.
    await gotoTab(page, 'categories');
    await expectNoSmallFields(page, 'main', 'Category form');
    await page.locator('#category-subtab-rules').click();
    await expect(page.locator('#new-keyword-input')).toBeVisible();
    await expectNoSmallFields(page, 'main', 'Smart rules');

    // Sign in, last, so it is left open.
    await page.locator('#navbar-signin-btn').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoSmallFields(page, '[role="dialog"]', 'Sign in');
  });
});
