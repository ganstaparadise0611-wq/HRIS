<#
Simple helper to register the startup batch as a Scheduled Task that runs at logon.
Run from an elevated PowerShell session if you want /RL HIGHEST privileges.
#>

$taskName = "Start My App Backend"
$batPath = Join-Path $PSScriptRoot "start-on-boot.bat"

if (-not (Test-Path $batPath)) {
    Write-Error "Batch file not found: $batPath"
    exit 1
}

$quoted = "`"$batPath`""

Write-Output "Creating scheduled task: $taskName -> $batPath"
schtasks /Create /SC ONLOGON /RL HIGHEST /TN "$taskName" /TR $quoted /F

Write-Output "Done. Use 'schtasks /Query /TN \"$taskName\"' to verify."
