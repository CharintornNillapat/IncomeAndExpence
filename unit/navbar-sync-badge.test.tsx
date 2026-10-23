// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';
import { NavbarSyncBadge } from '../src/components/navbar/NavbarLedgerStatus';

const mock = vi.hoisted(() => ({
  state: { isAuthenticated: true, isSyncing: false, isManualSync: false, syncError: null as string | null },
  refreshFromCloud: vi.fn(async (_options?: { manual?: boolean }) => {}),
}));

vi.mock('../src/context/FinanceContext', () => ({
  useFinanceState: () => mock.state,
  useFinanceActions: () => ({ refreshFromCloud: mock.refreshFromCloud }),
}));

describe('NavbarSyncBadge (T798, ADR 0026 amendment)', () => {
  beforeEach(() => {
    mock.state = { isAuthenticated: true, isSyncing: false, isManualSync: false, syncError: null };
    mock.refreshFromCloud.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const badgeText = () => document.getElementById('navbar-sync-status')?.textContent ?? null;

  it('keeps Synced while a background load runs under 1 s', () => {
    vi.useFakeTimers();
    const onOpenAuth = vi.fn();
    const { rerender } = render(<NavbarSyncBadge onOpenAuth={onOpenAuth} />);
    expect(badgeText()).toBe('Synced');

    Object.assign(mock.state, { isSyncing: true });
    rerender(<NavbarSyncBadge onOpenAuth={onOpenAuth} />);
    expect(badgeText()).toBe('Synced');

    act(() => vi.advanceTimersByTime(999));
    expect(badgeText()).toBe('Synced');
  });

  it('shows Syncing once a background load has run 1 s', () => {
    vi.useFakeTimers();
    const onOpenAuth = vi.fn();
    const { rerender } = render(<NavbarSyncBadge onOpenAuth={onOpenAuth} />);

    Object.assign(mock.state, { isSyncing: true });
    rerender(<NavbarSyncBadge onOpenAuth={onOpenAuth} />);
    act(() => vi.advanceTimersByTime(999));
    act(() => vi.advanceTimersByTime(1));
    expect(badgeText()).toContain('Syncing');
  });

  it('keeps Sync failed, still a retry button, while a background load runs under 1 s', () => {
    vi.useFakeTimers();
    const onOpenAuth = vi.fn();
    Object.assign(mock.state, { syncError: 'Could not read debts', isSyncing: true });
    render(<NavbarSyncBadge onOpenAuth={onOpenAuth} />);

    expect(screen.getByRole('button', { name: 'Sync failed. Try again' })).toBeTruthy();
    expect(badgeText()).not.toContain('Syncing');
  });

  it('starts the 1 s again for the next background load', () => {
    vi.useFakeTimers();
    const onOpenAuth = vi.fn();
    const { rerender } = render(<NavbarSyncBadge onOpenAuth={onOpenAuth} />);

    Object.assign(mock.state, { isSyncing: true });
    rerender(<NavbarSyncBadge onOpenAuth={onOpenAuth} />);
    act(() => vi.advanceTimersByTime(1000));
    expect(badgeText()).toContain('Syncing');

    Object.assign(mock.state, { isSyncing: false });
    rerender(<NavbarSyncBadge onOpenAuth={onOpenAuth} />);
    expect(badgeText()).toBe('Synced');

    Object.assign(mock.state, { isSyncing: true });
    rerender(<NavbarSyncBadge onOpenAuth={onOpenAuth} />);
    expect(badgeText()).toBe('Synced');
  });

  it('shows Syncing at once for a load the user started', () => {
    vi.useFakeTimers();
    const onOpenAuth = vi.fn();
    Object.assign(mock.state, { isSyncing: true, isManualSync: true });
    render(<NavbarSyncBadge onOpenAuth={onOpenAuth} />);
    expect(badgeText()).toContain('Syncing');
  });

  it('Offline still outranks Syncing', () => {
    vi.useFakeTimers();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const onOpenAuth = vi.fn();
    Object.assign(mock.state, { isSyncing: true, isManualSync: true });
    render(<NavbarSyncBadge onOpenAuth={onOpenAuth} />);
    expect(badgeText()).toContain('Offline');
    expect(badgeText()).not.toContain('Syncing');
  });

  it('the Sync failed button starts a load the user sees', () => {
    const onOpenAuth = vi.fn();
    Object.assign(mock.state, { syncError: 'Could not read debts', isSyncing: false });
    render(<NavbarSyncBadge onOpenAuth={onOpenAuth} />);

    const retryButton = screen.getByRole('button', { name: 'Sync failed. Try again' });
    fireEvent.click(retryButton);
    expect(mock.refreshFromCloud).toHaveBeenCalledWith({ manual: true });
  });

  it('a guest keeps the Local button and its id', () => {
    const onOpenAuth = vi.fn();
    Object.assign(mock.state, { isAuthenticated: false });
    render(<NavbarSyncBadge onOpenAuth={onOpenAuth} />);

    const localBtn = document.getElementById('navbar-sync-badge-btn');
    expect(localBtn).not.toBeNull();
    expect(localBtn!.textContent).toContain('Local');
    expect(document.getElementById('navbar-sync-status')).toBeNull();

    fireEvent.click(localBtn!);
    expect(onOpenAuth).toHaveBeenCalledTimes(1);
  });
});
