import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanSource, checkDirectory } from '../scripts/check-node-globals.mjs';

/**
 * The Node globals guard (ADR 0045). src/ runs in the browser, but tsc cannot
 * keep Node out of it (@types/papaparse pulls Node's types into the root
 * program), so `scripts/check-node-globals.mjs` does, as the first step of
 * `npm run lint`. These tests pin what it flags, what it must not, and its
 * ignore comment.
 */

const messages = (source: string) => scanSource(source).map(f => f.message);
const lines = (source: string) => scanSource(source).map(f => f.line);

describe('flags Node in code', () => {
  it.each([
    ['process.env', 'const url = process.env.VITE_URL;', 'import.meta.env'],
    ['optional process.env', 'const url = process?.env?.VITE_URL;', 'import.meta.env'],
    ['process.cwd()', 'const here = process.cwd();', '`process` is a Node global'],
    ['bare process', 'const { env } = process;', '`process` is a Node global'],
    ['typeof process', "if (typeof process !== 'undefined') run();", '`process` is a Node global'],
    ['Buffer', "const bytes = Buffer.from('x');", '`Buffer` is a Node global'],
    ['Buffer as a type', 'let b: Buffer;', '`Buffer` is a Node global'],
    ['__dirname', 'const dir = __dirname;', '`__dirname` and `__filename`'],
    ['__filename', 'const file = __filename;', '`__dirname` and `__filename`'],
    ['global.', 'global.fetch = f;', 'use `globalThis`'],
    ["global['x']", "global['fetch'] = f;", 'use `globalThis`'],
    ['require(', "const fs = require('fs');", '`require` is CommonJS'],
    ['require.resolve', "const p = require.resolve('x');", '`require` is CommonJS'],
    ['node: import', "import { readFileSync } from 'node:fs';", "'node:fs' is a Node built-in"],
    ['bare builtin import', "import path from 'path';", "'path' is a Node built-in"],
    ['builtin subpath', "import { readFile } from 'fs/promises';", "'fs/promises' is a Node built-in"],
    ['side-effect import', "import 'node:process';", "'node:process' is a Node built-in"],
    ['dynamic import', "const os = await import('os');", "'os' is a Node built-in"],
    ['re-export', "export * from 'node:util';", "'node:util' is a Node built-in"],
    ['inside a template expression', 'const s = `url: ${process.env.X}`;', 'import.meta.env'],
  ])('%s', (_name, source, expected) => {
    const found = messages(source);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain(expected);
  });

  it('reports the line and column of each finding', () => {
    const source = ['const a = 1;', '', '  const b = process.env.X; const c = Buffer.alloc(1);'].join('\n');
    expect(scanSource(source).map(f => [f.line, f.column])).toEqual([[3, 13], [3, 38]]);
  });

  it('finds code after a multi-line template and a block comment', () => {
    const source = ['const t = `', 'process.env in text', '`;', '/*', ' process.cwd()', '*/', 'process.exit(1);'].join('\n');
    expect(lines(source)).toEqual([7]);
  });
});

describe('leaves alone what is not Node', () => {
  it.each([
    ['a line comment', '// process.env is not available here'],
    ['a block comment', '/* Buffer, __dirname and require() are Node only */'],
    ['a JSX comment', '<div>{/* process.env */}</div>'],
    ['a string', "const s = 'process.env.X';"],
    ['a double-quoted string', 'const s = "require(\'fs\')";'],
    ['template text', 'const s = `read process.env and __dirname`;'],
    ['import.meta.env', 'const url = import.meta.env.VITE_SUPABASE_URL;'],
    ['globalThis', 'globalThis.fetch = f;'],
    ['ArrayBuffer and SharedArrayBuffer', 'const a = new ArrayBuffer(8); const b = new SharedArrayBuffer(8);'],
    ['a property named process', 'job.process(); x?.process;'],
    ['an object key named process', 'const o = { process: 1, Buffer: 2 };'],
    ['supabase-js `global` option', 'createClient(url, key, { global: { fetch: f } });'],
    ['a string that says global', "signOut({ scope: everywhere ? 'global' : 'local' });"],
    ['a method named require', 'schema.require();'],
    ['a regular expression', 'const re = /process\\.env|require\\(/g;'],
    ['a package import', "import { z } from 'zod';"],
    ['a relative import', "import { x } from './process';"],
    ['JSX text with an apostrophe', "<p>Don't</p>"],
    ['JSX self-closing and closing tags', '<a href="/x" /><b>1/2</b>'],
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
    expect(scanSource('const e = process.env.X; // node-guard-ignore: read at build time')).toEqual([]);
  });

  it('suppresses the next line when it stands alone', () => {
    expect(scanSource('// node-guard-ignore: feature detection only\nconst node = typeof process;')).toEqual([]);
  });

  it('works as a block comment', () => {
    expect(scanSource('/* node-guard-ignore: test seam */ const b = Buffer;')).toEqual([]);
  });

  it('reaches one line only', () => {
    const source = '// node-guard-ignore: one line\nconst a = typeof process;\nconst b = typeof process;';
    expect(lines(source)).toEqual([3]);
  });

  it('does not reach the next line from the end of a code line', () => {
    const source = 'const a = 1; // node-guard-ignore: nothing here\nconst b = typeof process;';
    expect(messages(source)).toEqual([
      '`node-guard-ignore` suppresses nothing here; remove it',
      '`process` is a Node global; it is undefined in the browser',
    ]);
  });

  it('needs a reason', () => {
    const found = scanSource('const e = process.env.X; // node-guard-ignore');
    expect(found.map(f => f.message)).toEqual([
      '`node-guard-ignore` needs a reason: `// node-guard-ignore: <why>`',
      '`process.env` does not exist in the browser; read `import.meta.env` (a VITE_ variable)',
    ]);
  });

  it('is an error when it suppresses nothing', () => {
    expect(messages('const a = 1; // node-guard-ignore: left behind')).toEqual([
      '`node-guard-ignore` suppresses nothing here; remove it',
    ]);
  });
});

describe('the command', () => {
  const script = fileURLToPath(new URL('../scripts/check-node-globals.mjs', import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'node-globals-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('exits 0 and says so on a clean tree', () => {
    mkdirSync(join(dir, 'clean'));
    writeFileSync(join(dir, 'clean', 'a.ts'), 'export const url = import.meta.env.VITE_URL;\n');
    const run = spawnSync(process.execPath, [script, join(dir, 'clean')], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('1 files');
    expect(run.stdout).toContain('no Node globals');
  });

  it('exits 1 and names the file, line, column and fix', () => {
    mkdirSync(join(dir, 'dirty', 'nested'), { recursive: true });
    writeFileSync(join(dir, 'dirty', 'nested', 'b.tsx'), 'const ok = 1;\nexport const url = process.env.VITE_URL;\n');
    writeFileSync(join(dir, 'dirty', 'notes.md'), 'process.env is fine in markdown\n');
    const run = spawnSync(process.execPath, [script, join(dir, 'dirty')], { encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/nested\/b\.tsx:2:20 {2}`process\.env` does not exist in the browser; read `import\.meta\.env`/);
    expect(run.stderr).toContain('1 finding in 1 of 1 files');
  });
});
