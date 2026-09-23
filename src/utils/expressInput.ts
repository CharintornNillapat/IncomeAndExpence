import { safeEvaluateMath } from './mathEvaluator';

export interface ExpressParseResult {
  /**
   * Raw text to seed the amount field with, e.g. `'60'` or `'120/4 + 15*2'`.
   * Already comma-stripped, because `safeEvaluateMath`'s sanitizer rejects `,`
   * outright and would otherwise reject its own extracted expression.
   */
  amountExpression: string | null;
  /** The evaluated, validated amount (always `> 0`), or `null`. */
  amount: number | null;
  /**
   * The note with the amount segment removed. Fed to the classifier layers
   * only - the ledger stores what the user actually typed (ADR 0013).
   */
  cleanDescription: string;
}

/*
 * An "amount run" starts with a digit or an opening paren, ends with a digit or
 * a closing one, and may contain the same alphabet `mathEvaluator`'s own
 * sanitizer accepts plus `,` for thousands separators (stripped before
 * evaluation). The three anchors below each embed that run verbatim rather than
 * composing it from a string: a `new RegExp(`...`)` built from template
 * literals needs two escaping levels, and getting one wrong throws at module
 * load - which `tsc` cannot see and which, with no error boundary anywhere in
 * `src/`, white-screens the app.
 */

/**
 * Trailing anchor - the primary form ("ข้าวมันไก่ 60", "bts 45", "ค่าไฟ 1200").
 *
 * The leading `(?:^|\s)` is load-bearing: requiring a whitespace boundary is
 * what stops `7-11`, `Tx-123` and `iphone15` from being harvested as amounts.
 */
const TRAILING_RE = /(?:^|\s)((?:[0-9(][0-9.,+\-*/%^() ]*)?[0-9)])\s*(?:฿|บาท|thb|baht)?$/i;

/** Leading anchor - preserves the shape `smartMatcher` has always recognized ("1200 ค่าไฟ"). */
const LEADING_RE = /^(?:฿\s*)?((?:[0-9(][0-9.,+\-*/%^() ]*)?[0-9)])\s+(\S[\s\S]*)$/i;

/** The whole note is nothing but an expression ("60", "120/4"). */
const WHOLE_RE = /^((?:[0-9(][0-9.,+\-*/%^() ]*)?[0-9)])\s*(?:฿|บาท|thb|baht)?$/i;

/** At or above this, a trailing number is an id or a timestamp, not money. */
const MAX_PLAUSIBLE_AMOUNT = 1e9;

/**
 * Evaluates one candidate run. Returns `null` for anything that is not a
 * plausible positive amount, which is what makes every anchor above safe to
 * try speculatively.
 */
function evaluateCandidate(raw: string): { expression: string; amount: number } | null {
  const normalized = raw.replace(/,/g, '').trim();
  if (!normalized) return null;

  const result = safeEvaluateMath(normalized);
  if (!result.isValid || result.value === null) return null;
  if (result.value <= 0 || result.value >= MAX_PLAUSIBLE_AMOUNT) return null;

  return { expression: normalized, amount: result.value };
}

function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Pulls an amount (or an inline math expression) out of a free-text note so a
 * single omni field can drive both the amount and the categorization layers.
 *
 * Deliberately separate from `smartMatcher.ts`, which must keep its current
 * leading-only extraction: `KeywordRulesView`'s parser tester surfaces
 * `extractedAmount`/`cleanDescription` through the `metric-*` testids and
 * `tests/keywords.spec.ts` asserts on exactly that behavior.
 *
 * Never throws. An unparseable note resolves to "no amount found", which the
 * caller renders as "type it into the amount field yourself".
 */
export function parseExpressInput(text: string): ExpressParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { amountExpression: null, amount: null, cleanDescription: '' };
  }

  // 1. The entire note is an expression - there is no description to keep.
  const whole = trimmed.match(WHOLE_RE);
  if (whole) {
    const evaluated = evaluateCandidate(whole[1]);
    if (evaluated) {
      return { amountExpression: evaluated.expression, amount: evaluated.amount, cleanDescription: '' };
    }
  }

  // 2. Trailing amount - the dominant way people actually type an entry.
  const trailing = trimmed.match(TRAILING_RE);
  if (trailing && typeof trailing.index === 'number') {
    const evaluated = evaluateCandidate(trailing[1]);
    if (evaluated) {
      return {
        amountExpression: evaluated.expression,
        amount: evaluated.amount,
        cleanDescription: tidy(trimmed.slice(0, trailing.index)),
      };
    }
  }

  // 3. Leading amount.
  const leading = trimmed.match(LEADING_RE);
  if (leading) {
    const evaluated = evaluateCandidate(leading[1]);
    if (evaluated) {
      return {
        amountExpression: evaluated.expression,
        amount: evaluated.amount,
        cleanDescription: tidy(leading[2]),
      };
    }
  }

  return { amountExpression: null, amount: null, cleanDescription: tidy(trimmed) };
}
