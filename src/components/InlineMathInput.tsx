import React, { useState, useEffect, useId } from 'react';
import { Calculator, Check, AlertCircle, Sparkles } from 'lucide-react';
import { safeEvaluateMath } from '../utils/mathEvaluator';

export interface InlineMathInputProps {
  id?: string;
  name?: string;
  label?: string;
  placeholder?: string;
  currencyPrefix?: string;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  onAmountEvaluated: (amount: number | null, rawExpression: string, isValid: boolean) => void;
  className?: string;
}

export const InlineMathInput: React.FC<InlineMathInputProps> = ({
  id,
  name = 'amount_expression',
  label = 'Amount / Math Expression',
  placeholder = 'e.g. 500+500 or 1200*0.8',
  currencyPrefix = '$',
  defaultValue = '',
  disabled = false,
  required = false,
  autoFocus = false,
  onAmountEvaluated,
  className = '',
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  const [rawInput, setRawInput] = useState<string>(defaultValue);
  const [evaluatedAmount, setEvaluatedAmount] = useState<number | null>(null);
  const [formattedResult, setFormattedResult] = useState<string>('');
  const [hasCalculation, setHasCalculation] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  // Evaluate whenever raw input changes
  useEffect(() => {
    if (!rawInput.trim()) {
      setEvaluatedAmount(null);
      setFormattedResult('');
      setHasCalculation(false);
      setErrorMessage(null);
      onAmountEvaluated(null, '', false);
      return;
    }

    const isComplex = /[+\-*/%^()]/.test(rawInput);
    setHasCalculation(isComplex);

    const evalResult = safeEvaluateMath(rawInput);

    if (evalResult.isValid && evalResult.value !== null) {
      if (evalResult.value <= 0) {
        setEvaluatedAmount(null);
        setFormattedResult('');
        setErrorMessage('Amount must be greater than zero');
        onAmountEvaluated(null, rawInput, false);
      } else {
        setEvaluatedAmount(evalResult.value);
        setFormattedResult(evalResult.formattedValue);
        setErrorMessage(null);
        onAmountEvaluated(evalResult.value, rawInput, true);
      }
    } else {
      setEvaluatedAmount(null);
      setFormattedResult('');
      // Only show error message if user has typed something that isn't just a starting digit or dot
      if (rawInput.trim().length > 1 || !/^[0-9.]+$/.test(rawInput)) {
        setErrorMessage(evalResult.error || 'Invalid expression');
      } else {
        setErrorMessage(null);
      }
      onAmountEvaluated(null, rawInput, false);
    }
  }, [rawInput, onAmountEvaluated]);

  const handleApplyResult = () => {
    if (evaluatedAmount !== null && hasCalculation) {
      setRawInput(evaluatedAmount.toString());
    }
  };

  const handleQuickAdd = (operator: string) => {
    setRawInput((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return '';
      // Avoid duplicate consecutive operator characters
      if (/[+\-*/]$/.test(trimmed)) {
        return trimmed.slice(0, -1) + operator;
      }
      return trimmed + operator;
    });
  };

  return (
    <div id={`${inputId}-container`} className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wider text-stone-600">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          {hasCalculation && evaluatedAmount !== null && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              Calculated: {currencyPrefix}{formattedResult}
            </span>
          )}
        </div>
      )}

      {/* Main Input Control Container */}
      <div
        className={`relative flex items-center rounded-xl border bg-white px-3 py-2.5 transition-all shadow-xs ${
          errorMessage
            ? 'border-rose-400 ring-2 ring-rose-100'
            : isFocused
            ? 'border-stone-800 ring-2 ring-stone-200'
            : 'border-stone-200 hover:border-stone-300'
        } ${disabled ? 'opacity-60 bg-stone-50 cursor-not-allowed' : ''}`}
      >
        <span className="text-stone-400 font-medium text-base select-none mr-2">
          {currencyPrefix}
        </span>

        <input
          id={inputId}
          name={name}
          type="text"
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck="false"
          className="w-full text-base font-semibold text-stone-900 placeholder:text-stone-300 placeholder:font-normal focus:outline-none bg-transparent"
        />

        {/* Right Status / Action Preview */}
        <div className="flex items-center gap-1.5 ml-2">
          {hasCalculation && evaluatedAmount !== null ? (
            <button
              id={`${inputId}-apply-btn`}
              type="button"
              onClick={handleApplyResult}
              title="Click to replace expression with calculated sum"
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors border border-stone-200 cursor-pointer"
            >
              <Check className="w-3 h-3 text-emerald-600" />
              <span className="font-mono">{currencyPrefix}{formattedResult}</span>
            </button>
          ) : evaluatedAmount !== null ? (
            <div className="p-1 text-emerald-600">
              <Check className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-1 text-stone-400">
              <Calculator className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>

        {/* Quick math operator buttons & error reporting */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs px-1">
          {errorMessage ? (
            <p id={`${inputId}-error`} className="flex items-center gap-1.5 text-rose-600 font-medium py-0.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </p>
          ) : (
            <span className="text-stone-500 text-[11px] sm:text-xs">
              Supports inline arithmetic: <code className="bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded text-[11px] font-mono">+ - * / ()</code>
            </span>
          )}

          {/* Quick Operator Shortcuts with mobile-friendly touch targets */}
          {!disabled && (
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <span className="text-[11px] text-stone-400 font-medium sm:hidden mr-1">Quick operators:</span>
              {['+', '-', '*', '/', '(', ')'].map((op) => (
                <button
                  key={op}
                  id={`${inputId}-op-${op}`}
                  type="button"
                  onClick={() => handleQuickAdd(op)}
                  className="min-w-8 h-8 px-2 flex items-center justify-center text-xs font-semibold rounded-lg bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-700 transition-colors cursor-pointer border border-stone-200"
                >
                  {op}
                </button>
              ))}
            </div>
          )}
        </div>
    </div>
  );
};
