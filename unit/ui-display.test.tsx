// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { Chip } from '../src/components/ui/Chip';
import { ProgressBar } from '../src/components/ui/ProgressBar';
import { AllocationBar } from '../src/components/ui/AllocationBar';
import { WarningBanner } from '../src/components/ui/WarningBanner';
import { PageHeader } from '../src/components/ui/PageHeader';
import { Card, Inset } from '../src/components/ui/Card';

/**
 * Phase 56 (ADR 0029, spec sections 4.2, 4.3, 4.7 and 4.11 to 4.13): the
 * shared display pieces. Pinned: where colour is allowed to go, what a bar
 * clamps and announces, and the roles a screen reader meets.
 */
afterEach(() => cleanup());

describe('Chip', () => {
  it('keeps the item colour on the dot, never the chip', () => {
    const { container } = render(<Chip label="Food & Dining" color="#E879A6" />);
    const chip = container.firstElementChild as HTMLElement;
    expect(chip.getAttribute('style')).toBeNull();
    expect(chip.className).toContain('bg-adjust-tint');
    expect(chip.className).toContain('text-chip-text');
    const dot = chip.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(dot.style.backgroundColor).toBe('rgb(232, 121, 166)');
    expect(chip.textContent).toBe('Food & Dining');
  });

  it('has no dot without a colour', () => {
    const { container } = render(<Chip label="Debt repayment" />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});

describe('ProgressBar', () => {
  const bar = () => screen.getByRole('progressbar');
  const fill = () => bar().firstElementChild as HTMLElement;

  it('clamps above 100 and below 0, and treats a non-number as 0', () => {
    render(<ProgressBar percent={150} label="Paid" />);
    expect(bar().getAttribute('aria-valuenow')).toBe('100');
    expect(fill().style.width).toBe('100%');
    cleanup();
    render(<ProgressBar percent={-5} />);
    expect(fill().style.width).toBe('0%');
    cleanup();
    render(<ProgressBar percent={Number.NaN} />);
    expect(fill().style.width).toBe('0%');
  });

  it('announces its value and name', () => {
    render(<ProgressBar percent={20.04} label="Repayment progress" />);
    expect(screen.getByRole('progressbar', { name: 'Repayment progress' }).getAttribute('aria-valuenow')).toBe('20');
  });

  it('draws the track in the border token and fills by tone, or by a raw colour when given', () => {
    render(<ProgressBar percent={50} tone="expense" />);
    expect(bar().className).toContain('bg-line');
    expect(fill().className).toContain('bg-expense-fill');
    cleanup();
    render(<ProgressBar percent={50} color="#4FB7A8" />);
    expect(fill().style.backgroundColor).toBe('rgb(79, 183, 168)');
    expect(fill().className).not.toContain('bg-income-fill');
  });
});

describe('AllocationBar', () => {
  const segments = [
    { id: 'cash', label: 'Cash', value: 500, color: '#D9A066' },
    { id: 'main', label: 'Main', value: 1500, color: '#6C8EEF' },
    { id: 'card', label: 'Card', value: -200, color: '#E879A6' },
  ];

  it('gives each positive wallet a share of one bar, in its own colour', () => {
    const { container } = render(<AllocationBar segments={segments} label="Wallet allocation" />);
    const parts = Array.from(container.querySelectorAll('[data-segment]')) as HTMLElement[];
    expect(parts.map((p) => p.dataset.segment)).toEqual(['cash', 'main']);
    expect(parts.map((p) => p.style.flexGrow)).toEqual(['500', '1500']);
    expect(parts[0].style.backgroundColor).toBe('rgb(217, 160, 102)');
  });

  it('names every share for a screen reader, leaving out a wallet in debt', () => {
    render(<AllocationBar segments={segments} label="Wallet allocation" />);
    expect(screen.getByRole('img', { name: 'Wallet allocation: Cash 25.0%, Main 75.0%' })).toBeTruthy();
  });

  it('draws an empty track when nothing is positive', () => {
    const { container } = render(<AllocationBar segments={[{ id: 'a', label: 'A', value: 0, color: '#fff' }]} label="Wallet allocation" />);
    expect(container.querySelectorAll('[data-segment]')).toHaveLength(0);
    expect(screen.getByRole('img', { name: 'Wallet allocation: nothing to show' })).toBeTruthy();
  });
});

describe('WarningBanner', () => {
  it('is a note with its message and an optional action', () => {
    const onClick = vi.fn();
    render(
      <WarningBanner id="debt-warning" data-testid="debt-warning" action={{ label: 'Review debts', onClick }}>
        Needed per month is ฿4,913.64
      </WarningBanner>,
    );
    const note = screen.getByRole('note');
    expect(note.id).toBe('debt-warning');
    expect(note.getAttribute('data-testid')).toBe('debt-warning');
    expect(note.textContent).toContain('Needed per month is ฿4,913.64');
    fireEvent.click(screen.getByRole('button', { name: 'Review debts' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has no button without an action', () => {
    render(<WarningBanner>Heads up</WarningBanner>);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('PageHeader', () => {
  it('is an h1 with its description and actions, and no card around it', () => {
    const { container } = render(
      <PageHeader title="Wallets" description="฿12,000.00 across 3 wallets" actions={<button type="button">Add wallet</button>} />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Wallets' })).toBeTruthy();
    expect(screen.getByText('฿12,000.00 across 3 wallets')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add wallet' })).toBeTruthy();
    expect(container.querySelector('.bg-surface-1')).toBeNull();
  });

  it('can render a lower heading level', () => {
    render(<PageHeader title="Transactions" as="h2" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Transactions' })).toBeTruthy();
  });
});

describe('Card and Inset', () => {
  it('uses the card radius and the spec padding, with a neutral border', () => {
    const { container } = render(<Card>Body</Card>);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('rounded-card');
    expect(card.className).toContain('p-6');
    expect(card.className).toContain('border-line');
  });

  it('puts an inner box on the inset surface at the inner radius', () => {
    const { container } = render(<Inset className="p-3">Figure</Inset>);
    const inset = container.firstElementChild as HTMLElement;
    expect(inset.className).toContain('bg-surface-2');
    expect(inset.className).toContain('rounded-inner');
  });
});
