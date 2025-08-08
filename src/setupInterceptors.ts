// Runtime fetch interception for debugging "only POST supported" errors
// This wrapper logs all fetch calls to Supabase Edge Functions

const _fetch = global.fetch;

global.fetch = async (...args) => {
  const [resource, init] = args;
  
  // Log all function calls to Supabase Edge Functions
  if (typeof resource === 'string' && resource.includes('/functions/v1')) {
    console.log('🚨 [DEBUG fetch] URL:', resource);
    console.log('🚨 [DEBUG fetch] Method:', init?.method || 'GET (default)');
    console.log('🚨 [DEBUG fetch] Headers:', init?.headers);
    console.log('🚨 [DEBUG fetch] Body:', init?.body ? 'Present' : 'None');
    console.log('🚨 [DEBUG fetch] Full init:', init);
    
    // Log stack trace to see where this call originated
    console.log('🚨 [DEBUG fetch] Call stack:', new Error().stack?.split('\n').slice(1,4).join('\n'));
  }
  
  return _fetch(...args);
};

console.log('[setupInterceptors] 🔍 Enhanced fetch interception enabled for /functions/v1 calls');