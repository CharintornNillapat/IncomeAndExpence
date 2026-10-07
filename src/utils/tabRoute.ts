import type { ActiveTab } from '../components/Navbar';

/**
 * The open tab in the URL (ADR 0088, audit finding 14): `#/transactions`,
 * `#/wallets` and so on, and the bare URL for the Dashboard. Back and Forward
 * walk between tabs, a refresh keeps the tab and a view can be bookmarked.
 *
 * A hash, not a path: the server, the service worker's navigation fallback and
 * `vercel.json` stay as they are, since every URL is still `/`.
 */

/** Swipe order, left to right, and every tab the URL can name. */
export const TAB_ORDER: readonly ActiveTab[] = ['dashboard', 'transactions', 'wallets', 'debts', 'diary', 'categories'];

/**
 * The tab a hash names, or the Dashboard. Only `#/<tab>` names one, so a
 * Supabase sign-in redirect (`#access_token=...`) opens the Dashboard and is
 * left for supabase-js to read.
 */
export function tabFromHash(hash: string): ActiveTab {
  const name = hash.startsWith('#/') ? hash.slice(2) : '';
  return TAB_ORDER.find((tab) => tab === name && tab !== 'dashboard') ?? 'dashboard';
}

/** The URL to push for a tab: its hash, or for the Dashboard the path and query. */
export function urlForTab(tab: ActiveTab, pathname: string, search: string): string {
  return tab === 'dashboard' ? `${pathname}${search}` : `#/${tab}`;
}
