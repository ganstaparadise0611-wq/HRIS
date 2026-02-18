param(
    [int]$PhpPort = 8000,
    [string]$NgrokPath = "C:\path\to\ngrok.exe",
    [string]$NgrokArgs = ""
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

if (-not (Test-Path "$scriptDir\logs")) { New-Item -ItemType Directory -Path "$scriptDir\logs" | Out-Null }

Write-Output "ngrok loop starting (watching $NgrokPath)" | Out-File -FilePath "$scriptDir\logs\ngrok-runloop.log" -Append

while ($true) {
    if (-not (Test-Path $NgrokPath)) {
        Write-Output "ngrok not found at $NgrokPath. Sleeping 10s..." | Out-File -FilePath "$scriptDir\logs\ngrok-runloop.log" -Append
        Start-Sleep -Seconds 10
        continue
    }

    $args = "http $PhpPort $NgrokArgs"
    Write-Output "Starting ngrok with: $args" | Out-File -FilePath "$scriptDir\logs\ngrok-runloop.log" -Append
    & $NgrokPath $args

    Write-Output "ngrok exited; restarting in 5s..." | Out-File -FilePath "$scriptDir\logs\ngrok-runloop.log" -Append
    Start-Sleep -Seconds 5
}
