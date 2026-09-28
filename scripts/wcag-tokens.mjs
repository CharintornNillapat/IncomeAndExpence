// WCAG 2.x contrast check for the design tokens in src/index.css (Phase 53).
// Reads the :root and .dark custom properties straight from the stylesheet, so
// the numbers always describe what ships, then checks every text token against
// every surface it can sit on, input borders and the focus ring at 3:1
// (WCAG 1.4.11), and semantic text on its own tint background. Exits 1 on any
// failure.
//
// Usage: node scripts/wcag-tokens.mjs
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

function block(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`no ${selector} block in src/index.css`);
  const body = css.slice(start, css.indexOf('}', start));
  const vars = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

function parse(value) {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16)).concat(1);
  const rgba = value.match(/^rgba?\(([^)]+)\)$/);
  if (rgba) {
    const [r, g, b, a = '1'] = rgba[1].split(',').map(s => s.trim());
    return [Number(r), Number(g), Number(b), Number(a)];
  }
  throw new Error(`cannot parse colour ${value}`);
}

// Alpha-composite a translucent colour over an opaque one.
function over(top, bottom) {
  const a = top[3];
  return [0, 1, 2].map(i => Math.round(top[i] * a + bottom[i] * (1 - a))).concat(1);
}

function luminance([r, g, b]) {
  const lin = [r, g, b].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const light = block(':root');
const themes = { light, dark: { ...light, ...block('.dark') } };

let failures = 0;
const lines = [];
function check(theme, label, fg, bg, min) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failures += 1;
  lines.push(`${ok ? 'PASS' : 'FAIL'}  ${theme.padEnd(5)}  ${label.padEnd(44)} ${r.toFixed(2).padStart(5)}  (min ${min})`);
}

for (const [theme, v] of Object.entries(themes)) {
  const c = name => parse(v[name]);
  const surfaces = ['canvas', 'surface-1', 'surface-2'];
  // `--fg-disabled` is left out on purpose: WCAG 1.4.3 exempts disabled controls.
  for (const text of ['fg', 'fg-secondary', 'fg-muted', 'brand-text', 'income-text', 'expense-text', 'pending-text', 'transfer-text', 'adjust-text']) {
    for (const s of [...surfaces, 'header']) check(theme, `${text} on ${s}`, c(text), c(s), 4.5);
  }
  // Phase 56: `expense-text` joins them - the OverflowMenu's Delete item sits on surface-3, and on control-active when hovered.
  for (const text of ['fg', 'fg-secondary', 'expense-text']) {
    for (const s of ['surface-3', 'control-active']) check(theme, `${text} on ${s}`, c(text), c(s), 4.5);
  }
  for (const s of surfaces) {
    check(theme, `line-input on ${s}`, c('line-input'), c(s), 3);
  }
  // Phase 56: the global :focus-visible outline sits 2px outside the control, on whatever holds it.
  for (const s of [...surfaces, 'header', 'surface-3']) check(theme, `focus on ${s}`, c('focus'), c(s), 3);
  // Phase 56: the neutral chip (spec 4.7) - its text on the adjust tint it always sits on.
  check(theme, 'chip-text on adjust-bg', c('chip-text'), c('adjust-bg'), 4.5);
  // Each hue's text on its own solid `-bg` (the spec's tint colours).
  for (const hue of ['income', 'expense', 'transfer', 'adjust', 'pending']) {
    check(theme, `${hue}-text on ${hue}-bg`, c(`${hue}-text`), c(`${hue}-bg`), 4.5);
  }
  check(theme, 'pending-body on pending-bg', c('pending-body'), c('pending-bg'), 4.5);
  check(theme, 'brand-soft-text on brand-soft-bg', c('brand-soft-text'), c('brand-soft-bg'), 4.5);
  check(theme, 'selected-text on selected-bg', c('selected-text'), c('selected-bg'), 4.5);
  for (const s of ['surface-1', 'surface-2']) {
    const tint = over(parse('rgba(139, 92, 246, 0.12)'), c(s));
    check(theme, `brand-text on brand-tint over ${s}`, c('brand-text'), tint, 4.5);
  }
  check(theme, 'white on brand fill #7C3AED', [255, 255, 255, 1], parse('#7C3AED'), 4.5);
  check(theme, 'white on brand fill hover #6D28D9', [255, 255, 255, 1], parse('#6D28D9'), 4.5);
}

console.log(lines.join('\n'));
console.log(failures === 0 ? '\nAll token pairs pass.' : `\n${failures} pair(s) fail.`);
process.exit(failures === 0 ? 0 : 1);
