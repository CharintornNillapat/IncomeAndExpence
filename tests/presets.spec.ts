import { test, expect } from '@playwright/test';
import { gotoTab } from './helpers';

/**
 * Transaction Templates ("quick presets"): a saved EXPENSE/INCOME shortcut
 * (name/amount/description/category/wallet) that can be replayed without
 * re-typing the same entry. Two independent surfaces exercise it:
 *  - `TransactionForm`'s own "Save as a quick template" checkbox (captures
 *    the just-submitted entry) and its template chip row (prefills the form
 *    for review before submitting).
 *  - `QuickAddModal`'s own chip list, which applies a template as a
 *    brand-new transaction in one tap (`applyPreset`) instead of prefilling.
 *
 * Presets are local-only (no Supabase table), so every assertion here holds
 * regardless of auth state - the sandbox app under test always runs
 * unauthenticated.
 */
test.describe('Transaction templates (quick presets)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('saving a transaction as a template surfaces it as a one-tap Quick Add chip, formatted as THB', async ({ page }) => {
    const templateName = `E2E Template ${Date.now().toString().slice(-6)}`;
    const description = `E2E Template Source ${Date.now().toString().slice(-6)}`;

    await page.locator('#navbar-quick-add-btn').click();
    const modal = page.getByRole('dialog', { name: /Quick Record Transaction/i });
    await expect(modal).toBeVisible();

    await modal.locator('input[name="amount_expression"]').fill('175');
    await modal.locator('input[id$="-desc"]').fill(description);

    await modal.getByLabel('Save as a quick template').check();
    await modal.locator('input[id$="-template-name"]').fill(templateName);

    await modal.locator('button[type="submit"]').click();
    await expect(modal).not.toBeVisible();

    // Reopen and confirm the template is now offered as a chip. The amount
    // must render through `formatCurrencyAmount` (CLAUDE.md: never a
    // hand-rolled `.toFixed(2)`), so it reads "฿175.00", not "$175.00" or
    // "175" or "175.000".
    await page.locator('#navbar-quick-add-btn').click();
    await expect(modal).toBeVisible();
    const chip = page.locator('[id^="quickadd-preset-chip-"]').filter({ hasText: templateName });
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('฿175.00');
  });

  test('tapping a Quick Add template chip logs a new transaction immediately and closes the modal', async ({ page }) => {
    const templateName = `E2E OneTap ${Date.now().toString().slice(-6)}`;
    const description = `E2E OneTap Source ${Date.now().toString().slice(-6)}`;

    await page.locator('#navbar-quick-add-btn').click();
    const modal = page.getByRole('dialog', { name: /Quick Record Transaction/i });
    await expect(modal).toBeVisible();
    await modal.locator('input[name="amount_expression"]').fill('88');
    await modal.locator('input[id$="-desc"]').fill(description);
    await modal.getByLabel('Save as a quick template').check();
    await modal.locator('input[id$="-template-name"]').fill(templateName);
    await modal.locator('button[type="submit"]').click();
    await expect(modal).not.toBeVisible();

    // Re-open and one-tap apply. This must fire a second, brand-new
    // transaction reusing the saved template - not resubmit the first one -
    // so the description now appears twice in the ledger.
    await page.locator('#navbar-quick-add-btn').click();
    await expect(modal).toBeVisible();
    const applyBtn = page.locator('button[id^="quickadd-preset-apply-"]').filter({ hasText: templateName });
    await applyBtn.click();
    await expect(modal).not.toBeVisible();

    await gotoTab(page, 'transactions');
    const rows = page.locator('tr[id^="tx-row-"]').filter({ hasText: description });
    await expect(rows).toHaveCount(2);
  });

  test("a template chip inside the transaction form prefills fields without submitting", async ({ page }) => {
    const templateName = `E2E Prefill ${Date.now().toString().slice(-6)}`;
    const description = `E2E Prefill Source ${Date.now().toString().slice(-6)}`;

    await page.locator('#navbar-quick-add-btn').click();
    const modal = page.getByRole('dialog', { name: /Quick Record Transaction/i });
    await expect(modal).toBeVisible();
    await modal.locator('input[name="amount_expression"]').fill('240');
    await modal.locator('input[id$="-desc"]').fill(description);
    await modal.getByLabel('Save as a quick template').check();
    await modal.locator('input[id$="-template-name"]').fill(templateName);
    await modal.locator('button[type="submit"]').click();
    await expect(modal).not.toBeVisible();

    // Reopen and use the FORM's own template chip (distinct from Quick Add's
    // one-tap chip covered above) - it must prefill, not submit.
    await page.locator('#navbar-quick-add-btn').click();
    await expect(modal).toBeVisible();
    const formChip = modal.locator('button[id*="-preset-chip-"]').filter({ hasText: templateName });
    await expect(formChip).toBeVisible();
    await formChip.click();

    await expect(modal.locator('input[name="amount_expression"]')).toHaveValue('240');
    await expect(modal.locator('input[id$="-desc"]')).toHaveValue(description);

    // No submission happened - the modal is still open and only the one
    // transaction from the initial save exists so far.
    await expect(modal).toBeVisible();

    await page.locator('#close-quick-record-modal-btn').click();
    await expect(modal).not.toBeVisible();

    await gotoTab(page, 'transactions');
    const rows = page.locator('tr[id^="tx-row-"]').filter({ hasText: description });
    await expect(rows).toHaveCount(1);
  });

  test('deleting a template from Quick Add removes its chip', async ({ page }) => {
    const templateName = `E2E Delete ${Date.now().toString().slice(-6)}`;
    const description = `E2E Delete Source ${Date.now().toString().slice(-6)}`;

    await page.locator('#navbar-quick-add-btn').click();
    const modal = page.getByRole('dialog', { name: /Quick Record Transaction/i });
    await expect(modal).toBeVisible();
    await modal.locator('input[name="amount_expression"]').fill('60');
    await modal.locator('input[id$="-desc"]').fill(description);
    await modal.getByLabel('Save as a quick template').check();
    await modal.locator('input[id$="-template-name"]').fill(templateName);
    await modal.locator('button[type="submit"]').click();
    await expect(modal).not.toBeVisible();

    await page.locator('#navbar-quick-add-btn').click();
    await expect(modal).toBeVisible();
    const chip = page.locator('[id^="quickadd-preset-chip-"]').filter({ hasText: templateName });
    await expect(chip).toBeVisible();

    await chip.getByRole('button', { name: `Delete ${templateName} template` }).click();
    await expect(chip).toHaveCount(0);
  });

  test('submitting a second transaction with a duplicate template name does not create a second template', async ({ page }) => {
    const templateName = `E2E Dup ${Date.now().toString().slice(-6)}`;

    await page.locator('#navbar-quick-add-btn').click();
    const modal = page.getByRole('dialog', { name: /Quick Record Transaction/i });
    await expect(modal).toBeVisible();
    await modal.locator('input[name="amount_expression"]').fill('40');
    await modal.locator('input[id$="-desc"]').fill('E2E Dup Source One');
    await modal.getByLabel('Save as a quick template').check();
    await modal.locator('input[id$="-template-name"]').fill(templateName);
    await modal.locator('button[type="submit"]').click();
    await expect(modal).not.toBeVisible();

    // The transaction itself is independent of the template-name guard, so
    // the second submission still succeeds (and the modal still closes) even
    // though `addPreset`'s duplicate-name check silently rejects the second
    // template save underneath it.
    await page.locator('#navbar-quick-add-btn').click();
    await expect(modal).toBeVisible();
    await modal.locator('input[name="amount_expression"]').fill('45');
    await modal.locator('input[id$="-desc"]').fill('E2E Dup Source Two');
    await modal.getByLabel('Save as a quick template').check();
    await modal.locator('input[id$="-template-name"]').fill(templateName);
    await modal.locator('button[type="submit"]').click();
    await expect(modal).not.toBeVisible();

    await page.locator('#navbar-quick-add-btn').click();
    await expect(modal).toBeVisible();
    const chips = page.locator('[id^="quickadd-preset-chip-"]').filter({ hasText: templateName });
    await expect(chips).toHaveCount(1);
  });
});

/**
 * T21-style regression coverage (see `date-boundary.spec.ts`): `applyPreset`
 * must date the replayed transaction with `todayIsoDate()` (local calendar
 * day), never a UTC-sliced `toISOString().slice(0, 10)`. Pinning the clock
 * inside the 00:00-06:59 local danger window at UTC+7 is what would expose a
 * regression back to the UTC-slicing bug - at any other time of day the two
 * would coincidentally agree.
 */
test.describe('Preset apply respects local calendar days (UTC+7)', () => {
  test.use({ timezoneId: 'Asia/Bangkok' });

  test('applying a template just after local midnight dates the new transaction on the correct local day', async ({ page }) => {
    // 02:15 local on 2026-09-18 is 2026-09-17T19:15:00.000Z - a UTC-sliced
    // date would misfile this transaction as 2026-09-17.
    await page.clock.setFixedTime(new Date('2026-09-18T02:15:00+07:00'));
    await page.goto('/');

    const templateName = `E2E Boundary ${Date.now().toString().slice(-6)}`;
    const description = `E2E Boundary Source ${Date.now().toString().slice(-6)}`;

    await page.locator('#navbar-quick-add-btn').click();
    const modal = page.getByRole('dialog', { name: /Quick Record Transaction/i });
    await expect(modal).toBeVisible();
    await modal.locator('input[name="amount_expression"]').fill('55');
    await modal.locator('input[id$="-desc"]').fill(description);
    await modal.getByLabel('Save as a quick template').check();
    await modal.locator('input[id$="-template-name"]').fill(templateName);
    await modal.locator('button[type="submit"]').click();
    await expect(modal).not.toBeVisible();

    await page.locator('#navbar-quick-add-btn').click();
    await expect(modal).toBeVisible();
    const applyBtn = page.locator('button[id^="quickadd-preset-apply-"]').filter({ hasText: templateName });
    await applyBtn.click();
    await expect(modal).not.toBeVisible();

    await gotoTab(page, 'transactions');
    // Both the original save-as-template submission and the one-tap replay
    // were created at this same pinned instant, so both rows must carry the
    // local calendar day.
    const rows = page.locator('tr[id^="tx-row-"]').filter({ hasText: description });
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: '2026-09-18' })).toHaveCount(2);
    await expect(rows.filter({ hasText: '2026-09-17' })).toHaveCount(0);
  });
});
