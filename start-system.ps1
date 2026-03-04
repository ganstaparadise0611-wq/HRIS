#!/usr/bin/env pwsh
# HRIS System - One-Click Startup Script with Auto-Network Detection
# This script automatically starts everything you need

param(
    [Parameter()]
    [ValidateSet("local", "ngrok", "both", "ask")]
    [string]$Mode = "ask"
)

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  HRIS System - Automated Startup" -ForegroundColor Cyan
Write-Host "  With Auto-Network Detection!" -ForegroundColor Green
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

# Ask user for mode if not specified
if ($Mode -eq "ask") {
    Write-Host "Setup network mode:" -ForegroundColor Yellow
    Write-Host "1. Configure both (local + ngrok) - AUTO-SWITCH enabled!" -ForegroundColor Cyan
    Write-Host "2. Local network only (same WiFi)" -ForegroundColor White
    Write-Host "3. Ngrok only (any network)" -ForegroundColor White
    Write-Host ""
    $choice = Read-Host "Enter your choice (1, 2, or 3)"
    
    if ($choice -eq "1") {
        $Mode = "both"
    } elseif ($choice -eq "2") {
        $Mode = "local"
    } elseif ($choice -eq "3") {
        $Mode = "ngrok"
    } else {
        Write-Host "Invalid choice. Exiting." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Starting in $Mode mode..." -ForegroundColor Green
Write-Host ""

# Load optional backend-php/.env (ignored by git) so Face++/Supabase keys can be set locally
function Import-DotEnvFile {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return }
    try {
        $lines = Get-Content $Path -ErrorAction Stop
        foreach ($line in $lines) {
            $t = $line.Trim()
            if (-not $t) { continue }
            if ($t.StartsWith("#")) { continue }
            $idx = $t.IndexOf("=")
            if ($idx -lt 1) { continue }
            $k = $t.Substring(0, $idx).Trim()
            $v = $t.Substring($idx + 1).Trim()
            # strip surrounding quotes
            if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
                $v = $v.Substring(1, $v.Length - 2)
            }
            if ($k) { $env:$k = $v }
        }
        Write-Host "[OK] Loaded environment from $Path" -ForegroundColor Green
    } catch {
        Write-Host "WARNING: Failed to load $Path: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Import-DotEnvFile -Path (Join-Path $PWD "backend-php\.env")

# Step 1: Start PHP Server in background
Write-Host "[1/4] Starting PHP backend server..." -ForegroundColor Cyan
$phpPath = "C:\xampp\php\php.exe"
if (-not (Test-Path $phpPath)) {
    $phpPath = (Get-Command php -ErrorAction SilentlyContinue).Source
    if (-not $phpPath) {
        Write-Host "ERROR: PHP not found. Please install XAMPP or PHP." -ForegroundColor Red
        exit 1
    }
}

$faceppKey = $env:FACEPP_API_KEY
$faceppSecret = $env:FACEPP_API_SECRET
$supabaseServiceRole = $env:SUPABASE_SERVICE_ROLE_KEY
$supabaseAnon = $env:SUPABASE_ANON_KEY

$serverJob = Start-Job -ScriptBlock {
    param($phpPath, $workDir, $faceppKey, $faceppSecret, $supabaseServiceRole, $supabaseAnon)
    Set-Location $workDir
    if ($faceppKey) { $env:FACEPP_API_KEY = $faceppKey }
    if ($faceppSecret) { $env:FACEPP_API_SECRET = $faceppSecret }
    if ($supabaseServiceRole) { $env:SUPABASE_SERVICE_ROLE_KEY = $supabaseServiceRole }
    if ($supabaseAnon) { $env:SUPABASE_ANON_KEY = $supabaseAnon }
    & $phpPath -S 0.0.0.0:8000 -t backend-php/public
} -ArgumentList $phpPath, $PWD, $faceppKey, $faceppSecret, $supabaseServiceRole, $supabaseAnon

Write-Host "[OK] PHP server started on port 8000" -ForegroundColor Green
Start-Sleep -Seconds 2

# Step 2: Configure local network
if ($Mode -eq "local" -or $Mode -eq "both") {
    Write-Host ""
    Write-Host "[2/4] Configuring local network..." -ForegroundColor Cyan
    $localIP = Get-LocalIP
    
    if (-not $localIP) {
        Write-Host "WARNING: Could not detect local IP address." -ForegroundColor Yellow
    } else {
        $localUrl = "http://${localIP}:8000"
        Write-Host "[OK] Local IP: $localUrl" -ForegroundColor Green
        .\update-backend-url.ps1 $localUrl -Type local
    }
}

# Step 3: Configure ngrok
$ngrokJob = $null
if ($Mode -eq "ngrok" -or $Mode -eq "both") {
    Write-Host ""
    Write-Host "[3/4] Setting up ngrok..." -ForegroundColor Cyan
    
    $ngrokPath = Get-Command ngrok -ErrorAction SilentlyContinue
    if (-not $ngrokPath) {
        Write-Host "WARNING: ngrok not installed. Skipping ngrok setup." -ForegroundColor Yellow
    } else {
        Write-Host "Starting ngrok tunnel..." -ForegroundColor Yellow
        
        $ngrokJob = Start-Job -ScriptBlock {
            ngrok http 8000 --log=stdout
        }
        
        Start-Sleep -Seconds 4
        
        try {
            $ngrokApi = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -ErrorAction Stop
            $ngrokUrl = $ngrokApi.tunnels[0].public_url
            
            if ($ngrokUrl) {
                Write-Host "[OK] Ngrok URL: $ngrokUrl" -ForegroundColor Green
                .\update-backend-url.ps1 $ngrokUrl -Type ngrok
            }
        } catch {
            Write-Host "WARNING: Could not get ngrok URL automatically." -ForegroundColor Yellow
        }
    }
} else {
    Write-Host ""
    Write-Host "[3/4] Skipping ngrok setup" -ForegroundColor Cyan
}

# Step 4: Start Expo
Write-Host ""
Write-Host "[4/4] Starting Expo development server..." -ForegroundColor Cyan
Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "  System Started!" -ForegroundColor Green

if ($Mode -eq "both") {
    Write-Host "  AUTO-SWITCH ENABLED" -ForegroundColor Cyan
    Write-Host "  App will automatically switch" -ForegroundColor Cyan
    Write-Host "  between local and ngrok!" -ForegroundColor Cyan
}

Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

npx expo start

# Cleanup
Write-Host ""
Write-Host "Shutting down..." -ForegroundColor Yellow
Stop-Job $serverJob -ErrorAction SilentlyContinue
Remove-Job $serverJob -ErrorAction SilentlyContinue

if ($ngrokJob) {
    Stop-Job $ngrokJob -ErrorAction SilentlyContinue
    Remove-Job $ngrokJob -ErrorAction SilentlyContinue
    Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force
}

Write-Host "[OK] All services stopped" -ForegroundColor Green
