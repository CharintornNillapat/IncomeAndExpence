import { createClient } from '@supabase/supabase-js';

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
 * The placeholder values below only exist so `createClient` returns a
 * correctly-shaped object and importing this module never throws. Nothing is
 * sent to that address: session persistence and token refresh are switched off
 * when unconfigured, and callers check `isSupabaseConfigured` first.
 */
export const supabase = createClient(
  SUPABASE_URL || 'http://supabase-not-configured.invalid',
  SUPABASE_ANON_KEY || 'supabase-not-configured',
  {
    auth: {
      persistSession: isSupabaseConfigured,
      autoRefreshToken: isSupabaseConfigured,
      detectSessionInUrl: isSupabaseConfigured,
    },
    global: { fetch: fetchReportingUnauthorized },
  }
);
