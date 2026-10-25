import { test, expect, type Page } from '@playwright/test';
import { gotoTab } from './helpers';

/**
 * Phase 106 (ADR 0082): the app's motion is CSS keyframes plus one Web
 * Animations call (the selection pill), and none of it runs when the person
 * asks for reduced motion. framer-motion, which ran it before, ignored that
 * setting. The unit suite covers `Presence` and `slidePill`; only a browser
 * can show the `@media (prefers-reduced-motion)` rule and the keyframes are
 * wired, so this records every animation that starts while the same steps run.
 *
 * Phase 146 (ADR 0106): the page and dialog entrances no longer animate,
 * keeping tab switches and popup opens instant; this spec pins that.
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
  await expect(dialog.locator('#quickadd-close-btn')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await gotoTab(page, 'transactions');
}

/** What a spinner and a pulse run, read from the app's own stylesheet (ADR 0083). */
function busyAnimations(page: Page) {
  return page.evaluate(() =>
    ['animate-spin', 'animate-pulse'].map((name) => {
      const el = document.createElement('span');
      el.className = name;
      document.body.append(el);
      const ran = getComputedStyle(el).animationName;
      el.remove();
      return ran;
    }),
  );
}

const ALL = [
  'slide',
  'motion-fade-out',
  'motion-rise-out',
];

test('the period pill animates and a dialog fades out on close', async ({ page }) => {
  await recordMotion(page);
  await runSteps(page);
  await expect.poll(() => page.evaluate(() => window.__motion)).toEqual(expect.arrayContaining(ALL));
  const names = await page.evaluate(() => window.__motion);
  expect(names).not.toContain('motion-page-in');
  expect(names).not.toContain('motion-page-out');
  expect(names).not.toContain('motion-fade-in');
  expect(names).not.toContain('motion-rise-in');
  expect(await busyAnimations(page)).toEqual(['spin', 'pulse']);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the same changes run no animation at all', async ({ page }) => {
    await recordMotion(page);
    await runSteps(page);
    expect(await page.evaluate(() => window.__motion)).toEqual([]);
    // The spinners and the listening pulse stop too; each sits beside text
    // that says what is happening, or in a disabled button (ADR 0083).
    expect(await busyAnimations(page)).toEqual(['none', 'none']);
  });
});
