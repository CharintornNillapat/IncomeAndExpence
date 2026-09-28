import { motion } from 'framer-motion';
import { Check, Tag, X } from 'lucide-react';

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
}: SaveRuleChipProps) {
  const saved = status === 'saved';

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      data-testid="tx-save-rule"
      className={`mt-2 flex flex-col gap-1.5 rounded-lg border px-3 py-2 ${
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
            <button
              type="button"
              id={`${idPrefix}-save-rule-btn`}
              onClick={onSave}
              disabled={status === 'saving'}
              className="shrink-0 cursor-pointer rounded-sm bg-brand-fill px-2.5 py-1 text-xs font-semibold text-white transition-control hover:bg-brand-fill-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'saving' ? 'Saving...' : 'Save rule'}
            </button>

            <button
              type="button"
              id={`${idPrefix}-save-rule-dismiss`}
              onClick={onDismiss}
              aria-label="Dismiss rule suggestion"
              className="shrink-0 cursor-pointer rounded-sm p-1 text-fg-muted transition-control hover:text-fg"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      {error && !saved && (
        <p className="text-[11px] font-medium text-expense">{error}</p>
      )}
    </motion.div>
  );
}
