import { test, expect, type Page } from '@playwright/test';
import { gotoTab } from './helpers';

/**
 * One-click smart-rule capture from the transaction form (ADR 0017).
 *
 * `smartMatcher` is the first and authoritative categorization layer, but its
 * only writer used to be the Categories view. This spec pins the affordance
 * that closes that loop where the correction actually happens, and - just as
 * importantly - the four conditions under which it stays silent.
 *
 * `7-eleven snacks 45` is the working note throughout: it misses all four
 * seeded rules (`coffee`, `groceries`, `fuel`, `salary`), and
 * `parseExpressInput` strips the trailing `45` on the whitespace boundary, so
 * the keyword offered is `7-eleven snacks` rather than the raw note.
 *
 * No network mocking here on purpose. `npm run dev` does not serve `api/`, so
 * `/api/classify` 404s and the classifier latches off - which is what keeps
 * `tests/jev-classify.spec.ts` the only spec in this suite that intercepts
 * requests. The one rule-capture case that needs a live suggestion lives
 * there with the mock, not here.
 */

const MERCHANT_NOTE = '7-eleven snacks 45';
const MERCHANT_KEYWORD = '7-eleven snacks';
const GROCERIES = 'cat-groceries';

async function openQuickAdd(page: Page) {
  await page.locator('#navbar-quick-add-btn').click();
  const modal = page.getByRole('dialog', { name: /Quick Record Transaction/i });
  await expect(modal).toBeVisible();
  return modal;
}

/** Types the note and overrides the category by hand - the trigger the whole feature hangs on. */
async function noteAndOverride(page: Page, note = MERCHANT_NOTE, categoryId = GROCERIES) {
  const modal = await openQuickAdd(page);
  await modal.locator('input[id$="-desc"]').fill(note);
  await modal.locator('select[id$="-category"]').selectOption(categoryId);
  return modal;
}

test.describe('Smart rule capture from the transaction form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('overriding the category offers a rule keyed to the clean merchant text', async ({ page }) => {
    const modal = await noteAndOverride(page);

    const chip = modal.getByTestId('tx-save-rule');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText(MERCHANT_KEYWORD);
    await expect(chip).toContainText('Groceries');

    // The keyword is `cleanDescription`, not the raw note. Baking the amount
    // into a rule would produce one that can never match again.
    await expect(chip).not.toContainText('45');
  });

  test('one click saves the rule and it categorizes the next entry', async ({ page }) => {
    const modal = await noteAndOverride(page);

    await modal.locator('[id$="-save-rule-btn"]').click();
    await expect(modal.getByTestId('tx-save-rule')).toContainText('Rule saved');

    // Reload rather than reopen: it proves the rule reached the persisted
    // slice, and it hands the next assertion a form whose category has been
    // reset to the default instead of one still holding the override.
    await page.locator('#close-quick-record-modal-btn').click();
    await page.reload();

    const reopened = await openQuickAdd(page);
    const categorySelect = reopened.locator('select[id$="-category"]');
    await expect(categorySelect).not.toHaveValue(GROCERIES);

    await reopened.locator('input[id$="-desc"]').fill(`${MERCHANT_KEYWORD} 90`);

    await expect(categorySelect).toHaveValue(GROCERIES);
    await expect(reopened.getByText(/Auto-categorized:/i)).toBeVisible();

    // A rule hit is authoritative, so the offer retires itself.
    await expect(reopened.getByTestId('tx-save-rule')).toHaveCount(0);
  });

  test('the saved rule lands in the Categories rules table', async ({ page }) => {
    const modal = await noteAndOverride(page);
    await modal.locator('[id$="-save-rule-btn"]').click();
    await expect(modal.getByTestId('tx-save-rule')).toContainText('Rule saved');
    await page.locator('#close-quick-record-modal-btn').click();

    // The same write path the Categories view's own form uses, reached from
    // the other end - this is the cross-surface check.
    await gotoTab(page, 'categories');
    await page.locator('#category-subtab-rules').click();

    const ruleRow = page.locator('tr[id^="rule-row-"]').filter({ hasText: MERCHANT_KEYWORD });
    await expect(ruleRow).toBeVisible();
    await expect(ruleRow).toContainText('Groceries');
  });

  test('an existing rule suppresses the offer, so no duplicate keyword can be written', async ({ page }) => {
    // `coffee` is a seeded rule pointing at Food & Dining.
    const modal = await noteAndOverride(page, '250 coffee with friends', GROCERIES);

    // The override took effect - this is a real override, not a no-op.
    await expect(modal.locator('select[id$="-category"]')).toHaveValue(GROCERIES);

    // ...but a rule already governs this text, and `addKeywordRule` does not
    // dedupe, so offering here would let a second `coffee` rule silently
    // shadow the first.
    await expect(modal.getByTestId('tx-save-rule')).toHaveCount(0);
  });

  test('no offer until the user picks the category themselves', async ({ page }) => {
    const modal = await openQuickAdd(page);
    await modal.locator('input[id$="-desc"]').fill(MERCHANT_NOTE);

    // Nothing was chosen - the form is sitting on its default category, and a
    // rule built from that is one the user never made.
    await expect(modal.getByTestId('tx-save-rule')).toHaveCount(0);

    // Non-vacuous: the same note does offer once the category is chosen.
    await modal.locator('select[id$="-category"]').selectOption(GROCERIES);
    await expect(modal.getByTestId('tx-save-rule')).toBeVisible();
  });

  test('the locked repay modal never offers a rule', async ({ page }) => {
    await gotoTab(page, 'debts');
    await page.locator('button[id^="open-repay-modal-"]').first().click();

    const repayNote = page.locator('input[id$="-desc"]');
    await expect(repayNote).toBeVisible();
    await repayNote.fill('student loan autopay 500');

    // A locked form skips categorization entirely, so there is nothing to
    // learn from it and no category field to hang an offer on.
    await expect(page.getByTestId('tx-save-rule')).toHaveCount(0);
  });

  test('dismissing retires the offer for good, and the transaction still submits', async ({ page }) => {
    const modal = await noteAndOverride(page);
    await expect(modal.getByTestId('tx-save-rule')).toBeVisible();

    await modal.locator('[id$="-save-rule-dismiss"]').click();
    await expect(modal.getByTestId('tx-save-rule')).toHaveCount(0);

    // Retyping the same pairing does not bring it back.
    await modal.locator('input[id$="-desc"]').fill('');
    await modal.locator('input[id$="-desc"]').fill(MERCHANT_NOTE);
    await expect(modal.getByTestId('tx-save-rule')).toHaveCount(0);

    // The whole point of the chip living beside the submit path rather than
    // inside it: the write is unaffected either way.
    await modal.locator('button[type="submit"]').click();
    await expect(modal).not.toBeVisible();
  });
});
