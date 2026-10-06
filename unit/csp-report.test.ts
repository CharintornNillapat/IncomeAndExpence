import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';

/**
 * `api/csp-report.ts` (ADR 0071): the endpoint browsers post CSP violations to.
 * Each test loads a fresh copy, because the rate limits live in module memory.
 */

type Post = (request: Request) => Promise<Response>;
let POST: Post;
let warn: MockInstance<typeof console.warn>;

beforeEach(async () => {
  vi.resetModules();
  ({ POST } = await import('../api/csp-report.ts'));
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  vi.useRealTimers();
});

function post(body: unknown, type = 'application/csp-report', ip = '203.0.113.7') {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return POST(
    new Request('https://example.test/api/csp-report', {
      method: 'POST',
      headers: { 'content-type': type, 'x-forwarded-for': `${ip}, 10.0.0.1` },
      body: text,
    })
  );
}

const LEGACY = {
  'csp-report': {
    'document-uri': 'https://app.example/?tab=wallets#access_token=secret-token',
    'violated-directive': 'connect-src',
    'effective-directive': 'connect-src',
    'blocked-uri': 'https://evil.example/collect?leak=1',
    disposition: 'enforce',
    'source-file': 'https://app.example/assets/index-abc.js',
    'line-number': 2,
    'column-number': 3051,
    'status-code': 200,
  },
};

const REPORTING_API = [
  {
    type: 'csp-violation',
    url: 'https://app.example/',
    body: {
      documentURL: 'https://app.example/transactions?q=rent',
      effectiveDirective: 'script-src-elem',
      blockedURL: 'inline',
      disposition: 'enforce',
      sourceFile: 'https://app.example/',
      lineNumber: 40,
      columnNumber: 7,
      statusCode: 200,
    },
  },
  { type: 'deprecation', body: { id: 'x' } },
];

const logged = () => warn.mock.calls.map((c) => JSON.parse(String(c[0])));

describe('POST /api/csp-report', () => {
  it('logs a report-uri violation as one structured line, with URLs cut to origin and path', async () => {
    const res = await post(LEGACY);
    expect(res.status).toBe(204);
    expect(logged()).toEqual([
      {
        event: 'csp-violation',
        documentUrl: 'https://app.example/',
        directive: 'connect-src',
        blockedUrl: 'https://evil.example/collect',
        disposition: 'enforce',
        sourceFile: 'https://app.example/assets/index-abc.js',
        line: 2,
        column: 3051,
        statusCode: 200,
      },
    ]);
    // A fragment or query never reaches the log: either can carry a token.
    expect(JSON.stringify(logged())).not.toMatch(/secret-token|leak=1|access_token/);
  });

  it('logs Reporting API violations and ignores other report types', async () => {
    const res = await post(REPORTING_API, 'application/reports+json');
    expect(res.status).toBe(204);
    expect(logged()).toEqual([
      expect.objectContaining({ documentUrl: 'https://app.example/transactions', directive: 'script-src-elem', blockedUrl: 'inline', line: 40 }),
    ]);
  });

  it('logs the single Reporting API object WebKit sends as application/csp-report', async () => {
    const res = await post(REPORTING_API[0], 'application/csp-report');
    expect(res.status).toBe(204);
    expect(logged()).toEqual([expect.objectContaining({ directive: 'script-src-elem', documentUrl: 'https://app.example/transactions' })]);
  });

  it('keeps scheme-only and keyword values, and hides free text', async () => {
    await post({ 'csp-report': { 'document-uri': 'https://app.example/', 'effective-directive': 'img-src', 'blocked-uri': 'data' } });
    await post({ 'csp-report': { 'document-uri': 'https://app.example/', 'effective-directive': 'img-src', 'blocked-uri': 'chrome-extension://abcdef/icon.png' } });
    await post({ 'csp-report': { 'document-uri': 'https://app.example/', 'effective-directive': 'img-src', 'blocked-uri': 'my card number is 4111' } });
    expect(logged().map((l) => l.blockedUrl)).toEqual(['data', 'chrome-extension://abcdef', '[other]']);
  });

  it('cuts every string to 200 characters and strips markup from text fields', async () => {
    await post({ 'csp-report': { 'document-uri': `https://app.example/${'a'.repeat(400)}`, 'effective-directive': '<script>x</script>'.repeat(30) } });
    const [line] = logged();
    expect(line.documentUrl.length).toBe(200);
    expect(line.directive.length).toBeLessThanOrEqual(200);
    expect(line.directive).not.toMatch(/[<>/]/);
  });

  it('refuses another content type (415), a body over 16 KB (413), bad JSON (400) and a body with no violation (400)', async () => {
    expect((await post(LEGACY, 'text/plain')).status).toBe(415);
    expect((await post({ 'csp-report': { pad: 'x'.repeat(17 * 1024) } })).status).toBe(413);
    expect((await post('{not json')).status).toBe(400);
    expect((await post({ hello: 'world' })).status).toBe(400);
    expect((await post([{ type: 'deprecation', body: {} }], 'application/reports+json')).status).toBe(400);
    expect(warn).not.toHaveBeenCalled();
  });

  it('takes at most 10 violations from one request', async () => {
    const many = Array.from({ length: 15 }, () => REPORTING_API[0]);
    expect((await post(many, 'application/reports+json')).status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(10);
  });

  it('lets one IP log 20 reports a minute, then answers 429 and logs nothing until the minute ends', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T00:00:00Z'));
    for (let i = 0; i < 20; i++) expect((await post(LEGACY)).status).toBe(204);
    expect((await post(LEGACY)).status).toBe(429);
    expect(warn).toHaveBeenCalledTimes(20);
    // Another caller is still counted separately.
    expect((await post(LEGACY, 'application/csp-report', '198.51.100.9')).status).toBe(204);
    vi.setSystemTime(new Date('2026-10-06T00:01:00Z'));
    expect((await post(LEGACY)).status).toBe(204);
  });

  it('caps one instance at 300 reports a minute across every caller', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T00:00:00Z'));
    for (let i = 0; i < 30; i++) {
      const many = Array.from({ length: 10 }, () => REPORTING_API[0]);
      expect((await post(many, 'application/reports+json', `192.0.2.${i}`)).status).toBe(204);
    }
    expect((await post(LEGACY, 'application/csp-report', '192.0.2.200')).status).toBe(429);
    expect(warn).toHaveBeenCalledTimes(300);
  });

  it('never logs the caller\'s IP', async () => {
    await post(LEGACY);
    expect(String(warn.mock.calls[0][0])).not.toContain('203.0.113.7');
  });
});
