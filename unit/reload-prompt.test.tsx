// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ReloadPrompt } from '../src/components/ReloadPrompt';

const state = vi.hoisted(() => ({
  offlineReady: false,
  needRefresh: false,
  setOfflineReady: vi.fn(),
  setNeedRefresh: vi.fn(),
  updateServiceWorker: vi.fn(),
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    offlineReady: [state.offlineReady, state.setOfflineReady],
    needRefresh: [state.needRefresh, state.setNeedRefresh],
    updateServiceWorker: state.updateServiceWorker,
  }),
}));

describe('PWA update prompt policy (ADR 0107)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.offlineReady = false;
    state.needRefresh = false;
  });

  afterEach(() => {
    cleanup();
  });

  it('vite.config.ts asks before updating', () => {
    const configPath = path.resolve(__dirname, '../vite.config.ts');
    const content = fs.readFileSync(configPath, 'utf8');

    expect(content).toContain("registerType: 'prompt'");
    expect(content).not.toContain("registerType: 'autoUpdate'");
  });

  it('shows the notice and Reload asks the library to update', () => {
    state.needRefresh = true;
    state.offlineReady = false;

    const { container } = render(<ReloadPrompt />);

    const notice = screen.getByRole('complementary', { name: 'App update notification' });
    expect(notice).not.toBeNull();
    expect(notice.textContent).toContain('A new version is ready');

    expect(state.updateServiceWorker).toHaveBeenCalledTimes(0);

    const reloadBtn = container.querySelector('#pwa-reload-btn');
    expect(reloadBtn).not.toBeNull();
    fireEvent.click(reloadBtn!);

    expect(state.updateServiceWorker).toHaveBeenCalledTimes(1);
    expect(state.updateServiceWorker).toHaveBeenCalledWith(true);

    const dismissBtn = container.querySelector('#pwa-dismiss-btn');
    expect(dismissBtn).not.toBeNull();
    fireEvent.click(dismissBtn!);

    expect(state.setNeedRefresh).toHaveBeenCalledWith(false);
    expect(state.setOfflineReady).toHaveBeenCalledWith(false);
    expect(state.updateServiceWorker).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when not offlineReady and not needRefresh', () => {
    state.needRefresh = false;
    state.offlineReady = false;

    const { container } = render(<ReloadPrompt />);
    expect(container.firstChild).toBeNull();
  });

  it('renders offline ready notice with no reload button when offlineReady is true', () => {
    state.needRefresh = false;
    state.offlineReady = true;

    const { container } = render(<ReloadPrompt />);

    const notice = screen.getByRole('complementary', { name: 'App update notification' });
    expect(notice).not.toBeNull();
    expect(notice.textContent).toContain('Ready to use offline');
    expect(container.querySelector('#pwa-reload-btn')).toBeNull();

    const dismissBtn = container.querySelector('#pwa-dismiss-btn');
    expect(dismissBtn).not.toBeNull();
    fireEvent.click(dismissBtn!);
    expect(state.setOfflineReady).toHaveBeenCalledWith(false);
  });
});
