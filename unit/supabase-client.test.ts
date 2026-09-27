import { describe, it, expect, vi, afterEach } from 'vitest';
import { supabase, onDataApiUnauthorized } from '../src/lib/supabase';

/**
 * The 401 signal (ADR 0024, amended).
 *
 * `authenticated-ledger.test.tsx` replaces `src/lib/supabase` wholesale, so it
 * proves what the provider does with the signal, never that the real client
 * emits it. This drives the real client over a stubbed `fetch`: a 401 from
 * PostgREST - a table read or an RPC - must be reported, and nothing else.
 */

function respondWith(status: number, body: unknown) {
  const fetchStub = vi.fn(
    async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  );
  vi.stubGlobal('fetch', fetchStub);
  return fetchStub;
}

const JWT_EXPIRED = { code: 'PGRST303', message: 'JWT expired', details: null, hint: null };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('onDataApiUnauthorized', () => {
  it('reports a 401 from a table read', async () => {
    const fetchStub = respondWith(401, JWT_EXPIRED);
    const heard = vi.fn();
    const stop = onDataApiUnauthorized(heard);

    const { error } = await supabase.from('wallets').select('*');
    stop();

    expect(fetchStub).toHaveBeenCalled(); // the stub, not the network, answered
    expect(error?.code).toBe('PGRST303');
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('reports a 401 from an RPC', async () => {
    respondWith(401, JWT_EXPIRED);
    const heard = vi.fn();
    const stop = onDataApiUnauthorized(heard);

    await supabase.rpc('record_transaction', {});
    stop();

    expect(heard).toHaveBeenCalledTimes(1);
  });

  it.each([
    [200, []],
    [403, { code: '42501', message: 'permission denied for table wallets' }],
    [500, { code: 'XX000', message: 'internal error' }], // not 503: postgrest-js retries that with backoff
  ])('ignores a %i', async (status, body) => {
    respondWith(status, body);
    const heard = vi.fn();
    const stop = onDataApiUnauthorized(heard);

    await supabase.from('wallets').select('*');
    stop();

    expect(heard).not.toHaveBeenCalled();
  });

  it('ignores the auth server\'s own 401s - supabase-js handles those', async () => {
    const fetchStub = respondWith(401, { code: 'bad_jwt', msg: 'invalid JWT' });
    const heard = vi.fn();
    const stop = onDataApiUnauthorized(heard);

    await supabase.auth.getUser('not-a-real-token');
    stop();

    expect(String((fetchStub.mock.calls[0] as unknown[])[0])).toContain('/auth/v1/user');
    expect(heard).not.toHaveBeenCalled();
  });

  it('stops reporting once unsubscribed', async () => {
    respondWith(401, JWT_EXPIRED);
    const heard = vi.fn();
    onDataApiUnauthorized(heard)();

    await supabase.from('wallets').select('*');

    expect(heard).not.toHaveBeenCalled();
  });
});
