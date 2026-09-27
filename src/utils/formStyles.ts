/**
 * Shared field styling for this app's write forms. Promoted from
 * wallet/walletFormStyles.ts (T24), which now holds only wallet-specific
 * domain data (color palette, type options) and re-uses these primitives.
 *
 * Forms render on two different backgrounds (a subtly tinted surface, or a
 * flat white/dark card), so the tone is a parameter rather than baked in.
 */
export type FieldTone = 'subtle' | 'plain';

/*
 * Phase 53 (DESIGN.md section 4): every field sits on Surface 2 with the
 * dedicated `line-input` border (3:1 against any surface) and a 2px violet
 * focus ring in place of the outline. Both tones now render the same field;
 * `FieldTone` stays as the public parameter because callers pass it, and a
 * future surface that genuinely needs a different field can diverge here.
 */
const FIELD_BASE =
  'w-full text-xs rounded-lg border border-line-input bg-surface-2 text-fg focus:outline-none focus:ring-2 focus:ring-focus transition-colors';

const TONE: Record<FieldTone, string> = {
  subtle: '',
  plain: '',
};

/** Bare label text with no block/margin - for labels whose spacing comes from a `gap-*`/`space-y-*` wrapper instead. */
export const LABEL_TEXT_CLASS =
  'text-xs font-semibold uppercase tracking-wider text-fg-secondary';

/** Block label with its own bottom margin - for labels in a plain (non-gapped) wrapper. */
export const LABEL_CLASS = `${LABEL_TEXT_CLASS} block mb-1`;

/** Text / number / textarea inputs use slightly wider horizontal padding than selects. */
export function inputClass(tone: FieldTone): string {
  return `${FIELD_BASE} px-3.5 py-2.5 placeholder:text-fg-muted ${TONE[tone]}`.trim();
}

export function selectClass(tone: FieldTone): string {
  return `${FIELD_BASE} px-3 py-2.5 ${TONE[tone]}`.trim();
}

/** Native <option> elements need explicit colours to render correctly in the dark theme. */
export const OPTION_CLASS = 'bg-surface-2 text-fg';

export const ERROR_BANNER_CLASS =
  'bg-expense-tint border border-expense-line text-expense p-3 rounded-lg text-xs font-medium';

export const PRIMARY_BUTTON_CLASS =
  'w-full py-2.5 sm:py-3 bg-brand-fill hover:bg-brand-fill-hover text-white rounded-lg font-semibold text-xs transition-colors duration-150 cursor-pointer';

/** Same treatment as PRIMARY_BUTTON_CLASS without the sm: padding growth - for compact single-field forms and in-card actions. */
export const PRIMARY_BUTTON_COMPACT_CLASS =
  'w-full py-2.5 bg-brand-fill hover:bg-brand-fill-hover text-white rounded-lg font-semibold text-xs transition-colors duration-150 cursor-pointer';

/** Muted counterpart to the primary buttons, for a cancel/secondary form action. Not yet adopted by any form - see refactor-log.md Phase 17. */
export const SECONDARY_BUTTON_CLASS =
  'w-full py-2.5 sm:py-3 bg-surface-1 border border-line hover:border-brand text-fg-secondary rounded-lg font-semibold text-xs transition-colors duration-150 cursor-pointer';
