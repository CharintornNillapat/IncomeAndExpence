import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Category } from '../types';
import {
  classifyDescription,
  isClassifierWorthTrying,
  toClassifyCandidates,
  toSuggestion,
} from '../utils/jevClassifier';
import type { JevSuggestion } from '../utils/jevClassifier';

/**
 * Debounce window after the last keystroke. Long enough that typing a whole
 * description costs one call rather than one per character, short enough that
 * the suggestion lands while the user is still looking at the field.
 */
const DEBOUNCE_MS = 450;

/**
 * Async half of the two-layer categorization described in ADR 0011.
 *
 * The synchronous keyword matcher stays where it is, in
 * `TransactionForm.handleDescriptionChange`, and runs on every keystroke. This
 * hook is armed only when that matcher finds nothing - so a rule hit never
 * reaches the debounce, the cache, or the network.
 *
 * Owns three things the classifier itself deliberately does not: the debounce,
 * cancellation of superseded requests, and a monotonic sequence guard so a slow
 * response for an older description can never overwrite a newer one.
 */
export function useDescriptionClassifier(categories: Category[]) {
  const [suggestion, setSuggestion] = useState<JevSuggestion | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);
  /** Normalized descriptions the user has explicitly waved off this session. */
  const dismissedRef = useRef<Set<string>>(new Set());

  const candidates = useMemo(() => toClassifyCandidates(categories), [categories]);

  // `categories` is a prop-derived array; keep the live value in a ref so
  // `classify` does not need it as a dependency and change identity on every
  // parent render. Same ref-mirror rationale as FinanceContext's mutators.
  const categoriesRef = useRef(categories);
  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  const candidatesRef = useRef(candidates);
  useEffect(() => {
    candidatesRef.current = candidates;
  }, [candidates]);

  const cancelPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  useEffect(() => cancelPending, [cancelPending]);

  /** Drop any in-flight work and hide the current suggestion. */
  const clear = useCallback(() => {
    cancelPending();
    // Invalidate any response still in flight that beat the abort.
    seqRef.current += 1;
    setSuggestion(null);
  }, [cancelPending]);

  const dismiss = useCallback(() => {
    setSuggestion((current) => {
      if (current) dismissedRef.current.add(current.categoryId + '##' + current.categoryName);
      return null;
    });
  }, []);

  /**
   * Arm a classification for `text`. Safe to call on every keystroke: each call
   * supersedes the last, and a rule hit should simply not call this at all.
   */
  const classify = useCallback(
    (text: string) => {
      cancelPending();

      const seq = ++seqRef.current;
      const currentCandidates = candidatesRef.current;

      if (!isClassifierWorthTrying(text, currentCandidates)) {
        setSuggestion(null);
        return;
      }

      timerRef.current = setTimeout(() => {
        const controller = new AbortController();
        abortRef.current = controller;

        void classifyDescription(text, currentCandidates, controller.signal).then((response) => {
          // A newer keystroke has already superseded this request.
          if (seq !== seqRef.current) return;

          const next = toSuggestion(response, categoriesRef.current);
          if (next && dismissedRef.current.has(next.categoryId + '##' + next.categoryName)) {
            setSuggestion(null);
            return;
          }
          setSuggestion(next);
        });
      }, DEBOUNCE_MS);
    },
    [cancelPending]
  );

  return { suggestion, classify, clear, dismiss } as const;
}
