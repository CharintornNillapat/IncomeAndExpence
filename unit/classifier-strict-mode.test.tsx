// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StrictMode, useEffect, useRef } from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import { useDescriptionClassifier } from '../src/hooks/useDescriptionClassifier';
import { __resetClassifierState } from '../src/utils/jevClassifier';
import type { Category } from '../src/types';

/**
 * Phase 111 (ADR 0087): the WebKit flake in `jev-classify.spec.ts`. The note
 * was typed; no classification was ever sent, so no suggestion appeared.
 *
 * In development StrictMode tears a new component's effects down and runs
 * them again. The hook's cleanup cancels the debounce timer, which is right
 * for an unmount, but a note typed between the first run and that cleanup
 * was armed, cancelled, and never armed again. Playwright's fill, sent the
 * moment the dialog opened, landed in that gap a few times in a hundred.
 *
 * Here a component arms one classification from its first effect, which runs
 * after the hook's own, so StrictMode's cleanup comes after it: the same
 * order the browser saw, every time.
 */

const CATEGORIES: Category[] = [
  { id: 'cat-transport', name: 'Transport & Fuel', type: 'EXPENSE', icon: 'x', color: '#5CC8B8', isSystem: true, isDeleted: false },
  { id: 'cat-food', name: 'Food & Dining', type: 'EXPENSE', icon: 'x', color: '#E879A6', isSystem: true, isDeleted: false },
];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __resetClassifierState();
  fetchMock = vi.fn(async () => ({
    status: 200,
    ok: true,
    headers: new Headers(),
    json: async () => ({ categoryId: 'cat-transport', categoryConfidence: 0.62, detectedType: 'EXPENSE', typeConfidence: 0.9 }),
  }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function TypesOnMount() {
  const { suggestion, classify } = useDescriptionClassifier(CATEGORIES);
  const typed = useRef(false);
  useEffect(() => {
    if (typed.current) return;
    typed.current = true;
    classify('Netflix subscription');
  }, [classify]);
  return <output data-testid="suggestion">{suggestion?.categoryName ?? ''}</output>;
}

describe('a note typed as the form mounts is still classified', () => {
  it('under StrictMode, whose effect re-run follows the typing', async () => {
    render(
      <StrictMode>
        <TypesOnMount />
      </StrictMode>,
    );
    await vi.waitFor(() => expect(screen.getByTestId('suggestion').textContent).toBe('Transport & Fuel'), { timeout: 2000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('and an unmount still cancels it, sending nothing', async () => {
    const { unmount } = render(<TypesOnMount />);
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
