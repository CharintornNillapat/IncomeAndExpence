// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react';
import { FinanceProvider } from '../src/context/FinanceContext';
import { ImportCsvModal } from '../src/components/transaction/ImportCsvModal';
import { __resetClassifierState } from '../src/utils/jevClassifier';
import { todayIsoDate } from '../src/utils/date';

/**
 * Phase 78 (ADR 0054): what a screen reader hears while the CSV importer
 * waits out a rate limit.
 *
 * The real modal inside the real guest `FinanceProvider`; `fetch` is stubbed,
 * and the clock is fake from the moment Classify is pressed, so a pause of
 * seconds runs in no time. A `MutationObserver` on the live region records
 * every value it takes, which is what a screen reader would be handed: the
 * countdown ticking must add nothing to that list.
 */

const PAUSE = /^Rate limit reached\. Classification paused for about \d+ seconds?, then it continues on its own\.$/;
const RESUMED = 'Rate limit cleared. Classification resumed.';
const CANCELLED = 'Classification cancelled. No categories were filled in.';

const ANSWER = { categoryId: 'cat-transport', categoryConfidence: 0.96, detectedType: 'EXPENSE', typeConfidence: 0.97 };

/** A `Response`-shaped stand-in carrying only what `classifyOnce` reads. */
function reply(status: number, body: unknown = ANSWER, headers: Record<string, string> = {}) {
  return { status, ok: status >= 200 && status < 300, headers: new Headers(headers), json: async () => body } as unknown as Response;
}

const limited = (retryAfter: string) => reply(429, {}, { 'Retry-After': retryAfter });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __resetClassifierState();
  fetchMock = vi.fn(async () => reply(200));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

/** Mounts the modal and loads a one-row CSV no keyword rule matches. */
async function openWithOneRow() {
  render(
    <FinanceProvider>
      <ImportCsvModal isOpen onClose={() => {}} />
    </FinanceProvider>
  );
  const text = [
    'Date,Wallet,Category,Type,Amount,Description,DestinationWallet',
    `${todayIsoDate()},Main Checking,,EXPENSE,45,zzznovelshop,`,
  ].join('\n');
  const input = document.querySelector('#csv-file-input') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File([text], 'import.csv', { type: 'text/csv' })] } });
  return screen.findByTestId('csv-classify-announcer');
}

/** Every value the region takes from now on, in order. */
function record(region: HTMLElement): string[] {
  const heard: string[] = [];
  new MutationObserver(() => {
    const text = region.textContent ?? '';
    if (text !== heard[heard.length - 1]) heard.push(text);
  }).observe(region, { childList: true, characterData: true, subtree: true });
  return heard;
}

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function classify() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  fireEvent.click(screen.getByText('Classify remaining with Jev'));
  await tick(0);
}

describe('the import\'s live region (ADR 0054)', () => {
  it('is a polite, atomic, visually hidden status, mounted empty with the preview', async () => {
    const region = await openWithOneRow();
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-atomic')).toBe('true');
    expect(region.className).toContain('sr-only');
    expect(region.textContent).toBe('');
  });

  it('announces a pause once, not every second, then the resume once', async () => {
    // The retry takes a round trip, as on a network; an instant reply would
    // let React render the resume and the finish as one update.
    fetchMock.mockImplementationOnce(async () => limited('3')).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return reply(200);
    });
    const region = await openWithOneRow();
    const heard = record(region);

    await classify();
    expect(heard).toHaveLength(1);
    expect(heard[0]).toMatch(PAUSE);
    expect(heard[0]).toContain('about 3 seconds');

    // The visible countdown moves; the region does not.
    const wait = screen.getByTestId('csv-classify-wait');
    const before = wait.textContent;
    await tick(1_000);
    await tick(1_000);
    expect(screen.getByTestId('csv-classify-wait').textContent).not.toBe(before);
    expect(heard).toHaveLength(1);

    await tick(1_000);
    expect(heard).toEqual([heard[0], RESUMED]);
    await tick(100);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // A run that paused also says how it ended: the note, word for word.
    const note = screen.getByTestId('csv-classify-note').textContent;
    expect(note).toContain('Classified 1 of 1');
    expect(heard).toEqual([heard[0], RESUMED, note]);
  });

  it('ends with the note when the resume and the finish land in one render', async () => {
    // An instant retry: React renders the end of the pause and the end of the
    // run together, so no resume is heard (WebKit showed this with a mocked
    // reply). The note still closes what the pause opened.
    fetchMock.mockImplementationOnce(async () => limited('2')).mockImplementation(async () => reply(200));
    const heard = record(await openWithOneRow());

    await classify();
    await tick(2_000);
    await tick(0);

    const note = screen.getByTestId('csv-classify-note').textContent;
    expect(note).toContain('Classified 1 of 1');
    expect(heard[0]).toMatch(PAUSE);
    expect(heard[heard.length - 1]).toBe(note);
  });

  it('ends with the unavailable note when the endpoint goes away during a run that paused', async () => {
    fetchMock.mockImplementationOnce(async () => limited('1')).mockImplementation(async () => reply(404, {}));
    const heard = record(await openWithOneRow());

    await classify();
    await tick(1_000);
    await tick(0);

    expect(heard[heard.length - 1]).toBe('Jev is unavailable right now. Import still works, and categories stay blank.');
  });

  it('says one second, not one seconds', async () => {
    fetchMock.mockImplementationOnce(async () => limited('1')).mockImplementation(async () => reply(200));
    const heard = record(await openWithOneRow());

    await classify();
    expect(heard[0]).toContain('about 1 second,');
  });

  it('announces a cancel during the pause, and never a resume after it', async () => {
    fetchMock.mockImplementation(async () => limited('30'));
    const heard = record(await openWithOneRow());

    await classify();
    expect(heard[0]).toMatch(PAUSE);

    fireEvent.click(screen.getByText('Cancel'));
    await tick(0);
    await tick(30_000);
    expect(heard).toEqual([heard[0], CANCELLED]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('announces a run stopped by a wait over a minute, with its counts, and no pause', async () => {
    fetchMock.mockImplementation(async () => limited('120'));
    const heard = record(await openWithOneRow());

    await classify();
    expect(heard).toHaveLength(1);
    expect(heard[0]).toBe(
      'Classified 0 of 1: 0 applied, 0 to confirm. 1 request sent. ' +
        'Stopped early: the rate limit asked for a wait of over a minute, so the rest stay blank.'
    );
    expect(heard[0]).toBe(screen.getByTestId('csv-classify-note').textContent);
  });

  it('empties the region when a run starts, so the same sentence in a later run is read again', async () => {
    // A request that waits until it is cancelled: two runs, each cancelled
    // before any 429, end on the same sentence.
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        })
    );
    const heard = record(await openWithOneRow());

    await classify();
    fireEvent.click(screen.getByText('Cancel'));
    await tick(0);
    fireEvent.click(screen.getByText('Classify remaining with Jev'));
    await tick(0);
    fireEvent.click(screen.getByText('Cancel'));
    await tick(0);

    expect(heard).toEqual([CANCELLED, '', CANCELLED]);
  });

  it('announces a pause that grows while it runs only once', async () => {
    // Two rows go out together: one is refused with 2 s at once, the other
    // with 5 s half a second later, which moves the resume time.
    fetchMock.mockImplementation(async () => {
      const n = fetchMock.mock.calls.length;
      if (n === 1) return limited('2');
      if (n === 2) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return limited('5');
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      return reply(200);
    });
    render(
      <FinanceProvider>
        <ImportCsvModal isOpen onClose={() => {}} />
      </FinanceProvider>
    );
    const csvText = [
      'Date,Wallet,Category,Type,Amount,Description,DestinationWallet',
      `${todayIsoDate()},Main Checking,,EXPENSE,45,zzznovelshop,`,
      `${todayIsoDate()},Main Checking,,EXPENSE,60,zzzothershop,`,
    ].join('\n');
    const input = document.querySelector('#csv-file-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([csvText], 'import.csv', { type: 'text/csv' })] } });
    const heard = record(await screen.findByTestId('csv-classify-announcer'));

    await classify();
    await tick(500);
    await tick(5_000);
    expect(heard).toHaveLength(2);
    expect(heard[0]).toContain('about 2 seconds');
    expect(heard[1]).toBe(RESUMED);
    await tick(100);
    expect(heard).toHaveLength(3);
    expect(heard[2]).toContain('Classified 2 of 2');
  });

  it('starts a clean run after a cancelled paused one from empty, and ends it on its note', async () => {
    fetchMock.mockImplementationOnce(async () => limited('30')).mockImplementation(async () => reply(200));
    const heard = record(await openWithOneRow());

    await classify();
    fireEvent.click(screen.getByText('Cancel'));
    await tick(0);
    expect(heard[heard.length - 1]).toBe(CANCELLED);

    fireEvent.click(screen.getByText('Classify remaining with Jev'));
    await tick(0);
    await tick(0);
    const note = screen.getByTestId('csv-classify-note').textContent;
    expect(note).toContain('Classified 1 of 1');
    expect(heard.slice(-2)).toEqual(['', note]);
    expect(heard).not.toContain(RESUMED);
  });

  // ADR 0055: every finished run is heard, limited or not.
  it('announces the note once for a run that is never limited, and nothing else', async () => {
    const heard = record(await openWithOneRow());

    await classify();
    await tick(0);
    const note = screen.getByTestId('csv-classify-note').textContent;
    expect(note).toBe('Classified 1 of 1: 1 applied, 0 to confirm. 1 request sent.');
    expect(heard).toEqual([note]);
  });

  it('announces the unavailable note for a run whose endpoint is missing from the start', async () => {
    fetchMock.mockImplementation(async () => reply(404, {}));
    const heard = record(await openWithOneRow());

    await classify();
    await tick(0);
    expect(heard).toEqual(['Jev is unavailable right now. Import still works, and categories stay blank.']);
  });

  it('announces the note when nothing matched, so an empty result is not silence', async () => {
    fetchMock.mockImplementation(async () => reply(200, { categoryId: 'other', categoryConfidence: 0.9, detectedType: 'EXPENSE', typeConfidence: 0.9 }));
    const heard = record(await openWithOneRow());

    await classify();
    await tick(0);
    expect(heard).toEqual(['Classified 0 of 1: 0 applied, 0 to confirm. 1 request sent.']);
  });

  it('reads the same note again when a second run ends on it', async () => {
    const heard = record(await openWithOneRow());

    await classify();
    await tick(0);
    const note = screen.getByTestId('csv-classify-note').textContent;
    // The row is now filled, so reload the preview to classify it again.
    vi.useRealTimers();
    const input = document.querySelector('#csv-file-input') as HTMLInputElement;
    const text = [
      'Date,Wallet,Category,Type,Amount,Description,DestinationWallet',
      `${todayIsoDate()},Main Checking,,EXPENSE,45,zzznovelshop,`,
    ].join('\n');
    fireEvent.change(input, { target: { files: [new File([text], 'again.csv', { type: 'text/csv' })] } });
    await screen.findByText('Classify remaining with Jev');
    await classify();
    await tick(0);

    expect(heard.filter((t) => t === note)).toHaveLength(2);
  });
});
