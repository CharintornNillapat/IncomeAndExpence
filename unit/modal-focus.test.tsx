// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
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

// Phase 71 (ADR 0047): while a dialog is open everything outside it is inert,
// so a screen reader's virtual cursor cannot leave it. jsdom stores the
// attribute but does not apply it, so these tests make focus() refuse an
// inert element, as a browser does: that is what makes the order of the
// cleanup (release the background, then give focus back) testable.
describe('Modal background is inert while a dialog is open', () => {
  const realFocus = HTMLElement.prototype.focus;
  beforeEach(() => {
    HTMLElement.prototype.focus = function focus(this: HTMLElement, options?: FocusOptions) {
      if (this.closest('[inert]')) return;
      realFocus.call(this, options);
    };
  });
  afterEach(() => {
    HTMLElement.prototype.focus = realFocus;
  });

  const isInert = (el: Element) => el.closest('[inert]') !== null;
  const inertCount = () => document.querySelectorAll('[inert]').length;

  it('marks everything outside the dialog, never the dialog, and clears it on close', () => {
    render(
      <Opener title="Details">
        <input aria-label="Name" />
      </Opener>,
    );
    expect(inertCount()).toBe(0);
    const opener = openWithKeyboard();
    const dialog = screen.getByRole('dialog', { name: 'Details' });

    expect(isInert(opener)).toBe(true);
    expect(isInert(screen.getByRole('button', { name: 'Behind the scrim' }))).toBe(true);
    expect(isInert(screen.getByTestId('state'))).toBe(true);
    expect(isInert(dialog)).toBe(false);
    expect(isInert(screen.getByLabelText('Name'))).toBe(false);
    expect(active()).toBe(screen.getByRole('button', { name: 'Close modal' }));

    escape();
    expect(inertCount()).toBe(0);
    expect(active()).toBe(opener);
  });

  it('leaves an element that was already inert as it was', () => {
    render(
      <div>
        <section inert data-testid="frozen">
          <button type="button">Frozen</button>
        </section>
        <Opener title="Details">
          <input aria-label="Name" />
        </Opener>
      </div>,
    );
    const frozen = screen.getByTestId('frozen');
    openWithKeyboard();
    escape();
    expect(frozen.hasAttribute('inert')).toBe(true);
    expect(inertCount()).toBe(1);
  });

  for (const asChild of [false, true]) {
    it(`makes the sheet inert under a confirmation ${asChild ? 'inside' : 'beside'} it, and gives it back`, () => {
      function Nested() {
        const [outer, setOuter] = useState(false);
        const [inner, setInner] = useState(false);
        const confirm = (
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
              {asChild && confirm}
            </Modal>
            {!asChild && confirm}
          </div>
        );
      }
      render(<Nested />);
      const openSheet = screen.getByRole('button', { name: 'Open sheet' });
      openSheet.focus();
      fireEvent.click(openSheet);
      const sheet = screen.getByRole('dialog', { name: 'Sheet' });
      const del = screen.getByRole('button', { name: 'Delete wallet' });
      expect(isInert(openSheet)).toBe(true);
      expect(isInert(del)).toBe(false);

      del.focus();
      fireEvent.click(del);
      const confirmDialog = screen.getByRole('dialog', { name: 'Confirm' });
      expect(isInert(confirmDialog)).toBe(false);
      expect(isInert(screen.getByRole('button', { name: 'Confirm delete' }))).toBe(false);
      expect(isInert(del)).toBe(true);
      expect(isInert(openSheet)).toBe(true);
      if (!asChild) expect(isInert(sheet)).toBe(true);

      escape();
      expect(isInert(del)).toBe(false);
      expect(isInert(sheet)).toBe(false);
      expect(isInert(openSheet)).toBe(true);
      expect(active()).toBe(del);

      escape();
      expect(inertCount()).toBe(0);
      expect(active()).toBe(openSheet);
    });
  }

  it('marks something mounted beside an open dialog', async () => {
    function LateToast() {
      const [open, setOpen] = useState(false);
      const [toast, setToast] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            Open dialog
          </button>
          <Modal isOpen={open} onClose={() => setOpen(false)} title="Details">
            <button type="button" onClick={() => setToast(true)}>
              Show toast
            </button>
          </Modal>
          {toast && <div role="status">A new version is ready</div>}
        </div>
      );
    }
    render(<LateToast />);
    openWithKeyboard();
    fireEvent.click(screen.getByRole('button', { name: 'Show toast' }));
    const toast = screen.getByRole('status');
    await waitFor(() => expect(isInert(toast)).toBe(true));
    escape();
    expect(inertCount()).toBe(0);
  });

  it('clears the background when an open dialog is unmounted', () => {
    const { unmount } = render(
      <Opener title="Details">
        <input aria-label="Name" />
      </Opener>,
    );
    openWithKeyboard();
    expect(inertCount()).toBeGreaterThan(0);
    unmount();
    expect(inertCount()).toBe(0);
  });
});

// Phase 82 (ADR 0058): the background is inert, and focus is inside, in the
// same commit that puts the dialog on the page, and both are given back in
// the commit that closes it.
//
// Under `act` React runs every effect before the test's next line, so this
// runs without it. The dialog opens and closes on a default-priority update
// (Quick Add's lazy chunk resolving is one), whose passive effects React runs
// in a later task. A MutationObserver callback is a microtask: it runs after
// the commit and before that task, so it sees the page as the first frame
// would.
describe('Modal isolates the page in the commit that shows the dialog', () => {
  const realFocus = HTMLElement.prototype.focus;
  beforeEach(() => {
    HTMLElement.prototype.focus = function focus(this: HTMLElement, options?: FocusOptions) {
      if (this.closest('[inert]')) return;
      realFocus.call(this, options);
    };
  });
  afterEach(() => {
    HTMLElement.prototype.focus = realFocus;
  });

  type Seen = { behindInert: boolean; dialogInert: boolean; focusInDialog: boolean; focusOnOpener: boolean; inert: number };

  it('marks the background and moves focus in before the first frame, and gives both back in the closing commit', async () => {
    const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const before = g.IS_REACT_ACT_ENVIRONMENT;
    g.IS_REACT_ACT_ENVIRONMENT = false;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let setOpen: (open: boolean) => void = () => {};
    function Host() {
      const [open, set] = useState(false);
      setOpen = set;
      return (
        <div>
          <button type="button" id="opener">
            Open
          </button>
          <button type="button" id="behind">
            Behind the scrim
          </button>
          <Modal isOpen={open} onClose={() => set(false)} title="Details">
            <input aria-label="Name" />
          </Modal>
          <output id="state">{open ? 'open' : 'closed'}</output>
        </div>
      );
    }
    const snapshot = (): Seen => {
      const dialog = container.querySelector('[role="dialog"]');
      return {
        behindInert: container.querySelector('#behind')!.closest('[inert]') !== null,
        dialogInert: !!dialog?.closest('[inert]'),
        focusInDialog: !!dialog?.contains(document.activeElement),
        focusOnOpener: document.activeElement === container.querySelector('#opener'),
        inert: document.querySelectorAll('[inert]').length,
      };
    };
    try {
      root.render(<Host />);
      await vi.waitFor(() => expect(container.querySelector('#state')?.textContent).toBe('closed'));
      container.querySelector<HTMLElement>('#opener')!.focus();

      let atOpen: Seen | null = null;
      let atClose: Seen | null = null;
      const observer = new MutationObserver(() => {
        const state = container.querySelector('#state')?.textContent;
        if (state === 'open' && !atOpen) atOpen = snapshot();
        if (state === 'closed' && atOpen && !atClose) atClose = snapshot();
      });
      observer.observe(container, { childList: true, subtree: true, characterData: true });

      setOpen(true);
      await vi.waitFor(() => expect(atOpen).not.toBeNull());
      expect(atOpen).toMatchObject({ behindInert: true, dialogInert: false, focusInDialog: true });

      setOpen(false);
      await vi.waitFor(() => expect(atClose).not.toBeNull());
      observer.disconnect();
      expect(atClose).toMatchObject({ behindInert: false, focusOnOpener: true, inert: 0 });
    } finally {
      root.unmount();
      container.remove();
      g.IS_REACT_ACT_ENVIRONMENT = before;
    }
  });
});

// Phase 83 (ADR 0059): a dialog opened over another, the way the Categories
// spec does it. "Delete category" (a ConfirmDialog inside <main>) is open; the
// header's Quick Add button, inert behind it, is clicked by dispatchEvent;
// Quick Add's lazy chunk then mounts it beside <main>. On WebKit CI its amount,
// filled right after the dialog was visible, once never reached the form.
//
// Like the app in development, this renders under StrictMode, which runs each
// layout effect, its cleanup and the effect again on mount, and outside `act`.
// It fills the field as Playwright does: `select()` and `focus()` in the page,
// then, one round trip later, text typed into whatever has focus, with no
// check that focus is still there. It does that from the first commit that
// shows the dialog and again once it settles.
describe('Modal opened over another dialog', () => {
  const realFocus = HTMLElement.prototype.focus;
  beforeEach(() => {
    HTMLElement.prototype.focus = function focus(this: HTMLElement, options?: FocusOptions) {
      if (this.closest('[inert]')) return;
      realFocus.call(this, options);
    };
  });
  afterEach(() => {
    HTMLElement.prototype.focus = realFocus;
  });

  type Fill = { inert: boolean; focused: boolean; value: string; reported: string };

  it('takes a typed amount at the first commit that shows it and after it settles, under StrictMode', async () => {
    const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const before = g.IS_REACT_ACT_ENVIRONMENT;
    g.IS_REACT_ACT_ENVIRONMENT = false;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    let reported = '';
    function QuickAdd({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
      const [amount, setAmount] = useState('');
      return (
        <Modal isOpen={isOpen} onClose={onClose} title="Quick Record Transaction">
          <input
            aria-label="Amount"
            id="qa-amount"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              reported = e.target.value;
            }}
          />
          <button type="submit" disabled={!amount}>
            Record
          </button>
        </Modal>
      );
    }
    // The chunk resolves when the test says so, after the click has rendered.
    let releaseChunk: () => void = () => {};
    const chunk = new Promise<{ default: typeof QuickAdd }>((resolve) => {
      releaseChunk = () => resolve({ default: QuickAdd });
    });
    const LazyQuickAdd = React.lazy(() => chunk);
    let setConfirm: (open: boolean) => void = () => {};
    function Shell() {
      const [confirm, set] = useState(false);
      setConfirm = set;
      const [hasOpened, setHasOpened] = useState(false);
      const [quickAdd, setQuickAdd] = useState(false);
      return (
        <div id="shell">
          <header>
            <button
              type="button"
              id="qa-opener"
              onClick={() => {
                setHasOpened(true);
                setQuickAdd(true);
              }}
            >
              Quick add
            </button>
          </header>
          <main>
            <button type="button" id="delete-opener" onClick={() => set(true)}>
              Delete
            </button>
            <Modal isOpen={confirm} onClose={() => set(false)} title="Delete category">
              <button type="button">Delete category</button>
            </Modal>
          </main>
          {hasOpened && (
            <React.Suspense fallback={null}>
              <LazyQuickAdd isOpen={quickAdd} onClose={() => setQuickAdd(false)} />
            </React.Suspense>
          )}
        </div>
      );
    }

    // Playwright's fill, step for step: focus in the page, then the typing a
    // task later, which is when React runs the mount's deferred work.
    const fill = async (text: string): Promise<Fill> => {
      const input = container.querySelector<HTMLInputElement>('#qa-amount')!;
      input.select();
      input.focus();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const target = document.activeElement;
      if (target instanceof HTMLInputElement) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(target, text);
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return {
        inert: input.closest('[inert]') !== null,
        focused: document.activeElement === input,
        value: input.value,
        reported,
      };
    };

    try {
      root.render(
        <React.StrictMode>
          <Shell />
        </React.StrictMode>,
      );
      await vi.waitFor(() => expect(container.querySelector('#delete-opener')).not.toBeNull());
      container.querySelector<HTMLElement>('#delete-opener')!.focus();
      setConfirm(true);
      await vi.waitFor(() => expect(container.querySelector('[role="dialog"]')).not.toBeNull());
      expect(container.querySelector('header')!.hasAttribute('inert')).toBe(true);

      let atFirstCommit: Fill | null = null;
      let filling = false;
      const observer = new MutationObserver(() => {
        if (filling || !container.querySelector('#qa-amount')) return;
        filling = true;
        void fill('50').then((result) => {
          atFirstCommit = result;
        });
      });
      observer.observe(container, { childList: true, subtree: true });

      container.querySelector('#qa-opener')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      releaseChunk();
      await vi.waitFor(() => expect(atFirstCommit).not.toBeNull());
      observer.disconnect();
      expect(atFirstCommit).toEqual({ inert: false, focused: true, value: '50', reported: '50' });

      // Settled: still the top dialog, its field still takes typing, and the
      // confirmation under it is inert.
      await new Promise((resolve) => setTimeout(resolve, 50));
      const settled = await fill('75');
      expect(settled).toEqual({ inert: false, focused: true, value: '75', reported: '75' });
      const dialogs = container.querySelectorAll('[role="dialog"]');
      expect(dialogs).toHaveLength(2);
      expect(dialogs[0].closest('[inert]')).not.toBeNull();
      expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
    } finally {
      root.unmount();
      container.remove();
      g.IS_REACT_ACT_ENVIRONMENT = before;
    }
  });
});
