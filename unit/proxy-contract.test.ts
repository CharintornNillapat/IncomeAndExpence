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
      // ADR 0049: an accepted token is counted next; well under the limit here.
      if (url === `${SUPABASE_URL}/rest/v1/rpc/consume_ai_quota`) {
        return new Response(JSON.stringify({ count: 1, retry_after: 30 }), { status: 200 });
      }
      return new Response(JSON.stringify({ answers }), { status: 200 });
    });
  });

  const typesafeCalls = () =>
    upstream.mock.calls.filter(([url]) => url !== AUTH_USER_URL && !String(url).includes('/rest/v1/rpc/'));
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

/**
 * The per-account limit (ADR 0049). A signed-in request is counted through
 * `consume_ai_quota()` before anything else happens to it. The stub below
 * keeps one count per token, standing in for the database's one row per
 * account (`auth.uid()`), and answers the way PostgREST does.
 */
const QUOTA_URL = `${SUPABASE_URL}/rest/v1/rpc/consume_ai_quota`;
const LIMIT = 120;

describe.each(ENDPOINTS)('$name per-account limit', ({ name, handler, body, answers }) => {
  let counts: Map<string, number>;
  let quotaReply: number | 'throw' | 'not-json' | 'no-count' | null;

  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', SUPABASE_URL);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-not-real');
    counts = new Map();
    quotaReply = null;
    upstream.mockImplementation(async (url: string, init: RequestInit) => {
      if (url === AUTH_USER_URL) return new Response('{}', { status: 200 });
      if (url === QUOTA_URL) {
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

  const quotaCalls = () => upstream.mock.calls.filter(([url]) => url === QUOTA_URL);
  const typesafeCalls = () => upstream.mock.calls.filter(([url]) => url !== AUTH_USER_URL && url !== QUOTA_URL);

  /** Sends `n` requests as `token` and returns their statuses in order. */
  async function burst(token: string, n: number, payload: unknown = body): Promise<number[]> {
    const statuses: number[] = [];
    for (let i = 0; i < n; i++) statuses.push((await handler(postAs(name, payload, `Bearer ${token}`))).status);
    return statuses;
  }

  it(`answers the ${LIMIT + 1}st request in a minute from one account 429, without calling TypeSafe`, async () => {
    const statuses = await burst(freshToken(), LIMIT + 1);

    expect(statuses.slice(0, LIMIT).every((s) => s === 200)).toBe(true);
    expect(statuses[LIMIT]).toBe(429);
    expect(typesafeCalls()).toHaveLength(LIMIT);
  });

  it('says when to try again, and nothing else', async () => {
    const token = freshToken();
    counts.set(`Bearer ${token}`, LIMIT);

    const res = await handler(postAs(name, body, `Bearer ${token}`));

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('17');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ error: 'Too many requests.' });
  });

  it('counts each account on its own', async () => {
    const busy = freshToken();
    counts.set(`Bearer ${busy}`, LIMIT);

    expect((await handler(postAs(name, body, `Bearer ${busy}`))).status).toBe(429);
    expect((await handler(postAs(name, body, `Bearer ${freshToken()}`))).status).toBe(200);
  });

  it('asks for the count on every request, even while the token is remembered', async () => {
    await burst(freshToken(), 3);

    expect(upstream.mock.calls.filter(([url]) => url === AUTH_USER_URL)).toHaveLength(1);
    expect(quotaCalls()).toHaveLength(3);
  });

  it("counts with the caller's own token and the anon key, sending no account id", async () => {
    const token = freshToken();

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
    const statuses = await burst(freshToken(), LIMIT + 1, {});

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

  it('never counts a token the auth server refused', async () => {
    upstream.mockImplementation(async (url: string) =>
      new Response('{}', { status: url === AUTH_USER_URL ? 401 : 200 })
    );

    expect((await handler(postAs(name, body, `Bearer ${freshToken()}`))).status).toBe(401);
    expect(quotaCalls()).toHaveLength(0);
  });

  it('answers 401 when the database refuses the token, without calling TypeSafe', async () => {
    quotaReply = 401;

    expect((await handler(postAs(name, body, `Bearer ${freshToken()}`))).status).toBe(401);
    expect(typesafeCalls()).toHaveLength(0);
  });

  it.each([403, 404, 429, 500, 503, 'throw', 'not-json', 'no-count'] as const)(
    'answers 503 when the count cannot be had (%s), without calling TypeSafe',
    async (reply) => {
      quotaReply = reply;

      expect((await handler(postAs(name, body, `Bearer ${freshToken()}`))).status).toBe(503);
      expect(typesafeCalls()).toHaveLength(0);
    }
  );
});

describe('both proxies share one count per account', () => {
  it(`refuses the ${LIMIT + 1}st request whichever proxy it goes to`, async () => {
    vi.stubEnv('VITE_SUPABASE_URL', SUPABASE_URL);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-not-real');
    let count = 0;
    upstream.mockImplementation(async (url: string) => {
      if (url === QUOTA_URL) {
        count += 1;
        return new Response(JSON.stringify({ count, retry_after: 5 }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });
    const token = `Bearer ${freshToken()}`;

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
 * it belongs to: auth 20 ms, quota 30 ms, TypeSafe 40 ms.
 */
const STEP = String.raw`(auth|quota|ai|total);dur=\d+\.\d(;desc="cached")?`;
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
  let authReply: number | 'throw';
  let quotaCount: number;
  let typesafeStatus: number;

  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', SUPABASE_URL);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-not-real');
    authReply = 200;
    quotaCount = 1;
    typesafeStatus = 200;
    upstream.mockImplementation(async (url: string) => {
      if (url === AUTH_USER_URL) {
        await wait(20);
        if (authReply === 'throw') throw new TypeError('fetch failed');
        return new Response('{}', { status: authReply });
      }
      if (url === QUOTA_URL) {
        await wait(30);
        return new Response(JSON.stringify({ count: quotaCount, retry_after: 9 }), { status: 200 });
      }
      await wait(40);
      return new Response(JSON.stringify({ answers }), { status: typesafeStatus });
    });
  });

  const signedIn = (payload: unknown = body) => handler(postAs(name, payload, `Bearer ${freshToken()}`));

  it('a signed-in answer names auth, quota, ai and total, each timing its own step', async () => {
    const res = await signedIn();

    expect(res.status).toBe(200);
    const t = timingsOf(res);
    expect(Object.keys(t)).toEqual(['auth', 'quota', 'ai', 'total']);
    expect(t.auth.dur).toBeGreaterThanOrEqual(20 - SLACK_MS);
    expect(t.quota.dur).toBeGreaterThanOrEqual(30 - SLACK_MS);
    expect(t.ai.dur).toBeGreaterThanOrEqual(40 - SLACK_MS);
    // The steps run one after another, inside the whole.
    expect(t.total.dur).toBeGreaterThanOrEqual(t.auth.dur + t.quota.dur + t.ai.dur);
  });

  it('marks a remembered token as a cached auth step that took no time', async () => {
    const token = freshToken();
    await handler(postAs(name, body, `Bearer ${token}`));

    const t = timingsOf(await handler(postAs(name, body, `Bearer ${token}`)));

    expect(t.auth).toEqual({ dur: 0, desc: 'cached' });
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

  it('a token the auth server refuses names auth and total only', async () => {
    authReply = 401;

    const res = await signedIn();

    expect(res.status).toBe(401);
    expect(Object.keys(timingsOf(res))).toEqual(['auth', 'total']);
  });

  it('an auth server that cannot be reached is still timed', async () => {
    authReply = 'throw';

    const res = await signedIn();

    expect(res.status).toBe(503);
    const t = timingsOf(res);
    expect(Object.keys(t)).toEqual(['auth', 'total']);
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
