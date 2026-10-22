import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IDENTITY_PALETTE, identityDisplayColor } from '../src/utils/identityPalette';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

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

const EXPECTED_LIGHT_IDENTITY: Record<string, string> = {
  // 1: Tan, 2: Blue, 3: Teal, 4: Peach, 5: Rose, 6: Periwinkle
  // 7: Lavender, 8: Aqua, 9: Khaki, 10: Steel, 11: Orchid, 12: Iris
  'identity-1': '#A16207',
  'identity-2': '#1E40AF',
  'identity-3': '#0E7490',
  'identity-4': '#D97706',
  'identity-5': '#DB2777',
  'identity-6': '#2563EB',
  'identity-7': '#7C3AED',
  'identity-8': '#0891B2',
  'identity-9': '#8A6D46',
  'identity-10': '#5B7A9D',
  'identity-11': '#A21CAF',
  'identity-12': '#6B5FBF',
};

describe('identityDisplayColor (ADR 0103 D7)', () => {
  it('maps each of the 12 identity colours to var(--identity-N) case-insensitively and returns non-palette colours unchanged', () => {
    IDENTITY_PALETTE.forEach(({ hex }, index) => {
      const n = index + 1;
      expect(identityDisplayColor(hex)).toBe(`var(--identity-${n})`);
      expect(identityDisplayColor(hex.toLowerCase())).toBe(`var(--identity-${n})`);
      expect(identityDisplayColor(hex.toUpperCase())).toBe(`var(--identity-${n})`);
    });

    expect(identityDisplayColor('#6B7385')).toBe('#6B7385');
    expect(identityDisplayColor('#0ea5e9')).toBe('#0ea5e9');
    expect(identityDisplayColor('#16a34a')).toBe('#16a34a');
    expect(identityDisplayColor('stone')).toBe('stone');
    expect(identityDisplayColor('')).toBe('');

    // idempotent
    expect(identityDisplayColor('var(--identity-4)')).toBe('var(--identity-4)');
  });

  it('defines --identity-1..12 in :root with Paper Ledger light values and in .dark with stored hexes', () => {
    const rootBlock = extractBlock(':root');
    const darkBlock = extractBlock('.dark');

    IDENTITY_PALETTE.forEach(({ hex }, index) => {
      const varName = `identity-${index + 1}`;
      expect(darkBlock[varName], `dark --${varName}`).toBe(hex);
      expect(rootBlock[varName], `light --${varName}`).toBe(EXPECTED_LIGHT_IDENTITY[varName]);
    });
  });

  it('guards that every colour paint site in components and views uses identityDisplayColor or SYSTEM_CATEGORY_COLOR', () => {
    const dirs = [
      join(__dirname, '../src/components'),
      join(__dirname, '../src/views'),
    ];

    function getTsxFiles(dir: string): string[] {
      let results: string[] = [];
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(getTsxFiles(fullPath));
        } else if (entry.endsWith('.tsx')) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const files = dirs.flatMap(getTsxFiles);
    const pattern = /backgroundColor\s*:|color-mix\(|\b(stroke|fill)=\{|\bstyle=\{\{[^}]*\b(stroke|fill|color)\s*:/;

    const offending: string[] = [];
    let matchedLinesCount = 0;

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (pattern.test(line)) {
          matchedLinesCount++;
          if (!line.includes('identityDisplayColor(') && !line.includes('SYSTEM_CATEGORY_COLOR')) {
            const relPath = file.replace(/.*[/\\]src[/\\]/, 'src/');
            offending.push(`${relPath}:${idx + 1}: ${line.trim()}`);
          }
        }
      });
    }

    expect(matchedLinesCount).toBeGreaterThanOrEqual(12);
    expect(offending, `Found raw color paint sites without identityDisplayColor:\n${offending.join('\n')}`).toEqual([]);
  });
});
