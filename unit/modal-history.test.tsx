// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { StrictMode, useState } from 'react';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { Modal } from '../src/components/Modal';
import { dialogEntryOf } from '../src/utils/modalHistory';

/**
 * Phase 113 (ADR 0089): each open dialog has a history entry of its own, on
 * the same URL, so Back closes the top dialog instead of changing the tab
 * under it, and a dialog closed any other way takes its entry off, so no Back
 * press is spent on nothing. Under StrictMode, whose effect re-run must not
 * push a second entry.
 */

/** Waits for the traversal a `history.back()` queued to land. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 30)));

function back() {
  return act(async () => {
    history.back();
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

function Harness() {
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [other, setOther] = useState(false);
  return (
    <StrictMode>
      <button onClick={() => setSheet(true)}>Open sheet</button>
      <button onClick={() => setOther(true)}>Open other</button>
      <Modal isOpen={sheet} onClose={() => setSheet(false)} title="Sheet">
        <button onClick={() => setConfirm(true)}>Open confirm</button>
        <button
          onClick={() => {
            setSheet(false);
            setOther(true);
          }}
        >
          Hand off
        </button>
      </Modal>
      <Modal isOpen={confirm} onClose={() => setConfirm(false)} title="Confirm">
        <p>Sure?</p>
      </Modal>
      <Modal isOpen={other} onClose={() => setOther(false)} title="Other">
        <p>Other body</p>
      </Modal>
    </StrictMode>
  );
}

const dialog = (name: string) => screen.queryByRole('dialog', { name });

let baseLength = 0;
function start() {
  // A push, not a replace: it drops the forward entries an earlier test's Back
  // left, which `history.length` still counts, so the base is where we stand
  // in any test order (ADR 0096).
  history.pushState(null, '', '/#/wallets');
  baseLength = history.length;
  render(<Harness />);
}

afterEach(async () => {
  cleanup();
  await settle();
});

describe('a dialog in the browser history', () => {
  it('pushes one entry on the same URL, StrictMode re-run included', async () => {
    start();
    fireEvent.click(screen.getByText('Open sheet'));
    await settle();

    expect(dialog('Sheet')).not.toBeNull();
    expect(history.length).toBe(baseLength + 1);
    expect(dialogEntryOf(history.state)).not.toBeNull();
    expect(location.hash).toBe('#/wallets');
  });

  it('Back closes it and leaves the tab entry current', async () => {
    start();
    fireEvent.click(screen.getByText('Open sheet'));
    await settle();

    await back();

    await waitFor(() => expect(dialog('Sheet')).toBeNull());
    expect(dialogEntryOf(history.state)).toBeNull();
    expect(location.hash).toBe('#/wallets');
  });

  it('a close by its own button takes its entry off, so Back is not spent on it', async () => {
    start();
    fireEvent.click(screen.getByText('Open sheet'));
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));

    await waitFor(() => expect(dialog('Sheet')).toBeNull());
    await waitFor(() => expect(dialogEntryOf(history.state)).toBeNull());
    expect(history.state).toBeNull();
  });

  it('Back closes only the top dialog of two', async () => {
    start();
    fireEvent.click(screen.getByText('Open sheet'));
    await settle();
    fireEvent.click(screen.getByText('Open confirm'));
    await settle();

    await back();
    await waitFor(() => expect(dialog('Confirm')).toBeNull());
    expect(dialog('Sheet')).not.toBeNull();

    await back();
    await waitFor(() => expect(dialog('Sheet')).toBeNull());
    expect(dialogEntryOf(history.state)).toBeNull();
  });

  it('a hand-off from one dialog to another leaves one entry, for the new one', async () => {
    start();
    fireEvent.click(screen.getByText('Open sheet'));
    await settle();

    fireEvent.click(screen.getByText('Hand off'));
    await settle();
    expect(dialog('Other')).not.toBeNull();

    await back();
    await waitFor(() => expect(dialog('Other')).toBeNull());
    expect(dialogEntryOf(history.state)).toBeNull();
  });

  // The entry of a dialog closed by its button comes off with history.back(),
  // which lands a task later. A dialog opened meanwhile must not take that
  // landing for Back, and gets its own entry once it has landed.
  it("a dialog opened while a closed one's entry is coming off stays open, with its own entry", async () => {
    start();
    fireEvent.click(screen.getByText('Open sheet'));
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
    await act(() => Promise.resolve()); // the release's microtask: back() is now on its way
    fireEvent.click(screen.getByText('Open other'));
    await settle();

    expect(dialog('Other')).not.toBeNull();
    expect(dialogEntryOf(history.state)).not.toBeNull();

    await back();
    await waitFor(() => expect(dialog('Other')).toBeNull());
    expect(dialogEntryOf(history.state)).toBeNull();
  });
});
