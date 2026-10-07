// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act, waitFor } from '@testing-library/react';

/**
 * Phase 107 (ADR 0083): the provider on a guest's load, where the client is
 * not loaded at boot. It must ask nothing of Supabase until the client
 * arrives, then start its auth listener and take a sign-in from it, as it
 * does at boot on a signed-in device (`authenticated-ledger.test.tsx`).
 *
 * The client loads when the sign-in dialog opens or another tab signs in;
 * here `arrive()` stands for either.
 */

type AuthCallback = (event: string, session: unknown) => void;

const client = {
  auth: {
    getSession: vi.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: vi.fn((callback: AuthCallback) => {
      client.emit = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signOut: vi.fn(async () => ({ error: null })),
  },
  // Every read answers with no rows; this test is about who asks, not what comes back.
  from: vi.fn(() => {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'order', 'limit']) chain[method] = () => chain;
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
    return chain;
  }),
  rpc: vi.fn(async () => ({ data: { status: 'seeded' }, error: null })),
  channel: vi.fn(() => {
    const channel = { on: () => channel, subscribe: () => channel };
    return channel;
  }),
  removeChannel: vi.fn(),
  emit: null as AuthCallback | null,
};

const loader = vi.hoisted(() => ({ listeners: new Set<(c: unknown) => void>(), loaded: false, asked: 0 }));

vi.mock('../src/lib/supabase', async (importActual) => ({
  ...(await importActual<typeof import('../src/lib/supabase')>()),
  isSupabaseConfigured: true,
  get supabase() {
    return loader.loaded ? client : undefined;
  },
  sessionMayExist: () => false,
  loadSupabase: async () => {
    loader.asked += 1;
    return client;
  },
  whenSupabaseLoads: (listener: (c: unknown) => void) => {
    if (loader.loaded) listener(client);
    else loader.listeners.add(listener);
    return () => loader.listeners.delete(listener);
  },
  onDataApiUnauthorized: () => () => {},
}));

const { FinanceProvider, useFinanceState } = await import('../src/context/FinanceContext');

let latest: ReturnType<typeof useFinanceState>;
function Probe() {
  latest = useFinanceState();
  return null;
}

function arrive() {
  loader.loaded = true;
  for (const listener of loader.listeners) listener(client);
  loader.listeners.clear();
}

const SESSION = { user: { id: 'user-1', email: 'a@example.test', user_metadata: {}, created_at: '2026-10-01T00:00:00Z' } };

beforeEach(() => {
  vi.clearAllMocks();
  loader.listeners.clear();
  loader.loaded = false;
  loader.asked = 0;
  client.emit = null;
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('a guest load', () => {
  it('asks nothing of Supabase and loads no client', async () => {
    render(
      <FinanceProvider>
        <Probe />
      </FinanceProvider>,
    );
    await act(async () => {});

    expect(latest.isAuthenticated).toBe(false);
    expect(loader.asked).toBe(0);
    expect(client.auth.getSession).not.toHaveBeenCalled();
    expect(client.auth.onAuthStateChange).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it('starts the auth listener when the client arrives, and takes a sign-in from it', async () => {
    render(
      <FinanceProvider>
        <Probe />
      </FinanceProvider>,
    );
    await act(async () => {});

    await act(async () => arrive());
    await waitFor(() => expect(client.auth.onAuthStateChange).toHaveBeenCalledTimes(1));
    expect(client.auth.getSession).toHaveBeenCalledTimes(1);
    expect(latest.isAuthenticated).toBe(false);

    await act(async () => client.emit!('SIGNED_IN', SESSION));
    await waitFor(() => expect(latest.isAuthenticated).toBe(true));
    expect(latest.currentUser.id).toBe('user-1');
    expect(client.from).toHaveBeenCalled();
  });

  it('signs out without a client by clearing the device only', async () => {
    const { useFinanceActions } = await import('../src/context/FinanceContext');
    let actions: ReturnType<typeof useFinanceActions> | null = null;
    function Actions() {
      actions = useFinanceActions();
      return null;
    }
    render(
      <FinanceProvider>
        <Actions />
      </FinanceProvider>,
    );
    await act(async () => {});

    await act(async () => actions!.signOut());
    expect(client.auth.signOut).not.toHaveBeenCalled();
    expect(loader.asked).toBe(0);
  });
});
