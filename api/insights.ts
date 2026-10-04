import type { InsightsRequest, InsightsResponse, SpendingSummary } from '../src/types.ts';

/**
 * Monthly spending-insight proxy (ADR 0020).
 *
 * A SIBLING of `api/classify.ts`, not an action on it. That endpoint's
 * validator is shaped tightly around `text` + `categories`; forking it to
 * carry a second, differently-shaped question would weaken exactly the thing
 * it exists to protect.
 *
 * It MUST be reached through a named method export (`export function POST`),
 * never `export default`. Vercel's Node runtime invokes a default export with
 * the legacy `(req, res) => void` signature and DISCARDS the returned
 * `Response`, so the request hangs until the gateway times out - 60s, zero
 * bytes, visible only in the deployment's runtime log. This already shipped
 * once on `classify` and had to be hot-fixed. `tsc` cannot see it and the
 * Playwright suite cannot either, because the suite mocks this endpoint.
 *
 * SECURITY: the client sends only an aggregate. The question wording lives
 * here and is never client-supplied - if a caller could pass
 * `instructions`/`criteria`/`model`/`state`/`questions`, this would be an open
 * relay for arbitrary Jev prompts billed to this project's key.
 *
 * Who may call it is `checkCaller`'s job (ADR 0032), the same rule as
 * `classify.ts`, and how often is `checkQuota`'s (ADR 0049), against the same
 * per-account count.
 *
 * PRIVACY: the body carries no transaction text, no ids, no wallet names and
 * no individual amounts - see `SpendingSummary` in `src/types.ts`. Nothing
 * here is logged.
 */

const TYPESAFE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
const UPSTREAM_TIMEOUT_MS = 8000;

const MAX_CATEGORIES = 60;
const MAX_CATEGORY_NAME_LENGTH = 60;

/** Keys that would let a caller rewrite the question. Presence is a hard reject. */
const FORBIDDEN_KEYS = ['instructions', 'criteria', 'model', 'state', 'questions'];

const PATTERN_INSTRUCTIONS =
  'This is an aggregated month of one person\'s personal spending, by category, with the previous ' +
  'month alongside it for comparison. No individual transactions are included. ' +
  'Which single pattern best describes this month?';

const PATTERN_CRITERIA: Record<string, string> = {
  CATEGORY_SPIKE:
    'One category rose sharply against last month and dominates the change. Choose this when a single category is the story.',
  IMPROVED_SAVING:
    'Total spending fell meaningfully against last month, with no single category driving it. Choose this when the month is simply cheaper.',
  NEW_RECURRING:
    'A category with no previous spending has appeared several times, suggesting a new regular cost rather than a one-off purchase.',
  STEADY:
    'Nothing moved unusually. Spending is broadly in line with last month. Choose this when none of the others genuinely fit.',
};

const FOCUS_INSTRUCTIONS =
  'Given the same aggregated month, which single spending category is most worth drawing the person\'s attention to? ' +
  'Choose "none" when the month is better described as a whole than by any one category.';

const NONE_KEY = 'none';

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    // `no-store` matches `classify.ts`: a verdict is about one user's month
    // and must never be served from a shared cache.
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

/**
 * The wait TypeSafe asked for on its own 429, as delay-seconds, or undefined
 * (ADR 0053). A copy of `classify.ts`'s; change both together.
 */
function upstreamRetryAfter(res: Response, now = Date.now()): string | undefined {
  const seconds = (s: number) => String(Math.min(Math.ceil(s), 86_400));
  const ms = res.headers.get('retry-after-ms')?.trim();
  if (ms && /^\d+(\.\d+)?$/.test(ms)) return seconds(Number(ms) / 1000);
  const value = res.headers.get('retry-after')?.trim();
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return seconds(Number(value));
  const at = Date.parse(value);
  if (Number.isNaN(at) || at <= now) return undefined;
  return seconds((at - now) / 1000);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

// --- Server-Timing (ADR 0050) ------------------------------------------------
// A copy of `classify.ts`'s; see the note there. Change both copies together.

/** One request's measured steps, in the order they finished. */
type Timings = Array<{ name: 'auth' | 'quota' | 'ai' | 'total'; dur: number; desc?: string }>;

/** Awaits `step` and records how long it took under `name`, whether it resolved or threw. */
async function timed<T>(timings: Timings, name: Timings[number]['name'], step: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await step();
  } finally {
    timings.push({ name, dur: performance.now() - start });
  }
}

function serverTimingHeader(timings: Timings): string {
  return timings
    .map(({ name, dur, desc }) => `${name};dur=${dur.toFixed(1)}${desc ? `;desc="${desc}"` : ''}`)
    .join(', ');
}

// --- Caller check (ADR 0032) -------------------------------------------------
// A copy of `classify.ts`'s, on purpose: see the note there on why the two
// functions share no runtime module. Change both copies together.

const AUTH_TIMEOUT_MS = 3000;
const VERIFIED_TOKEN_TTL_MS = 60_000;
const MAX_VERIFIED_TOKENS = 500;

/** Access tokens the auth server accepted recently, to their expiry (ms). Per warm instance only. */
const verifiedTokens = new Map<string, number>();

/** A caller allowed to go on: its access token, or `null` for a guest. */
interface Caller {
  token: string | null;
}

/**
 * Returns the caller to go on, or the response to send instead. No header is a
 * guest (limited per IP by the Vercel firewall); a malformed header or a token
 * the auth server refuses is 401; no answer from it is 503. See `classify.ts`.
 */
async function checkCaller(req: Request, timings: Timings): Promise<Response | Caller> {
  const header = req.headers.get('Authorization');
  if (header === null) return { token: null };

  // The scheme is case-insensitive (RFC 7235); the token is one run of non-space.
  const match = /^Bearer (\S+)$/i.exec(header);
  if (!match) return json({ error: 'Unauthorized.' }, 401);
  const token = match[1];

  const now = Date.now();
  const expiry = verifiedTokens.get(token);
  if (expiry !== undefined && expiry > now) {
    timings.push({ name: 'auth', dur: 0, desc: 'cached' });
    return { token };
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return json({ error: 'Sign-in check unavailable.' }, 503);

  let res: Response;
  try {
    res = await timed(timings, 'auth', () =>
      fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/user`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
      })
    );
  } catch {
    return json({ error: 'Sign-in check unavailable.' }, 503);
  }

  if (res.status === 401 || res.status === 403) return json({ error: 'Unauthorized.' }, 401);
  if (!res.ok) return json({ error: 'Sign-in check unavailable.' }, 503);

  if (verifiedTokens.size >= MAX_VERIFIED_TOKENS) verifiedTokens.clear();
  verifiedTokens.set(token, now + VERIFIED_TOKEN_TTL_MS);
  return { token };
}

// --- Per-account limit (ADR 0049) --------------------------------------------
// A copy of `classify.ts`'s; see the note there. Change both copies together.

const AI_REQUESTS_PER_MINUTE = 120;
const QUOTA_TIMEOUT_MS = 3000;

/**
 * Counts a signed-in request against its account's limit, shared with
 * `/api/classify`. Returns `null` to go on, or the response to send instead.
 * A guest is not counted (the firewall's rule); past the limit is 429 with
 * `Retry-After`; a token the database refuses is 401; no answer is 503.
 */
async function checkQuota(token: string | null): Promise<Response | null> {
  if (token === null) return null;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return json({ error: 'Usage check unavailable.' }, 503);

  let res: Response;
  try {
    res = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/consume_ai_quota`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(QUOTA_TIMEOUT_MS),
    });
  } catch {
    return json({ error: 'Usage check unavailable.' }, 503);
  }

  if (res.status === 401) return json({ error: 'Unauthorized.' }, 401);
  if (!res.ok) return json({ error: 'Usage check unavailable.' }, 503);

  let usage: unknown;
  try {
    usage = await res.json();
  } catch {
    return json({ error: 'Usage check unavailable.' }, 503);
  }
  if (!isPlainObject(usage) || typeof usage.count !== 'number' || !Number.isFinite(usage.count)) {
    return json({ error: 'Usage check unavailable.' }, 503);
  }

  if (usage.count > AI_REQUESTS_PER_MINUTE) {
    const wait = usage.retry_after;
    const retryAfter = typeof wait === 'number' && wait > 0 && wait <= 60 ? Math.ceil(wait) : 60;
    return json({ error: 'Too many requests.' }, 429, { 'Retry-After': String(retryAfter) });
  }
  return null;
}

/**
 * Validates the aggregate. Bounds exist so a caller cannot pad the criteria to
 * burn credits, and so a malformed summary produces a 400 rather than a
 * confusing upstream answer.
 */
function validate(body: unknown): SpendingSummary | string {
  if (!isPlainObject(body)) return 'Body must be a JSON object.';

  for (const key of FORBIDDEN_KEYS) {
    if (key in body) return `Field "${key}" is not accepted; question wording is server-owned.`;
  }

  const { summary } = body as Partial<InsightsRequest>;
  if (!isPlainObject(summary)) return 'Field "summary" is required.';

  if (typeof summary.month !== 'string' || !/^\d{4}-\d{2}$/.test(summary.month)) {
    return 'Field "summary.month" must be YYYY-MM.';
  }

  if (!Array.isArray(summary.categories)) return 'Field "summary.categories" must be an array.';
  if (summary.categories.length === 0) return 'Field "summary.categories" must not be empty.';
  if (summary.categories.length > MAX_CATEGORIES) return `At most ${MAX_CATEGORIES} categories.`;

  const seen = new Set<string>();
  for (const raw of summary.categories) {
    if (!isPlainObject(raw)) return 'Each category must be an object.';
    const { name, current, previous, txCount } = raw;
    if (typeof name !== 'string' || name.trim().length === 0) return 'Each category needs a name.';
    if (name.length > MAX_CATEGORY_NAME_LENGTH) return 'A category name is too long.';
    // A duplicate name would silently collapse two options into one criteria key.
    if (seen.has(name)) return 'Category names must be unique.';
    seen.add(name);
    if (!isFiniteNumber(current) || !isFiniteNumber(previous) || !isFiniteNumber(txCount)) {
      return 'Category totals must be finite numbers.';
    }
  }

  if (!isPlainObject(summary.totals)) return 'Field "summary.totals" is required.';
  const { income, expense, net, previousExpense } = summary.totals;
  if (
    !isFiniteNumber(income) ||
    !isFiniteNumber(expense) ||
    !isFiniteNumber(net) ||
    !isFiniteNumber(previousExpense)
  ) {
    return 'Totals must be finite numbers.';
  }

  return summary as unknown as SpendingSummary;
}

/** Renders the aggregate as the compact text Jev reasons over. No raw ledger content. */
function toState(summary: SpendingSummary): string {
  const lines = summary.categories.map((c) => {
    const delta =
      c.changePercent === null
        ? 'no prior month'
        : `${c.changePercent >= 0 ? '+' : ''}${Math.round(c.changePercent)}% vs last month`;
    return `- ${c.name}: ${c.current.toFixed(2)} this month (${c.previous.toFixed(2)} last month, ${delta}), ${c.txCount} transactions`;
  });

  return [
    `Month: ${summary.month}`,
    `Total spending: ${summary.totals.expense.toFixed(2)} (last month: ${summary.totals.previousExpense.toFixed(2)})`,
    `Total income: ${summary.totals.income.toFixed(2)}`,
    `Net: ${summary.totals.net.toFixed(2)}`,
    'By category:',
    ...lines,
  ].join('\n');
}

export async function POST(req: Request): Promise<Response> {
  const timings: Timings = [];
  const start = performance.now();
  const res = await handle(req, timings);
  timings.push({ name: 'total', dur: performance.now() - start });
  res.headers.set('Server-Timing', serverTimingHeader(timings));
  return res;
}

async function handle(req: Request, timings: Timings): Promise<Response> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    // 404, not 500: an unconfigured deployment must look exactly like a
    // missing endpoint so the client trips its availability latch and falls
    // back to the local pattern silently. Same reasoning as ADR 0011.
    return json({ error: 'Insights are not configured.' }, 404);
  }

  const caller = await checkCaller(req, timings);
  if (caller instanceof Response) return caller;

  const { token } = caller;
  const limited = token === null ? null : await timed(timings, 'quota', () => checkQuota(token));
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body must be valid JSON.' }, 400);
  }

  const validated = validate(body);
  if (typeof validated === 'string') {
    return json({ error: validated }, 400);
  }
  const summary = validated;

  // Category names are the option keys so the answer round-trips as a name the
  // client can match. A category literally called "none" would collide with
  // the escape option, so pick a sentinel that cannot.
  const noneKey = summary.categories.some((c) => c.name === NONE_KEY) ? '__none__' : NONE_KEY;

  const focusCriteria: Record<string, string> = {};
  for (const category of summary.categories) {
    focusCriteria[category.name] = `${category.name}: ${category.current.toFixed(2)} spent across ${category.txCount} transactions this month.`;
  }
  focusCriteria[noneKey] = 'No single category is the story; the month is better described as a whole.';

  let upstream: Response;
  try {
    upstream = await timed(timings, 'ai', () => fetch(TYPESAFE_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        state: toState(summary),
        model: MODEL,
        // Both questions over the same state in ONE request - they run in
        // parallel upstream and cost one round-trip, not two.
        questions: {
          pattern: { type: 'choice', instructions: PATTERN_INSTRUCTIONS, criteria: PATTERN_CRITERIA },
          focus: { type: 'choice', instructions: FOCUS_INSTRUCTIONS, criteria: focusCriteria },
        },
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    }));
  } catch {
    return json({ error: 'Insights upstream unavailable.' }, 503);
  }

  if (!upstream.ok) {
    // The upstream body may echo request content, so nothing is forwarded.
    // 429 passes through as 429, with TypeSafe's wait when it gave one, for
    // the same reason as in `classify.ts` (ADR 0022, ADR 0053); the client
    // falls back to the local verdict either way.
    console.error('[insights] upstream returned', upstream.status);
    if (upstream.status === 429) {
      const retryAfter = upstreamRetryAfter(upstream);
      return json({ error: 'Insights upstream error.' }, 429, retryAfter === undefined ? {} : { 'Retry-After': retryAfter });
    }
    return json({ error: 'Insights upstream error.' }, upstream.status === 401 ? 502 : 503);
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return json({ error: 'Insights upstream returned malformed JSON.' }, 502);
  }

  const answers = isPlainObject(payload) && isPlainObject(payload.answers) ? payload.answers : null;
  const pattern = answers && isPlainObject(answers.pattern) ? answers.pattern : null;
  const focus = answers && isPlainObject(answers.focus) ? answers.focus : null;

  if (!pattern || !focus) {
    return json({ error: 'Insights upstream returned an unexpected shape.' }, 502);
  }

  // An unrecognized choice degrades to STEADY rather than 502ing: the client
  // can always render STEADY, and a usable card beats an error.
  const chosenPattern =
    typeof pattern.choice === 'string' && pattern.choice in PATTERN_CRITERIA
      ? (pattern.choice as InsightsResponse['pattern'])
      : 'STEADY';

  const chosenFocus =
    typeof focus.choice === 'string' && focus.choice !== noneKey && focus.choice in focusCriteria
      ? focus.choice
      : null;

  const response: InsightsResponse = {
    pattern: chosenPattern,
    focus: chosenFocus,
    confidence: isFiniteNumber(pattern.confidence) ? pattern.confidence : 0,
  };

  return json(response, 200);
}
