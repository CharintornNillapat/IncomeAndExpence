// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { FinanceProvider } from '../src/context/FinanceContext';
import { ImportCsvModal } from '../src/components/transaction/ImportCsvModal';
import { __resetClassifierState } from '../src/utils/jevClassifier';
import { todayIsoDate } from '../src/utils/date';

/**
 * Phase 109 (ADR 0085, audit finding 3): the import preview offers a row only
 * the categories of its own type, and never a suggestion of another type,
 * since `commitBulkImport` would drop it (a row's type decides which way the
 * money moves, so the category gives way).
 */

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __resetClassifierState();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function openWith(rows: string[]) {
  render(
    <FinanceProvider>
      <ImportCsvModal isOpen onClose={() => {}} />
    </FinanceProvider>,
  );
  const text = ['Date,Wallet,Category,Type,Amount,Description', ...rows.map((r) => `${todayIsoDate()},Main Checking,${r}`)].join('\n');
  fireEvent.change(document.querySelector('#csv-file-input')!, {
    target: { files: [new File([text], 'import.csv', { type: 'text/csv' })] },
  });
  await screen.findByTestId('csv-row-category-2');
}

const options = (rowIndex: number) =>
  Array.from((screen.getByTestId(`csv-row-category-${rowIndex}`) as HTMLSelectElement).options).map((o) => o.value);

describe("the preview's category picker", () => {
  it("lists the row type's categories only", async () => {
    await openWith([',EXPENSE,45,zzzlunch', ',INCOME,900,zzzpay', ',ADJUSTMENT,-5,zzzfix']);
    expect(options(2)).toEqual(['', 'cat-food', 'cat-groceries', 'cat-transport', 'cat-shopping', 'cat-housing']);
    expect(options(3)).toEqual(['', 'cat-salary', 'cat-freelance']);
    expect(options(4)).toEqual(['', 'cat-adjust']);
  });

  it('treats a named category of another type as no category, so Jev may fill it', async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers(),
      json: async () => ({ categoryId: 'cat-food', categoryConfidence: 0.96, detectedType: 'EXPENSE', typeConfidence: 0.97 }),
    } as unknown as Response);
    await openWith(['Balance Adjustment,EXPENSE,45,zzzlunch']);
    expect((screen.getByTestId('csv-row-category-2') as HTMLSelectElement).value).toBe('');

    fireEvent.click(screen.getByText('Classify remaining with Jev'));
    await vi.waitFor(() => expect((screen.getByTestId('csv-row-category-2') as HTMLSelectElement).value).toBe('cat-food'));
  });

  it('offers no suggestion of another type', async () => {
    // Jev picks an income category for an expense row: a type disagreement.
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers(),
      json: async () => ({ categoryId: 'cat-salary', categoryConfidence: 0.96, detectedType: 'EXPENSE', typeConfidence: 0.97 }),
    } as unknown as Response);
    await openWith([',EXPENSE,45,zzzlunch']);

    fireEvent.click(screen.getByText('Classify remaining with Jev'));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // Counted as no answer: nothing was applied or offered. The note, and the
    // live region that reads it out.
    await screen.findAllByText(/^Classified 0 of 1: 0 applied, 0 to confirm\./);
    expect(screen.queryByTestId('csv-row-confidence-2')).toBeNull();
    expect((screen.getByTestId('csv-row-category-2') as HTMLSelectElement).value).toBe('');
  });
});
