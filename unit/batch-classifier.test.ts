import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { classifyBatch } from '../src/utils/batchClassifier';
import type { BatchClassifyItem, BatchClassifyProgress } from '../src/utils/batchClassifier';
import { __resetClassifierState, classifyOnce, toClassifyCandidates } from '../src/utils/jevClassifier';
import type { Category, ClassifyResponse } from '../src/types';

/**
 * Phase 47's coverage gap (ADR 0021).
 *
 * `tests/csv-classify.spec.ts` drives this through the import preview and
 * asserts the final request count, which is enough to catch a cache stampede
 * and nothing else. The retry, the backoff duration, the concurrency ceiling
 * and the two different ways a run can stop early all need a fabricated
 * network condition and a controllable clock, which a browser spec cannot
 * provide without becoming a mock framework in its own right.
 *
 * Node environment. `fetch` is stubbed outright, so nothing here can reach
 * `/api/classify` even by accident — the same property `CLAUDE.md`'s mocking
 * rule protects for the Playwright suite.
 */

/** Mirrors `MAX_CONCURRENCY` in `batchClassifier.ts`, which is module-private. */
const MAX_CONCURRENCY = 4;
/** Mirrors `BASE_BACKOFF_MS`. */
const BASE_BACKOFF_MS = 400;

const CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Food & Dining', type: 'EXPENSE', icon: 'x', color: 'c', isSystem: true, isDeleted: false },
  { id: 'cat-transport', name: 'Transport', type: 'EXPENSE', icon: 'x', color: 'c', isSystem: true, isDeleted: false },
];

const CANDIDATES = toClassifyCandidates(CATEGORIES);

const GOOD_ANSWER: ClassifyResponse = {
  categoryId: 'cat-food',
  categoryConfidence: 0.95,
  detectedType: 'EXPENSE',
  typeConfidence: 0.95,
};

/** A `Response`-shaped stand-in carrying only what `classifyOnce` reads. */
function reply(status: number, body: unknown = GOOD_ANSWER, headers: Record<string, string> = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(headers),
    json: async () => body,
  } as unknown as Response;
}

/** A 429 from the per-account limit (ADR 0049), which names its wait. */
function limited(retryAfter: string) {
  return reply(429, {}, { 'Retry-After': retryAfter });
}

/**
 * A 429 from the guest firewall (ADR 0046), with the headers production sent
 * on 2026-10-04 (ADR 0053): `X-Vercel-Mitigated: deny` and no `Retry-After`.
 */
function firewallDenied(mitigated = 'deny') {
  return reply(429, { error: { code: '429', message: 'Too Many Requests' } }, { 'X-Vercel-Mitigated': mitigated });
}

function rows(count: number, text: (i: number) => string): BatchClassifyItem[] {
  return Array.from({ length: count }, (_, i) => ({ id: i, text: text(i) }));
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // The LRU cache and the 404 availability latch are module-level, so a test
  // that latched off would silently disarm every test after it.
  __resetClassifierState();
  fetchMock = vi.fn(async () => reply(200));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('classifyBatch — concurrency', () => {
  it('never exceeds four requests in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    fetchMock.mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      // Resolving on a timer rather than immediately guarantees the workers
      // genuinely overlap; an instantly-resolved promise could serialise.
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;
      return reply(200);
    });

    const result = await classifyBatch(rows(12, (i) => `merchant ${i}`), CATEGORIES, CANDIDATES);

    expect(peak).toBe(MAX_CONCURRENCY);
    expect(fetchMock).toHaveBeenCalledTimes(12);
    expect(result.attempted).toBe(12);
    expect(result.suggestions.size).toBe(12);
  });

  it('does not spin up more workers than there is work', async () => {
    let peak = 0;
    let inFlight = 0;
    fetchMock.mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;
      return reply(200);
    });

    await classifyBatch(rows(2, (i) => `merchant ${i}`), CATEGORIES, CANDIDATES);

    expect(peak).toBe(2);
  });

  it('makes no request at all for an empty batch', async () => {
    const result = await classifyBatch([], CATEGORIES, CANDIDATES);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ suggestions: new Map(), unavailable: false, attempted: 0, rateLimited: false });
  });
});

describe('classifyBatch — de-duplication before dispatch', () => {
  /*
   * The property that made this module necessary. The classifier's LRU cache
   * only fills when a response returns, so N concurrent workers on identical
   * text all miss it and all dispatch. On the shape this feature exists for —
   * a bank statement with the same merchant forty times — that is forty
   * requests for one answer.
   */
  it('turns forty identical rows into one request', async () => {
    const result = await classifyBatch(rows(40, () => '7-ELEVEN'), CATEGORIES, CANDIDATES);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.attempted).toBe(1);
    // ...and the one answer reaches every row.
    expect(result.suggestions.size).toBe(40);
    expect(result.suggestions.get(0)?.categoryId).toBe('cat-food');
    expect(result.suggestions.get(39)?.categoryId).toBe('cat-food');
  });

  it('groups by the classifier\'s own normalizeText, so casing and spacing collapse', async () => {
    const result = await classifyBatch(
      [
        { id: 0, text: '7-ELEVEN' },
        { id: 1, text: '  7-eleven  ' },
        { id: 2, text: '7-Eleven' },
        { id: 3, text: '7-eleven   sukhumvit' },
      ],
      CATEGORIES,
      CANDIDATES
    );

    // Three spellings of one merchant, plus a genuinely different string.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.suggestions.size).toBe(4);
  });

  it('counts progress in rows, not requests', async () => {
    const progress: BatchClassifyProgress[] = [];

    await classifyBatch(rows(40, () => '7-ELEVEN'), CATEGORIES, CANDIDATES, {
      onProgress: (p) => progress.push({ ...p }),
    });

    // One group resolves all forty of its rows at once, so the bar jumps
    // rather than creeping — "Classifying 40 of 40" tracks what the user can
    // see in the table, not what was sent.
    expect(progress).toEqual([{ done: 40, total: 40 }]);
  });

  it('reports progress against the row count across mixed groups', async () => {
    const progress: BatchClassifyProgress[] = [];
    const items: BatchClassifyItem[] = [
      ...rows(3, () => 'coffee').map((r, i) => ({ ...r, id: i })),
      { id: 3, text: 'taxi' },
    ];

    await classifyBatch(items, CATEGORIES, CANDIDATES, {
      onProgress: (p) => progress.push({ ...p }),
    });

    expect(progress).toHaveLength(2);
    expect(progress.map((p) => p.total)).toEqual([4, 4]);
    expect(progress[progress.length - 1].done).toBe(4);
  });
});

describe('classifyBatch — rate limiting and backoff', () => {
  it('retries a 429 exactly once, then gives up on the row', async () => {
    fetchMock.mockImplementation(async () => reply(429));

    const result = await classifyBatch([{ id: 0, text: 'coffee' }], CATEGORIES, CANDIDATES);

    // MAX_ATTEMPTS is 2, counting the first.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.attempted).toBe(2);
    // An unclassified row is a valid outcome, not an error: it commits
    // uncategorized, exactly as it did before this module existed.
    expect(result.suggestions.size).toBe(0);
    expect(result.unavailable).toBe(false);
  });

  it('waits exactly 400 ms before the retry', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => reply(429));

    const run = classifyBatch([{ id: 0, text: 'coffee' }], CATEGORIES, CANDIDATES);

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(BASE_BACKOFF_MS - 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    /*
     * NOTE. The backoff is `BASE_BACKOFF_MS * attempt` — LINEAR, not
     * exponential, and with MAX_ATTEMPTS at 2 there is exactly one wait, so
     * the two are indistinguishable from outside. This test pins what ships
     * (one wait, 400 ms) rather than what a growth curve would imply. See
     * ADR 0021: raising MAX_ATTEMPTS is a behaviour change to the rate-limit
     * path and belongs to a phase that decides it deliberately.
     */
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await run;
  });

  it('accepts an answer that arrives on the retry', async () => {
    fetchMock
      .mockImplementationOnce(async () => reply(429))
      .mockImplementationOnce(async () => reply(200));

    const result = await classifyBatch([{ id: 0, text: 'coffee' }], CATEGORIES, CANDIDATES);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.attempted).toBe(2);
    expect(result.suggestions.get(0)).toEqual(
      expect.objectContaining({ categoryId: 'cat-food', strength: 'AUTO_FILL' })
    );
    expect(result.unavailable).toBe(false);
  });
});

describe('classifyBatch — stopping early', () => {
  it('abandons the whole run on a 404 rather than walking rows into a dead endpoint', async () => {
    fetchMock.mockImplementation(async () => reply(404, null));

    const result = await classifyBatch(rows(40, (i) => `merchant ${i}`), CATEGORIES, CANDIDATES);

    expect(result.unavailable).toBe(true);
    expect(result.suggestions.size).toBe(0);
    // Only the requests already in flight when the latch tripped. Nowhere
    // near forty, which is the entire point.
    expect(result.attempted).toBeLessThanOrEqual(MAX_CONCURRENCY);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(MAX_CONCURRENCY);
  });

  it('keeps the latch set, so a second batch makes no request at all', async () => {
    fetchMock.mockImplementation(async () => reply(404, null));
    await classifyBatch(rows(4, (i) => `merchant ${i}`), CATEGORIES, CANDIDATES);

    fetchMock.mockClear();
    const second = await classifyBatch(rows(4, (i) => `other ${i}`), CATEGORIES, CANDIDATES);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(second.unavailable).toBe(true);
    expect(second.attempted).toBe(0);
  });

  it('does NOT abandon the run on a 5xx — those rows just stay uncategorized', async () => {
    fetchMock.mockImplementation(async () => reply(500));

    const result = await classifyBatch(rows(6, (i) => `merchant ${i}`), CATEGORIES, CANDIDATES);

    // The distinction that matters: `unavailable` means "stop asking",
    // `failed` means "this row did not work out".
    expect(result.unavailable).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(result.suggestions.size).toBe(0);
  });

  it('makes no request when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await classifyBatch(rows(10, (i) => `merchant ${i}`), CATEGORIES, CANDIDATES, {
      signal: controller.signal,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.attempted).toBe(0);
  });

  it('stops picking up new rows once the signal aborts mid-flight', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(async () => {
      controller.abort();
      return reply(200);
    });

    const result = await classifyBatch(rows(40, (i) => `merchant ${i}`), CATEGORIES, CANDIDATES, {
      signal: controller.signal,
    });

    // The four already dispatched may finish; nothing after them starts.
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(MAX_CONCURRENCY);
    expect(result.attempted).toBeLessThanOrEqual(MAX_CONCURRENCY);
  });

  it('reports unavailable when there are no candidate categories to choose from', async () => {
    const result = await classifyBatch(rows(5, (i) => `merchant ${i}`), CATEGORIES, []);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.unavailable).toBe(true);
  });

  it('skips a too-short note instead of abandoning the whole run (ADR 0022)', async () => {
    /*
     * `isClassifierWorthTrying` is false both for run-wide conditions (the
     * latch, offline, no candidates) and for one row's note being under
     * `MIN_CLASSIFIABLE_LENGTH`. Treating the second like the first let a
     * single 1-character description stop every remaining row and report
     * "Jev is unavailable" for an endpoint that was fine.
     */
    const items: BatchClassifyItem[] = [
      { id: 0, text: 'x' },
      ...rows(5, (i) => `merchant ${i}`).map((row) => ({ ...row, id: row.id + 1 })),
    ];

    const result = await classifyBatch(items, CATEGORIES, CANDIDATES);

    expect(result.unavailable).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(result.suggestions.has(0)).toBe(false);
    expect(result.suggestions.size).toBe(5);
  });
});

describe('classifyBatch — what counts as a usable answer', () => {
  it('drops an answer below the suggest confidence gate', async () => {
    fetchMock.mockImplementation(async () =>
      reply(200, { ...GOOD_ANSWER, categoryConfidence: 0.4, typeConfidence: 0.4 })
    );

    const result = await classifyBatch([{ id: 0, text: 'coffee' }], CATEGORIES, CANDIDATES);

    expect(result.suggestions.size).toBe(0);
    // A request was still spent, which is why the confidence gate lives after
    // the call and not before it.
    expect(result.attempted).toBe(1);
  });

  it('drops an "other" verdict rather than inventing a category', async () => {
    fetchMock.mockImplementation(async () => reply(200, { ...GOOD_ANSWER, categoryId: null }));

    const result = await classifyBatch([{ id: 0, text: 'coffee' }], CATEGORIES, CANDIDATES);

    expect(result.suggestions.size).toBe(0);
    expect(result.unavailable).toBe(false);
  });

  it('demotes to SUGGEST when the model\'s detected type disagrees with the category', async () => {
    fetchMock.mockImplementation(async () => reply(200, { ...GOOD_ANSWER, detectedType: 'INCOME' }));

    const result = await classifyBatch([{ id: 0, text: 'salary' }], CATEGORIES, CANDIDATES);

    // Disagreement is itself evidence of ambiguity, so confidence alone does
    // not earn an auto-fill.
    expect(result.suggestions.get(0)?.strength).toBe('SUGGEST');
  });

  it('serves a repeated description from the cache across two separate batches', async () => {
    await classifyBatch([{ id: 0, text: 'coffee' }], CATEGORIES, CANDIDATES);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockClear();
    const second = await classifyBatch([{ id: 7, text: 'COFFEE' }], CATEGORIES, CANDIDATES);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(second.attempted).toBe(1);
    expect(second.suggestions.get(7)?.categoryId).toBe('cat-food');
  });
});

/**
 * ADR 0052: a 429 that names its wait. The per-account limit (ADR 0049)
 * answers with `Retry-After`; before this the importer ignored it, retried
 * each row once after 400 ms and gave up, so a signed-in import of more than
 * 120 distinct notes in a minute left the rest blank.
 */
describe('classifyOnce - reading Retry-After', () => {
  it('reads delay-seconds', async () => {
    fetchMock.mockImplementation(async () => limited('30'));
    expect(await classifyOnce('coffee', CANDIDATES)).toEqual({ kind: 'rate-limited', retryAfterMs: 30_000 });
  });

  it('reads an HTTP date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T01:00:00Z'));
    fetchMock.mockImplementation(async () => limited('Sun, 04 Oct 2026 01:00:05 GMT'));
    expect(await classifyOnce('coffee', CANDIDATES)).toEqual({ kind: 'rate-limited', retryAfterMs: 5_000 });
  });

  it.each([
    ['no header', {}],
    ['a word', { 'Retry-After': 'soon' }],
    ['a negative number', { 'Retry-After': '-5' }],
    ['a date already past', { 'Retry-After': 'Thu, 01 Jan 1970 00:00:00 GMT' }],
  ])('leaves the wait out for %s, so the caller keeps its own backoff', async (_label, headers) => {
    fetchMock.mockImplementation(async () => reply(429, {}, headers as Record<string, string>));
    expect(await classifyOnce('coffee', CANDIDATES)).toEqual({ kind: 'rate-limited' });
  });
});

describe('classifyBatch - waiting out Retry-After', () => {
  it('waits the Retry-After, not 400 ms, before the retry', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(async () => limited('5')).mockImplementation(async () => reply(200));

    const run = classifyBatch([{ id: 0, text: 'coffee' }], CATEGORIES, CANDIDATES);

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const result = await run;
    expect(result.suggestions.get(0)?.categoryId).toBe('cat-food');
    expect(result.rateLimited).toBe(false);
  });

  it('never retries sooner than 400 ms, even on Retry-After: 0', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(async () => limited('0')).mockImplementation(async () => reply(200));

    const run = classifyBatch([{ id: 0, text: 'coffee' }], CATEGORIES, CANDIDATES);

    await vi.advanceTimersByTimeAsync(BASE_BACKOFF_MS - 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await run;
  });

  it('holds every worker, not just the refused row, until the window turns over', async () => {
    vi.useFakeTimers();
    let calls = 0;
    fetchMock.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) return limited('3');
      await new Promise((resolve) => setTimeout(resolve, 10));
      return reply(200);
    });

    const run = classifyBatch(rows(8, (i) => `merchant number ${i}`), CATEGORIES, CANDIDATES);

    // The first four go out together; one is refused, three answer at 10 ms.
    await vi.advanceTimersByTimeAsync(10);
    expect(fetchMock).toHaveBeenCalledTimes(MAX_CONCURRENCY);
    // Without the shared pause, those three workers would have taken the next
    // rows at once and been refused by the same exhausted window.
    await vi.advanceTimersByTimeAsync(2_989);
    expect(fetchMock).toHaveBeenCalledTimes(MAX_CONCURRENCY);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(MAX_CONCURRENCY);

    await vi.advanceTimersByTimeAsync(100);
    const result = await run;
    expect(result.suggestions.size).toBe(8);
    expect(fetchMock).toHaveBeenCalledTimes(9);
  });

  it('reports when the run will resume, and reports again once it has', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T01:00:00Z'));
    const start = Date.now();
    fetchMock.mockImplementationOnce(async () => limited('7')).mockImplementation(async () => reply(200));
    const seen: BatchClassifyProgress[] = [];

    const run = classifyBatch([{ id: 0, text: 'coffee' }], CATEGORIES, CANDIDATES, {
      onProgress: (p) => seen.push({ ...p }),
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toEqual([{ done: 0, total: 1, resumesAt: start + 7_000 }]);

    await vi.advanceTimersByTimeAsync(7_000);
    await run;
    expect(seen).toEqual([
      { done: 0, total: 1, resumesAt: start + 7_000 },
      { done: 0, total: 1 },
      { done: 1, total: 1 },
    ]);
  });

  it('stops the run when the wait asked for is over a minute, keeping the answers it has', async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const { text } = JSON.parse(init.body as string) as { text: string };
      if (text === 'blocked note') return limited('120');
      await new Promise((resolve) => setTimeout(resolve, 10));
      return reply(200);
    });

    const result = await classifyBatch(
      ['blocked note', 'aaa note', 'bbb note', 'ccc note', 'ddd note', 'eee note'].map((text, id) => ({ id, text })),
      CATEGORIES,
      CANDIDATES
    );

    expect(result.rateLimited).toBe(true);
    expect(result.unavailable).toBe(false);
    // The three already in flight finish; nothing new goes out.
    expect(fetchMock).toHaveBeenCalledTimes(MAX_CONCURRENCY);
    expect(Array.from(result.suggestions.keys()).sort()).toEqual([1, 2, 3]);
  });

  it('accepts exactly one minute, the per-account window', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(async () => limited('60')).mockImplementation(async () => reply(200));

    const run = classifyBatch([{ id: 0, text: 'coffee' }], CATEGORIES, CANDIDATES);
    await vi.advanceTimersByTimeAsync(60_000);
    const result = await run;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.rateLimited).toBe(false);
  });

  it('gives a row up if its retry is refused too, without stopping the run', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => limited('2'));

    const run = classifyBatch([{ id: 0, text: 'coffee' }], CATEGORIES, CANDIDATES);
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await run;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.suggestions.size).toBe(0);
    expect(result.rateLimited).toBe(false);
  });

  it('ends promptly when cancelled during the wait, with no further request', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => limited('30'));
    const controller = new AbortController();

    const run = classifyBatch([{ id: 0, text: 'coffee' }], CATEGORIES, CANDIDATES, { signal: controller.signal });
    await vi.advanceTimersByTimeAsync(1_000);
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    await run;

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('classifyOnce - naming the firewall\'s 429 (ADR 0053)', () => {
  it('marks a 429 with X-Vercel-Mitigated: deny and no Retry-After as the firewall\'s', async () => {
    fetchMock.mockImplementation(async () => firewallDenied());
    expect(await classifyOnce('coffee', CANDIDATES)).toEqual({ kind: 'rate-limited', firewall: true });
  });

  it('reads the mark whatever its case', async () => {
    fetchMock.mockImplementation(async () => firewallDenied(' DENY '));
    expect(await classifyOnce('coffee', CANDIDATES)).toEqual({ kind: 'rate-limited', firewall: true });
  });

  it('prefers a Retry-After when both are present', async () => {
    fetchMock.mockImplementation(async () => reply(429, {}, { 'X-Vercel-Mitigated': 'deny', 'Retry-After': '9' }));
    expect(await classifyOnce('coffee', CANDIDATES)).toEqual({ kind: 'rate-limited', retryAfterMs: 9_000 });
  });

  it('does not read another mitigation (a challenge) as the guest limit', async () => {
    fetchMock.mockImplementation(async () => firewallDenied('challenge'));
    expect(await classifyOnce('coffee', CANDIDATES)).toEqual({ kind: 'rate-limited' });
  });
});

describe('classifyBatch - waiting out the guest firewall (ADR 0053)', () => {
  /**
   * Every request answers after `ms`; the calls numbered in `denied` (from 1)
   * get the firewall's 429. Returns each call's send time, from now.
   */
  function slowReplies(ms: number, denied: number[]): number[] {
    const start = Date.now();
    const sent: number[] = [];
    fetchMock.mockImplementation(async () => {
      sent.push(Date.now() - start);
      const n = sent.length;
      await new Promise((resolve) => setTimeout(resolve, ms));
      return denied.includes(n) ? firewallDenied() : reply(200);
    });
    return sent;
  }

  it('waits until the window that began with the run\'s first request is over, plus a second', async () => {
    vi.useFakeTimers();
    const start = Date.now();
    // Four at a time, a second each: calls 9 to 12 go out at 2 s, and call 10
    // is refused at 3 s.
    slowReplies(1_000, [10]);
    const seen: BatchClassifyProgress[] = [];

    const run = classifyBatch(rows(12, (i) => `merchant number ${i}`), CATEGORIES, CANDIDATES, {
      onProgress: (p) => seen.push({ ...p }),
    });

    await vi.advanceTimersByTimeAsync(3_000);
    expect(fetchMock).toHaveBeenCalledTimes(12);
    expect(seen.find((p) => p.resumesAt !== undefined)?.resumesAt).toBe(start + 61_000);

    await vi.advanceTimersByTimeAsync(57_999);
    expect(fetchMock).toHaveBeenCalledTimes(12);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(13);

    await vi.advanceTimersByTimeAsync(1_000);
    const result = await run;
    expect(result.suggestions.size).toBe(12);
    expect(result.rateLimited).toBe(false);
  });

  it('waits one whole window when the run\'s very first request is refused', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(async () => firewallDenied()).mockImplementation(async () => reply(200));

    const run = classifyBatch([{ id: 0, text: 'coffee' }], CATEGORIES, CANDIDATES);

    await vi.advanceTimersByTimeAsync(59_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await run).suggestions.get(0)?.categoryId).toBe('cat-food');
  });

  it('waits one whole window when its own estimate has already run out', async () => {
    vi.useFakeTimers();
    // Refused 60.8 s after the run's first request: by the run's own count the
    // window is over, so something else was counted too, and its start is
    // unknown.
    fetchMock
      .mockImplementationOnce(async () => {
        await new Promise((resolve) => setTimeout(resolve, 60_800));
        return firewallDenied();
      })
      .mockImplementation(async () => reply(200));

    const run = classifyBatch([{ id: 0, text: 'coffee' }], CATEGORIES, CANDIDATES);

    await vi.advanceTimersByTimeAsync(60_800 + 59_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await run;
  });

  it('starts a new window with the first request after the pause', async () => {
    vi.useFakeTimers();
    // Call 10 is refused at 3 s, so the run resumes at 61 s, and that request
    // starts a new window. Call 21 is sent after it and refused inside it: the
    // run resumes 61 s after 61 s. Measured from the run's first request
    // instead, the estimate would be over and the wait a whole minute from
    // the refusal, which is later.
    const sent = slowReplies(1_000, [10, 21]);

    const run = classifyBatch(rows(24, (i) => `merchant number ${i}`), CATEGORIES, CANDIDATES);
    await vi.advanceTimersByTimeAsync(130_000);
    expect((await run).suggestions.size).toBe(24);

    expect(sent.find((t) => t > 3_000)).toBe(61_000);
    expect(sent[20]).toBeGreaterThanOrEqual(61_000);
    const refused = sent[20] + 1_000;
    expect(sent.find((t) => t > refused)).toBe(61_000 + 61_000);
  });

  it('keeps the 400 ms retry for a 429 that is neither the firewall\'s nor names a wait', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(async () => reply(429, {})).mockImplementation(async () => reply(200));

    const run = classifyBatch([{ id: 0, text: 'coffee' }], CATEGORIES, CANDIDATES);

    await vi.advanceTimersByTimeAsync(BASE_BACKOFF_MS - 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await run;
  });
});
