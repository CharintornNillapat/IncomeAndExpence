import { evaluate } from 'mathjs';

export interface MathEvaluationResult {
  isValid: boolean;
  value: number | null;
  formattedValue: string;
  error?: string;
}

// Restricted allowed characters: digits, decimal points, basic math operators (+, -, *, /, %, ^), parentheses, and whitespace
const SAFE_MATH_EXPRESSION_REGEX = /^[0-9+\-*/().%\^\s]+$/;

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

    // Validate result is a finite positive number
    if (typeof result === 'number' && !Number.isNaN(result) && Number.isFinite(result)) {
      const rounded = Math.round((result + Number.EPSILON) * 100) / 100;
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
