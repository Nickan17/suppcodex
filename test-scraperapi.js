const axios = require('axios');

async function testScraperAPI() {
  // Test with the original URL now that we know the API key works
  const targetUrl = 'https://magnumsupps.com/en-us/products/quattro';
  const apiKey = '3acafccdfa854888f56779d270d2a08e';
  const encodedUrl = encodeURIComponent(targetUrl);
  const apiUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodedUrl}&render=true`;

  console.log('Testing ScraperAPI with URL:', targetUrl);
  
  try {
    console.log('Making request to:', `http://api.scraperapi.com?api_key=${apiKey}&url=${encodedUrl}&render=true`);
    
    const response = await axios.get(apiUrl, {
      timeout: 60000, // 60 seconds timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive'
      },
      maxRedirects: 5
    });
    
    console.log('Status Code:', response.status);
    console.log('Response Length:', response.data.length);
    console.log('First 500 characters of response:');
    console.log(response.data.substring(0, 500));
    
    // Check if the response contains expected content
    if (response.data.includes('Quattro') || response.data.includes('quattro')) {
      console.log('✅ Success: Found expected content in response');
    } else {
      console.log('⚠️ Warning: Expected content not found in response');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testScraperAPI();
