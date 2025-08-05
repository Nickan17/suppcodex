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

  const parsed = ex.data?.parsed;
  const meta = ex.data?._meta;

  if (!parsed) {
    return {
      ok: false,
      status: 422,
      message: meta?.status ? `Extraction failed: ${meta.status}` : 'Extraction failed: missing parsed',
    };
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('Sending to score-supplement:', { hasParsed: !!parsed, title: parsed?.title });
  }

  return await invoke('score-supplement', { data: { parsed } });
} 