// Debug test to check what supabase.functions.invoke actually sends
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uaqcehoocecvihubnbhp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhcWNlaG9vY2VjdmlodWJuYmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3MjA1OTMsImV4cCI6MjA2NjI5NjU5M30.kMkQqOqYAM4lopFBl7wVpff2F_tIzI24eGSHZ1eU3z4';

// Test configured client (like our app uses)
const supabaseConfigured = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
  }
});

// Test basic client (what we had before)
const supabaseBasic = createClient(supabaseUrl, supabaseAnonKey);

console.log('Testing configured client...');
try {
  const result1 = await supabaseConfigured.functions.invoke('firecrawl-extract', {
    body: { url: 'https://magnumsupps.com/en-us/products/quattro' }
  });
  console.log('Configured client result:', result1.error || 'SUCCESS');
  if (result1.error) {
    console.log('Full error details:', result1);
  }
} catch (error) {
  console.log('Configured client error:', error.message);
  if (error.context) {
    const text = await error.context.text();
    console.log('Response body:', text);
  }
}

console.log('Testing basic client...');
try {
  const result2 = await supabaseBasic.functions.invoke('firecrawl-extract', {
    body: { url: 'https://magnumsupps.com/en-us/products/quattro' }
  });
  console.log('Basic client result:', result2.error || 'SUCCESS');
} catch (error) {
  console.log('Basic client error:', error.message);
}