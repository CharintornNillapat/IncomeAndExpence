import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'danger';
/** `md` is an in-card or toolbar action, `lg` a full form submit that grows a little from `sm`, `header` the app header's larger label. */
export type ButtonSize = 'md' | 'lg' | 'header';

export interface ButtonClassOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width of its container, as a form's submit button is. */
  block?: boolean;
  className?: string;
}

/*
 * Spec section 4.4 (ADR 0029). Every size keeps the 44px hit box DESIGN.md
 * requires, including the header, where the spec draws 40px. Focus comes from
 * the global `:focus-visible` rule in index.css, so no variant carries its own.
 */
const BASE =
  'inline-flex items-center justify-center gap-2 min-h-[44px] rounded-button font-semibold transition-control duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

const SIZE_CLASS: Record<ButtonSize, string> = {
  md: 'px-3.5 py-2 text-xs',
  lg: 'px-4 py-2.5 sm:py-3 text-xs',
  header: 'px-3 sm:px-4 text-sm',
};

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-fill hover:bg-brand-fill-hover text-white',
  secondary: 'bg-transparent border border-line-control text-fg-secondary hover:text-fg hover:bg-surface-3',
  soft: 'bg-brand-soft border border-brand-soft-line text-brand-soft-text hover:border-brand',
  danger: 'bg-transparent border border-danger-line text-expense hover:bg-expense-tint',
};

/** The button look as a class string, for an element that is not a `<button>` (a file-input label, a link). */
export function buttonClass({ variant = 'primary', size = 'md', block = false, className = '' }: ButtonClassOptions = {}): string {
  return [BASE, SIZE_CLASS[size], VARIANT_CLASS[variant], block ? 'w-full' : '', className].filter(Boolean).join(' ');
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, Omit<ButtonClassOptions, 'className'> {
  /** An icon before the label. */
  icon?: React.ReactNode;
}

/**
 * The one button of spec section 4.4: primary, secondary, soft or danger.
 *
 * `type` defaults to `"button"`, so a Button inside a form never submits it by
 * accident; a submit passes `type="submit"` explicitly, which is also what the
 * Playwright suite locates forms' submit buttons by. `disabled` is the native
 * attribute.
 */
export function Button({ variant, size, block, icon, className, type = 'button', children, ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass({ variant, size, block, className })} {...rest}>
      {icon}
      {children}
    </button>
  );
}
