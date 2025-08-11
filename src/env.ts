import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? (Constants as any).manifest?.extra ?? {}) as any;

export const SUPABASE_URL: string = extra.supabaseUrl;
export const SUPABASE_ANON_KEY: string = extra.supabaseAnonKey;
export const FIRECRAWL_EXTRACT_URL: string = extra.firecrawlExtractUrl;
export const SCORE_SUPPLEMENT_URL: string = extra.scoreSupplementUrl;
export const OPENROUTER_API_KEY: string = extra.openrouterApiKey ?? '';

export function assertClientEnv() {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!SUPABASE_ANON_KEY) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!FIRECRAWL_EXTRACT_URL) missing.push('EXPO_PUBLIC_FIRECRAWL_EXTRACT_URL');
  if (!SCORE_SUPPLEMENT_URL) missing.push('EXPO_PUBLIC_SCORE_SUPPLEMENT_URL');

  if (missing.length) {
    throw new Error(`Missing public envs: ${missing.join(', ')}. Check .env and app.config.ts`);
  }
} 