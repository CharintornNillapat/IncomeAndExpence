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

  test('a cold load of the Dashboard keeps its layout', async ({ page, browserName }) => {
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
          sources: { node: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[];
        }[]) {
          if (entry.hadRecentInput) continue;
          const box = (r: DOMRectReadOnly) => `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
          shifts.push({
            value: entry.value,
            sources: entry.sources.map((s) => {
              const name = s.node instanceof Element ? s.node.tagName.toLowerCase() + (s.node.id ? `#${s.node.id}` : '') : `"${(s.node?.textContent ?? '').trim().slice(0, 20)}"`;
              return `${name} ${box(s.previousRect)} -> ${box(s.currentRect)}`;
            }),
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

    // The fallback faces only help where a local Arial or Liberation Sans
    // exists, so say so first rather than as a layout-shift number.
    const fallbackFaces = await page.evaluate(() =>
      Promise.all(
        [400, 500, 600, 700].map(async (weight) => {
          try {
            const faces = await document.fonts.load(`${weight} 16px "IBM Plex Sans Thai Fallback"`, 'Ag');
            return `${weight}:${faces.map((f) => f.status).join('+') || 'none'}`;
          } catch (error) {
            return `${weight}:error ${(error as Error).message}`;
          }
        }),
      ),
    );
    expect(fallbackFaces, 'the fallback family resolves to a local font').toEqual(['400:loaded', '500:loaded', '600:loaded', '700:loaded']);

    const shifts = await page.evaluate(() => (window as unknown as { __layoutShifts: { value: number; sources: string[] }[] }).__layoutShifts);
    const total = shifts.reduce((sum, s) => sum + s.value, 0);
    // The footer unreserved is 0.0137. What the font swap leaves depends on
    // the platform: 0.00001 on Windows (0.0002 unmatched), 0.00035 on CI's
    // Linux, where the header's row of labels comes out about 1.5% wider in
    // the fallback than in Plex (most likely whole-pixel glyph advances there;
    // ADR 0060). The faces themselves are pinned by the check above.
    expect(total, JSON.stringify(shifts)).toBeLessThan(0.001);
  });
});
