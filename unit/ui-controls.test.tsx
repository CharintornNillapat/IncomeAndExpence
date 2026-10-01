// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { Button, buttonClass } from '../src/components/ui/Button';
import { IconButton } from '../src/components/ui/IconButton';
import { SegmentedControl } from '../src/components/ui/SegmentedControl';
import { OverflowMenu } from '../src/components/ui/OverflowMenu';

/**
 * Phase 56 (ADR 0029, spec sections 4.4 to 4.6 and 7): the shared controls.
 * What is pinned here is what the Playwright suite and a keyboard user depend
 * on, not the class strings: a button's type, its native disabled state, an
 * icon button's name, and a segmented control's selected state in ARIA.
 */
afterEach(() => cleanup());

describe('Button', () => {
  it('is type="button" unless told otherwise, so it never submits a form by accident', () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button>Plain</Button>
      </form>,
    );
    const button = screen.getByRole('button', { name: 'Plain' });
    expect(button.getAttribute('type')).toBe('button');
    fireEvent.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('passes type="submit" through, which the E2E suite locates submit buttons by', () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const { container } = render(
      <form onSubmit={onSubmit}>
        <Button type="submit">Save</Button>
      </form>,
    );
    const submit = container.querySelector('button[type="submit"]');
    expect(submit).not.toBeNull();
    fireEvent.click(submit!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('uses the native disabled attribute', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Wait</Button>);
    const button = screen.getByRole('button', { name: 'Wait' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps a caller id and renders the icon before the label', () => {
    render(<Button id="save-btn" icon={<svg data-testid="icon" />}>Save</Button>);
    const button = document.getElementById('save-btn')!;
    expect(button.firstElementChild?.getAttribute('data-testid')).toBe('icon');
    expect(button.textContent).toBe('Save');
  });

  it('gives each variant its own look and every size the 44px hit box', () => {
    expect(buttonClass({ variant: 'primary' })).toContain('bg-brand-fill');
    expect(buttonClass({ variant: 'secondary' })).toContain('border-line-control');
    expect(buttonClass({ variant: 'soft' })).toContain('bg-brand-soft');
    expect(buttonClass({ variant: 'danger' })).toContain('text-expense');
    for (const size of ['md', 'lg', 'header'] as const) {
      expect(buttonClass({ size })).toContain('min-h-[44px]');
    }
    expect(buttonClass({ block: true })).toContain('w-full');
    expect(buttonClass()).not.toContain('w-full');
  });
});

describe('IconButton', () => {
  it('names itself with the label, as aria-label and title', () => {
    render(
      <IconButton label="Clear search">
        <svg />
      </IconButton>,
    );
    const button = screen.getByRole('button', { name: 'Clear search' });
    expect(button.getAttribute('title')).toBe('Clear search');
    expect(button.getAttribute('type')).toBe('button');
  });

  it('puts no copy of the name in the page text', () => {
    const { container } = render(
      <IconButton label="Delete entry">
        <svg />
      </IconButton>,
    );
    expect(container.textContent).toBe('');
  });

  it('keeps the 44px hit box', () => {
    render(
      <IconButton label="Close">
        <svg />
      </IconButton>,
    );
    const className = screen.getByRole('button', { name: 'Close' }).className;
    expect(className).toContain('min-h-[44px]');
    expect(className).toContain('min-w-[44px]');
  });

  it('refuses to compile without a label', () => {
    // @ts-expect-error - `label` is required: an icon alone names nothing.
    const element = <IconButton><svg /></IconButton>;
    expect(element).toBeTruthy();
  });
});

describe('SegmentedControl', () => {
  const options = [
    { value: 'DAY', label: 'Today', id: 'time-filter-day' },
    { value: 'WEEK', label: 'This week', id: 'time-filter-week' },
  ] as const;

  it('marks the selected option with aria-pressed and keeps each option id', () => {
    render(<SegmentedControl options={[...options]} value="WEEK" onChange={() => {}} ariaLabel="Period" />);
    expect(screen.getByRole('group', { name: 'Period' })).toBeTruthy();
    expect(document.getElementById('time-filter-day')!.getAttribute('aria-pressed')).toBe('false');
    expect(document.getElementById('time-filter-week')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('as tabs, is a tablist whose tabs carry aria-selected instead', () => {
    render(<SegmentedControl options={[...options]} value="DAY" onChange={() => {}} mode="tabs" ariaLabel="Section" />);
    expect(screen.getByRole('tablist', { name: 'Section' })).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map(t => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(tabs[0].hasAttribute('aria-pressed')).toBe(false);
  });

  it('reports the chosen value, and each option is a plain button', () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={[...options]} value="DAY" onChange={onChange} />);
    const week = document.getElementById('time-filter-week')!;
    expect(week.tagName).toBe('BUTTON');
    expect(week.getAttribute('type')).toBe('button');
    fireEvent.click(week);
    expect(onChange).toHaveBeenCalledWith('WEEK');
  });
});

describe('OverflowMenu', () => {
  const setup = () => {
    const onArchive = vi.fn();
    const onDelete = vi.fn();
    render(
      <div>
        <OverflowMenu
          label="More actions for Cash"
          items={[
            { id: 'archive-wallet-cash', label: 'Archive wallet', onSelect: onArchive },
            { id: 'delete-wallet-cash', label: 'Delete wallet…', onSelect: onDelete, tone: 'danger' },
          ]}
        />
        <p>Outside</p>
      </div>,
    );
    const trigger = screen.getByRole('button', { name: 'More actions for Cash' });
    return { trigger, onArchive, onDelete };
  };

  // Phase 58a (ADR 0031): the Transactions page's "Import / export" menu.
  it('can draw its trigger as a text button with its own id, and returns focus to it', () => {
    const onImport = vi.fn();
    render(
      <OverflowMenu
        label="Import or export transactions"
        triggerLabel="Import / export"
        triggerId="tx-import-export-btn"
        items={[{ id: 'tx-import-csv-btn', label: 'Import CSV', onSelect: onImport }]}
      />,
    );
    const trigger = document.getElementById('tx-import-export-btn')!;
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.textContent).toBe('Import / export');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    fireEvent.click(trigger);
    expect(screen.getByRole('menu').getAttribute('aria-label')).toBe('Import or export transactions');
    fireEvent.keyDown(document.getElementById('tx-import-csv-btn')!, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('starts closed, as a named menu button', () => {
    const { trigger } = setup();
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens on click with its items, keeps their ids and focuses the first', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.id)).toEqual(['archive-wallet-cash', 'delete-wallet-cash']);
    expect(items.every((i) => i.tagName === 'BUTTON')).toBe(true);
    expect(document.activeElement).toBe(items[0]);
    expect(items[1].className).toContain('text-expense');
  });

  it('moves with the arrow keys, wrapping at both ends', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    const items = screen.getAllByRole('menuitem');
    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[1]);
  });

  it('opens from the keyboard with ArrowDown on the trigger', () => {
    const { trigger } = setup();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getAllByRole('menuitem')[0]);
  });

  it('closes on Escape and gives focus back to the trigger', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getAllByRole('menuitem')[0], { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  // Phase 59 (audit 008): the menu sits inside the Wallets page's bottom sheet,
  // whose `Modal` closes on any Escape that reaches `document`.
  it('keeps its Escape to itself, so a dialog around it stays open', () => {
    const onDocumentEscape = vi.fn();
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDocumentEscape();
    };
    document.addEventListener('keydown', listener);
    try {
      const { trigger } = setup();
      fireEvent.click(trigger);
      fireEvent.keyDown(screen.getAllByRole('menuitem')[0], { key: 'Escape' });
      expect(screen.queryByRole('menu')).toBeNull();
      expect(document.activeElement).toBe(trigger);
      expect(onDocumentEscape).not.toHaveBeenCalled();

      // A second Escape, from the closed trigger, is the dialog's again.
      fireEvent.keyDown(trigger, { key: 'Escape' });
      expect(onDocumentEscape).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener('keydown', listener);
    }
  });

  it('runs the chosen item once and closes', () => {
    const { trigger, onDelete, onArchive } = setup();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete wallet…' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onArchive).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on a press outside it', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.mouseDown(screen.getByText('Outside'));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
