import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://rmpnzlcufeioxmgoocpt.supabase.co';

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtcG56bGN1ZmVpb3htZ29vY3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMTU2MTEsImV4cCI6MjEwMzY5MTYxMX0.MrndtwsZDMduDPyHQ3QUw4dsR3sTquQ9ymlVCuIB5Cs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
