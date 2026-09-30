import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ClassifyCandidate, SpendingSummary } from '../src/types';

/**
 * The client side of the proxies' caller check (ADR 0032).
 *
 * Signed in, `/api/classify` and `/api/insights` get the access token; a guest
 * sends no header at all, because "no header" is what the proxy and the
 * firewall read as a guest. A refused token (401) stops a batch without
 * latching the classifier off for the session.
 *
 * `isSupabaseConfigured` is read once, when `src/lib/supabase` loads, and a
 * local `.env` sets it while CI has none. So every test stubs the environment
 * and imports the modules afresh, which makes the result the same on a laptop
 * and on CI. The real client is used; only `auth.getSession` is replaced.
 */

const CANDIDATES: ClassifyCandidate[] = [{ id: 'cat-food', name: 'Food & Dining' }];

const SUMMARY: SpendingSummary = {
  month: '2026-09',
  categories: [{ name: 'Food & Dining', current: 4200, previous: 4000, changePercent: 5, txCount: 30 }],
  totals: { income: 30000, expense: 4200, net: 25800, previousExpense: 4000 },
};

const ANSWER = { categoryId: 'cat-food', categoryConfidence: 0.9, detectedType: 'EXPENSE', typeConfidence: 1 };

let fetchStub: ReturnType<typeof vi.fn>;

function replyWith(status: number, body: unknown = {}) {
  fetchStub.mockImplementation(async () => new Response(JSON.stringify(body), { status }));
}

/** Loads the modules under a configured or unconfigured environment, with a given session. */
async function load(options: { configured: boolean; token?: string | null; sessionThrows?: boolean }) {
  vi.stubEnv('VITE_SUPABASE_URL', options.configured ? 'https://project.supabase.test' : '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', options.configured ? 'anon-key-not-real' : '');
  vi.resetModules();

  const lib = await import('../src/lib/supabase');
  const getSession = vi.spyOn(lib.supabase.auth, 'getSession');
  if (options.sessionThrows) {
    getSession.mockRejectedValue(new Error('storage blocked'));
  } else {
    const session = options.token ? { access_token: options.token } : null;
    getSession.mockResolvedValue({ data: { session }, error: null } as never);
  }

  const classifier = await import('../src/utils/jevClassifier');
  const insights = await import('../src/utils/insightsClient');
  return { lib, getSession, classifier, insights };
}

function sentHeaders(call = 0): Record<string, string> {
  return fetchStub.mock.calls[call][1].headers as Record<string, string>;
}

beforeEach(() => {
  fetchStub = vi.fn();
  vi.stubGlobal('fetch', fetchStub);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('authorizationHeader', () => {
  it('is the bearer token while signed in', async () => {
    const { lib } = await load({ configured: true, token: 'access-abc' });
    expect(await lib.authorizationHeader()).toEqual({ Authorization: 'Bearer access-abc' });
  });

  it('is empty for a guest', async () => {
    const { lib } = await load({ configured: true, token: null });
    expect(await lib.authorizationHeader()).toEqual({});
  });

  it('is empty without Supabase settings, and does not read the session', async () => {
    const { lib, getSession } = await load({ configured: false, token: 'access-abc' });
    expect(await lib.authorizationHeader()).toEqual({});
    expect(getSession).not.toHaveBeenCalled();
  });

  it('is empty, not a rejection, when the session cannot be read', async () => {
    const { lib } = await load({ configured: true, sessionThrows: true });
    await expect(lib.authorizationHeader()).resolves.toEqual({});
  });
});

describe('classifyOnce', () => {
  it('sends the access token while signed in', async () => {
    const { classifier } = await load({ configured: true, token: 'access-abc' });
    replyWith(200, ANSWER);

    const outcome = await classifier.classifyOnce('lunch at the food court', CANDIDATES);

    expect(outcome.kind).toBe('ok');
    expect(sentHeaders().Authorization).toBe('Bearer access-abc');
  });

  it('sends no Authorization header at all for a guest', async () => {
    const { classifier } = await load({ configured: true, token: null });
    replyWith(200, ANSWER);

    await classifier.classifyOnce('lunch at the food court', CANDIDATES);

    expect(sentHeaders()).not.toHaveProperty('Authorization');
  });

  it('reads a refused sign-in as unavailable, without latching the session off', async () => {
    const { classifier } = await load({ configured: true, token: 'expired' });
    replyWith(401);

    expect((await classifier.classifyOnce('first note', CANDIDATES)).kind).toBe('unavailable');
    expect(classifier.isClassifierWorthTrying('second note', CANDIDATES)).toBe(true);

    replyWith(200, ANSWER);
    expect((await classifier.classifyOnce('second note', CANDIDATES)).kind).toBe('ok');
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it('still latches off on a 404, unlike a 401', async () => {
    const { classifier } = await load({ configured: true, token: null });
    replyWith(404);

    expect((await classifier.classifyOnce('first note', CANDIDATES)).kind).toBe('unavailable');
    expect(classifier.isClassifierWorthTrying('second note', CANDIDATES)).toBe(false);
  });
});

describe('fetchInsight', () => {
  it('sends the access token while signed in', async () => {
    const { insights } = await load({ configured: true, token: 'access-abc' });
    replyWith(200, { pattern: 'STEADY', focus: null, confidence: 0.8 });

    const result = await insights.fetchInsight(SUMMARY, 'user-1');

    expect(result.fromModel).toBe(true);
    expect(sentHeaders().Authorization).toBe('Bearer access-abc');
  });

  it('sends no Authorization header at all for a guest', async () => {
    const { insights } = await load({ configured: true, token: null });
    replyWith(200, { pattern: 'STEADY', focus: null, confidence: 0.8 });

    await insights.fetchInsight(SUMMARY, 'guest');

    expect(sentHeaders()).not.toHaveProperty('Authorization');
  });

  it('falls back to the local verdict on a refused sign-in, and asks again next time', async () => {
    const { insights } = await load({ configured: true, token: 'expired' });
    replyWith(401);

    expect((await insights.fetchInsight(SUMMARY, 'user-1')).fromModel).toBe(false);
    await insights.fetchInsight(SUMMARY, 'user-1');

    expect(fetchStub).toHaveBeenCalledTimes(2);
  });
});
