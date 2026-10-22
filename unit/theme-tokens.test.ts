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
});
