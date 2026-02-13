# Update Backend Config with Ngrok URL
# Usage: .\update-backend-url.ps1 "https://your-ngrok-url.ngrok-free.app"

param(
    [Parameter(Mandatory=$true)]
    [string]$NgrokUrl
)

$configFile = "constants\backend-config.ts"

if (Test-Path $configFile) {
    $content = Get-Content $configFile -Raw
    
    # Replace the URL in the config file
    $content = $content -replace "export const PHP_BACKEND_URL = '[^']*';", "export const PHP_BACKEND_URL = '$NgrokUrl';"
    
    Set-Content $configFile -Value $content -NoNewline
    
    Write-Host "✅ Updated backend-config.ts with: $NgrokUrl" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Restart your Expo app (press 'r' in the terminal)" -ForegroundColor White
    Write-Host "2. Try logging in again!" -ForegroundColor White
} else {
    Write-Host "❌ Error: Could not find $configFile" -ForegroundColor Red
}
