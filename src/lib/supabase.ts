import type { SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Whether cloud sync is available.
 *
 * These used to fall back to a real project's URL and anon key, which meant a
 * checkout without a `.env` silently read and wrote that project's live data.
 * There is no fallback now: without both variables the app stays in the offline
 * Local Storage Mode it already supports, and no request is ever sent.
 *
 * Callers must gate every network entry point on this flag.
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are not set. ' +
      'Running in offline Local Storage Mode - data stays in this browser and ' +
      'cloud sync is disabled. Copy .env.example to .env to enable it.'
  );
}

const unauthorizedListeners = new Set<() => void>();

/**
 * Calls `listener` whenever the Data API (PostgREST tables and RPCs) answers
 * 401 - the access token was refused. Returns the unsubscribe function.
 *
 * Every table read, write and RPC in the app goes through the client's fetch,
 * so this is the one place a 401 can be seen without checking each call site.
 * A 401 is a reason to ask the auth server, not proof of a sign-out: it also
 * happens when a token expires in transit (ADR 0024, amended).
 */
export function onDataApiUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

// Auth endpoints (`/auth/v1/`) are left out: supabase-js handles its own 401s.
const fetchReportingUnauthorized: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.status === 401 && requestUrl(input).includes('/rest/v1/')) {
    for (const listener of unauthorizedListeners) listener();
  }
  return response;
};

/**
 * Where supabase-js keeps the session: its own default key, worked out the
 * way it does (`sb-<first label of the project host>-auth-token`), so no
 * existing session moves and nobody is signed out (ADR 0083).
 */
const AUTH_STORAGE_KEY = isSupabaseConfigured ? `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token` : '';

/**
 * The client, once `loadSupabase()` has made it (Phase 107, ADR 0083): until
 * then a guest's first load does not fetch supabase-js at all. A live binding,
 * so every call site reads the client once it exists. Only code that runs
 * signed in may use it directly - a session exists only after the client
 * loaded - and everything else awaits `loadSupabase()`.
 */
export let supabase: SupabaseClient;

let loading: Promise<SupabaseClient> | null = null;
const loadListeners = new Set<(client: SupabaseClient) => void>();

/**
 * Imports supabase-js and makes the one client, on the first call; every call
 * gets the same promise. A failed import (offline before the chunk was ever
 * cached) is not remembered, so the next call tries again.
 *
 * The placeholder values below only exist so `createClient` returns a
 * correctly-shaped object. Nothing is sent to that address: session
 * persistence and token refresh are switched off when unconfigured, and
 * callers check `isSupabaseConfigured` first.
 */
export function loadSupabase(): Promise<SupabaseClient> {
  loading ??= import('@supabase/supabase-js').then(
    ({ createClient }) => {
      supabase = createClient(
        SUPABASE_URL || 'http://supabase-not-configured.invalid',
        SUPABASE_ANON_KEY || 'supabase-not-configured',
        {
          auth: {
            persistSession: isSupabaseConfigured,
            autoRefreshToken: isSupabaseConfigured,
            detectSessionInUrl: isSupabaseConfigured,
          },
          global: { fetch: fetchReportingUnauthorized },
        },
      );
      for (const listener of loadListeners) listener(supabase);
      return supabase;
    },
    (err: unknown) => {
      loading = null;
      throw err;
    },
  );
  return loading;
}

/**
 * Calls `listener` with the client once it is loaded - at once if it already
 * is. Returns the unsubscribe function.
 */
export function whenSupabaseLoads(listener: (client: SupabaseClient) => void): () => void {
  if (supabase) listener(supabase);
  else loadListeners.add(listener);
  return () => {
    loadListeners.delete(listener);
  };
}

/**
 * Whether this load may have a session to resume, so the client is needed at
 * boot: one stored under supabase-js's key, or an auth redirect in the URL (a
 * confirmation or recovery link, `detectSessionInUrl`). Storage that cannot be
 * read counts as yes: a signed-in device must never be taken for a guest.
 */
export function sessionMayExist(): boolean {
  if (!isSupabaseConfigured) return false;
  try {
    if (localStorage.getItem(AUTH_STORAGE_KEY)) return true;
  } catch {
    return true;
  }
  return /(^|[#?&])(access_token|refresh_token|error_description|code)=/.test(window.location.hash + window.location.search);
}

if (isSupabaseConfigured && typeof window !== 'undefined') {
  // A device with a session starts fetching the client as the entry runs, not
  // a render later in the provider's effect: it is no longer preloaded beside
  // the entry, so this is the earliest the request can go.
  if (sessionMayExist()) void loadSupabase().catch(() => {});

  // Another tab signing in writes the session here; this tab loads the client,
  // whose own cross-tab sync then reports the sign-in (FinanceContext listens).
  window.addEventListener('storage', (event) => {
    if (event.key === AUTH_STORAGE_KEY && event.newValue) void loadSupabase().catch(() => {});
  });
}

// supabase-js's own `isAuthApiError` and `isAuthSessionMissingError`, by the
// same duck-typed check (`__isAuthError` and the error's name), so the
// provider can tell a rejected session apart without importing the library.
function isAuthError(error: unknown): error is { __isAuthError: true; name: string; status?: number; code?: string } {
  return typeof error === 'object' && error !== null && '__isAuthError' in error;
}

export function isAuthApiError(error: unknown): error is { name: 'AuthApiError'; status?: number; code?: string } {
  return isAuthError(error) && error.name === 'AuthApiError';
}

export function isAuthSessionMissingError(error: unknown): boolean {
  return isAuthError(error) && error.name === 'AuthSessionMissingError';
}

/**
 * `{ Authorization: 'Bearer <access token>' }` while signed in, `{}` otherwise
 * - for the app's own `/api/*` proxies, which verify the token (ADR 0032). A
 * guest sends no header and is limited per IP instead.
 *
 * Never throws: the proxies' callers promise not to (ADR 0011, 0020), and a
 * failed session read simply sends the request as a guest.
 */
export async function authorizationHeader(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured) return {};
  // A guest with no client and nothing stored has no session to send, and
  // asking would fetch supabase-js for nothing (ADR 0083).
  if (!supabase && !sessionMayExist()) return {};
  try {
    const { data } = await (await loadSupabase()).auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
