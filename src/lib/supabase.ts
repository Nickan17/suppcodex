import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get config from Constants with fallback to process.env
interface ExpoConfig {
  extra?: {
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

let _supabase: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (_supabase) {
    return _supabase;
  }

  const config: ExpoConfig = Constants.expoConfig || {};
  const supabaseUrl = (config.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL) as string;
  const supabaseAnonKey = (config.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) as string;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase configuration is missing. ' +
      'Please ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY ' +
      'are set in your .env file and exposed in app.config.ts.'
    );
  }

  _supabase = createClient(supabaseUrl, supabaseAnonKey, {
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