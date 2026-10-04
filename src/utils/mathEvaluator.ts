import { evaluate } from 'mathjs/number';

export interface MathEvaluationResult {
  isValid: boolean;
  value: number | null;
  formattedValue: string;
  error?: string;
}

// Restricted allowed characters: digits, decimal points, basic math operators (+, -, *, /, %, ^), parentheses, and whitespace
const SAFE_MATH_EXPRESSION_REGEX = /^[0-9+\-*/().%\^\s]+$/;

/**
 * Rounds to 2 decimal places (whole cents).
 *
 * A plain `Math.round(value * 100) / 100` under-rounds any half-cent whose binary
 * representation falls a hair below .5 - `16.775 * 100` is `1677.4999999999998`,
 * so it yields 16.77 instead of 16.78. Adding a bare `Number.EPSILON` before
 * scaling does not fix this: EPSILON is the gap at 1.0, so it is smaller than one
 * ULP for any `|value| >= 2` and gets swallowed entirely.
 *
 * Nudging by an epsilon scaled to the magnitude of the value corrects the
 * representation error without disturbing values that are genuinely below the
 * halfway point.
 */
function roundToTwoDecimals(value: number): number {
  const scaled = value * 100;
  const nudge = Math.sign(scaled) * Math.abs(scaled) * Number.EPSILON * 4;
  return Math.round(scaled + nudge) / 100;
}

/**
 * Safely evaluates a math expression string using mathjs.
 * Strictly checks input characters to prevent code injection or unintended function calls.
 */
export function safeEvaluateMath(expression: string): MathEvaluationResult {
  const trimmed = expression.trim();
  if (!trimmed) {
    return { isValid: false, value: null, formattedValue: '', error: 'Empty expression' };
  }

  // Sanitize check: reject letters, brackets, assignments, objects, comments, etc.
  if (!SAFE_MATH_EXPRESSION_REGEX.test(trimmed)) {
    return {
      isValid: false,
      value: null,
      formattedValue: '',
      error: 'Invalid characters in calculation',
    };
  }

  try {
    const result = evaluate(trimmed);

    // Validate result is a finite number. Callers enforce their own sign rules
    // (e.g. TransactionSchema requires a positive amount).
    if (typeof result === 'number' && !Number.isNaN(result) && Number.isFinite(result)) {
      const rounded = roundToTwoDecimals(result);
      return {
        isValid: true,
        value: rounded,
        formattedValue: rounded.toFixed(2),
      };
    }

    return {
      isValid: false,
      value: null,
      formattedValue: '',
      error: 'Calculation did not produce a valid number',
    };
  } catch {
    return {
      isValid: false,
      value: null,
      formattedValue: '',
      error: 'Incomplete or malformed math expression',
    };
  }
}

/** What the amount field shows and reports for one piece of text (ADR 0057). */
export interface AmountInputEvaluation {
  /** A positive amount, or null for text that is empty, unfinished, invalid or not above zero. */
  amount: number | null;
  formattedValue: string;
  /** The text holds an operator or a bracket, so its result is worth showing beside it. */
  hasCalculation: boolean;
  /** The message under the field; null while it is empty or part-way through a formula. */
  error: string | null;
}

/**
 * The amount field's rules for one text, with no state. `InlineMathInput`
 * derives what it shows from it during render, and a caller that seeds the
 * field reads the amount it seeded from it, in the same handler.
 */
export function evaluateAmountInput(raw: string): AmountInputEvaluation {
  if (!raw.trim()) return { amount: null, formattedValue: '', hasCalculation: false, error: null };

  const hasCalculation = /[+\-*/%^()]/.test(raw);
  const result = safeEvaluateMath(raw);

  if (result.isValid && result.value !== null) {
    if (result.value <= 0) {
      return { amount: null, formattedValue: '', hasCalculation, error: 'Amount must be greater than zero' };
    }
    return { amount: result.value, formattedValue: result.formattedValue, hasCalculation, error: null };
  }

  // A trailing operator or open paren is an expected intermediate state:
  // mid-way through typing "120 + 30", or the instant an operator chip is
  // tapped. It is not yet an amount, but it is not an error either.
  const isIncomplete = /[+\-*/%^(]\s*$/.test(raw);
  const error =
    !isIncomplete && (raw.trim().length > 1 || !/^[0-9.]+$/.test(raw))
      ? result.error || 'Invalid expression'
      : null;
  return { amount: null, formattedValue: '', hasCalculation, error };
}
