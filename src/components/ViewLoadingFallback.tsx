import React from 'react';
import type { ActiveTab } from './Navbar';

/** One skeleton row: its blocks' heights, laid out in `columns` columns from `sm` up. */
interface SkeletonRow {
  heights: string[];
  columns?: string;
}

const HEADER: SkeletonRow = { heights: ['h-20'] };

/**
 * A static outline of each view, drawn while its `React.lazy` chunk loads
 * (DESIGN.md §4: one skeleton per region, shaped like what it replaces, no
 * pulse or shimmer). Before Phase 53b this was one pulsing square, a spinning
 * ring and three bouncing dots over the words "Loading Module", whatever the
 * view.
 */
const SHAPES: Record<ActiveTab, SkeletonRow[]> = {
  dashboard: [
    { heights: ['h-40'] },
    { heights: ['h-36', 'h-36', 'h-36'], columns: 'sm:grid-cols-3' },
    HEADER,
    { heights: ['h-32', 'h-32', 'h-32'], columns: 'md:grid-cols-3' },
  ],
  transactions: [HEADER, { heights: ['h-12'] }, { heights: ['h-12', 'h-12', 'h-12', 'h-12', 'h-12', 'h-12'] }],
  wallets: [HEADER, { heights: ['h-48', 'h-48', 'h-48'], columns: 'sm:grid-cols-2 lg:grid-cols-3' }],
  debts: [
    HEADER,
    { heights: ['h-24', 'h-24', 'h-24'], columns: 'sm:grid-cols-3' },
    { heights: ['h-40', 'h-40'], columns: 'md:grid-cols-2' },
  ],
  diary: [HEADER, { heights: ['h-64'] }, { heights: ['h-24', 'h-24', 'h-24'] }],
  categories: [HEADER, { heights: ['h-48'] }, { heights: ['h-16', 'h-16', 'h-16', 'h-16'], columns: 'sm:grid-cols-2' }],
};

const LABEL: Record<ActiveTab, string> = {
  dashboard: 'dashboard',
  transactions: 'transactions',
  wallets: 'wallets',
  debts: 'debts',
  diary: 'diary',
  categories: 'categories',
};

interface ViewLoadingFallbackProps {
  view: ActiveTab;
}

export const ViewLoadingFallback: React.FC<ViewLoadingFallbackProps> = ({ view }) => {
  return (
    <div id="view-loading-fallback" role="status" aria-busy="true" className="w-full space-y-6">
      <span className="sr-only">Loading {LABEL[view]}</span>
      {SHAPES[view].map((row, rowIndex) => (
        <div key={rowIndex} aria-hidden="true" className={`grid grid-cols-1 gap-4 ${row.columns ?? ''}`.trim()}>
          {row.heights.map((height, blockIndex) => (
            <div key={blockIndex} className={`${height} rounded-xl bg-surface-2 border border-line`} />
          ))}
        </div>
      ))}
    </div>
  );
};
