$uri  = "https://uaqcehoocecvihubnbhp.supabase.co/functions/v1/firecrawl-extract"
$body = @{ url = "https://magnumsupps.com/en-us/products/quattro"; forceScrapfly = $true } | ConvertTo-Json
$response = Invoke-RestMethod -Method Post -Uri $uri -Body $body -ContentType "application/json"
$response | ConvertTo-Json -Depth 5