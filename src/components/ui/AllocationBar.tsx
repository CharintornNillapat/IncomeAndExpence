import React from 'react';

export interface AllocationSegment {
  id: string;
  label: string;
  /** The item's amount. Only a positive value takes a share: a credit card in debt has none to give. */
  value: number;
  /** The item's own identity colour (spec section 1). */
  color: string;
}

interface AllocationBarProps {
  segments: AllocationSegment[];
  /** Names the bar; the shares are appended for assistive technology. */
  label: string;
  /**
   * A line of text under the bar when no segment has a positive value, so an
   * empty track is never the only thing on screen (audit 013 finding 6, ADR
   * 0042). Omitted, an empty bar renders alone, as before.
   */
  emptyCaption?: string;
  className?: string;
}

/**
 * Spec 4.12 (ADR 0029): one bar split by share, 3px between parts, each in
 * its item's own colour. It replaces the per-wallet "Share of Total" bars in
 * the page redesign.
 *
 * Widths come from `flex-grow` set to each value, so the parts always fill the
 * bar exactly, gaps included, with no rounding to reconcile. The bar is an
 * image to assistive technology, and its name lists every share, so the
 * colours never carry the meaning alone (spec section 7).
 */
export const AllocationBar: React.FC<AllocationBarProps> = ({ segments, label, emptyCaption, className = '' }) => {
  const parts = segments.filter((s) => s.value > 0);
  const total = parts.reduce((sum, s) => sum + s.value, 0);
  const description =
    total > 0 ? parts.map((s) => `${s.label} ${((s.value / total) * 100).toFixed(1)}%`).join(', ') : 'nothing to show';

  const bar = (
    <div role="img" aria-label={`${label}: ${description}`} className={`flex gap-[3px] h-2.5 w-full rounded-full overflow-hidden bg-line ${className}`.trim()}>
      {parts.map((s) => (
        <div
          key={s.id}
          data-segment={s.id}
          className="h-full min-w-[3px]"
          style={{ flexGrow: s.value, flexBasis: 0, backgroundColor: s.color }}
        />
      ))}
    </div>
  );

  if (total > 0 || !emptyCaption) return bar;

  // The Cash flow card's empty-bar caption is the precedent: same size and token.
  return (
    <div className="flex flex-col gap-2">
      {bar}
      <p className="text-xs text-fg-muted">{emptyCaption}</p>
    </div>
  );
};
