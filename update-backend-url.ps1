#!/usr/bin/env pwsh
# Update the backend URL in the app configuration

param(
    [Parameter(Mandatory=$true)]
    [string]$Url,
    
    [Parameter()]
    [ValidateSet("local", "ngrok", "auto")]
    [string]$Type = "auto"
)

$configFile = "constants\network-config.ts"

# Remove trailing slash if present
$Url = $Url.TrimEnd('/')

Write-Host "Updating network configuration..." -ForegroundColor Green
Write-Host "URL: $Url" -ForegroundColor Cyan
Write-Host "Type: $Type" -ForegroundColor Cyan
Write-Host ""

# Read the file
$content = Get-Content $configFile -Raw

# Determine which URL to update based on type or URL format
if ($Type -eq "auto") {
    if ($Url -like "http://192.168.*" -or $Url -like "http://10.*" -or $Url -like "http://172.*") {
        $Type = "local"
    } elseif ($Url -like "*ngrok*") {
        $Type = "ngrok"
    }
}

# Update the appropriate URL
if ($Type -eq "local") {
    $pattern = "local: '.*',"
    $replacement = "local: '$Url',"
    Write-Host "Updating local network URL..." -ForegroundColor Yellow
} else {
    $pattern = "ngrok: '.*',"
    $replacement = "ngrok: '$Url',"
    Write-Host "Updating ngrok URL..." -ForegroundColor Yellow
}

$newContent = $content -replace $pattern, $replacement

# Write back to file
$newContent | Set-Content $configFile -NoNewline

Write-Host "[OK] Updated $configFile" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Restart your Expo app (press r in terminal or shake device)" -ForegroundColor White
Write-Host "2. Try logging in again" -ForegroundColor White
