/**
 * Shared field styling for this app's write forms. Promoted from
 * wallet/walletFormStyles.ts (T24), which now holds only wallet-specific
 * domain data (color palette, type options) and re-uses these primitives.
 *
 * Forms render on two different backgrounds (a subtly tinted surface, or a
 * flat white/dark card), so the tone is a parameter rather than baked in.
 */
export type FieldTone = 'subtle' | 'plain';

const FIELD_BASE =
  'w-full text-xs rounded-xl border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-800 dark:focus:border-stone-400';

const TONE: Record<FieldTone, string> = {
  subtle:
    'bg-stone-50 dark:bg-stone-800 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 transition-colors',
  plain: 'bg-white dark:bg-stone-800',
};

/** Bare label text with no block/margin - for labels whose spacing comes from a `gap-*`/`space-y-*` wrapper instead. */
export const LABEL_TEXT_CLASS =
  'text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300';

/** Block label with its own bottom margin - for labels in a plain (non-gapped) wrapper. */
export const LABEL_CLASS = `${LABEL_TEXT_CLASS} block mb-1`;

/** Text / number / textarea inputs use slightly wider horizontal padding than selects. */
export function inputClass(tone: FieldTone): string {
  return `${FIELD_BASE} px-3.5 py-2.5 placeholder:text-stone-400 dark:placeholder:text-stone-500 ${TONE[tone]}`;
}

export function selectClass(tone: FieldTone): string {
  return `${FIELD_BASE} px-3 py-2.5 ${TONE[tone]}`;
}

/** Native <option> elements need explicit dark colours to render correctly. */
export const OPTION_CLASS = 'dark:bg-stone-800 dark:text-stone-100';

export const ERROR_BANNER_CLASS =
  'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 p-3 rounded-xl text-xs font-medium';

export const PRIMARY_BUTTON_CLASS =
  'w-full py-2.5 sm:py-3 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 rounded-xl font-semibold text-xs transition-all shadow-xs cursor-pointer';

/** Same treatment as PRIMARY_BUTTON_CLASS without the sm: padding growth - for compact single-field forms and in-card actions. */
export const PRIMARY_BUTTON_COMPACT_CLASS =
  'w-full py-2.5 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 rounded-xl font-semibold text-xs transition-all shadow-xs cursor-pointer';

/** Muted counterpart to the primary buttons, for a cancel/secondary form action. Not yet adopted by any form - see refactor-log.md Phase 17. */
export const SECONDARY_BUTTON_CLASS =
  'w-full py-2.5 sm:py-3 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl font-semibold text-xs transition-all cursor-pointer';
