#!/usr/bin/env pwsh
# Update the backend URL in the app configuration

param(
    [Parameter(Mandatory=$true)]
    [string]$NgrokUrl
)

$configFile = "constants\backend-config.ts"

# Remove trailing slash if present
$NgrokUrl = $NgrokUrl.TrimEnd('/')

Write-Host "Updating backend configuration..." -ForegroundColor Green
Write-Host "New URL: $NgrokUrl" -ForegroundColor Cyan
Write-Host ""

# Read the file
$content = Get-Content $configFile -Raw

# Replace the URL
$pattern = "export const PHP_BACKEND_URL = '.*';"
$replacement = "export const PHP_BACKEND_URL = '$NgrokUrl';"
$newContent = $content -replace $pattern, $replacement

# Write back to file
$newContent | Set-Content $configFile -NoNewline

Write-Host "✓ Updated $configFile" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Restart your Expo app (press 'r' in terminal or shake device)" -ForegroundColor White
Write-Host "2. Try logging in again" -ForegroundColor White
