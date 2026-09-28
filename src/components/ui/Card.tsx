import React from 'react';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: CardPadding;
  /** Adds the hover-elevate border treatment several card shells already use, without forcing a click handler. */
  interactive?: boolean;
}

// Spec 4.3: a card's padding is 24 to 28px (`md`, `lg`); `sm` is the compact mobile shell.
const PADDING_CLASS: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3.5 sm:p-4',
  md: 'p-6',
  lg: 'p-7',
};

/**
 * T44: the card shell repeated across the app's view containers -
 * `rounded-xl`, a 1px `border-line`, and the Surface 1 background (DESIGN.md: no card shadows).
 * Adopted only where an existing shell already matches this shape losslessly;
 * a shell with stepped responsive padding (e.g. `p-4 sm:p-5`), a non-white
 * background, a conditional per-state className, or its own framer-motion
 * hover/tap animation is a genuinely different shape and was left local - see
 * `docs/audit/refactor-log.md` Phase 25 for the audited list of each.
 *
 * Phase 56 (spec 4.3, ADR 0029): the spec's 16px card radius (`rounded-card`)
 * and 24 to 28px padding. The border stays neutral: a card never takes a
 * green, red or violet edge (spec section 3).
 */
export const Card: React.FC<CardProps> = ({ children, className = '', padding = 'md', interactive = false }) => {
  const classes = [
    'bg-surface-1 rounded-card border border-line',
    PADDING_CLASS[padding],
    interactive ? 'hover:border-brand transition-colors duration-150' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={classes}>{children}</div>;
};

interface InsetProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Spec 4.3: a box inside a card - the inset surface (`--bg-inset`) at the
 * inner radius. Padding is the caller's, since inner boxes range from a
 * one-line figure to a form.
 */
export const Inset: React.FC<InsetProps> = ({ children, className = '' }) => (
  <div className={`bg-surface-2 rounded-inner ${className}`.trim()}>{children}</div>
);
