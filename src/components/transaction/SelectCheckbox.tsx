import React, { useEffect, useRef } from 'react';
import { Check, Minus } from 'lucide-react';

interface SelectCheckboxProps {
  id: string;
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  ariaLabel?: string;
}

/**
 * Design spec 4.1, 5 (ADR 0109): accessible 44px checkbox control with a native
 * peer input and a drawn 16px box supporting checked and indeterminate states.
 */
export const SelectCheckbox: React.FC<SelectCheckboxProps> = ({
  id,
  checked,
  indeterminate,
  onChange,
  ariaLabel,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = Boolean(indeterminate);
    }
  }, [indeterminate]);

  return (
    <span className="relative w-11 h-11 inline-flex items-center justify-center shrink-0">
      <input
        ref={inputRef}
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={ariaLabel}
        className="peer absolute inset-0 opacity-0 cursor-pointer"
      />
      <span
        aria-hidden="true"
        className={`w-4 h-4 rounded-sm border flex items-center justify-center pointer-events-none transition-control peer-focus-visible:ring-2 peer-focus-visible:ring-focus ${
          indeterminate
            ? 'bg-brand-fill border-brand-fill'
            : 'border-line-input bg-surface-2 peer-checked:bg-brand-fill peer-checked:border-brand-fill'
        }`}
      >
        {indeterminate ? (
          <Minus className="w-3 h-3 text-white" />
        ) : checked ? (
          <Check className="w-3 h-3 text-white" />
        ) : null}
      </span>
    </span>
  );
};
