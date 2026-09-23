import { test, expect, type Page } from '@playwright/test';
import { gotoTab } from './helpers';

/**
 * Covers the payoff block added in ADR `0015`: the three quick-payoff chips,
 * the live remaining-balance projection, and the payoff `ProgressMeter`.
 *
 * `tests/debts.spec.ts` stays the regression guard for the repayment lifecycle
 * itself and is deliberately untouched by this phase - the chips seed *through*
 * `#repay-amount-math` rather than replacing it, so the ids that spec fills are
 * unchanged. This file only asserts on what is new.
 *
 * Two behaviours here are pinned so a later phase cannot quietly reverse them:
 * overpayment **warns without blocking** (the ledger permits it, and a
 * CREDIT_CARD-style deliberate overpayment for interest or fees is a real
 * case), and a chip **latches the amount field** against the express note
 * parser exactly as typing in it by hand does (ADR `0013`).
 */

/** Creates a debt goal from the Add Debt form and returns its card locator. */
async function createDebt(
  page: Page,
  { total, minimum }: { total?: string; minimum?: string } = {}
) {
  await page.locator('#open-add-debt-btn').click();

  const name = `E2E Payoff ${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
  const nameInput = page.locator('#new-debt-name');
  await expect(nameInput).toBeVisible();
  await nameInput.fill(name);

  // Total writes Remaining too (they are bound in DebtsView), so it must be
  // filled before any explicit Remaining value would be.
  if (total) await page.locator('#new-debt-total').fill(total);
  if (minimum) await page.locator('#new-debt-min-payment').fill(minimum);

  await page.locator('#save-new-debt-btn').click();

  const card = page.locator('div[id^="debt-card-"]').filter({ hasText: name });
  await expect(card).toBeVisible();
  return card;
}

/** Opens the repay modal for a debt card and waits for the payoff block. */
async function openRepay(page: Page, card: ReturnType<Page['locator']>) {
  await card.locator('button[id^="open-repay-modal-"]').click();
  await expect(page.locator('#repay-amount-math')).toBeVisible();
  await expect(page.getByTestId('repay-payoff-preview')).toBeVisible();
}

const amountField = (page: Page) => page.locator('#repay-amount-math');
const remainingAfter = (page: Page) => page.getByTestId('repay-remaining-after');
const preview = (page: Page) => page.getByTestId('repay-payoff-preview');

test.describe('Debt payoff chips and live preview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'debts');
  });

  test('"Pay in full" seeds the whole remainder and projects a settled debt', async ({ page }) => {
    const card = await createDebt(page);
    await openRepay(page, card);

    await page.locator('#repay-payoff-full').click();

    // The chip seeds through `seed`, so the amount field itself is filled -
    // it is not a parallel value held somewhere else.
    await expect(amountField(page)).toHaveValue('5000');
    await expect(remainingAfter(page)).toHaveText('฿0.00');
    await expect(preview(page)).toContainText('100.0%');
    await expect(page.getByTestId('repay-settle-note')).toBeVisible();
  });

  test('"50%" seeds half the remainder and projects half the progress', async ({ page }) => {
    const card = await createDebt(page);
    await openRepay(page, card);

    await page.locator('#repay-payoff-half').click();

    await expect(amountField(page)).toHaveValue('2500');
    await expect(remainingAfter(page)).toHaveText('฿2,500.00');
    await expect(preview(page)).toContainText('50.0%');
    // Half of the debt is not a payoff - neither note applies.
    await expect(page.getByTestId('repay-settle-note')).toHaveCount(0);
    await expect(page.getByTestId('repay-overpayment-note')).toHaveCount(0);
  });

  test('"Minimum due" seeds the stored monthly minimum', async ({ page }) => {
    const card = await createDebt(page);
    await openRepay(page, card);

    // 200 is the Add Debt form's own default minimum payment.
    await page.locator('#repay-payoff-minimum').click();

    await expect(amountField(page)).toHaveValue('200');
    await expect(remainingAfter(page)).toHaveText('฿4,800.00');
    await expect(preview(page)).toContainText('4.0%');
  });

  test('typing an amount drives the projection without any chip', async ({ page }) => {
    const card = await createDebt(page);
    await openRepay(page, card);

    await amountField(page).fill('1234');

    await expect(remainingAfter(page)).toHaveText('฿3,766.00');
    await expect(preview(page)).toContainText('24.7%');
  });

  test('the projection is absent until there is a valid amount', async ({ page }) => {
    const card = await createDebt(page);
    await openRepay(page, card);

    // The block itself stays mounted - it is the only place the repay modal
    // shows the remaining balance at all - but the projected half does not
    // render without an amount.
    await expect(preview(page)).toContainText('฿5,000.00');
    await expect(remainingAfter(page)).toHaveCount(0);

    await amountField(page).fill('500');
    await expect(remainingAfter(page)).toHaveText('฿4,500.00');

    // Clearing it takes the projection back out of the DOM.
    await amountField(page).fill('');
    await expect(remainingAfter(page)).toHaveCount(0);
  });

  /*
   * ADR 0016 deliberately inverted this test.
   *
   * It previously asserted `#confirm-repay-btn` stayed **enabled** while
   * overpaying, pinning ADR 0015's warn-never-block decision. That decision
   * was reversed once the ledger stopped permitting an overpayment at all, and
   * ADR 0015 anticipated the reversal in writing. This is not the spec-edit
   * policy being bent: the assertion was not weakened or dropped, it now pins
   * the opposite contract, which is exactly as strict.
   */
  test('overpaying blocks the submit button and names the maximum', async ({ page }) => {
    const card = await createDebt(page);
    await openRepay(page, card);

    await amountField(page).fill('6000');

    const note = page.getByTestId('repay-overpayment-note');
    await expect(note).toBeVisible();
    await expect(note).toContainText('Maximum payable is ฿5,000.00');
    await expect(note).toContainText('Pay in full');

    await expect(page.locator('#confirm-repay-btn')).toBeDisabled();

    // The settle note is suppressed - the two are mutually exclusive.
    await expect(page.getByTestId('repay-settle-note')).toHaveCount(0);
  });

  test('correcting an overpayment back down re-enables the submit button', async ({ page }) => {
    const card = await createDebt(page);
    await openRepay(page, card);

    await amountField(page).fill('6000');
    await expect(page.locator('#confirm-repay-btn')).toBeDisabled();

    // The gate must not be sticky: it is derived on render, not latched.
    await amountField(page).fill('1500');
    await expect(page.getByTestId('repay-overpayment-note')).toHaveCount(0);
    await expect(page.locator('#confirm-repay-btn')).toBeEnabled();
    await expect(remainingAfter(page)).toHaveText('฿3,500.00');
  });

  test('"Pay in full" satisfies the constraint exactly', async ({ page }) => {
    const card = await createDebt(page);
    await openRepay(page, card);

    // The chip the constraint note points at must produce a submittable
    // amount - otherwise the advice it gives is wrong.
    await page.locator('#repay-payoff-full').click();

    await expect(page.getByTestId('repay-overpayment-note')).toHaveCount(0);
    await expect(page.getByTestId('repay-settle-note')).toBeVisible();
    await expect(page.locator('#confirm-repay-btn')).toBeEnabled();
  });

  test('a plain expense form is unaffected by the debt overpayment gate', async ({ page }) => {
    /*
     * The regression guard for the highest-risk line in ADR 0016. On a
     * non-debt form `repayTargetDebt` is null, so `remainingDebt` falls back
     * to 0 and `overpayment` equals the whole amount. Without the
     * `repayTargetDebt !== null` test in `isOverpaying`, this submit button -
     * and every other EXPENSE/INCOME one in the app - would be permanently
     * disabled.
     */
    await page.locator('#navbar-quick-add-btn').click();
    const modal = page.getByRole('dialog', { name: /Quick Record Transaction/i });
    await expect(modal).toBeVisible();

    await modal.locator('input[name="amount_expression"]').fill('250');
    await expect(modal.locator('button[type="submit"]')).toBeEnabled();
    await expect(modal.getByTestId(/overpayment-note$/)).toHaveCount(0);
  });

  test('the minimum chip is hidden when the minimum exceeds what is left', async ({ page }) => {
    // Total 100 with the default 200 minimum: paying the "minimum" would
    // overshoot, so the chip would just duplicate "Pay in full".
    const card = await createDebt(page, { total: '100' });
    await openRepay(page, card);

    await expect(page.locator('#repay-payoff-full')).toBeVisible();
    await expect(page.locator('#repay-payoff-half')).toBeVisible();
    await expect(page.locator('#repay-payoff-minimum')).toHaveCount(0);
  });

  test('a chip latches the amount against the express note parser', async ({ page }) => {
    const card = await createDebt(page);
    await openRepay(page, card);

    await page.locator('#repay-payoff-half').click();
    await expect(amountField(page)).toHaveValue('2500');

    // A note ending in digits would normally seed the amount field (ADR 0013,
    // and step 1 of handleDescriptionChange runs even on a locked-type form).
    // Having tapped a chip, the user owns the field.
    await page.locator('input[id$="-desc"]').fill('partial loan payment 4000');

    await expect(amountField(page)).toHaveValue('2500');
    await expect(remainingAfter(page)).toHaveText('฿2,500.00');
  });
});
