$supabaseUrl = "$env:SUPABASE_URL"
$supabaseAnonKey = "$env:SUPABASE_ANON_KEY"
$functionName = "full-score-from-upc"
$upc = "0851770007566"

$headers = @{
    "Authorization" = "Bearer $supabaseAnonKey"
    "Content-Type" = "application/json"
}

$body = @{
    "upc" = $upc
} | ConvertTo-Json

$uri = "$supabaseUrl/functions/v1/$functionName"

try {
    $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body -Verbose
    Write-Output "Response:"
    $response | ConvertTo-Json -Depth 10 | Write-Output
} catch {
    Write-Host "Error calling function:"
    Write-Host $_.Exception.ToString()
    if ($_.Exception.Response) {
        $errorResponse = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorResponse)
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error Body:"
        Write-Host $errorBody
    }
}