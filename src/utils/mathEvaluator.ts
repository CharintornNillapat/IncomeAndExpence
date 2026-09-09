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
