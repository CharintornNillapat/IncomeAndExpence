// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { fireEvent as domFireEvent } from '@testing-library/dom';
import { InlineMathInput } from '../src/components/InlineMathInput';
import { TransactionForm } from '../src/components/TransactionForm';
import { WalletTransferForm } from '../src/components/wallet/WalletTransferForm';
import { FinanceProvider } from '../src/context/FinanceContext';
import { evaluateAmountInput } from '../src/utils/mathEvaluator';
import type { Category, Wallet } from '../src/types';

/**
 * Phase 81 (ADR 0057): the amount field's seed is applied during render.
 *
 * Before, a `seed` reached the field's text in a passive effect, after the
 * render that carried it. A keystroke handled in between was replaced by the
 * seed, and until the effect ran the form's amount and the field's text could
 * disagree. The field now derives everything it shows from its text, applies
 * a new seed while rendering, and leaves reporting a seed's amount to the
 * caller, which does it in the handler that seeds.
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
});

type Report = [amount: number | null, raw: string, isValid: boolean];

const byId = (id: string) => document.getElementById(id) as HTMLInputElement | null;

/** The field under a parent that owns its seed, as both forms do. */
let pushSeed: (value: string) => void = () => {};
let rerenderParent: () => void = () => {};
function Harness({
  onReport,
  onUserEdit,
  initial = { key: 0, value: '' },
}: {
  onReport: (...args: Report) => void;
  onUserEdit?: () => void;
  initial?: { key: number; value: string };
}) {
  const [seed, setSeed] = useState(initial);
  const [renders, setRenders] = useState(0);
  pushSeed = (value) => setSeed((prev) => ({ key: prev.key + 1, value }));
  rerenderParent = () => setRenders((n) => n + 1);
  return (
    <>
      <span data-testid="seed-key">{seed.key}</span>
      <span data-testid="renders">{renders}</span>
      <InlineMathInput id="amt" seed={seed} onAmountEvaluated={onReport} onUserEdit={onUserEdit} />
    </>
  );
}

function mountField(initial?: { key: number; value: string }) {
  const reports: Report[] = [];
  const onUserEdit = vi.fn();
  render(<Harness initial={initial} onReport={(...r) => reports.push(r)} onUserEdit={onUserEdit} />);
  const input = byId('amt')!;
  const type = (value: string) => fireEvent.change(input, { target: { value } });
  return { input, reports, onUserEdit, type };
}

const badge = () => document.getElementById('amt-container')?.textContent?.match(/Calculated: ฿[\d.,]+/)?.[0] ?? null;
const error = () => byId('amt-error')?.textContent ?? null;

describe('evaluateAmountInput: the field rules, without state', () => {
  it.each([
    ['', null, false, null],
    ['   ', null, false, null],
    ['120', 120, false, null],
    ['120+30', 150, true, null],
    ['16.775', 16.78, false, null],
    ['120+', null, true, null],
    ['(', null, true, null],
    ['.', null, false, null],
    ['0', null, false, 'Amount must be greater than zero'],
    ['5-10', null, true, 'Amount must be greater than zero'],
    ['abc', null, false, 'Invalid characters in calculation'],
    ['1..2', null, false, 'Incomplete or malformed math expression'],
  ])('%j gives amount %j, a calculation %j and error %j', (raw, amount, hasCalculation, err) => {
    const result = evaluateAmountInput(raw);
    expect(result.amount).toBe(amount);
    expect(result.hasCalculation).toBe(hasCalculation);
    expect(result.error).toBe(err);
  });
});

describe('InlineMathInput: a seed', () => {
  it('the key the field mounts with is not a seed', () => {
    const { input, reports } = mountField({ key: 5, value: '99' });
    expect(input.value).toBe('');
    expect(reports).toEqual([]);
  });

  it('a new key puts its text in and shows its result, but is not reported and is not a user edit', () => {
    const { input, reports, onUserEdit } = mountField();
    act(() => pushSeed('100+20'));
    expect(input.value).toBe('100+20');
    expect(badge()).toBe('Calculated: ฿120.00');
    expect(reports).toEqual([]);
    expect(onUserEdit).not.toHaveBeenCalled();
  });

  it('the key is compared, not the text: the same text again replaces a typed edit', () => {
    const { input, type } = mountField();
    act(() => pushSeed('60'));
    type('75');
    act(() => pushSeed('60'));
    expect(input.value).toBe('60');
  });

  it('a parent render with the same key leaves typed text alone', () => {
    const { input, type } = mountField();
    act(() => pushSeed('60'));
    type('75');
    act(() => rerenderParent());
    expect(input.value).toBe('75');
  });
});

describe('InlineMathInput: a person editing', () => {
  it('rapid typing and backspacing reports every step in order and ends where the text ends', () => {
    const { input, reports, onUserEdit, type } = mountField();
    for (const step of ['1', '12', '12+', '12+3', '12+', '12', '1', '']) type(step);
    expect(reports).toEqual([
      [1, '1', true],
      [12, '12', true],
      [null, '12+', false],
      [15, '12+3', true],
      [null, '12+', false],
      [12, '12', true],
      [1, '1', true],
      [null, '', false],
    ]);
    expect(onUserEdit).toHaveBeenCalledTimes(8);
    expect(input.value).toBe('');
    expect(badge()).toBeNull();
    expect(error()).toBeNull();
  });

  it('what the field shows always matches its last text', () => {
    const { type } = mountField();
    type('100+20');
    expect(badge()).toBe('Calculated: ฿120.00');
    type('100+');
    expect(badge()).toBeNull();
    expect(error()).toBeNull();
    type('0');
    expect(error()).toBe('Amount must be greater than zero');
    type('5');
    expect(error()).toBeNull();
  });

  it('an operator key, then a backspace, then Use result each report the new text', () => {
    const { input, reports, type } = mountField();
    type('100');
    fireEvent.click(byId('amt-op-+')!);
    expect(input.value).toBe('100+');
    type('100+20');
    fireEvent.click(byId('amt-apply-btn')!);
    expect(input.value).toBe('120');
    fireEvent.click(byId('amt-chip-500')!);
    expect(input.value).toBe('120+500');
    expect(reports.slice(1)).toEqual([
      [null, '100+', false],
      [120, '100+20', true],
      [120, '120', true],
      [620, '120+500', true],
    ]);
  });
});

describe('InlineMathInput: outside act, as in a browser', () => {
  /*
   * Under `act`, React runs a render's passive effects before the test's next
   * event, so the old effect's window could not be opened. Here nothing is
   * wrapped: a seed pushed outside any React event renders at default
   * priority, and React runs that render's effects in a later task. A
   * MutationObserver callback is a microtask, so it runs after the commit and
   * before those effects, and a keystroke dispatched there lands in exactly
   * the window the old seed effect left open.
   */
  async function inBrowserMode(run: (ctx: { container: HTMLElement; reports: Report[] }) => Promise<void>) {
    const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const before = g.IS_REACT_ACT_ENVIRONMENT;
    g.IS_REACT_ACT_ENVIRONMENT = false;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const reports: Report[] = [];
    try {
      root.render(<Harness onReport={(...r) => reports.push(r)} />);
      await vi.waitFor(() => expect(container.querySelector('#amt')).not.toBeNull());
      await run({ container, reports });
    } finally {
      root.unmount();
      container.remove();
      g.IS_REACT_ACT_ENVIRONMENT = before;
    }
  }
  const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

  it('a keystroke right after a seed commits is kept', async () => {
    await inBrowserMode(async ({ container, reports }) => {
      const input = container.querySelector<HTMLInputElement>('#amt')!;
      const marker = container.querySelector('[data-testid="seed-key"]')!;
      let typedInWindow = false;
      const observer = new MutationObserver(() => {
        if (marker.textContent !== '1' || typedInWindow) return;
        typedInWindow = true;
        domFireEvent.change(input, { target: { value: '777' } });
      });
      observer.observe(marker, { childList: true, characterData: true, subtree: true });
      pushSeed('60');
      await vi.waitFor(() => expect(typedInWindow).toBe(true));
      await settle();
      observer.disconnect();
      expect(input.value).toBe('777');
      expect(reports.at(-1)).toEqual([777, '777', true]);
    });
  });

  it('twin: a keystroke after the seed has settled is kept, and one before it is replaced', async () => {
    await inBrowserMode(async ({ container, reports }) => {
      const input = container.querySelector<HTMLInputElement>('#amt')!;
      domFireEvent.change(input, { target: { value: '5' } });
      await settle();
      pushSeed('60');
      await vi.waitFor(() => expect(input.value).toBe('60'));
      await settle();
      domFireEvent.change(input, { target: { value: '777' } });
      await settle();
      expect(input.value).toBe('777');
      expect(reports[0]).toEqual([5, '5', true]);
      expect(reports.at(-1)).toEqual([777, '777', true]);
    });
  });
});

const CASH: Wallet = {
  id: 'wal-cash', userId: 'u', name: 'Cash Wallet', type: 'CASH', currency: 'THB', balance: 500,
  color: '#D9A066', icon: 'x', isArchived: false, isDeleted: false, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '',
};
const MAIN: Wallet = { ...CASH, id: 'wal-main', name: 'Main Checking', balance: 900, color: '#6C8EEF' };
const FOOD: Category = { id: 'cat-food', name: 'Food & Dining', type: 'EXPENSE', icon: 'x', color: '#E879A6', isSystem: false, isDeleted: false };

describe('TransactionForm: the form records the amount it seeds', () => {
  function mountForm(onSubmit = vi.fn(async () => ({ success: true }))) {
    render(
      <FinanceProvider>
        <TransactionForm idPrefix="t" wallets={[CASH]} categories={[FOOD]} onSubmitTransaction={onSubmit} />
      </FinanceProvider>,
    );
    const note = document.querySelector<HTMLInputElement>('[id$="-desc"]')!;
    const amount = byId('t-amount-math')!;
    const submit = byId('confirm-t-btn') as unknown as HTMLButtonElement;
    return { note, amount, submit, onSubmit };
  }

  it('a note ending in an amount fills the field and arms the submit with that amount', async () => {
    const { note, amount, submit, onSubmit } = mountForm();
    fireEvent.change(note, { target: { value: 'ข้าวมันไก่ 60' } });
    expect(amount.value).toBe('60');
    expect(submit.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(submit);
    });
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: 60, rawInput: '60', description: 'ข้าวมันไก่ 60' }));
  });

  it('after a save the field is empty and the submit disarmed, and a new amount can be typed at once', async () => {
    const { note, amount, submit } = mountForm();
    fireEvent.change(note, { target: { value: 'lunch 60' } });
    await act(async () => {
      fireEvent.click(submit);
    });
    expect(amount.value).toBe('');
    expect(submit.disabled).toBe(true);
    fireEvent.change(amount, { target: { value: '45' } });
    expect(amount.value).toBe('45');
    expect(submit.disabled).toBe(false);
  });

  it('an amount typed by hand is not replaced by a note, and is what is submitted (ADR 0013)', async () => {
    const { note, amount, submit, onSubmit } = mountForm();
    fireEvent.change(amount, { target: { value: '250' } });
    fireEvent.change(note, { target: { value: 'lunch 60' } });
    expect(amount.value).toBe('250');
    await act(async () => {
      fireEvent.click(submit);
    });
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: 250, rawInput: '250' }));
  });
});

describe('WalletTransferForm: Transfer all records the amount it seeds', () => {
  it('fills the field with the balance and arms the transfer and its preview', () => {
    render(
      <FinanceProvider>
        <WalletTransferForm
          wallets={[CASH, MAIN]}
          ids={{ source: 'src', dest: 'dst', amount: 'xfer-amt', note: 'note', submit: 'xfer-submit', swap: 'swap', transferAll: 'xfer-all' }}
          tone="plain"
          onTransferred={() => {}}
        />
      </FinanceProvider>,
    );
    const submit = byId('xfer-submit') as unknown as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(byId('xfer-all')!);
    expect(byId('xfer-amt')!.value).toBe('500');
    expect(submit.disabled).toBe(false);
    expect(document.body.textContent).toContain('฿0.00');
    expect(document.body.textContent).toContain('฿1,400.00');
  });
});
