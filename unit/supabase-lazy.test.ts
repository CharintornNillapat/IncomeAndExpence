// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

/**
 * Phase 107 (ADR 0083): a guest's first load does not fetch supabase-js.
 * `src/lib/supabase` imports it only when something needs the client: a
 * stored session or an auth redirect at boot, the sign-in dialog, another tab
 * signing in, or a caller that asks. `createClient` is spied so each test can
 * see whether, and how often, the client was made.
 */

const createClient = vi.fn((url: string) => ({ url, auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } }));
vi.mock('@supabase/supabase-js', () => ({ createClient }));

const STORAGE_KEY = 'sb-project-auth-token';

async function load(options: { configured?: boolean; url?: string } = {}) {
  const configured = options.configured ?? true;
  vi.stubEnv('VITE_SUPABASE_URL', configured ? 'https://project.supabase.test' : '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', configured ? 'anon-key-not-real' : '');
  if (options.url) window.history.replaceState(null, '', options.url);
  vi.resetModules();
  return import('../src/lib/supabase');
}

beforeEach(() => {
  createClient.mockClear();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('loading the client', () => {
  it('makes no client when the module loads', async () => {
    const lib = await load();
    expect(createClient).not.toHaveBeenCalled();
    expect(lib.supabase).toBeUndefined();
  });

  it('makes one client however often it is asked, and tells every listener once', async () => {
    const lib = await load();
    const heard = vi.fn();
    lib.whenSupabaseLoads(heard);

    const [a, b] = await Promise.all([lib.loadSupabase(), lib.loadSupabase()]);

    expect(a).toBe(b);
    expect(lib.supabase).toBe(a);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(heard).toHaveBeenCalledWith(a);
  });

  it('tells a listener added after the load at once, and an unsubscribed one never', async () => {
    const lib = await load();
    const early = vi.fn();
    lib.whenSupabaseLoads(early)();
    await lib.loadSupabase();
    expect(early).not.toHaveBeenCalled();

    const late = vi.fn();
    lib.whenSupabaseLoads(late);
    expect(late).toHaveBeenCalledWith(lib.supabase);
  });

  it('starts loading as the module loads on a device with a stored session', async () => {
    localStorage.setItem(STORAGE_KEY, '{"access_token":"a"}');
    const lib = await load();
    await vi.waitFor(() => expect(lib.supabase).toBeDefined());
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it('loads when another tab stores a session, and not for any other key', async () => {
    const lib = await load();
    window.dispatchEvent(new StorageEvent('storage', { key: 'pf_wallets', newValue: '[]' }));
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: null }));
    expect(createClient).not.toHaveBeenCalled();

    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: '{"access_token":"a"}' }));
    await vi.waitFor(() => expect(lib.supabase).toBeDefined());
  });
});

describe('sessionMayExist', () => {
  it('is false for a guest: nothing stored, no auth redirect', async () => {
    expect((await load()).sessionMayExist()).toBe(false);
  });

  it("is true with a session under supabase-js's own key", async () => {
    localStorage.setItem(STORAGE_KEY, '{"access_token":"a"}');
    expect((await load()).sessionMayExist()).toBe(true);
  });

  it.each(['/#access_token=a&refresh_token=b&type=signup', '/#error=x&error_description=expired', '/?code=abc'])(
    'is true on an auth redirect: %s',
    async (url) => {
      expect((await load({ url })).sessionMayExist()).toBe(true);
    },
  );

  it('is true when storage cannot be read, so a signed-in device is never taken for a guest', async () => {
    const lib = await load();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(lib.sessionMayExist()).toBe(true);
  });

  it('is false without Supabase settings, whatever is stored', async () => {
    localStorage.setItem(STORAGE_KEY, '{"access_token":"a"}');
    expect((await load({ configured: false })).sessionMayExist()).toBe(false);
  });
});

describe('authorizationHeader', () => {
  it('is empty for a guest without loading the client', async () => {
    const lib = await load();
    expect(await lib.authorizationHeader()).toEqual({});
    expect(createClient).not.toHaveBeenCalled();
  });

  it('loads the client to read a stored session', async () => {
    localStorage.setItem(STORAGE_KEY, '{"access_token":"a"}');
    const lib = await load();
    await lib.authorizationHeader();
    expect(createClient).toHaveBeenCalledTimes(1);
  });
});

describe('the auth error checks, without supabase-js', () => {
  it('match the library by shape, as its own helpers do', async () => {
    const lib = await load();
    const authError = (name: string) => Object.assign(new Error('x'), { __isAuthError: true, name });
    expect(lib.isAuthApiError(authError('AuthApiError'))).toBe(true);
    expect(lib.isAuthApiError(authError('AuthRetryableFetchError'))).toBe(false);
    expect(lib.isAuthApiError(new Error('AuthApiError'))).toBe(false);
    expect(lib.isAuthSessionMissingError(authError('AuthSessionMissingError'))).toBe(true);
    expect(lib.isAuthSessionMissingError(null)).toBe(false);
  });
});
