import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

export const AREAS = [
  'auth',
  'account',
  'navbar',
  'mobile-nav',
  'nav-tab',
  'pwa',
  'view',
  'dashboard',
  'time-filter',
  'tx',
  'csv',
  'confirm',
  'quickadd',
  'wallet',
  'debt',
  'debts',
  'diary',
  'category',
] as const;

export interface CollectedDomId {
  file: string;
  id: string;
}

function walkDir(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

export function collectDomIds(rootDir: string = process.cwd()): CollectedDomId[] {
  const srcDirs = [
    path.join(rootDir, 'src', 'components'),
    path.join(rootDir, 'src', 'views'),
  ];
  const tsxFiles = srcDirs.flatMap((d) => walkDir(d));
  const results: CollectedDomId[] = [];

  for (const filePath of tsxFiles) {
    const relFile = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const rawContent = fs.readFileSync(filePath, 'utf8');

    // Strip comments so doc comments mentioning id: `...` are not treated as object literals
    const content = rawContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

    // 1. id="..." and closeButtonId="..." literals (skip any containing {)
    const attrDoubleRegex = /\b(?:id|closeButtonId)\s*=\s*"([^"{\r\n]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = attrDoubleRegex.exec(content)) !== null) {
      results.push({ file: relFile, id: m[1] });
    }
    const attrSingleRegex = /\b(?:id|closeButtonId)\s*=\s*'([^'{\r\n]+)'/g;
    while ((m = attrSingleRegex.exec(content)) !== null) {
      results.push({ file: relFile, id: m[1] });
    }

    // 2. id: '...' and id: `...` object-literal ids whose text contains a -
    // (?<![.\w]) ensures we do not match property access in ternaries like `category.id : `
    const objIdSingleRegex = /(?<![.\w])id\s*:\s*'([^'{\r\n]+)'/g;
    while ((m = objIdSingleRegex.exec(content)) !== null) {
      if (m[1].includes('-')) {
        results.push({ file: relFile, id: m[1] });
      }
    }
    const objIdDoubleRegex = /(?<![.\w])id\s*:\s*"([^"{\r\n]+)"/g;
    while ((m = objIdDoubleRegex.exec(content)) !== null) {
      if (m[1].includes('-')) {
        results.push({ file: relFile, id: m[1] });
      }
    }
    const objIdBacktickRegex = /(?<![.\w])id\s*:\s*`([^`\r\n]+)`/g;
    while ((m = objIdBacktickRegex.exec(content)) !== null) {
      const beforeDollar = m[1].split('${')[0];
      if (beforeDollar.includes('-')) {
        results.push({ file: relFile, id: beforeDollar });
      }
    }

    // 3. Template ids id={`...`}: the literal text before the first ${; skip when empty
    const templateIdRegex = /\bid\s*=\s*\{\s*`([^`\r\n]*)`\s*\}/g;
    while ((m = templateIdRegex.exec(content)) !== null) {
      const beforeDollar = m[1].split('${')[0];
      if (beforeDollar.length > 0) {
        results.push({ file: relFile, id: beforeDollar });
      }
    }

    // 4. idPrefix="..." literals
    const idPrefixDoubleRegex = /\bidPrefix\s*=\s*"([^"{\r\n]+)"/g;
    while ((m = idPrefixDoubleRegex.exec(content)) !== null) {
      results.push({ file: relFile, id: m[1] });
    }
    const idPrefixSingleRegex = /\bidPrefix\s*=\s*'([^'{\r\n]+)'/g;
    while ((m = idPrefixSingleRegex.exec(content)) !== null) {
      results.push({ file: relFile, id: m[1] });
    }

    // 5. In src/components/wallet/AddWalletModal.tsx and TransferFundsModal.tsx only:
    // the string values of the ids={{ ... }} object (key: 'value', lines).
    if (
      relFile === 'src/components/wallet/AddWalletModal.tsx' ||
      relFile === 'src/components/wallet/TransferFundsModal.tsx'
    ) {
      const idsBlock = content.match(/ids=\{\{([\s\S]*?)\}\}/);
      if (idsBlock) {
        const valueRegex = /:\s*['"]([^'"]+)['"]/g;
        let vm: RegExpExecArray | null;
        while ((vm = valueRegex.exec(idsBlock[1])) !== null) {
          results.push({ file: relFile, id: vm[1] });
        }
      }
    }
  }

  return results;
}

describe('DOM id convention', () => {
  it('collects at least 100 ids across src/components and src/views', () => {
    const ids = collectDomIds();
    expect(ids.length).toBeGreaterThanOrEqual(100);
  });

  it('verifies every collected id follows the <view>-<thing>-<kind> convention', () => {
    const ids = collectDomIds();
    const offenders: string[] = [];

    for (const item of ids) {
      const endsWithButton = item.id.endsWith('-button');
      const startsWithArea = AREAS.some(
        (area) => item.id === area || item.id.startsWith(`${area}-`)
      );

      if (endsWithButton || !startsWithArea) {
        offenders.push(`${item.file}: ${item.id}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
