// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { TX_VIEW_KEY, readTxView, writeTxView } from '../src/utils/txViewPreference';

describe('txViewPreference: the remembered Transactions view (ADR 0109 D6)', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('defaults to table, stores calendar, and returns to table', () => {
    expect(readTxView()).toBe('table');
    writeTxView('calendar');
    expect(readTxView()).toBe('calendar');
    expect(localStorage.getItem(TX_VIEW_KEY)).toBe('calendar');
    writeTxView('table');
    expect(readTxView()).toBe('table');
  });

  it('falls back to table for any other stored value', () => {
    for (const stored of ['grid', '', 'CALENDAR']) {
      localStorage.setItem(TX_VIEW_KEY, stored);
      expect(readTxView()).toBe('table');
    }
  });

  it('falls back to table and does not throw when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readTxView()).toBe('table');

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeTxView('calendar')).not.toThrow();
  });

  it('names the storage key pf_tx_view', () => {
    expect(TX_VIEW_KEY).toBe('pf_tx_view');
  });
});
