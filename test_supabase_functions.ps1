$TEST_UPC_DSLD_MATCH = "7 28650 05302 2";
$encodedUpc = [uri]::EscapeDataString($TEST_UPC_DSLD_MATCH);
$resolveUpcUrl = "$env:SUPABASE_URL/functions/v1/resolve-upc?upc=$encodedUpc";
$SD = Invoke-RestMethod -Uri $resolveUpcUrl -Method Get;

$scoreSupplementUrl = "$env:SUPABASE_URL/functions/v1/score-supplement";
$authHeader = "Bearer $env:SUPABASE_ANON_KEY";
$apiKeyHeader = "$env:SUPABASE_ANON_KEY";

$headers = @{
    "Authorization" = $authHeader;
    "apikey" = $apiKeyHeader;
    "Content-Type" = "application/json"
};

Invoke-RestMethod -Uri $scoreSupplementUrl -Method Post -Headers $headers -Body ($SD | ConvertTo-Json -Compress);