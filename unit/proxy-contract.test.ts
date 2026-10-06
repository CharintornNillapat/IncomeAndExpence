import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { POST as classify } from '../api/classify.ts';
import { POST as insights } from '../api/insights.ts';

// ADR 0065: each proxy starts fetching its key set when it loads, which here is
// before any test's stub. Whatever the shell's environment holds, that fetch
// must not leave the machine. (`unit/proxy-prefetch.test.ts` tests it.)
vi.hoisted(() => {
  vi.stubGlobal('fetch', () => Promise.reject(new TypeError('no network while the proxies load')));
});

/**
 * The two Vercel proxies' contract with the client (ADR 0022).
 *
 * Until Phase 50 these files were covered by `tsc` alone - every Playwright
 * spec mocks `/api/*` at the network layer, so the handlers themselves never
 * ran in a test. That is how an upstream 429 came to be mapped to 503 while
 * three unit tests pinned a 429 backoff the real proxy could never trigger.
 *
 * `POST` is already the handlers' public surface (a named method export is
 * mandatory on Vercel - see CLAUDE.md), so nothing was exported for this file.
 *
 * Type-checked by `api/tsconfig.json`, not the root config: importing an
 * `api/` file needs Node's `process`, which the root config deliberately does
 * not declare. The root config excludes this file for exactly that reason.
 */

const CLASSIFY_BODY = {
  text: 'lunch at the food court',
  categories: [
    { id: 'cat-food', name: 'Food & Dining', description: 'Meals, groceries, snacks' },
    { id: 'cat-transport', name: 'Transportation' },
  ],
};

const INSIGHTS_BODY = {
  summary: {
    month: '2026-09',
    categories: [
      { name: 'Food & Dining', current: 4200, previous: 4000, changePercent: 5, txCount: 30 },
      { name: 'Transportation', current: 3500, previous: 800, changePercent: 337.5, txCount: 12 },
    ],
    totals: { income: 30000, expense: 7700, net: 22300, previousExpense: 4800 },
  },
};

const FORBIDDEN_KEYS = ['instructions', 'criteria', 'model', 'state', 'questions'];

const ENDPOINTS = [
  {
    name: '/api/classify',
    handler: classify,
    body: CLASSIFY_BODY,
    answers: {
      category: { choice: 'cat-food', confidence: 0.96 },
      txtype: { choice: 'EXPENSE', confidence: 1 },
    },
  },
  {
    name: '/api/insights',
    handler: insights,
    body: INSIGHTS_BODY,
    answers: {
      pattern: { choice: 'CATEGORY_SPIKE', confidence: 0.9 },
      focus: { choice: 'Transportation', confidence: 0.8 },
    },
  },
] as const;

function post(path: string, body: unknown): Request {
  return new Request(`https://finlife.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

let upstream: ReturnType<typeof vi.fn>;

/** Makes the next TypeSafe call answer with `status` and `body`. */
function upstreamReplies(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  upstream.mockResolvedValue(new Response(JSON.stringify(body), { status, headers }));
}

beforeEach(() => {
  vi.stubEnv('TYPESAFE_API_KEY', 'test-key-not-real');
  upstream = vi.fn();
  vi.stubGlobal('fetch', upstream);
  // The handlers log upstream failures by status; keep the run quiet.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe.each(ENDPOINTS)('$name', ({ name, handler, body, answers }) => {
  it('answers 404 when the key is missing, so the client latches off', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', '');

    const res = await handler(post(name, body));

    expect(res.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it.each(FORBIDDEN_KEYS)('rejects a client-supplied "%s" without calling upstream', async (key) => {
    const res = await handler(post(name, { ...body, [key]: 'anything' }));

    expect(res.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('sends the server-owned question and returns a typed answer', async () => {
    upstreamReplies(200, { answers });

    const res = await handler(post(name, body));

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const sent = JSON.parse(upstream.mock.calls[0][1].body as string);
    expect(sent.model).toBe('jev-latest');
    expect(Object.keys(sent.questions).sort()).toEqual(Object.keys(answers).sort());
    expect(upstream.mock.calls[0][1].headers.Authorization).toBe('Bearer test-key-not-real');
  });

  it('passes an upstream 429 through, so the batch backoff can see it', async () => {
    upstreamReplies(429);
    const res = await handler(post(name, body));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeNull();
  });

  // ADR 0053: TypeSafe's own wait reaches the client, always as whole seconds.
  it.each([
    ['Retry-After seconds', { 'Retry-After': '7' }, '7'],
    ['Retry-After with spaces', { 'Retry-After': ' 12 ' }, '12'],
    ['retry-after-ms, rounded up', { 'retry-after-ms': '2500' }, '3'],
    ['retry-after-ms over Retry-After', { 'retry-after-ms': '1000', 'Retry-After': '30' }, '1'],
    ['a huge value, capped at a day', { 'Retry-After': '99999999999999999999999' }, '86400'],
  ])('forwards an upstream 429\'s wait: %s', async (_label, headers, expected) => {
    upstreamReplies(429, {}, headers);
    const res = await handler(post(name, body));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe(expected);
  });

  it('forwards an upstream 429\'s HTTP date as the seconds left', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-04T03:00:00Z'));
      upstreamReplies(429, {}, { 'Retry-After': 'Sun, 04 Oct 2026 03:00:20 GMT' });
      expect((await handler(post(name, body))).headers.get('Retry-After')).toBe('20');
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ['a word', { 'Retry-After': 'soon' }],
    ['a negative number', { 'Retry-After': '-5' }],
    ['a date already past', { 'Retry-After': 'Thu, 01 Jan 2026 00:00:00 GMT' }],
    ['an empty value', { 'Retry-After': '' }],
  ])('sends a 429 without Retry-After when upstream\'s is unusable: %s', async (_label, headers) => {
    upstreamReplies(429, {}, headers);
    const res = await handler(post(name, body));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeNull();
  });

  it('forwards no other upstream header and no Retry-After on a non-429', async () => {
    upstreamReplies(503, {}, { 'Retry-After': '5', 'x-typesafe-request-id': 'req-123' });
    const res = await handler(post(name, body));
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBeNull();
    expect(res.headers.get('x-typesafe-request-id')).toBeNull();
  });

  it('maps a rejected key to 502, not a retryable status', async () => {
    upstreamReplies(401);
    expect((await handler(post(name, body))).status).toBe(502);
  });

  it.each([500, 503, 529])('maps an upstream %i to 503', async (status) => {
    upstreamReplies(status);
    expect((await handler(post(name, body))).status).toBe(503);
  });

  it('never forwards the upstream body, which may echo request content', async () => {
    upstreamReplies(429, { echoed: 'lunch at the food court' });

    const text = await (await handler(post(name, body))).text();

    expect(text).not.toContain('lunch at the food court');
    expect(text).not.toContain('echoed');
  });
});

/**
 * The caller check (ADR 0032; local since ADR 0064). A signed-in caller's
 * access token is checked in the function, against the signing keys the
 * project publishes at `/auth/v1/.well-known/jwks.json`: the auth server is
 * never asked about the token itself. These tests sign real ES256 tokens with
 * a key pair made here and serve its public half from the `fetch` stub.
 *
 * The property that matters in every refusal is that TypeSafe was never
 * called - a refused or unchecked caller must not spend credits.
 *
 * The functions keep the key set per instance (module), by issuer, so every
 * test runs against a project URL of its own and starts with no keys held.
 */
let projectCounter = 0;
let SUPABASE_URL = '';
const issuer = () => `${SUPABASE_URL}/auth/v1`;
const jwksUrl = () => `${issuer()}/.well-known/jwks.json`;
const quotaUrl = () => `${SUPABASE_URL}/rest/v1/rpc/consume_ai_quota`;

beforeEach(() => {
  projectCounter += 1;
  SUPABASE_URL = `https://project-${projectCounter}.supabase.test`;
  vi.stubEnv('VITE_SUPABASE_URL', `${SUPABASE_URL}/`);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-not-real');
});

interface TestKey {
  kid: string;
  privateKey: CryptoKey;
  jwk: JsonWebKey & { kid: string; alg: string; use: string };
}

async function makeKey(kid: string): Promise<TestKey> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return { kid, privateKey: pair.privateKey, jwk: { ...publicJwk, kid, alg: 'ES256', use: 'sig' } };
}

let KEY: TestKey;
let OTHER_KEY: TestKey;
beforeAll(async () => {
  KEY = await makeKey('key-1');
  OTHER_KEY = await makeKey('key-2');
});

const b64url = (bytes: Uint8Array | string) =>
  Buffer.from(typeof bytes === 'string' ? Buffer.from(bytes) : bytes).toString('base64url');

const uuid = () => crypto.randomUUID();

/** A token as Supabase issues one: an hour long, for a user and a session. */
function claimsFor(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: issuer(), aud: 'authenticated', role: 'authenticated',
    sub: uuid(), session_id: uuid(), exp: now + 3600, iat: now,
    ...overrides,
  };
}

async function sign(
  claims: Record<string, unknown> = claimsFor(),
  { key = KEY, header = {} as Record<string, unknown> } = {},
): Promise<string> {
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: key.kid, typ: 'JWT', ...header }));
  const body = b64url(JSON.stringify(claims));
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key.privateKey, Buffer.from(`${head}.${body}`));
  return `${head}.${body}.${b64url(new Uint8Array(signature))}`;
}

/** A fresh, valid token for the current test's project. */
const freshToken = () => sign(claimsFor());

function postAs(path: string, body: unknown, authorization: string): Request {
  return new Request(`https://finlife.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authorization },
    body: JSON.stringify(body),
  });
}

/** What the key set endpoint serves: a list of keys, or a failure. */
type KeysReply = TestKey[] | number | 'throw' | 'not-json' | 'not-a-key-set';

function keysResponse(reply: KeysReply): Response {
  if (reply === 'throw') throw new TypeError('fetch failed');
  if (reply === 'not-json') return new Response('<html>', { status: 200 });
  if (reply === 'not-a-key-set') return new Response('{}', { status: 200 });
  if (typeof reply === 'number') return new Response('{}', { status: reply });
  return new Response(JSON.stringify({ keys: reply.map((k) => k.jwk) }), { status: 200 });
}

describe.each(ENDPOINTS)('$name caller check', ({ name, handler, body, answers }) => {
  let keysReply: KeysReply;

  beforeEach(() => {
    keysReply = [KEY];
    upstream.mockImplementation(async (url: string) => {
      if (url === jwksUrl()) return keysResponse(keysReply);
      // ADR 0049: an accepted token is counted next; well under the limit here.
      if (url === quotaUrl()) return new Response(JSON.stringify({ count: 1, retry_after: 30 }), { status: 200 });
      return new Response(JSON.stringify({ answers }), { status: 200 });
    });
  });

  const keyCalls = () => upstream.mock.calls.filter(([url]) => url === jwksUrl());
  const quotaCalls = () => upstream.mock.calls.filter(([url]) => url === quotaUrl());
  const typesafeCalls = () => upstream.mock.calls.filter(([url]) => !String(url).includes('.supabase.test'));
  const as = async (token: string | Promise<string>) => handler(postAs(name, body, `Bearer ${await token}`));

  it('lets a guest through without fetching keys or counting', async () => {
    const res = await handler(post(name, body));

    expect(res.status).toBe(200);
    expect(keyCalls()).toHaveLength(0);
    expect(quotaCalls()).toHaveLength(0);
    expect(typesafeCalls()).toHaveLength(1);
  });

  it('checks a valid token itself, never asking the auth server about it', async () => {
    const res = await as(freshToken());

    expect(res.status).toBe(200);
    expect(keyCalls()).toHaveLength(1);
    // The key set is public: fetched with no token and no key.
    expect(keyCalls()[0][1]?.headers).toBeUndefined();
    expect(upstream.mock.calls.some(([url]) => String(url).endsWith('/auth/v1/user'))).toBe(false);
    expect(quotaCalls()).toHaveLength(1);
    expect(typesafeCalls()).toHaveLength(1);
  });

  it('fetches the key set once and checks every later token with it', async () => {
    for (let i = 0; i < 3; i++) expect((await as(freshToken())).status).toBe(200);

    expect(keyCalls()).toHaveLength(1);
  });

  it('fetches the key set again after ten minutes', async () => {
    const start = Date.now();
    expect((await as(freshToken())).status).toBe(200);
    vi.spyOn(Date, 'now').mockReturnValue(start + 11 * 60_000);

    expect((await as(freshToken())).status).toBe(200);
    expect(keyCalls()).toHaveLength(2);
  });

  it('accepts the audience as an array, as the spec allows', async () => {
    expect((await as(sign(claimsFor({ aud: ['authenticated', 'other'] })))).status).toBe(200);
  });

  it.each([
    ['expired', { exp: Math.floor(Date.now() / 1000) - 1 }],
    ['without an expiry', { exp: undefined }],
    ['not valid yet', { nbf: Math.floor(Date.now() / 1000) + 600 }],
    ['from another issuer', { iss: 'https://elsewhere.supabase.test/auth/v1' }],
    ['for another audience', { aud: 'service' }],
    ['for the anon role', { role: 'anon' }],
    ['for the service role', { role: 'service_role' }],
    ['without a user', { sub: undefined }],
    ['with a user that is not a uuid', { sub: 'user-1' }],
    ['without a session', { session_id: undefined }],
    ['with a session that is not a uuid', { session_id: 'session-1' }],
  ])('answers 401 to a token %s, without counting or calling TypeSafe', async (_label, overrides) => {
    const res = await as(sign(claimsFor(overrides)));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized.' });
    expect(quotaCalls()).toHaveLength(0);
    expect(typesafeCalls()).toHaveLength(0);
  });

  it('answers 401 to a token whose claims were changed after signing', async () => {
    const [head, , signature] = (await freshToken()).split('.');
    const forged = b64url(JSON.stringify(claimsFor({ sub: uuid() })));

    expect((await as(`${head}.${forged}.${signature}`)).status).toBe(401);
    expect(typesafeCalls()).toHaveLength(0);
  });

  it('answers 401 to a token signed by another key under a known kid', async () => {
    const res = await as(sign(claimsFor(), { key: { ...OTHER_KEY, kid: KEY.kid } }));

    expect(res.status).toBe(401);
    expect(typesafeCalls()).toHaveLength(0);
  });

  it.each([
    ['alg none', { alg: 'none' }],
    ['HS256, a shared-secret algorithm', { alg: 'HS256' }],
    ['no kid', { kid: undefined }],
  ])('answers 401 to a token with %s, before fetching keys', async (_label, header) => {
    const res = await as(sign(claimsFor(), { header }));

    expect(res.status).toBe(401);
    expect(keyCalls()).toHaveLength(0);
    expect(typesafeCalls()).toHaveLength(0);
  });

  it.each([
    ['two segments', 'aaa.bbb'],
    ['four segments', 'a.b.c.d'],
    ['a segment that is not base64url', 'a+b.c.d'],
    ['a header that is not JSON', `${b64url('not json')}.${b64url('{}')}.${b64url('x')}`],
    ['a header that is a JSON array', `${b64url('[]')}.${b64url('{}')}.${b64url('x')}`],
  ])('answers 401 to %s, before fetching keys', async (_label, token) => {
    const res = await as(token);

    expect(res.status).toBe(401);
    expect(keyCalls()).toHaveLength(0);
    expect(typesafeCalls()).toHaveLength(0);
  });

  it('fetches the key set again for a new kid, and accepts a token signed by it (a rotation)', async () => {
    const start = Date.now();
    expect((await as(freshToken())).status).toBe(200);
    keysReply = [KEY, OTHER_KEY];
    vi.spyOn(Date, 'now').mockReturnValue(start + 31_000);

    expect((await as(sign(claimsFor(), { key: OTHER_KEY }))).status).toBe(200);
    expect(keyCalls()).toHaveLength(2);
  });

  it('answers 401 to an unknown kid, and refetches for one at most every 30 s', async () => {
    const start = Date.now();
    const now = vi.spyOn(Date, 'now');
    expect((await as(freshToken())).status).toBe(200);

    // A set fetched under 30 s ago is fresh enough: no fetch, 401.
    expect((await as(sign(claimsFor(), { key: OTHER_KEY }))).status).toBe(401);
    expect(keyCalls()).toHaveLength(1);
    // Older: fetched again, still not there, 401; and not again for 30 s.
    now.mockReturnValue(start + 31_000);
    expect((await as(sign(claimsFor(), { key: OTHER_KEY }))).status).toBe(401);
    now.mockReturnValue(start + 40_000);
    expect((await as(sign(claimsFor(), { key: OTHER_KEY }))).status).toBe(401);
    expect(keyCalls()).toHaveLength(2);
    expect(typesafeCalls()).toHaveLength(1);
  });

  it.each([500, 503, 404, 'throw', 'not-json', 'not-a-key-set'] as const)(
    'answers 503 when the key set cannot be had (%s), without calling TypeSafe',
    async (reply) => {
      keysReply = reply;

      const res = await as(freshToken());

      expect(res.status).toBe(503);
      expect(typesafeCalls()).toHaveLength(0);
    }
  );

  it('answers 401 when the key set has no key for the token', async () => {
    keysReply = [];

    expect((await as(freshToken())).status).toBe(401);
    expect(typesafeCalls()).toHaveLength(0);
  });

  it('keeps checking with the keys it holds when a later fetch fails', async () => {
    const start = Date.now();
    expect((await as(freshToken())).status).toBe(200);
    vi.spyOn(Date, 'now').mockReturnValue(start + 11 * 60_000);
    keysReply = 503;

    expect((await as(freshToken())).status).toBe(200);
    expect(keyCalls()).toHaveLength(2);
  });

  it('accepts the scheme in any case (RFC 7235)', async () => {
    const res = await handler(postAs(name, body, `bearer ${await freshToken()}`));

    expect(res.status).toBe(200);
  });

  it.each(['Basic dXNlcjpwYXNz', 'Bearer', 'Bearer ', 'Token abc', 'Bearer a b'])(
    'answers 401 to a malformed header "%s" without asking anyone',
    async (authorization) => {
      const res = await handler(postAs(name, body, authorization));

      expect(res.status).toBe(401);
      expect(upstream).not.toHaveBeenCalled();
    }
  );

  it('answers 503 to a token when this deployment has no Supabase settings', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');

    const res = await as(freshToken());

    expect(res.status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('still answers 404 first when the TypeSafe key is missing, so the client latches off', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', '');

    const res = await as(freshToken());

    expect(res.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });
});

/**
 * The per-account limit (ADR 0049), and since ADR 0064 the session check.
 * A signed-in request is counted through `consume_ai_quota()` once its token
 * checks out. The stub below keeps one count per token, standing in for the
 * database's one row per account (`auth.uid()`), and answers the way PostgREST
 * does.
 */
const LIMIT = 120;

describe.each(ENDPOINTS)('$name per-account limit', ({ name, handler, body, answers }) => {
  let counts: Map<string, number>;
  let quotaReply: number | 'throw' | 'not-json' | 'no-count' | null;

  beforeEach(() => {
    counts = new Map();
    quotaReply = null;
    upstream.mockImplementation(async (url: string, init: RequestInit) => {
      if (url === jwksUrl()) return keysResponse([KEY]);
      if (url === quotaUrl()) {
        if (quotaReply === 'throw') throw new TypeError('fetch failed');
        if (quotaReply === 'not-json') return new Response('<html>', { status: 200 });
        if (quotaReply === 'no-count') return new Response('{"retry_after":30}', { status: 200 });
        if (typeof quotaReply === 'number') return new Response('{}', { status: quotaReply });
        const caller = (init.headers as Record<string, string>).Authorization;
        const count = (counts.get(caller) ?? 0) + 1;
        counts.set(caller, count);
        return new Response(JSON.stringify({ count, retry_after: 17 }), { status: 200 });
      }
      return new Response(JSON.stringify({ answers }), { status: 200 });
    });
  });

  const quotaCalls = () => upstream.mock.calls.filter(([url]) => url === quotaUrl());
  const typesafeCalls = () => upstream.mock.calls.filter(([url]) => !String(url).includes('.supabase.test'));

  /** Sends `n` requests as `token` and returns their statuses in order. */
  async function burst(token: string, n: number, payload: unknown = body): Promise<number[]> {
    const statuses: number[] = [];
    for (let i = 0; i < n; i++) statuses.push((await handler(postAs(name, payload, `Bearer ${token}`))).status);
    return statuses;
  }

  it(`answers the ${LIMIT + 1}st request in a minute from one account 429, without calling TypeSafe`, async () => {
    const statuses = await burst(await freshToken(), LIMIT + 1);

    expect(statuses.slice(0, LIMIT).every((s) => s === 200)).toBe(true);
    expect(statuses[LIMIT]).toBe(429);
    expect(typesafeCalls()).toHaveLength(LIMIT);
  });

  it('says when to try again, and nothing else', async () => {
    const token = await freshToken();
    counts.set(`Bearer ${token}`, LIMIT);

    const res = await handler(postAs(name, body, `Bearer ${token}`));

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('17');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ error: 'Too many requests.' });
  });

  it('counts each account on its own', async () => {
    const busy = await freshToken();
    counts.set(`Bearer ${busy}`, LIMIT);

    expect((await handler(postAs(name, body, `Bearer ${busy}`))).status).toBe(429);
    expect((await handler(postAs(name, body, `Bearer ${await freshToken()}`))).status).toBe(200);
  });

  it('asks for the count, and so the session, on every request', async () => {
    await burst(await freshToken(), 3);

    expect(quotaCalls()).toHaveLength(3);
  });

  it("counts with the caller's own token and the anon key, sending no account id", async () => {
    const token = await freshToken();

    await handler(postAs(name, body, `Bearer ${token}`));

    const [, init] = quotaCalls()[0];
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      apikey: 'anon-key-not-real',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
    expect(init.body).toBe('{}');
  });

  it('counts before reading the body, so an empty-body burst reaches the limit for free', async () => {
    const statuses = await burst(await freshToken(), LIMIT + 1, {});

    expect(statuses.slice(0, LIMIT).every((s) => s === 400)).toBe(true);
    expect(statuses[LIMIT]).toBe(429);
    expect(typesafeCalls()).toHaveLength(0);
  });

  it('never counts a guest: the firewall rule does that', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < LIMIT + 10; i++) statuses.push((await handler(post(name, {}))).status);

    expect(statuses.every((s) => s === 400)).toBe(true);
    expect(quotaCalls()).toHaveLength(0);
  });

  it('never counts a token the check refused', async () => {
    const expired = await sign(claimsFor({ exp: Math.floor(Date.now() / 1000) - 60 }));

    expect((await handler(postAs(name, body, `Bearer ${expired}`))).status).toBe(401);
    expect(quotaCalls()).toHaveLength(0);
  });

  it.each([401, 403])(
    'answers 401 when the database refuses the token or its session has ended (%i), without calling TypeSafe',
    async (status) => {
      quotaReply = status;

      expect((await handler(postAs(name, body, `Bearer ${await freshToken()}`))).status).toBe(401);
      expect(typesafeCalls()).toHaveLength(0);
    }
  );

  it.each([404, 429, 500, 503, 'throw', 'not-json', 'no-count'] as const)(
    'answers 503 when the count cannot be had (%s), without calling TypeSafe',
    async (reply) => {
      quotaReply = reply;

      expect((await handler(postAs(name, body, `Bearer ${await freshToken()}`))).status).toBe(503);
      expect(typesafeCalls()).toHaveLength(0);
    }
  );
});

describe('both proxies share one count per account', () => {
  it(`refuses the ${LIMIT + 1}st request whichever proxy it goes to`, async () => {
    let count = 0;
    upstream.mockImplementation(async (url: string) => {
      if (url === jwksUrl()) return keysResponse([KEY]);
      if (url === quotaUrl()) {
        count += 1;
        return new Response(JSON.stringify({ count, retry_after: 5 }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });
    const token = `Bearer ${await freshToken()}`;

    for (let i = 0; i < LIMIT / 2; i++) {
      await classify(postAs('/api/classify', {}, token));
      await insights(postAs('/api/insights', {}, token));
    }

    expect((await classify(postAs('/api/classify', {}, token))).status).toBe(429);
    expect((await insights(postAs('/api/insights', {}, token))).status).toBe(429);
  });
});

/**
 * Server-Timing (ADR 0050). Every response the handler writes names the steps
 * that ran, in the order they finished, with `total` last. The stub delays each
 * remote step by a known amount, so a duration can be checked against the step
 * it belongs to: the key set 20 ms, quota 30 ms, TypeSafe 40 ms. Since ADR 0064
 * `auth` is the local check: it carries `desc="keys"` when it fetched the key
 * set, and is otherwise far under the 20 ms a fetch takes here.
 */
const STEP = String.raw`(auth|quota|ai|total);dur=\d+\.\d(;desc="keys")?`;
const TIMING_FORMAT = new RegExp(`^${STEP}(, ${STEP})*$`);

interface Step {
  dur: number;
  desc?: string;
}

/** Parses the header, after checking its shape, into step name -> duration. */
function timingsOf(res: Response): Record<string, Step> {
  const header = res.headers.get('Server-Timing') ?? '';
  expect(header).toMatch(TIMING_FORMAT);
  const steps: Record<string, Step> = {};
  for (const part of header.split(', ')) {
    const [stepName, ...params] = part.split(';');
    const step: Step = { dur: Number.NaN };
    for (const param of params) {
      const [key, value] = param.split('=');
      if (key === 'dur') step.dur = Number(value);
      if (key === 'desc') step.desc = value.replace(/"/g, '');
    }
    steps[stepName] = step;
  }
  return steps;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Timer slack: a timer can fire a little early against `performance.now()`. */
const SLACK_MS = 5;

describe.each(ENDPOINTS)('$name Server-Timing', ({ name, handler, body, answers }) => {
  let keysReply: KeysReply;
  let quotaCount: number;
  let typesafeStatus: number;

  beforeEach(() => {
    keysReply = [KEY];
    quotaCount = 1;
    typesafeStatus = 200;
    upstream.mockImplementation(async (url: string) => {
      if (url === jwksUrl()) {
        await wait(20);
        return keysResponse(keysReply);
      }
      if (url === quotaUrl()) {
        await wait(30);
        return new Response(JSON.stringify({ count: quotaCount, retry_after: 9 }), { status: 200 });
      }
      await wait(40);
      return new Response(JSON.stringify({ answers }), { status: typesafeStatus });
    });
  });

  const signedIn = async (payload: unknown = body) => handler(postAs(name, payload, `Bearer ${await freshToken()}`));

  it('a signed-in answer names auth, quota, ai and total, each timing its own step', async () => {
    const res = await signedIn();

    expect(res.status).toBe(200);
    const t = timingsOf(res);
    expect(Object.keys(t)).toEqual(['auth', 'quota', 'ai', 'total']);
    expect(t.auth.desc).toBe('keys');
    expect(t.auth.dur).toBeGreaterThanOrEqual(20 - SLACK_MS);
    expect(t.quota.dur).toBeGreaterThanOrEqual(30 - SLACK_MS);
    expect(t.ai.dur).toBeGreaterThanOrEqual(40 - SLACK_MS);
    // The steps run one after another, inside the whole. Each of the four
    // figures is rounded to 0.1 ms on its own, so the parts can add up to as
    // much as 0.2 ms over the total (CI saw 94.6 against 94.60000000000001).
    expect(t.total.dur).toBeGreaterThanOrEqual(t.auth.dur + t.quota.dur + t.ai.dur - 0.2);
  });

  it('a check with the keys already held has no desc and takes no round trip', async () => {
    await signedIn();

    const t = timingsOf(await signedIn());

    expect(t.auth.desc).toBeUndefined();
    expect(t.auth.dur).toBeLessThan(20 - SLACK_MS);
    expect(t.quota.dur).toBeGreaterThanOrEqual(30 - SLACK_MS);
  });

  it("a guest's answer has only ai and total", async () => {
    const t = timingsOf(await handler(post(name, body)));

    expect(Object.keys(t)).toEqual(['ai', 'total']);
  });

  it('a 429 from the quota names auth, quota and total, and keeps its Retry-After', async () => {
    quotaCount = 121;

    const res = await signedIn();

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('9');
    expect(Object.keys(timingsOf(res))).toEqual(['auth', 'quota', 'total']);
  });

  it('a token the check refuses names auth and total only', async () => {
    const expired = await sign(claimsFor({ exp: Math.floor(Date.now() / 1000) - 60 }));

    const res = await handler(postAs(name, body, `Bearer ${expired}`));

    expect(res.status).toBe(401);
    expect(Object.keys(timingsOf(res))).toEqual(['auth', 'total']);
  });

  it('a key set that cannot be fetched is still timed', async () => {
    keysReply = 'throw';

    const res = await signedIn();

    expect(res.status).toBe(503);
    const t = timingsOf(res);
    expect(Object.keys(t)).toEqual(['auth', 'total']);
    expect(t.auth).toMatchObject({ desc: 'keys' });
    expect(t.auth.dur).toBeGreaterThanOrEqual(20 - SLACK_MS);
  });

  it('a TypeSafe failure keeps its ai step', async () => {
    typesafeStatus = 503;

    const res = await signedIn();

    expect(res.status).toBe(503);
    expect(Object.keys(timingsOf(res))).toEqual(['auth', 'quota', 'ai', 'total']);
  });

  it('a body refused before TypeSafe has no ai step', async () => {
    expect(Object.keys(timingsOf(await signedIn({})))).toEqual(['auth', 'quota', 'total']);
    expect(Object.keys(timingsOf(await handler(post(name, {}))))).toEqual(['total']);
  });

  it('a request refused before any step still carries total', async () => {
    expect(Object.keys(timingsOf(await handler(postAs(name, body, 'Basic dXNlcjpwYXNz'))))).toEqual(['total']);

    vi.stubEnv('TYPESAFE_API_KEY', '');
    const missingKey = await handler(post(name, body));
    expect(missingKey.status).toBe(404);
    expect(Object.keys(timingsOf(missingKey))).toEqual(['total']);
  });
});
