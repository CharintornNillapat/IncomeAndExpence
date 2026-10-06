/**
 * Content Security Policy violation reports (ADR 0071).
 *
 * The policy is enforced (ADR 0070), so a blocked request breaks something for
 * the visitor and shows only in their own console. Browsers send each violation
 * here, and this logs one structured line per violation to the function's
 * runtime log, where `vercel logs` or the dashboard can find it.
 *
 * Three shapes arrive (seen from Playwright's browsers in Phase 95):
 * - Firefox, through `report-to`: `application/reports+json`, an array of
 *   `{ type: "csp-violation", body: { documentURL, effectiveDirective, ... } }`;
 * - WebKit, through `report-uri`: one such object, labelled
 *   `application/csp-report`;
 * - the CSP2 form older browsers send to `report-uri`: `application/csp-report`,
 *   `{ "csp-report": { "document-uri", "effective-directive", ... } }`.
 *
 * Nobody signs a report and anybody can post one, so nothing here is trusted:
 * - the body is capped at 16 KB and 10 reports a request;
 * - every logged string is cut to 200 characters, and a URL is logged as its
 *   origin and path only, because a query or fragment can carry a token (a
 *   Supabase sign-in link puts one in the fragment);
 * - a caller's IP may log 20 reports a minute and an instance 300, past which
 *   the reports are dropped with 429 and nothing is logged.
 *
 * ponytail: the limits live in this instance's memory, so N warm instances
 * accept N times as much. That bounds log volume, which is all a report costs;
 * move the count to the firewall or the database if reports ever cost more.
 *
 * Like the proxies, it is reached through a named `POST` export, never
 * `export default` (CLAUDE.md: a default export hangs on Vercel). It calls no
 * other service.
 */

const MAX_BODY_BYTES = 16 * 1024;
const MAX_REPORTS_PER_REQUEST = 10;
const MAX_FIELD_LENGTH = 200;
const WINDOW_MS = 60_000;
const MAX_PER_IP = 20;
const MAX_PER_INSTANCE = 300;

const ACCEPTED_TYPES = ['application/csp-report', 'application/reports+json', 'application/json'];

interface Violation {
  documentUrl: string;
  directive: string;
  blockedUrl: string;
  disposition: string;
  sourceFile: string;
  line: number | null;
  column: number | null;
  statusCode: number | null;
}

let windowStart = 0;
let instanceCount = 0;
const perIp = new Map<string, number>();

/** Counts `n` reports against the caller and the instance; false once either is over. */
function withinLimit(ip: string, n: number, now: number): boolean {
  if (now - windowStart >= WINDOW_MS) {
    windowStart = now;
    instanceCount = 0;
    perIp.clear();
  }
  const ipCount = perIp.get(ip) ?? 0;
  if (ipCount + n > MAX_PER_IP || instanceCount + n > MAX_PER_INSTANCE) return false;
  perIp.set(ip, ipCount + n);
  instanceCount += n;
  return true;
}

function clip(value: string): string {
  return value.length > MAX_FIELD_LENGTH ? value.slice(0, MAX_FIELD_LENGTH) : value;
}

/**
 * A URL keeps its origin and path; a scheme-only value (`data`, `blob:`), a
 * keyword (`inline`, `eval`) or an extension's origin keeps its text. Anything
 * else is `[other]`, so free text never reaches the log.
 */
function safeUrl(raw: unknown): string {
  if (typeof raw !== 'string' || raw === '') return '';
  try {
    const url = new URL(raw);
    if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) return clip(url.origin + url.pathname);
    return clip(url.host ? `${url.protocol}//${url.host}` : url.protocol);
  } catch {
    return /^[a-z][a-z0-9+.-]*:?$/i.test(raw) ? clip(raw) : '[other]';
  }
}

function safeText(raw: unknown): string {
  return typeof raw === 'string' ? clip(raw.replace(/[^\w .:'-]/g, '')) : '';
}

function safeNumber(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

/** The two report formats, read into one shape; anything else is no violation. */
function violations(payload: unknown): Violation[] {
  const fromLegacy = (r: Record<string, unknown>): Violation => ({
    documentUrl: safeUrl(r['document-uri']),
    directive: safeText(r['effective-directive'] ?? r['violated-directive']),
    blockedUrl: safeUrl(r['blocked-uri']),
    disposition: safeText(r['disposition']),
    sourceFile: safeUrl(r['source-file']),
    line: safeNumber(r['line-number']),
    column: safeNumber(r['column-number']),
    statusCode: safeNumber(r['status-code']),
  });
  const fromReportingApi = (b: Record<string, unknown>): Violation => ({
    documentUrl: safeUrl(b.documentURL),
    directive: safeText(b.effectiveDirective),
    blockedUrl: safeUrl(b.blockedURL),
    disposition: safeText(b.disposition),
    sourceFile: safeUrl(b.sourceFile),
    line: safeNumber(b.lineNumber),
    column: safeNumber(b.columnNumber),
    statusCode: safeNumber(b.statusCode),
  });
  const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

  const isViolation = (r: unknown): r is { body: Record<string, unknown> } =>
    isObject(r) && r.type === 'csp-violation' && isObject(r.body);

  if (Array.isArray(payload)) return payload.filter(isViolation).map((r) => fromReportingApi(r.body));
  // WebKit sends one Reporting API object, labelled `application/csp-report`.
  if (isViolation(payload)) return [fromReportingApi(payload.body)];
  if (isObject(payload) && isObject(payload['csp-report'])) {
    return [fromLegacy(payload['csp-report'])];
  }
  return [];
}

export async function POST(request: Request): Promise<Response> {
  const type = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!ACCEPTED_TYPES.includes(type)) return new Response(null, { status: 415 });

  const declared = Number(request.headers.get('content-length'));
  if (declared > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }

  const found = violations(payload).slice(0, MAX_REPORTS_PER_REQUEST);
  if (found.length === 0) return new Response(null, { status: 400 });

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (!withinLimit(ip, found.length, Date.now())) return new Response(null, { status: 429 });

  for (const v of found) console.warn(JSON.stringify({ event: 'csp-violation', ...v }));
  return new Response(null, { status: 204 });
}
