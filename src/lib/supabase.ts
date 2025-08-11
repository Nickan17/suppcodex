import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY, assertClientEnv } from '@/env';

let _supabase: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (_supabase) {
    return _supabase;
  }

  // AUDIT: runtime env validation
  assertClientEnv();

  _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    },
  });

  return _supabase;
};

// Backward compatibility - lazy getter
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    const client = getSupabase();
    return client[prop as keyof SupabaseClient];
  }
});