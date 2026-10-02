import { test, expect, type Locator } from '@playwright/test';
import { gotoTab } from './helpers';

/**
 * Phase 66 (ADR 0042): the PWA update toast sits above the page and the bottom
 * nav, and below every sheet and dialog.
 *
 * The toast only exists once a real service worker has installed, which the
 * suite's main server (`npm run dev`) never registers. This spec runs against
 * Playwright's second webServer, `vite --mode pwa-dev` on port 3100, where
 * vite-plugin-pwa's `devOptions` registers its development service worker, so
 * the toast here is the real `ReloadPrompt` reacting to a real `offlineReady`.
 * Nothing is injected and no request is intercepted.
 */
test.use({ baseURL: 'http://localhost:3100' });

const TOAST_NAME = 'App update notification';

/** What a tap at the centre of `target` lands on, read with `elementFromPoint`. */
function hitAtCentre(target: Locator): Promise<'own' | 'toast' | 'dialog' | 'other'> {
  return target.evaluate((el, toastName) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit) return 'other';
    if (el.contains(hit)) return 'own';
    const toast = document.querySelector(`aside[aria-label="${toastName}"]`);
    if (toast?.contains(hit)) return 'toast';
    // A dialog's panel, or the scrim that is its direct parent.
    if (hit.closest('[role="dialog"]') || hit.querySelector(':scope > [role="dialog"]')) return 'dialog';
    return 'other';
  }, TOAST_NAME);
}

test.describe('at 390', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the More sheet sits above the toast, and its rows open their pages', async ({ page }) => {
    await page.goto('/');
    const toast = page.getByRole('complementary', { name: TOAST_NAME });
    // The service worker installs after the first load; chromium's first visit
    // also waits on the dev server compiling every module.
    await expect(toast).toBeVisible({ timeout: 45_000 });

    // Over the page and clear of the bottom nav (Phase 65, ADR 0041).
    expect(await hitAtCentre(toast)).toBe('own');
    for (const id of ['mobile-nav-tab-dashboard', 'mobile-nav-tab-transactions', 'mobile-nav-quick-add-btn', 'mobile-nav-tab-wallets', 'mobile-nav-more-btn']) {
      expect(await hitAtCentre(page.locator(`#${id}`)), id).toBe('own');
    }

    await page.locator('#mobile-nav-more-btn').click();
    await expect(page.locator('#mobile-nav-more-sheet')).toBeVisible();

    const toastBox = await toast.boundingBox();
    expect(toastBox).not.toBeNull();
    let rowsOverToast = 0;
    for (const id of ['debts', 'diary', 'categories']) {
      const row = page.locator(`#mobile-nav-tab-${id}`);
      await expect(row).toBeVisible();
      await expect.poll(() => hitAtCentre(row), { message: `${id} row is unobstructed` }).toBe('own');
      const box = await row.boundingBox();
      if (box && toastBox && box.y < toastBox.y + toastBox.height && box.y + box.height > toastBox.y) rowsOverToast += 1;
    }
    // The check means something only while the toast is behind the rows.
    expect(rowsOverToast).toBeGreaterThan(0);

    await page.locator('#mobile-nav-tab-debts').click();
    await expect(page.getByRole('heading', { name: 'Debt payoff', exact: true })).toBeVisible();
    await expect(page.locator('#mobile-nav-more-sheet')).toHaveCount(0);
  });
});

test('at desktop width the toast sits over the page and under an open dialog', async ({ page }) => {
  await page.goto('/');
  const toast = page.getByRole('complementary', { name: TOAST_NAME });
  await expect(toast).toBeVisible({ timeout: 45_000 });

  await gotoTab(page, 'transactions');
  expect(await hitAtCentre(toast)).toBe('own');

  // A view-level dialog renders inside <main>, before the toast in the DOM:
  // only its layer, not its position in the page, can put it on top.
  await page.locator('#tx-open-add-modal-btn').click();
  await expect(page.getByRole('dialog', { name: /Record New Transaction/i })).toBeVisible();
  await expect.poll(() => hitAtCentre(toast)).toBe('dialog');
});
