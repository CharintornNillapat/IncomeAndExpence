// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React, { useState } from 'react';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { Modal } from '../src/components/Modal';
import { OverflowMenu } from '../src/components/ui/OverflowMenu';

/**
 * Phase 67 (ADR 0043, spec section 10 item 12): a dialog takes focus when it
 * opens and keeps Tab inside itself until it closes. jsdom has no layout and
 * no default Tab action, so these pin the parts `Modal` decides: where focus
 * lands on open, the wrap at either end, what counts as reachable, and which
 * dialog answers when one opens over another. Moving between two controls in
 * the middle is the browser's own Tab, covered by the E2E check.
 */
afterEach(() => cleanup());

const active = () => document.activeElement as HTMLElement;
const tab = (shift = false) => fireEvent.keyDown(active(), { key: 'Tab', shiftKey: shift });
const escape = () => fireEvent.keyDown(active(), { key: 'Escape' });

function Opener({ children, ...modal }: Omit<React.ComponentProps<typeof Modal>, 'isOpen' | 'onClose' | 'children'> & { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <button type="button">Behind the scrim</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} {...modal}>
        {children}
      </Modal>
      <output data-testid="state">{open ? 'open' : 'closed'}</output>
    </div>
  );
}

function openWithKeyboard() {
  const opener = screen.getByRole('button', { name: 'Open dialog' });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

describe('Modal focus on open', () => {
  it('moves focus to the first control in the dialog', () => {
    render(
      <Opener title="Details">
        <input aria-label="Name" />
      </Opener>,
    );
    openWithKeyboard();
    expect(active()).toBe(screen.getByRole('button', { name: 'Close modal' }));
    expect(active().closest('[role="dialog"]')).not.toBeNull();
  });

  it('leaves focus on a field that focused itself', () => {
    render(
      <Opener title="Details">
        <input aria-label="Name" />
        <input aria-label="Amount" autoFocus />
      </Opener>,
    );
    openWithKeyboard();
    expect(active()).toBe(screen.getByLabelText('Amount'));
  });

  it('focuses the dialog itself when it holds no control, and keeps Tab there', () => {
    render(
      <Opener showCloseButton={false} showMobileHandle={false} ariaLabel="Notice">
        <p>Nothing to press here.</p>
      </Opener>,
    );
    openWithKeyboard();
    const dialog = screen.getByRole('dialog', { name: 'Notice' });
    expect(active()).toBe(dialog);
    tab();
    expect(active()).toBe(dialog);
    tab(true);
    expect(active()).toBe(dialog);
  });
});

describe('Modal Tab trap', () => {
  function setup() {
    render(
      <Opener title="Details">
        <input aria-label="Name" />
        <button type="button" disabled>
          Disabled action
        </button>
        <input aria-label="Picker" tabIndex={-1} style={{ width: 1, height: 1 }} />
        <button type="button">Save</button>
        <div style={{ display: 'none' }}>
          <button type="button">Inside display none</button>
        </div>
        <button type="button" hidden>
          Hidden attribute
        </button>
        <button type="button" style={{ visibility: 'hidden' }}>
          Invisible
        </button>
        <input type="hidden" name="token" value="x" />
      </Opener>,
    );
    openWithKeyboard();
    return {
      close: screen.getByRole('button', { name: 'Close modal' }),
      save: screen.getByRole('button', { name: 'Save' }),
    };
  }

  it('wraps from the last control to the first, skipping disabled and hidden ones', () => {
    const { close, save } = setup();
    save.focus();
    tab();
    expect(active()).toBe(close);
  });

  it('wraps from the first control to the last with Shift+Tab', () => {
    const { close, save } = setup();
    expect(active()).toBe(close);
    tab(true);
    expect(active()).toBe(save);
  });

  // Each one alone after the last real control, so the wrap can only land on
  // Save if that one kind is skipped. The picker is the diary page's 1x1 date
  // input pattern.
  const unreachable: Array<[string, React.ReactNode]> = [
    ['a disabled button', <button type="button" disabled>Disabled action</button>],
    ['a tabIndex -1 field', <input aria-label="Picker" tabIndex={-1} style={{ width: 1, height: 1 }} />],
    ['a control inside display none', <div style={{ display: 'none' }}><button type="button">Inside</button></div>],
    ['a control with the hidden attribute', <button type="button" hidden>Hidden</button>],
    ['a control with visibility hidden', <button type="button" style={{ visibility: 'hidden' }}>Invisible</button>],
    ['a hidden input', <input type="hidden" name="token" value="x" />],
    ['a disabled field', <input aria-label="Locked" disabled />],
  ];
  for (const [kind, node] of unreachable) {
    it(`skips ${kind}`, () => {
      render(
        <Opener title="Details">
          <button type="button">Save</button>
          {node}
        </Opener>,
      );
      openWithKeyboard();
      tab(true);
      expect(active()).toBe(screen.getByRole('button', { name: 'Save' }));
      tab();
      expect(active()).toBe(screen.getByRole('button', { name: 'Close modal' }));
    });
  }

  it('leaves Tab between two middle controls to the browser', () => {
    setup();
    const name = screen.getByLabelText('Name');
    name.focus();
    const notCancelled = fireEvent.keyDown(name, { key: 'Tab' });
    expect(notCancelled).toBe(true);
    expect(active()).toBe(name);
  });

  it('brings focus that left the dialog back in', () => {
    const { close, save } = setup();
    screen.getByRole('button', { name: 'Behind the scrim' }).focus();
    tab();
    expect(active()).toBe(close);
    screen.getByRole('button', { name: 'Behind the scrim' }).focus();
    tab(true);
    expect(active()).toBe(save);
  });

  it('counts a control that appears after the dialog opened', () => {
    function Growing() {
      const [more, setMore] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setMore(true)}>
            Show more
          </button>
          {more && <input aria-label="Late field" />}
        </>
      );
    }
    render(
      <Opener title="Details">
        <Growing />
      </Opener>,
    );
    openWithKeyboard();
    const showMore = screen.getByRole('button', { name: 'Show more' });
    fireEvent.click(showMore);
    showMore.focus();
    expect(fireEvent.keyDown(showMore, { key: 'Tab' })).toBe(true);
    screen.getByLabelText('Late field').focus();
    tab();
    expect(active()).toBe(screen.getByRole('button', { name: 'Close modal' }));
  });
});

describe('Modal close', () => {
  it('closes on Escape and gives focus back to the opener', () => {
    render(
      <Opener title="Details">
        <input aria-label="Name" />
      </Opener>,
    );
    const opener = openWithKeyboard();
    screen.getByLabelText('Name').focus();
    escape();
    expect(screen.getByTestId('state').textContent).toBe('closed');
    expect(active()).toBe(opener);
  });

  it('keeps an overflow menu\'s Escape to the menu, and wraps past a menu at the end', () => {
    render(
      <Opener title="Wallet">
        <OverflowMenu label="More actions" items={[{ id: 'archive', label: 'Archive', onSelect: () => {} }]} />
      </Opener>,
    );
    openWithKeyboard();
    const trigger = screen.getByRole('button', { name: 'More actions' });
    fireEvent.click(trigger);
    expect(active()).toBe(screen.getByRole('menuitem', { name: 'Archive' }));
    escape();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(active()).toBe(trigger);
    expect(screen.getByTestId('state').textContent).toBe('open');

    // The menu item is the last thing in the dialog and is not a Tab stop.
    fireEvent.click(trigger);
    tab();
    expect(active()).toBe(screen.getByRole('button', { name: 'Close modal' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

// A ConfirmDialog opens over the Wallets and Categories sheets as a sibling,
// and inside AccountModal as a child. Only the top dialog traps and closes.
describe('Modal over another Modal', () => {
  function Nested({ asChild }: { asChild: boolean }) {
    const [outer, setOuter] = useState(false);
    const [inner, setInner] = useState(false);
    const innerDialog = (
      <Modal isOpen={inner} onClose={() => setInner(false)} title="Confirm">
        <button type="button">Confirm delete</button>
      </Modal>
    );
    return (
      <div>
        <button type="button" onClick={() => setOuter(true)}>
          Open sheet
        </button>
        <Modal isOpen={outer} onClose={() => setOuter(false)} title="Sheet">
          <button type="button" onClick={() => setInner(true)}>
            Delete wallet
          </button>
          {asChild && innerDialog}
        </Modal>
        {!asChild && innerDialog}
        <output data-testid="outer">{outer ? 'open' : 'closed'}</output>
        <output data-testid="inner">{inner ? 'open' : 'closed'}</output>
      </div>
    );
  }

  for (const asChild of [false, true]) {
    it(`traps and closes only the top dialog (${asChild ? 'inside' : 'beside'} the sheet)`, () => {
      render(<Nested asChild={asChild} />);
      const openSheet = screen.getByRole('button', { name: 'Open sheet' });
      openSheet.focus();
      fireEvent.click(openSheet);
      const del = screen.getByRole('button', { name: 'Delete wallet' });
      del.focus();
      fireEvent.click(del);

      const confirmDialog = screen.getByRole('dialog', { name: 'Confirm' });
      const confirmClose = confirmDialog.querySelector('button') as HTMLElement;
      const confirmBtn = screen.getByRole('button', { name: 'Confirm delete' });
      expect(active()).toBe(confirmClose);
      tab(true);
      expect(active()).toBe(confirmBtn);
      tab();
      expect(active()).toBe(confirmClose);

      escape();
      expect(screen.getByTestId('inner').textContent).toBe('closed');
      expect(screen.getByTestId('outer').textContent).toBe('open');
      expect(active()).toBe(del);

      // The sheet traps again once it is on top, past the closing dialog's
      // controls, which stay in the DOM through its exit tween.
      tab();
      expect(active().getAttribute('aria-label')).toBe('Close modal');
      expect(active().closest('[role="dialog"]')).toBe(screen.getByRole('dialog', { name: 'Sheet' }));

      escape();
      expect(screen.getByTestId('outer').textContent).toBe('closed');
      expect(active()).toBe(openSheet);
    });
  }
});
