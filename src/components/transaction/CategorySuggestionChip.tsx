import { motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import type { JevSuggestion } from '../../utils/jevClassifier';

interface CategorySuggestionChipProps {
  suggestion: JevSuggestion;
  /** `useId()` value from the owning form, so two mounted forms get distinct ids. */
  idPrefix: string;
  onApply: () => void;
  onDismiss: () => void;
}

/**
 * The mid-confidence half of the confidence gate (ADR 0011).
 *
 * A high-confidence classification fills the fields outright and shows the
 * existing "Auto-categorized" badge instead - this chip exists only for the
 * 0.50-0.85 band, where the model has an opinion worth showing but not one
 * worth acting on unasked.
 *
 * It is deliberately non-blocking: nothing is written to form state until
 * `onApply` fires, and the form stays fully usable and submittable while the
 * chip is on screen. Ignoring it is a valid outcome.
 */
export function CategorySuggestionChip({
  suggestion,
  idPrefix,
  onApply,
  onDismiss,
}: CategorySuggestionChipProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      data-testid="tx-category-suggestion"
      className="mt-2 flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 dark:border-stone-700 dark:bg-stone-800"
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-stone-500 dark:text-stone-400" />

      <span className="min-w-0 flex-1 truncate text-xs text-stone-600 dark:text-stone-300">
        Looks like <strong className="font-semibold text-stone-900 dark:text-stone-100">{suggestion.categoryName}</strong>
      </span>

      <button
        type="button"
        id={`${idPrefix}-suggestion-apply`}
        onClick={onApply}
        className="shrink-0 cursor-pointer rounded-lg bg-stone-900 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
      >
        Apply
      </button>

      <button
        type="button"
        id={`${idPrefix}-suggestion-dismiss`}
        onClick={onDismiss}
        aria-label="Dismiss category suggestion"
        className="shrink-0 cursor-pointer rounded-lg p-1 text-stone-400 transition-colors hover:text-stone-700 dark:hover:text-stone-200"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}
