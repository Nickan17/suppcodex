// Test raw fetch vs supabase client
const fetch = globalThis.fetch;

const url = 'https://uaqcehoocecvihubnbhp.supabase.co/functions/v1/firecrawl-extract';
const headers = {
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhcWNlaG9vY2VjdmlodWJuYmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3MjA1OTMsImV4cCI6MjA2NjI5NjU5M30.kMkQqOqYAM4lopFBl7wVpff2F_tIzI24eGSHZ1eU3z4',
  'Content-Type': 'application/json',
  'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhcWNlaG9vY2VjdmlodWJuYmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3MjA1OTMsImV4cCI6MjA2NjI5NjU5M30.kMkQqOqYAM4lopFBl7wVpff2F_tIzI24eGSHZ1eU3z4'
};

const body = JSON.stringify({ url: 'https://example.com' });

console.log('Testing raw fetch...');
console.log('URL:', url);
console.log('Method: POST');
console.log('Headers:', headers);
console.log('Body:', body);

try {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body
  });
  
  console.log('Response status:', response.status);
  console.log('Response headers:', Object.fromEntries(response.headers.entries()));
  
  const text = await response.text();
  console.log('Response body:', text);
  
} catch (error) {
  console.log('Fetch error:', error.message);
}