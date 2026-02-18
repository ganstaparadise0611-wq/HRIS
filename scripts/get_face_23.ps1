$ErrorActionPreference = 'Stop'
$connect = Get-Content -Raw .\backend-php\public\connect.php

# Extract SUPABASE_URL and key
if ($connect -match "SUPABASE_URL\s*=\s*'([^']+)'") { $supabaseUrl = $matches[1] } elseif ($connect -match "const SUPABASE_URL\s*=\s*'([^']+)'") { $supabaseUrl = $matches[1] }
if ($connect -match "SUPABASE_ANON_KEY\s*=\s*'([^']+)'") { $supabaseKey = $matches[1] } elseif ($connect -match "const SUPABASE_ANON_KEY\s*=\s*'([^']+)'") { $supabaseKey = $matches[1] }

if (-not $supabaseUrl -or -not $supabaseKey) { Write-Host 'ERROR: Could not read Supabase config from connect.php'; exit 1 }

Write-Host "Using Supabase URL: $supabaseUrl"

$apiUrl = "$supabaseUrl/rest/v1/accounts?log_id=eq.23&select=face,username,log_id"
Write-Host "Querying: $apiUrl"

try {
    $resp = Invoke-RestMethod -Uri $apiUrl -Headers @{ apikey = $supabaseKey; Authorization = 'Bearer ' + $supabaseKey } -ErrorAction Stop
} catch {
    Write-Host 'ERROR: Failed to query Supabase:' $_.Exception.Message
    exit 2
}

if (-not $resp -or $resp.Count -eq 0) { Write-Host 'ERROR: No account found for log_id=23'; exit 3 }

$face = $resp[0].face
$username = $resp[0].username
Write-Host "Found account: $username"
if (-not $face) { Write-Host 'ERROR: No face field stored for this user'; exit 4 }

if ($face -match '^data:[^;]+;base64,') { $base = $face -replace '^data:[^;]+;base64,','' } else { $base = $face }

try {
    $bytes = [Convert]::FromBase64String($base)
} catch {
    Write-Host 'ERROR: Stored face is not valid base64'; exit 5
}

$out = Join-Path $env:TEMP 'supabase_face_23.jpg'
[IO.File]::WriteAllBytes($out, $bytes)
Write-Host "Wrote temp file: $out"
exit 0
