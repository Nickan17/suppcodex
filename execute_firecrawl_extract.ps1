$headers = @{
  'Content-Type' = 'application/json'
  # 'Authorization' = 'Bearer <YOUR_FIRECRAWL_KEY>'   # only if you left JWT on
}

$body = @{
  url = 'https://www.transparentlabs.com/products/bulk-preworkout'
} | ConvertTo-Json -Compress

Invoke-RestMethod `
  -Method POST `
  -Uri 'https://uaqcehoocecvihubnbhp.supabase.co/functions/v1/firecrawl-extract' `
  -Headers $headers `
  -Body $body