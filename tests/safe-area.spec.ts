import { test, expect, type Page } from '@playwright/test';

/**
 * Phase 94 (ADR 0070): the viewport is `viewport-fit=cover`, so on a phone with
 * a notch and a home indicator the page draws under them, and each edge has to
 * clear its inset itself. No test browser has a notch; Chromium can emulate the
 * insets through the DevTools protocol, so this spec runs there only.
 */

async function emulateInsets(page: Page, insets: { top: number; bottom: number; left: number; right: number }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets });
}

const header = (page: Page) => page.locator('header > div').first();
const mobileNav = (page: Page) => page.locator('nav[aria-label="Mobile Navigation"]');

test.describe('Safe-area insets', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'only Chromium can emulate safe-area insets');
  });

  test('portrait: the header, the bottom nav, the footer and a bottom sheet clear the notch and the home indicator', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await emulateInsets(page, { top: 47, bottom: 34, left: 0, right: 0 });
    await page.goto('/');
    await expect(page.locator('#view-loading-fallback')).toHaveCount(0);

    expect((await header(page).boundingBox())!.y).toBeGreaterThanOrEqual(47);
    await expect(mobileNav(page)).toHaveCSS('padding-bottom', '34px');

    // At the end of the page the footer's margin keeps it out from under the
    // nav, its 1px top border included (ADR 0071).
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(async () => {
      const footer = (await page.locator('footer').boundingBox())!;
      const nav = (await mobileNav(page).boundingBox())!;
      expect(footer.y + footer.height).toBeLessThanOrEqual(nav.y);
    }).toPass();
    await page.evaluate(() => window.scrollTo(0, 0));

    await page.locator('#mobile-nav-quick-add-btn').click();
    await expect(page.getByRole('dialog')).toHaveCSS('padding-bottom', '34px');
  });

  test('landscape: the header, the page and the footer clear the side insets', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await emulateInsets(page, { top: 0, bottom: 21, left: 47, right: 47 });
    await page.goto('/');
    await expect(page.locator('#view-loading-fallback')).toHaveCount(0);

    for (const [name, box] of [
      ['header', await header(page).boundingBox()],
      ['main', await page.locator('main').boundingBox()],
      ['footer', await page.locator('footer').boundingBox()],
    ] as const) {
      expect(box!.x, `${name} left`).toBeGreaterThanOrEqual(47);
      expect(box!.x + box!.width, `${name} right`).toBeLessThanOrEqual(844 - 47 + 0.5);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
