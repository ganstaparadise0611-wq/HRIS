# start-php-dev.ps1
# Starts PHP built-in server for the project if it's not already running on port 8000.

$addr = '10.253.120.119:8000'
$port = 8000
$docRoot = 'C:\Users\Vince\OneDrive\文件\NEW\backend-php\public'

$phpExe = (Get-Command php -ErrorAction SilentlyContinue).Source
if (-not $phpExe) {
  Write-Host "php.exe not found in PATH. Please install PHP or add it to PATH." -ForegroundColor Yellow
  return
}

function PortInUse {
  param($p)
  try {
    $conn = Get-NetTCPConnection -LocalPort $p -ErrorAction Stop
    return $conn -ne $null
  } catch {
    # Fallback to netstat parse if Get-NetTCPConnection not available
    $out = & netstat -ano | findstr ":$p"
    return -not [string]::IsNullOrEmpty($out)
  }
}

if (PortInUse -p $port) {
  Write-Host "Port $port already in use. PHP server may already be running." -ForegroundColor Green
  return
}

# Start PHP built-in server
Start-Process -FilePath $phpExe -ArgumentList "-S $addr -t `"$docRoot`"" -WorkingDirectory $docRoot -WindowStyle Hidden
Start-Sleep -Seconds 1
if (PortInUse -p $port) {
  Write-Host "Started PHP dev server at http://$addr" -ForegroundColor Green
} else {
  Write-Host "Failed to start PHP dev server. Check PHP installation and document root." -ForegroundColor Red
}
