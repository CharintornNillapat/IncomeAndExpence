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
  }
);
