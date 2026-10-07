import { Check, Tag, X } from 'lucide-react';
import { IconButton } from '../ui/IconButton';

export type SaveRuleStatus = 'idle' | 'saving' | 'saved';

interface SaveRuleChipProps {
  /** The exact text that will be written as the rule's keyword, printed verbatim so one click carries no surprise. */
  keyword: string;
  categoryName: string;
  /** `useId()` value from the owning form, so two mounted forms get distinct ids. */
  idPrefix: string;
  status: SaveRuleStatus;
  /** A rejected write's `MutationResult.error`, surfaced in place so the retry is one tap away. */
  error?: string | null;
  onSave?: () => void;
  onDismiss?: () => void;
  /** Set by `Presence` while the chip plays its exit (ADR 0082). */
  'data-leaving'?: boolean;
}

/**
 * Offers to remember a categorization the user just made by hand (ADR 0017).
 *
 * `smartMatcher` is the first and authoritative categorization layer, but its
 * only writer used to be the Categories view - four navigations away from the
 * moment the user actually knows what the rule should say. This chip closes
 * that loop where the correction happens.
 *
 * Deliberately non-blocking, exactly like `CategorySuggestionChip` one field
 * above it: nothing about the transaction submit reads or waits on this, so
 * ignoring it is a valid outcome and saving a rule never delays a write.
 *
 * The `saved` state is driven by the form's own transient flash rather than by
 * the conditions that produced the offer - a successful save lands in
 * `keywordRules`, which makes those conditions false on the very next render.
 */
export function SaveRuleChip({
  keyword,
  categoryName,
  idPrefix,
  status,
  error,
  onSave,
  onDismiss,
  'data-leaving': leaving,
}: SaveRuleChipProps) {
  const saved = status === 'saved';

  return (
    <div
      data-leaving={leaving}
      data-testid="tx-save-rule"
      className={`motion-chip mt-2 flex flex-col gap-1.5 rounded-lg border px-3 py-2 ${
        saved
          ? 'border-income-line bg-income-tint'
          : 'border-line bg-surface-2'
      }`}
    >
      <div className="flex items-center gap-2">
        {saved ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-income" />
        ) : (
          <Tag className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
        )}

        {saved ? (
          <span className="min-w-0 flex-1 truncate text-xs text-income">
            Rule saved: <strong className="font-semibold">{keyword}</strong> now files under{' '}
            <strong className="font-semibold">{categoryName}</strong>
          </span>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-xs text-fg-secondary">
              Always file &ldquo;<strong className="font-semibold text-fg">{keyword}</strong>
              &rdquo; under <strong className="font-semibold text-fg">{categoryName}</strong>?
            </span>

            {/*
              Disabled while in flight. This looks decorative on a local-storage
              ledger, where the write is effectively synchronous, but an
              authenticated one is a Supabase round-trip and `addKeywordRule`
              has no dedupe - so a double-tap would write two identical rules.
            */}
            {/* 44px boxes around the drawn controls (DESIGN.md section 4, ADR
                0041), as in `CategorySuggestionChip`. */}
            <button
              type="button"
              id={`${idPrefix}-save-rule-btn`}
              onClick={onSave}
              disabled={status === 'saving'}
              className="group shrink-0 inline-flex items-center min-h-[44px] -my-2.5 cursor-pointer focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="rounded-sm bg-brand-fill px-2.5 py-1 text-xs font-semibold text-white transition-control group-hover:bg-brand-fill-hover group-focus-visible:outline-2 group-focus-visible:outline-focus group-focus-visible:outline-offset-2">
                {status === 'saving' ? 'Saving...' : 'Save rule'}
              </span>
            </button>

            <IconButton
              id={`${idPrefix}-save-rule-dismiss`}
              onClick={onDismiss}
              label="Dismiss rule suggestion"
              className="-my-2.5 -mr-2"
            >
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </>
        )}
      </div>

      {error && !saved && (
        <p className="text-[11px] font-medium text-expense">{error}</p>
      )}
    </div>
  );
}
