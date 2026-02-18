#!/usr/bin/env pwsh
# Quick Network Mode Switcher
# Usage: .\switch-network.ps1 [local|ngrok]

param(
    [Parameter()]
    [ValidateSet("local", "ngrok", "")]
    [string]$Mode = ""
)

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Network Mode Switcher" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Function to get local IP
function Get-LocalIP {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
        $_.InterfaceAlias -notlike "*Loopback*" -and 
        $_.IPAddress -notlike "169.254.*" -and
        ($_.PrefixOrigin -eq "Dhcp" -or $_.PrefixOrigin -eq "Manual")
    } | Select-Object -First 1).IPAddress
    return $ip
}

# Show current config
$configFile = "constants\network-config.ts"
$content = Get-Content $configFile -Raw
$localUrl = ($content | Select-String "local: '(.*)',").Matches.Groups[1].Value
$ngrokUrl = ($content | Select-String "ngrok: '(.*)',").Matches.Groups[1].Value
$preferred = ($content | Select-String "preferred: '(.*)'").Matches.Groups[1].Value

Write-Host "Current network configuration:" -ForegroundColor Yellow
Write-Host "  Local:     $localUrl" -ForegroundColor White
Write-Host "  Ngrok:     $ngrokUrl" -ForegroundColor White  
Write-Host "  Preferred: $preferred" -ForegroundColor Cyan
Write-Host ""

# Ask for mode if not provided
if (-not $Mode) {
    Write-Host "Switch to:" -ForegroundColor Yellow
    Write-Host "1. Local Network (same WiFi)" -ForegroundColor White
    Write-Host "2. Ngrok (any network)" -ForegroundColor White
    Write-Host ""
    $choice = Read-Host "Enter your choice (1 or 2)"
    
    if ($choice -eq "1") {
        $Mode = "local"
    } elseif ($choice -eq "2") {
        $Mode = "ngrok"
    } else {
        Write-Host "Cancelled." -ForegroundColor Red
        exit 0
    }
}

Write-Host ""

# Switch mode
if ($Mode -eq "local") {
    Write-Host "Switching to LOCAL NETWORK mode..." -ForegroundColor Green
    Write-Host ""
    
    $localIP = Get-LocalIP
    if (-not $localIP) {
        Write-Host "ERROR: Could not detect local IP address." -ForegroundColor Red
        Write-Host ""
        Write-Host "Run this command to find your IP:" -ForegroundColor Yellow
        Write-Host "  ipconfig" -ForegroundColor White
        Write-Host ""
        Write-Host "Then manually run:" -ForegroundColor Yellow
        Write-Host "  .\update-backend-url.ps1 `"http://YOUR-IP:8000`"" -ForegroundColor White
        exit 1
    }
    
    $newUrl = "http://${localIP}:8000"
    Write-Host "Detected local IP: $localIP" -ForegroundColor Cyan
    Write-Host "New backend URL: $newUrl" -ForegroundColor Cyan
    Write-Host ""
    
    # Update config
    .\update-backend-url.ps1 $newUrl -Type local
    
    Write-Host ""
    Write-Host "✓ Switched to local network mode!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "  • Your PHP server is running on port 8000" -ForegroundColor White
    Write-Host "  • Your phone is on the SAME WiFi network" -ForegroundColor White
    
} elseif ($Mode -eq "ngrok") {
    Write-Host "Switching to NGROK mode..." -ForegroundColor Green
    Write-Host ""
    
    # Check if ngrok is running
    $ngrokRunning = $false
    try {
        $ngrokApi = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -ErrorAction Stop
        $ngrokUrl = $ngrokApi.tunnels[0].public_url
        
        if ($ngrokUrl) {
            Write-Host "✓ Detected running ngrok tunnel!" -ForegroundColor Green
            Write-Host "URL: $ngrokUrl" -ForegroundColor Cyan
            Write-Host ""
            
            # Update config
            .\update-backend-url.ps1 $ngrokUrl -Type ngrok
            
            $ngrokRunning = $true
        }
    } catch {
        $ngrokRunning = $false
    }
    
    if (-not $ngrokRunning) {
        Write-Host "⚠ Ngrok is not currently running." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "To start ngrok:" -ForegroundColor Yellow
        Write-Host "  1. Open a new terminal" -ForegroundColor White
        Write-Host "  2. Run: .\start-ngrok.ps1" -ForegroundColor White
        Write-Host "  3. Copy the HTTPS URL" -ForegroundColor White
        Write-Host "  4. Run: .\update-backend-url.ps1 `"YOUR-NGROK-URL`"" -ForegroundColor White
        Write-Host ""
        Write-Host "Or use the automated script: .\start-system.ps1" -ForegroundColor Cyan
        exit 1
    }
    
    Write-Host ""
    Write-Host "✓ Switched to ngrok mode!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now access from any network!" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next step:" -ForegroundColor Yellow
Write-Host "  • Restart your Expo app (press 'r' in terminal)" -ForegroundColor White
Write-Host "  • Or shake your device and tap 'Reload'" -ForegroundColor White
Write-Host ""
