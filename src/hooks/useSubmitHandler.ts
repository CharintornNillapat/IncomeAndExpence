import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { MutationResult } from '../context/FinanceContext';

interface UseSubmitHandlerOptions {
  /** Shown when the write is rejected without its own message. */
  defaultErrorMessage: string;
  /** Called once the write succeeds - reset draft fields, close a modal, etc. */
  onSuccess?: () => void;
}

/**
 * Wraps the submit -> validate -> mutate -> error-or-reset shape duplicated
 * across this app's write forms. Guards re-entrant submits while a write is
 * in flight. Per CLAUDE.md's MutationResult convention, the caller stays
 * responsible for keeping the form open and populated on failure - this hook
 * only stops it from double-submitting and centralizes the error surfacing.
 */
export function useSubmitHandler({ defaultErrorMessage, onSuccess }: UseSubmitHandlerOptions) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (
      e: FormEvent,
      submit: () => Promise<MutationResult | void> | MutationResult | void
    ) => {
      e.preventDefault();
      if (isSubmitting) return;

      setError(null);
      setIsSubmitting(true);
      try {
        const res = await submit();
        if (res && typeof res === 'object' && 'success' in res && !res.success) {
          setError(res.error || defaultErrorMessage);
          return;
        }
        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : defaultErrorMessage);
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, defaultErrorMessage, onSuccess]
  );

  return { isSubmitting, error, setError, handleSubmit };
}
