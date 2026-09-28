import React from 'react';

export type ChipSize = 'sm' | 'md';

interface ChipProps {
  /** The chip's text - a category name, or a system label such as "Debt repayment". */
  label: string;
  /** The item's own colour, shown only as the 7px dot. No colour, no dot. */
  color?: string;
  size?: ChipSize;
  className?: string;
}

const SIZE_CLASS: Record<ChipSize, string> = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-0.5 text-[11px]',
};

/**
 * Spec 4.7 (ADR 0029): a neutral pill - `adjust-bg` behind `chip-text` - with
 * the category's own colour on a 7px dot and nowhere else. It replaces
 * `CategoryChip`, which tinted the chip with the colour and wrote its text in
 * it, so a pale category could not be read and no token covered the contrast.
 * The text colour is now a token pair checked by `scripts/wcag-tokens.mjs`.
 */
export const Chip: React.FC<ChipProps> = ({ label, color, size = 'md', className = '' }) => {
  const classes = [
    'inline-flex items-center gap-1.5 max-w-full rounded-full bg-adjust-tint text-chip-text font-medium',
    SIZE_CLASS[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes}>
      {color && <span aria-hidden="true" className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: color }} />}
      <span className="truncate">{label}</span>
    </span>
  );
};
