import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL(String('../src/index.css'), import.meta.url), 'utf8');

function extractBlock(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`selector ${selector} missing`);
  const body = css.slice(start + selector.length + 2, css.indexOf('}', start));
  const out: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const m = line.match(/--([a-z0-9-]+):\s*([^;]+);/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function extractRawBlockBody(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`selector ${selector} missing`);
  return css.slice(start + selector.length + 2, css.indexOf('}', start));
}

const FROZEN_DARK_VARIABLES: Record<string, string> = {
  canvas: '#0B0E14',
  header: '#0F131B',
  'surface-1': '#131722',
  'surface-2': '#0F131B',
  'surface-3': '#1A1F2B',
  'control-active': '#262B3A',
  line: '#1F2532',
  'line-control': '#252B38',
  'line-strong': '#2A3140',
  'line-input': '#5E7092',
  fg: '#E8EAF0',
  'fg-secondary': '#A3AABB',
  'fg-muted': '#8A93A6',
  'fg-disabled': '#4A5163',
  focus: '#8B5CF6',
  scrim: 'rgba(0, 0, 0, 0.7)',
  'brand-text': '#B79CFF',
  'brand-soft-bg': '#1E1A33',
  'brand-soft-line': '#3A3160',
  'brand-soft-text': '#D4C4FF',
  'selected-bg': '#251E45',
  'selected-text': '#FFFFFF',
  'logged-bg': '#3B2F73',
  'income-text': '#34D399',
  'income-bg': '#0F2A21',
  'expense-text': '#F87171',
  'expense-bg': '#2E1719',
  'transfer-text': '#38BDF8',
  'transfer-bg': '#0E2533',
  'adjust-text': '#A3AABB',
  'adjust-bg': '#1E2233',
  'chip-text': '#C9CFDC',
  'danger-line': '#4A2227',
  'pending-text': '#FBBF24',
  'pending-bg': '#231C0B',
  'pending-line': '#4A3A12',
  'pending-body': '#F3E3B5',
};

const FROZEN_DARK_FILLS: Record<string, string> = {
  'brand-fill': '#7C3AED',
  'brand-fill-hover': '#6D28D9',
  'brand-tint': 'rgba(139, 92, 246, 0.12)',
  'brand-line': 'rgba(139, 92, 246, 0.3)',
  'income-fill': '#10B981',
  'income-line': 'rgba(16, 185, 129, 0.3)',
  'expense-fill': '#F43F5E',
  'expense-line': 'rgba(244, 63, 94, 0.3)',
  'pending-fill': '#F59E0B',
  'transfer-fill': '#38BDF8',
  'transfer-line': 'rgba(56, 189, 248, 0.3)',
};

const FROZEN_LIGHT_FILLS: Record<string, string> = {
  'brand-fill': '#4338CA',
  'brand-fill-hover': '#3730A3',
  'brand-tint': '#ECE8FB',
  'brand-line': '#D9D2F5',
  'income-fill': '#0E7A52',
  'income-line': 'rgba(14, 122, 82, 0.3)',
  'expense-fill': '#C0362C',
  'expense-line': 'rgba(192, 54, 44, 0.3)',
  'pending-fill': '#B45309',
  'transfer-fill': '#2563EB',
  'transfer-line': 'rgba(37, 99, 235, 0.3)',
};

const FILL_NAMES = Object.keys(FROZEN_DARK_FILLS);

describe('Theme tokens and fills (ADR 0103 D5)', () => {
  it('defines the 11 fill variables in .dark with frozen dark values and in :root with Paper Ledger light values', () => {
    const rootBlock = extractBlock(':root');
    const darkBlock = extractBlock('.dark');

    for (const name of FILL_NAMES) {
      expect(darkBlock[name], `dark fill --${name}`).toBe(FROZEN_DARK_FILLS[name]);
      expect(rootBlock[name], `light fill --${name}`).toBe(FROZEN_LIGHT_FILLS[name]);
    }
  });

  it('maps all 11 fills in @theme inline to their respective CSS variables', () => {
    const inlineBlock = extractBlock('@theme inline');

    for (const name of FILL_NAMES) {
      expect(inlineBlock[`color-${name}`], `--color-${name} mapping in @theme inline`).toBe(`var(--${name})`);
    }
  });

  it('contains no --color- entry in plain @theme block', () => {
    const rawThemeBody = extractRawBlockBody('@theme');
    expect(rawThemeBody).not.toMatch(/--color-/);
  });

  it('keeps the 37 pre-change dark variables unchanged in .dark', () => {
    const darkBlock = extractBlock('.dark');

    for (const [name, expectedValue] of Object.entries(FROZEN_DARK_VARIABLES)) {
      expect(darkBlock[name], `dark variable --${name}`).toBe(expectedValue);
    }
  });

  it('defines the five T794 tokens with light and dark values and preserves dark invariants (ADR 0103 D6)', () => {
    const rootBlock = extractBlock(':root');
    const darkBlock = extractBlock('.dark');
    const inlineBlock = extractBlock('@theme inline');

    const expectedTokens: Record<string, { light: string; dark: string }> = {
      'hero-line': { light: '#D9D2F5', dark: '#1F2532' },
      'segment-active': { light: '#EEE9E0', dark: '#262B3A' },
      'mood-tile': { light: '#F5F2EC', dark: '#0F131B' },
      'mood-empty': { light: '#E0D8CB', dark: '#2A3140' },
      'wallet-fallback': { light: '#8A8172', dark: '#A8A29E' },
    };

    for (const [name, expected] of Object.entries(expectedTokens)) {
      expect(rootBlock[name], `light token --${name}`).toBe(expected.light);
      expect(darkBlock[name], `dark token --${name}`).toBe(expected.dark);
      expect(inlineBlock[`color-${name}`], `--color-${name} mapping in @theme inline`).toBe(`var(--${name})`);
    }

    expect(darkBlock['hero-line']).toBe(darkBlock['line']);
    expect(darkBlock['segment-active']).toBe(darkBlock['control-active']);
    expect(darkBlock['mood-tile']).toBe(darkBlock['surface-2']);
    expect(darkBlock['mood-empty']).toBe(darkBlock['line-strong']);
    expect(darkBlock['wallet-fallback']).toBe('#A8A29E');
  });

  it('points the four components at the new tokens', () => {
    const leftOverSrc = readFileSync(new URL('../src/components/dashboard/LeftOverCard.tsx', import.meta.url), 'utf8');
    const segmentedSrc = readFileSync(new URL('../src/components/ui/SegmentedControl.tsx', import.meta.url), 'utf8');
    const moodCardSrc = readFileSync(new URL('../src/components/dashboard/MoodSpendingCard.tsx', import.meta.url), 'utf8');
    const moodMeterSrc = readFileSync(new URL('../src/components/diary/MoodMeter.tsx', import.meta.url), 'utf8');

    expect(leftOverSrc).toContain('border-hero-line');
    expect(leftOverSrc).not.toContain('bg-brand-tint border border-line ');

    expect(segmentedSrc).toContain('bg-segment-active');
    expect(segmentedSrc).not.toContain('bg-control-active');

    expect(moodCardSrc).toContain('bg-mood-tile');

    expect(moodMeterSrc).toContain('bg-mood-empty');
    expect(moodMeterSrc).not.toContain('bg-line-strong');
  });

  it('has no hard-coded fallback hex in WalletTransferForm', () => {
    const walletTransferSrc = readFileSync(new URL('../src/components/wallet/WalletTransferForm.tsx', import.meta.url), 'utf8');

    expect(walletTransferSrc).toContain('bg-wallet-fallback');
    expect(walletTransferSrc).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('defines heat-1, heat-2 and heat-3 in :root, .dark and @theme inline (ADR 0109 D5)', () => {
    const rootBlock = extractBlock(':root');
    const darkBlock = extractBlock('.dark');
    const inlineBlock = extractBlock('@theme inline');

    const expectedHeat: Record<string, { light: string; dark: string }> = {
      'heat-1': { light: '#FEF4F2', dark: '#291A1E' },
      'heat-2': { light: '#FBE7E4', dark: '#3A1E23' },
      'heat-3': { light: '#F8DBD7', dark: '#4C2229' },
    };

    for (const [name, expected] of Object.entries(expectedHeat)) {
      expect(rootBlock[name], `light token --${name}`).toBe(expected.light);
      expect(darkBlock[name], `dark token --${name}`).toBe(expected.dark);
      expect(inlineBlock[`color-${name}`], `--color-${name} mapping in @theme inline`).toBe(`var(--${name})`);
    }
  });

  it('uses bg-heat-1..3 in TxCalendar and contains no raw hex', () => {
    const txCalendarSrc = readFileSync(new URL('../src/components/transaction/TxCalendar.tsx', import.meta.url), 'utf8');

    expect(txCalendarSrc).toContain('bg-heat-1');
    expect(txCalendarSrc).toContain('bg-heat-2');
    expect(txCalendarSrc).toContain('bg-heat-3');
    expect(txCalendarSrc).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
