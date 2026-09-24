import type { ClassifyCandidate, ClassifyResponse, Category, TransactionType } from '../types';

/**
 * Browser client for the Jev classification proxy at `/api/classify`.
 *
 * Layering (ADR 0011): this is only ever consulted when `matchSmartDescription`
 * finds no keyword rule. A rule hit short-circuits before reaching this module,
 * so habitual descriptions cost nothing.
 *
 * THE CONTRACT THAT MATTERS: `classifyDescription` never throws and never
 * rejects. Every failure - 404, 5xx, timeout, abort, malformed JSON, offline -
 * resolves to `null`, which the UI renders as "no suggestion", which is exactly
 * the behavior shipped before this feature existed. `src/` has no error
 * boundary (zero `componentDidCatch`), so a thrown fetch would white-screen the
 * app. Nothing in here is allowed to escape.
 *
 * Deliberately uses plain `fetch` rather than `@typesafe-ai/sdk`: the SDK is a
 * 209 kB Node package, and adding any dependency here would mean touching
 * `vite.config.ts`'s `manualChunks` and risking the `vendor-math` deferral that
 * ADR 0010 bought.
 */

const CLASSIFY_ENDPOINT = '/api/classify';
const REQUEST_TIMEOUT_MS = 6000;
const CACHE_CAPACITY = 50;

/** Minimum characters before a call is worth making. "7-11" is 4; Thai notes are longer. */
export const MIN_CLASSIFIABLE_LENGTH = 2;

/**
 * Confidence gates. Tuned against measured probes (see ADR 0011): clean notes
 * returned 0.98-1.00, while a genuinely ambiguous Thai note returned 0.33 with
 * probability spread across three options. Kept here, in one place, because the
 * TypeSafe docs are explicit that thresholds must be validated against your own
 * data rather than inherited from a cookbook.
 */
export const CONFIDENCE = {
  /** At or above this, fill the fields outright. */
  AUTO_FILL: 0.85,
  /** At or above this (but below AUTO_FILL), offer a chip the user must tap. */
  SUGGEST: 0.5,
} as const;

export type SuggestionStrength = 'AUTO_FILL' | 'SUGGEST';

export interface JevSuggestion {
  categoryId: string;
  categoryName: string;
  /** Derived from the chosen category, matching what the keyword matcher does. */
  type: TransactionType;
  confidence: number;
  strength: SuggestionStrength;
}

/**
 * Set once the endpoint proves absent or broken, and never reset for the page
 * session. This is what keeps `npm run dev` (the Vite dev server does not serve
 * `api/`) and the Playwright suite to a single failed fetch rather than one per
 * keystroke.
 */
let classifierUnavailable = false;

/** Exported for tests only - lets a spec reset the module-level latch and cache. */
export function __resetClassifierState(): void {
  classifierUnavailable = false;
  cache.clear();
}

/**
 * Insertion-ordered LRU. A `Map` preserves insertion order, so the oldest key
 * is simply the first one `keys()` yields; re-setting a key on read moves it to
 * the end. Module-scoped on purpose: `QuickAddModal` mounts once and never
 * unmounts (ADR 0010's `hasOpened` latch), and all three `TransactionForm`
 * consumers share this, so correcting or re-typing a note is free.
 */
const cache = new Map<string, ClassifyResponse | null>();

function cacheGet(key: string): ClassifyResponse | null | undefined {
  if (!cache.has(key)) return undefined;
  const value = cache.get(key);
  cache.delete(key);
  cache.set(key, value as ClassifyResponse | null);
  return value;
}

function cacheSet(key: string, value: ClassifyResponse | null): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > CACHE_CAPACITY) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * The candidate set is part of the cache identity: the same note against a
 * different category list is a genuinely different question, and ids alone are
 * not enough because renaming a category changes a signal Jev receives.
 *
 * The description is in the key for the same reason (ADR 0012) - editing one is
 * precisely how a user says "classify this differently", so a cached answer
 * keyed on the old text would hide the improvement they just made.
 */
function cacheKey(text: string, candidates: ClassifyCandidate[]): string {
  const shape = candidates.map((c) => `${c.id}:${c.name}:${c.description ?? ''}`).join('|');
  return `${normalizeText(text)}##${shape}`;
}

/**
 * Active EXPENSE and INCOME categories only.
 *
 * ADJUSTMENT and DEBT_REPAYMENT are excluded on purpose - a balance
 * reconciliation is not something a model should ever propose from a typed
 * note, and the form's own submit path resolves the debt category itself
 * (`TransactionForm.tsx:227`). Soft-deleted categories are excluded because
 * suggesting one would write a dead id into a new transaction.
 *
 * A blank description is omitted from the candidate entirely rather than sent
 * as `''` - the proxy would otherwise have to distinguish "no description" from
 * "empty description" to avoid emitting a trailing `": "` in the criteria.
 */
export function toClassifyCandidates(categories: Category[]): ClassifyCandidate[] {
  return categories
    .filter((c) => !c.isDeleted && (c.type === 'EXPENSE' || c.type === 'INCOME'))
    .map((c) => {
      const description = c.description?.trim();
      return description ? { id: c.id, name: c.name, description } : { id: c.id, name: c.name };
    });
}

export function isClassifierWorthTrying(text: string, candidates: ClassifyCandidate[]): boolean {
  if (classifierUnavailable) return false;
  if (candidates.length === 0) return false;
  if (normalizeText(text).length < MIN_CLASSIFIABLE_LENGTH) return false;
  // An optimization, never the safety mechanism - the `null` contract is that.
  // `onLine === false` is reliable; `true` only means "has an interface".
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  return true;
}

/**
 * Why a failure is a failure (ADR 0019).
 *
 * `classifyDescription` below collapses all of this to `null`, which is the
 * right answer for the live-typing path: there is nothing a form can usefully
 * do with the difference. A *batch* can - it should back off on
 * `rate-limited`, stop walking rows entirely on `unavailable`, and simply
 * accept `no-answer`. So the distinction is made here and discarded there.
 */
export type ClassifyOutcome =
  | { kind: 'ok'; data: ClassifyResponse }
  /** The model answered "other", or answered unusably. A real answer, not a failure. */
  | { kind: 'no-answer' }
  /** HTTP 429. Retryable after a wait. */
  | { kind: 'rate-limited' }
  /** The endpoint is absent or has latched off. Every subsequent call is pointless. */
  | { kind: 'unavailable' }
  /** Aborted, timed out, 5xx, malformed JSON, offline. Not worth retrying in a batch. */
  | { kind: 'failed' };

/**
 * The full-fidelity classify call. Identical network behaviour to
 * `classifyDescription` - same cache, same latch, same timeout - and it is the
 * single implementation both callers share.
 *
 * Still never throws and never rejects. That contract is load-bearing for
 * `classifyDescription` (see the module header) and is not relaxed here just
 * because this variant reports more detail.
 */
export async function classifyOnce(
  text: string,
  candidates: ClassifyCandidate[],
  signal?: AbortSignal
): Promise<ClassifyOutcome> {
  const key = cacheKey(text, candidates);
  const cached = cacheGet(key);
  // A cached negative is a settled "other" verdict, not a failure to retry.
  if (cached !== undefined) return cached === null ? { kind: 'no-answer' } : { kind: 'ok', data: cached };

  // Abort on whichever fires first: the caller's supersede signal, or our own
  // timeout. A hung request must not pin a suggestion slot open forever.
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  try {
    const res = await fetch(CLASSIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim(), categories: candidates }),
      signal: combined,
    });

    if (res.status === 404) {
      // Endpoint absent: unconfigured deployment, or the Vite dev server, which
      // does not serve `api/` at all. Stop asking for the rest of the session.
      classifierUnavailable = true;
      return { kind: 'unavailable' };
    }

    // Retryable, and the only status a batch should wait and re-attempt on.
    if (res.status === 429) return { kind: 'rate-limited' };

    if (!res.ok) return { kind: 'failed' };

    const data = (await res.json()) as ClassifyResponse;
    if (typeof data !== 'object' || data === null) return { kind: 'failed' };

    // `categoryId: null` is a real answer ("other" - nothing fits), so it is
    // cached as a negative result rather than retried on every keystroke.
    const normalized: ClassifyResponse = {
      categoryId: typeof data.categoryId === 'string' ? data.categoryId : null,
      categoryConfidence: typeof data.categoryConfidence === 'number' ? data.categoryConfidence : 0,
      detectedType: data.detectedType === 'INCOME' ? 'INCOME' : 'EXPENSE',
      typeConfidence: typeof data.typeConfidence === 'number' ? data.typeConfidence : 0,
    };
    cacheSet(key, normalized);
    return { kind: 'ok', data: normalized };
  } catch (err) {
    // An abort is an expected, routine outcome (the user kept typing) and must
    // not trip the availability latch the way a real network failure does.
    if (err instanceof DOMException && err.name === 'AbortError') return { kind: 'failed' };
    // A genuine network failure. Do NOT latch: the user may simply be offline
    // for a moment, and latching would disable the feature for the whole
    // session over one dropped request.
    return { kind: 'failed' };
  }
}

/**
 * Resolves to a raw `ClassifyResponse`, or `null` for "no answer" - which
 * covers both a genuine `other` verdict and every failure mode.
 *
 * `signal` lets the caller abort a request superseded by a newer keystroke.
 *
 * **This signature and behaviour are frozen** (ADR 0019). It is the live-typing
 * path's entire interface to the classifier, and `jev-classify.spec.ts` is its
 * regression guard. New callers wanting to know *why* a call failed should use
 * `classifyOnce` above rather than widening this.
 */
export async function classifyDescription(
  text: string,
  candidates: ClassifyCandidate[],
  signal?: AbortSignal
): Promise<ClassifyResponse | null> {
  const outcome = await classifyOnce(text, candidates, signal);
  return outcome.kind === 'ok' ? outcome.data : null;
}

/**
 * Applies the coherence rule and the confidence gate, turning a raw response
 * into something the form can act on - or `null` for "say nothing".
 *
 * The two Jev answers are independent and can disagree. The type is derived
 * from the chosen category (matching `smartMatcher.ts:53`), and a disagreement
 * with Jev's own `detectedType` demotes the result to a suggestion regardless
 * of how confident either answer was: disagreement is itself evidence of
 * ambiguity.
 */
export function toSuggestion(
  response: ClassifyResponse | null,
  categories: Category[]
): JevSuggestion | null {
  if (!response || !response.categoryId) return null;

  const category = categories.find((c) => c.id === response.categoryId && !c.isDeleted);
  if (!category) return null;

  const confidence = Math.min(response.categoryConfidence, response.typeConfidence);
  if (confidence < CONFIDENCE.SUGGEST) return null;

  const derivedType = category.type;
  const agrees = derivedType === response.detectedType;

  const strength: SuggestionStrength =
    agrees && confidence >= CONFIDENCE.AUTO_FILL ? 'AUTO_FILL' : 'SUGGEST';

  return {
    categoryId: category.id,
    categoryName: category.name,
    type: derivedType,
    confidence,
    strength,
  };
}
