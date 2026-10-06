import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';
import '../src/utils/zodSchemas';

/**
 * ADR 0068: the response headers in `vercel.json`, the one inline script they
 * allow, and the zoomable viewport. Nothing local serves these headers (the
 * dev server ignores `vercel.json`), so this test is what notices an edit to
 * the theme script in `index.html` that its CSP hash no longer matches.
 */
const ROOT = resolve(__dirname, '..');
const vercel = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8'));
// Vercel builds from the repository, where `index.html` is LF (`.gitattributes`).
const indexHtml = readFileSync(resolve(ROOT, 'index.html'), 'utf8').replace(/\r\n/g, '\n');

const headerList: Array<{ key: string; value: string }> = vercel.headers[0].headers;
const header = (key: string) => headerList.find((h) => h.key === key)?.value;

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((parts) => parts[0])
      .map(([name, ...values]) => [name, values])
  );
}

// ADR 0070: the policy is enforced, as one header that also refuses frames.
const csp = directives(header('Content-Security-Policy') ?? '');

describe('vercel.json headers (ADR 0068)', () => {
  it('keeps the functions in icn1 (ADR 0051) and applies one header set to every path', () => {
    expect(vercel.regions).toEqual(['icn1']);
    expect(vercel.headers).toHaveLength(1);
    expect(vercel.headers[0].source).toBe('/(.*)');
  });

  it('sends nosniff, a referrer policy, and refuses every frame', () => {
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(header('X-Frame-Options')).toBe('DENY');
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
  });

  it('enforces the content security policy, in one header (ADR 0070)', () => {
    expect(headerList.filter((h) => h.key === 'Content-Security-Policy')).toHaveLength(1);
    expect(header('Content-Security-Policy-Report-Only')).toBeUndefined();
  });

  it('allows the inline theme script by its hash, and no other inline script', () => {
    const inline = [...indexHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(inline).toHaveLength(1);
    const hash = `'sha256-${createHash('sha256').update(inline[0]).digest('base64')}'`;
    expect(csp.get('script-src')).toEqual(["'self'", hash]);
  });

  it('allows no inline style or eval anywhere in the policy', () => {
    const all = [...csp.values()].flat();
    expect(all).not.toContain("'unsafe-inline'");
    expect(all).not.toContain("'unsafe-eval'");
    expect(csp.get('default-src')).toEqual(["'self'"]);
    expect(csp.get('object-src')).toEqual(["'none'"]);
  });

  it('connects to one Supabase project, over https and wss', () => {
    const connect = csp.get('connect-src') ?? [];
    expect(connect[0]).toBe("'self'");
    const hosts = connect.slice(1).map((u) => new URL(u));
    expect(hosts.map((u) => u.protocol)).toEqual(['https:', 'wss:']);
    expect(new Set(hosts.map((u) => u.host)).size).toBe(1);
    expect(hosts[0].host).toMatch(/^[a-z0-9]{20}\.supabase\.co$/);
  });
});

describe('index.html viewport (ADR 0068)', () => {
  it('lets a person zoom', () => {
    const viewport = indexHtml.match(/<meta name="viewport" content="([^"]*)"/)?.[1] ?? '';
    // viewport-fit=cover since ADR 0070; still no maximum-scale or user-scalable.
    expect(viewport).toBe('width=device-width, initial-scale=1.0, viewport-fit=cover');
  });
});

describe('zod (ADR 0068)', () => {
  it('runs without compiling schemas, so the CSP never sees an eval', () => {
    expect(z.config().jitless).toBe(true);
  });
});
