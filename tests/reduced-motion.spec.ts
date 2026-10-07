import { test, expect, type Page } from '@playwright/test';
import { gotoTab } from './helpers';

/**
 * Phase 106 (ADR 0082): the app's motion is CSS keyframes plus one Web
 * Animations call (the selection pill), and none of it runs when the person
 * asks for reduced motion. framer-motion, which ran it before, ignored that
 * setting. The unit suite covers `Presence` and `slidePill`; only a browser
 * can show the `@media (prefers-reduced-motion)` rule and the keyframes are
 * wired, so this records every animation that starts while the same steps run.
 */

declare global {
  interface Window {
    __motion: string[];
  }
}

async function recordMotion(page: Page) {
  await page.addInitScript(() => {
    window.__motion = [];
    document.addEventListener('animationstart', (e) => window.__motion.push(e.animationName), true);
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args: Parameters<typeof animate>) {
      window.__motion.push('slide');
      return animate.apply(this, args);
    };
  });
}

/** Switches the period, opens and closes Quick Add, then changes tab. */
async function runSteps(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.locator('#time-filter-week').click();
  await expect(page.locator('#time-filter-week')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#navbar-quick-add-btn').click();
  const dialog = page.getByRole('dialog', { name: /Quick Record Transaction/i });
  await expect(dialog).toBeVisible();
  // As in the dialogs-by-keyboard spec: wait for the form's lazy chunk and for
  // focus to land, or an Escape sent at once can be lost on WebKit (it was on
  // framer-motion too, 1 in 3 locally).
  await expect(dialog.locator('input[id$="-desc"]')).toBeVisible();
  await expect(dialog.locator('#close-quick-record-modal-btn')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await gotoTab(page, 'transactions');
}

const ALL = [
  'motion-page-in',
  'slide',
  'motion-fade-in',
  'motion-rise-in',
  'motion-fade-out',
  'motion-rise-out',
  'motion-page-out',
];

test('the page, the period pill and a dialog animate on their changes', async ({ page }) => {
  await recordMotion(page);
  await runSteps(page);
  await expect.poll(() => page.evaluate(() => window.__motion)).toEqual(expect.arrayContaining(ALL));
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the same changes run no animation at all', async ({ page }) => {
    await recordMotion(page);
    await runSteps(page);
    expect(await page.evaluate(() => window.__motion)).toEqual([]);
  });
});
