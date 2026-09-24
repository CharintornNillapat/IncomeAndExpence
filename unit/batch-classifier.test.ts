import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { classifyBatch } from '../src/utils/batchClassifier';
import type { BatchClassifyItem, BatchClassifyProgress } from '../src/utils/batchClassifier';
import { __resetClassifierState, toClassifyCandidates } from '../src/utils/jevClassifier';
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
function reply(status: number, body: unknown = GOOD_ANSWER) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as unknown as Response;
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
    expect(result).toEqual({ suggestions: new Map(), unavailable: false, attempted: 0 });
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
