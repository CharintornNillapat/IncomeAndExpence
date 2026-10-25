import { test, expect } from '@playwright/test';
import { gotoTab } from './helpers';

const EXPECTED_VIEWS = ['Categories', 'Dashboard', 'Debts', 'Diary', 'Transactions', 'Wallets'];
const VIEW_REGEX = /\b(Dashboard|Transactions|Wallets|Debts|Diary|Categories)View\b/;

test.describe('Tab view idle preloading', () => {
  test('the other views are requested without a tab click', async ({ page }) => {
    const requestedViews = new Set<string>();
    page.on('request', (req) => {
      const match = req.url().match(VIEW_REGEX);
      if (match) {
        requestedViews.add(match[1]);
      }
    });

    await page.goto('/');

    await expect
      .poll(() => Array.from(requestedViews).sort(), { timeout: 15000 })
      .toEqual(EXPECTED_VIEWS);
  });

  test('switching through every tab never shows the loading skeleton', async ({ page }) => {
    const requestedViews = new Set<string>();
    page.on('request', (req) => {
      const match = req.url().match(VIEW_REGEX);
      if (match) {
        requestedViews.add(match[1]);
      }
    });

    await page.goto('/');

    await expect
      .poll(() => Array.from(requestedViews).sort(), { timeout: 15000 })
      .toEqual(EXPECTED_VIEWS);

    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      type CustomWindow = Window & { __fallbackSeen?: number };
      const win = window as unknown as CustomWindow;
      win.__fallbackSeen = 0;

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              const el = node as Element;
              if (el.id === 'view-loading-fallback' || el.querySelector?.('#view-loading-fallback')) {
                win.__fallbackSeen = (win.__fallbackSeen ?? 0) + 1;
              }
            }
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    });

    await gotoTab(page, 'transactions');
    await gotoTab(page, 'wallets');
    await gotoTab(page, 'debts');
    await gotoTab(page, 'diary');
    await gotoTab(page, 'categories');
    await gotoTab(page, 'dashboard');

    const fallbackSeen = await page.evaluate(() => {
      type CustomWindow = Window & { __fallbackSeen?: number };
      return (window as unknown as CustomWindow).__fallbackSeen ?? 0;
    });

    expect(fallbackSeen).toBe(0);
  });

  // ADR 0108 (T807): the shell dialogs mount, closed, in the idle callback that
  // preloads the views, so a first open commits in the click's own update.
  // Mounted by the click, a dialog waited for React's 300 ms Suspense reveal
  // throttle, and a second click in that gap landed on the scrim and closed it.
  const SHELL_DIALOGS = [
    { trigger: '#navbar-quick-add-btn', title: 'Quick Record Transaction' },
    { trigger: '#dashboard-wallets-transfer-btn', title: 'Transfer Funds' },
    { trigger: '#dashboard-wallets-add-btn', title: 'Add Wallet' },
    { trigger: '#navbar-account-btn', title: 'Account & Security' },
  ];

  for (const { trigger, title } of SHELL_DIALOGS) {
    test(`${title} opens in the click's own update after the idle preload`, async ({ page }) => {
      const requestedViews = new Set<string>();
      page.on('request', (req) => {
        const match = req.url().match(VIEW_REGEX);
        if (match) {
          requestedViews.add(match[1]);
        }
      });

      await page.goto('/');
      await expect
        .poll(() => Array.from(requestedViews).sort(), { timeout: 15000 })
        .toEqual(EXPECTED_VIEWS);
      await page.waitForLoadState('networkidle');
      await expect(page.locator(trigger)).toBeVisible();

      // A click's update renders in a microtask, so one macrotask later a dialog
      // that only had to flip `isOpen` is on the page.
      const openedAtOnce = await page.evaluate(async ({ trigger, title }) => {
        (document.querySelector(trigger) as HTMLElement).click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        return Array.from(document.querySelectorAll('[role="dialog"] h3')).some((h) => h.textContent === title);
      }, { trigger, title });

      expect(openedAtOnce).toBe(true);
      await expect(page.getByRole('dialog', { name: title })).toBeVisible();
    });
  }
});
