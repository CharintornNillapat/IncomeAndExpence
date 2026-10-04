import React, { useState, useMemo, useId } from 'react';
import { Calculator, Check, AlertCircle } from 'lucide-react';
import { evaluateAmountInput } from '../utils/mathEvaluator';
import { APP_CURRENCY_SYMBOL } from '../utils/currency';
import { LABEL_TEXT_CLASS } from '../utils/formStyles';

export interface InlineMathInputProps {
  id?: string;
  label?: string;
  placeholder?: string;
  currencyPrefix?: string;
  /**
   * Caller-driven text. Bumping `key` puts `value` in the field without
   * remounting it, which is what lets a caller drive this field from another
   * one (the express note parser) on every keystroke. `key` is compared, not
   * `value`, so a caller can put the same text in twice. The key a field
   * mounts with is not a seed.
   *
   * It is applied during render (ADR 0057), so a keystroke can never land
   * between the push and the text changing. A seed is the caller's own event,
   * so the field does not report it back through `onAmountEvaluated`: the
   * caller reads its amount from `evaluateAmountInput(value)` in the handler
   * that seeds, as `TransactionForm`'s `seedAmount` does.
   */
  seed?: { key: number; value: string };
  disabled?: boolean;
  required?: boolean;
  /** Fired for every change a person makes to the text; a `seed` is never reported. */
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
  seed,
  disabled = false,
  required = false,
  onAmountEvaluated,
  onUserEdit,
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  const [rawInput, setRawInput] = useState<string>('');
  const [isFocused, setIsFocused] = useState<boolean>(false);

  // A new seed replaces the text in this render, before any later keystroke
  // can be handled (ADR 0057). The key the field mounted with is not a seed.
  const [seedKey, setSeedKey] = useState<number | undefined>(seed?.key);
  if (seed && seed.key !== seedKey) {
    setSeedKey(seed.key);
    setRawInput(seed.value);
  }

  // Everything the field shows is derived from its text, so it can never
  // disagree with it.
  const {
    amount: evaluatedAmount,
    formattedValue: formattedResult,
    hasCalculation,
    error: errorMessage,
  } = useMemo(() => evaluateAmountInput(rawInput), [rawInput]);

  // Every human change goes through here: it marks the field as the user's,
  // sets the text, and reports the amount the text now holds. A trailing
  // operator reports not-yet-valid, so the submit button stays disabled.
  const setTextByUser = (next: string) => {
    onUserEdit?.();
    setRawInput(next);
    const { amount } = evaluateAmountInput(next);
    onAmountEvaluated(amount, next.trim() ? next : '', amount !== null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTextByUser(e.target.value);
  };

  // Each of the three below replaces the field's contents, so each must
  // re-evaluate: leaving the parent's `amount`/`isAmountValid` stale here is
  // what used to leave the submit button disabled after tapping an operator.
  const handleApplyResult = () => {
    if (evaluatedAmount !== null && hasCalculation) {
      setTextByUser(evaluatedAmount.toString());
    }
  };

  const handleQuickAdd = (operator: string) => {
    const trimmed = rawInput.trim();
    if (!trimmed) return;
    // Avoid duplicate consecutive operator characters
    setTextByUser(/[+\-*/]$/.test(trimmed) ? trimmed.slice(0, -1) + operator : trimmed + operator);
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
    setTextByUser(next);
  };

  return (
    <div id={`${inputId}-container`} className="flex flex-col gap-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={inputId} className={LABEL_TEXT_CLASS}>
            {label} {required && <span className="text-expense">*</span>}
          </label>
          {hasCalculation && evaluatedAmount !== null && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-brand bg-brand-tint px-2 py-0.5 rounded-sm border border-brand-line">
              <Calculator className="w-3 h-3 text-brand" />
              Calculated: {currencyPrefix}{formattedResult}
            </span>
          )}
        </div>
      )}

      {/* Main Input Control Container. No vertical padding: the input itself is
          the frame's full 44px height, so a tap anywhere on it lands on the
          input (ADR 0041). */}
      <div
        className={`relative flex items-center rounded-lg border px-3 transition-all ${
          errorMessage
            ? 'border-expense ring-2 ring-expense-line'
            : isFocused
            ? 'border-line-input ring-2 ring-focus'
            : 'border-line-input hover:border-fg-muted'
        } ${disabled ? 'opacity-60 bg-surface-1 cursor-not-allowed' : 'bg-surface-2'}`}
      >
        <span className="text-fg-muted font-medium text-base select-none mr-2">
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
          className="w-full min-h-[44px] text-base font-semibold text-fg placeholder:text-fg-muted placeholder:font-normal focus:outline-none bg-transparent"
        />

        {/* Right Status / Action Preview */}
        <div className="flex items-center gap-1.5 ml-2">
          {hasCalculation && evaluatedAmount !== null ? (
            // A 44px box around the drawn pill (DESIGN.md section 4). The box
            // is invisible, so the focus outline moves onto the pill, as the
            // navbar's sync badge does.
            <button
              id={`${inputId}-apply-btn`}
              type="button"
              onClick={handleApplyResult}
              title="Replace the formula with its result"
              className="group inline-flex items-center min-h-[44px] cursor-pointer focus-visible:outline-none"
            >
              {/* The result itself is in the "Calculated" badge above the
                  field; this button names its action rather than repeating the
                  figure (ADR 0042, audit 013 finding 7). */}
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-fg-secondary bg-surface-1 group-hover:bg-surface-3 rounded-lg transition-control border border-line group-focus-visible:outline-2 group-focus-visible:outline-focus group-focus-visible:outline-offset-2">
                <Check className="w-3 h-3 text-income" />
                <span className="whitespace-nowrap">Use result</span>
              </span>
            </button>
          ) : evaluatedAmount !== null ? (
            <div className="p-1 text-income">
              <Check className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-1 text-fg-muted">
              <Calculator className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>

        {/* Quick math operator buttons & error reporting */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs px-1">
          {/* Formula help lives once, in the placeholder: the operator keys
              beside it already show what a formula can use, so the old
              "Supports inline arithmetic" line and the hover-only (i) were
              the second and third copies (ADR 0042, audit 013 finding 7). */}
          {errorMessage && (
            <p id={`${inputId}-error`} className="flex items-center gap-1.5 text-expense font-medium py-0.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </p>
          )}

          {/* Quick Operator Shortcuts with mobile-friendly touch targets */}
          {!disabled && (
            <div className="flex items-center gap-1.5 self-end sm:self-auto sm:ml-auto">
              <span className="text-[11px] text-fg-muted font-medium whitespace-nowrap sm:hidden mr-1">Operators:</span>
              {['+', '-', '*', '/', '(', ')'].map((op) => (
                <button
                  key={op}
                  id={`${inputId}-op-${op}`}
                  type="button"
                  onClick={() => handleQuickAdd(op)}
                  className="min-w-8 h-8 px-2 flex items-center justify-center text-xs font-semibold rounded-lg bg-surface-2 hover:bg-surface-3 active:bg-surface-3 text-fg-secondary transition-control cursor-pointer border border-line hover:border-brand"
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
            <span className="text-[11px] text-fg-muted font-medium mr-1">Quick amount:</span>
            {[100, 500, 1000].map((amount) => (
              <button
                key={amount}
                id={`${inputId}-chip-${amount}`}
                type="button"
                onClick={() => handleQuickAmount(amount)}
                className="min-h-8 px-2.5 flex items-center justify-center text-xs font-semibold rounded-lg bg-brand-tint text-brand transition-control cursor-pointer border border-brand-line hover:border-brand active:border-brand"
              >
                +{amount.toLocaleString()}
              </button>
            ))}
          </div>
        )}
    </div>
  );
};
