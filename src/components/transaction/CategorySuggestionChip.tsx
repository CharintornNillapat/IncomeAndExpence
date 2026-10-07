import { Tags, X } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import type { JevSuggestion } from '../../utils/jevClassifier';

interface CategorySuggestionChipProps {
  suggestion: JevSuggestion;
  /** `useId()` value from the owning form, so two mounted forms get distinct ids. */
  idPrefix: string;
  onApply: () => void;
  onDismiss: () => void;
  /** Set by `Presence` while the chip plays its exit (ADR 0082). */
  'data-leaving'?: boolean;
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
  'data-leaving': leaving,
}: CategorySuggestionChipProps) {
  return (
    <div
      data-leaving={leaving}
      data-testid="tx-category-suggestion"
      className="motion-chip mt-2 flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2"
    >
      <Tags className="h-3.5 w-3.5 shrink-0 text-fg-muted" />

      <span className="min-w-0 flex-1 truncate text-xs text-fg-secondary">
        Looks like <strong className="font-semibold text-fg">{suggestion.categoryName}</strong>
      </span>

      {/* 44px boxes around the drawn controls (DESIGN.md section 4, ADR 0041).
          The negative margins keep the chip from growing; Apply's box is
          invisible, so its focus outline moves onto the pill. */}
      <button
        type="button"
        id={`${idPrefix}-suggestion-apply`}
        onClick={onApply}
        className="group shrink-0 inline-flex items-center min-h-[44px] -my-2.5 cursor-pointer focus-visible:outline-none"
      >
        <span className="rounded-sm bg-brand-fill px-2.5 py-1 text-xs font-semibold text-white transition-control group-hover:bg-brand-fill-hover group-focus-visible:outline-2 group-focus-visible:outline-focus group-focus-visible:outline-offset-2">
          Apply
        </span>
      </button>

      <IconButton
        id={`${idPrefix}-suggestion-dismiss`}
        onClick={onDismiss}
        label="Dismiss category suggestion"
        className="-my-2.5 -mr-2"
      >
        <X className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  );
}
