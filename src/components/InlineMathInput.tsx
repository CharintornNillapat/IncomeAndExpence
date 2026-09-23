import React, { useState, useEffect, useId } from 'react';
import { Calculator, Check, AlertCircle, Sparkles, Info } from 'lucide-react';
import { safeEvaluateMath } from '../utils/mathEvaluator';
import { APP_CURRENCY_SYMBOL } from '../utils/currency';
import { LABEL_TEXT_CLASS } from '../utils/formStyles';

export interface InlineMathInputProps {
  id?: string;
  label?: string;
  placeholder?: string;
  currencyPrefix?: string;
  defaultValue?: string;
  /**
   * Imperative re-seed. Bumping `key` pushes `value` into the field without
   * remounting the component, which is what lets a caller drive this field
   * from another one (the express note parser) on every keystroke. `key` is
   * compared, not `value`, so re-seeding the same text twice is a no-op.
   */
  seed?: { key: number; value: string };
  disabled?: boolean;
  required?: boolean;
  onAmountEvaluated: (amount: number | null, rawExpression: string, isValid: boolean) => void;
  /**
   * Fired on any *human* interaction with this field - typing, a quick-amount
   * chip, an operator button, applying a computed result - and never by a
   * `seed` push. Lets a caller latch "the user has taken the amount over" and
   * stop overwriting it. Kept separate from `onAmountEvaluated` so the
   * existing callback's signature stays stable for `WalletTransferForm`.
   */
  onUserEdit?: () => void;
}

export const InlineMathInput: React.FC<InlineMathInputProps> = ({
  id,
  label = 'Amount / Math Expression',
  placeholder = 'e.g. 500+500 or 1200*0.8',
  currencyPrefix = APP_CURRENCY_SYMBOL,
  defaultValue = '',
  seed,
  disabled = false,
  required = false,
  onAmountEvaluated,
  onUserEdit,
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  const [rawInput, setRawInput] = useState<string>(defaultValue);
  const [evaluatedAmount, setEvaluatedAmount] = useState<number | null>(null);
  const [formattedResult, setFormattedResult] = useState<string>('');
  const [hasCalculation, setHasCalculation] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const onAmountEvaluatedRef = React.useRef(onAmountEvaluated);
  const onUserEditRef = React.useRef(onUserEdit);
  useEffect(() => {
    onAmountEvaluatedRef.current = onAmountEvaluated;
    onUserEditRef.current = onUserEdit;
  });

  // Marks the field as user-owned. Every human entry point funnels through
  // here; the `seed` effect below deliberately does not.
  const notifyUserEdit = () => {
    onUserEditRef.current?.();
  };

  // Shared evaluation body so both direct typing and the quick-amount chips
  // go through identical math evaluation rules.
  const evaluateAndNotify = (val: string) => {
    if (!val.trim()) {
      setEvaluatedAmount(null);
      setFormattedResult('');
      setHasCalculation(false);
      setErrorMessage(null);
      onAmountEvaluatedRef.current(null, '', false);
      return;
    }

    const isComplex = /[+\-*/%^()]/.test(val);
    setHasCalculation(isComplex);

    const evalResult = safeEvaluateMath(val);

    if (evalResult.isValid && evalResult.value !== null) {
      if (evalResult.value <= 0) {
        setEvaluatedAmount(null);
        setFormattedResult('');
        setErrorMessage('Amount must be greater than zero');
        onAmountEvaluatedRef.current(null, val, false);
      } else {
        setEvaluatedAmount(evalResult.value);
        setFormattedResult(evalResult.formattedValue);
        setErrorMessage(null);
        onAmountEvaluatedRef.current(evalResult.value, val, true);
      }
    } else {
      setEvaluatedAmount(null);
      setFormattedResult('');
      // A trailing operator or open paren is an expected intermediate state -
      // mid-way through typing "120 + 30", or the instant an operator chip is
      // tapped. Report it to the parent as not-yet-valid so the submit button
      // stays disabled, but do not shout an error about it.
      const isIncomplete = /[+\-*/%^(]\s*$/.test(val);
      if (!isIncomplete && (val.trim().length > 1 || !/^[0-9.]+$/.test(val))) {
        setErrorMessage(evalResult.error || 'Invalid expression');
      } else {
        setErrorMessage(null);
      }
      onAmountEvaluatedRef.current(null, val, false);
    }
  };

  // Synchronous change handler to prevent race conditions during testing / rapid form submission
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    notifyUserEdit();
    setRawInput(val);
    evaluateAndNotify(val);
  };

  // Evaluate whenever raw input or defaultValue initializes
  useEffect(() => {
    if (defaultValue && !rawInput) {
      setRawInput(defaultValue);
      const evalResult = safeEvaluateMath(defaultValue);
      if (evalResult.isValid && evalResult.value !== null && evalResult.value > 0) {
        setEvaluatedAmount(evalResult.value);
        setFormattedResult(evalResult.formattedValue);
        onAmountEvaluatedRef.current(evalResult.value, defaultValue, true);
      }
    }
  }, [defaultValue]);

  // Caller-driven re-seed. Keyed on `seed.key` rather than `seed.value` so a
  // caller can deliberately re-push the same text, and initialized to the
  // mount-time key so the first render is never treated as a seed (that would
  // clobber `defaultValue`).
  const lastSeedKeyRef = React.useRef<number | undefined>(seed?.key);
  useEffect(() => {
    if (!seed || seed.key === lastSeedKeyRef.current) return;
    lastSeedKeyRef.current = seed.key;
    setRawInput(seed.value);
    evaluateAndNotify(seed.value);
    // `evaluateAndNotify` reads no state - it only calls setters and a ref'd
    // callback - so re-running this on its identity would be pure churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.key]);

  // Each of the three below replaces the field's contents, so each must
  // re-evaluate: leaving the parent's `amount`/`isAmountValid` stale here is
  // what used to leave the submit button disabled after tapping an operator.
  const handleApplyResult = () => {
    if (evaluatedAmount !== null && hasCalculation) {
      const next = evaluatedAmount.toString();
      notifyUserEdit();
      setRawInput(next);
      evaluateAndNotify(next);
    }
  };

  const handleQuickAdd = (operator: string) => {
    const trimmed = rawInput.trim();
    if (!trimmed) return;
    // Avoid duplicate consecutive operator characters
    const next = /[+\-*/]$/.test(trimmed) ? trimmed.slice(0, -1) + operator : trimmed + operator;
    notifyUserEdit();
    setRawInput(next);
    evaluateAndNotify(next);
  };

  // Rapid expense recording: chip appends the amount, chaining with "+" onto
  // whatever is already typed rather than replacing it.
  const handleQuickAmount = (amount: number) => {
    const trimmed = rawInput.trim();
    const next = !trimmed
      ? amount.toString()
      : /[+\-*/]$/.test(trimmed)
      ? trimmed + amount.toString()
      : `${trimmed}+${amount.toString()}`;
    notifyUserEdit();
    setRawInput(next);
    evaluateAndNotify(next);
  };

  return (
    <div id={`${inputId}-container`} className="flex flex-col gap-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={inputId} className={LABEL_TEXT_CLASS}>
            {label} {required && <span className="text-rose-500">*</span>}
            <span
              className="inline-flex align-middle ml-1.5 text-stone-300 dark:text-stone-600 hover:text-stone-500 dark:hover:text-stone-400 cursor-help"
              title="Supports formulas: 120/2 + 50"
              aria-label="Supports formulas: 120/2 + 50"
            >
              <Info className="w-3.5 h-3.5" />
            </span>
          </label>
          {hasCalculation && evaluatedAmount !== null && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
              <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              Calculated: {currencyPrefix}{formattedResult}
            </span>
          )}
        </div>
      )}

      {/* Main Input Control Container */}
      <div
        className={`relative flex items-center rounded-xl border bg-white dark:bg-stone-800 px-3 py-2.5 transition-all shadow-xs ${
          errorMessage
            ? 'border-rose-400 ring-2 ring-rose-100 dark:ring-rose-950/40'
            : isFocused
            ? 'border-stone-800 dark:border-stone-400 ring-2 ring-stone-200 dark:ring-stone-700'
            : 'border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600'
        } ${disabled ? 'opacity-60 bg-stone-50 dark:bg-stone-900 cursor-not-allowed' : ''}`}
      >
        <span className="text-stone-400 dark:text-stone-500 font-medium text-base select-none mr-2">
          {currencyPrefix}
        </span>

        <input
          id={inputId}
          name="amount_expression"
          type="text"
          value={rawInput}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck="false"
          className="w-full text-base font-semibold text-stone-900 dark:text-stone-100 placeholder:text-stone-300 dark:placeholder:text-stone-600 placeholder:font-normal focus:outline-none bg-transparent"
        />

        {/* Right Status / Action Preview */}
        <div className="flex items-center gap-1.5 ml-2">
          {hasCalculation && evaluatedAmount !== null ? (
            <button
              id={`${inputId}-apply-btn`}
              type="button"
              onClick={handleApplyResult}
              title="Click to replace expression with calculated sum"
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600 rounded-lg transition-colors border border-stone-200 dark:border-stone-600 cursor-pointer"
            >
              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span className="font-mono">{currencyPrefix}{formattedResult}</span>
            </button>
          ) : evaluatedAmount !== null ? (
            <div className="p-1 text-emerald-600 dark:text-emerald-400">
              <Check className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-1 text-stone-400 dark:text-stone-500">
              <Calculator className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>

        {/* Quick math operator buttons & error reporting */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs px-1">
          {errorMessage ? (
            <p id={`${inputId}-error`} className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium py-0.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </p>
          ) : (
            <span className="text-stone-500 dark:text-stone-400 text-[11px] sm:text-xs">
              Supports inline arithmetic: <code className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-1.5 py-0.5 rounded text-[11px] font-mono border border-stone-200 dark:border-stone-700">+ - * / ()</code>
            </span>
          )}

          {/* Quick Operator Shortcuts with mobile-friendly touch targets */}
          {!disabled && (
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <span className="text-[11px] text-stone-400 dark:text-stone-500 font-medium sm:hidden mr-1">Quick operators:</span>
              {['+', '-', '*', '/', '(', ')'].map((op) => (
                <button
                  key={op}
                  id={`${inputId}-op-${op}`}
                  type="button"
                  onClick={() => handleQuickAdd(op)}
                  className="min-w-8 h-8 px-2 flex items-center justify-center text-xs font-semibold rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 active:bg-stone-300 dark:active:bg-stone-600 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer border border-stone-200 dark:border-stone-700"
                >
                  {op}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick-amount chips: accelerate rapid expense recording. Visible at every
            breakpoint since the express note flow made this field the place you
            land after the amount is pre-filled, not just a mobile shortcut. */}
        {!disabled && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            <span className="text-[11px] text-stone-400 dark:text-stone-500 font-medium mr-1">Quick amount:</span>
            {[100, 500, 1000].map((amount) => (
              <button
                key={amount}
                id={`${inputId}-chip-${amount}`}
                type="button"
                onClick={() => handleQuickAmount(amount)}
                className="min-h-8 px-2.5 flex items-center justify-center text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 active:bg-emerald-200 dark:active:bg-emerald-900 text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer border border-emerald-100 dark:border-emerald-800/60"
              >
                +{amount.toLocaleString()}
              </button>
            ))}
          </div>
        )}
    </div>
  );
};
