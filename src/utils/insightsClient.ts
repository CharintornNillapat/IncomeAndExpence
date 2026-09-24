import type { InsightsResponse, SpendingSummary } from '../types';
import { selectLocalPattern } from './spendingSummary';

/**
 * Browser client for the monthly-insights proxy (ADR 0020).
 *
 * THE CONTRACT THAT MATTERS, inherited verbatim from `jevClassifier`: nothing
 * here throws and nothing rejects. Every failure - 404, 5xx, timeout, offline,
 * malformed JSON, a blocked `localStorage` - resolves to a verdict chosen by
 * `selectLocalPattern` instead. `src/` still has no error boundary, and the
 * card must never render an error state, so a usable answer is always
 * returned.
 */

const INSIGHTS_ENDPOINT = '/api/insights';
const REQUEST_TIMEOUT_MS = 9000;

/**
 * Set once the endpoint proves absent, and never reset for the page session -
 * the same latch `jevClassifier` uses, for the same reason: the Vite dev
 * server does not serve `api/` at all, and an unconfigured deployment returns
 * 404 identically.
 */
let insightsUnavailable = false;

/** Exported for tests - lets a spec reset the module-level latch. */
export function __resetInsightsState(): void {
  insightsUnavailable = false;
}

export interface InsightVerdict {
  verdict: InsightsResponse;
  /** `false` when the local rule chose it - the card marks this quietly, never as an error. */
  fromModel: boolean;
}

function cacheKey(userId: string, month: string): string {
  return `pf_insights::${userId}::${month}`;
}

/**
 * Reads a cached verdict for this user and month.
 *
 * Wrapped because `localStorage` throws in a private window and with site data
 * blocked, and a cache miss must never be the reason the card fails.
 */
export function readCachedVerdict(userId: string, month: string): InsightVerdict | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId, month));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InsightVerdict;
    if (!parsed || typeof parsed !== 'object' || !parsed.verdict) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedVerdict(userId: string, month: string, value: InsightVerdict): void {
  try {
    localStorage.setItem(cacheKey(userId, month), JSON.stringify(value));
  } catch {
    // Quota, private mode, blocked site data. The verdict is still returned;
    // it simply costs another call next time.
  }
}

/**
 * Resolves a verdict for the month, preferring the cache.
 *
 * `forceRefresh` bypasses and overwrites it, which is what the card's Refresh
 * action does. One billing cycle otherwise costs one call per device - the
 * per-device trade-off ADR 0020 accepted in exchange for needing no migration.
 */
export async function fetchInsight(
  summary: SpendingSummary,
  userId: string,
  { forceRefresh = false }: { forceRefresh?: boolean } = {}
): Promise<InsightVerdict> {
  if (!forceRefresh) {
    const cached = readCachedVerdict(userId, summary.month);
    if (cached) return cached;
  }

  const local: InsightVerdict = { verdict: selectLocalPattern(summary), fromModel: false };

  // Latched off, or a summary with nothing in it the server would accept.
  if (insightsUnavailable || summary.categories.length === 0) return local;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return local;

  try {
    const res = await fetch(INSIGHTS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // The summary and nothing else. See `SpendingSummary` for what is
      // deliberately absent; a test asserts this body carries no ledger text.
      body: JSON.stringify({ summary }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (res.status === 404) {
      insightsUnavailable = true;
      return local;
    }

    if (!res.ok) return local;

    const data = (await res.json()) as InsightsResponse;
    if (typeof data !== 'object' || data === null || typeof data.pattern !== 'string') return local;

    const verdict: InsightsResponse = {
      pattern: data.pattern,
      focus: typeof data.focus === 'string' ? data.focus : null,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
    };

    const resolved: InsightVerdict = { verdict, fromModel: true };
    writeCachedVerdict(userId, summary.month, resolved);
    return resolved;
  } catch {
    // Timeout, offline, malformed JSON. Deliberately does NOT latch: a dropped
    // request should not disable the feature for a whole session.
    return local;
  }
}
