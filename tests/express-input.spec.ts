import { test, expect, type Page } from '@playwright/test';
import { gotoTab } from './helpers';

/**
 * Combined express input (ADR 0013).
 *
 * The note field at the top of `TransactionForm` is the entry point for the
 * whole form: it fills the amount below it, the category, and the type. This
 * spec pins the parser's behaviour through the real UI and, critically, pins
 * the one rule the rest of the suite silently depends on - see the
 * "manual amount" test below.
 *
 * No `page.route()` here. These paths are the parser and the synchronous
 * keyword-rule layer; `/api/classify` is not served by the Vite dev server, so
 * the Jev layer latches itself off exactly as it does for the other specs.
 */

async function openQuickAdd(page: Page) {
  await page.locator('#navbar-quick-add-btn').click();
  const modal = page.getByRole('dialog', { name: /Quick Record Transaction/i });
  await expect(modal).toBeVisible();
  return modal;
}

test.describe('Express note input', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('a trailing amount in the note fills the amount field, and the note is stored in full', async ({
    page,
  }) => {
    const modal = await openQuickAdd(page);

    await modal.locator('input[id$="-desc"]').fill('ข้าวมันไก่ 60');

    // Parsed out of the note - the user never touched the amount field.
    await expect(modal.locator('input[name="amount_expression"]')).toHaveValue('60');
    // The submit button mirrors the evaluated amount, so this is the form
    // state and not just the text in the input.
    await expect(modal.locator('button[type="submit"]')).toContainText('฿60.00');

    await modal.locator('button[type="submit"]').click();
    await expect(modal).not.toBeVisible();

    // The ledger keeps what was typed, amount and all. Stripping the number
    // here would be lossy, and a mis-parse would mangle the note as well as
    // the amount.
    await gotoTab(page, 'transactions');
    await expect(page.locator('tr[id^="tx-row-"]').filter({ hasText: 'ข้าวมันไก่ 60' })).toBeVisible();
  });

  test('a leading amount in the note is parsed too', async ({ page }) => {
    const modal = await openQuickAdd(page);

    await modal.locator('input[id$="-desc"]').fill('1200 ค่าไฟ');

    await expect(modal.locator('input[name="amount_expression"]')).toHaveValue('1200');
    await expect(modal.locator('button[type="submit"]')).toContainText('฿1,200.00');
  });

  test('an inline math expression inside the note is evaluated', async ({ page }) => {
    const modal = await openQuickAdd(page);

    await modal.locator('input[id$="-desc"]').fill('lunch 120/4 + 15*2');

    // The expression travels into the amount field intact and is evaluated
    // there, so the math badge reports the result rather than the form
    // silently pre-computing it.
    await expect(modal.locator('input[name="amount_expression"]')).toHaveValue('120/4 + 15*2');
    await expect(modal.locator('span', { hasText: /Calculated:/i })).toContainText('60.00');
    await expect(modal.locator('button[type="submit"]')).toContainText('฿60.00');
  });

  /**
   * The load-bearing rule. `csv.spec.ts`, `soft-delete.spec.ts` and
   * `presets.spec.ts` all seed a note ending in six digits *after* filling the
   * amount by hand, and they assert on amounts and balances. If a note could
   * overwrite an amount the user already entered, every one of them would fail
   * on a value - which the spec-edit policy forbids papering over.
   */
  test('an amount the user typed is never overwritten by the note', async ({ page }) => {
    const modal = await openQuickAdd(page);
    const amountInput = modal.locator('input[name="amount_expression"]');

    await amountInput.fill('321');
    await expect(modal.locator('button[type="submit"]')).toContainText('฿321.00');

    // A note that ends in digits, exactly like the markers the other specs use.
    await modal.locator('input[id$="-desc"]').fill('E2E Express RoundTrip 123456');

    await expect(amountInput).toHaveValue('321');
    await expect(modal.locator('button[type="submit"]')).toContainText('฿321.00');
  });

  /**
   * ADR 0013 removed the "Edit details" collapse: an auto-categorization used
   * to take the category `<select>` out of the DOM entirely, so overriding the
   * guess cost two clicks and could not be seen at all until the first one.
   */
  test('an auto-categorized note leaves the category selector on screen', async ({ page }) => {
    const modal = await openQuickAdd(page);
    const categorySelect = modal.locator('select[id$="-category"]');

    // "coffee" matches seeded rule kw-1 -> cat-food, resolved synchronously by
    // the keyword layer with no network call.
    await modal.locator('input[id$="-desc"]').fill('coffee 85');

    await expect(modal.getByText(/Auto-categorized:/i)).toBeVisible();
    // Both at once is the whole point: the badge reports the guess and the
    // control that overrides it is right there, unexpanded.
    await expect(categorySelect).toBeVisible();
    await expect(categorySelect).toHaveValue('cat-food');
    await expect(modal.locator('input[name="amount_expression"]')).toHaveValue('85');
  });
});
