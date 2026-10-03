import type { ClassifyCandidate, ClassifyRequest, ClassifyResponse } from '../src/types.ts';

/**
 * Jev classification proxy.
 *
 * This exists because the browser *cannot* call TypeSafe directly, not merely
 * because it shouldn't: an `OPTIONS` preflight to
 * `https://api.typesafe.ai/v1/systemone` with `Origin: http://localhost:3000`
 * returns `400 - Disallowed CORS origin`. Keeping `TYPESAFE_API_KEY` out of the
 * client bundle is a second, independent reason. See ADR 0011.
 *
 * Vercel zero-config: the project is `framework: "vite"` on Node 24.x, so a root
 * `api/` directory is served as functions with no `vercel.json`. The
 * web-standard `(Request) => Response` handler signature is used so that no
 * `@vercel/node` dependency is needed - but it MUST be reached through a named
 * method export (`export function POST`), never `export default`. See the note
 * on `POST` below; getting this wrong hangs the endpoint silently.
 *
 * SECURITY: the client sends only free text plus candidate labels. The question
 * wording lives here and is never client-supplied. If a caller could pass
 * `instructions`/`criteria`/`model`/`state`, this endpoint would be an open
 * relay for arbitrary Jev prompts billed to this project's key.
 *
 * Who may call it is `checkCaller`'s job (ADR 0032): a guest, or a signed-in
 * caller whose token the auth server accepts. Guests are limited per IP by the
 * Vercel firewall, not here; a signed-in caller is limited per account by
 * `checkQuota` (ADR 0049).
 *
 * Never log `text` - it is ledger content.
 */

const TYPESAFE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
const UPSTREAM_TIMEOUT_MS = 8000;

/** Matches `TransactionSchema`'s description bound in `src/utils/zodSchemas.ts`. */
const MAX_TEXT_LENGTH = 255;
const MAX_CATEGORIES = 60;
const MAX_CATEGORY_NAME_LENGTH = 60;
const MAX_CATEGORY_ID_LENGTH = 64;

/**
 * Deliberately above the client's own 120-char cap (`CategorySchema`). The
 * headroom means a description a user legitimately typed can never be the
 * reason a request is rejected and classification silently disappears, while
 * the bound still closes the "pad the criteria to burn credits" vector.
 */
const MAX_CATEGORY_DESCRIPTION_LENGTH = 200;

/** Keys that would let a caller rewrite the question. Presence is a hard reject. */
const FORBIDDEN_KEYS = ['instructions', 'criteria', 'model', 'state', 'questions'];

const CATEGORY_INSTRUCTIONS =
  'This is a short note a person wrote to describe one personal-finance transaction in their own ledger. ' +
  'It may be in Thai or English, may be an abbreviation, a merchant name, or a few words. ' +
  'Which of these categories does the transaction belong to? ' +
  'Choose "other" only when none of the listed categories genuinely fit.';

const TYPE_INSTRUCTIONS =
  'This is a short note a person wrote to describe one personal-finance transaction in their own ledger. ' +
  'It may be in Thai or English. Does it describe money the person spent, or money they received?';

const TYPE_CRITERIA = {
  EXPENSE: 'Money going out: a purchase, a bill, a payment, a fee, anything the person spent.',
  INCOME: 'Money coming in: salary, a refund, a gift received, a sale, freelance payment.',
};

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// --- Server-Timing (ADR 0050) ------------------------------------------------
// Copied in `insights.ts`, like the caller check below. Change both together.
//
// Every response this function writes carries a `Server-Timing` header naming
// the steps that ran and how long each took, in milliseconds:
//   - `auth`: the `/auth/v1/user` check; `dur=0.0;desc="cached"` when the
//     token was verified in the last minute on this instance;
//   - `quota`: the `consume_ai_quota()` round trip (signed in only);
//   - `ai`: TypeSafe, until its response headers arrive;
//   - `total`: the whole handler.
// A step that did not run is absent, so a guest's header has no `auth` or
// `quota`, and a request refused before TypeSafe has no `ai`. A 429 from the
// firewall never reaches this function and carries none.

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
// Duplicated in `insights.ts` on purpose, like `json` and `isPlainObject`
// above. A shared `api/_auth.ts` would be the first runtime import between
// these functions, and whether Vercel resolves one under `"type": "module"` is
// exactly the kind of fact `tsc` and the unit suite cannot see (the default
// export lesson). Change both copies together.

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
 * Decides whether this caller may spend TypeSafe credits. Returns the caller
 * to go on, or the response to send instead. Nothing here calls TypeSafe.
 *
 * - **No `Authorization` header: a guest, allowed.** The app works signed out,
 *   and guests keep Jev. The Vercel firewall limits these requests per IP.
 * - **A header that is not `Bearer <token>`: 401.**
 * - **A token: the auth server decides** (`/auth/v1/user`, the same check as
 *   `verifySession` in the app). Refused (401/403) is 401. No answer - a
 *   timeout, a 5xx, a 429, or this deployment missing the Supabase settings -
 *   is 503: an unverified token never spends credits, and it is not the
 *   caller's fault either.
 * - A verified token is remembered for a minute, so live typing does not add
 *   an auth round-trip to every suggestion. A token revoked inside that minute
 *   keeps classifying until it passes; it can do nothing else here.
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
// Copied in `insights.ts` for the same reason as the caller check. Both
// proxies count against one `consume_ai_quota()` row per account, so a
// caller's classify and insights requests share the limit, as guests share
// the firewall's.

const AI_REQUESTS_PER_MINUTE = 120;
const QUOTA_TIMEOUT_MS = 3000;

/**
 * Counts a signed-in request against its account's limit. Returns `null` to
 * go on, or the response to send instead. Nothing here calls TypeSafe.
 *
 * - **A guest is not counted here.** The Vercel firewall limits guests per IP
 *   (ADR 0046). That rule matches only requests with no `Authorization`
 *   header, so it never sees a signed-in caller.
 * - **The count is in Supabase,** through `consume_ai_quota()` called with the
 *   caller's own token. The function reads the account from `auth.uid()`, so
 *   no account id travels, and every instance of both functions adds to the
 *   same count. A count in memory would be one per warm instance.
 * - **Past the limit is 429** with `Retry-After`. The client already treats a
 *   429 as "no suggestion this time" and switches nothing off.
 * - **A token the database refuses is 401.** One can expire inside the caller
 *   check's one-minute cache.
 * - **No answer is 503:** a timeout, a 5xx, the function missing, or a reply
 *   without a count. An uncounted request never spends credits.
 * - **Every request counts, before its body is read,** including one the proxy
 *   then rejects as malformed. That is also what lets an empty-body burst
 *   check the limit without spending credits.
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
 * Returns the validated payload, or an error string. Deliberately strict: an
 * unexpected shape is rejected rather than coerced, because every accepted
 * request spends the project's TypeSafe credits.
 */
function validate(body: unknown): { text: string; categories: ClassifyCandidate[] } | string {
  if (!isPlainObject(body)) return 'Body must be a JSON object.';

  for (const key of FORBIDDEN_KEYS) {
    if (key in body) return `Field "${key}" is not accepted; question wording is server-owned.`;
  }

  const { text, categories } = body as Partial<ClassifyRequest>;

  if (typeof text !== 'string') return 'Field "text" must be a string.';
  const trimmed = text.trim();
  if (trimmed.length === 0) return 'Field "text" must not be empty.';
  if (trimmed.length > MAX_TEXT_LENGTH) return `Field "text" exceeds ${MAX_TEXT_LENGTH} characters.`;

  if (!Array.isArray(categories)) return 'Field "categories" must be an array.';
  if (categories.length === 0) return 'Field "categories" must not be empty.';
  if (categories.length > MAX_CATEGORIES) return `At most ${MAX_CATEGORIES} categories are accepted.`;

  const clean: ClassifyCandidate[] = [];
  const seen = new Set<string>();
  for (const candidate of categories) {
    if (!isPlainObject(candidate)) return 'Each category must be an object.';
    const { id, name, description } = candidate as Partial<ClassifyCandidate>;
    if (typeof id !== 'string' || id.length === 0 || id.length > MAX_CATEGORY_ID_LENGTH) {
      return 'Each category needs a non-empty "id" string.';
    }
    if (typeof name !== 'string' || name.trim().length === 0 || name.length > MAX_CATEGORY_NAME_LENGTH) {
      return 'Each category needs a non-empty "name" string.';
    }
    // Optional. This is the one piece of client-supplied text that reaches the
    // model's question, so it is bounded and type-checked like everything else -
    // but it only ever lands inside an *option's* criteria, never the
    // instructions, and FORBIDDEN_KEYS still blocks the question wording itself.
    if (description !== undefined) {
      if (typeof description !== 'string') {
        return 'Category "description" must be a string when present.';
      }
      if (description.length > MAX_CATEGORY_DESCRIPTION_LENGTH) {
        return `A category "description" exceeds ${MAX_CATEGORY_DESCRIPTION_LENGTH} characters.`;
      }
    }
    // A duplicate id would silently collapse two options into one criteria key.
    if (seen.has(id)) return 'Category ids must be unique.';
    seen.add(id);
    const trimmedDescription = description?.trim();
    clean.push(
      trimmedDescription
        ? { id, name: name.trim(), description: trimmedDescription }
        : { id, name: name.trim() }
    );
  }

  return { text: trimmed, categories: clean };
}

/**
 * Exported as a named HTTP method, NOT as `export default`.
 *
 * This is load-bearing and was found the hard way: Vercel's Node runtime
 * invokes a *default* export with the legacy `(req, res) => void` signature and
 * **ignores any returned value**. A default export returning a `Response` never
 * writes to `res`, so the request hangs until the gateway times out - the
 * endpoint returns nothing at all, for 60s, with no error. The deployment's own
 * runtime log says so outright: "default export returned a `Response` ... returns
 * are ignored."
 *
 * A named-method export opts into the Web fetch-style API, where returning a
 * `Response` is the contract. Non-POST methods are rejected by the platform
 * before this runs, so there is no method check here.
 */
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
    // 404, not 500: an unconfigured deployment should look exactly like a
    // missing endpoint so the client trips the same availability latch and
    // falls back to keyword rules silently. See ADR 0011.
    return json({ error: 'Classification is not configured.' }, 404);
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
  const { text, categories } = validated;

  // Category ids are `cat-*` locally and uuids in Supabase, so a literal
  // "other" id cannot occur - but a collision would silently swallow the escape
  // option, so pick a sentinel that cannot collide rather than assuming.
  const otherKey = categories.some((c) => c.id === 'other') ? '__other__' : 'other';

  // A described option reads as "Housing & Utilities: Rent, electricity, water,
  // internet ... subscriptions like Netflix or Spotify" rather than as a bare
  // noun phrase. Phase 39 sent only the name, and `Netflix subscription` came
  // back as the `other` escape at 0.93 - a correct answer to a badly posed
  // question, since no default category is *named* like a subscription bucket.
  // See ADR 0012.
  const categoryCriteria: Record<string, string> = {};
  for (const candidate of categories) {
    categoryCriteria[candidate.id] = candidate.description
      ? `${candidate.name}: ${candidate.description}`
      : candidate.name;
  }
  categoryCriteria[otherKey] = 'None of the listed categories genuinely fit this note.';

  let upstream: Response;
  try {
    upstream = await timed(timings, 'ai', () => fetch(TYPESAFE_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // A bare string, matching the probes that produced the measured
        // confidences in ADR 0011. The "what is this text" framing lives in
        // the instructions, so there is nothing to name here.
        state: text,
        model: MODEL,
        // Independent questions over the same state go in ONE request - they
        // run in parallel upstream and cost one round-trip, not two.
        questions: {
          category: { type: 'choice', instructions: CATEGORY_INSTRUCTIONS, criteria: categoryCriteria },
          txtype: { type: 'choice', instructions: TYPE_INSTRUCTIONS, criteria: TYPE_CRITERIA },
        },
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    }));
  } catch {
    // Timeout or network failure. The client treats any non-200 as "no
    // suggestion", so the status here only matters for log triage.
    return json({ error: 'Classification upstream unavailable.' }, 503);
  }

  if (!upstream.ok) {
    // 429 (rate limited) and 529 (overloaded) are transient; 401 means this
    // deployment's key is wrong. The upstream body may echo request content,
    // so nothing is forwarded - only the status class.
    //
    // A 429 is passed through as 429 (ADR 0022, amending 0011): it is the one
    // status the client's batch importer backs off on. Mapping it to 503 made
    // that backoff unreachable in production. 401 stays 502 - a wrong key is
    // not something waiting will fix.
    console.error('[classify] upstream returned', upstream.status);
    const status = upstream.status === 429 ? 429 : upstream.status === 401 ? 502 : 503;
    return json({ error: 'Classification upstream error.' }, status);
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return json({ error: 'Classification upstream returned malformed JSON.' }, 502);
  }

  const answers = isPlainObject(payload) && isPlainObject(payload.answers) ? payload.answers : null;
  const category = answers && isPlainObject(answers.category) ? answers.category : null;
  const txtype = answers && isPlainObject(answers.txtype) ? answers.txtype : null;

  if (!category || !txtype) {
    return json({ error: 'Classification upstream returned an unexpected shape.' }, 502);
  }

  const chosen = typeof category.choice === 'string' ? category.choice : otherKey;
  const detectedType = txtype.choice === 'INCOME' ? 'INCOME' : 'EXPENSE';

  const response: ClassifyResponse = {
    categoryId: chosen === otherKey ? null : chosen,
    categoryConfidence: typeof category.confidence === 'number' ? category.confidence : 0,
    detectedType,
    typeConfidence: typeof txtype.confidence === 'number' ? txtype.confidence : 0,
  };

  return json(response, 200);
}
