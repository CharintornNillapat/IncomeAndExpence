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
