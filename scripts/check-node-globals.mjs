// Node globals guard for src/ (Phase 69, ADR 0045). src/ runs in the browser,
// but tsc cannot keep Node out of it: @types/papaparse carries
// `/// <reference types="node" />`, so `process`, `Buffer` and the rest
// type-check in src/ and then throw in the browser (CLAUDE.md, found in
// Phase 50). This script reads every .ts/.tsx/.js/.jsx file under src/, blanks
// out comments and string literals, and reports what is left that names a Node
// global, a CommonJS `require`, or a Node built-in module. Exits 1 on any
// finding.
//
// A line that genuinely needs one carries a comment with a reason, on the line
// itself or alone on the line above:
//   // node-guard-ignore: <why this is safe in the browser>
// An ignore without a reason, or one that suppresses nothing, is itself an
// error, so an exception cannot go stale silently.
//
// No dependencies. `npm run lint` runs it first.
// Usage: node scripts/check-node-globals.mjs [dir]   (dir defaults to src/)
import { readFileSync, readdirSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const EXTENSIONS = /\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)$/;
const IGNORE = /node-guard-ignore\b(?::\s*(\S.*?))?\s*(?:\*\/)?\s*$/;

// Checked on code with comments and strings blanked, so a word in a comment or
// a string never matches. The lookbehind skips a property of something else
// (`x.process`, `ArrayBuffer`), and `process` as an object key is skipped by
// the lookahead.
const RULES = [
  {
    re: /(?<![\w$.])process\s*(?:\?\.|\.)\s*env\b/g,
    message: '`process.env` does not exist in the browser; read `import.meta.env` (a VITE_ variable)',
  },
  {
    re: /(?<![\w$.])process\b(?!\s*(?:\?\.|\.)\s*env\b)(?!\s*:)/g,
    message: '`process` is a Node global; it is undefined in the browser',
  },
  {
    re: /(?<![\w$.])Buffer\b(?!\s*:)/g,
    message: '`Buffer` is a Node global; use `Uint8Array`, `TextEncoder` or `TextDecoder`',
  },
  {
    re: /(?<![\w$.])__(?:dirname|filename)\b/g,
    message: '`__dirname` and `__filename` exist only in Node CommonJS; use `import.meta.url`',
  },
  {
    re: /(?<![\w$.])global\s*(?:\?\.|\.|\[)/g,
    message: '`global` is Node\'s name for the global object; use `globalThis`',
  },
  {
    re: /(?<![\w$.])require\s*(?:\(|\.)/g,
    message: '`require` is CommonJS and Node only; use `import`',
  },
];

const BUILTINS = new Set(builtinModules.filter(m => !m.startsWith('_')));

function isNodeBuiltin(specifier) {
  if (specifier.startsWith('node:')) return true;
  return BUILTINS.has(specifier) || BUILTINS.has(specifier.split('/')[0]);
}

// A `/` starts a regular expression after these characters (and at the start),
// otherwise it divides. `<` and `>` are left out on purpose: in JSX `</div>`
// and `/>` are tags, not patterns.
const REGEX_AFTER_CHAR = new Set('(,=:[!&|?{};+-*%~^'.split(''));
const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await', 'instanceof']);

/**
 * Splits source into code (comments and string contents replaced by spaces,
 * so columns and lines stay put), the comments on each line, and every string
 * literal with where it starts.
 */
export function maskSource(text) {
  const out = text.split('');
  const comments = []; // { line, endLine, text }
  const strings = []; // { index, value }
  const templateDepth = []; // brace depth at each open `${`
  let i = 0;
  let line = 1;
  const n = text.length;

  const blank = (from, to) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  const lineAt = (from, to) => {
    for (let k = from; k < to; k++) if (text[k] === '\n') line++;
  };
  const previousSignificant = (from) => {
    let k = from - 1;
    while (k >= 0 && /\s/.test(out[k])) k--;
    if (k < 0) return { char: '', word: '' };
    let w = k;
    while (w >= 0 && /[\w$]/.test(out[w])) w--;
    return { char: out[k], word: out.slice(w + 1, k + 1).join('') };
  };
  const regexEnd = (from) => {
    // from is the index just after the opening `/`; returns the index after
    // the closing `/` and its flags, or -1 if the line ends first.
    let k = from;
    let inClass = false;
    while (k < n && text[k] !== '\n') {
      const c = text[k];
      if (c === '\\') { k += 2; continue; }
      if (inClass) { if (c === ']') inClass = false; }
      else if (c === '[') inClass = true;
      else if (c === '/') {
        k++;
        while (k < n && /[a-z]/i.test(text[k])) k++;
        return k;
      }
      k++;
    }
    return -1;
  };
  const readString = (from, quote) => {
    // A quoted string ends at its quote or, unterminated (JSX text such as
    // "Don't"), at the end of the line.
    let k = from + 1;
    while (k < n && text[k] !== quote && text[k] !== '\n') k += text[k] === '\\' ? 2 : 1;
    const end = Math.min(k, n);
    strings.push({ index: from, value: text.slice(from + 1, end) });
    blank(from + 1, end);
    return text[end] === quote ? end + 1 : end;
  };
  const readTemplate = (from) => {
    // from is just after a backtick or a closing `}` of `${...}`; stops after
    // the closing backtick or after an opening `${`.
    let k = from;
    while (k < n) {
      const c = text[k];
      if (c === '\\') { k += 2; continue; }
      if (c === '`') { blank(from, k); lineAt(from, k); return k + 1; }
      if (c === '$' && text[k + 1] === '{') {
        blank(from, k); lineAt(from, k);
        templateDepth.push(0);
        return k + 2;
      }
      k++;
    }
    blank(from, n); lineAt(from, n);
    return n;
  };

  while (i < n) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && next === '/') {
      let k = i;
      while (k < n && text[k] !== '\n') k++;
      comments.push({ line, endLine: line, text: text.slice(i + 2, k) });
      blank(i, k);
      i = k;
      continue;
    }
    if (c === '/' && next === '*') {
      const close = text.indexOf('*/', i + 2);
      const k = close === -1 ? n : close + 2;
      const startLine = line;
      lineAt(i, k);
      comments.push({ line: startLine, endLine: line, text: text.slice(i + 2, close === -1 ? n : close) });
      blank(i, k);
      i = k;
      continue;
    }
    if (c === '\'' || c === '"') { i = readString(i, c); continue; }
    if (c === '`') { i = readTemplate(i + 1); continue; }
    if (templateDepth.length) {
      if (c === '{') templateDepth[templateDepth.length - 1]++;
      if (c === '}') {
        if (templateDepth[templateDepth.length - 1] === 0) {
          templateDepth.pop();
          i = readTemplate(i + 1);
          continue;
        }
        templateDepth[templateDepth.length - 1]--;
      }
    }
    if (c === '/') {
      const prev = previousSignificant(i);
      const startsRegex = prev.char === '' || REGEX_AFTER_CHAR.has(prev.char) || REGEX_AFTER_WORD.has(prev.word);
      const end = startsRegex ? regexEnd(i + 1) : -1;
      if (end !== -1) { blank(i + 1, end); i = end; continue; }
    }
    i++;
  }
  return { code: out.join(''), comments, strings };
}

/** Every finding in one file's text: `{ line, column, message }`. */
export function scanSource(text) {
  const { code, comments, strings } = maskSource(text);
  const codeLines = code.split('\n');
  const findings = [];

  // Ignore directives: on their own line, or alone on the line above.
  const ignores = [];
  for (const comment of comments) {
    const directive = comment.text.trim().match(IGNORE);
    if (!directive) continue;
    const reason = directive[1]?.trim();
    if (!reason) {
      findings.push({ line: comment.line, column: 1, message: '`node-guard-ignore` needs a reason: `// node-guard-ignore: <why>`' });
      continue;
    }
    const lines = new Set([comment.line, comment.endLine]);
    if (!codeLines[comment.endLine - 1].trim()) lines.add(comment.endLine + 1);
    ignores.push({ line: comment.line, lines, used: false });
  }

  const raw = [];
  codeLines.forEach((codeLine, index) => {
    for (const rule of RULES) {
      for (const m of codeLine.matchAll(rule.re)) raw.push({ line: index + 1, column: m.index + 1, message: rule.message });
    }
  });
  const lineStarts = [0];
  for (let k = 0; k < text.length; k++) if (text[k] === '\n') lineStarts.push(k + 1);
  const position = (index) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= index) lo = mid; else hi = mid - 1;
    }
    return { line: lo + 1, column: index - lineStarts[lo] + 1 };
  };
  for (const s of strings) {
    const before = code.slice(Math.max(0, s.index - 40), s.index);
    // `require('fs')` is already reported by the require rule.
    if (/(?:\bfrom|\bimport|\bimport\s*\()\s*$/.test(before) && isNodeBuiltin(s.value)) {
      raw.push({ ...position(s.index), message: `'${s.value}' is a Node built-in module; the browser build cannot load it` });
    }
  }

  for (const finding of raw) {
    const ignore = ignores.find(g => g.lines.has(finding.line));
    if (ignore) { ignore.used = true; continue; }
    findings.push(finding);
  }
  for (const ignore of ignores) {
    if (!ignore.used) findings.push({ line: ignore.line, column: 1, message: '`node-guard-ignore` suppresses nothing here; remove it' });
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
    console.log(`node-globals: ${files.length} files in ${show(dir) || '.'}, no Node globals.`);
    return;
  }
  for (const f of findings) console.error(`${show(f.file)}:${f.line}:${f.column}  ${f.message}`);
  console.error(`\nnode-globals: ${findings.length} finding${findings.length === 1 ? '' : 's'} in ${new Set(findings.map(f => f.file)).size} of ${files.length} files. src/ runs in the browser (ADR 0045).`);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
