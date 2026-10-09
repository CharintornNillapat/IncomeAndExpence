import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanSource, checkDirectory } from '../scripts/check-safe-ids.mjs';

/**
 * The safe id guard (ADR 0096). An id built from `Date.now()` alone repeats
 * within one millisecond (ADR 0095), so `scripts/check-safe-ids.mjs`, a step of
 * `npm run lint`, reports the time turned into text in src/. These tests pin
 * what it flags, what it must not, and its ignore comment.
 */

const MESSAGE = 'an id from `Date.now()` alone repeats within one millisecond; use `generateEntityId(prefix)` from src/utils/ids.ts (ADR 0095)';
const messages = (source: string) => scanSource(source).map(f => f.message);

describe('flags an id from the time alone', () => {
  it.each([
    ['a prefixed template, as every id before ADR 0095', 'const id = `w-${Date.now()}`;'],
    ['a prefix variable', 'const id = `${prefix}-${Date.now()}`;'],
    ['the time then a row number', 'const id = `tx-import-${Date.now()}-${row.rowIndex}`;'],
    ['the time in base 36', 'const id = `kr-${Date.now().toString(36)}`;'],
    ['spaces and a line break inside the braces', 'const id = `cat-${\n  Date.now()\n}`;'],
    ['a string joined before', "const id = 'debt-' + Date.now();"],
    ['a string joined after', "const id = Date.now() + '-diary';"],
    ['a template joined after', 'const id = Date.now().toString() + `-x`;'],
    ['an object property', 'const row = { id: `preset-${Date.now()}`, name };'],
  ])('%s', (_name, source) => {
    expect(messages(source)).toEqual([MESSAGE]);
  });

  it('reports the line and column of `Date`', () => {
    const source = ['const a = 1;', '', '  const id = `w-${Date.now()}`;'].join('\n');
    expect(scanSource(source).map(f => [f.line, f.column])).toEqual([[3, 19]]);
  });

  it('reports each one once', () => {
    expect(messages("const id = 'a-' + Date.now() + '-b';")).toEqual([MESSAGE]);
  });
});

describe('leaves alone what is not an id from the time', () => {
  it.each([
    ['the helper', "const id = generateEntityId('w');"],
    ['the time kept as a number', 'const now = Date.now();'],
    ['arithmetic in a template', 'const s = `${Math.ceil((resumesAt - Date.now()) / 1000)} s`;'],
    ['the time plus a number', 'const until = Date.now() + 1000;'],
    ['elapsed time', 'const ms = Date.now() - startedAt;'],
    ['a line comment', '// the old ids were `w-${Date.now()}`'],
    ['a block comment', "/* 'kr-' + Date.now() */"],
    ['a string', "const s = 'tx-${Date.now()}';"],
    ['template text', 'const s = `built from Date.now() alone`;'],
    ['an ISO timestamp', 'const createdAt = new Date().toISOString();'],
  ])('%s', (_name, source) => {
    expect(scanSource(source)).toEqual([]);
  });

  it('finds nothing in src/ today', () => {
    const src = fileURLToPath(new URL('../src', import.meta.url));
    const { files, findings } = checkDirectory(src);
    expect(files.length).toBeGreaterThan(100);
    expect(findings).toEqual([]);
  });
});

describe('the ignore comment', () => {
  it('suppresses its own line', () => {
    expect(scanSource('const id = `p-${Date.now()}`; // safe-id-ignore: never stored')).toEqual([]);
  });

  it('suppresses the next line when it stands alone', () => {
    expect(scanSource('// safe-id-ignore: random parts follow\nconst id = `k-${Date.now()}-${rand()}`;')).toEqual([]);
  });

  it('reaches one line only', () => {
    const source = '// safe-id-ignore: one line\nconst a = `a-${Date.now()}`;\nconst b = `b-${Date.now()}`;';
    expect(scanSource(source).map(f => f.line)).toEqual([3]);
  });

  it('needs a reason', () => {
    expect(messages('const id = `p-${Date.now()}`; // safe-id-ignore')).toEqual([
      '`safe-id-ignore` needs a reason: `// safe-id-ignore: <why>`',
      MESSAGE,
    ]);
  });

  it('is an error when it suppresses nothing', () => {
    expect(messages('const a = 1; // safe-id-ignore: left behind')).toEqual([
      '`safe-id-ignore` suppresses nothing here; remove it',
    ]);
  });
});

describe('the command', () => {
  const script = fileURLToPath(new URL('../scripts/check-safe-ids.mjs', import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'safe-ids-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('exits 0 and says so on a clean tree', () => {
    mkdirSync(join(dir, 'clean'));
    writeFileSync(join(dir, 'clean', 'a.ts'), "export const id = generateEntityId('w');\n");
    const run = spawnSync(process.execPath, [script, join(dir, 'clean')], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('1 files');
    expect(run.stdout).toContain('no id from the time alone');
  });

  it('exits 1 and names the file, line, column and fix', () => {
    mkdirSync(join(dir, 'dirty', 'nested'), { recursive: true });
    writeFileSync(join(dir, 'dirty', 'nested', 'b.tsx'), 'const ok = 1;\nexport const id = `w-${Date.now()}`;\n');
    const run = spawnSync(process.execPath, [script, join(dir, 'dirty')], { encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/nested\/b\.tsx:2:24 {2}an id from `Date\.now\(\)` alone/);
    expect(run.stderr).toContain('1 finding in 1 of 1 files');
  });
});
