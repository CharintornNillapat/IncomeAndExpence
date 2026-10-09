// Safe id guard for src/ (Phase 120, ADR 0096). A record's id built from
// `Date.now()` alone repeats when two records are made in one millisecond, and
// an edit or delete by id then reaches both: it failed `main` CI after Phase
// 118 (ADR 0095). New ids come from `generateEntityId(prefix)` in
// src/utils/ids.ts. This script reports the time turned into text, which is
// how every such id was built:
//   `${Date.now()}` (or `${Date.now().toString(36)}`) in a template literal,
//   and a string literal joined to `Date.now()` with `+`.
// Arithmetic on the time (`resumesAt - Date.now()`) is not reported.
//
// A line that genuinely needs one carries a comment with a reason, on the line
// itself or alone on the line above:
//   // safe-id-ignore: <why this is not a stored id, or where its entropy is>
// An ignore without a reason, or one that suppresses nothing, is itself an
// error. Comments and strings are blanked first (maskSource, shared with the
// Node globals guard, ADR 0045), so a mention in either never matches.
//
// No dependencies. `npm run lint` runs it.
// Usage: node scripts/check-safe-ids.mjs [dir]   (dir defaults to src/)
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { maskSource } from './check-node-globals.mjs';

const EXTENSIONS = /\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)$/;
const IGNORE = /safe-id-ignore\b(?::\s*(\S.*?))?\s*(?:\*\/)?\s*$/;
const NOW = String.raw`Date\s*\.\s*now\s*\(\s*\)(?:\s*\.\s*toString\s*\([^()]*\))?`;
const MESSAGE = 'an id from `Date.now()` alone repeats within one millisecond; use `generateEntityId(prefix)` from src/utils/ids.ts (ADR 0095)';

// Run on masked code, where a template keeps its backticks and its `${ }` and a
// string keeps its quotes.
const RULES = [
  new RegExp(String.raw`\$\{\s*${NOW}\s*\}`, 'g'),
  new RegExp(String.raw`['"\x60]\s*\+\s*${NOW}`, 'g'),
  new RegExp(String.raw`${NOW}\s*\+\s*['"\x60]`, 'g'),
];

/** Every finding in one file's text: `{ line, column, message }`. */
export function scanSource(text) {
  const { code, comments } = maskSource(text);
  const codeLines = code.split('\n');
  const findings = [];

  const ignores = [];
  for (const comment of comments) {
    const directive = comment.text.trim().match(IGNORE);
    if (!directive) continue;
    if (!directive[1]?.trim()) {
      findings.push({ line: comment.line, column: 1, message: '`safe-id-ignore` needs a reason: `// safe-id-ignore: <why>`' });
      continue;
    }
    const lines = new Set([comment.line, comment.endLine]);
    if (!codeLines[comment.endLine - 1].trim()) lines.add(comment.endLine + 1);
    ignores.push({ line: comment.line, lines, used: false });
  }

  const lineStarts = [0];
  for (let k = 0; k < code.length; k++) if (code[k] === '\n') lineStarts.push(k + 1);
  const position = (index) => {
    let line = lineStarts.length - 1;
    while (lineStarts[line] > index) line--;
    return { line: line + 1, column: index - lineStarts[line] + 1 };
  };
  const seen = new Set();
  for (const rule of RULES) {
    for (const m of code.matchAll(rule)) {
      // Report at `Date`, once, whichever rule found it.
      const at = m.index + m[0].search(/Date/);
      if (seen.has(at)) continue;
      seen.add(at);
      const where = position(at);
      const ignore = ignores.find(g => g.lines.has(where.line));
      if (ignore) { ignore.used = true; continue; }
      findings.push({ ...where, message: MESSAGE });
    }
  }
  for (const ignore of ignores) {
    if (!ignore.used) findings.push({ line: ignore.line, column: 1, message: '`safe-id-ignore` suppresses nothing here; remove it' });
  }
  return findings.sort((a, b) => a.line - b.line || a.column - b.column);
}

function listFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path));
    else if (EXTENSIONS.test(entry.name)) files.push(path);
  }
  return files.sort();
}

/** Scans a directory; returns `{ files, findings: [{ file, line, column, message }] }`. */
export function checkDirectory(dir) {
  const files = listFiles(dir);
  const findings = [];
  for (const file of files) {
    for (const f of scanSource(readFileSync(file, 'utf8'))) findings.push({ file, ...f });
  }
  return { files, findings };
}

function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const dir = process.argv[2] ?? join(root, 'src');
  const { files, findings } = checkDirectory(dir);
  const show = (file) => relative(root, file).split(sep).join('/');
  if (findings.length === 0) {
    console.log(`safe-ids: ${files.length} files in ${show(dir) || '.'}, no id from the time alone.`);
    return;
  }
  for (const f of findings) console.error(`${show(f.file)}:${f.line}:${f.column}  ${f.message}`);
  console.error(`\nsafe-ids: ${findings.length} finding${findings.length === 1 ? '' : 's'} in ${new Set(findings.map(f => f.file)).size} of ${files.length} files (ADR 0096).`);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
