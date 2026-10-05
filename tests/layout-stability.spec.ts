import { test, expect, type Page } from '@playwright/test';
import { gotoTab } from './helpers';

/**
 * Phase 84 (ADR 0060): nothing moves on screen while the app loads.
 *
 * On production the desktop load's layout shift was 0.014, almost all of it the
 * footer: `<main>` was only `flex-1`, so while a view's chunk loaded the footer
 * sat at the bottom of the screen, then the Dashboard pushed it off. `<main>`
 * now reserves the viewport under the header. The rest was the font swap,
 * which a metric-matched fallback face (`index.css`) now absorbs.
 */

/** Where the footer starts, against the bottom of the screen. */
async function footerTop(page: Page) {
  return page.evaluate(() => ({
    top: document.querySelector('footer')!.getBoundingClientRect().top,
    viewport: window.innerHeight,
  }));
}

test.describe('Layout stability', () => {
  test('a page shorter than the screen keeps the footer below the fold', async ({ page }) => {
    // A fresh guest's Transactions, Wallets and Debt payoff pages are all
    // shorter than a 1280x720 screen, so `flex-1` alone would show the footer.
    await page.goto('/');
    for (const tab of ['transactions', 'wallets', 'debts']) {
      await gotoTab(page, tab);
      const { top, viewport } = await footerTop(page);
      expect(top, `footer on ${tab}`).toBeGreaterThanOrEqual(viewport);
    }

    // Below `md` the header is 56px and the bottom nav covers the footer's
    // margin; the Wallets page is still shorter than the phone.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#mobile-nav-tab-wallets').click();
    await expect(page.locator('#mobile-nav-tab-wallets')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#view-loading-fallback')).toHaveCount(0);
    const phone = await footerTop(page);
    expect(phone.top, 'footer on wallets at 390').toBeGreaterThanOrEqual(phone.viewport);
  });

  test('a cold load of the Dashboard shifts no layout', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'only Chromium reports layout-shift entries');
    // 800px tall, where the loading outline leaves the unreserved footer on
    // screen (at the default 720 the outline alone already pushes it off).
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.addInitScript(() => {
      const shifts: { value: number; sources: string[] }[] = [];
      (window as unknown as { __layoutShifts: typeof shifts }).__layoutShifts = shifts;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as {
          value: number;
          hadRecentInput: boolean;
          sources: { node: Node | null }[];
        }[]) {
          if (entry.hadRecentInput) continue;
          shifts.push({
            value: entry.value,
            sources: entry.sources.map((s) => (s.node instanceof Element ? s.node.tagName.toLowerCase() + (s.node.id ? `#${s.node.id}` : '') : 'text')),
          });
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });

    await page.goto('/');
    await expect(page.locator('#nav-tab-dashboard')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#view-loading-fallback')).toHaveCount(0);
    // Every font the Dashboard asked for has arrived and been laid out.
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });

    const shifts = await page.evaluate(() => (window as unknown as { __layoutShifts: { value: number; sources: string[] }[] }).__layoutShifts);
    const total = shifts.reduce((sum, s) => sum + s.value, 0);
    // Measured on the dev server: 0.0139 with the footer unreserved, 0.0002
    // with the font swap unmatched, 0.00001 with both fixed (the baht sign's
    // Thai subset arriving, ADR 0060).
    expect(total, JSON.stringify(shifts)).toBeLessThan(0.0001);
  });
});
