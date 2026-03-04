#!/usr/bin/env pwsh
# Start localtunnel on port 8000 (ngrok alternative - no bandwidth limit)
# Usage: .\start-localtunnel.ps1
# Then copy the URL (e.g. https://xyz.loca.lt) into constants/network-config.ts as custom

Write-Host "Starting localtunnel on port 8000..." -ForegroundColor Cyan
Write-Host "Copy the URL below into constants/network-config.ts: custom: 'https://...'" -ForegroundColor Yellow
Write-Host "Set preferred: 'custom' in network-config.ts" -ForegroundColor Yellow
Write-Host ""
npx localtunnel --port 8000
