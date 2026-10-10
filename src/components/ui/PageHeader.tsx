import React from 'react';

interface PageHeaderProps {
  title: React.ReactNode;
  /** One line under the title (spec 4.2). */
  description?: React.ReactNode;
  /** The page's own actions, on the right. */
  actions?: React.ReactNode;
  /** The heading level. A page's title is its `h1`; `h2` is for a header inside a larger page. */
  as?: 'h1' | 'h2';
  className?: string;
}

/**
 * Spec 4.2 (ADR 0029): a page's title and one-line description on the left,
 * its actions on the right, and no card around it. Each view kept its heading
 * text when it moved here (the Playwright suite finds several headings by name).
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions, as: Heading = 'h1', className = '' }) => (
  <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${className}`.trim()}>
    <div className="min-w-0">
      <Heading className="text-xl font-bold text-fg">{title}</Heading>
      {description && <p className="text-sm text-fg-secondary mt-0.5">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </div>
);
