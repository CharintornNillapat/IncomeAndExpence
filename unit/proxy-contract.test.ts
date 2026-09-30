import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST as classify } from '../api/classify.ts';
import { POST as insights } from '../api/insights.ts';

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
function upstreamReplies(status: number, body: unknown = {}) {
  upstream.mockResolvedValue(new Response(JSON.stringify(body), { status }));
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
    expect((await handler(post(name, body))).status).toBe(429);
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
 * The caller check (ADR 0032). One `fetch` stub answers both hosts: the auth
 * server's `/auth/v1/user` and TypeSafe. The property that matters in every
 * refusal is that TypeSafe was never called - a refused or unverified caller
 * must not spend credits.
 *
 * Verified tokens are cached per module for a minute, so every test uses a
 * token of its own.
 */
const SUPABASE_URL = 'https://project.supabase.test';
const AUTH_USER_URL = `${SUPABASE_URL}/auth/v1/user`;

let tokenCounter = 0;
function freshToken(): string {
  tokenCounter += 1;
  return `token-${tokenCounter}-${Math.random().toString(36).slice(2)}`;
}

function postAs(path: string, body: unknown, authorization: string): Request {
  return new Request(`https://finlife.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authorization },
    body: JSON.stringify(body),
  });
}

describe.each(ENDPOINTS)('$name caller check', ({ name, handler, body, answers }) => {
  let authStatus: number | 'throw';

  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', `${SUPABASE_URL}/`);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-not-real');
    authStatus = 200;
    upstream.mockImplementation(async (url: string) => {
      if (url === AUTH_USER_URL) {
        if (authStatus === 'throw') throw new TypeError('fetch failed');
        return new Response('{}', { status: authStatus });
      }
      return new Response(JSON.stringify({ answers }), { status: 200 });
    });
  });

  const typesafeCalls = () => upstream.mock.calls.filter(([url]) => url !== AUTH_USER_URL);
  const authCalls = () => upstream.mock.calls.filter(([url]) => url === AUTH_USER_URL);

  it('lets a guest through without asking the auth server', async () => {
    const res = await handler(post(name, body));

    expect(res.status).toBe(200);
    expect(authCalls()).toHaveLength(0);
    expect(typesafeCalls()).toHaveLength(1);
  });

  it('asks the auth server about a token, with the anon key, and goes on when it is accepted', async () => {
    const token = freshToken();

    const res = await handler(postAs(name, body, `Bearer ${token}`));

    expect(res.status).toBe(200);
    expect(authCalls()).toHaveLength(1);
    const [, init] = authCalls()[0];
    expect(init.headers).toEqual({ apikey: 'anon-key-not-real', Authorization: `Bearer ${token}` });
    expect(typesafeCalls()).toHaveLength(1);
  });

  it('remembers an accepted token, so the next call does not ask again', async () => {
    const token = freshToken();

    await handler(postAs(name, body, `Bearer ${token}`));
    const res = await handler(postAs(name, body, `Bearer ${token}`));

    expect(res.status).toBe(200);
    expect(authCalls()).toHaveLength(1);
    expect(typesafeCalls()).toHaveLength(2);
  });

  it.each([401, 403])('answers 401 when the auth server refuses the token (%i), without calling TypeSafe', async (status) => {
    authStatus = status;

    const res = await handler(postAs(name, body, `Bearer ${freshToken()}`));

    expect(res.status).toBe(401);
    expect(typesafeCalls()).toHaveLength(0);
  });

  it('does not remember a refused token', async () => {
    authStatus = 401;
    const token = freshToken();

    await handler(postAs(name, body, `Bearer ${token}`));
    await handler(postAs(name, body, `Bearer ${token}`));

    expect(authCalls()).toHaveLength(2);
    expect(typesafeCalls()).toHaveLength(0);
  });

  it('accepts the scheme in any case (RFC 7235)', async () => {
    const res = await handler(postAs(name, body, `bearer ${freshToken()}`));

    expect(res.status).toBe(200);
    expect(authCalls()).toHaveLength(1);
  });

  it.each(['Basic dXNlcjpwYXNz', 'Bearer', 'Bearer ', 'Token abc', 'Bearer a b'])(
    'answers 401 to a malformed header "%s" without asking anyone',
    async (authorization) => {
      const res = await handler(postAs(name, body, authorization));

      expect(res.status).toBe(401);
      expect(upstream).not.toHaveBeenCalled();
    }
  );

  it.each([429, 500, 503])('answers 503 when the auth server answers %i, without calling TypeSafe', async (status) => {
    authStatus = status;

    const res = await handler(postAs(name, body, `Bearer ${freshToken()}`));

    expect(res.status).toBe(503);
    expect(typesafeCalls()).toHaveLength(0);
  });

  it('answers 503 when the auth server cannot be reached, without calling TypeSafe', async () => {
    authStatus = 'throw';

    const res = await handler(postAs(name, body, `Bearer ${freshToken()}`));

    expect(res.status).toBe(503);
    expect(typesafeCalls()).toHaveLength(0);
  });

  it('answers 503 to a token when this deployment has no Supabase settings', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');

    const res = await handler(postAs(name, body, `Bearer ${freshToken()}`));

    expect(res.status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('still answers 404 first when the TypeSafe key is missing, so the client latches off', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', '');

    const res = await handler(postAs(name, body, `Bearer ${freshToken()}`));

    expect(res.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });
});
