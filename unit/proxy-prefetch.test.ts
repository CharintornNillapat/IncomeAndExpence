import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

/**
 * The key set fetch each proxy starts when it loads (ADR 0065).
 *
 * The functions keep the key set in module state, so every test here loads a
 * fresh copy of the proxy (`vi.resetModules`) with its environment and `fetch`
 * already stubbed: the fetch starts during the import, before any request.
 *
 * Requests send an empty body. A token that passes the check, and the count
 * after it, gets 400 for the body, so 400 means "accepted" and TypeSafe is
 * never called; 401 means the token was refused.
 */

const PROJECT_URL = 'https://prefetch.supabase.test';
const ISSUER = `${PROJECT_URL}/auth/v1`;
const JWKS_URL = `${ISSUER}/.well-known/jwks.json`;
const QUOTA_URL = `${PROJECT_URL}/rest/v1/rpc/consume_ai_quota`;

const PROXIES = [
  { name: '/api/classify', load: () => import('../api/classify.ts') },
  { name: '/api/insights', load: () => import('../api/insights.ts') },
] as const;

interface TestKey {
  privateKey: CryptoKey;
  jwk: JsonWebKey & { kid: string; alg: string; use: string };
}

let KEY: TestKey;
beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  KEY = { privateKey: pair.privateKey, jwk: { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'key-1', alg: 'ES256', use: 'sig' } };
});

const b64url = (bytes: Uint8Array | string) => Buffer.from(bytes).toString('base64url');

async function token(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: KEY.jwk.kid, typ: 'JWT' }));
  const body = b64url(JSON.stringify({
    iss: ISSUER, aud: 'authenticated', role: 'authenticated',
    sub: crypto.randomUUID(), session_id: crypto.randomUUID(), exp: now + 3600, iat: now,
  }));
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, KEY.privateKey, Buffer.from(`${head}.${body}`));
  return `${head}.${body}.${b64url(new Uint8Array(signature))}`;
}

async function signedIn(name: string): Promise<Request> {
  return new Request(`https://finlife.test${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
    body: '{}',
  });
}

const keySet = () => new Response(JSON.stringify({ keys: [KEY.jwk] }), { status: 200 });

/** A key set answer the test settles when it chooses. */
function deferred(): { promise: Promise<Response>; resolve: (res: Response) => void } {
  let resolve!: (res: Response) => void;
  const promise = new Promise<Response>((r) => { resolve = r; });
  return { promise, resolve };
}

/** Lets a settled fetch's continuations (the key import, the bookkeeping) run. */
const settle = () => new Promise((r) => setTimeout(r, 0));

let keyAnswers: Array<() => Response | Promise<Response>>;
let upstream: ReturnType<typeof vi.fn>;
const keyCalls = () => upstream.mock.calls.filter(([url]) => url === JWKS_URL).length;
const otherCalls = () => upstream.mock.calls.filter(([url]) => url !== JWKS_URL && url !== QUOTA_URL).length;
const authTiming = (res: Response) => /(?:^|, )auth;dur=[\d.]+(;desc="keys")?/.exec(res.headers.get('Server-Timing') ?? '');

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', `${PROJECT_URL}/`);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-not-real');
  vi.stubEnv('TYPESAFE_API_KEY', 'test-key-not-real');
  // Key set answers in order; past the list, the keys.
  keyAnswers = [];
  upstream = vi.fn(async (url: string) => {
    if (url === JWKS_URL) {
      const answer = keyAnswers.shift();
      return answer ? answer() : keySet();
    }
    if (url === QUOTA_URL) return new Response(JSON.stringify({ count: 1, retry_after: 30 }), { status: 200 });
    return new Response('{}', { status: 200 });
  });
  vi.stubGlobal('fetch', upstream);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe.each(PROXIES)('$name key set prefetch', ({ name, load }) => {
  it('starts fetching the key set when the module loads, before any request', async () => {
    await load();

    expect(keyCalls()).toBe(1);
    expect(upstream.mock.calls[0][0]).toBe(JWKS_URL);
  });

  it('lets a request after the prefetch landed check its token with no fetch of its own', async () => {
    const { POST } = await load();
    await settle();

    const res = await POST(await signedIn(name));

    expect(res.status).toBe(400);
    expect(keyCalls()).toBe(1);
    expect(authTiming(res)?.[0]).toBeDefined();
    expect(authTiming(res)?.[1]).toBeUndefined();
  });

  it('makes requests that arrive during the prefetch wait for that same fetch', async () => {
    const answer = deferred();
    keyAnswers.push(() => answer.promise);
    const { POST } = await load();

    const first = POST(await signedIn(name));
    const second = POST(await signedIn(name));
    await settle();
    expect(keyCalls()).toBe(1);
    answer.resolve(keySet());
    const responses = await Promise.all([first, second]);

    expect(responses.map((res) => res.status)).toEqual([400, 400]);
    expect(keyCalls()).toBe(1);
    // They waited on a key set fetch, so the timing says so.
    expect(responses.map((res) => authTiming(res)?.[1])).toEqual([';desc="keys"', ';desc="keys"']);
  });

  it.each([
    ['answers 503', () => new Response('{}', { status: 503 })],
    ['cannot connect', () => { throw new TypeError('fetch failed'); }],
  ])('leaves the first request to fetch the keys itself when the prefetch %s', async (_label, failure) => {
    keyAnswers.push(failure);
    const { POST } = await load();
    await settle();

    const res = await POST(await signedIn(name));

    expect(res.status).toBe(400);
    expect(keyCalls()).toBe(2);
    expect(authTiming(res)?.[1]).toBe(';desc="keys"');
  });

  it('still answers 503, never a crash, when neither the prefetch nor the request gets keys', async () => {
    keyAnswers.push(() => new Response('{}', { status: 503 }), () => new Response('{}', { status: 503 }));
    const { POST } = await load();
    await settle();

    const res = await POST(await signedIn(name));

    expect(res.status).toBe(503);
    expect(otherCalls()).toBe(0);
  });

  it('does not wait for a prefetch older than the fetch timeout (an instance frozen mid-fetch)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T09:00:00Z'));
    const frozen = deferred();
    keyAnswers.push(() => frozen.promise);
    const { POST } = await load();

    vi.setSystemTime(new Date('2026-10-05T09:00:03.001Z'));
    const res = await POST(await signedIn(name));

    expect(res.status).toBe(400);
    expect(keyCalls()).toBe(2);
    frozen.resolve(new Response('{}', { status: 503 }));
  });

  it.each([
    ['VITE_SUPABASE_URL'],
    ['TYPESAFE_API_KEY'],
  ])('fetches nothing at load without %s', async (setting) => {
    vi.stubEnv(setting, '');

    await load();
    await settle();

    expect(upstream).not.toHaveBeenCalled();
  });
});
