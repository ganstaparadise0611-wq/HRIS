#!/usr/bin/env pwsh
# Start Ngrok tunnel to PHP backend

Write-Host "Starting Ngrok tunnel..." -ForegroundColor Green
Write-Host ""

# Check if ngrok is installed
$ngrokPath = Get-Command ngrok -ErrorAction SilentlyContinue
if (-not $ngrokPath) {
    Write-Host "ERROR: ngrok is not installed or not in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "To install ngrok:" -ForegroundColor Yellow
    Write-Host "1. Visit: https://ngrok.com/download" -ForegroundColor Yellow
    Write-Host "2. Download and extract ngrok.exe" -ForegroundColor Yellow
    Write-Host "3. Add to PATH or place in this directory" -ForegroundColor Yellow
    exit 1
}

# Start ngrok on port 8000
Write-Host "Creating tunnel to http://localhost:8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Copy the HTTPS URL that appears below and use it to update backend-config.ts" -ForegroundColor Yellow
Write-Host ""

ngrok http 8000
