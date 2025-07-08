<#
Test the full-score-from-upc Supabase Edge Function
Usage:
    ./test_full_score.ps1 [UPC] [JWT]

Examples
    # dev (functions deployed with --no-verify-jwt)
    ./test_full_score.ps1 850017020276

    # prod / staging (JWT verification ON)
    ./test_full_score.ps1 850017020276 eyJhbGciOi...<token>

A one-liner curl alternative (requires body.json):
    '{ "upc": "850017020276" }' | Set-Content body.json -Encoding UTF8
    curl.exe --globoff -X POST `
      "https://uaqcehoocecvihubnbhp.supabase.co/functions/v1/full-score-from-upc" `
      -H "Content-Type: application/json" `
      --data "@body.json" `
      -H "Authorization: Bearer <JWT_IF_NEEDED>"
#>

param(
  [string]$Upc = "850017020276",
  [string]$Jwt = ""
)

$headers = @{ "Content-Type" = "application/json" }
if ($Jwt) { $headers["Authorization"] = "Bearer $Jwt" }

$body = @{ upc = $Upc } | ConvertTo-Json

try {
  $resp = Invoke-RestMethod `
    -Uri "https://uaqcehoocecvihubnbhp.supabase.co/functions/v1/full-score-from-upc/" `
    -Method Post `
    -Headers $headers `
    -Body $body `
    -MaximumRedirection 0

  $resp | ConvertTo-Json -Depth 10
} catch {
  Write-Error $_.Exception.Message
}