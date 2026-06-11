# Run once to set GOOGLE_SERVICE_ACCOUNT_JSON on the Railway service via API.
# Usage: ! .\set-railway-gcs.ps1
Set-Location "C:\code\copper\demo.v02"

$line = (Get-Content ".env" | Select-String "^GOOGLE_SERVICE_ACCOUNT_JSON=").Line
if (-not $line) { Write-Host "ERROR: GOOGLE_SERVICE_ACCOUNT_JSON not found in .env"; exit 1 }
$saJson = $line -replace "^GOOGLE_SERVICE_ACCOUNT_JSON=", ""

Write-Host "Setting GOOGLE_SERVICE_ACCOUNT_JSON ($($saJson.Length) chars) via Railway API..."

# Read Railway config for IDs and token
$cfg = Get-Content "$env:USERPROFILE\.railway\config.json" | ConvertFrom-Json
$proj = $cfg.projects."C:\code\copper\demo.v02"
$token = $cfg.user.accessToken

$body = @{
    query = 'mutation VariableUpsert($input: VariableUpsertInput!) { variableUpsert(input: $input) }'
    variables = @{
        input = @{
            projectId     = $proj.project
            environmentId = $proj.environment
            serviceId     = $proj.service
            name          = "GOOGLE_SERVICE_ACCOUNT_JSON"
            value         = $saJson
        }
    }
} | ConvertTo-Json -Depth 5 -Compress

$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}

$resp = Invoke-RestMethod -Uri "https://backboard.railway.app/graphql/v2" -Method POST -Headers $headers -Body $body
if ($resp.data.variableUpsert -eq $true) {
    Write-Host "Done. Variable set. Railway will redeploy automatically."
} else {
    Write-Host "ERROR: $($resp | ConvertTo-Json)"
}
