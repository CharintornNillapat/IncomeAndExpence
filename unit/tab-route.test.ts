import { describe, it, expect } from 'vitest';
import { TAB_ORDER, tabFromHash, titleForTab, urlForTab } from '../src/utils/tabRoute';

/**
 * Phase 112 (ADR 0088, audit finding 14): the open tab lives in the URL's
 * hash, so Back and Forward walk between tabs, a refresh keeps the tab and a
 * view can be bookmarked. The Dashboard is the bare URL.
 */

describe('tabFromHash', () => {
  it.each(TAB_ORDER.filter((t) => t !== 'dashboard'))('reads #/%s', (tab) => {
    expect(tabFromHash(`#/${tab}`)).toBe(tab);
  });

  it.each([
    ['no hash', ''],
    ['an empty hash', '#'],
    ['the dashboard by name', '#/dashboard'],
    ['an unknown tab', '#/settings'],
    ['a tab without the slash', '#wallets'],
    ['a tab with a trailing slash', '#/wallets/'],
    ['the wrong case', '#/Wallets'],
    // A Supabase sign-in redirect puts its tokens in the hash; it is no tab.
    ['an auth redirect', '#access_token=abc&type=signup'],
    ['an inherited property name', '#/constructor'],
  ])('opens the Dashboard for %s', (_label, hash) => {
    expect(tabFromHash(hash)).toBe('dashboard');
  });
});

describe('urlForTab', () => {
  it('names every tab but the Dashboard in the hash', () => {
    expect(urlForTab('wallets', '/', '')).toBe('#/wallets');
    expect(urlForTab('categories', '/', '')).toBe('#/categories');
  });

  it('gives the Dashboard the bare path, keeping any query', () => {
    expect(urlForTab('dashboard', '/', '')).toBe('/');
    expect(urlForTab('dashboard', '/', '?code=abc')).toBe('/?code=abc');
  });

  it('round-trips every tab', () => {
    for (const tab of TAB_ORDER) {
      const url = urlForTab(tab, '/', '');
      expect(tabFromHash(url.startsWith('#') ? url : '')).toBe(tab);
    }
  });
});

describe('titleForTab', () => {
  it('is the app name alone for the Dashboard', () => {
    expect(titleForTab('dashboard')).toBe('FinLife Tracker');
  });

  it.each([
    ['transactions', 'Transactions · FinLife Tracker'],
    ['wallets', 'Wallets · FinLife Tracker'],
    ['debts', 'Debt payoff · FinLife Tracker'],
    ['diary', 'Daily diary · FinLife Tracker'],
    ['categories', 'Categories · FinLife Tracker'],
  ] as const)('names %s by its navigation label', (tab, title) => {
    expect(titleForTab(tab)).toBe(title);
  });
});
