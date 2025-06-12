$TEST_UPC_DSLD_MATCH = "7 28650 05302 2";
$encodedUpc = [uri]::EscapeDataString($TEST_UPC_DSLD_MATCH);
$resolveUpcUrl = "https://uaqcehoocecvihubnbhp.supabase.co/functions/v1/resolve-upc?upc=$encodedUpc";
$SD = Invoke-RestMethod -Uri $resolveUpcUrl -Method Get;

$scoreSupplementUrl = 'https://uaqcehoocecvihubnbhp.supabase.co/functions/v1/score-supplement';
$authHeader = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhcWNlaG9vY2VjdmlodWJuYmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNzc4ODEsImV4cCI6MjA2Mzk1Mzg4MX0.vyahdG1amAhAwm_1FTe8bHs1o7onpXMLlJsFx3IOR0U";
$apiKeyHeader = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhcWNlaG9vY2Vjdml2aGJuYmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNzc4ODEsImV4cCI6MjA2Mzk1Mzg4MX0.vyahdG1amAhAwm_1FTe8bHs1o7onpXMLlJsFx3IOR0U";

$headers = @{
    "Authorization" = $authHeader;
    "apikey" = $apiKeyHeader;
    "Content-Type" = "application/json"
};

Invoke-RestMethod -Uri $scoreSupplementUrl -Method Post -Headers $headers -Body ($SD | ConvertTo-Json -Compress);