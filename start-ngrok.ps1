# Start ngrok tunnel for PHP backend
# Make sure your PHP server is running first!

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "   Starting Ngrok Tunnel" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Make sure your PHP server is running:" -ForegroundColor Yellow
Write-Host "  php -S 0.0.0.0:8000 -t backend-php/public" -ForegroundColor White
Write-Host ""
Write-Host "Starting ngrok..." -ForegroundColor Green
Write-Host ""

$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

ngrok http 8000

# After ngrok starts, copy the https URL (e.g., https://abc-123.ngrok-free.app)
# Then update constants/backend-config.ts with that URL
