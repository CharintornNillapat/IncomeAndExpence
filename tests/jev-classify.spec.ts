import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * Jev auto-categorization and transaction-type detection (ADR 0011).
 *
 * NETWORK MOCKING - the first use of `page.route()` in this suite, so the
 * reasoning is worth stating once here rather than rediscovering it later.
 *
 * Every response below is fulfilled locally. No request reaches
 * `api.typesafe.ai`, so the suite spends no TypeSafe credits, needs no API key,
 * and behaves identically on CI (which has no secrets wired) and on a laptop
 * that happens to have a key exported.
 *
 * Note what is NOT mocked: `npm run dev` is the Vite dev server, which does not
 * serve `api/` at all. Without a route handler `/api/classify` 404s, the client
 * trips its session availability latch, and categorization falls back to the
 * keyword rules exactly as it did before this feature existed - which is
 * precisely why the other 14 specs needed no changes.
 */

const CLASSIFY_ROUTE = '**/api/classify';

/** `cat-transport` / "Transport & Fuel" is an EXPENSE category with no seeded keyword rule. */
const TRANSPORT = { id: 'cat-transport', name: 'Transport & Fuel' };

/** Misses all four seeded rules (coffee, groceries, fuel, salary), so it reaches the classifier. */
const UNMATCHED_NOTE = 'Netflix subscription';

interface MockAnswer {
  categoryId: string | null;
  categoryConfidence: number;
  detectedType: 'INCOME' | 'EXPENSE';
  typeConfidence: number;
}

interface SentCandidate {
  id: string;
  name: string;
  description?: string;
}

interface SentBody {
  text: string;
  categories: SentCandidate[];
}

/**
 * Installs a mocked classifier and returns live request state. `count` is what
 * lets a test assert that a keyword-rule hit made no call at all; `bodies` is
 * what lets one assert what the client actually put on the wire, which is the
 * only way to check a field the mocked response never echoes back.
 */
async function mockClassifier(page: Page, answer: MockAnswer) {
  const state = { count: 0, bodies: [] as SentBody[] };
  await page.route(CLASSIFY_ROUTE, async (route: Route) => {
    state.count += 1;
    state.bodies.push(route.request().postDataJSON() as SentBody);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(answer),
    });
  });
  return state;
}

async function openQuickAdd(page: Page) {
  await page.locator('#navbar-quick-add-btn').click();
  const modal = page.getByRole('dialog', { name: /Quick Record Transaction/i });
  await expect(modal).toBeVisible();
  return modal;
}

/*
 * Note for future edits: the category `<select>` is now always mounted. Before
 * ADR 0013 an auto-categorization collapsed the manual wallet/category block
 * behind an "Edit details" toggle, so every assertion on the select's value had
 * to click that toggle open first via a `revealDetails` helper. Removing the
 * collapse removed the click, not the assertions - they read the same value
 * they always did, just without a step in between.
 */

test.describe('Jev classification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('a high-confidence classification fills the category outright', async ({ page }) => {
    await mockClassifier(page, {
      categoryId: TRANSPORT.id,
      categoryConfidence: 0.97,
      detectedType: 'EXPENSE',
      typeConfidence: 0.99,
    });

    const modal = await openQuickAdd(page);
    await modal.locator('input[id$="-desc"]').fill(UNMATCHED_NOTE);

    // Above the 0.85 auto-fill gate: the existing "Auto-categorized" badge
    // reports it - the same surface the keyword matcher has always used - and
    // no chip is offered, because there is nothing left to confirm.
    await expect(modal.getByText(/Auto-categorized:/i)).toBeVisible();
    await expect(modal.getByText(/Auto-categorized:/i)).toContainText(TRANSPORT.name);
    await expect(modal.getByTestId('tx-category-suggestion')).toHaveCount(0);

    // The field really was written, not just announced.
    await expect(modal.locator('select[id$="-category"]')).toHaveValue(TRANSPORT.id);
  });

  test('a mid-confidence classification only suggests until the user applies it', async ({ page }) => {
    await mockClassifier(page, {
      categoryId: TRANSPORT.id,
      categoryConfidence: 0.62,
      detectedType: 'EXPENSE',
      typeConfidence: 0.9,
    });

    const modal = await openQuickAdd(page);
    const categorySelect = modal.locator('select[id$="-category"]');
    const valueBefore = await categorySelect.inputValue();

    await modal.locator('input[id$="-desc"]').fill(UNMATCHED_NOTE);

    const chip = modal.getByTestId('tx-category-suggestion');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText(TRANSPORT.name);

    // The whole point of the mid band: nothing was written to form state.
    await expect(categorySelect).toHaveValue(valueBefore);

    await chip.locator('[id$="-suggestion-apply"]').click();

    // Applying is treated exactly like any other auto-categorization, so the
    // chip is replaced by the badge on the Category label.
    await expect(chip).toHaveCount(0);
    await expect(modal.getByText(/Auto-categorized:/i)).toBeVisible();

    await expect(modal.locator('select[id$="-category"]')).toHaveValue(TRANSPORT.id);
  });

  test('a low-confidence classification changes nothing and shows nothing', async ({ page }) => {
    // 0.3 is below the 0.5 floor - the measured value for a genuinely
    // ambiguous note, where Jev spread probability across three options.
    const calls = await mockClassifier(page, {
      categoryId: TRANSPORT.id,
      categoryConfidence: 0.3,
      detectedType: 'EXPENSE',
      typeConfidence: 0.84,
    });

    const modal = await openQuickAdd(page);
    const categorySelect = modal.locator('select[id$="-category"]');
    const description = modal.locator('input[id$="-desc"]');
    const valueBefore = await categorySelect.inputValue();

    await description.fill(UNMATCHED_NOTE);
    await expect.poll(() => calls.count).toBe(1);

    // A second unmatched note. Its request completing is the synchronization
    // point: by the time call 2 is counted, call 1's response has long since
    // been received and rendered, so this is a real negative rather than an
    // assertion that raced the debounce. A leaked suggestion would also still
    // be on screen here, since nothing clears one but a rule hit or a dismiss.
    await description.fill('Annual insurance premium');
    await expect.poll(() => calls.count).toBe(2);

    await expect(modal.getByTestId('tx-category-suggestion')).toHaveCount(0);
    await expect(modal.getByText(/Auto-categorized:/i)).toHaveCount(0);
    await expect(categorySelect).toHaveValue(valueBefore);
  });

  test('a keyword-rule hit short-circuits before any network call', async ({ page }) => {
    const calls = await mockClassifier(page, {
      categoryId: TRANSPORT.id,
      categoryConfidence: 0.95,
      detectedType: 'EXPENSE',
      typeConfidence: 0.95,
    });

    const modal = await openQuickAdd(page);
    const description = modal.locator('input[id$="-desc"]');

    // 1. "coffee" matches seeded rule kw-1 -> cat-food. The rule layer resolves
    //    it synchronously and the classifier must never be armed.
    await description.fill('coffee');
    await expect(modal.getByText(/Auto-categorized:/i)).toBeVisible();

    // 2. A note no rule covers. Its answer landing is the synchronization
    //    point - by the time it renders, any call the rule hit had wrongly
    //    triggered would already be counted.
    await description.fill(UNMATCHED_NOTE);
    await expect(modal.getByText(/Auto-categorized:/i)).toContainText(TRANSPORT.name);

    // Exactly one call: for step 2 only. Two would mean the rule hit leaked.
    expect(calls.count).toBe(1);
  });

  /**
   * Phase 40 / ADR 0012. The chain this pins - default description ->
   * `withDefaultDescriptions` -> context state -> `toClassifyCandidates` ->
   * request body - has no other test that would fail if a link dropped the
   * field, because the mocked response never echoes it and every UI assertion
   * above passes just as happily with bare names on the wire. The proxy turns
   * this into the option's `criteria`; sending it is the whole feature.
   */
  test('active categories are sent with their descriptions attached', async ({ page }) => {
    const calls = await mockClassifier(page, {
      categoryId: TRANSPORT.id,
      categoryConfidence: 0.95,
      detectedType: 'EXPENSE',
      typeConfidence: 0.95,
    });

    const modal = await openQuickAdd(page);
    await modal.locator('input[id$="-desc"]').fill(UNMATCHED_NOTE);
    await expect.poll(() => calls.count).toBe(1);

    const sent = calls.bodies[0];
    const transport = sent.categories.find((c) => c.id === TRANSPORT.id);
    expect(transport?.description).toMatch(/petrol/i);

    // The housing description is the one that exists to make this very note
    // classifiable - Phase 39 sent bare names and "Netflix subscription" came
    // back as the `other` escape option.
    const housing = sent.categories.find((c) => c.id === 'cat-housing');
    expect(housing?.description).toMatch(/Netflix/i);

    // Only active EXPENSE/INCOME categories travel, descriptions or not.
    expect(sent.categories.some((c) => c.id === 'cat-debt')).toBe(false);
    expect(sent.categories.some((c) => c.id === 'cat-adjust')).toBe(false);
  });

  test('a failed classification degrades silently and the form still submits', async ({ page }) => {
    await page.route(CLASSIFY_ROUTE, (route: Route) => route.abort('failed'));

    const modal = await openQuickAdd(page);
    await modal.locator('input[name="amount_expression"]').fill('150');

    const walletSelect = modal.locator('select[id$="-wallet"]');
    await expect(walletSelect).toBeVisible();
    const optionsCount = await walletSelect.locator('option').count();
    await walletSelect.selectOption({ index: optionsCount > 1 ? 1 : 0 });

    await modal.locator('input[id$="-desc"]').fill(UNMATCHED_NOTE);

    // No suggestion, and - the part that matters - no error banner and no
    // crash. A thrown fetch would white-screen the app: there is no error
    // boundary in src/.
    await expect(modal.getByTestId('tx-category-suggestion')).toHaveCount(0);

    await modal.locator('button[type="submit"]').click();

    // The modal closing is the app's own confirmation that the write succeeded.
    await expect(modal).not.toBeVisible();
  });
});
