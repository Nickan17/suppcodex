import { supabase } from '../lib/supabase';

export async function invokeEdgeFunction(name: string, body: any) {
  try {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) {
      // Assuming error is EdgeFunctionError
      return {
        ok: false,
        status: error.code || 500,
        message: error.message || 'Edge function error'
      };
    }
    return { ok: true, data };
  } catch (err: any) {
    return {
      ok: false,
      status: 500,
      message: err.message || 'Unexpected error'
    };
  }
}

export type InvokeFn = <T=any>(name: string, body: unknown) => Promise<{ ok: boolean; status: number; data?: T; message?: string }>;

export async function chainExtractToScore(url: string, deps: { invoke?: InvokeFn } = {}) {
  const invoke = deps.invoke ?? invokeEdgeFunction;
  const ex = await invoke('firecrawl-extract', { url });
  if (!ex.ok) {
    return { ok: false, status: ex.status ?? 500, message: ex.message ?? 'Extraction failed' };
  }

  // firecrawl-extract returns parsed data directly at root level, not nested under 'parsed'
  const parsed = ex.data;
  const meta = ex.data?._meta;

  // Check if we have meaningful parsed data (title, ingredients, or supplement facts)
  const hasTitle = parsed?.title && parsed.title.trim().length > 0;
  const hasIngredients = parsed?.ingredients_raw && parsed.ingredients_raw.length >= 100;
  const hasSupplementFacts = parsed?.supplement_facts && parsed.supplement_facts.length >= 300;

  if (!parsed || (!hasTitle && !hasIngredients && !hasSupplementFacts)) {
    return {
      ok: false,
      status: 422,
      message: meta?.status ? `Extraction failed: ${meta.status}` : 'Extraction failed: insufficient data',
    };
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('Sending to score-supplement:', { hasParsed: !!parsed, title: parsed?.title });
  }

  return await invoke('score-supplement', { data: { parsed } });
} 