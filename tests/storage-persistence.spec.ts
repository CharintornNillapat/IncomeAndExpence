import { test, expect } from '@playwright/test';
import { addQuickTransaction } from './helpers';

/**
 * T16 (ADR 0003) regression coverage: `FinanceContext.tsx`'s localStorage
 * writes are batched and debounced (~250ms) instead of writing synchronously
 * on every state change, with `pagehide`/`visibilitychange` wired to flush any
 * pending write immediately. Without that flush, a write still sitting inside
 * the debounce window when a PWA tab is backgrounded or reloaded would be
 * silently lost.
 */
test.describe('T16: batched localStorage writer lifecycle flush', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('flushes a pending write to localStorage synchronously when the tab becomes hidden', async ({ page }) => {
    const marker = 'E2E Lifecycle Flush Latte';
    await addQuickTransaction(page, marker);

    // `document.dispatchEvent` invokes listeners synchronously, so by the time
    // it returns here, the writer's `visibilitychange` handler - if wired up -
    // has already run `flushPendingWrites` and written to localStorage. This
    // check happens inside the same page-side evaluation as the dispatch, so
    // there is no window in which it could pass merely because the writer's
    // own 250ms debounce timer happened to fire first.
    const persistedImmediatelyOnHide = await page.evaluate((text) => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      return (localStorage.getItem('pf_transactions') || '').includes(text);
    }, marker);

    expect(persistedImmediatelyOnHide).toBe(true);
  });

  test('state survives a full page reload immediately after a write', async ({ page }) => {
    const marker = 'E2E Reload Survives Latte';
    await addQuickTransaction(page, marker);

    // A real navigation fires `pagehide` on the outgoing document before it is
    // torn down, exercising the same flush path as backgrounding a tab.
    await page.reload();

    await expect(page.getByText(marker)).toBeVisible();
  });
});
