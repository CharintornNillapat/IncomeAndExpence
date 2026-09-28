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
  'w-full min-h-[44px] text-xs rounded-lg border border-line-input bg-surface-2 text-fg focus:outline-none focus:ring-2 focus:ring-focus transition-control';

const TONE: Record<FieldTone, string> = {
  subtle: '',
  plain: '',
};

/**
 * Bare label text with no block/margin - for labels whose spacing comes from a `gap-*`/`space-y-*` wrapper instead.
 * Sentence case since Phase 53b: DESIGN.md keeps uppercase for compact metric labels, column headers and tickers, not form labels.
 */
export const LABEL_TEXT_CLASS =
  'text-xs font-semibold text-fg-secondary';

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

// Buttons are not here: they are `components/ui/Button` (Phase 56, ADR 0029), which replaced the
// PRIMARY_BUTTON_CLASS / PRIMARY_BUTTON_COMPACT_CLASS / SECONDARY_BUTTON_CLASS strings.
