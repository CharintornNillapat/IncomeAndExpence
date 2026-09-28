import React from 'react';

export type IconButtonTone = 'neutral' | 'danger' | 'income';

interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'title' | 'children'> {
  /** The button's name. Required: it becomes both `aria-label` and `title`, since the icon alone names nothing (spec section 7). */
  label: string;
  /** The icon, already sized by the caller. */
  children: React.ReactNode;
  /** `danger` turns red on hover, for a destructive action; `income` green, for settling a debt. */
  tone?: IconButtonTone;
  /** A 1px control border, for an icon button that stands alone (the header's). */
  bordered?: boolean;
  /** React 19 passes `ref` as a prop; `OverflowMenu` uses it to return focus to its trigger. */
  ref?: React.Ref<HTMLButtonElement>;
}

const TONE_CLASS: Record<IconButtonTone, string> = {
  neutral: 'text-fg-muted hover:text-fg hover:bg-surface-3',
  danger: 'text-fg-muted hover:text-expense hover:bg-expense-tint',
  income: 'text-fg-muted hover:text-income hover:bg-income-tint',
};

/**
 * Spec section 4.5 (ADR 0029): an icon-only button. The spec draws it at
 * 40 x 40; it keeps DESIGN.md's 44px hit box instead. The name is never
 * `sr-only` text, which would put a second copy of it in the page's text for
 * `getByText` to find.
 */
export function IconButton({ label, children, tone = 'neutral', bordered = false, className = '', type = 'button', ...rest }: IconButtonProps) {
  const classes = [
    'inline-flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px] rounded-button transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
    TONE_CLASS[tone],
    bordered ? 'border border-line-control' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} aria-label={label} title={label} className={classes} {...rest}>
      {children}
    </button>
  );
}
