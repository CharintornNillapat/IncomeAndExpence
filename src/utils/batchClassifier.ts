import {
  classifyOnce,
  toSuggestion,
  isClassifierWorthTrying,
  normalizeText,
  MIN_CLASSIFIABLE_LENGTH,
} from './jevClassifier';
import type { JevSuggestion } from './jevClassifier';
import type { Category, ClassifyCandidate } from '../types';

/*
 * Layer 2 of the CSV importer (ADR 0019).
 *
 * Reuses `classifyOnce` rather than adding a batch endpoint, which buys three
 * things for free and costs only round-trips:
 *
 *   - the module-level LRU cache, so a statement with forty `7-ELEVEN` lines
 *     costs ONE request rather than forty;
 *   - the 404 availability latch, so under the Vite dev server (which does not
 *     serve `api/` at all) the first row latches off and the rest make no
 *     request whatsoever;
 *   - `api/classify.ts` staying untouched, so ADR 0011's property that the
 *     server owns the Jev question wording is not re-opened.
 */

/**
 * Maximum requests in flight. This - not the retry below - is the real
 * rate-limit protection: the cheapest way not to be throttled is not to flood.
 */
const MAX_CONCURRENCY = 4;

/** Attempts per item, counting the first. Only a `rate-limited` outcome is retried. */
const MAX_ATTEMPTS = 2;

const BASE_BACKOFF_MS = 400;

/**
 * The longest `Retry-After` the importer waits out (ADR 0052): one window of
 * the per-account limit (ADR 0049), which never asks for more. A longer wait
 * comes from some other limit, and holding the preview open for it is worse
 * than finishing now with the rest left blank.
 */
const MAX_RETRY_AFTER_MS = 60_000;

export interface BatchClassifyItem {
  /** Caller's key, echoed back untouched. The importer passes `rowIndex`. */
  id: number;
  text: string;
}

export interface BatchClassifyProgress {
  done: number;
  total: number;
  /** While the run waits out a `Retry-After`, when it resumes (`Date.now()` time). */
  resumesAt?: number;
}

export interface BatchClassifyResult {
  /** Keyed by `BatchClassifyItem.id`. Items with no usable answer are absent, not null. */
  suggestions: Map<number, JevSuggestion>;
  /**
   * `true` when the run stopped early because the endpoint is absent or
   * latched off. The caller says "unavailable" rather than "nothing matched" -
   * two very different messages for the user.
   */
  unavailable: boolean;
  /** Requests actually issued. Far below `items.length` when the cache hits. */
  attempted: number;
  /**
   * `true` when a 429 asked for a wait longer than `MAX_RETRY_AFTER_MS` and
   * the run stopped there. Answers that arrived before it are still returned.
   */
  rateLimited: boolean;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

/**
 * Classifies many descriptions with a capped number of requests in flight.
 *
 * Never throws - `classifyOnce` does not, and neither does anything here. A
 * caller that cannot categorize a row simply commits it uncategorized, which
 * is exactly what the importer did before this existed.
 */
export async function classifyBatch(
  items: BatchClassifyItem[],
  categories: Category[],
  candidates: ClassifyCandidate[],
  options: {
    onProgress?: (progress: BatchClassifyProgress) => void;
    signal?: AbortSignal;
  } = {}
): Promise<BatchClassifyResult> {
  const { onProgress, signal } = options;
  const suggestions = new Map<number, JevSuggestion>();

  const total = items.length;
  let done = 0;
  let attempted = 0;
  let unavailable = false;
  let rateLimited = false;

  if (total === 0) return { suggestions, unavailable, attempted, rateLimited };

  /*
   * One pause for the whole run (ADR 0052). The limit behind a `Retry-After`
   * is per account, shared by every request this run makes, so a 429 on one
   * row means the next request from any worker would get one too. Every
   * worker waits until `resumesAt` before its next request, and the row that
   * was refused is retried after it.
   */
  let resumesAt = 0;
  let pauseReported = false;

  function report(): void {
    onProgress?.(Date.now() < resumesAt ? { done, total, resumesAt } : { done, total });
  }

  async function waitOutPause(): Promise<void> {
    while (!signal?.aborted && Date.now() < resumesAt) {
      await delay(resumesAt - Date.now(), signal);
    }
    if (pauseReported && Date.now() >= resumesAt) {
      pauseReported = false;
      report();
    }
  }

  /*
   * De-duplicate BEFORE dispatching, not by relying on the cache.
   *
   * The cache only fills when a response returns, so with N workers running
   * concurrently, N identical descriptions all miss it and all issue their own
   * request - a cache stampede. On the shape this feature exists for, a bank
   * statement with the same merchant forty times, that is forty requests for
   * one answer. A test caught this; the cache alone does not solve it.
   *
   * Grouping uses the classifier's own `normalizeText` so it collapses exactly
   * what the cache key would consider identical - no more, no less.
   */
  const groups = new Map<string, BatchClassifyItem[]>();
  for (const item of items) {
    const key = normalizeText(item.text);
    const existing = groups.get(key);
    if (existing) existing.push(item);
    else groups.set(key, [item]);
  }
  const distinct = Array.from(groups.values());

  // A shared cursor rather than pre-sliced chunks: workers that hit the cache
  // return almost instantly, and a fixed partition would leave them idle while
  // one slow chunk finished.
  let cursor = 0;

  async function runOne(item: BatchClassifyItem): Promise<void> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      await waitOutPause();
      if (signal?.aborted || unavailable || rateLimited) return;

      // One row's note being too short is that row's problem, not the run's
      // (ADR 0022). It must be checked before the run-wide test below, which
      // is also false for a short note - treating the two alike let a single
      // one-character description abandon every remaining row and report the
      // endpoint unavailable.
      if (normalizeText(item.text).length < MIN_CLASSIFIABLE_LENGTH) return;

      // Re-checked per item rather than once up front: the latch can trip
      // partway through the run, and every call after that is pointless.
      if (!isClassifierWorthTrying(item.text, candidates)) {
        unavailable = true;
        return;
      }

      attempted += 1;
      const outcome = await classifyOnce(item.text, candidates, signal);

      if (outcome.kind === 'ok') {
        const suggestion = toSuggestion(outcome.data, categories);
        // Fan the one answer out to every row that shares this description.
        if (suggestion) {
          for (const sibling of groups.get(normalizeText(item.text)) ?? [item]) {
            suggestions.set(sibling.id, suggestion);
          }
        }
        return;
      }

      if (outcome.kind === 'unavailable') {
        // Stop the whole run. Walking the remaining rows into a dead endpoint
        // wastes time and tells the user nothing new.
        unavailable = true;
        return;
      }

      if (outcome.kind === 'rate-limited') {
        if (outcome.retryAfterMs !== undefined) {
          if (outcome.retryAfterMs > MAX_RETRY_AFTER_MS) {
            // Stop the run: every other row would only be refused the same way.
            rateLimited = true;
            return;
          }
          // Never sooner than the old fixed backoff, so `Retry-After: 0` cannot
          // turn the retry into an immediate second hit.
          const until = Date.now() + Math.max(outcome.retryAfterMs, BASE_BACKOFF_MS * attempt);
          if (until > resumesAt) {
            resumesAt = until;
            pauseReported = true;
            report();
          }
          if (attempt < MAX_ATTEMPTS) continue;
          return;
        }
        // No `Retry-After` (the firewall's guest limit sends none): the
        // original per-row backoff, unchanged.
        if (attempt < MAX_ATTEMPTS) {
          await delay(BASE_BACKOFF_MS * attempt, signal);
          continue;
        }
      }

      // `no-answer`, `failed`, or a final rate-limit. The row stays
      // uncategorized, which is a valid outcome rather than an error.
      return;
    }
  }

  async function worker(): Promise<void> {
    for (;;) {
      if (signal?.aborted || unavailable || rateLimited) return;
      const index = cursor;
      cursor += 1;
      if (index >= distinct.length) return;

      const group = distinct[index];
      await runOne(group[0]);

      // Progress counts rows, not requests - "Classifying 24 of 50" should
      // track what the user can see in the table, and a deduplicated group
      // resolves all of its rows at once.
      done += group.length;
      report();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENCY, distinct.length) }, () => worker())
  );

  return { suggestions, unavailable, attempted, rateLimited };
}
