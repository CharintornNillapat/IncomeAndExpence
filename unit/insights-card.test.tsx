// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { Category, Transaction } from '../src/types';
import { todayIsoDate } from '../src/utils/date';

/**
 * The monthly wrap-up card, signed in and as a guest (ADR 0020, 0088).
 *
 * Since Phase 112 the proxy serves accounts only and the client sends a guest
 * nothing, and no Playwright spec signs in. So the model path that
 * `tests/insights.spec.ts` drove as a guest until then is here, with the
 * session supplied by a mock of `authorizationHeader`: the payload's privacy,
 * the rendered figures, the cache, Refresh and a 429.
 */

const auth = vi.hoisted(() => ({ token: null as string | null }));
vi.mock('../src/lib/supabase', () => ({
  authorizationHeader: async () => (auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
}));

const { SpendingInsightsCard } = await import('../src/components/dashboard/SpendingInsightsCard');
const { __resetInsightsState } = await import('../src/utils/insightsClient');

const MARKER = 'zzzsecret-latte-482913';
const TODAY = todayIsoDate();

const CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Food & Dining', type: 'EXPENSE', icon: 'x', color: '#E879A6', isSystem: true, isDeleted: false },
];

function tx(id: string, amount: number, description: string): Transaction {
  return {
    id, userId: 'user-1', walletId: 'wal-main', categoryId: 'cat-food', amount, type: 'EXPENSE',
    description, transactionDate: TODAY, isDeleted: false, createdBy: 'user-1',
    createdAt: `${TODAY}T08:00:00.000Z`, updatedAt: `${TODAY}T08:00:00.000Z`,
  };
}

const TRANSACTIONS = [tx('tx-one', 320, `${MARKER} one`), tx('tx-two', 180, `${MARKER} two`)];

let fetchStub: ReturnType<typeof vi.fn>;
let reply: { status: number; body: unknown; headers?: Record<string, string> };

beforeEach(() => {
  localStorage.clear();
  __resetInsightsState();
  auth.token = 'access-abc';
  reply = { status: 200, body: { pattern: 'STEADY', focus: 'Food & Dining', confidence: 0.91 } };
  fetchStub = vi.fn(async () => new Response(JSON.stringify(reply.body), { status: reply.status, headers: reply.headers }));
  vi.stubGlobal('fetch', fetchStub);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderCard = (userId = 'user-1') =>
  render(<SpendingInsightsCard transactions={TRANSACTIONS} categories={CATEGORIES} userId={userId} />);

async function generate() {
  fireEvent.click(screen.getByRole('button', { name: /Generate insights/ }));
  return screen.findByTestId('insights-body');
}

describe('signed in', () => {
  it('makes no request until Generate is pressed', () => {
    renderCard();
    expect(fetchStub).not.toHaveBeenCalled();
    expect(screen.queryByTestId('insights-body')).toBeNull();
  });

  it('sends aggregates only, never ledger content', async () => {
    renderCard();
    await generate();

    expect(fetchStub).toHaveBeenCalledTimes(1);
    const body = fetchStub.mock.calls[0][1].body as string;
    expect(body).not.toContain(MARKER);
    expect(body).not.toContain('wal-main');
    expect(body).not.toMatch(/"(walletId|categoryId|transactionId|userId|id)"\s*:/);
    expect(body).not.toMatch(/\btx-[a-z0-9-]+/i);
    expect(body).not.toMatch(/\bcat-[a-z-]+/i);
    const parsed = JSON.parse(body) as { summary: { month: string; categories: unknown[] } };
    expect(parsed.summary.month).toBe(TODAY.slice(0, 7));
    expect(parsed.summary.categories.length).toBeGreaterThan(0);
  });

  it("renders the model's verdict with the ledger's own figures, unmarked", async () => {
    renderCard();
    const body = await generate();

    expect(body.textContent).toContain('฿500.00');
    expect(body.textContent).toMatch(/spent/i);
    expect(screen.queryByTestId('insights-offline-note')).toBeNull();
    expect(screen.queryByTestId('insights-signin-note')).toBeNull();
  });

  it('caches the verdict, so the same month costs one request', async () => {
    const first = renderCard();
    await generate();
    first.unmount();

    renderCard();

    expect(screen.getByTestId('insights-body')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Generate insights/ })).toBeNull();
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it('Refresh bypasses the cache and asks exactly once more', async () => {
    renderCard();
    await generate();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh insights' }));

    await waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(2));
    await screen.findByTestId('insights-body');
  });

  it('falls back to the local summary on a 429, marked offline, and Refresh asks again', async () => {
    reply = { status: 429, body: { error: 'Too many requests.' }, headers: { 'Retry-After': '30' } };
    renderCard();
    const body = await generate();

    expect(body.textContent).toContain('฿500.00');
    expect(screen.getByTestId('insights-offline-note')).toBeTruthy();
    expect(screen.getByTestId('insights-card').textContent).not.toMatch(/error|failed|unavailable|too many|something went wrong/i);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh insights' }));
    await waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(2));
  });
});

describe('as a guest', () => {
  it('writes the summary on the device with no request, and says signing in adds Jev', async () => {
    auth.token = null;
    renderCard('guest');
    const body = await generate();

    expect(fetchStub).not.toHaveBeenCalled();
    expect(body.textContent).toContain('฿500.00');
    expect(screen.getByTestId('insights-signin-note').textContent).toBe('Written on this device. Sign in for a summary from Jev.');
    expect(screen.queryByTestId('insights-offline-note')).toBeNull();
  });
});
